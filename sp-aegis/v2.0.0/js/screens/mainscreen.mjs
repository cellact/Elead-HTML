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

function statusSelect(session, current, { controller, env, preview, domain, inbox }) {
  const select = el('select', {
    className: 'status-select',
    'aria-label': 'Lead status',
  })
  fillLeadStatusSelect(select, current)

  let applied = current
  select.addEventListener('change', () => {
    const next = select.value
    const revert = applied
    select.disabled = true
    publishLeadStatus({
      controller,
      inboxFeedUrl: env.inboxFeedUrl,
      preview,
      domain,
      inbox,
      lead: leadLabelFromName(session.sessionName),
      status: next,
    })
      .then((saved) => {
        applied = saved
        writeAegisStatus(String(session.sessionId), saved)
        fillLeadStatusSelect(select, saved)
        select.closest('.lead-row')?.setAttribute('data-status', saved)
      })
      .catch((error) => {
        fillLeadStatusSelect(select, revert)
        failOnScreen(error)
      })
      .finally(() => {
        select.disabled = false
      })
  })

  return select
}

function leadRow(session, current, ctx) {
  return el(
    'article',
    {
      className: 'lead-row',
      dataset: { status: current, sessionId: session.sessionId },
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
      el('p', { className: 'lead-meta' }, formatWhen(session.lastMessageTime)),
    ),
    statusSelect(session, current, ctx),
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
  const { domain, inbox } = requireInboxIdentity(localId, route)
  const ctx = { controller, env, preview: route.preview, domain, inbox }

  const listNode = requireElement('lead-list')
  const emptyNode = requireElement('lead-empty')
  const filterNode = requireElement('status-filter')
  const countNode = requireElement('lead-count')

  let leads = []

  function paint() {
    const filter = filterNode.value
    const visible = leads.filter((session) =>
      matchesFilter(readLeadStatus(String(session.sessionId)), filter),
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
    replaceChildren(
      listNode,
      ...visible.map((session) =>
        leadRow(session, readLeadStatus(String(session.sessionId)), ctx),
      ),
    )
  }

  if (!Object.values(leadStatus).includes(filterNode.value) && filterNode.value !== 'all') {
    throw new Error(`Unknown mainscreen filter: ${filterNode.value}`)
  }

  async function loadLeads() {
    const { sessions } = await controller.getRecentSessions(env.sessionRange)
    leads = sessions.filter((session) => !session.isGroup)
    if (!route.preview) {
      await Promise.all(
        leads.map(async (session) => {
          const status = await fetchLeadStatus(env.inboxFeedUrl, {
            domain,
            inbox,
            lead: leadLabelFromName(session.sessionName),
          })
          writeAegisStatus(String(session.sessionId), status)
        }),
      )
    }
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
