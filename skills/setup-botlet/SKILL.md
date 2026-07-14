---
name: setup-botlet
description: Create a new Comment.io botlet (cloud-first — a server bot with a synced "brain"). Use only when explicitly invoked as /setup-botlet.
argument-hint: ""
disable-model-invocation: true
---

# /setup-botlet

Create one Comment.io **botlet** end to end. Do not invoke this skill from normal prose; run it only for an explicit `/setup-botlet`.

A botlet is a server bot whose **identity, schedule, and memory live in Comment.io**. Its "brain" is a small set of library docs (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `HEARTBEAT.md`, `TOOLS.md`, plus `memory/`), projected **read-only** to its runtime computer and edited through the Comment.io API. Creating those cloud-side objects does not create an execution runtime: automatic mentions and scheduled work run only while the matching profile is installed on a paired computer, its daemon is online, and the selected Claude or Codex runtime is available and authenticated. Otherwise the work waits. This skill **creates** the botlet and ensures its brain; it does not install a host daemon or start sessions.

This is the cloud-first replacement for the older local-only-Markdown botlet. The general `/comment-io:setup` entry is now a capability router; this explicitly invoked skill owns botlet creation only.

## Hard Rules

- Reject non-empty `$ARGUMENTS`.
- Product language is "botlet". Use "agent" only for literal implementation contracts (`agent_secret`, registration endpoints, daemon profile filenames).
- Botlet slugs must match `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` and must not be `default` (reserved) or `agents`.
- Never ask the user to paste a secret into chat; never print, summarize, or expose `ark_`/`agent_secret`/`completion_token` values.
- The brain is the source of truth. Do **not** write local memory/persona files for the botlet — `comment botlets setup` provisions the brain server-side and the daemon projects it read-only.
- Do **not** install a host daemon (`comment bus install`) or start host sessions here — that can spawn a second daemon competing for the botlet. Leave daemon placement / execution to the user's existing setup.
- Treat the installed plugin as read-only.

## Select one Comment.io origin and saved account

Before running a Comment.io command, resolve one exact `BASE` from the supplied
comm/tool or an explicitly selected profile. If neither exists, use
`https://comment.io`; never infer a staging/custom origin from an unrelated
ambient account. Do not choose a deployment-default home: secondary accounts
have scoped homes and the CLI registry must resolve the selected account.

```bash
# Substitute the exact origin selected by the reasoning step above. Do not
# initialize BASE from COMMENT_IO_BASE_URL or another ambient selector.
BASE="https://comment.io"
BASE="${BASE%/}"
comment_account() {
  env -u NODE_OPTIONS -u COMMENT_IO_ACCOUNT -u COMMENT_IO_HOME -u COMMENT_IO_ENV \
    -u COMMENT_IO_BASE_URL -u COMMENT_IO_STAGING_BASE_URL \
    comment --origin "$BASE" --account "$1" "${@:2}"
}
```

After the owner handle is confirmed, run `comment auth list` and inspect only
rows whose ORIGIN is exactly `$BASE`. The saved account name is the first value
in that row; it is not inferred from `$OWNER`. If there is one row, use its
exact saved name. If there are multiple rows, ask the human which saved account
to use. Verify that exact choice with `comment_account "$ACCOUNT" auth resolve
--json`. Only when there is no saved row for `$BASE`, run the browser-approved
`comment auth login --origin "$BASE" --account "$OWNER"`, capture the final
`Added account NAME` / `Selected account NAME` line, and use that exact `NAME`.
Never turn an ambiguous or otherwise failed resolve into a login. Then use the
saved principal for every stateful command:

```bash
# First run `comment auth list`, filter to the exact $BASE origin, and set
# ACCOUNT to the human-confirmed exact saved name. Use this block only when no
# saved row exists for $BASE:
if [ -z "${ACCOUNT:-}" ]; then
  AUTH_LOG="$(mktemp "${TMPDIR:-/tmp}/comment-auth-login.XXXXXX")"
  trap 'rm -f "$AUTH_LOG"' EXIT
  env -u NODE_OPTIONS -u COMMENT_IO_ACCOUNT -u COMMENT_IO_HOME -u COMMENT_IO_ENV \
    -u COMMENT_IO_BASE_URL -u COMMENT_IO_STAGING_BASE_URL \
    comment auth login --origin "$BASE" --account "$OWNER" | tee "$AUTH_LOG"
  ACCOUNT="$(sed -n 's/^\(Added\|Selected\) account \([^ ]*\) (.*/\2/p' "$AUTH_LOG" | tail -n1)"
  [ -n "$ACCOUNT" ] || { echo "Could not determine the saved Comment.io account name" >&2; exit 1; }
fi
ACCOUNT_JSON="$(comment_account "$ACCOUNT" auth resolve --json)"

comment_selected() {
  env -u NODE_OPTIONS -u COMMENT_IO_ACCOUNT -u COMMENT_IO_HOME -u COMMENT_IO_ENV \
    -u COMMENT_IO_BASE_URL -u COMMENT_IO_STAGING_BASE_URL \
    comment --origin "$BASE" --account "$ACCOUNT" "$@"
}
```

## Phase 0 — Preflight

1. Confirm `$ARGUMENTS` is empty. If not, stop with: `/setup-botlet` accepts no arguments.
2. Ask for and validate the **owner handle** now (the Comment.io account handle,
   e.g. `max`) and set `OWNER="$owner"`. Resolve the exact saved account as
   described above; set `ACCOUNT` to the returned saved name, not blindly to
   the owner handle. The botlet's handle will become `<owner>.<slug>`.
3. **Sync must be configured** — Botlet setup fails closed otherwise (it needs
   library sync to read/project the brain). Check it without parsing secrets
   with `comment_selected sync status --json` (or `comment_selected doctor`).
   If sync is **not** configured, stop and tell the user to sign in first:

   ```bash
   comment_selected sync login --base-url "$BASE"
   ```

   This is the user's browser sign-in; it enables the brain to sync to this machine. After they confirm, re-check and continue.
4. **Daemon (advisory, do not install):** run `comment_selected bus status` /
   `comment_selected daemon health`. If a daemon is already paired, the botlet
   enrolls there automatically after creation. If none is paired and the user
   wants automatic work on this computer, finish creation first, then point
   them to this Comment.io origin's `/llms/setup/full.txt`
   persistent-computer guide. That guide owns the current install and pairing
   flow (`comment bus pair` when the CLI is already installed). **Do not**
   install or start a second daemon from this skill.

## Phase 1 — Interview

Ask in ordinary chat:

- Reuse the **owner handle** confirmed in Phase 0; do not select a different account mid-flow.
- **Slug** (short name). Validate `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`; reject `default`/`agents`. If invalid, explain and re-ask.
- **Runtime** (`claude` or `codex`). **Default to the runtime you are currently running under** (Claude Code → `claude`); confirm if the user wants the other.
- Optional one-line role/personality (only seeds the bot's first-run conversation; the brain's `BOOTSTRAP.md` drives onboarding).

Confirm a one-paragraph summary (`Yes` / `Refine` / `Cancel`). On `Cancel`, abort with no side effects.

## Phase 2 — Create the botlet (cloud)

Run the create command. It provisions the server bot, the brain (library workspace/container/folder + starter docs), installs the credential profile locally, and reloads the daemon if one is paired:

```bash
comment_selected botlets setup --bot "<owner>.<slug>" --runtime "<runtime>" --base-url "$BASE" --json
```

- The CLI prints a **browser approval URL** (`…/setup/botlets?code=<USER_CODE>`). Tell the user to open it and approve **within ~10 minutes**, or the code expires.
- Do not echo any secret from the output.
- **Handle failures explicitly:**
  - *Sync not configured* → loop back to Phase 0 step 3 (`comment_selected sync login --base-url "$BASE"`).
  - *Code expired (410 / "expired")* → tell the user it timed out; rerun this skill to get a fresh code.
  - *No owner Botlets setup / first botlet* → the account may need its Botlets/default-bot bootstrapped (a current gap, tracked in #989). Tell the user to open the Comment.io web app once (which provisions the default Botlet) and retry, and surface the server's error message.
  - *Other 4xx/5xx or network error* → surface the non-secret error and use `comment_selected sync status --json`; after enrollment exists, use `comment_selected botlets status --bot "<owner>.<slug>"`.

## Phase 3 — Verify

1. Parse the `--json` result. Treat as success only if it reports `ok: true` **and** carries a brain (`brain_ref`/`brain_path`/`brain_relative_path` + `setup_generation`) **and** a registry path. If the brain fields are missing, treat the setup as **incomplete** and run `comment_selected botlets status --bot "<owner>.<slug>"` rather than reporting success.
2. **Confirm the brain projected locally.** The brain lives at `<sync-root>/Botlets/<owner>/<slug>/brain/` (sync root from the selected sync status; the `--json` output also gives `brain_path`). If the projection isn't there yet (sync lags 5–30s after approval), run `comment_selected sync once` and re-check before declaring done.

## Phase 4 — Done message

Use this shape (fill in):

```text
✓ Botlet "<owner>.<slug>" created.

Identity + memory live in its brain (Comment.io docs), projected read-only at:
  <brain_path>
The brain is the botlet's persona and memory — edit it through Comment.io, never as local files.

Talk to it in this session:    /talk-to <slug>
Distill work into its memory:  /compound <slug>

Its identity, schedule, and brain are stored in Comment.io. Automatic work executes only when
its matching profile is installed on a paired computer (this machine or your container), that
daemon is online, and its selected Claude/Codex runtime is available and authenticated.
This skill did not install a daemon or start a session. If that execution path is not ready,
follow this Comment.io origin's `/llms/setup/full.txt` persistent-computer guide; work waits meanwhile.
```

Do **not** create a local `agents/<slug>.md`, local IDENTITY/SOUL/MEMORY files, or a local registry entry — the CLI owns the registry and the brain is server-side. (Legacy local-only botlets from the old skill keep working; this skill no longer creates them.)
