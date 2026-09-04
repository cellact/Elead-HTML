import { failOnScreen } from '../screen-fail.mjs'
import { requireController } from '../controller.mjs'
import { requireElement, setText } from '../dom.mjs'
import { displayInboxName, requireFromDomain } from '../inbox.mjs?v=10'
import { readRoute } from '../route.mjs'

function startRinging() {
  const controller = requireController()
  const route = readRoute()
  const callId = route.to || route.sessionId

  if (!callId) {
    throw new Error('Ringing is missing to / sessionId')
  }

  setText(requireElement('callee-id'), displayInboxName(requireFromDomain(route)))

  requireElement('hang-up').addEventListener('click', () => {
    controller.rejectCall(callId)
  })
}

try {
  startRinging()
} catch (error) {
  failOnScreen(error)
}
