export type AnalyticsEventPayload = Record<string, unknown>
export type AnalyticsEventContext = Record<string, unknown>

export type AnalyticsEventInput = {
  name: string
  payload?: AnalyticsEventPayload
  context?: AnalyticsEventContext
  timestamp?: string
}

export type AnalyticsEvent = AnalyticsEventInput & {
  id: string
  timestamp: string
}

export interface AnalyticsTransport {
  send: (event: AnalyticsEvent) => Promise<void> | void
}

export interface AnalyticsEventBus {
  getSnapshot: () => AnalyticsEvent[]
  subscribe: (listener: () => void) => () => void
  track: (event: AnalyticsEventInput) => Promise<void> | void
  clear?: () => void
}
