export type FeatureFlagState<T = unknown> = {
  enabled: boolean
  value?: T
}

export type FeatureFlagsSnapshot = Record<string, FeatureFlagState>

export type FeatureFlagsIdentityTrait = {
  transient?: boolean
  value: unknown
}

export type FeatureFlagsContextState = {
  identity?: {
    identifier: string
    traits?: Record<string, FeatureFlagsIdentityTrait>
    transient?: boolean
  }
}

export type FeatureFlagsClientStatusSource = 'fallback' | 'mock' | 'remote'

export type FeatureFlagsClientStatus = {
  error: string | null
  isLoading: boolean
  source: FeatureFlagsClientStatusSource
  updatedAt: string | null
}

export interface FeatureFlagsClient {
  getSnapshot: () => FeatureFlagsSnapshot
  subscribe: (listener: () => void) => () => void
  initialize?: () => Promise<void> | void
  destroy?: () => Promise<void> | void
  getContext?: () => FeatureFlagsContextState | null
  getStatus?: () => FeatureFlagsClientStatus
  setContext?: (context: FeatureFlagsContextState) => Promise<void> | void
}
