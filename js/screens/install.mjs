import { requireElement, setText } from '../dom.mjs'
import { failOnScreen } from '../screen-fail.mjs'
import { loadEnv } from '../env.mjs'
import { requireController } from '../controller.mjs'
import { installProduct, readProductRecord } from '../product.mjs'
import { openRoleHome } from '../role.mjs'
import { readRoute, requireLocalId } from '../route.mjs'

export async function startInstallScreen() {
  const env = await loadEnv()
  const route = readRoute()
  const controller = requireController()
  const localId = requireLocalId({
    ...route,
    localId: route.localId || controller.localId,
  })
  const product = readProductRecord(route, env)

  const labelNode = requireElement('product-label')
  const ensNode = requireElement('product-ens')
  const bodyNode = requireElement('product-description')
  const imageNode = requireElement('product-image')
  const button = requireElement('install-button')
  const stateNode = requireElement('install-state')

  setText(labelNode, product.label)
  setText(ensNode, product.item)
  setText(bodyNode, product.description)

  if (product.image) {
    imageNode.hidden = false
    imageNode.src = product.image
    imageNode.alt = product.label
  } else {
    imageNode.hidden = true
  }

  button.addEventListener('click', () => {
    button.disabled = true
    setText(stateNode, 'Asking Arnacon to purchase this product with ENS…')

    try {
      const action = installProduct(controller, product, localId)
      setText(
        stateNode,
        action === 'new-item'
          ? 'Purchase started. Arnacon is buying this product for you.'
          : 'Install started. Arnacon is activating this product.',
      )
      openRoleHome(localId, { remoteId: env.inboxEns })
    } catch (error) {
      button.disabled = false
      throw error
    }
  })
}

startInstallScreen().catch(failOnScreen)
