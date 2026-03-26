import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { FeatureFlagsContext } from './FeatureFlagsContext'
import type { FeatureFlagsClient } from './types'

type FeatureFlagsProviderProps = {
  children: ReactNode
  client: FeatureFlagsClient
}

export function FeatureFlagsProvider({
  children,
  client,
}: FeatureFlagsProviderProps) {
  useEffect(() => {
    return () => {
      void client.destroy?.()
    }
  }, [client])

  return (
    <FeatureFlagsContext.Provider value={client}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}
