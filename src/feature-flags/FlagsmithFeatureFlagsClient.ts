import {
  FlagSource,
  createFlagsmithInstance,
  type ClientEvaluationContext,
  type IFlags,
  type IFlagsmith,
  type IState,
  type LoadingState,
} from '@flagsmith/flagsmith'
import type {
  FeatureFlagState,
  FeatureFlagsClient,
  FeatureFlagsClientStatus,
  FeatureFlagsContextState,
  FeatureFlagsSnapshot,
} from './types'

type FlagsmithFeatureFlagsClientOptions = {
  apiUrl: string
  bootstrapState?: IState<string>
  context?: FeatureFlagsContextState
  environmentId?: string
  fallbackFlags?: FeatureFlagsSnapshot
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`
}

function normalizeFlags(flags: IFlags<string> | null | undefined): FeatureFlagsSnapshot {
  if (!flags) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(flags).map(([key, flag]) => [
      key,
      {
        enabled: flag.enabled,
        value: flag.value,
      } satisfies FeatureFlagState,
    ]),
  )
}

function toDefaultFlags(snapshot: FeatureFlagsSnapshot): IFlags<string> {
  return Object.fromEntries(
    Object.entries(snapshot).map(([key, flag]) => [
      key,
      {
        enabled: flag.enabled,
        value: (flag.value ?? null) as string | number | boolean | null,
      },
    ]),
  )
}

function toFlagsmithContext(
  context: FeatureFlagsContextState | null | undefined,
): ClientEvaluationContext {
  const identity = context?.identity

  return {
    identity: identity?.identifier
      ? {
          identifier: identity.identifier,
          transient: identity.transient,
          traits: identity.traits
            ? Object.fromEntries(
                Object.entries(identity.traits).map(([key, trait]) => [
                  key,
                  {
                    transient: trait.transient,
                    value: trait.value,
                  },
                ]),
              )
            : undefined,
        }
      : undefined,
  }
}

function mapLoadingStateSource(
  source: LoadingState['source'] | undefined,
): FeatureFlagsClientStatus['source'] {
  if (
    source === FlagSource.SERVER ||
    source === FlagSource.CACHE
  ) {
    return 'remote'
  }

  return 'fallback'
}

export class FlagsmithFeatureFlagsClient implements FeatureFlagsClient {
  private readonly apiUrl: string
  private readonly bootstrapState?: IState<string>
  private context: FeatureFlagsContextState | null
  private readonly environmentId?: string
  private readonly fallbackFlags: FeatureFlagsSnapshot
  private readonly flagsmith: IFlagsmith
  private listeners = new Set<() => void>()
  private snapshot: FeatureFlagsSnapshot
  private status: FeatureFlagsClientStatus
  private initializePromise: Promise<void> | null = null
  private hasInitialized = false

  constructor({
    apiUrl,
    bootstrapState,
    context,
    environmentId,
    fallbackFlags = {},
  }: FlagsmithFeatureFlagsClientOptions) {
    this.apiUrl = normalizeApiUrl(apiUrl)
    this.bootstrapState = bootstrapState
      ? {
          ...bootstrapState,
          api: this.apiUrl,
        }
      : undefined
    this.context = context ?? null
    this.environmentId = environmentId
    this.fallbackFlags = { ...fallbackFlags }
    const bootstrapSnapshot = normalizeFlags(bootstrapState?.flags)
    this.snapshot =
      Object.keys(bootstrapSnapshot).length > 0
        ? bootstrapSnapshot
        : { ...fallbackFlags }
    this.status = {
      error: null,
      isLoading: Boolean(environmentId),
      source: environmentId ? 'remote' : 'fallback',
      updatedAt: null,
    }
    this.flagsmith = createFlagsmithInstance()
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

  initialize = async (): Promise<void> => {
    if (!this.environmentId) {
      this.snapshot = { ...this.fallbackFlags }
      this.status = {
        error: 'Client-side Environment Key не задан, используется fallback.',
        isLoading: false,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
      }
      this.emit()
      return
    }

    if (this.hasInitialized) {
      return this.initializePromise ?? Promise.resolve()
    }

    this.hasInitialized = true
    this.initializePromise = this.flagsmith.init({
      api: this.apiUrl,
      cacheFlags: true,
      defaultFlags: toDefaultFlags(this.fallbackFlags),
      environmentID: this.environmentId,
      evaluationContext: toFlagsmithContext(this.context),
      enableAnalytics: true,
      onChange: this.handleFlagsmithChange,
      onError: this.handleFlagsmithError,
      state: this.bootstrapState,
    })

    try {
      await this.initializePromise
      this.syncFromFlagsmith()
    } finally {
      this.initializePromise = null
    }
  }

  setContext = async (context: FeatureFlagsContextState): Promise<void> => {
    this.context = context

    if (!this.environmentId) {
      this.snapshot = { ...this.fallbackFlags }
      this.emit()
      return
    }

    if (!this.hasInitialized) {
      await this.initialize()
      return
    }

    await this.flagsmith.setContext(toFlagsmithContext(context))
    this.syncFromFlagsmith()
  }

  destroy = (): void => {
    this.flagsmith.stopListening()
  }

  private handleFlagsmithChange = (): void => {
    this.syncFromFlagsmith()
  }

  private handleFlagsmithError = (error: Error): void => {
    this.status = {
      error: error.message,
      isLoading: false,
      source: Object.keys(this.snapshot).length ? 'remote' : 'fallback',
      updatedAt: new Date().toISOString(),
    }
    this.emit()
  }

  private syncFromFlagsmith(): void {
    const nextSnapshot = normalizeFlags(this.flagsmith.getAllFlags())
    const loadingState = this.flagsmith.loadingState

    this.snapshot =
      Object.keys(nextSnapshot).length > 0 ? nextSnapshot : { ...this.fallbackFlags }
    this.status = {
      error: loadingState?.error?.message ?? null,
      isLoading: loadingState?.isLoading ?? false,
      source:
        Object.keys(nextSnapshot).length > 0
          ? mapLoadingStateSource(loadingState?.source)
          : 'fallback',
      updatedAt: new Date().toISOString(),
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
