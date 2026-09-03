import { el, replaceChildren, requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs'
import { requireController } from '../controller.mjs'
import {
  chatStatus,
  labelForChatStatus,
  readChatStatus,
  threadIdForChat,
  writeChatStatus,
} from '../chat-status.mjs'
import { readRoute } from '../route.mjs'

function formatClock(time) {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Message time is not a date: ${time}`)
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isOutgoing(message, localId) {
  return message.author === localId
}

function renderMessage(message, localId) {
  const outgoing = isOutgoing(message, localId)
  return el(
    'article',
    {
      className: outgoing ? 'bubble bubble-out' : 'bubble bubble-in',
      dataset: { messageId: message.messageId },
    },
    el('p', { className: 'bubble-text' }, message.content),
    el('time', { className: 'bubble-time' }, formatClock(message.time)),
  )
}

function paintStatus(node, status) {
  node.dataset.status = status
  setText(node, labelForChatStatus(status))
}

function paintThread(listNode, messages, localId) {
  if (!messages || messages.length === 0) {
    replaceChildren(listNode)
    return
  }

  replaceChildren(
    listNode,
    ...messages.map((message) => renderMessage(message, localId)),
  )
}

async function leadTitle({ controller, env, route, sessionId }) {
  if (route.sessionName) {
    return route.sessionName
  }

  if (!sessionId) {
    return route.sessionName || route.remoteId || 'Lead'
  }

  const { sessions } = await controller.getRecentSessions(env.sessionRange)
  const match = sessions.find((session) => String(session.sessionId) === String(sessionId))
  if (match?.sessionName) {
    return match.sessionName
  }

  return `Session ${sessionId}`
}

export async function startChatScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = route.localId || controller.localId
  const remoteId = route.remoteId || route.to || route.from
  const sessionId = route.sessionId
  const threadId = threadIdForChat({ sessionId, remoteId })

  const titleNode = requireElement('chat-title')
  const eyebrowNode = requireElement('chat-eyebrow')
  const statusNode = requireElement('chat-status')
  const listNode = requireElement('message-list')
  const form = requireElement('compose-form')
  const input = requireElement('compose-input')

  setText(eyebrowNode, 'Lead')
  setText(titleNode, await leadTitle({ controller, env, route, sessionId }))
  paintStatus(statusNode, readChatStatus(threadId))

  if (!sessionId && !remoteId) {
    throw new Error(
      'Chat is missing sessionId or remoteId. Open a lead from the inbox.',
    )
  }

  let resolvedSessionId = sessionId
  if (!resolvedSessionId && remoteId) {
    const raw = await controller.getSessionId(remoteId)
    const value = raw?.sessionId
    resolvedSessionId =
      value == null || value === '' || value === 'null' ? null : String(value)
  }

  if (resolvedSessionId) {
    const { messages } = await controller.getMessages(
      resolvedSessionId,
      env.messageRange,
      null,
      true,
    )
    paintThread(listNode, messages, localId)
    listNode.scrollTop = listNode.scrollHeight
    controller.updateSessionTimestamp(resolvedSessionId)
  }

  controller.on('new-message', ({ message }) => {
    if (!message) {
      throw new Error('new-message event is missing message')
    }

    if (resolvedSessionId && String(message.sessionId) !== String(resolvedSessionId)) {
      return
    }

    listNode.append(renderMessage(message, localId))
    listNode.scrollTop = listNode.scrollHeight
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const content = input.value.trim()

    if (content === '') {
      return
    }

    if (resolvedSessionId) {
      controller.sendMessage(resolvedSessionId, content)
    } else {
      controller.sendFirstMessage(remoteId, content)
    }

    input.value = ''
  })

  requireElement('call-chat').addEventListener('click', () => {
    if (resolvedSessionId) {
      controller.callSession(resolvedSessionId)
      return
    }
    controller.callRemote(remoteId)
  })

  requireElement('approve-chat').addEventListener('click', () => {
    writeChatStatus(threadId, chatStatus.approved)
    paintStatus(statusNode, chatStatus.approved)
  })
}

startChatScreen().catch(failOnScreen)
