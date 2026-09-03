import { assert } from './assert.mjs'

export function requireElement(id) {
  const node = document.getElementById(id)

  if (node == null) {
    throw new Error(`Missing required element #${id}`)
  }

  return node
}

export function setText(node, value) {
  assert(node instanceof Node, 'setText: node is not a DOM node')
  node.textContent = value
}

export function replaceChildren(node, ...children) {
  assert(node instanceof Element, 'replaceChildren: node is not an element')
  node.replaceChildren(...children)
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) {
      continue
    }

    if (key === 'className') {
      node.className = value
      continue
    }

    if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        node.dataset[dataKey] = String(dataValue)
      }
      continue
    }

    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value)
      continue
    }

    if (value === true) {
      node.setAttribute(key, '')
      continue
    }

    node.setAttribute(key, String(value))
  }

  for (const child of children) {
    if (child == null) {
      continue
    }

    node.append(child)
  }

  return node
}
