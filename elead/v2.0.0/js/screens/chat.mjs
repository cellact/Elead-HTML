import { el, replaceChildren, requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs?v=9'
import { requireController } from '../controller.mjs'
import {
  labelForLeadStatus,
  leadStatus,
  readLeadStatus,
} from '../lead-status.mjs'
import {
  displayInboxName,
  pickInboxFromHistory,
  requireFromDomain,
  resolvePermanentTo,
} from '../inbox.mjs?v=10'
import {
  fetchLeadStatus,
  leadLabelFromLocalId,
  splitInboxName,
} from '../inbox-feed.mjs'
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
  setText(node, labelForLeadStatus(status))
}

function paintThread(listNode, messages, localId) {
  if (!messages || messages.length === 0) {
    replaceChildren(listNode)
    return
  }

  const chronological = [...messages].sort((a, b) => a.time - b.time)
  replaceChildren(
    listNode,
    ...chronological.map((message) => renderMessage(message, localId)),
  )
}

export async function startChatScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = route.localId || controller.localId
  const fromDomain = requireFromDomain(route)
  const { sessions } = await controller.getRecentSessions(env.sessionRange)
  const fromHistory = pickInboxFromHistory(sessions, fromDomain)
  const remoteId = fromHistory
    ? fromHistory.remoteId
    : await resolvePermanentTo(route, env)
  const sessionId = fromHistory?.sessionId ?? null

  const titleNode = requireElement('chat-title')
  const eyebrowNode = requireElement('chat-eyebrow')
  const statusNode = requireElement('lead-status')
  const listNode = requireElement('message-list')
  const form = requireElement('compose-form')
  const input = requireElement('compose-input')

  setText(eyebrowNode, 'Provider')
  setText(titleNode, displayInboxName(fromDomain))

  const lead = leadLabelFromLocalId(localId)
  if (route.preview || !remoteId) {
    paintStatus(
      statusNode,
      sessionId ? readLeadStatus(sessionId) : leadStatus.pending,
    )
  } else {
    const { label: inbox, domain } = splitInboxName(remoteId)
    const status = await fetchLeadStatus(env.inboxFeedUrl, {
      domain,
      inbox,
      lead,
    })
    paintStatus(statusNode, status)
  }

  if (sessionId) {
    const { messages } = await controller.getMessages(
      sessionId,
      env.messageRange,
      null,
      true,
    )
    paintThread(listNode, messages, localId)
    listNode.scrollTop = listNode.scrollHeight
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
    } else if (remoteId) {
      controller.sendFirstMessage(remoteId, content)
    } else {
      throw new Error('Cannot send: no session in history and no inbox to')
    }

    input.value = ''
  })

  requireElement('call-chat').addEventListener('click', () => {
    if (sessionId) {
      controller.callSession(sessionId)
      return
    }
    if (!remoteId) {
      throw new Error('Cannot call: no session in history and no inbox to')
    }
    controller.callRemote(remoteId)
  })
}

startChatScreen().catch(failOnScreen)
