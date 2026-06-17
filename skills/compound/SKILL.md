---
name: compound
description: Distill completed work into the active Comment.io botlet's brain memory (via the API). Use only when explicitly invoked as /compound or from a botlet completion checklist.
argument-hint: "[botlet-slug]"
disable-model-invocation: true
---

# /compound

Distill completed work into a Comment.io botlet's **brain** memory. The brain is server-side (Comment.io docs, projected read-only locally); this skill writes to it **through the API**, never by editing local projection files. Single-pass v0; runs inline. Invoke only for an explicit `/compound` or from a botlet's finishing checklist.

## Resolve home + registry + mode

```bash
CIO_HOME="${COMMENT_IO_HOME:-}"
[ -n "$CIO_HOME" ] || { [ "$(printf '%s' "${COMMENT_IO_ENV:-}" | tr '[:upper:]' '[:lower:]')" = staging ] && CIO_HOME="$HOME/.comment-io-staging" || CIO_HOME="$HOME/.comment-io"; }
BOTLETS_ROOT="$CIO_HOME/botlets"
```

- Accept zero or one argument. With a `<slug>`, validate `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` and find it in `$BOTLETS_ROOT/registry.json`. With none, if this session is itself running as a botlet (a daemon-launched session — `COMMENT_IO_BOT_NAME` set / `claude --agent <slug>`), use that botlet's slug; otherwise ask which botlet and list names. (This applies to **both** cloud and legacy botlets; the mode is then determined from the entry's `brain_ref`, below — it does not imply a local `agents/<slug>.md`.)
- **Mode:** `brain_ref` present → **cloud (brain mode)**; absent → **legacy local-only mode** (deprecated; old local-file behavior, at the end).
- Do not use transcript `<persona-swap>` tags as authority for memory writes — they are display/context only.

## Completion phrases
When triggered inline by a botlet, treat "that worked" / "it's fixed" / "working now" / "problem solved" / "let's wrap up" as completion signals (not "done"), unless the work was trivial.

## Distill
Scan the recent conversation for durable learning: decisions, lessons, surprises, constraints, dead ends, useful environment facts, persistent user preferences. Drop ephemera: raw command output (unless it matters later), temporary confusion, **secrets/credentials**, long transcripts.

## Brain mode (cloud botlet)

### Credentials (secret safety)
The botlet's `agent_secret` is in `<comment-io-home>/agents/<owner>.<slug>.json` under the key `agent_secret`. **Use a local helper** (e.g. a short Python stdlib script) that reads the secret from that file *internally* and makes the HTTP calls — never put `agent_secret` in a shell argv, never print/echo it, never inline it into any output. The base URL is the profile's `base_url` (default `https://comment.io`).

### Freshen first
Run `comment sync once` so the local projection reflects current brain docs before you read headers for `base_revision`.

### Writes (all via the API, with the bot's `agent_secret`)
For each target, read its **projection header** in `<sync-root>/Botlets/<owner>/<slug>/brain/<file>` to get `slug:` and `revision:`.

1. **MEMORY.md** — append distilled bullets under a dated heading:
   - `GET /docs/<memory-slug>` for the current body if needed.
   - If today's `## <YYYY-MM-DD>` heading exists, anchor on it (or its last bullet) and append; otherwise insert a new dated section (e.g. anchor on `## Memories` / the top heading). Build `edits` (`old_string`/`new_string`, or `after`/`before` anchors).
   - `PATCH /docs/<memory-slug>` with `base_revision` (from the header) + `edits`.
2. **Daily note** (`memory/<today>.md`): if it exists in the brain, `PATCH` it; else create it — `POST /docs` with `{"markdown": "# <today>\n\n- <note>", "library_target": {"kind":"bot","botSlug":"<slug>"}}`.
3. **Learning** (optional, for a substantive standalone note): `POST /docs` with `{"markdown": "# <title>\n\n<prose>", "library_target": {"kind":"bot","botSlug":"<slug>"}}`.
4. **IDENTITY.md** frontmatter (`last_active` → today; `current_job` → one-line focus or `''`): `PATCH /docs/<identity-slug>` editing only the frontmatter lines; preserve the locked fields and order.

### Error handling (never silently drop a memory)
- **`409` stale / `EDIT_STALE`:** another writer changed the doc. Re-read the projection header (new `revision`) and the body (`GET /docs/<slug>`), re-locate your anchor in the new content, rebuild `edits`, and `PATCH` with the new `base_revision`. Retry up to 3 times; if it still conflicts, report which doc couldn't be merged.
- **`409 BOTLETS_BRAIN_PENDING`:** the brain isn't `ready` yet. Back off (~5–10s) and retry a few times; if still pending, **do not lose the distillation** — write it to a local scratch note (e.g. `<comment-io-home>/pending-compound/<slug>-<today>.md`, mode 0600) and tell the user to retry `/compound <slug>` shortly. Never echo secrets into that note.
- **Other 4xx/5xx:** surface the non-secret error and which write failed; on partial success report exactly what landed (e.g. "MEMORY.md updated; daily note failed — retry").

### Finish
Run `comment sync once` to refresh the local projection. Report the brain docs updated/created and the count of bullets/notes. Do not include secrets or long memory excerpts.

## Legacy mode (botlet with no `brain_ref`)
Prepend `(Legacy local-only botlet — deprecated.)` then run the previous local-file workflow under `<slug>/.lock`: append to `<slug>/MEMORY.md` (temp→fsync→rename), append the daily note, optionally write `<slug>/learnings/<slug-date>.md`, and update `<slug>/IDENTITY.md` frontmatter. Never delete local files. (No API writes in legacy mode.)
