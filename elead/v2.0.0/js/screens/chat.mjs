import { el, replaceChildren, requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs'
import { requireController } from '../controller.mjs'
import {
  labelForChatStatus,
  readChatStatus,
  threadIdForChat,
} from '../chat-status.mjs'
import { resolvePermanentTo } from '../inbox.mjs'
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

async function findLineSession(controller, env) {
  const { sessions } = await controller.getRecentSessions(env.sessionRange)
  const line = sessions.find((session) => !session.isGroup)
  return line ? String(line.sessionId) : null
}

export async function startChatScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = route.localId || controller.localId
  const remoteId = await resolvePermanentTo(route, env)
  const sessionId = route.sessionId || (await findLineSession(controller, env))
  const threadId = threadIdForChat({ sessionId, remoteId })

  const titleNode = requireElement('chat-title')
  const eyebrowNode = requireElement('chat-eyebrow')
  const statusNode = requireElement('chat-status')
  const listNode = requireElement('message-list')
  const emptyNode = requireElement('chat-empty')
  const form = requireElement('compose-form')
  const input = requireElement('compose-input')

  setText(eyebrowNode, 'Provider')
  setText(titleNode, remoteId)
  paintStatus(statusNode, readChatStatus(threadId))

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
}

startChatScreen().catch(failOnScreen)
