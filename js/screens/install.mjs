import { requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs'
import { activateLine, readInstallClaim } from '../activation.mjs'

export async function startInstallScreen() {
  const env = await loadEnv()
  const claim = readInstallClaim()

  const labelNode = requireElement('product-label')
  const ensNode = requireElement('product-ens')
  const bodyNode = requireElement('product-description')
  const imageNode = requireElement('product-image')
  const button = requireElement('install-button')
  const stateNode = requireElement('install-state')

  setText(labelNode, env.productLabel)
  setText(ensNode, claim.label)
  setText(bodyNode, env.productDescription)

  if (env.productImage) {
    imageNode.hidden = false
    imageNode.src = env.productImage
    imageNode.alt = env.productLabel
  } else {
    imageNode.hidden = true
  }

  button.addEventListener('click', () => {
    button.disabled = true
    setText(stateNode, 'Starting activation…')

    activateLine({
      secret: claim.secret,
      label: claim.label,
      web3identity: claim.web3identity,
      groupMembersUrl: env.groupMembersUrl,
      activateUrl: env.activateUrl,
      onStatus: (message) => setText(stateNode, message),
    })
      .then(() => {
        setText(stateNode, 'This line is active on this device.')
      })
      .catch((error) => {
        button.disabled = false
        setText(
          stateNode,
          error instanceof Error ? error.message : 'Activation failed.',
        )
        console.error(error)
      })
  })
}

startInstallScreen().catch(failOnScreen)
