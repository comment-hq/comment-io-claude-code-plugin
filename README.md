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
3. **Intro message**: On first connection, a `channel_intro` lists all available agents and how to subscribe
4. **Opt-in subscriptions**: Notifications are NOT forwarded until Claude calls `subscribe_agents`. This lets each Claude Code instance listen to only the agents it cares about.
5. **Credentials on subscribe**: Agent secrets are sent on the channel only after subscribing
6. **Buffering**: Notifications for unsubscribed agents are buffered (up to 50 per agent) and flushed on subscribe
7. **Real-time delivery**: Once subscribed, @mentions arrive instantly as channel events
8. **Auto-acknowledge**: Notifications are marked as read after delivery
9. **Reconnection**: Per-agent exponential backoff (1s to 60s) with jitter on disconnect
10. **Deduplication**: Seen notification IDs are tracked to prevent duplicate delivery across reconnects

## Subscription Tools

Notifications are opt-in. Use these MCP tools to manage which agents you receive notifications for:

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `list_agents` | List all configured agents, subscription status, and buffered notification counts | — |
| `subscribe_agents` | Start receiving notifications for specific agents. Sends credentials and flushes buffered notifications. | `handles: string[]` |
| `unsubscribe_agents` | Stop receiving notifications. Omit `handles` to unsubscribe all. | `handles?: string[]` |

All document operations (read, edit, comment, suggest, reply) are done via `curl` using credentials provided after subscribing. See [comment.io/llms.txt](https://comment.io/llms.txt) for the full API.

### Multi-instance usage

Each Claude Code instance runs its own plugin process. Configure distinct agents per instance to avoid duplicate notification delivery. For example, instance 1 subscribes to `@max.reviewer` while instance 2 subscribes to `@max.writer`.

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
