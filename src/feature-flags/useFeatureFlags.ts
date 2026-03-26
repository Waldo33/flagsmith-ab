import { useContext, useSyncExternalStore } from 'react'
import { FeatureFlagsContext } from './FeatureFlagsContext'
import type {
  FeatureFlagState,
  FeatureFlagsClient,
  FeatureFlagsClientStatus,
  FeatureFlagsSnapshot,
} from './types'

const defaultFlagState: FeatureFlagState = Object.freeze({ enabled: false })
const defaultStatus: FeatureFlagsClientStatus = Object.freeze({
  error: null,
  isLoading: false,
  source: 'fallback',
  updatedAt: null,
})
const emptySnapshot: FeatureFlagsSnapshot = Object.freeze({})

export function useFeatureFlagsClient(): FeatureFlagsClient {
  const client = useContext(FeatureFlagsContext)

  if (!client) {
    throw new Error(
      'Feature flags client is missing. Wrap the app with FeatureFlagsProvider.',
    )
  }

  return client
}

export function useFeatureFlags(): FeatureFlagsSnapshot {
  const client = useFeatureFlagsClient()

  return useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    () => emptySnapshot,
  )
}

export function useFeatureFlagsStatus(): FeatureFlagsClientStatus {
  const client = useFeatureFlagsClient()

  return useSyncExternalStore(
    client.subscribe,
    () => client.getStatus?.() ?? defaultStatus,
    () => defaultStatus,
  )
}

export function useFeatureFlag(name: string): FeatureFlagState {
  const flags = useFeatureFlags()

  return flags[name] ?? defaultFlagState
}

export function useFeatureFlagEnabled(name: string): boolean {
  return useFeatureFlag(name).enabled
}

export function useFeatureFlagValue<T>(name: string, fallback: T): T {
  const flag = useFeatureFlag(name)

  return (flag.value as T | undefined) ?? fallback
}
