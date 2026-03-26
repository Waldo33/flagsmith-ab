import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrackEvent } from './analytics'
import {
  analyticsEnv,
  captureExperimentEvent,
  fetchExperimentSummary,
  getExperimentSummaryErrorMessage,
  resetSeenEventCache,
  type ExperimentSummaryRow,
} from './lib/analytics'
import {
  getOrCreateExperimentIdentity,
  rotateExperimentIdentity,
} from './lib/identity'
import {
  flagsmithEnv,
  resolveVariant,
  type CtaVariant,
} from './lib/flagsmith'
import {
  useFeatureFlag,
  useFeatureFlagsClient,
  useFeatureFlagsStatus,
} from './feature-flags'
import './App.css'

const ctaCopy: Record<CtaVariant, { buttonText: string }> = {
  green: {
    buttonText: 'Получить предложение',
  },
  red: {
    buttonText: 'Узнать вашу выгоду',
  },
}

const loadingCopy = {
  buttonText: 'Загружаем...',
}

const unavailableCopy = {
  buttonText: 'Предложение недоступно',
}

function App() {
  const trackEvent = useTrackEvent()
  const featureFlagsClient = useFeatureFlagsClient()
  const featureFlagsStatus = useFeatureFlagsStatus()
  const flagState = useFeatureFlag(flagsmithEnv.flagKey)
  const [identity, setIdentity] = useState(getOrCreateExperimentIdentity)
  const [summaryRows, setSummaryRows] = useState<ExperimentSummaryRow[]>([])
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const lastSeenVariant = useRef<CtaVariant | null>(null)

  const remoteVariant = flagState.enabled ? resolveVariant(flagState.value) : null
  const isExperimentReady =
    !featureFlagsStatus.isLoading &&
    !featureFlagsStatus.error &&
    remoteVariant !== null
  const currentCard = featureFlagsStatus.error
    ? unavailableCopy
    : isExperimentReady
      ? ctaCopy[remoteVariant]
      : loadingCopy

  const refreshSummary = useCallback(async () => {
    try {
      const nextSummary = await fetchExperimentSummary(flagsmithEnv.flagKey)
      setSummaryRows(nextSummary.variants)
      setSummaryError(null)
    } catch (error) {
      console.error('Failed to refresh experiment summary', error)
      setSummaryError(getExperimentSummaryErrorMessage(error))
    } finally {
      setIsSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSummary()

    const intervalId = window.setInterval(() => {
      void refreshSummary()
    }, analyticsEnv.summaryPollMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshSummary])

  useEffect(() => {
    if (
      !isExperimentReady ||
      remoteVariant === null ||
      lastSeenVariant.current === remoteVariant
    ) {
      return
    }

    lastSeenVariant.current = remoteVariant

    captureExperimentEvent(trackEvent, {
      distinctId: identity,
      eventName: 'ab_cta_seen',
      experiment: flagsmithEnv.flagKey,
      variant: remoteVariant,
      variantSource: 'flagsmith',
    })
  }, [identity, isExperimentReady, remoteVariant, trackEvent])

  const handleCtaClick = () => {
    if (!isExperimentReady || remoteVariant === null) {
      return
    }

    captureExperimentEvent(trackEvent, {
      distinctId: identity,
      eventName: 'ab_cta_clicked',
      experiment: flagsmithEnv.flagKey,
      variant: remoteVariant,
      variantSource: 'flagsmith',
    })

    window.setTimeout(() => {
      void refreshSummary()
    }, 250)
  }

  const handleRotateIdentity = async () => {
    const previousIdentity = identity
    const nextIdentity = rotateExperimentIdentity()

    resetSeenEventCache(previousIdentity, flagsmithEnv.flagKey)
    lastSeenVariant.current = null

    setIdentity(nextIdentity)
    setIsSummaryLoading(true)

    await featureFlagsClient.setContext?.({
      identity: {
        identifier: nextIdentity,
      },
    })

    window.setTimeout(() => {
      void refreshSummary()
    }, 250)
  }

  return (
    <main className="app-shell">
      <section className="vote-card">
        <button
          className={`cta-button ${
            isExperimentReady ? `cta-button-${remoteVariant}` : 'cta-button-loading'
          }`}
          disabled={!isExperimentReady}
          onClick={handleCtaClick}
          type="button"
        >
          {currentCard.buttonText}
        </button>

        <section className="summary-panel">
          {featureFlagsStatus.error ? (
            <p className="summary-message">{featureFlagsStatus.error}</p>
          ) : isSummaryLoading ? (
            <p className="summary-message">Загружаем результаты...</p>
          ) : summaryError ? (
            <p className="summary-message">{summaryError}</p>
          ) : summaryRows.length === 0 ? (
            <p className="summary-message">Данных пока нет.</p>
          ) : (
            <div className="summary-list">
              {summaryRows.map((row) => (
                <div
                  key={row.variant}
                  className={`summary-row summary-row-${row.variant}`}
                >
                  <strong>
                    {row.variant === 'green' ? 'Зеленая' : 'Красная'}
                  </strong>
                  <div className="summary-stats">
                    <span>{row.unique_seen} увидели</span>
                    <span>{row.unique_clicked} кликнули</span>
                    <span>{row.raw_clicked} кликов всего</span>
                    <span>{row.ctr}% CTR</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          className="identity-button"
          disabled={featureFlagsStatus.isLoading}
          onClick={() => {
            void handleRotateIdentity()
          }}
          type="button"
        >
          Другой пользователь
        </button>
      </section>
    </main>
  )
}

export default App
