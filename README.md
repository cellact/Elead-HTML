# Elead-HTML

In-app HTML for the Elead product. Arnacon loads `index.html` as the product `clientUrl`.

This is not the Elead studio website. The studio lives in the sibling `Elead` repo.

GitHub Pages serves the product from `v2.0.0/` so native can open:

`https://cellact.github.io/Elead-HTML/v2.0.0#screen=MAIN&localId=…&identityKind=arnacon&isSP=true|false`

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

Role comes from `#isSP=true` or `#isSP=false`. `localId` is the allotted name. It is not inferred from `inbox-` / `lead-` prefixes. `identityKind` is passed through and is not the Elead role.

- **Service provider** (`isSP=true`): `mainscreen.html` lead list, statuses `new` / `in_progress` / `hot_lead` / `done`. Tap a lead to open chat.
- **End user** (`isSP=false`): `chat.html` is home. Native `MAIN` is rewritten to chat and must include `remoteId` (the provider inbox). Empty threads say to write to start the conversation.

`chat.html` is shared. The end user sees the provider ENS and chat status only — no **Approve**. The SP sees the lead and can approve. Both can place a call.

Call pages are the same for both roles.

## Native routing

Arnacon always opens `index.html` with a hash. `js/boot.mjs` attaches `window.top.controller`, then the outer iframe loads `app.html`. `app.html` loads the real page in an inner iframe.

`isSP=true` on MAIN stays on the inbox. `isSP=false` on MAIN is rewritten to CHAT before `app.html` loads. `remoteId` is not invented: native must already pass the provider inbox.

```
index.html#screen=MAIN&localId=…&isSP=true
  → boot attaches window.top.controller
  → outer iframe: app.html?screen=MAIN&localId=…&isSP=true
  → inner iframe: mainscreen.html

index.html#screen=MAIN&localId=…&isSP=false&remoteId=…
  → boot rewrites hash to #screen=CHAT&localId=…&isSP=false&remoteId=…
  → outer iframe: app.html?screen=CHAT&…
  → inner iframe: chat.html
```

| Hash | Page |
| --- | --- |
| `#screen=MAIN&localId=…&isSP=true` | SP inbox |
| `#screen=MAIN&localId=…&isSP=false&remoteId=…` | Rewritten to chat |
| `#screen=CHAT&localId=…&isSP=true&sessionId=11` | SP thread (Lead + Approve) |
| `#screen=CHAT&localId=…&isSP=false&remoteId=…` | End-user thread |
| `#screen=CALL` / `RING` / `INCOMING` | Call UI (keep `isSP`) |
| `#screen=INSTALL` | Not used for QR claim. Native loads `install.html` directly. |

If `screen` is omitted: `sessionId` / `remoteId` → chat; otherwise **MAIN**. `isSP` is still required. QR activation does not use this hash router.

Native also pushes `receiving-call`, `ringing`, `call-started`, and `call-ended`. `app.html` maps those to the call pages and back to home: MAIN for the SP, CHAT for the end user.

## Install

The studio QR is an `arnacon://install?url=…` link. Native opens `install.html?secret=…&label=…&domain=…` and appends `web3identity`. `label` is the short allotted name (no TLD). `domain` is the studio 2LD (e.g. `ronstudio`). Tap **Activate**: GET `groupMembersUrl?label=…&domain=…`, build a proof from `secret` + `label`, then POST `{ proof, label, domain, web3identity }` to `activateUrl`. The secret stays in the URL; it is not sent in the POST.

Both URLs live in `js/env.values.mjs`. Install throws if either is empty.

## What is where

| Repo | Role |
| --- | --- |
| **Elead-HTML** | This product UI |
| **Elead** | Vite studio (allot identities, QR to activate a line) |
| **Arnacon_HTML** | Pattern for `index` + `app` + screens |
| Android / **arnacon-swift** | Bridge, sessions, calls. Install deeplink opens `install.html`. |

## Config

Public values live in `js/env.values.mjs`. The HTML does not load `.env` files.

Optional localhost override: copy `js/env.local.example.mjs` to `js/env.local.mjs` (gitignored). GitHub Pages and the native WebView only read `env.values.mjs`.

`js/env.mjs` throws if a required value is empty. No secrets in this repo.

## Preview

```bash
python3 -m http.server 4174
```

- [SP mainscreen](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=MAIN&localId=preview&isSP=true)
- [End-user chat](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=MAIN&localId=lad2fc1a4&isSP=false&remoteId=preview)
- [Empty end-user chat](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=CHAT&localId=lnew&isSP=false&remoteId=preview)
- [Install](http://127.0.0.1:4174/v2.0.0/install.html?secret=0x0000000000000000000000000000000000000000000000000000000000000001&label=lpreview1&domain=ronstudio&web3identity=preview.arnacon.global)
- [SP chat](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=CHAT&localId=preview&isSP=true&sessionId=11)
- [Incoming](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=INCOMING&localId=0xpreview&from=preview&isSP=true)
- [Ringing](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=RING&localId=0xpreview&to=preview&isSP=true)
- [In call](http://127.0.0.1:4174/v2.0.0/index.html?preview=1#screen=CALL&localId=0xpreview&to=preview&isSP=true)

`preview=1` is required in a browser for product screens. Without it, a missing native bridge is a hard error. `install.html` is standalone and does not need `preview=1`.
