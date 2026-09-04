# Aegis-HTML

In-app HTML for two Aegis products. Arnacon loads `index.html` as each product `clientUrl`.

This is not the Aegis studio website. The studio lives in the sibling `Elead` repo.

GitHub Pages serves two products:

| Product | Path | Who |
| --- | --- | --- |
| **aegis** | `aegis/v2.0.0/` | End user (lead). Chat is home. |
| **sp-aegis** | `sp-aegis/v2.0.0/` | Service provider (inbox). Lead list is home. |

```
https://cellact.github.io/Elead-HTML/aegis/v2.0.0#localId={label}.{domain}.global
https://cellact.github.io/Elead-HTML/sp-aegis/v2.0.0#screen=MAIN&localId=…
```

Role is which product native opens. There is no `isSP` or `toInbox` hash param.

## Product shape

```
controller/         shared native bridge (Controller, get-messages, calls)
aegis/v2.0.0/       end-user HTML
sp-aegis/v2.0.0/    inbox HTML

index.html          create window.top.controller
app.html            route native screen → page
mainscreen.html     SP inbox only (sp-aegis)
chat.html           one thread (lead home; SP thread)
voicecall.html      in-call (CALL)
ringing.html        outbound (RING)
incomingcall.html   inbound (INCOMING)
errorwindow.html    native error overlay
install.html        QR claim page (proof → backend; no native install)
```

`js/controller.mjs` in each product re-exports `../../../controller/index.mjs`. Edit the shared module, not the shim.

There is no `newchat.html` or `recentsessions.html`. The session list lives in `sp-aegis` `mainscreen.html`.

## Who sees what

`localId` is the allotted name. `identityKind` is passed through and is not the Aegis role.

- **Service provider** (`sp-aegis`): `mainscreen.html` lead list, statuses `new` / `in_progress` / `hot_lead` / `done`. Tap a lead to open chat. Chat shows the lead and **Approve**.
- **End user** (`aegis`): `chat.html` is home. Native `MAIN` is rewritten to chat. If native history already has a session, that inbox is the `to`. If not, chat reads the ENS `inboxList` text on `{domain}.global` (same record the studio Inbox page uses) and picks an active inbox as the `to`. The lead always sees the studio domain (e.g. `rani`), even when the real remote is `inbox1.{domain}.global`. History loads only after native has a `sessionId`. A new line is a blank thread; send still works. No **Approve**.

`fromDomain` is the studio 2LD. Native should open lead HTML with a full allotted name `{label}.{domain}.global`. A `#domain=` param is also accepted. Browser `preview=1` still mocks native. ENS `inboxList` is read only when history is empty and the allotted name has a real domain.

Call pages are the same in both products.

## Native routing

Arnacon always opens `index.html` with a hash. `js/boot.mjs` attaches `window.top.controller`, then the outer iframe loads `app.html`. `app.html` loads the real page in an inner iframe.

**sp-aegis**

```
index.html#screen=MAIN&localId=…
  → boot attaches window.top.controller
  → outer iframe: app.html?screen=MAIN&localId=…
  → inner iframe: mainscreen.html
```

**aegis**

```
index.html#screen=MAIN&localId={label}.{domain}.global
  → boot rewrites hash to #screen=CHAT&localId=…
  → outer iframe: app.html?screen=CHAT&…
  → inner iframe: chat.html
  → chat uses history for to, or ENS inboxList on {domain}.global on first message
```

| Hash | Product | Page |
| --- | --- | --- |
| `#screen=MAIN&localId=…` | sp-aegis | SP inbox |
| `#screen=MAIN&localId={label}.{domain}.global` | aegis | Rewritten to chat |
| `#screen=CHAT&localId=…&sessionId=11` | sp-aegis | SP thread (Lead + Approve) |
| `#screen=CHAT&localId={label}.{domain}.global` | aegis | End-user thread |
| `#screen=CALL` / `RING` / `INCOMING` | both | Call UI |
| `#screen=INSTALL` | both | Not used for QR claim. Native loads `install.html` directly. |

If `screen` is omitted: **sp-aegis** uses MAIN (or chat when `sessionId` / `remoteId` is present). **aegis** always uses chat. QR activation does not use this hash router.

Native also pushes `receiving-call`, `ringing`, `call-started`, and `call-ended`. `app.html` maps those to the call pages and back to chat: the SP thread for that identity, CHAT for the end user.

## Install

The studio QR is an `arnacon://install?url=…` link. Native opens `install.html?secret=…&label=…&domain=…` and appends `web3identity`. `label` is the short allotted name (no TLD). `domain` is the studio 2LD (e.g. `ronstudio`). Tap **Activate**: GET `groupMembersUrl?label=…&domain=…`, build a proof from `secret` + `label`, then POST `{ proof, label, domain, web3identity }` to `activateUrl`. The secret stays in the URL; it is not sent in the POST.

Both URLs live in `js/env.values.mjs`. Install throws if either is empty.

## What is where

| Repo | Role |
| --- | --- |
| **Elead-HTML** | These two product UIs |
| **Elead** | Vite studio (allot identities, QR to activate a line) |

## Config

Public values live in each product's `js/env.values.mjs`. The HTML does not load `.env` files.

Optional localhost override: copy `js/env.local.example.mjs` to `js/env.local.mjs` (gitignored). GitHub Pages and the native WebView only read `env.values.mjs`.

`js/env.mjs` throws if a required value is empty. No secrets in this repo.

Lead HTML reads Sepolia ENS (`ensRpcUrl` + `publicResolver`) for the first-message inbox. Lead status still uses `inboxFeedUrl`. Until those values are set, use `preview=1` in a browser.

## Preview

```bash
python3 -m http.server 4174
```

- [SP mainscreen](http://127.0.0.1:4174/sp-aegis/v2.0.0/index.html?preview=1#screen=MAIN&localId=preview)
- [SP chat](http://127.0.0.1:4174/sp-aegis/v2.0.0/index.html?preview=1#screen=CHAT&localId=preview&sessionId=11)
- [End-user chat](http://127.0.0.1:4174/aegis/v2.0.0/index.html?preview=1#localId=lad2fc1a4)
- [Empty end-user chat](http://127.0.0.1:4174/aegis/v2.0.0/index.html?preview=1#screen=CHAT&localId=lnew)
- [Install (lead)](http://127.0.0.1:4174/aegis/v2.0.0/install.html?secret=0x0000000000000000000000000000000000000000000000000000000000000001&label=lpreview1&domain=ronstudio&web3identity=preview.arnacon.global)
- [Install (inbox)](http://127.0.0.1:4174/sp-aegis/v2.0.0/install.html?secret=0x0000000000000000000000000000000000000000000000000000000000000001&label=ipreview1&domain=ronstudio&web3identity=preview.arnacon.global)
- [Incoming](http://127.0.0.1:4174/sp-aegis/v2.0.0/index.html?preview=1#screen=INCOMING&localId=0xpreview&from=preview)
- [Ringing](http://127.0.0.1:4174/sp-aegis/v2.0.0/index.html?preview=1#screen=RING&localId=0xpreview&to=preview)
- [In call](http://127.0.0.1:4174/sp-aegis/v2.0.0/index.html?preview=1#screen=CALL&localId=0xpreview&to=preview)

`preview=1` is required in a browser for product screens. Without it, a missing native bridge is a hard error. `install.html` is standalone and does not need `preview=1`.
