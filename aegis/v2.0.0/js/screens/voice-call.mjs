import { failOnScreen } from '../screen-fail.mjs'
import { requireController } from '../controller.mjs'
import { requireElement, setText } from '../dom.mjs'
import { displayInboxName, requireFromDomain } from '../inbox.mjs?v=11'
import { readRoute } from '../route.mjs'

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function startVoiceCall() {
  const controller = requireController()
  const route = readRoute()
  const callId = route.to || route.from || route.sessionId

  if (!callId) {
    throw new Error('Voice call is missing to / from / sessionId')
  }

  setText(requireElement('peer-id'), displayInboxName(requireFromDomain(route)))

  const muteButton = requireElement('toggle-mute')
  const holdButton = requireElement('toggle-hold')
  const durationNode = requireElement('call-duration')
  let muted = false
  let held = false
  let seconds = 0

  const timer = window.setInterval(() => {
    seconds += 1
    setText(durationNode, formatDuration(seconds))
  }, 1000)

  muteButton.addEventListener('click', () => {
    muted = !muted
    controller.setMute(callId, muted)
    muteButton.setAttribute('aria-pressed', String(muted))
    setText(muteButton, muted ? 'Unmute' : 'Mute')
  })

  holdButton.addEventListener('click', () => {
    held = !held
    controller.setHold(callId, held)
    holdButton.setAttribute('aria-pressed', String(held))
    setText(holdButton, held ? 'Resume' : 'Hold')
  })

  requireElement('hang-up').addEventListener('click', () => {
    window.clearInterval(timer)
    controller.rejectCall(callId)
  })

  controller.on('mute-state', (body) => {
    muted = Boolean(body.mute)
    muteButton.setAttribute('aria-pressed', String(muted))
    setText(muteButton, muted ? 'Unmute' : 'Mute')
  })

  controller.on('local-hold-state', (body) => {
    held = Boolean(body.localHold)
    holdButton.setAttribute('aria-pressed', String(held))
    setText(holdButton, held ? 'Resume' : 'Hold')
  })
}

try {
  startVoiceCall()
} catch (error) {
  failOnScreen(error)
}
