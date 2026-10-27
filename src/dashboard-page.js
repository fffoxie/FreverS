/** Dashboard page: plain HTML/CSS/JS served by the phone, no build step, no remote libraries. */
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FreverS dashboard</title>
<style>
:root { color-scheme: light dark; --fg:#111; --bg:#fff; --muted:#555; --line:#ccc; --ok:#0a7d33; --bad:#b00020; --warn:#8a5a00; }
@media (prefers-color-scheme: dark) { :root { --fg:#eee; --bg:#121212; --muted:#aaa; --line:#333; --ok:#5fd08a; --bad:#ff8080; --warn:#ffcc66; } }
* { box-sizing: border-box; }
body { margin:0; padding:16px; font:16px/1.45 system-ui, sans-serif; color:var(--fg); background:var(--bg); }
h1 { font-size:1.35rem; margin:0 0 4px; }
h2 { font-size:1.05rem; margin:24px 0 8px; }
.muted { color:var(--muted); font-size:.9rem; }
.card { border:1px solid var(--line); border-radius:10px; padding:12px; margin:8px 0; }
.row { display:flex; gap:8px; align-items:baseline; justify-content:space-between; flex-wrap:wrap; }
.status { font-weight:600; }
.status.ok { color:var(--ok); } .status.bad { color:var(--bad); } .status.warn { color:var(--warn); }
code { font:13px/1.4 ui-monospace, monospace; word-break:break-all; background:rgba(127,127,127,.15); padding:2px 4px; border-radius:4px; }
pre { font:12px/1.35 ui-monospace, monospace; overflow:auto; max-height:320px; padding:8px; border:1px solid var(--line); border-radius:8px; white-space:pre-wrap; }
button { font:inherit; padding:12px 16px; min-height:48px; border-radius:8px; border:1px solid var(--line); background:rgba(127,127,127,.12); color:var(--fg); }
button.primary { background:#2a6df4; border-color:#2a6df4; color:#fff; }
button:focus-visible, a:focus-visible, input:focus-visible { outline:3px solid #ffb300; outline-offset:2px; }
input[type=url] { font:inherit; padding:10px; width:100%; border-radius:8px; border:1px solid var(--line); background:transparent; color:var(--fg); }
a { color:inherit; }
ul { margin:0; padding-left:18px; }
li { margin:2px 0; }
</style>
</head>
<body>
<main>
<h1>FreverS</h1>
<div class="muted" id="sub">local-only server for Frever 4.0.5</div>

<h2>Setup checklist</h2>
<div id="checklist" aria-live="polite"></div>

<h2>Server</h2>
<div class="card" id="server">loading…</div>

<h2>Accounts</h2>
<div class="card"><ul id="accounts"></ul><div class="muted">usernames only; passwords are never shown</div></div>

<h2>Coverage</h2>
<div class="card" id="coverage">loading…</div>

<h2>Create PAPK</h2>
<div class="card">
  <label for="papk-url" class="muted">Server address baked into the APK (max 36 chars)</label>
  <input id="papk-url" type="url" inputmode="url" autocomplete="off">
  <div style="margin-top:12px"><button class="primary" id="papk-btn" type="button">Create PAPK</button></div>
  <div id="papk-state" class="muted" style="margin-top:12px" aria-live="polite"></div>
  <pre id="papk-steps" hidden></pre>
</div>

<h2>Last 50 log lines</h2>
<pre id="logs" aria-live="off">loading…</pre>
</main>`;

const script = `<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
let inited = false;

function render(s) {
  $('sub').textContent = 'node ' + s.server.node + ' · port ' + s.server.port + ' · up ' + s.server.uptimeSeconds + 's' +
    (s.lan.length ? ' · LAN ' + s.lan.join(', ') : '');
  $('checklist').innerHTML = s.checklist.map((c) => {
    const state = c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'warn';
    const text = c.ok === true ? 'OK' : c.ok === false ? 'FAILED' : 'NOT RUN';
    return '<div class="card"><div class="row"><span>' + esc(c.label) + '</span><span class="status ' + state + '">' + text + '</span></div>' +
      '<div class="muted">' + esc(c.detail) + '</div><div style="margin-top:6px"><code>' + esc(c.command) + '</code></div></div>';
  }).join('');
  $('server').innerHTML = '<div class="row"><span>running on ' + esc(s.server.host) + ':' + s.server.port + '</span><span class="status ok">UP</span></div>' +
    '<div class="muted">since ' + esc(s.server.startedAt) + '</div>';
  $('accounts').innerHTML = s.accounts.map((a) => '<li>' + esc(a.username) + '</li>').join('') || '<li>(none)</li>';
  const c = s.coverage;
  $('coverage').innerHTML = c.available
    ? '<div class="row"><span>' + c.implemented + ' implemented of ' + c.confirmed + ' confirmed</span><span class="status ok">' + c.percent + '%</span></div>' +
      '<div class="muted">' + c.unknown + ' confirmed endpoints still UNKNOWN (return 404 and are logged)</div>'
    : 'docs/protocol.md not readable';
  $('logs').textContent = s.logs.length ? s.logs.join('\\n') : '(no log lines yet)';
  if (!inited) { $('papk-url').value = s.papk.defaultUrl; inited = true; }
  if (s.papk.state === 'never-run') {
    $('papk-state').textContent = 'not built yet';
    $('papk-steps').hidden = true;
  } else {
    $('papk-state').innerHTML = s.papk.state === 'ok'
      ? '<span class="status ok">built</span> · md5 <code>' + esc(s.papk.md5) + '</code> · ' + s.papk.size + ' bytes' +
        (s.papk.download ? '<div style="margin-top:8px"><a href="' + esc(s.papk.download) + '">download ' + esc(s.papk.output) + '</a></div>' : '')
      : '<span class="status ' + (s.papk.state === 'running' ? 'warn' : 'bad') + '">' + esc(s.papk.state) + '</span>' +
        (s.papk.failedStep ? ' · failed at <code>' + esc(s.papk.failedStep) + '</code>' : '');
    $('papk-steps').hidden = false;
    $('papk-steps').textContent = (s.papk.steps || []).map((x) => x.state.padEnd(7) + ' ' + x.name + ' ' + (x.detail || '')).join('\\n');
  }
}

async function refresh() {
  try {
    const r = await fetch('/dashboard/api/state', { cache: 'no-store' });
    render(await r.json());
  } catch (e) {
    $('server').textContent = 'server unreachable: ' + e.message;
  }
}

$('papk-btn').addEventListener('click', async () => {
  $('papk-btn').disabled = true;
  try {
    const r = await fetch('/dashboard/api/papk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: $('papk-url').value })
    });
    if (!r.ok) $('papk-state').textContent = 'could not start: HTTP ' + r.status;
  } catch (e) {
    $('papk-state').textContent = 'could not start: ' + e.message;
  }
  $('papk-btn').disabled = false;
  refresh();
});

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;

export function renderPage() {
  return `${head}\n${script}`;
}
