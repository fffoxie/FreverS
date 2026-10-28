const $ = (id) => document.getElementById(id);
const LS_API = 'frevers.api';
const LS_TOKEN = 'frevers.token';

const state = {
  apiBase: '',
  token: '',
  data: null,
  build: null,
  poll: null
};

function defaultApiBase() {
  const query = new URLSearchParams(location.search).get('api');
  if (query) return query.replace(/\/+$/, '');
  const saved = localStorage.getItem(LS_API);
  if (saved) return saved;
  if (location.protocol === 'http:') return location.origin.replace(/\/+$/, '');
  return 'http://127.0.0.1:8080';
}

function setConn(ok, label) {
  $('connDot').className = `dot ${ok ? 'ok' : 'bad'}`;
  $('connLabel').textContent = label;
}

function showError(message) {
  $('loginError').textContent = message || '';
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  const response = await fetch(`${state.apiBase}${path}`, { ...options, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) {
    throw new Error((body && (body.error || body.error_description)) || `HTTP ${response.status}`);
  }
  return body;
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function escapeAttr(value) { return escapeHtml(value); }

async function loadState() {
  const data = await api('/admin/api/state');
  state.data = data;
  render();
}

function render() {
  const data = state.data;
  if (!data) return;
  $('statUsers').textContent = data.users.length;
  $('statAssets').textContent = data.assets.length;
  $('statBuilds').textContent = data.builds.length;
  $('statSource').textContent = data.source && !data.source.missing ? fmtBytes(data.source.size) : 'missing';
  $('srvUrl').textContent = data.server.publicBaseUrl;
  $('srvVersion').textContent = data.server.version;
  $('srvMax').textContent = `${data.server.maxBaseUrlLength} characters`;
  $('srvOfficial').textContent = data.server.officialGroupId;
  $('footerUrl').textContent = state.apiBase;
  $('setupUrl').textContent = `${state.apiBase}/admin`;
  if (!$('buildBaseUrl').value) $('buildBaseUrl').value = data.server.publicBaseUrl;
  $('buildHint').textContent =
    `Maximum ${data.server.maxBaseUrlLength} characters. Short is better: http://127.0.0.1:8080 ` +
    'or http://phone:8080. A LAN IPv4 such as http://192.168.1.42:8080 fits.';
  renderSource();
  renderUsers();
  renderAssets();
  renderBuilds();
}

function renderSource() {
  const source = state.data.source;
  const box = $('sourceBox');
  if (!source || source.missing) {
    box.className = 'notice warn';
    box.textContent = `No original APK uploaded. Upload Frever 4.0.5 below (about 217 MB) or place it at ${source.path}`;
    $('buildBtn').disabled = true;
  } else {
    box.className = 'notice ok';
    box.textContent = `Source APK ready: ${source.path} (${fmtBytes(source.size)})`;
    $('buildBtn').disabled = false;
  }
}

function renderUsers() {
  const avatars = state.data.assets.filter((asset) => asset.type === 'avatar');
  const rows = state.data.users.map((user) => {
    const premiumDays = user.premiumUntil
      ? Math.max(0, Math.ceil((new Date(user.premiumUntil) - Date.now()) / 86400000))
      : 0;
    const options = ['<option value="">— none —</option>']
      .concat(avatars.map((asset) =>
        `<option value="${asset.id}" ${asset.id === user.avatarAssetId ? 'selected' : ''}>${escapeHtml(asset.name)}</option>`
      ))
      .join('');
    return `<tr data-user="${user.id}">
      <td>#${user.id}</td>
      <td><input type="text" data-field="nickname" value="${escapeAttr(user.nickname)}"></td>
      <td>${escapeHtml(user.username)}</td>
      <td><input type="number" min="0" data-field="softCurrency" value="${user.softCurrency}"></td>
      <td><input type="number" min="0" data-field="hardCurrency" value="${user.hardCurrency}"></td>
      <td><input type="number" min="0" data-field="premiumDays" value="${premiumDays}"></td>
      <td><input type="checkbox" data-field="isAdmin" ${user.isAdmin ? 'checked' : ''}></td>
      <td><select data-field="avatarAssetId">${options}</select></td>
      <td><button data-apply="${user.id}">Save</button></td>
    </tr>`;
  }).join('');
  $('usersTable').innerHTML = `<table>
    <thead><tr><th>ID</th><th>Nickname</th><th>Login</th><th>Soft</th><th>Hard</th>
      <th>Premium days</th><th>Admin</th><th>Avatar</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  document.querySelectorAll('[data-apply]').forEach((button) => {
    button.addEventListener('click', () => saveUser(Number(button.dataset.apply), button));
  });

function renderAssets() {
  if (state.data.assets.length === 0) {
    $('assetsTable').innerHTML = '<p class="muted">No uploads yet.</p>';
    return;
  }
  $('assetsTable').innerHTML = `<table>
    <thead><tr><th>ID</th><th>Type</th><th>Name</th><th>Size</th><th>Link</th><th></th></tr></thead>
    <tbody>${state.data.assets.map((asset) => `<tr>
      <td>${asset.id}</td><td>${asset.type}</td><td>${escapeHtml(asset.name)}</td>
      <td>${fmtBytes(asset.size)}</td>
      <td><a href="${state.apiBase}${asset.url}" target="_blank" rel="noreferrer">open</a></td>
      <td><button class="danger" data-del="${asset.id}">Delete</button></td>
    </tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-del]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this asset?')) return;
      try {
        await api(`/admin/api/assets/${button.dataset.del}`, { method: 'DELETE' });
        await loadState();
      } catch (error) { alert(error.message); }
    });
  });
}

async function saveUser(id, button) {
  const row = document.querySelector(`tr[data-user="${id}"]`);
  const value = (field) => row.querySelector(`[data-field="${field}"]`);
  const avatar = value('avatarAssetId').value;
  button.disabled = true;
  try {
    await api(`/admin/api/users/${id}`, {
      method: 'PATCH',
      json: {
        nickname: value('nickname').value,
        softCurrency: Number(value('softCurrency').value),
        hardCurrency: Number(value('hardCurrency').value),
        premiumDays: Number(value('premiumDays').value),
        isAdmin: value('isAdmin').checked,
        avatarAssetId: avatar ? Number(avatar) : null
      }
    });
    await loadState();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function uploadAsset() {
  const file = $('assetFile').files[0];
  if (!file) return setMessage('assetMsg', 'Choose a file first.');
  const type = $('assetType').value;
  const name = $('assetName').value.trim() || file.name;
  $('assetUploadBtn').disabled = true;
  setMessage('assetMsg', `Uploading ${file.name} (${fmtBytes(file.size)})...`);
  try {
    await api(`/admin/api/assets?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file
    });
    $('assetFile').value = '';
    $('assetName').value = '';
    setMessage('assetMsg', 'Uploaded.');
    await loadState();
  } catch (error) {
    setMessage('assetMsg', `Upload failed: ${error.message}`);
  } finally {
    $('assetUploadBtn').disabled = false;
  }
}

async function uploadApk() {
  const file = $('apkFile').files[0];
  if (!file) return setMessage('apkMsg', 'Choose the original APK first.');
  $('apkUploadBtn').disabled = true;
  setMessage('apkMsg', `Uploading ${file.name} (${fmtBytes(file.size)}). Keep the screen on...`);
  try {
    await api('/admin/api/apk', {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/vnd.android.package-archive' },
      body: file
    });
    setMessage('apkMsg', 'Original APK stored on the phone.');
    $('apkFile').value = '';
    await loadState();
  } catch (error) {
    setMessage('apkMsg', `Upload failed: ${error.message}`);
  } finally {
    $('apkUploadBtn').disabled = false;
  }
}

function setMessage(id, message) {
  $(id).textContent = message || '';
}

function renderBuilds() {
  const builds = state.data.builds || [];
  if (builds.length === 0) return;
  if (!state.build && builds[0]) state.build = builds[0];
  if (state.build) renderBuild(state.build);
}

function renderBuild(build) {
  $('buildProgress').hidden = false;
  $('buildBar').style.width = `${build.progress || 0}%`;
  $('buildLog').textContent = (build.log || []).map((entry) => `[${entry.at.slice(11, 19)}] ${entry.message}`).join('\n');
  $('buildLog').scrollTop = $('buildLog').scrollHeight;
  const result = $('buildResult');
  if (build.status === 'succeeded') {
    result.hidden = false;
    result.className = 'notice ok';
    result.innerHTML = `Patched APK ready (${fmtBytes(build.report?.outputBytes || 0)}). ` +
      `<a href="${state.apiBase}/admin/api/build/${build.id}/download?access_token=${encodeURIComponent(state.token)}">Download APK</a>`;
  } else if (build.status === 'failed') {
    result.hidden = false;
    result.className = 'notice warn';
    result.textContent = `Build failed: ${build.error}`;
  } else {
    result.hidden = true;
  }
}

async function startBuild() {
  const baseUrl = $('buildBaseUrl').value.trim();
  $('buildBtn').disabled = true;
  $('buildResult').hidden = true;
  try {
    const response = await api('/admin/api/build', { method: 'POST', json: { baseUrl } });
    state.build = { id: response.job.id, status: 'queued', progress: 0, log: [] };
    setMessage('apkMsg', '');
    pollBuild(response.job.id);
  } catch (error) {
    setMessage('apkMsg', `Build failed: ${error.message}`);
    $('buildBtn').disabled = false;
  }
}

async function pollBuild(id) {
  clearTimeout(state.poll);
  try {
    const response = await api(`/admin/api/build/${id}`);
    state.build = response.build;
    renderBuild(state.build);
    if (state.build.status === 'succeeded' || state.build.status === 'failed') {
      $('buildBtn').disabled = false;
      await loadState();
      return;
    }
  } catch (error) {
    setMessage('apkMsg', `Cannot read build: ${error.message}`);
  }
  state.poll = setTimeout(() => pollBuild(id), 1000);
}


function showApp() {
  $('loginView').hidden = true;
  $('appView').hidden = false;
  setConn(true, `connected · ${state.apiBase}`);
}

function showLogin(message) {
  $('loginView').hidden = false;
  $('appView').hidden = true;
  setConn(false, message || 'not connected');
  showError(message || '');
}

function normalizeBase(value) {
  let url = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

async function doLogin() {
  state.apiBase = normalizeBase($('apiBase').value || defaultApiBase());
  state.token = '';
  localStorage.setItem(LS_API, state.apiBase);
  showError('');
  $('loginBtn').disabled = true;
  try {
    const response = await api('/admin/api/login', {
      method: 'POST',
      json: { username: $('loginUser').value.trim(), password: $('loginPass').value }
    });
    state.token = response.token;
    localStorage.setItem(LS_TOKEN, state.token);
    localStorage.setItem(LS_API, state.apiBase);
    $('loginPass').value = '';
    showApp();
    await loadState();
  } catch (error) {
    state.token = '';
    showLogin(error.message);
  } finally {
    $('loginBtn').disabled = false;
  }
}

async function useToken() {
  state.apiBase = normalizeBase($('apiBase').value || defaultApiBase());
  state.token = $('adminToken').value.trim();
  if (!state.token) return showError('Enter an admin token first.');
  localStorage.setItem(LS_API, state.apiBase);
  localStorage.setItem(LS_TOKEN, state.token);
  try {
    await loadState();
    showApp();
  } catch (error) {
    state.token = '';
    localStorage.removeItem(LS_TOKEN);
    showLogin(error.message);
  }
}

function selectTab(name) {
  document.querySelectorAll('.tabs button[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

function bind() {
  $('apiBase').value = defaultApiBase();
  $('loginBtn').addEventListener('click', doLogin);
  $('loginPass').addEventListener('keydown', (event) => { if (event.key === 'Enter') doLogin(); });
  $('tokenBtn').addEventListener('click', useToken);
  $('logoutBtn').addEventListener('click', () => {
    state.token = '';
    localStorage.removeItem(LS_TOKEN);
    clearTimeout(state.poll);
    showLogin();
  });
  document.querySelectorAll('.tabs button[data-tab]').forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
  });
  $('assetUploadBtn').addEventListener('click', uploadAsset);
  $('apkUploadBtn').addEventListener('click', uploadApk);
  $('buildBtn').addEventListener('click', startBuild);
}

async function init() {
  bind();
  state.apiBase = defaultApiBase();
  const token = localStorage.getItem(LS_TOKEN);
  if (token) {
    state.token = token;
    try {
      await loadState();
      showApp();
      return;
    } catch (error) {
      state.token = '';
      localStorage.removeItem(LS_TOKEN);
      showLogin(`Saved session failed: ${error.message}`);
      return;
    }
  }
  showLogin();
}

init();

}
