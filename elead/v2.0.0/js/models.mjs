function requireArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message)
  }

  return value
}

export function parseMessage(row) {
  const arr = requireArray(row, 'parseMessage: native row is not an array')

  if (arr.length < 7) {
    throw new Error(`parseMessage: native row is too short (${arr.length} slots)`)
  }

  const replyRaw = arr[8]
  let replyTo = null

  if (Array.isArray(replyRaw) && replyRaw.length >= 3) {
    replyTo = {
      messageId: String(replyRaw[0]),
      author: String(replyRaw[1]),
      content: String(replyRaw[2]),
    }
  }

  return {
    messageId: String(arr[0]),
    time: Number(arr[1]),
    author: String(arr[2]),
    content: String(arr[3]),
    sessionId: Number(arr[4]),
    contact: arr[5] == null ? null : String(arr[5]),
    status: Number(arr[6]) || 0,
    fileId: arr[7] ?? null,
    replyTo,
    isEdited: arr[9] === 1 || arr[9] === true,
  }
}

export function parseSession(row) {
  const arr = requireArray(row, 'parseSession: native row is not an array')

  if (arr.length < 7) {
    throw new Error(`parseSession: native row is too short (${arr.length} slots)`)
  }

  return {
    lastMessageId: String(arr[0]),
    lastMessageTime: Number(arr[1]),
    lastMessageAuthor: String(arr[2]),
    lastMessageContent: String(arr[3]),
    sessionId: Number(arr[4]),
    sessionName: String(arr[5] ?? ''),
    unreadCount: Number(arr[6]) || 0,
    isGroup: arr[arr.length - 1] === 1 || arr[arr.length - 1] === true,
  }
}

export function parseMessageList(raw) {
  const rows = requireArray(
    raw.messages,
    'get-messages: native response is missing messages[]',
  )
  return rows.map((row) => parseMessage(row))
}

export function parseSessionList(raw) {
  const rows = requireArray(
    raw.recentSessions,
    'get-recent-sessions: native response is missing recentSessions[]',
  )
  return rows.map((row) => parseSession(row))
}
