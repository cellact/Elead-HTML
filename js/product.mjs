import { requireNonEmptyString } from './assert.mjs'

export function readProductRecord(route, env) {
  const item = requireNonEmptyString(
    route.item || env.productEnsName,
    'Product ENS name is missing. Set ELEAD_PRODUCT_ENS or pass item in the URL.',
  )

  const label = route.label || env.productLabel
  const description = route.description || env.productDescription
  const image = route.image || env.productImage
  const packageType = route.packageType || env.packageType

  return Object.freeze({
    item,
    label,
    description,
    image,
    packageType,
    url: route.url,
    uuid: route.uuid,
    timestamp: route.timestamp,
  })
}

export function hasFullInstallPayload(product) {
  return Boolean(product.url && product.uuid && product.timestamp && product.packageType)
}

export function installProduct(controller, product, customerId) {
  if (hasFullInstallPayload(product)) {
    controller.installProduct({
      item: product.item,
      url: product.url,
      uuid: product.uuid,
      timestamp: product.timestamp,
      packageType: product.packageType,
    })
    return 'install-product'
  }

  controller.purchaseProductWithEns({
    item: product.item,
    customerId,
  })
  return 'new-item'
}
