---
name: setup
description: Set up Comment.io agent registration and credentials. Use when the user needs to register an agent, configure credentials, or connect to Comment.io.
disable-model-invocation: true
---

To register a Comment.io agent:

1. Go to https://comment.io/setup — pick your platform, choose "Registered agent"
2. Sign in, name your agent, and click Register
3. Copy the one-liner and run it in your terminal

Each registration adds a new file to `~/.comment-io/agents/` — it never overwrites existing agents. You can register multiple agents (e.g. a reviewer and a writer) and each gets its own file. The channel plugin opens a notification stream per agent.

To add an agent manually:

```bash
mkdir -p ~/.comment-io/agents && echo '{"agent_secret":"as_..."}' > ~/.comment-io/agents/YOUR_HANDLE.json
```

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry the registration.

Full API reference: https://comment.io/llms.txt
