import { requireNonEmptyString } from './assert.mjs'

export const screenName = Object.freeze({
  install: 'INSTALL',
  chat: 'CHAT',
  main: 'MAIN',
  call: 'CALL',
  ring: 'RING',
  incoming: 'INCOMING',
})

const screens = new Set(Object.values(screenName))

const routeKeys = [
  'localId',
  'remoteId',
  'sessionId',
  'sessionName',
  'item',
  'label',
  'description',
  'image',
  'packageType',
  'url',
  'uuid',
  'timestamp',
  'from',
  'to',
  'videoCall',
  'identityKind',
]

function readSearch(source) {
  if (!source) {
    return new URLSearchParams()
  }

  const trimmed =
    source.charAt(0) === '#' || source.charAt(0) === '?'
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

function readIsSp(query, hash) {
  const raw = pickParam(query, hash, 'isSP')
  if (raw == null) {
    return null
  }

  if (raw === 'true') {
    return true
  }

  if (raw === 'false') {
    return false
  }

  throw new Error(`isSP must be true or false, got: ${raw}`)
}

function inferScreen(params) {
  const requested = params.screen

  if (requested) {
    const normalized = requested.toUpperCase()
    if (normalized === 'DASHBOARD') {
      return screenName.main
    }
    if (!screens.has(normalized)) {
      throw new Error(`Unknown screen: ${requested}`)
    }
    return normalized
  }

  if (params.sessionId || params.remoteId) {
    return screenName.chat
  }

  return screenName.main
}

export function readRoute(location = window.location) {
  const query = readSearch(location.search)
  const hash = readSearch(location.hash)

  const params = {
    screen: pickParam(query, hash, 'screen'),
    preview: pickParam(query, hash, 'preview') === '1',
    isSP: readIsSp(query, hash),
  }

  for (const key of routeKeys) {
    params[key] = pickParam(query, hash, key)
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

const previewInboxEns = 'preview'

export function requireRemoteId(route) {
  if (route.remoteId) {
    return requireNonEmptyString(
      route.remoteId,
      'remoteId is empty. Native must pass the provider inbox ENS as #remoteId=...',
    )
  }

  if (route.preview) {
    return previewInboxEns
  }

  throw new Error(
    'remoteId is missing. Native must open this product with #remoteId=... (the provider inbox ENS).',
  )
}

export function screenFile(screen) {
  switch (screen) {
    case screenName.install:
      return 'install.html'
    case screenName.chat:
      return 'chat.html'
    case screenName.main:
      return 'mainscreen.html'
    case screenName.call:
      return 'voicecall.html'
    case screenName.ring:
      return 'ringing.html'
    case screenName.incoming:
      return 'incomingcall.html'
    default:
      throw new Error(`No HTML file for screen: ${screen}`)
  }
}

function writeParams(route, extra = {}) {
  const params = new URLSearchParams()
  const merged = { ...route, ...extra }

  if (merged.preview) {
    params.set('preview', '1')
  }

  if (merged.isSP === true) {
    params.set('isSP', 'true')
  } else if (merged.isSP === false) {
    params.set('isSP', 'false')
  }

  for (const [key, value] of Object.entries(merged)) {
    if (
      key === 'preview' ||
      key === 'isSP' ||
      value == null ||
      value === '' ||
      value === false
    ) {
      continue
    }
    params.set(key, String(value))
  }

  return params
}

export function buildScreenSrc(route) {
  const params = writeParams(route)
  params.delete('screen')
  const query = params.toString()
  const file = screenFile(route.screen)
  return query === '' ? file : `${file}?${query}`
}

export function buildAppSrc(route) {
  const params = writeParams(route)
  params.set('screen', route.screen)
  return `app.html?${params.toString()}`
}

export function syncLocationHash(route, location = window.location) {
  const hash = writeParams(route).toString()
  if (location.hash.replace(/^#/, '') === hash) {
    return
  }

  const url = `${location.pathname}${location.search}#${hash}`
  history.replaceState(null, '', url)
}

export function openScreen(screen, extra = {}) {
  const current = readRoute()
  const next = writeParams(current, { ...extra, screen })
  const target = window.top === window ? window : window.top
  const hash = next.toString()
  if (target.location.hash.replace(/^#/, '') === hash) {
    return false
  }
  target.location.hash = hash
  return true
}
