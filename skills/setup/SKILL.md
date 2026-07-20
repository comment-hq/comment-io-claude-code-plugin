---
name: setup
description: Find the smallest working Comment.io route for this agent, from existing tools or a comm link through optional persistent setup. Use when the user asks to connect, configure, or start using Comment.io.
disable-model-invocation: true
---

For these instructions, choose `$BASE` in this order: final Comment.io comm origin after any shortlink redirect; active tool/account base URL; explicitly selected profile `base_url`; finally this skill's installation origin (`https://comment.io`). Never use a shortlink origin as `$BASE`; keep every setup and reference fetch on the final Comment.io origin.

Start with the first capability that already works: use existing Comment.io tools immediately; with a supplied comm and authenticated HTTPS, resolve a clean shortlink once without Authorization or automatic redirects, accept only an exact token-bearing Comment.io `/d/{slug}` Location, then send `X-Comment-Share-Ingress: 1` on the first personalized `?docs` GET and switch to returned `your_token`; with URL fetch only (no browser UI/headers), use any supplied share URL now, add `mode=agent` without removing its query, and read the first response directly. For a bare slug or token-free comm URL, first try the target origin's `/d/{slug}?mode=agent`; continue only when `markdown` is non-null. If it is null or says no readable state, ask once for **Share → Copy for agent**. The envelope is read-only. With interactive browser control, use the visible editor and comments UI. Only when no current route works or the user asks for deeper setup, fetch and read `$BASE/llms/setup.txt` and follow its smallest matching path.

Only on a long-lived computer the user controls: when they explicitly want local MCP tools, fetch and follow `$BASE/llms/setup/mcp.txt`; when they explicitly want persistent behavior such as background @mentions, standing agents, scheduled work, or local sync, fetch and follow `$BASE/llms/setup/full.txt`. Check existing state before changing it and determine your runtime capabilities yourself. For a generic install request, present the live guide's setup modes once. If the user already explicitly selected **Regular Install**, treat that selection as approval and do not ask them to choose or approve commands again; otherwise explain the high-level setup and ask once for approval to change client configuration, install, or pair. After approval, run the terminal steps yourself. Pause again only for a browser/device-code approval, account sign-in, privileged action, interactive TTY, or another real permission boundary. Do not seek approval command by command. If this skill and the live guides disagree, the live guides win.

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach `$BASE`, give the user this standalone action:

**You need to:** Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type the hostname from `$BASE` (for example, `comment.io`) and save.

Then retry the original Comment.io request.

Full API reference: `$BASE/llms/reference.txt`
