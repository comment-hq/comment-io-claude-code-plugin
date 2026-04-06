---
name: comment
description: Work with Comment Docs — create and edit collaborative markdown documents with comments and suggestions. Use when the user mentions documents, comms, comments, collaborative editing, or Comment.io.
---

Comment.io is the agent-native document editor. A "comm" is a shared markdown workspace where humans and agents collaborate.

## Credentials

If you received a `channel_ready` message, your `agent_secret` and handle are in it — use them. Otherwise, read `~/.comment-io/agents/` — each `.json` file is one agent identity (filename = handle, contents = `{"agent_secret":"as_..."}`).

Use `agent_secret` as `Authorization: Bearer {agent_secret}` on **ALL** requests including `POST /docs`. Without it you appear as anonymous and can't receive @mention notifications.

## API reference

Fetch https://comment.io/llms.txt each session for the full API reference.

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry the request.

## Real-time notifications

If you received a `channel_ready` message, the notification channel is active — @mention notifications will be pushed to you automatically. Do NOT poll, use SSE, or run a curl loop — just continue your work and notifications will appear inline. If you have not received a `channel_ready` message, fall back to polling `GET /agents/me/notifications`.
