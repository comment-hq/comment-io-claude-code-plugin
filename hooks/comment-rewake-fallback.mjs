// Comment.io asyncRewake fallback listener (no daemon).
//
// Holds the raw notification WebSocket for COMMENT_IO_PROFILE and, on a new
// mention, prints it to stdout and exits 2 — the signal an async+asyncRewake
// Claude Code Stop hook turns into a model wake-up. Reconnects across idle
// drops, keeps the socket warm, and reconciles the server inbox on every connect
// so nothing is lost. Used only when no local daemon is running; the daemon path
// (comment messages wait --rewake) is preferred when available.
//
// Requires a global WebSocket (Node 21+). Exits 0 (no wake) if unavailable.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";

// Handle is resolved by comment-rewake-listen (managed/launcher env or the
// impromptu binding file) and passed in COMMENT_IO_REWAKE_PROFILE.
const profile = process.env.COMMENT_IO_REWAKE_PROFILE || process.env.COMMENT_IO_PROFILE || "";
if (!profile) process.exit(0);
if (typeof WebSocket === "undefined") process.exit(0); // Node < 21: no global WebSocket

const homeDir = process.env.COMMENT_IO_HOME || path.join(os.homedir(), ".comment-io");
const profilePath = path.join(homeDir, "agents", `${profile}.json`);
let conf;
try {
  conf = JSON.parse(fs.readFileSync(profilePath, "utf8"));
} catch {
  process.exit(0); // unknown profile — nothing to listen for
}
const SECRET = conf.agent_secret;
if (!SECRET) process.exit(0);
// Mirror the CLI's environment.DefaultBaseURL: a profile's own base_url wins;
// otherwise the default follows COMMENT_IO_ENV (staging -> comt.dev) and the
// base-url override env vars. Hard-coding production here would point a staging or
// custom-base listener at the wrong deployment and silently never wake.
function defaultBaseURL() {
  const env = (process.env.COMMENT_IO_ENV || "").trim().toLowerCase();
  if (env === "staging") {
    return process.env.COMMENT_IO_STAGING_BASE_URL || process.env.COMMENT_IO_BASE_URL || "https://comt.dev";
  }
  return process.env.COMMENT_IO_BASE_URL || "https://comment.io";
}
const BASE = (conf.base_url || defaultBaseURL()).replace(/\/+$/, "");

const stateDir = path.join(homeDir, "rewake");
try { fs.mkdirSync(stateDir, { recursive: true }); } catch {}

// Honor the same detach contract as the daemon path (cmd/comment stillWantsToListen):
// for an impromptu `/comment listen` session the binding file must still exist AND
// name THIS handle; for a `comment listen <handle>` launcher (token launch-<pid>)
// the launcher process must still be alive. When the signal is gone the user has
// detached (or the launcher exited), so the fallback must stop rather than keep the
// socket/lock and wake a session that no longer owns the handle. An empty listen
// session (managed / `comment run`) has no scoping signal here, so it stays armed.
const LISTEN_SESSION = process.env.COMMENT_IO_LISTEN_SESSION || "";
function stillWantsToListen() {
  if (!LISTEN_SESSION) return true;
  if (LISTEN_SESSION.startsWith("launch-")) {
    const pid = Number.parseInt(LISTEN_SESSION.slice("launch-".length), 10);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === "EPERM"; }
  }
  try {
    return fs.readFileSync(path.join(stateDir, `bind-${LISTEN_SESSION}`), "utf8").trim() === profile;
  } catch { return false; }
}
if (!stillWantsToListen()) process.exit(0);

// The fallback runs only because the daemon was unreachable. If the daemon comes
// back while we are still holding the raw socket, we must yield: the daemon is
// authoritative for single-listener coordination, and continuing would double-wake
// (the daemon could assign this handle to a managed bot or another claimant while
// we also fire on raw notifications). Exiting frees the per-profile lock so the
// next Stop re-arms via the daemon path (which re-claims and coordinates); any
// mention in the gap is queued by the now-up daemon, not lost. Probe by actually
// connecting — the socket FILE may be present but stale (that is one reason the
// hook fell through to this fallback), so file existence is not "daemon is back".
//
// Known best-effort limitation: if the session stays idle after a daemon appears
// mid-session, a free handle is not re-armed until the next turn/Stop. A gapless
// in-process hand-off is not done here because this fallback authenticates with
// the agent secret, not the owner capability, so it cannot listen.claim through
// the daemon itself; a proper WS->daemon hand-off is a focused follow-up.
const DAEMON_SOCK = path.join(homeDir, "daemon.sock");
function exitIfDaemonBack() {
  const c = net.connect(DAEMON_SOCK);
  let settled = false;
  const done = (up) => {
    if (settled) return;
    settled = true;
    try { c.destroy(); } catch {}
    if (up) process.exit(0);
  };
  c.once("connect", () => done(true));
  c.once("error", () => done(false));
  c.setTimeout(1500, () => done(false));
}
// Re-check periodically: stop on detach (binding/launcher gone) or once the daemon
// is reachable again. The interval keeps the process alive alongside the socket;
// that's intended (the fallback is a long-lived idle listener).
setInterval(() => {
  if (!stillWantsToListen()) process.exit(0);
  exitIfDaemonBack();
}, 10000);

// `seen` is IN-MEMORY only (not persisted): it dedupes duplicate frames within a
// single listener's life. Cross-session dedup is the SERVER read-state — reconcile
// surfaces only unread mentions — which is at-least-once like the daemon path: if a
// woken session crashes or fails before the agent marks the notification read, the
// next listener re-surfaces it rather than dropping it. (A persisted seen file
// would mark a mention handled before the agent actually handled it, losing it on
// crash.)
let seen = new Set();

// Include the notification id so the woken agent can mark it read via
// POST /agents/me/notifications/{id}/read after handling — the no-daemon path has
// no `comment messages ack`, and the server read-state is what dedupes across
// reconnects, so an unmarked mention correctly re-surfaces until handled.
const fmt = (n) => ({ id: n.id, doc_slug: n.doc_slug, doc_title: n.doc_title, from_name: n.from_name || n.from_handle, context: n.context, comment_id: n.comment_id });

// Surface any not-yet-seen mention(s) and, if there are any, wake (which exits).
// Shared by the live socket, the catch-up burst, and reconcile() so all three
// dedupe through the same in-memory `seen` set.
function surfaceMentions(items) {
  const fresh = [];
  for (const n of items) {
    if (!n || n.type !== "mention" || !n.id || seen.has(n.id)) continue;
    seen.add(n.id);
    fresh.push(n);
  }
  if (fresh.length) wake(fresh.map(fmt));
}

function wake(mentions) {
  // Re-check the detach signal right before waking: a frame/reconcile response can
  // arrive after the user detached (binding removed / launcher exited) but before
  // the periodic stillWantsToListen() check fires. Do not wake a session that no
  // longer owns the handle — exit cleanly (the mention stays unread server-side and
  // re-surfaces for the rightful listener).
  if (!stillWantsToListen()) process.exit(0);
  // asyncRewake: exit 2 wakes the model with the printed payload. Under the
  // Claude hook stdout is a pipe, where writes are async — write() returning
  // true only means the chunk was buffered, NOT flushed to the pipe, so exiting
  // on it can truncate the JSON. Exit ONLY from the write callback (the real flush
  // signal); the pending callback keeps the event loop alive, and a safety timer
  // still wakes us if it never fires (closed pipe).
  let exited = false;
  const done = () => { if (!exited) { exited = true; process.exit(2); } };
  process.stdout.write(JSON.stringify(mentions) + "\n", done);
  setTimeout(done, 2000);
}

async function reconcile() {
  try {
    const r = await fetch(`${BASE}/agents/me/notifications`, { headers: { Authorization: "Bearer " + SECRET } });
    const d = await r.json();
    const items = Array.isArray(d) ? d : (d.notifications || d.items || []);
    const fresh = [];
    for (const n of items) {
      if (n.type !== "mention" || !n.id || seen.has(n.id)) continue;
      seen.add(n.id);
      // Only surface UNREAD mentions, on every reconcile (not just the first). A
      // mention already marked read was handled elsewhere (the daemon, another
      // client, or a prior run), so reconnecting must not re-wake Claude for it.
      // The seen set dedupes within this process; the read flag dedupes across
      // clients. (REST reconcile is the belt-and-suspenders path; the live socket
      // delivers genuinely new mentions.)
      if (n.read !== true) fresh.push(n);
    }
    if (fresh.length) wake(fresh.map(fmt));
  } catch { /* transient; live socket still covers new mentions */ }
}

let backoff = 1000;
function connect() {
  let ws, ka;
  try {
    // The notifications socket requires Bearer auth in an Authorization header;
    // query-param and subprotocol auth are rejected by the server. Node's global
    // WebSocket (undici, Node 21+) accepts a `headers` option as an extension —
    // this is the only client-side auth path that works against the server.
    ws = new WebSocket(BASE.replace(/^http/, "ws") + "/agents/me/notifications/connect", { headers: { Authorization: "Bearer " + SECRET } });
  } catch { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 15000); return; }
  ws.addEventListener("open", () => {
    backoff = 1000;
    // The notifications DO treats only a JSON {type:"ping"} as a ping (a literal
    // "ping" string is ignored) and answers the FIRST ping with a
    // notification_catchup burst of everything unread — the lossless catch-up for
    // mentions that landed before this socket attached. Send one immediately so
    // catch-up is prompt, then keep pinging to hold the socket open. reconcile()
    // is a REST belt-and-suspenders for the same gap.
    const ping = () => { try { ws.send(JSON.stringify({ type: "ping" })); } catch {} };
    ping();
    ka = setInterval(ping, 25000);
    reconcile();
  });
  ws.addEventListener("message", (ev) => {
    const body = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString();
    let f; try { f = JSON.parse(body); } catch { return; }
    if (f.type === "pong") return;
    if (f.type === "notification_catchup" && Array.isArray(f.notifications)) {
      surfaceMentions(f.notifications);
      return;
    }
    // notification_appended wraps the notification; a bare frame is the notification.
    surfaceMentions([f.notification || f]);
  });
  ws.addEventListener("close", () => { clearInterval(ka); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 15000); });
  ws.addEventListener("error", () => {});
}
connect();
