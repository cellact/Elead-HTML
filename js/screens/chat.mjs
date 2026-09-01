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

export async function startChatScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = route.localId || controller.localId
  const remoteId = route.remoteId || env.inboxEns
  const sessionId = route.sessionId
  const threadId = threadIdForChat({ sessionId, remoteId })

  const titleNode = requireElement('chat-title')
  const statusNode = requireElement('chat-status')
  const listNode = requireElement('message-list')
  const form = requireElement('compose-form')
  const input = requireElement('compose-input')

  setText(titleNode, sessionId ? `Lead ${sessionId}` : remoteId)
  paintStatus(statusNode, readChatStatus(threadId))

  const { messages } = sessionId
    ? await controller.getMessages(sessionId, env.messageRange, null, true)
    : await controller.getMessages(remoteId, env.messageRange, null, false)

  replaceChildren(
    listNode,
    ...messages.map((message) => renderMessage(message, localId)),
  )
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

  const approve = requireElement('approve-chat')
  if (approve) {
    approve.hidden = !localId.startsWith('inbox-')
    approve.addEventListener('click', () => {
      writeChatStatus(threadId, chatStatus.approved)
      paintStatus(statusNode, chatStatus.approved)
    })
  }
}

startChatScreen().catch(failOnScreen)
