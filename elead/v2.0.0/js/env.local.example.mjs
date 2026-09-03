/**
 * Copy this file to env.local.mjs to override env.values.mjs on localhost.
 * Ignored on GitHub Pages and in the native WebView. env.local.mjs is gitignored.
 */
export const envLocal = {
  getInboxUrl: 'http://127.0.0.1:8080/getInbox',
}
