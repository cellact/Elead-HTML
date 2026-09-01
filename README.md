# Elead-HTML

In-app HTML for the Elead product. Arnacon loads `index.html` as the product `clientUrl` after a user scans a QR or opens the product.

This is not the Elead studio website. The studio lives in the sibling `Elead` repo.

## Three journeys, three screens:

1. **Service provider inbox** — every lead, with status `new` / `in_progress` / `hot_lead` / `done`.
2. **End-user chat** — one thread with the provider, plus chat status `pending` / `approved`.
3. **Product install** — first screen after a product QR. Shows product data. **Install** tells the native app to purchase the product through ENS.

## What is where

| Repo | Role | Use it for |
| --- | --- | --- |
| **Elead-HTML** (this repo) | Product UI inside the Arnacon WebView | Screens, native bridge, lead/chat status |
| **Elead** | Vite + React studio | Allot identities, console, QR to *activate* a line |
| **Arnacon_HTML** | Existing in-app HTML products | Controller boot, hash routes, `receiveData` |
| **Arnacon_Android_Client_OpenSource** | Android host | `AndroidBridge.processAction`, `new-item`, `install-product` |
| **arnacon-swift** | iOS host + SDK | `webkit` bridge, `installProduct`, ENS purchase |

Elead studio (`/allotting`, `/contact`, console `/manage`) stays in **Elead**. Do not rebuild those pages here.

Arnacon_HTML `chat.html` is a full messenger (calls, media, reactions). Elead chat is text and a status chip. Copy the *contract*, not that file.

## How the native app talks to this HTML

```
QR / product open
  → native WebView loads index.html#screen=…&localId=…
  → js/boot.mjs creates window.top.controller
  → iframe loads install.html, chat.html, or dashboard.html
  → screen modules call controller methods
  → native calls window.top.controller.receiveData(json)
```

Native sends and receives JSON `{ action, body }`. This repo implements the subset Elead needs:

| Direction | Action | Used by |
| --- | --- | --- |
| HTML → native | `new-item` `{ customer_id, item }` | Install → ENS purchase |
| HTML → native | `install-product` `{ item, url, uuid, timestamp, packageType }` | Install when the QR already has a full payload |
| HTML → native | `get-recent-sessions` | SP dashboard |
| HTML → native | `get-messages` | Chat |
| HTML → native | `send-message` | Chat |
| HTML → native | `update-session-timestamp` | Chat (mark read) |
| Native → HTML | `data-retrieved` + `requestId` | Promise responses |
| Native → HTML | `new-message` | Live chat / inbox refresh |
| Native → HTML | `error` | Fatal banner |

## What goes in which file

```
index.html                 boot + iframe + fatal banner
install.html               product data + Install
chat.html                  one thread + pending/approved
dashboard.html             SP lead list + status filter

js/boot.mjs                create Controller, route the iframe
js/controller.mjs          native bridge (same receiveData contract)
js/route.mjs               hash/query → INSTALL | CHAT | MAIN
js/product.mjs             product record + which install action to send
js/lead-status.mjs         SP statuses (local until a backend exists)
js/chat-status.mjs         pending / approved (local until a backend exists)
js/env.values.mjs          public config (see .env.example)
js/screens/*.mjs           one module per screen

css/tokens.css             Elead ink/paper tokens (from the Elead studio)
```

### Screen routing

Native (or you, in preview) set the hash:

| Hash | Screen |
| --- | --- |
| `#screen=INSTALL&localId=0x…` | Product install |
| `#screen=CHAT&localId=…&remoteId=inbox.elead.eth` | End-user chat |
| `#screen=CHAT&localId=…&sessionId=11` | Open one lead |
| `#screen=MAIN&localId=inbox-….elead.eth` | SP dashboard |

If `screen` is omitted: `sessionId`/`remoteId` → chat; `localId` starting with `inbox-` → dashboard; otherwise install.

### Install → ENS

1. Screen reads product fields from the URL, then `js/env.values.mjs`.
2. User taps **Install**.
3. If the URL has `url`, `uuid`, `timestamp`, and `packageType`, the HTML sends `install-product`.
4. Otherwise it sends `new-item` with `customer_id = localId` and `item =` the product ENS. iOS/Android pass that into `installProduct`. A `customer_id` is the pending ENS purchase path.

### Statuses

Native `Message.status` is delivery (sent/delivered). It is not a lead state.

- **Lead status** (SP): `new`, `in_progress`, `hot_lead`, `done`. Stored in `localStorage` as `elead:lead-status:{sessionId}` until Elead has a backend.
- **Chat status** (end user): `pending`, `approved`. Stored as `elead:chat-status:{threadId}`. The SP **Approve** button on chat (inbox identities only) sets `approved`.

Corrupt storage throws. It does not reset quietly.

## Config

1. Read `.env.example`.
2. Put public values in `js/env.values.mjs`.
3. Optional machine override: copy `js/env.local.example.mjs` to `js/env.local.mjs` (gitignored).

`js/env.mjs` throws if a required value is empty. Do not put private keys in this repo. Browser-visible config is public.

## Preview without the app

Serve the folder (modules will not load from `file://`):

```bash
python3 -m http.server 4173
```

Then open:

- [Install](http://127.0.0.1:4173/index.html?preview=1#screen=INSTALL&localId=0xpreview)
- [Chat](http://127.0.0.1:4173/index.html?preview=1#screen=CHAT&localId=lead-1a2b3c4d.elead.eth&sessionId=11)
- [Dashboard](http://127.0.0.1:4173/index.html?preview=1#screen=MAIN&localId=inbox-preview.elead.eth)

`preview=1` is required. Without it, missing `webkit` / `AndroidBridge` is a hard error.

## Cursor rules

`.cursor/rules/` encodes: think first, fail loud, naming, simplicity, secrets, and this map. Follow them when changing the product.
