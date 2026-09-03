import { requireController } from './controller.mjs'
import { requireElement, setText } from './dom.mjs'
import { buildScreenSrc, openInboxHome, openScreen, readRoute, screenName } from './route.mjs'

function showFatal(error) {
  const banner = document.getElementById('fatal')
  const message = document.getElementById('fatal-message')
  if (banner == null || message == null) {
    console.error(error)
    return
  }
  banner.hidden = false
  setText(message, error instanceof Error ? error.message : String(error))
  console.error(error)
}

function startApp() {
  const controller = requireController()
  const screenFrame = requireElement('screen-frame')
  const errorFrame = requireElement('error-frame')
  const route = readRoute()

  screenFrame.src = buildScreenSrc(route)

  function showError(message) {
    errorFrame.hidden = false
    errorFrame.contentWindow.postMessage(
      { action: 'showError', message: String(message) },
      '*',
    )
  }

  function hideError() {
    errorFrame.hidden = true
  }

  controller.on('error', (body) => {
    showError(body?.e || body?.message || 'Native reported an error')
  })

  controller.on('receiving-call', (body) => {
    openScreen(screenName.incoming, { from: body.from })
  })

  controller.on('ringing', (body) => {
    openScreen(screenName.ring, { to: body.to, sessionName: body.sessionName })
  })

  controller.on('call-started', (body) => {
    openScreen(screenName.call, {
      to: body.from || body.to,
      sessionId: body.sessionId,
      sessionName: body.sessionName,
    })
  })

  controller.on('call-ended', () => {
    openInboxHome()
  })

  window.addEventListener('message', (event) => {
    if (event.data?.action === 'close-error') {
      hideError()
    }
  })
}

try {
  startApp()
} catch (error) {
  showFatal(error)
}
