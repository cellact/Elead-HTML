/**
 * In-browser stand-in for native. Only used when the URL has preview=1.
 */

const previewSessions = [
  [
    'm-1',
    Date.now() - 60_000,
    'lead-1a2b3c4d.elead.eth',
    'I need a quote for next week.',
    11,
    'lead-1a2b3c4d.elead.eth',
    2,
    null,
    0,
  ],
  [
    'm-2',
    Date.now() - 3600_000,
    'lead-9f8e7d6c.elead.eth',
    'Is Saturday still open?',
    12,
    'lead-9f8e7d6c.elead.eth',
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
      'lead-1a2b3c4d.elead.eth',
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
      'inbox-preview.elead.eth',
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

      if (action === 'get-messages') {
        const sessionId = Number(body.sessionId)
        const rows = previewMessages[sessionId] || []
        respond(controller, body.requestId, { messages: rows })
        return
      }

      if (action === 'new-item' || action === 'install-product') {
        controller.receiveData(
          JSON.stringify({
            action: 'product-install-started',
            body: { item: body.item },
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
