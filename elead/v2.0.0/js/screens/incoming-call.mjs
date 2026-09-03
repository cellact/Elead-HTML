import { failOnScreen } from '../screen-fail.mjs'
import { requireController } from '../controller.mjs'
import { requireElement, setText } from '../dom.mjs'
import { readRoute } from '../route.mjs'

function startIncomingCall() {
  const controller = requireController()
  const route = readRoute()
  const callId = route.from || route.sessionId

  if (!callId) {
    throw new Error('Incoming call is missing from / sessionId')
  }

  setText(requireElement('caller-id'), route.sessionName || route.from || callId)

  requireElement('accept-call').addEventListener('click', () => {
    controller.acceptCall(callId)
  })

  requireElement('reject-call').addEventListener('click', () => {
    controller.rejectCall(callId)
  })
}

try {
  startIncomingCall()
} catch (error) {
  failOnScreen(error)
}
