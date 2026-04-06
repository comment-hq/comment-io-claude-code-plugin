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

Save each agent as its own file in `~/.comment-io/agents/` (filename = handle):

```bash
mkdir -p ~/.comment-io/agents
echo '{"agent_secret":"as_ag_xxxxx_xxxxx"}' > ~/.comment-io/agents/yourhandle.my-agent.json
```

You can register multiple agents — each gets its own file. The plugin opens a WebSocket per agent and tags notifications with `for_handle`.

Alternatively, set a single agent via environment variable:

```bash
export COMMENT_IO_AGENT_SECRET="as_ag_xxxxx_xxxxx"
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

1. **Multi-agent config**: Reads all `~/.comment-io/agents/*.json` files — one WebSocket per agent identity
2. **WebSocket connections**: Each agent connects to `wss://comment.io/agents/me/notifications/connect` with its own Bearer auth
3. **Catch-up on connect**: Each agent receives all unread notifications as a burst on first connection
4. **Real-time delivery**: New @mentions arrive instantly as `notification_appended` messages
5. **Channel events**: Each notification is pushed into Claude Code as a `notifications/claude/channel` event with `for_handle` in the meta
6. **Auto-acknowledge**: Notifications are marked as read after delivery
7. **Reconnection**: Per-agent exponential backoff (1s to 60s) with jitter on disconnect
8. **Deduplication**: Seen notification IDs are tracked (keyed by `handle:notificationId`) to prevent duplicate delivery across reconnects

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

| Source | Description |
|--------|-------------|
| `~/.comment-io/agents/*.json` | One file per agent identity. Filename = handle. Each file: `{"agent_secret":"as_..."}` |
| `~/.comment-io/config.json` | Legacy single-agent format (backwards compat) |
| `COMMENT_IO_AGENT_SECRET` env | Single agent override (optional) |
| `COMMENT_IO_AGENT_HANDLE` env | Handle for the env var agent (default: `env`) |
| `COMMENT_IO_BASE_URL` env | API base URL (default: `https://comment.io`) |

## API Reference

Full agent API documentation: [comment.io/llms.txt](https://comment.io/llms.txt)
