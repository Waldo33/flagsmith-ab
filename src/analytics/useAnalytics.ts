import { useContext, useSyncExternalStore } from 'react'
import { AnalyticsContext } from './AnalyticsContext'
import type { AnalyticsEvent, AnalyticsEventBus, AnalyticsEventInput } from './types'

const emptyEventList: AnalyticsEvent[] = []

function useAnalyticsEventBus(): AnalyticsEventBus {
  const bus = useContext(AnalyticsContext)

  if (!bus) {
    throw new Error(
      'Analytics event bus is missing. Wrap the app with AnalyticsProvider.',
    )
  }

  return bus
}

export function useAnalyticsEvents(): AnalyticsEvent[] {
  const bus = useAnalyticsEventBus()

  return useSyncExternalStore(
    bus.subscribe,
    bus.getSnapshot,
    () => emptyEventList,
  )
}

export function useTrackEvent(): (event: AnalyticsEventInput) => Promise<void> | void {
  const bus = useAnalyticsEventBus()

  return (event) => bus.track(event)
}
