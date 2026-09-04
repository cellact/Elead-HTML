import { requireNonEmptyString } from './assert.mjs'

const ensLabelRe = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/
const inboxSuffix = '.global'
const previewInbox = 'inbox.preview.global'
const previewDomain = 'preview'

function studioDomainFrom(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
  if (!raw) {
    return ''
  }

  const withoutGlobal = raw.endsWith(inboxSuffix)
    ? raw.slice(0, -inboxSuffix.length)
    : raw
  const parts = withoutGlobal.split('.').filter(Boolean)
  return parts.length === 0 ? '' : parts[parts.length - 1]
}

export function parseInboxName(value) {
  const name = requireNonEmptyString(
    value,
    'inbox name is empty',
  ).toLowerCase()

  if (!name.endsWith(inboxSuffix)) {
    throw new Error(`Inbox must be {inbox}.{domain}.global, got: ${value}`)
  }

  const labels = name.slice(0, -inboxSuffix.length).split('.')
  if (
    labels.length !== 2 ||
    !ensLabelRe.test(labels[0]) ||
    !ensLabelRe.test(labels[1])
  ) {
    throw new Error(`Inbox must be {inbox}.{domain}.global, got: ${value}`)
  }

  return name
}

export function displayInboxName(fromDomain) {
  const domain = studioDomainFrom(fromDomain)
  if (!ensLabelRe.test(domain)) {
    throw new Error(`fromDomain is missing or not a studio 2LD: ${fromDomain}`)
  }

  return domain
}

function expandSessionInboxName(raw, domain) {
  const name = String(raw || '')
    .trim()
    .toLowerCase()
  if (!name) {
    return null
  }

  const parts = (name.endsWith(inboxSuffix)
    ? name.slice(0, -inboxSuffix.length)
    : name
  )
    .split('.')
    .filter(Boolean)

  if (parts.length === 1 && ensLabelRe.test(domain)) {
    return `${parts[0]}.${domain}${inboxSuffix}`
  }

  return name.endsWith(inboxSuffix) ? name : `${name}${inboxSuffix}`
}

function remoteIdFromSession(session, domain) {
  const expanded = expandSessionInboxName(session.sessionName, domain)
  if (!expanded || !expanded.endsWith(inboxSuffix)) {
    return null
  }

  const labels = expanded.slice(0, -inboxSuffix.length).split('.')
  if (
    labels.length !== 2 ||
    !ensLabelRe.test(labels[0]) ||
    labels[1] !== domain
  ) {
    return null
  }

  return expanded
}

export function pickInboxFromHistory(sessions, fromDomain) {
  if (!Array.isArray(sessions)) {
    throw new Error('get-recent-sessions: native response is missing sessions[]')
  }

  const domain = studioDomainFrom(fromDomain)
  const directs = sessions.filter((session) => !session.isGroup)
  if (directs.length === 0) {
    return null
  }

  const matched = directs.find((session) => remoteIdFromSession(session, domain))
  const chosen = matched || directs[0]

  return {
    sessionId: String(chosen.sessionId),
    remoteId: remoteIdFromSession(chosen, domain),
  }
}

export function requireFromDomain(route) {
  if (route.domain) {
    const domain = studioDomainFrom(route.domain)
    if (!ensLabelRe.test(domain)) {
      throw new Error(
        `domain must be a studio 2LD or {label}.{domain}.global, got: ${route.domain}`,
      )
    }
    return domain
  }

  const localId = route.localId
  if (typeof localId === 'string' && localId.trim() !== '') {
    const name = localId.trim().toLowerCase()
    const withoutGlobal = name.endsWith(inboxSuffix)
      ? name.slice(0, -inboxSuffix.length)
      : name
    const labels = withoutGlobal.split('.').filter(Boolean)
    if (labels.length >= 2 && ensLabelRe.test(labels[labels.length - 1])) {
      return labels[labels.length - 1]
    }
  }

  if (route.preview) {
    return previewDomain
  }

  throw new Error(
    'fromDomain is missing. Native must open lead HTML with a full allotted name {label}.{domain}.global (or #domain=...).',
  )
}

const ETHERS_MODULE = 'https://esm.sh/ethers@5.8.0'
const INBOX_LIST_KEY = 'inboxList'
const RESOLVER_ABI = ['function text(bytes32 node, string key) view returns (string)']

let ethersLib = null

async function loadEthers() {
  if (ethersLib) {
    return ethersLib
  }

  const mod = await import(ETHERS_MODULE)
  const ethers = mod.ethers ?? mod.default
  if (ethers?.utils == null || ethers?.Contract == null) {
    throw new Error('inboxList: ethers is missing from the CDN module')
  }

  ethersLib = ethers
  return ethers
}

function normalizeInboxStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active'
}

function parseInboxList(raw, domain) {
  const text = String(raw || '').trim()
  if (text === '') {
    throw new Error(`No inboxList text on ${domain}.global`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch (cause) {
    throw new Error(`inboxList on ${domain}.global is not JSON: ${text.slice(0, 180)}`, {
      cause,
    })
  }

  if (!Array.isArray(data)) {
    throw new Error(`inboxList on ${domain}.global is not an array`)
  }

  const out = []
  const seen = new Set()

  for (const row of data) {
    let label = ''
    let fullName = ''
    let status = 'active'

    if (typeof row === 'string') {
      fullName = row.trim().toLowerCase()
      if (!fullName.endsWith(inboxSuffix)) {
        continue
      }
      const parts = fullName.slice(0, -inboxSuffix.length).split('.').filter(Boolean)
      if (parts.length < 1) {
        continue
      }
      label = parts[0]
    } else if (row && typeof row === 'object') {
      label = String(row.label || '')
        .trim()
        .toLowerCase()
      fullName = String(row.fullName || '')
        .trim()
        .toLowerCase()
      if (!fullName && label) {
        fullName = `${label}.${domain}${inboxSuffix}`
      }
      status = normalizeInboxStatus(row.status)
    }

    if (!label || !fullName || seen.has(label)) {
      continue
    }

    seen.add(label)
    out.push({ label, fullName, status })
  }

  if (out.length === 0) {
    throw new Error(`inboxList on ${domain}.global has no inboxes`)
  }

  return out
}

function pickActiveInbox(rows, domain) {
  const active = rows.filter((row) => row.status === 'active')
  if (active.length === 0) {
    throw new Error(`No active inboxList entries for ${domain}`)
  }

  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  const picked = active[bytes[0] % active.length]
  return parseInboxName(picked.fullName)
}

export async function fetchPermanentTo(env, fromDomain) {
  const domain = studioDomainFrom(fromDomain)
  if (!ensLabelRe.test(domain)) {
    throw new Error(`fromDomain is missing or not a studio 2LD: ${fromDomain}`)
  }

  const rpcUrl = requireNonEmptyString(
    env.ensRpcUrl,
    'Missing AEGIS_ENS_RPC_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
  )
  const publicResolver = requireNonEmptyString(
    env.publicResolver,
    'Missing AEGIS_PUBLIC_RESOLVER. Set it in js/env.values.mjs or js/env.local.mjs.',
  )
  const chainId = env.ensChainId
  if (!Number.isInteger(chainId) || chainId < 1) {
    throw new Error('AEGIS_ENS_CHAIN_ID must be an integer greater than 0.')
  }

  const ethers = await loadEthers()
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    name: chainId === 137 ? 'matic' : 'sepolia',
    chainId,
  })
  const resolver = new ethers.Contract(publicResolver, RESOLVER_ABI, provider)
  const node = ethers.utils.namehash(`${domain}${inboxSuffix}`)
  const raw = await resolver.text(node, INBOX_LIST_KEY)
  return pickActiveInbox(parseInboxList(raw, domain), domain)
}

export async function resolvePermanentTo(route, env) {
  const fromDomain = requireFromDomain(route)

  if (route.preview && fromDomain === previewDomain) {
    return previewInbox
  }

  return fetchPermanentTo(env, fromDomain)
}
