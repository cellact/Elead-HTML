import { requireNonEmptyString } from './assert.mjs'

const ensLabelRe = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/
const inboxSuffix = '.global'
const previewInbox = 'preview.elead.global'
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
    'getInbox: inbox name is empty',
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

function inboxFromResponse(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('getInbox: response is missing inbox')
  }

  if (typeof data.inbox !== 'string' || data.inbox.trim() === '') {
    throw new Error('getInbox: response is missing inbox')
  }

  return parseInboxName(data.inbox)
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
      `getInbox returned non-JSON (${res.status}): ${raw.slice(0, 180)}`,
      { cause },
    )
  }
}

export async function fetchPermanentTo(getInboxUrl, fromDomain) {
  const base = requireNonEmptyString(
    getInboxUrl,
    'Missing ELEAD_GET_INBOX_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
  ).replace(/\/+$/, '')
  const domain = studioDomainFrom(fromDomain)
  if (!ensLabelRe.test(domain)) {
    throw new Error(
      `fromDomain is missing or not a studio 2LD: ${fromDomain}`,
    )
  }
  const url = `${base}/${encodeURIComponent(domain)}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)

  if (!res.ok) {
    const error =
      typeof data.error === 'string' ? data.error : 'Failed to fetch inbox'
    throw new Error(`${error} (${res.status})`)
  }

  return inboxFromResponse(data)
}

export async function resolvePermanentTo(route, env) {
  const fromDomain = requireFromDomain(route)

  if (route.preview && fromDomain === previewDomain) {
    return previewInbox
  }

  return fetchPermanentTo(env.getInboxUrl, fromDomain)
}
