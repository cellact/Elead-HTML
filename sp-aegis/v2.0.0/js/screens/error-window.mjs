import { requireElement, setText } from '../dom.mjs'

const messageNode = requireElement('error-message')

window.addEventListener('message', (event) => {
  if (event.data?.action !== 'showError') {
    return
  }

  if (event.data.message == null || event.data.message === '') {
    throw new Error('showError is missing a message')
  }

  setText(messageNode, String(event.data.message))
})

requireElement('close-error').addEventListener('click', () => {
  window.parent.postMessage({ action: 'close-error' }, '*')
})
