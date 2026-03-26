import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AnalyticsProvider,
  HttpAnalyticsTransport,
  InMemoryAnalyticsEventBus,
} from './analytics'
import App from './App.tsx'
import { analyticsEnv } from './lib/analytics'
import { getOrCreateExperimentIdentity } from './lib/identity'
import { flagsmithEnv } from './lib/flagsmith'
import { FeatureFlagsProvider, FlagsmithFeatureFlagsClient } from './feature-flags'
import './index.css'

const initialIdentity = getOrCreateExperimentIdentity()

const featureFlagsClient = new FlagsmithFeatureFlagsClient({
  apiUrl: flagsmithEnv.apiUrl,
  context: {
    identity: {
      identifier: initialIdentity,
    },
  },
  environmentId: flagsmithEnv.environmentId,
})

// Start fetching flags before the first React render so the experiment resolves sooner.
void featureFlagsClient.initialize?.()

const analyticsEventBus = new InMemoryAnalyticsEventBus([
  new HttpAnalyticsTransport({
    endpoint: `${analyticsEnv.apiUrl}/api/events`,
    keepalive: true,
  }),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagsProvider client={featureFlagsClient}>
      <AnalyticsProvider bus={analyticsEventBus}>
        <App />
      </AnalyticsProvider>
    </FeatureFlagsProvider>
  </StrictMode>,
)
