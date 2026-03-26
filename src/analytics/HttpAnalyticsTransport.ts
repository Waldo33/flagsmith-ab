import type { AnalyticsEvent, AnalyticsTransport } from './types'

type HttpAnalyticsTransportOptions = {
  endpoint: string
  headers?: HeadersInit
  keepalive?: boolean
  method?: 'POST' | 'PUT' | 'PATCH'
}

export class HttpAnalyticsTransport implements AnalyticsTransport {
  private readonly endpoint: string
  private readonly headers?: HeadersInit
  private readonly keepalive: boolean
  private readonly method: 'POST' | 'PUT' | 'PATCH'

  constructor({
    endpoint,
    headers,
    keepalive = false,
    method = 'POST',
  }: HttpAnalyticsTransportOptions) {
    this.endpoint = endpoint
    this.headers = headers
    this.keepalive = keepalive
    this.method = method
  }

  send = async (event: AnalyticsEvent): Promise<void> => {
    const response = await fetch(this.endpoint, {
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      keepalive: this.keepalive,
      method: this.method,
    })

    if (!response.ok) {
      throw new Error(
        `Analytics transport failed with status ${response.status}`,
      )
    }
  }
}
