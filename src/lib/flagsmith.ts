export type CtaVariant = 'red' | 'green'

export const flagsmithEnv = {
  environmentId:
    import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID || 'guNeZ39sAbYJxUFWuXNX5e',
  apiUrl:
    import.meta.env.VITE_FLAGSMITH_API_URL || '/flagsmith/api/v1/',
  flagKey: import.meta.env.VITE_FLAGSMITH_AB_TEST_FLAG_KEY || 'my_cool_feature',
}

export const isFlagsmithConfigured = Boolean(flagsmithEnv.environmentId)

export function resolveVariant(value: unknown): CtaVariant | null {
  return value === 'red' || value === 'green' ? value : null
}
