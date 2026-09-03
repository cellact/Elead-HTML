import { Controller, detectNativeSend } from './controller.mjs'
import { createPreviewSend } from './preview-bridge.mjs'
import { requireElement, setText } from './dom.mjs'
import { isServiceProvider } from './role.mjs'
import {
  buildAppSrc,
  readRoute,
  requireRemoteId,
  screenName,
  syncLocationHash,
} from './route.mjs'

function showFatal(error) {
  const banner = requireElement('fatal')
  const message = requireElement('fatal-message')
  banner.hidden = false
  setText(
    message,
    error instanceof Error ? error.message : 'Elead failed to start.',
  )
  console.error(error)
}

function hideFatal() {
  requireElement('fatal').hidden = true
}

function attachController(route) {
  const localId = route.localId || (route.preview ? 'preview.elead.eth' : null)

  if (!localId) {
    throw new Error(
      'localId is missing. Native must open index.html with #localId=... (or add preview=1 to develop in a browser).',
    )
  }

  let send = detectNativeSend()

  if (!send && route.preview) {
    send = createPreviewSend(() => window.top.controller)
  }

  if (!send) {
    throw new Error(
      'No native bridge (webkit / AndroidBridge). Add preview=1 to the URL to run the HTML without the app.',
    )
  }

  const controller = new Controller({ localId, send })
  window.top.controller = controller
  return controller
}

async function start() {
  let route = readRoute()
  const controller = attachController(route)
  const provider = isServiceProvider(route)

  if (route.screen === screenName.main && !provider) {
    route = Object.freeze({
      ...route,
      screen: screenName.chat,
      remoteId: requireRemoteId(route),
    })
    syncLocationHash(route)
  }

  requireElement('screen-frame').src = buildAppSrc(route)
  hideFatal()
}

function boot() {
  start().catch(showFatal)
}

boot()

window.addEventListener('hashchange', boot)

window.addEventListener('unhandledrejection', (event) => {
  showFatal(event.reason)
})

window.addEventListener('error', (event) => {
  if (event.error) {
    showFatal(event.error)
  }
})
