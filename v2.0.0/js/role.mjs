import { openScreen, screenName } from './route.mjs'

export function isServiceProvider(route) {
  if (route == null || (route.isSP !== true && route.isSP !== false)) {
    throw new Error(
      'isSP is missing. Native must open this product with #isSP=true or #isSP=false.',
    )
  }

  return route.isSP
}

export function openRoleHome(route, extra = {}) {
  if (isServiceProvider(route)) {
    openScreen(screenName.main, extra)
    return
  }

  openScreen(screenName.chat, extra)
}
