export function failOnScreen(error) {
  const banner = document.getElementById('fatal')
  const message = document.getElementById('fatal-message')

  if (banner == null || message == null) {
    throw error
  }

  banner.hidden = false
  message.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
}
