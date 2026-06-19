# Comment.io Plugin for Claude Code

Claude Code skills for working with [Comment.io](https://comment.io). The plugin teaches Claude how to use the Comment.io REST API, where to find credentials, and how to receive work from the Go bus daemon's local message store.

The preferred launch path is `comment run`: it starts Claude Code in tmux, registers that live session with the local daemon for one profile, and lets the daemon inject fixed `comment messages receive --profile ... msg_...` nudges into that session when mentions arrive. Claude handles each message end-to-end (reads the doc, replies via REST, then acks the local message id; or runs `comment activity complete msg_...` when no visible reply is needed) and stays ready for the next nudge.

To launch Claude Code with one selected Comment.io profile, use:

```bash
comment run --runtime claude --profile yourhandle.my-agent
```

For a transparent shell alias, use `alias claude="comment --runtime claude"`.
The wrapper consumes only Comment.io flags such as `--runtime`, `--profile`,
`--cwd`, and `--home`; all remaining arguments are passed to Claude unchanged.

## Prerequisites

- [Node.js](https://nodejs.org) v20+ (the no-daemon WebSocket fallback needs a
  global `WebSocket`, i.e. **v21+**; with the daemon running, any v20+ works)
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
claude plugin marketplace add comment-hq/comment-io-claude-code-plugin
claude plugin install comment-io@comment-io-plugins
```

If Claude Code has an older cached copy of this plugin, remove the known
Comment.io cache directories before reinstalling:

```bash
rm -rf ~/.claude/plugins/cache/comment-io-plugins/comment-io \
  ~/.claude/plugins/cache/botspring-ai/comment-io-claude-code-plugin
claude plugin marketplace update comment-io-plugins || \
  claude plugin marketplace add comment-hq/comment-io-claude-code-plugin
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
4. **Live runtime bridge**: `comment run --runtime claude --profile <handle>` launches Claude in tmux and registers that session as a transient daemon target. The daemon types only fixed local receive commands, never message bodies or cloud ids.
5. **Agent-owned terminal state**: After Claude reads the doc and responds through REST, it runs `comment messages ack --profile <handle> <msg_id>`. If it handles the request without a visible reply, it runs `comment activity complete <msg_id>`. If it cannot handle the work, it runs `comment messages release --profile <handle> <msg_id>`.

## Native idle-wake (asyncRewake)

This plugin ships a `Stop` hook (`hooks/hooks.json` → `hooks/comment-rewake-listen`)
that wakes an **idle** Claude session the instant a Comment.io mention arrives —
the native alternative to the daemon typing a nudge into the bmux pane.

It uses Claude Code's `async` + `asyncRewake` hook flags: when the session stops,
the hook runs a listener **in the background** (the session goes fully idle, no
token cost), and when a message arrives the listener **exits 2**, which Claude
Code turns into a model wake-up with the message delivered as context.

### Two ways to attach a session to a handle

- **Bare `claude` + `/comment listen` (headline).** Run `claude` normally, then
  `/comment listen`: it lists your **free** handles, you pick one, it claims the
  handle (refusing daemon-managed ones — those need `comment run`) and binds it to
  this session. From then on, `@mentions` for that handle wake this session. See
  the `listen` skill.
- **`comment run --runtime claude --profile <handle>`.** The daemon launches the
  Claude session for the handle and arms this hook (it injects `COMMENT_IO_LISTEN`).
  While the session is idle and pulling, the daemon skips its tmux keystroke and
  delivers via asyncRewake instead; a busy session (no live waiter) still gets the
  keystroke nudge.
- **`comment listen <handle>` (shortcut launcher).** Execs `claude` with the
  handle preset — same as the bare flow, one step.

### How it stays correct

- **No-op for ordinary sessions.** The hook listens only when an explicit signal
  is present: `COMMENT_IO_PROFILE` plus the daemon session triple
  (`COMMENT_IO_SESSION_ID` + `COMMENT_IO_SESSION_GENERATION`) for a cold-started
  managed session, or `COMMENT_IO_LISTEN` (set by the `comment listen` launcher and
  by a `comment run --runtime claude` runtime), or a `/comment listen` binding file
  keyed by `CLAUDE_CODE_SESSION_ID` (impromptu). Installing the plugin never turns a
  plain Claude session into a listener.
- **One listener per handle.** The daemon enforces a single live claim per handle
  across impromptu and managed sessions (no silent takeover). Reserved/managed
  handles are refused for impromptu attach.
- **Prefers the daemon, falls back to direct WS.** If the bus daemon is healthy
  the hook runs `comment messages wait --rewake --profile <handle>` (full
  lease/ack). With no daemon it holds the notification WebSocket directly
  (`comment-rewake-fallback.mjs`, Node 21+).
- **Singleton + lossless.** One listener per handle at a time; reconnects across
  idle drops and reconciles the server inbox so nothing is missed.
- After waking, handle the message and `comment messages ack --profile <handle> <id>`
  (or `release` on failure). The next stop re-arms the listener.

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

If `comment messages receive` returns `replay_skipped: true`, the notification was already settled; do not respond, ack, release, or complete it. If it returns `replay_protection.key`, send it as the `Idempotency-Key` on the visible `POST /docs/{slug}/comments` response. After posting a visible response, run `comment messages ack --profile yourhandle.my-agent msg_...`. If you handled the request and no visible reply is needed, run `comment activity complete msg_...`. If you cannot handle it, run `comment messages release --profile yourhandle.my-agent msg_...`.

For a one-shot manual check outside `comment run`:

```bash
comment messages wait --profile yourhandle.my-agent --timeout 10s
```

The response contains a local message summary with `message_id`, `kind`, `source`, and `refs`. Run `comment messages receive --profile yourhandle.my-agent <message_id>` before handling it; if receive reports `replay_skipped`, stop, otherwise handle it and ack or release that same message id.

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

## Botlets

A **botlet** is a Comment.io server bot whose **identity and memory live in a "brain"** — a small
set of Comment.io library docs, projected **read-only** to this machine and edited through the API.
There is one botlet model: the same botlet behaves the same whether the daemon runs it on this
machine or it runs in the cloud. The plugin adds three skills that all operate on this one
brain-based botlet:

- **`/setup-botlet`** creates a cloud botlet (server bot + brain) via `comment botlets setup`. It
  does **not** install a host daemon or start sessions — *where* the botlet runs is your daemon
  setup's concern (e.g. an agent-sandbox container).
- **`/talk-to <slug>`** loads the botlet's persona into the current conversation from its brain
  projection (a main-thread persona swap — start a new conversation to leave it).
- **`/compound [slug]`** distills completed work into the botlet's brain **through the Comment.io
  API** (the local projection is read-only).

(The older `/setup-botlet` created a divergent *local-only-Markdown* botlet — a Claude Code subagent
+ local files, no brain. Those legacy botlets still load/run as plain agents; `/talk-to` and
`/compound` keep a deprecated local-file fallback for them, but the skills no longer create them.)

### The brain

A botlet's identity + memory are Comment.io docs (`AGENTS.md` — the trusted persona — plus
`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `HEARTBEAT.md`, `TOOLS.md`, `BOOTSTRAP.md`, and
`memory/YYYY-MM-DD.md`). They project **read-only** to `<sync-root>/Botlets/<owner>/<slug>/brain/`
(each file has a `<!-- comment.io:projection … slug: … revision: … -->` header). Every doc except
`AGENTS.md` is untrusted reference data.

Write to the brain through the API (never edit the read-only projection files):

```bash
# update an existing brain doc (read the projection header for slug + revision):
PATCH /docs/<slug>            { "base_revision": <rev>, "edits": [...] }
# add a new brain doc (botSlug is required; the bot's agent_secret authorizes its own brain):
POST  /docs                   { "markdown": "...", "library_target": {"kind":"bot","botSlug":"<slug>"} }
# retire a doc (e.g. BOOTSTRAP.md after onboarding):
POST  /docs/<slug>/archive
comment sync once             # refresh the local projection after a write
```

### Setup prerequisites

`/setup-botlet` wraps `comment botlets setup`, which needs `comment sync login` first (so the brain
can sync to this machine) and one browser device-code approval. It installs the botlet's per-bot
credential profile at `<comment-io-home>/agents/<owner>.<slug>.json` (mode `0600`) with its
`agent_secret`. Skills read that secret via a local helper for API calls and never print `ark_` /
`agent_secret` values.

### Running + delivery

A botlet is a `bots[]` entry in `<botlets-root>/registry.json` with a `brain_ref` and
`managed_session`. Whichever daemon is paired for your account enrolls and runs it (the
agent-sandbox model runs botlets in a container); `@mentions` and scheduled `botlets.task` runs reach
it through the bus. The plugin's two Stop hooks are complementary: `comment-rewake-listen`
(async/asyncRewake) wakes an **idle** session on a **new** mention, while `comment-check-inbox`
(synchronous, no-op outside managed sessions) drains a message **already** queued whose tmux nudge
was missed — the inbox check is read-only and only surfaces un-nudged messages, so they don't
double-deliver. `/talk-to` is a manual persona swap and is **not** daemon-managed.

## API Reference

Full agent API documentation: [comment.io/llms.txt](https://comment.io/llms.txt)
