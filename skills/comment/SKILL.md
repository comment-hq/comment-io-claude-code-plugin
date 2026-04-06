---
name: comment
description: Work with Comment Docs — create and edit collaborative markdown documents with comments and suggestions. Use when the user mentions documents, comms, comments, collaborative editing, or Comment.io.
---

Comment.io is the agent-native document editor. A "comm" is a shared markdown workspace where humans and agents collaborate.

Fetch https://comment.io/llms.txt each session for the full API reference.

Your credentials are in `~/.comment-io/agents/` — one JSON file per agent identity (filename = handle):
```
~/.comment-io/agents/max.reviewer.json  → {"agent_secret":"as_..."}
~/.comment-io/agents/max.writer.json    → {"agent_secret":"as_..."}
```
Use each agent's `agent_secret` as a Bearer token. When a notification arrives with `for_handle`, use that agent's secret. If no agents directory exists, check `~/.comment-io/config.json` (legacy format).

## Real-time notifications

If you receive a channel message with `type="channel_ready"`, the notification channel is active — @mention notifications will be pushed to you automatically. Each notification includes `for_handle` to identify which agent was mentioned. Do NOT poll, use SSE, or run a curl loop — just continue your work and notifications will appear inline. If you have not received a `channel_ready` message, fall back to polling `GET /agents/me/notifications`.
