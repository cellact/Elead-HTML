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
install.html        optional HTML purchase, then home
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
| `#screen=INSTALL` | Product card + Install |

If `screen` is omitted: `sessionId` / `remoteId` → chat; otherwise **MAIN**. Install is only shown when `screen=INSTALL`.

Native also pushes `receiving-call`, `ringing`, `call-started`, and `call-ended`. `app.html` maps those to the call pages and back to home: MAIN for the SP, CHAT for the end user.

## Install

Other Arnacon products install in **native** before HTML opens. `install.html` is optional: show product data, tap **Install**, send `new-item` (ENS purchase) or `install-product`. Then go home: an SP lands on the inbox; an end user lands in chat.

## What is where

| Repo | Role |
| --- | --- |
| **Elead-HTML** | This product UI |
| **Elead** | Vite studio (allot identities, QR to activate a line) |
| **Arnacon_HTML** | Pattern for `index` + `app` + screens |
| Android / **arnacon-swift** | Bridge, `installProduct`, sessions, calls |

## Config

1. Read `.env.example`.
2. Put public values in `js/env.values.mjs`.
3. Optional override: copy `js/env.local.example.mjs` to `js/env.local.mjs` (gitignored).

`js/env.mjs` throws if a required value is empty. No secrets in this repo.

## Preview

```bash
python3 -m http.server 4174
```

Hard-refresh if an old tab still asks for `dashboard.html`.

- [SP mainscreen](http://127.0.0.1:4174/index.html?preview=1#screen=MAIN&localId=inbox-preview.elead.eth)
- [End-user chat](http://127.0.0.1:4174/index.html?preview=1#screen=MAIN&localId=lead-1a2b3c4d.elead.eth)
- [Empty end-user chat](http://127.0.0.1:4174/index.html?preview=1#screen=CHAT&localId=lead-new.elead.eth)
- [Install](http://127.0.0.1:4174/index.html?preview=1#screen=INSTALL&localId=0xpreview)
- [Chat](http://127.0.0.1:4174/index.html?preview=1#screen=CHAT&localId=lead-1a2b3c4d.elead.eth&sessionId=11)
- [Incoming](http://127.0.0.1:4174/index.html?preview=1#screen=INCOMING&localId=0xpreview&from=inbox.elead.eth)
- [Ringing](http://127.0.0.1:4174/index.html?preview=1#screen=RING&localId=0xpreview&to=inbox.elead.eth)
- [In call](http://127.0.0.1:4174/index.html?preview=1#screen=CALL&localId=0xpreview&to=inbox.elead.eth)

`preview=1` is required in a browser. Without it, a missing native bridge is a hard error.
