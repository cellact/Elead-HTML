import { el, replaceChildren, requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs?v=9'
import { requireController } from '../controller.mjs'
import {
  fillLeadStatusSelect,
  leadStatus,
  readLeadStatus,
  writeAegisStatus,
} from '../lead-status.mjs'
import {
  fetchLeadStatus,
  leadLabelFromName,
  publishLeadStatus,
  requireInboxIdentity,
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
  const titleNode = requireElement('chat-title')
  const eyebrowNode = requireElement('chat-eyebrow')
  const statusNode = requireElement('lead-status')
  const listNode = requireElement('message-list')
  const form = requireElement('compose-form')
  const input = requireElement('compose-input')

  setText(eyebrowNode, 'Lead')
  setText(titleNode, await leadTitle({ controller, env, route, sessionId }))

  if (!sessionId && !remoteId) {
    throw new Error(
      'Chat is missing sessionId or remoteId. Open a lead from the inbox.',
    )
  }

  const { domain, inbox } = requireInboxIdentity(localId, route)
  const lead = leadLabelFromName(
    route.sessionName || (await leadTitle({ controller, env, route, sessionId })),
  )

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

  const current = resolvedSessionId
    ? route.preview
      ? readLeadStatus(resolvedSessionId)
      : await fetchLeadStatus(env.inboxFeedUrl, { domain, inbox, lead }).then(
          (status) => {
            writeAegisStatus(resolvedSessionId, status)
            return status
          },
        )
    : leadStatus.pending
  fillLeadStatusSelect(statusNode, current)
  statusNode.disabled = !resolvedSessionId
  statusNode.addEventListener('change', () => {
    if (!resolvedSessionId) {
      throw new Error('Cannot set lead status: no session')
    }

    const next = statusNode.value
    const revert = statusNode.dataset.status
    statusNode.disabled = true
    publishLeadStatus({
      controller,
      inboxFeedUrl: env.inboxFeedUrl,
      preview: route.preview,
      domain,
      inbox,
      lead,
      status: next,
    })
      .then((saved) => {
        writeAegisStatus(resolvedSessionId, saved)
        fillLeadStatusSelect(statusNode, saved)
      })
      .catch((error) => {
        fillLeadStatusSelect(statusNode, revert)
        failOnScreen(error)
      })
      .finally(() => {
        statusNode.disabled = false
      })
  })

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
}

startChatScreen().catch(failOnScreen)
