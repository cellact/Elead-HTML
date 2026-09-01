import { unreachable } from './assert.mjs'

export const leadStatus = Object.freeze({
  new: 'new',
  inProgress: 'in_progress',
  hotLead: 'hot_lead',
  done: 'done',
})

export const leadStatusOrder = Object.freeze([
  leadStatus.new,
  leadStatus.inProgress,
  leadStatus.hotLead,
  leadStatus.done,
])

const leadStatusLabel = Object.freeze({
  [leadStatus.new]: 'New',
  [leadStatus.inProgress]: 'In progress',
  [leadStatus.hotLead]: 'Hot lead',
  [leadStatus.done]: 'Done',
})

const storagePrefix = 'elead:lead-status:'

export function isLeadStatus(value) {
  return Object.values(leadStatus).includes(value)
}

export function labelForLeadStatus(status) {
  if (!isLeadStatus(status)) {
    throw new Error(`Unknown lead status: ${status}`)
  }

  return leadStatusLabel[status]
}

function storageKey(sessionId) {
  if (sessionId == null || sessionId === '') {
    throw new Error('lead status: sessionId is required')
  }

  return `${storagePrefix}${sessionId}`
}

export function readLeadStatus(sessionId, storage = window.localStorage) {
  const raw = storage.getItem(storageKey(sessionId))

  if (raw == null) {
    return leadStatus.new
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`Corrupt lead status for session ${sessionId}`, { cause })
  }

  if (!parsed || !isLeadStatus(parsed.status)) {
    throw new Error(`Corrupt lead status for session ${sessionId}: ${raw}`)
  }

  return parsed.status
}

export function writeLeadStatus(sessionId, status, storage = window.localStorage) {
  if (!isLeadStatus(status)) {
    throw new Error(`Cannot store unknown lead status: ${status}`)
  }

  storage.setItem(
    storageKey(sessionId),
    JSON.stringify({ status, updatedAt: Date.now() }),
  )
}

export function assertKnownLeadStatus(status) {
  if (!isLeadStatus(status)) {
    unreachable(status, 'Unknown lead status')
  }
}
