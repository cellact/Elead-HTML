export const chatStatus = Object.freeze({
  pending: 'pending',
  approved: 'approved',
})

const chatStatusLabel = Object.freeze({
  [chatStatus.pending]: 'Pending',
  [chatStatus.approved]: 'Approved',
})

const storagePrefix = 'elead:chat-status:'

export function isChatStatus(value) {
  return Object.values(chatStatus).includes(value)
}

export function labelForChatStatus(status) {
  if (!isChatStatus(status)) {
    throw new Error(`Unknown chat status: ${status}`)
  }

  return chatStatusLabel[status]
}

function storageKey(threadId) {
  if (threadId == null || threadId === '') {
    throw new Error('chat status: thread id is required')
  }

  return `${storagePrefix}${threadId}`
}

export function readChatStatus(threadId, storage = window.localStorage) {
  const raw = storage.getItem(storageKey(threadId))

  if (raw == null) {
    return chatStatus.pending
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`Corrupt chat status for ${threadId}`, { cause })
  }

  if (!parsed || !isChatStatus(parsed.status)) {
    throw new Error(`Corrupt chat status for ${threadId}: ${raw}`)
  }

  return parsed.status
}

export function writeChatStatus(threadId, status, storage = window.localStorage) {
  if (!isChatStatus(status)) {
    throw new Error(`Cannot store unknown chat status: ${status}`)
  }

  storage.setItem(
    storageKey(threadId),
    JSON.stringify({ status, updatedAt: Date.now() }),
  )
}

export function threadIdForChat(route) {
  if (route.sessionId) {
    return `session:${route.sessionId}`
  }

  if (route.remoteId) {
    return `remote:${route.remoteId}`
  }

  throw new Error('Chat status needs a sessionId or remoteId')
}
