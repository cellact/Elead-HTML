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

function paintThread(listNode, emptyNode, messages, localId) {
  const empty = messages.length === 0
  emptyNode.hidden = !empty
  listNode.hidden = empty

  if (empty) {
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
  const emptyNode = requireElement('chat-empty')
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

  const { messages } = sessionId
    ? await controller.getMessages(sessionId, env.messageRange, null, true)
    : await controller.getMessages(remoteId, env.messageRange, null, false)

  paintThread(listNode, emptyNode, messages, localId)
  listNode.scrollTop = listNode.scrollHeight

  if (sessionId) {
    controller.updateSessionTimestamp(sessionId)
  }

  controller.on('new-message', ({ message }) => {
    if (!message) {
      throw new Error('new-message event is missing message')
    }

    if (sessionId && String(message.sessionId) !== String(sessionId)) {
      return
    }

    emptyNode.hidden = true
    listNode.hidden = false
    listNode.append(renderMessage(message, localId))
    listNode.scrollTop = listNode.scrollHeight
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const content = input.value.trim()

    if (content === '') {
      return
    }

    if (sessionId) {
      controller.sendMessage(sessionId, content)
    } else {
      controller.sendFirstMessage(remoteId, content)
    }

    input.value = ''
  })

  requireElement('call-chat').addEventListener('click', () => {
    if (sessionId) {
      controller.callSession(sessionId)
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
