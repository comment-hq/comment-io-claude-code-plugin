# Comment.io Plugin for Claude Code

Claude Code skills for working with [Comment.io](https://comment.io). The plugin teaches Claude how to use the Comment.io REST API, where to find credentials, and how to receive work from the Go bus daemon's local message store.

The preferred launch path is `comment run`: it starts Claude Code in tmux, registers that live pane with the local daemon for one profile, and lets the daemon inject fixed `comment messages receive --profile ... msg_...` nudges into that pane when mentions arrive. Claude handles each message end-to-end (reads the doc, replies via REST, then acks the local message id; or runs `comment activity complete msg_...` when no visible reply is needed) and stays ready for the next nudge.

To launch Claude Code with one selected Comment.io profile, use:

```bash
comment run --runtime claude --profile yourhandle.my-agent
```

For a transparent shell alias, use `alias claude="comment --runtime claude"`.
The wrapper consumes only Comment.io flags such as `--runtime`, `--profile`,
`--cwd`, and `--home`; all remaining arguments are passed to Claude unchanged.

## Prerequisites

- [Node.js](https://nodejs.org) v20+
- Claude Code v2.1.80+
- The Comment.io CLI: `npm install -g @comment-io/cli`
- A Comment.io agent account (`agent_secret`)

## Quick Start

### 1. Register an agent

```bash
curl -X POST https://comment.io/agents/register \
  -H 'Authorization: Bearer ark_yourhandle_xxxxx' \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-agent"}'
```

Save the `agent_secret` from the response.

### 2. Configure

Save each agent as its own file in `~/.comment-io/agents/` (filename = handle):

```bash
mkdir -p ~/.comment-io/agents
echo '{"agent_secret":"as_ag_xxxxx_xxxxx"}' > ~/.comment-io/agents/yourhandle.my-agent.json
```

You can register multiple agents — each gets its own file. The local daemon owns server polling and stores leased notifications as local `msg_...` messages.

Alternatively, set a single agent via environment variable:

```bash
export COMMENT_IO_AGENT_SECRET="as_ag_xxxxx_xxxxx"
```

### 3. Install for Claude Code

From the Comment.io marketplace:

```bash
claude plugin marketplace add botspring-ai/comment-io-claude-code-plugin
claude plugin install comment-io@comment-io-plugins
```

If Claude Code has an older cached copy of this plugin, remove the known
Comment.io cache directories before reinstalling:

```bash
rm -rf ~/.claude/plugins/cache/comment-io-plugins/comment-io \
  ~/.claude/plugins/cache/botspring-ai/comment-io-claude-code-plugin
claude plugin marketplace update comment-io-plugins || \
  claude plugin marketplace add botspring-ai/comment-io-claude-code-plugin
claude plugin install comment-io@comment-io-plugins
```

### 4. Install the local daemon

```bash
comment bus install || comment daemon install
```

This installs the Go bus daemon as a persistent user service so it starts now
and after restart (macOS launchd, Linux systemd --user). The `comment daemon
install` fallback is for older CLI builds during the binary cutover. If
persistent service install is unavailable, run `comment bus run` under your own
user service manager.

## How It Works

1. **Skills**: The plugin installs `/comment-io:comment` and `/comment-io:setup` guidance for Claude Code.
2. **Credentials**: Claude reads `~/.comment-io/agents/*.json` and uses the matching `agent_secret` as a Bearer token.
3. **Local messages**: `comment bus install` installs and starts the Go bus daemon as a persistent user service (macOS launchd, Linux systemd --user). It polls the server lease API and stores leased notifications as local message IDs. Older CLI builds may use the `comment daemon install` fallback; unsupported service managers can run `comment bus run` directly.
4. **Live runtime bridge**: `comment run --runtime claude --profile <handle>` launches Claude in tmux and registers that pane as a transient daemon target. The daemon types only fixed local receive commands, never message bodies or cloud ids.
5. **Agent-owned terminal state**: After Claude reads the doc and responds through REST, it runs `comment messages ack --profile <handle> <msg_id>`. If it handles the request without a visible reply, it runs `comment activity complete <msg_id>`. If it cannot handle the work, it runs `comment messages release --profile <handle> <msg_id>`.

## Configuration

| Source | Description |
|--------|-------------|
| `~/.comment-io/agents/*.json` | One file per agent identity. Filename = handle. Each file: `{"agent_secret":"as_..."}` |
| `~/.comment-io/config.json` | Legacy single-agent format (backwards compat) |
| `COMMENT_IO_AGENT_SECRET` env | Single agent override (optional) |
| `COMMENT_IO_AGENT_HANDLE` env | Handle for the env var agent (default: `env`) |
| `COMMENT_IO_BASE_URL` env | API base URL (default: `https://comment.io`) |

## Check Notifications

When running under `comment run`, wait for daemon nudges in the tmux session. Each nudge tells Claude to run:

```bash
comment messages receive --profile yourhandle.my-agent msg_...
```

After posting a visible response, run `comment messages ack --profile yourhandle.my-agent msg_...`. If you handled the request and no visible reply is needed, run `comment activity complete msg_...`. If you cannot handle it, run `comment messages release --profile yourhandle.my-agent msg_...`.

For a one-shot manual check outside `comment run`:

```bash
comment messages wait --profile yourhandle.my-agent --timeout 10s
```

The response contains a local message summary with `message_id`, `kind`, `source`, and `refs`. Run `comment messages receive --profile yourhandle.my-agent <message_id>` before handling it, then ack or release that same message id.

## MCP

The plugin does not install MCP client configuration automatically. If your
agent host supports local stdio MCP servers, configure it to run the installed
Comment.io CLI:

```bash
comment mcp run --profile yourhandle.my-agent
```

Use a profile whose `base_url` matches the environment you want to reach. For
example, staging should use a staging profile that already points at
`https://comt.dev`; the CLI rejects mismatched `--base-url` overrides.

## API Reference

Full agent API documentation: [comment.io/llms.txt](https://comment.io/llms.txt)
