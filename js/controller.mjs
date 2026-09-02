import { requireNonEmptyString } from './assert.mjs'
import { parseMessage, parseMessageList, parseSessionList } from './models.mjs'

let requestSeq = 0

function nextRequestId() {
  requestSeq += 1
  return `${Date.now().toString(36)}-${requestSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function detectNativeSend() {
  if (window.webkit?.messageHandlers?.nativeHandler) {
    return (payload) => {
      window.webkit.messageHandlers.nativeHandler.postMessage(JSON.stringify(payload))
    }
  }

  if (window.AndroidBridge?.processAction) {
    return (payload) => {
      window.AndroidBridge.processAction(JSON.stringify(payload))
    }
  }

  return null
}

export class Controller {
  constructor({ localId, send, requestTimeout = 10_000 }) {
    this.localId = requireNonEmptyString(localId, 'Controller: localId is required')

    if (typeof send !== 'function') {
      throw new Error('Controller: send must be a function')
    }

    this._send = send
    this._requestTimeout = requestTimeout
    this._pending = new Map()
    this._listeners = new Map()
  }

  on(event, handler) {
    let set = this._listeners.get(event)
    if (!set) {
      set = new Set()
      this._listeners.set(event, set)
    }
    set.add(handler)
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler)
  }

  receiveData(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new Error('Controller.receiveData: native sent an empty payload')
    }

    let data
    try {
      data = JSON.parse(raw)
    } catch (cause) {
      throw new Error('Controller.receiveData: native payload is not JSON', { cause })
    }

    const action = data.action
    const body = data.body

    if (body?.requestId && this._pending.has(body.requestId)) {
      const pending = this._pending.get(body.requestId)
      clearTimeout(pending.timer)
      this._pending.delete(body.requestId)
      pending.resolve(body)
      return
    }

    if (!action) {
      throw new Error('Controller.receiveData: payload has no action and no matching requestId')
    }

    this._emit(action, this._decodeEvent(action, body))
  }

  getRecentSessions(range) {
    return this._request('get-recent-sessions', { range }).then((raw) => ({
      sessions: parseSessionList(raw),
    }))
  }

  getMessages(id, range, start, isSession) {
    const extra = isSession
      ? { sessionId: id, range, startMessage: start }
      : { remoteId: id, range, startMessage: start }

    return this._request('get-messages', extra).then((raw) => ({
      messages: parseMessageList(raw),
    }))
  }

  sendMessage(sessionId, content) {
    this._send({
      action: 'send-message',
      body: { localId: this.localId, sessionId, content },
    })
  }

  sendFirstMessage(remoteId, content) {
    this._send({
      action: 'send-message',
      body: { localId: this.localId, remoteId, content },
    })
  }

  updateSessionTimestamp(sessionId) {
    this._send({
      action: 'update-session-timestamp',
      body: { localId: this.localId, sessionId },
    })
  }

  acceptCall(callId) {
    this._send({
      action: 'accept-call',
      body: { localId: this.localId, callId },
    })
  }

  rejectCall(callId) {
    this._send({
      action: 'reject-call',
      body: { localId: this.localId, callId },
    })
  }

  callRemote(remoteId) {
    this._send({
      action: 'call-remote',
      body: { localId: this.localId, remoteId },
    })
  }

  callSession(sessionId) {
    this._send({
      action: 'call-session',
      body: { localId: this.localId, sessionId },
    })
  }

  setMute(callId, muted) {
    this._send({
      action: 'set-mute',
      body: { localId: this.localId, callId, mute: muted },
    })
  }

  setHold(callId, held) {
    this._send({
      action: 'set-hold',
      body: { localId: this.localId, callId, hold: held },
    })
  }

  _request(action, extraBody) {
    const requestId = nextRequestId()
    const body = { localId: this.localId, requestId }

    for (const [key, value] of Object.entries(extraBody)) {
      if (value != null) {
        body[key] = value
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId)
        reject(
          new Error(
            `Controller: "${action}" timed out after ${this._requestTimeout}ms`,
          ),
        )
      }, this._requestTimeout)

      this._pending.set(requestId, { resolve, reject, timer })
      this._send({ action, body })
    })
  }

  _emit(event, data) {
    const set = this._listeners.get(event)
    if (!set) {
      return
    }

    for (const handler of set) {
      handler(data)
    }
  }

  _decodeEvent(action, body) {
    if (action === 'new-message' && Array.isArray(body?.message)) {
      return { ...body, message: parseMessage(body.message) }
    }

    if (action === 'message-updated' && Array.isArray(body?.updatedMessage)) {
      return { ...body, message: parseMessage(body.updatedMessage) }
    }

    return body
  }
}

export function requireController() {
  const controller = window.top.controller

  if (controller == null) {
    throw new Error(
      'window.top.controller is missing. Open this product from index.html so the native bridge can attach.',
    )
  }

  return controller
}
