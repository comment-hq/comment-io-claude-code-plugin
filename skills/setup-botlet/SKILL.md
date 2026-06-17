---
name: setup-botlet
description: Create a new Comment.io botlet (cloud-first — a server bot with a synced "brain"). Use only when explicitly invoked as /setup-botlet.
argument-hint: ""
disable-model-invocation: true
---

# /setup-botlet

Create one Comment.io **botlet** end to end. Do not invoke this skill from normal prose; run it only for an explicit `/setup-botlet`.

A botlet is a server bot whose **identity and memory live in a Comment.io "brain"** — a small set of library docs (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `HEARTBEAT.md`, `TOOLS.md`, plus `memory/`), projected **read-only** to this machine and edited through the Comment.io API. The same botlet behaves the same whether the daemon runs it on this machine or it runs in the cloud. This skill **creates** the botlet and ensures its brain; **where it runs** is owned by your daemon/runtime setup (this skill does not install a host daemon or start sessions).

This is the cloud-first replacement for the older local-only-Markdown botlet. The lightweight `/comment-io:setup` skill only mints an agent profile and installs the daemon.

## Hard Rules

- Reject non-empty `$ARGUMENTS`.
- Product language is "botlet". Use "agent" only for literal implementation contracts (`agent_secret`, registration endpoints, daemon profile filenames).
- Botlet slugs must match `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` and must not be `default` (reserved) or `agents`.
- Never ask the user to paste a secret into chat; never print, summarize, or expose `ark_`/`agent_secret`/`completion_token` values.
- The brain is the source of truth. Do **not** write local memory/persona files for the botlet — `comment botlets setup` provisions the brain server-side and the daemon projects it read-only.
- Do **not** install a host daemon (`comment bus install`) or start host sessions here — that can spawn a second daemon competing for the botlet. Leave daemon placement / execution to the user's existing setup.
- Treat the installed plugin as read-only.

## Comment.io home (for state resolution only)

Resolve the Comment.io home the same way the daemon and the `listen` skill do (the CLI owns the botlets registry; you only need this for status/projection lookups):

```bash
CIO_HOME="${COMMENT_IO_HOME:-}"
[ -n "$CIO_HOME" ] || { [ "$(printf '%s' "${COMMENT_IO_ENV:-}" | tr '[:upper:]' '[:lower:]')" = staging ] && CIO_HOME="$HOME/.comment-io-staging" || CIO_HOME="$HOME/.comment-io"; }
BOTLETS_ROOT="$CIO_HOME/botlets"
```

## Phase 0 — Preflight

1. Confirm `$ARGUMENTS` is empty. If not, stop with: `/setup-botlet` accepts no arguments.
2. **Sync must be configured** — `comment botlets setup` fails closed otherwise (it needs library sync to read/project the brain). Check it without parsing secrets, e.g. `comment sync status --json` (or `comment doctor`). If sync is **not** configured, stop and tell the user to sign in first:

   ```bash
   comment sync login
   ```

   This is the user's browser sign-in; it enables the brain to sync to this machine. After they confirm, re-check and continue.
3. **Daemon (advisory, do not install):** run `comment bus status` / `comment daemon health`. If a daemon is already paired, the botlet enrolls there automatically after creation. If none is paired and the user wants it to run on this machine, mention `comment daemon pair` (one browser approval) as a separate step — but **do not** run `comment bus install` yourself.

## Phase 1 — Interview

Ask in ordinary chat:

- **Owner handle** (the Comment.io account handle, e.g. `max`). The botlet's handle becomes `<owner>.<slug>`.
- **Slug** (short name). Validate `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`; reject `default`/`agents`. If invalid, explain and re-ask.
- **Runtime** (`claude` or `codex`). **Default to the runtime you are currently running under** (Claude Code → `claude`); confirm if the user wants the other.
- Optional one-line role/personality (only seeds the bot's first-run conversation; the brain's `BOOTSTRAP.md` drives onboarding).

Confirm a one-paragraph summary (`Yes` / `Refine` / `Cancel`). On `Cancel`, abort with no side effects.

## Phase 2 — Create the botlet (cloud)

Run the create command. It provisions the server bot, the brain (library workspace/container/folder + starter docs), installs the credential profile locally, and reloads the daemon if one is paired:

```bash
comment botlets setup --bot "<owner>.<slug>" --runtime "<runtime>" --home "$CIO_HOME" --botlets-home "$BOTLETS_ROOT" --json
```

- The CLI prints a **browser approval URL** (`…/setup/botlets?code=<USER_CODE>`). Tell the user to open it and approve **within ~10 minutes**, or the code expires.
- Do not echo any secret from the output.
- **Handle failures explicitly:**
  - *Sync not configured* → loop back to Phase 0 step 2 (`comment sync login`).
  - *Code expired (410 / "expired")* → tell the user it timed out; rerun this skill to get a fresh code.
  - *No owner Botlets setup / first botlet* → the account may need its Botlets/default-bot bootstrapped (a current gap, tracked in #989). Tell the user to open the Comment.io web app once (which provisions the default Botlet) and retry, and surface the server's error message.
  - *Other 4xx/5xx or network error* → surface the non-secret error and suggest `comment sync status` / `comment botlets status` to diagnose.

## Phase 3 — Verify

1. Parse the `--json` result. Treat as success only if it reports `ok: true` **and** carries a brain (`brain_ref`/`brain_path`/`brain_relative_path` + `setup_generation`) **and** a registry path. If the brain fields are missing, treat the setup as **incomplete** and guide diagnostics (`comment botlets status`) rather than reporting success.
2. **Confirm the brain projected locally.** The brain lives at `<sync-root>/Botlets/<owner>/<slug>/brain/` (sync root from `comment sync`; the `--json` output also gives `brain_path`). If the projection isn't there yet (sync lags 5–30s after approval), run `comment sync once` and re-check before declaring done.

## Phase 4 — Done message

Use this shape (fill in):

```text
✓ Botlet "<owner>.<slug>" created.

Identity + memory live in its brain (Comment.io docs), projected read-only at:
  <brain_path>
The brain is the botlet's persona and memory — edit it through Comment.io, never as local files.

Talk to it in this session:    /talk-to <slug>
Distill work into its memory:  /compound <slug>

It runs on whatever daemon is paired for your account (this machine or your container);
this skill did not install a daemon or start a session. If nothing is paired and you want
it to run here, `comment daemon pair` once, or run it via your container per your setup.
```

Do **not** create a local `agents/<slug>.md`, local IDENTITY/SOUL/MEMORY files, or a local registry entry — the CLI owns the registry and the brain is server-side. (Legacy local-only botlets from the old skill keep working; this skill no longer creates them.)
