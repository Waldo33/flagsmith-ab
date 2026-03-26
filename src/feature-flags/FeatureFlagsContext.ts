import { createContext } from 'react'
import type { FeatureFlagsClient } from './types'

export const FeatureFlagsContext = createContext<FeatureFlagsClient | null>(null)
