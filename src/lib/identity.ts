const EXPERIMENT_IDENTITY_STORAGE_KEY = 'flagsmith-ab.cta.identity'

import { v4 as uuidv4 } from 'uuid'

export function getOrCreateExperimentIdentity() {
  const existingIdentity = localStorage.getItem(EXPERIMENT_IDENTITY_STORAGE_KEY)

  if (existingIdentity) {
    return existingIdentity
  }

  // const nextIdentity = crypto.randomUUID()
  const nextIdentity = uuidv4()
  localStorage.setItem(EXPERIMENT_IDENTITY_STORAGE_KEY, nextIdentity)
  return nextIdentity
}

export function rotateExperimentIdentity() {
  // const nextIdentity = crypto.randomUUID()
  const nextIdentity = uuidv4()
  localStorage.setItem(EXPERIMENT_IDENTITY_STORAGE_KEY, nextIdentity)
  return nextIdentity
}
