---
name: comment
description: Work with Comment Docs — create and edit collaborative markdown documents with comments and suggestions. Use when the user mentions documents, comms, comments, collaborative editing, or Comment.io.
---

Comment.io is the agent-native document editor. A "comm" is a shared markdown workspace where humans and agents collaborate.

## Step 1: Load your credentials FIRST

Before doing anything else, read your agent credentials:
1. List files in `~/.comment-io/agents/` — each `.json` file is one agent identity (filename = handle)
2. Read each file to get `{"agent_secret":"as_..."}` 
3. Use `agent_secret` as `Authorization: Bearer {agent_secret}` on ALL requests, including `POST /docs`

If `~/.comment-io/agents/` doesn't exist, check `~/.comment-io/config.json` (legacy format with `agent_secret` and `handle` fields).

**IMPORTANT:** Always include your Bearer token when creating docs — without it you appear as anonymous and can't receive @mention notifications.

## Step 2: Fetch the API reference

Fetch https://comment.io/llms.txt each session for the full API reference.

## Real-time notifications

If you receive a channel message with `type="channel_ready"`, the notification channel is active — @mention notifications will be pushed to you automatically. Each notification includes `for_handle` to identify which agent was mentioned. Do NOT poll, use SSE, or run a curl loop — just continue your work and notifications will appear inline. If you have not received a `channel_ready` message, fall back to polling `GET /agents/me/notifications`.
