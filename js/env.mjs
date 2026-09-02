import { requireFiniteNumber, requireNonEmptyString } from './assert.mjs'
import { envValues } from './env.values.mjs'

async function loadLocalOverrides() {
  try {
    const module = await import('./env.local.mjs')
    if (module.envLocal == null || typeof module.envLocal !== 'object') {
      throw new Error('js/env.local.mjs must export envLocal as an object.')
    }
    return module.envLocal
  } catch (error) {
    if (isMissingModule(error)) {
      return {}
    }
    throw error
  }
}

function isMissingModule(error) {
  if (!(error instanceof Error)) {
    return false
  }

  return /Failed to fetch dynamically imported module|error loading dynamically imported module|404|env\.local/i.test(
    error.message,
  )
}

function requiredString(merged, key, envName) {
  return requireNonEmptyString(
    merged[key],
    `Missing required config: ${envName}. Set it in js/env.values.mjs or js/env.local.mjs.`,
  )
}

function requiredCount(merged, key, envName) {
  const count = requireFiniteNumber(
    merged[key],
    `Missing required config: ${envName} must be a number.`,
  )

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`${envName} must be an integer greater than 0.`)
  }

  return count
}

export async function loadEnv() {
  const merged = { ...envValues, ...(await loadLocalOverrides()) }

  return Object.freeze({
    productEnsName: requiredString(merged, 'productEnsName', 'ELEAD_PRODUCT_ENS'),
    productLabel: requiredString(merged, 'productLabel', 'ELEAD_PRODUCT_LABEL'),
    productDescription: requiredString(
      merged,
      'productDescription',
      'ELEAD_PRODUCT_DESCRIPTION',
    ),
    productImage:
      typeof merged.productImage === 'string' ? merged.productImage.trim() : '',
    packageType: requiredString(merged, 'packageType', 'ELEAD_PACKAGE_TYPE'),
    inboxEns: requiredString(merged, 'inboxEns', 'ELEAD_INBOX_ENS'),
    sessionRange: requiredCount(merged, 'sessionRange', 'ELEAD_SESSION_RANGE'),
    messageRange: requiredCount(merged, 'messageRange', 'ELEAD_MESSAGE_RANGE'),
  })
}
