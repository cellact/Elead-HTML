import { openScreen, screenName } from './route.mjs'

export function isServiceProvider(localId) {
  return typeof localId === 'string' && localId.startsWith('inbox-')
}

export function openRoleHome(localId, extra = {}) {
  if (isServiceProvider(localId)) {
    openScreen(screenName.main, extra)
    return
  }

  openScreen(screenName.chat, extra)
}
