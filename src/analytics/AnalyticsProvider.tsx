import type { ReactNode } from 'react'
import { AnalyticsContext } from './AnalyticsContext'
import type { AnalyticsEventBus } from './types'

type AnalyticsProviderProps = {
  bus: AnalyticsEventBus
  children: ReactNode
}

export function AnalyticsProvider({
  bus,
  children,
}: AnalyticsProviderProps) {
  return <AnalyticsContext.Provider value={bus}>{children}</AnalyticsContext.Provider>
}
