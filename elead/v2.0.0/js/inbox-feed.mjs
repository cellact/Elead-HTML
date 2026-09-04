import { requireNonEmptyString } from './assert.mjs'
import { parseInboxName } from './inbox.mjs?v=10'
import { isLeadStatus, leadStatus } from './lead-status.mjs'

const ensLabelRe = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/
const inboxSuffix = '.global'

export function splitInboxName(value) {
  const fullName = parseInboxName(value)
  const [label, domain] = fullName.slice(0, -inboxSuffix.length).split('.')
  return { label, domain, fullName }
}

export function leadLabelFromLocalId(localId) {
  const raw = requireNonEmptyString(localId, 'localId is empty').toLowerCase()
  if (raw.endsWith(inboxSuffix)) {
    return splitInboxName(raw).label
  }

  const label = raw.split('.')[0]
  if (!ensLabelRe.test(label)) {
    throw new Error(`localId is not a valid lead label: ${localId}`)
  }

  return label
}

function feedLeadUrl(inboxFeedUrl) {
  const base = requireNonEmptyString(
    inboxFeedUrl,
    'Missing ELEAD_INBOX_FEED_URL. Set it in js/env.values.mjs or js/env.local.mjs.',
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
    const error =
      typeof data.error === 'string' ? data.error : 'Inbox feed request failed'
    throw new Error(`${error} (${res.status})`)
  }

  if (!data.found || data.status == null || data.status === '') {
    return leadStatus.pending
  }

  const status = String(data.status).trim().toLowerCase().replace(/-/g, '_')
  if (!isLeadStatus(status)) {
    throw new Error(`inboxFeed: unknown lead status: ${data.status}`)
  }

  return status
}
