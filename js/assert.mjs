export function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function requireNonEmptyString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message)
  }

  return value.trim()
}

export function requireFiniteNumber(value, message) {
  const number = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(number)) {
    throw new Error(message)
  }

  return number
}

export function unreachable(value, message = 'Unreachable state') {
  throw new Error(`${message}: ${String(value)}`)
}
