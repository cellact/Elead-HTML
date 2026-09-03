import { el, replaceChildren, requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs'
import { requireController } from '../controller.mjs'
import {
  labelForLeadStatus,
  leadStatus,
  leadStatusOrder,
  readLeadStatus,
  writeLeadStatus,
} from '../lead-status.mjs'
import { labelForChatStatus, readChatStatus, threadIdForChat } from '../chat-status.mjs'
import { openScreen, readRoute, screenName } from '../route.mjs'

function formatWhen(time) {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Session time is not a date: ${time}`)
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusSelect(sessionId, current) {
  const select = el('select', {
    className: 'status-select',
    'aria-label': 'Lead status',
  })

  for (const status of leadStatusOrder) {
    const option = el('option', { value: status }, labelForLeadStatus(status))
    if (status === current) {
      option.selected = true
    }
    select.append(option)
  }

  select.addEventListener('change', () => {
    writeLeadStatus(sessionId, select.value)
    select.closest('.lead-row')?.setAttribute('data-status', select.value)
  })

  return select
}

function leadRow(session) {
  const status = readLeadStatus(session.sessionId)
  const chat = readChatStatus(threadIdForChat({ sessionId: String(session.sessionId) }))

  return el(
    'article',
    {
      className: 'lead-row',
      dataset: { status, sessionId: session.sessionId },
    },
    el(
      'button',
      {
        className: 'lead-open',
        type: 'button',
        onClick: () =>
          openScreen(screenName.chat, {
            sessionId: session.sessionId,
            sessionName: session.sessionName,
          }),
      },
      el('p', { className: 'lead-name' }, session.sessionName || `Session ${session.sessionId}`),
      el('p', { className: 'lead-preview' }, session.lastMessageContent || 'No message yet'),
      el(
        'p',
        { className: 'lead-meta' },
        `${formatWhen(session.lastMessageTime)} · Chat ${labelForChatStatus(chat)}`,
      ),
    ),
    statusSelect(session.sessionId, status),
  )
}

function matchesFilter(status, filter) {
  if (filter === 'all') {
    return true
  }

  return status === filter
}

export async function startMainScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = route.localId || controller.localId

  const listNode = requireElement('lead-list')
  const emptyNode = requireElement('lead-empty')
  const filterNode = requireElement('status-filter')
  const countNode = requireElement('lead-count')

  let leads = []

  function paint() {
    const filter = filterNode.value
    const visible = leads.filter((session) =>
      matchesFilter(readLeadStatus(session.sessionId), filter),
    )

    setText(
      countNode,
      `${visible.length} ${visible.length === 1 ? 'lead' : 'leads'}`,
    )

    if (visible.length === 0) {
      emptyNode.hidden = false
      replaceChildren(listNode)
      return
    }

    emptyNode.hidden = true
    replaceChildren(listNode, ...visible.map((session) => leadRow(session)))
  }

  if (!Object.values(leadStatus).includes(filterNode.value) && filterNode.value !== 'all') {
    throw new Error(`Unknown mainscreen filter: ${filterNode.value}`)
  }

  async function loadLeads() {
    const { sessions } = await controller.getRecentSessions(env.sessionRange)
    leads = sessions.filter((session) => !session.isGroup)
    paint()
  }

  filterNode.addEventListener('change', paint)
  await loadLeads()

  controller.on('new-message', () => {
    loadLeads().catch(failOnScreen)
  })

  setText(requireElement('inbox-id'), localId)
}

startMainScreen().catch(failOnScreen)
