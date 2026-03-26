import type {
  AnalyticsEvent,
  AnalyticsEventBus,
  AnalyticsEventInput,
  AnalyticsTransport,
} from './types'

function createEventId(): string {
  // if (typeof globalThis.crypto?.randomUUID === 'function') {
  //   return globalThis.crypto.randomUUID()
  // }
  

  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function toAnalyticsEvent(event: AnalyticsEventInput): AnalyticsEvent {
  return {
    ...event,
    id: createEventId(),
    timestamp: event.timestamp ?? new Date().toISOString(),
  }
}

export class InMemoryAnalyticsEventBus implements AnalyticsEventBus {
  private events: AnalyticsEvent[] = []
  private listeners = new Set<() => void>()
  private readonly transports: AnalyticsTransport[]

  constructor(transports: AnalyticsTransport[] = []) {
    this.transports = transports
  }

  getSnapshot = (): AnalyticsEvent[] => this.events

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  track = async (event: AnalyticsEventInput): Promise<void> => {
    const nextEvent = toAnalyticsEvent(event)

    this.events = [nextEvent, ...this.events]
    this.emit()

    await Promise.allSettled(
      this.transports.map(async (transport) => {
        await transport.send(nextEvent)
      }),
    )
  }

  clear = (): void => {
    this.events = []
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
