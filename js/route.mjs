import { requireNonEmptyString } from './assert.mjs'

export const screenName = Object.freeze({
  install: 'INSTALL',
  chat: 'CHAT',
  dashboard: 'MAIN',
})

const screens = new Set(Object.values(screenName))

function readSearch(source) {
  if (!source) {
    return new URLSearchParams()
  }

  const trimmed = source.charAt(0) === '#' || source.charAt(0) === '?'
    ? source.slice(1)
    : source

  return new URLSearchParams(trimmed)
}

function pickParam(query, hash, name) {
  const fromQuery = query.get(name)
  if (fromQuery != null && fromQuery !== '') {
    return fromQuery
  }

  const fromHash = hash.get(name)
  if (fromHash != null && fromHash !== '') {
    return fromHash
  }

  return null
}

function isPreviewRequested(query, hash) {
  return pickParam(query, hash, 'preview') === '1'
}

function inferScreen(params) {
  const requested = params.screen

  if (requested) {
    const normalized = requested.toUpperCase()
    if (normalized === 'DASHBOARD') {
      return screenName.dashboard
    }
    if (!screens.has(normalized)) {
      throw new Error(`Unknown screen: ${requested}`)
    }
    return normalized
  }

  if (params.sessionId || params.remoteId) {
    return screenName.chat
  }

  if (params.localId && params.localId.startsWith('inbox-')) {
    return screenName.dashboard
  }

  return screenName.install
}

export function readRoute(location = window.location) {
  const query = readSearch(location.search)
  const hash = readSearch(location.hash)

  const params = {
    screen: pickParam(query, hash, 'screen'),
    localId: pickParam(query, hash, 'localId'),
    remoteId: pickParam(query, hash, 'remoteId'),
    sessionId: pickParam(query, hash, 'sessionId'),
    item: pickParam(query, hash, 'item'),
    label: pickParam(query, hash, 'label'),
    description: pickParam(query, hash, 'description'),
    image: pickParam(query, hash, 'image'),
    packageType: pickParam(query, hash, 'packageType'),
    url: pickParam(query, hash, 'url'),
    uuid: pickParam(query, hash, 'uuid'),
    timestamp: pickParam(query, hash, 'timestamp'),
    preview: isPreviewRequested(query, hash),
  }

  return Object.freeze({
    ...params,
    screen: inferScreen(params),
  })
}

export function requireLocalId(route) {
  return requireNonEmptyString(
    route.localId,
    'localId is missing. Native must open this product with #localId=...',
  )
}

export function screenFile(screen) {
  switch (screen) {
    case screenName.install:
      return 'install.html'
    case screenName.chat:
      return 'chat.html'
    case screenName.dashboard:
      return 'dashboard.html'
    default:
      throw new Error(`No HTML file for screen: ${screen}`)
  }
}

export function buildScreenSrc(route) {
  const file = screenFile(route.screen)
  const params = new URLSearchParams()

  if (route.preview) {
    params.set('preview', '1')
  }

  for (const [key, value] of Object.entries(route)) {
    if (key === 'screen' || key === 'preview' || value == null || value === '') {
      continue
    }
    params.set(key, value)
  }

  const query = params.toString()
  return query === '' ? file : `${file}?${query}`
}

export function openScreen(screen, extra = {}) {
  const current = readRoute()
  const next = new URLSearchParams()

  next.set('screen', screen)
  if (current.preview) {
    next.set('preview', '1')
  }
  if (current.localId) {
    next.set('localId', current.localId)
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === '') {
      continue
    }
    next.set(key, String(value))
  }

  const target = window.top === window ? window : window.top
  target.location.hash = next.toString()
}
