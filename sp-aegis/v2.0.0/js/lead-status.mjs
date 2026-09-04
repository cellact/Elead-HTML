export const leadStatus = Object.freeze({
  pending: 'pending',
  inProgress: 'in_progress',
  done: 'done',
  expired: 'expired',
})

export const leadStatusOrder = Object.freeze([
  leadStatus.pending,
  leadStatus.inProgress,
  leadStatus.done,
  leadStatus.expired,
])

const leadStatusLabel = Object.freeze({
  [leadStatus.pending]: 'Pending',
  [leadStatus.inProgress]: 'In progress',
  [leadStatus.done]: 'Done',
  [leadStatus.expired]: 'Expired',
})

const legacyLeadStatus = Object.freeze({
  new: leadStatus.pending,
  hot_lead: leadStatus.inProgress,
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

function storedStatus(value) {
  if (isLeadStatus(value)) {
    return value
  }

  if (Object.prototype.hasOwnProperty.call(legacyLeadStatus, value)) {
    return legacyLeadStatus[value]
  }

  return null
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

  const status = parsed && storedStatus(parsed.status)
  if (!status) {
    throw new Error(`Corrupt lead status for session ${sessionId}: ${raw}`)
  }

  return status
}

export function writeAegisStatus(sessionId, status, storage = window.localStorage) {
  if (!isLeadStatus(status)) {
    throw new Error(`Cannot store unknown lead status: ${status}`)
  }

  storage.setItem(
    storageKey(sessionId),
    JSON.stringify({ status, updatedAt: Date.now() }),
  )
}

export function fillLeadStatusSelect(select, current) {
  if (!isLeadStatus(current)) {
    throw new Error(`Unknown lead status: ${current}`)
  }

  select.replaceChildren()
  for (const status of leadStatusOrder) {
    const option = document.createElement('option')
    option.value = status
    option.textContent = leadStatusLabel[status]
    option.selected = status === current
    select.append(option)
  }
  select.dataset.status = current
}
