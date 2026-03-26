import type { AnalyticsEventInput } from '../analytics'
import type { CtaVariant } from './flagsmith'

export type ExperimentEventName = 'ab_cta_seen' | 'ab_cta_clicked'
export type VariantSource = 'flagsmith' | 'fallback'

export type ExperimentSummaryRow = {
  ctr: number
  raw_clicked: number
  unique_clicked: number
  unique_seen: number
  variant: string
}

export type ExperimentSummary = {
  experiment: string
  generatedAt: string
  variants: ExperimentSummaryRow[]
}

export class AnalyticsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AnalyticsApiError'
    this.status = status
  }
}

type CaptureExperimentEventParams = {
  distinctId: string
  eventName: ExperimentEventName
  experiment: string
  variant: CtaVariant
  variantSource: VariantSource
}

type TrackEvent = (event: AnalyticsEventInput) => Promise<void> | void

const sentSeenEvents = new Set<string>()

export const analyticsEnv = {
  apiUrl: import.meta.env.VITE_ANALYTICS_API_URL || '/analytics',
  summaryPollMs: 15_000,
}

function getSummaryErrorDetail(detail: unknown): string | null {
  return typeof detail === 'string' && detail.trim() ? detail.trim() : null
}

async function readAnalyticsErrorDetail(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as { error?: unknown }
      return getSummaryErrorDetail(payload.error)
    } catch {
      return null
    }
  }

  return null
}

function buildSeenEventKey({
  distinctId,
  eventName,
  experiment,
  variant,
  variantSource,
}: CaptureExperimentEventParams) {
  return `${eventName}:${experiment}:${distinctId}:${variant}:${variantSource}`
}

export function resetSeenEventCache(distinctId: string, experiment: string) {
  for (const key of sentSeenEvents) {
    if (key.includes(`:${experiment}:${distinctId}:`)) {
      sentSeenEvents.delete(key)
    }
  }
}

export function captureExperimentEvent(
  trackEvent: TrackEvent,
  payload: CaptureExperimentEventParams,
) {
  if (payload.eventName === 'ab_cta_seen') {
    const eventKey = buildSeenEventKey(payload)

    if (sentSeenEvents.has(eventKey)) {
      return
    }

    sentSeenEvents.add(eventKey)
  }

  void trackEvent({
    name: payload.eventName,
    payload: {
      distinctId: payload.distinctId,
      eventName: payload.eventName,
      experiment: payload.experiment,
      pageUrl: window.location.href,
      referrer: document.referrer,
      variant: payload.variant,
      variantSource: payload.variantSource,
    },
    context: {
      locale: 'ru-RU',
      source: 'frontend',
    },
  })
}

export function getExperimentSummaryErrorMessage(error: unknown): string {
  if (error instanceof AnalyticsApiError) {
    if ([502, 503, 504].includes(error.status)) {
      return 'Сервис аналитики временно недоступен. Попробуйте позже.'
    }

    return 'Не удалось загрузить результаты эксперимента.'
  }

  if (error instanceof TypeError) {
    return 'Не удалось подключиться к сервису аналитики.'
  }

  return 'Не удалось связаться с сервисом аналитики.'
}

export async function fetchExperimentSummary(experiment: string) {
  const response = await fetch(
    `${analyticsEnv.apiUrl}/api/experiments/${encodeURIComponent(experiment)}/summary`,
  )

  if (!response.ok) {
    const detail = await readAnalyticsErrorDetail(response)
    const message = detail
      ? `Analytics service returned ${response.status}: ${detail}`
      : `Analytics service returned ${response.status}`

    throw new AnalyticsApiError(message, response.status)
  }

  return (await response.json()) as ExperimentSummary
}
