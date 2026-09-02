# Elead-HTML

In-app HTML for the Elead product. Arnacon loads `index.html` as the product `clientUrl`.

This is not the Elead studio website. The studio lives in the sibling `Elead` repo.

## Product shape

```
index.html          create window.top.controller
app.html            route native screen → page
mainscreen.html     SP inbox
chat.html           one thread (end-user home)
voicecall.html      in-call (CALL)
ringing.html        outbound (RING)
incomingcall.html   inbound (INCOMING)
errorwindow.html    native error overlay
install.html        QR claim page (proof → backend; no native install)
```

There is no `newchat.html` or `recentsessions.html`. The session list lives in `mainscreen.html`.

## Who sees what

- **Service provider** (`localId` starts with `inbox-`): `mainscreen.html` lead list, statuses `new` / `in_progress` / `hot_lead` / `done`. Tap a lead to open chat.
- **End user**: `chat.html` is home. Native `MAIN` for a lead identity is rewritten to chat. Empty threads say to write to start the conversation.

`chat.html` is shared. The end user sees the provider ENS and chat status only — no **Approve**. The SP sees the lead and can approve. Both can place a call.

Call pages are the same for both roles.

## Native routing

```
index.html#screen=MAIN&localId=inbox-…
  → js/boot.mjs attaches the controller
  → iframe loads app.html?screen=MAIN&…
  → app.html loads mainscreen.html

index.html#screen=MAIN&localId=lead-…
  → rewritten to #screen=CHAT
  → app.html loads chat.html
```

| Hash | Page |
| --- | --- |
| `#screen=MAIN&localId=inbox-….elead.eth` | SP inbox |
| `#screen=MAIN&localId=lead-….elead.eth` | Rewritten to chat |
| `#screen=CHAT&sessionId=11` | One thread |
| `#screen=CALL` / `RING` / `INCOMING` | Call UI |
| `#screen=INSTALL` | Not used for QR claim. Native loads `install.html` directly. |

If `screen` is omitted: `sessionId` / `remoteId` → chat; otherwise **MAIN**. QR activation does not use this hash router.

Native also pushes `receiving-call`, `ringing`, `call-started`, and `call-ended`. `app.html` maps those to the call pages and back to home: MAIN for the SP, CHAT for the end user.

## Install

The studio QR is an `arnacon://install?url=…` link. Native opens `install.html?secret=…&label=…` and appends `web3identity`. Tap **Activate**: the page builds a Semaphore proof from the secret and `POST`s `{ proof, label, web3identity }` to `ELEAD_ACTIVATE_URL`. There is no `new-item` / `install-product`.

Set `ELEAD_GROUP_MEMBERS_URL` and `ELEAD_ACTIVATE_URL` when those functions are deployed. The secret stays in the URL; it is not sent in the POST.

## What is where

| Repo | Role |
| --- | --- |
| **Elead-HTML** | This product UI |
| **Elead** | Vite studio (allot identities, QR to activate a line) |
| **Arnacon_HTML** | Pattern for `index` + `app` + screens |
| Android / **arnacon-swift** | Bridge, sessions, calls. Install deeplink opens `install.html`. |

## Config

1. Read `.env.example`.
2. Put public values in `js/env.values.mjs`.
3. Optional override: copy `js/env.local.example.mjs` to `js/env.local.mjs` (gitignored).

`js/env.mjs` throws if a required value is empty. No secrets in this repo.

## Preview

```bash
python3 -m http.server 4174
```

- [SP mainscreen](http://127.0.0.1:4174/index.html?preview=1#screen=MAIN&localId=inbox-preview.elead.eth)
- [End-user chat](http://127.0.0.1:4174/index.html?preview=1#screen=MAIN&localId=lead-1a2b3c4d.elead.eth)
- [Empty end-user chat](http://127.0.0.1:4174/index.html?preview=1#screen=CHAT&localId=lead-new.elead.eth)
- [Install](http://127.0.0.1:4174/install.html?secret=0x0000000000000000000000000000000000000000000000000000000000000001&label=lead-preview.elead.eth&web3identity=preview.arnacon.global)
- [Chat](http://127.0.0.1:4174/index.html?preview=1#screen=CHAT&localId=lead-1a2b3c4d.elead.eth&sessionId=11)
- [Incoming](http://127.0.0.1:4174/index.html?preview=1#screen=INCOMING&localId=0xpreview&from=inbox.elead.eth)
- [Ringing](http://127.0.0.1:4174/index.html?preview=1#screen=RING&localId=0xpreview&to=inbox.elead.eth)
- [In call](http://127.0.0.1:4174/index.html?preview=1#screen=CALL&localId=0xpreview&to=inbox.elead.eth)

`preview=1` is required in a browser for product screens. Without it, a missing native bridge is a hard error. `install.html` is standalone and does not need `preview=1`.
