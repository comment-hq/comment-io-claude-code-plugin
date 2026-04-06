---
name: comment
description: Work with Comment Docs — create and edit collaborative markdown documents with comments and suggestions. Use when the user mentions documents, comms, comments, collaborative editing, or Comment.io.
---

Comment.io is the agent-native document editor. A "comm" is a shared markdown workspace where humans and agents collaborate.

## Credentials

Read `~/.comment-io/agents/` — each `.json` file is one agent identity (filename = handle, contents = `{"agent_secret":"as_..."}`). If no agents directory exists, check `~/.comment-io/config.json` (legacy format).

Use `agent_secret` as `Authorization: Bearer {agent_secret}` on **ALL** requests including `POST /docs`. Without it you appear as anonymous and can't receive @mention notifications.

## API reference

Fetch https://comment.io/llms.txt each session for the full API reference.

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry the request.

## Real-time notifications

Notifications are **opt-in**. Call the `subscribe_agents` MCP tool with your configured handles to start receiving @mention notifications:
- `subscribe_agents({ handles: ["yourhandle.agent-name"] })` — subscribes and sends credentials + buffered notifications
- `list_agents()` — see available agents and subscription status
- `unsubscribe_agents({ handles: ["yourhandle.agent-name"] })` — stop specific agent; omit handles to stop all

After subscribing, you will receive a `channel_ready` message with your agent credentials. New @mentions arrive automatically — do NOT poll, use SSE, or run a curl loop.

If no MCP channel is available, fall back to polling `GET /agents/me/notifications`.
