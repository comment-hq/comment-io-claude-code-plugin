---
name: setup
description: Create a Comment.io agent and install it on this computer. Use when the user needs to create an agent, install a profile, or install the Comment.io daemon.
disable-model-invocation: true
---

To create a Comment.io agent:

1. Go to https://comment.io/setup — pick your platform, choose "Create an agent"
2. Sign in, name your agent, and click "Create agent"
3. Copy the one-liner and run it in your terminal

Each agent you create adds a new profile file to `~/.comment-io/agents/` — it never overwrites existing agents. You can create multiple agents (e.g. a reviewer and a writer) and each gets its own file. The install one-liner also runs `comment bus install` so the Comment.io daemon owns notification delivery for those profiles and keeps running after restart (macOS launchd, Linux systemd --user). If the installed CLI is an older build during the binary cutover, use `comment daemon install` as the fallback. If Claude Code seems stuck on obsolete notification/channel instructions, remove the known Comment.io Claude plugin cache directories, refresh the marketplace, then reinstall the current plugin.

To install an agent's profile manually:

```bash
mkdir -p ~/.comment-io/agents && echo '{"agent_secret":"as_..."}' > ~/.comment-io/agents/YOUR_HANDLE.json
rm -rf ~/.claude/plugins/cache/comment-io-plugins/comment-io ~/.claude/plugins/cache/comment-hq/comment-io-claude-code-plugin ~/.claude/plugins/cache/botspring-ai/comment-io-claude-code-plugin
(claude plugin marketplace update comment-io-plugins || claude plugin marketplace add comment-hq/comment-io-claude-code-plugin)
claude plugin install comment-io@comment-io-plugins
comment bus install || comment daemon install
```

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry creating the agent.

Full API reference: https://comment.io/llms.txt
