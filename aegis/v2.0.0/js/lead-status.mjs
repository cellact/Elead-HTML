export const leadStatus = Object.freeze({
  pending: 'pending',
  inProgress: 'in_progress',
  done: 'done',
  expired: 'expired',
})

const leadStatusLabel = Object.freeze({
  [leadStatus.pending]: 'Pending',
  [leadStatus.inProgress]: 'In progress',
  [leadStatus.done]: 'Done',
  [leadStatus.expired]: 'Expired',
})

const storagePrefix = 'aegis:lead-status:'

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
    return leadStatus.pending
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
