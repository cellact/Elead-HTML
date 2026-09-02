import { requireNonEmptyString } from './assert.mjs'
import { generateActivationProof } from './activation-proof.mjs'

const WEB3_IDENTITY_SUFFIX = '.arnacon.global'
const ENS_LABEL_RE = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/
const ACTIVATE_TIMEOUT_MS = 240_000

function readSearch(source) {
  if (!source) {
    return new URLSearchParams()
  }

  const trimmed =
    source.charAt(0) === '#' || source.charAt(0) === '?'
      ? source.slice(1)
      : source

  return new URLSearchParams(trimmed)
}

function pickParam(query, hash, name) {
  const fromQuery = query.get(name)
  if (fromQuery != null && fromQuery !== '') {
    return fromQuery
  }

  const fromHash = hash.get(name)
  if (fromHash != null && fromHash !== '') {
    return fromHash
  }

  return null
}

export function canonicalWeb3Identity(raw) {
  const value = requireNonEmptyString(
    raw,
    'web3identity is missing. Native must append it when opening the install URL.',
  ).toLowerCase()

  if (value.endsWith(WEB3_IDENTITY_SUFFIX)) {
    const uid = value.slice(0, -WEB3_IDENTITY_SUFFIX.length)
    if (!ENS_LABEL_RE.test(uid)) {
      throw new Error(`web3identity is not a valid Arnacon name: ${value}`)
    }
    return value
  }

  if (!ENS_LABEL_RE.test(value)) {
    throw new Error(`web3identity is not a valid Arnacon name: ${value}`)
  }

  return `${value}${WEB3_IDENTITY_SUFFIX}`
}

function requireBytes32(value, message) {
  const trimmed = requireNonEmptyString(value, message)
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`

  if (!BYTES32_RE.test(hex)) {
    throw new Error(message)
  }

  return hex
}

export function readInstallClaim(location = window.location) {
  const query = readSearch(location.search)
  const hash = readSearch(location.hash)

  const secret = requireBytes32(
    pickParam(query, hash, 'secret'),
    'secret is missing or not a 32-byte hex value. The studio QR must include secret.',
  )
  const label = requireNonEmptyString(
    pickParam(query, hash, 'label'),
    'label is missing. The studio QR must include the on-chain label.',
  )
  const web3identity = canonicalWeb3Identity(pickParam(query, hash, 'web3identity'))

  return Object.freeze({ secret, label, web3identity })
}

async function readJson(res) {
  const raw = await res.text()
  if (raw.trim() === '') {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch (cause) {
    throw new Error(
      `Activate request returned non-JSON (${res.status}): ${raw.slice(0, 180)}`,
      { cause },
    )
  }
}

function throwHttpError(res, data, fallback) {
  const error = typeof data.error === 'string' ? data.error : fallback
  const message = typeof data.message === 'string' ? data.message : null
  const detail = message ? `${error}: ${message}` : error
  throw new Error(`${detail} (${res.status})`)
}

export async function getGroupMembers(groupMembersUrl) {
  const url = requireNonEmptyString(
    groupMembersUrl,
    'Missing ELEAD_GROUP_MEMBERS_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
  )

  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  const data = await readJson(res)

  if (!res.ok) {
    throwHttpError(res, data, 'Failed to fetch group members')
  }

  if (!Array.isArray(data.commitments) || data.commitments.length === 0) {
    throw new Error('group-members: response is missing commitments[]')
  }

  const scope = requireNonEmptyString(
    data.scope,
    'group-members: response is missing scope',
  )

  const merkleTreeRoot =
    typeof data.merkleTreeRoot === 'string' && data.merkleTreeRoot.trim() !== ''
      ? data.merkleTreeRoot.trim()
      : undefined

  return {
    commitments: data.commitments.map((value) => String(value)),
    scope,
    merkleTreeRoot,
  }
}

export async function activateWithProof(activateUrl, { proof, label, web3identity }) {
  const url = requireNonEmptyString(
    activateUrl,
    'Missing ELEAD_ACTIVATE_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
  )

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ACTIVATE_TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof, label, web3identity }),
      signal: controller.signal,
    })
  } catch (error) {
    const aborted =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    throw new Error(
      aborted
        ? 'Activate timed out. Wait and try again — the line may already be active.'
        : 'Failed to reach the activate server',
      { cause: error },
    )
  } finally {
    window.clearTimeout(timer)
  }

  const data = await readJson(res)
  if (!res.ok) {
    throwHttpError(res, data, 'Activate failed')
  }

  return data
}

export async function activateLine({
  secret,
  label,
  web3identity,
  groupMembersUrl,
  activateUrl,
  onStatus,
}) {
  onStatus?.('Fetching the claim group…')
  const { commitments, scope, merkleTreeRoot } = await getGroupMembers(groupMembersUrl)

  onStatus?.('Building the proof…')
  const proof = await generateActivationProof({
    userSecret: secret,
    label,
    commitments,
    scope,
    expectedMerkleTreeRoot: merkleTreeRoot,
  })

  onStatus?.('Sending the proof…')
  return activateWithProof(activateUrl, { proof, label, web3identity })
}
