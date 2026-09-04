import { requireNonEmptyString } from './assert.mjs'
import { isLeadStatus, leadStatus } from './lead-status.mjs'

const ensLabelRe = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/
const inboxSuffix = '.global'

export function inboxFeedSignMessage(domain, inboxLabel, timestamp) {
  return `aegis-inbox-feed\n${domain}\n${inboxLabel}\n${timestamp}`
}

export function parseAllottedName(value) {
  const name = requireNonEmptyString(value, 'allotted name is empty').toLowerCase()
  if (!name.endsWith(inboxSuffix)) {
    throw new Error(`Name must be {label}.{domain}.global, got: ${value}`)
  }

  const labels = name.slice(0, -inboxSuffix.length).split('.')
  if (
    labels.length !== 2 ||
    !ensLabelRe.test(labels[0]) ||
    !ensLabelRe.test(labels[1])
  ) {
    throw new Error(`Name must be {label}.{domain}.global, got: ${value}`)
  }

  return { label: labels[0], domain: labels[1], fullName: name }
}

export function requireInboxIdentity(localId, { preview } = {}) {
  if (preview) {
    try {
      const parsed = parseAllottedName(localId)
      return { inbox: parsed.label, domain: parsed.domain }
    } catch {
      return { inbox: 'inbox', domain: 'preview' }
    }
  }

  const parsed = parseAllottedName(localId)
  return { inbox: parsed.label, domain: parsed.domain }
}

export function leadLabelFromName(value) {
  const raw = requireNonEmptyString(value, 'lead label is empty').toLowerCase()
  if (raw.endsWith(inboxSuffix)) {
    return parseAllottedName(raw).label
  }

  const label = raw.split('.')[0]
  if (!ensLabelRe.test(label)) {
    throw new Error(`Lead label is not a valid ENS label: ${value}`)
  }

  return label
}

function feedLeadUrl(inboxFeedUrl) {
  const base = requireNonEmptyString(
    inboxFeedUrl,
    'Missing AEGIS_INBOX_FEED_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
  ).replace(/\/+$/, '')
  return `${base}/lead`
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
      `inboxFeed returned non-JSON (${res.status}): ${raw.slice(0, 180)}`,
      { cause },
    )
  }
}

function feedError(data, status) {
  const error =
    typeof data.error === 'string' ? data.error : 'Inbox feed request failed'
  return new Error(`${error} (${status})`)
}

function normalizeFeedStatus(value) {
  if (value == null || value === '') {
    return leadStatus.pending
  }

  const status = String(value).trim().toLowerCase().replace(/-/g, '_')
  if (!isLeadStatus(status)) {
    throw new Error(`inboxFeed: unknown lead status: ${value}`)
  }

  return status
}

export async function fetchLeadStatus(inboxFeedUrl, { domain, inbox, lead }) {
  const url = new URL(feedLeadUrl(inboxFeedUrl))
  url.searchParams.set('domain', domain)
  url.searchParams.set('inbox', inbox)
  url.searchParams.set('lead', lead)

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)
  if (!res.ok) {
    throw feedError(data, res.status)
  }

  if (!data.found) {
    return leadStatus.pending
  }

  return normalizeFeedStatus(data.status)
}

export async function postLeadStatus(
  inboxFeedUrl,
  { domain, inbox, lead, status, timestamp, signature },
) {
  const res = await fetch(feedLeadUrl(inboxFeedUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain,
      inbox,
      lead,
      status,
      timestamp,
      signature,
    }),
  })
  const data = await readJson(res)
  if (!res.ok) {
    throw feedError(data, res.status)
  }

  return normalizeFeedStatus(data.status)
}

export async function publishLeadStatus({
  controller,
  inboxFeedUrl,
  preview,
  domain,
  inbox,
  lead,
  status,
}) {
  if (!isLeadStatus(status)) {
    throw new Error(`Cannot publish unknown lead status: ${status}`)
  }

  const timestamp = Date.now()
  const signature = await controller.signData(
    inboxFeedSignMessage(domain, inbox, timestamp),
  )

  if (preview) {
    return status
  }

  return postLeadStatus(inboxFeedUrl, {
    domain,
    inbox,
    lead,
    status,
    timestamp,
    signature,
  })
}
