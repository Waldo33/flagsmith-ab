import type {
  FeatureFlagState,
  FeatureFlagsClient,
  FeatureFlagsClientStatus,
  FeatureFlagsContextState,
  FeatureFlagsSnapshot,
} from './types'

export class MockFeatureFlagsClient implements FeatureFlagsClient {
  private context: FeatureFlagsContextState | null = null
  private listeners = new Set<() => void>()
  private snapshot: FeatureFlagsSnapshot
  private readonly status: FeatureFlagsClientStatus = {
    error: null,
    isLoading: false,
    source: 'mock',
    updatedAt: new Date().toISOString(),
  }

  constructor(initialFlags: FeatureFlagsSnapshot = {}) {
    this.snapshot = { ...initialFlags }
  }

  getContext = (): FeatureFlagsContextState | null => this.context

  getSnapshot = (): FeatureFlagsSnapshot => this.snapshot

  getStatus = (): FeatureFlagsClientStatus => this.status

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  setContext = (context: FeatureFlagsContextState): void => {
    this.context = context
    this.emit()
  }

  setFlag(name: string, flag: FeatureFlagState): void {
    this.snapshot = {
      ...this.snapshot,
      [name]: { ...flag },
    }

    this.status.updatedAt = new Date().toISOString()
    this.emit()
  }

  setFlags(flags: FeatureFlagsSnapshot): void {
    this.snapshot = { ...flags }
    this.status.updatedAt = new Date().toISOString()
    this.emit()
  }

  mergeFlags(flags: FeatureFlagsSnapshot): void {
    this.snapshot = {
      ...this.snapshot,
      ...flags,
    }

    this.status.updatedAt = new Date().toISOString()
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
