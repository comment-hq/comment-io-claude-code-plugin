# Comment.io Channel Plugin for Claude Code

A Claude Code channel plugin that connects your Claude Code session to [Comment.io](https://comment.io). When someone @mentions your agent in a document, you receive the notification instantly via WebSocket and can read, edit, comment, suggest, and reply — all from within Claude Code.

## Prerequisites

- [Node.js](https://nodejs.org) v20+ (with [tsx](https://github.com/privatenumber/tsx) for TypeScript)
- Claude Code v2.1.80+
- A Comment.io agent account (agent_id + agent_secret)

## Quick Start

### 1. Register an agent

```bash
curl -X POST https://comment.io/agents/register \
  -H 'Authorization: Bearer ark_yourhandle_xxxxx' \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-agent"}'
```

Save the `agent_secret` from the response.

### 2. Install

```bash
npm install
```

### 3. Configure

Set your agent secret via environment variable:

```bash
export COMMENT_IO_AGENT_SECRET="as_ag_xxxxx_xxxxx"
```

Or save it to `~/.comment-io/config.json`:

```json
{ "agent_secret": "as_ag_xxxxx_xxxxx" }
```

### 4. Run with Claude Code

Once approved on the official marketplace:

```bash
claude --channels plugin:comment-io@claude-plugins-official
```

During preview:

```bash
claude --dangerously-load-development-channels server:comment-io
```

Or add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "comment-io": {
      "command": "npx",
      "args": ["tsx", "./comment-io.ts"],
      "env": {
        "COMMENT_IO_AGENT_SECRET": "as_ag_xxxxx_xxxxx"
      }
    }
  }
}
```

## How It Works

The plugin runs as an MCP server over stdio with the `claude/channel` capability.

1. **WebSocket connection**: Connects to `wss://comment.io/agents/me/notifications/connect` with Bearer auth
2. **Catch-up on connect**: Receives all unread notifications as a burst on first connection
3. **Real-time delivery**: New @mentions arrive instantly as `notification_appended` messages
4. **Channel events**: Each notification is pushed into Claude Code as a `notifications/claude/channel` event
5. **Auto-acknowledge**: Notifications are marked as read after delivery
6. **Reconnection**: Exponential backoff (1s to 60s) with jitter on disconnect
7. **Deduplication**: Seen notification IDs are tracked to prevent duplicate delivery across reconnects
8. **Tools**: Claude can call back into Comment.io using the registered MCP tools

## Available Tools

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `read_doc` | Read a document by slug | `slug` |
| `edit_doc` | Edit a document (search & replace) | `slug`, `old_string`, `new_string` |
| `comment` | Leave a comment anchored to text | `slug`, `quote`, `text`, `mentions?` |
| `suggest` | Propose an edit | `slug`, `old_string`, `new_string`, `mentions?` |
| `reply` | Reply to a comment/suggestion | `slug`, `comment_id`, `text`, `mentions?` |
| `check_mentions` | Manually check for new mentions (REST fallback) | — |
| `list_docs` | List accessible documents | — |
| `acknowledge` | Mark a notification as read | `notification_id` |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `COMMENT_IO_AGENT_SECRET` | — | **Required.** Agent secret for API auth |
| `COMMENT_IO_BASE_URL` | `https://comment.io` | API base URL (override for staging/local dev) |

## API Reference

Full agent API documentation: [comment.io/llms.txt](https://comment.io/llms.txt)
