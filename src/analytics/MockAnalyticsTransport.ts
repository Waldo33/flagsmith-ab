import type { AnalyticsEvent, AnalyticsTransport } from './types'

export class MockAnalyticsTransport implements AnalyticsTransport {
  private events: AnalyticsEvent[] = []

  send = (event: AnalyticsEvent): void => {
    this.events = [event, ...this.events]
  }

  getEvents(): AnalyticsEvent[] {
    return this.events
  }

  clear(): void {
    this.events = []
  }
}
