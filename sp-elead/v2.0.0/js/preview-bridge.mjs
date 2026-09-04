/**
 * In-browser stand-in for native. Only used when the URL has preview=1.
 */

const previewLeadId = 'lad2fc1a4'
const previewInboxId = 'preview'

const previewSessions = [
  [
    'm-1',
    Date.now() - 60_000,
    previewLeadId,
    'I need a quote for next week.',
    11,
    previewLeadId,
    2,
    null,
    0,
  ],
  [
    'm-2',
    Date.now() - 3600_000,
    'l9f8e7d6c',
    'Is Saturday still open?',
    12,
    'l9f8e7d6c',
    0,
    null,
    0,
  ],
]

const previewMessages = {
  11: [
    [
      'm-1',
      Date.now() - 120_000,
      previewLeadId,
      'I need a quote for next week.',
      11,
      null,
      4,
      null,
      null,
      0,
      null,
    ],
    [
      'm-1b',
      Date.now() - 60_000,
      previewInboxId,
      'Send the dates and we will confirm.',
      11,
      null,
      4,
      null,
      null,
      0,
      null,
    ],
  ],
}

function respond(controller, requestId, extra) {
  controller.receiveData(
    JSON.stringify({
      action: 'data-retrieved',
      body: { requestId, ...extra },
    }),
  )
}

export function createPreviewSend(getController) {
  console.warn('Elead-HTML is running with preview=1. Native bridge is not used.')

  return (payload) => {
    const controller = getController()
    const action = payload.action
    const body = payload.body || {}

    window.setTimeout(() => {
      if (action === 'get-recent-sessions') {
        respond(controller, body.requestId, { recentSessions: previewSessions })
        return
      }

      if (action === 'get-session-id') {
        const remote = String(body.remoteId || '').toLowerCase()
        const sessionId =
          remote === previewLeadId || remote === '11' ? 11 : null
        respond(controller, body.requestId, { sessionId })
        return
      }

      if (action === 'get-messages') {
        const sessionId = Number(body.sessionId)
        const rows = Number.isFinite(sessionId) ? previewMessages[sessionId] || [] : []
        respond(controller, body.requestId, { messages: rows })
        return
      }

      if (action === 'call-remote' || action === 'call-session') {
        controller.receiveData(
          JSON.stringify({
            action: 'ringing',
            body: { to: body.remoteId || body.sessionId },
          }),
        )
        return
      }

      if (action === 'accept-call') {
        controller.receiveData(
          JSON.stringify({
            action: 'call-started',
            body: { from: body.callId, sessionId: body.callId },
          }),
        )
        return
      }

      if (action === 'reject-call') {
        controller.receiveData(JSON.stringify({ action: 'call-ended', body: {} }))
        return
      }

      if (action === 'sign-data') {
        controller.receiveData(
          JSON.stringify({
            action: 'data-retrieved',
            body: { xsign: `0xpreview-${Date.now()}` },
          }),
        )
        return
      }

      if (action === 'send-message') {
        const sessionId = Number(body.sessionId || 11)
        const message = [
          `preview-${Date.now()}`,
          Date.now(),
          body.localId,
          body.content,
          sessionId,
          null,
          1,
          null,
          null,
          0,
          null,
        ]
        controller.receiveData(
          JSON.stringify({
            action: 'new-message',
            body: { message },
          }),
        )
      }
    }, 80)
  }
}
