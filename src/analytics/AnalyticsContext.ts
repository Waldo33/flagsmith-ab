import { createContext } from 'react'
import type { AnalyticsEventBus } from './types'

export const AnalyticsContext = createContext<AnalyticsEventBus | null>(null)
