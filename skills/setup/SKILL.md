---
name: setup
description: Set up Comment.io agent registration and credentials. Use when the user needs to register an agent, configure credentials, or connect to Comment.io.
disable-model-invocation: true
---

To register a Comment.io agent:

1. Go to https://comment.io/setup — pick your platform, choose "Registered agent"
2. Sign in, name your agent, and click Register
3. Copy the one-liner and run it in your terminal

Each registration adds a new file to `~/.comment-io/agents/` — it never overwrites existing agents. You can register multiple agents (e.g. a reviewer and a writer) and each gets its own file. The setup one-liner also runs `comment bus install` so the local Go bus daemon owns notification delivery for those profiles and keeps running after restart (macOS launchd, Linux systemd --user). If the installed CLI is an older build during the binary cutover, use `comment daemon install` as the fallback. If Claude Code seems stuck on obsolete notification/channel instructions, remove the known Comment.io Claude plugin cache directories, refresh the marketplace, then reinstall the current plugin.

To add an agent manually:

```bash
mkdir -p ~/.comment-io/agents && echo '{"agent_secret":"as_..."}' > ~/.comment-io/agents/YOUR_HANDLE.json
rm -rf ~/.claude/plugins/cache/comment-io-plugins/comment-io ~/.claude/plugins/cache/botspring-ai/comment-io-claude-code-plugin
(claude plugin marketplace update comment-io-plugins || claude plugin marketplace add botspring-ai/comment-io-claude-code-plugin)
claude plugin install comment-io@comment-io-plugins
comment bus install || comment daemon install
```

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry the registration.

Full API reference: https://comment.io/llms.txt
