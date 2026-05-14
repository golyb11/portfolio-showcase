import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

let rlCount = 0;
let cooldownTimer = null;
let secondsLeft = 0;

export function initSecurity() {
  setupXSSTest();
  setupRateLimitTest();
  const headersBtn = document.getElementById('loadHeadersBtn');
  if (headersBtn) headersBtn.addEventListener('click', loadSecurityHeaders);
}

function setupXSSTest() {
  const form = document.getElementById('xssForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('xssInput');
    const rawInput = input ? input.value : '';

    try {
      const response = await api.post('/security/xss-test/', { input: rawInput });
      if (response && response.status === 'success' && response.data) {
        displayXSSResult(rawInput, response.data);
      }
    } catch (error) {
      console.error('[Security] XSS test failed:', error);
      showToast({ type: 'error', message: error.message });
    }
  });
}

function displayXSSResult(rawInput, data) {
  const resultBox = document.getElementById('xssResult');
  const rawOutput = document.getElementById('xssRawOutput');
  const safeOutput = document.getElementById('xssSafeOutput');
  const badge = document.getElementById('xssBadge');

  if (resultBox) resultBox.hidden = false;
  if (rawOutput) rawOutput.textContent = rawInput;
  if (safeOutput) safeOutput.textContent = data.sanitized_output;
  if (badge) {
    if (data.was_sanitized) {
      badge.textContent = 'YES — Sanitized';
      badge.className = 'result-box__badge result-box__badge--yes';
    } else {
      badge.textContent = 'NO — Clean input';
      badge.className = 'result-box__badge result-box__badge--no';
    }
  }
}

function setupRateLimitTest() {
  const btn = document.getElementById('rateLimitBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (cooldownTimer) return;
    btn.disabled = true;
    try {
      const response = await api.post('/security/rate-limit-test/', {});
      rlCount += 1;
      updateRlCounter();
      addLogEntry(true, (response && response.data && response.data.message) || 'Request allowed');
    } catch (error) {
      if (error.status === 429) {
        rlCount += 1;
        updateRlCounter();
        addLogEntry(false, `Rate limited: ${error.message}`);
        startCooldown(error.retryAfter || 60);
      } else {
        console.error('[Security] rate limit test failed:', error);
        addLogEntry(false, error.message);
      }
    } finally {
      if (!cooldownTimer) btn.disabled = false;
    }
  });
}

function updateRlCounter() {
  const el = document.getElementById('rlRequestCount');
  if (!el) return;
  el.textContent = String(rlCount);
  if (rlCount >= 5) {
    el.classList.add('counter-value--danger');
  } else {
    el.classList.remove('counter-value--danger');
  }
}

function startCooldown(seconds) {
  const display = document.getElementById('cooldownDisplay');
  const timer = document.getElementById('cooldownTimer');
  const btn = document.getElementById('rateLimitBtn');

  secondsLeft = seconds;
  if (display) display.hidden = false;
  if (timer) timer.textContent = String(secondsLeft);
  if (btn) btn.disabled = true;

  cooldownTimer = setInterval(() => {
    secondsLeft -= 1;
    if (timer) timer.textContent = String(secondsLeft);
    if (secondsLeft <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      if (display) display.hidden = true;
      if (btn) btn.disabled = false;
      rlCount = 0;
      updateRlCounter();
      const rlLog = document.getElementById('rlLog');
      if (rlLog) rlLog.innerHTML = '';
    }
  }, 1000);
}

function addLogEntry(success, message) {
  const log = document.getElementById('rlLog');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `request-log__entry request-log__entry--${success ? 'success' : 'error'}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

async function loadSecurityHeaders() {
  const container = document.getElementById('headersList');
  if (!container) return;
  container.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'headers-placeholder';
  loading.textContent = 'Loading...';
  container.appendChild(loading);

  try {
    const response = await api.get('/security/headers/');
    if (response && response.status === 'success' && response.data) {
      renderHeaders(container, response.data);
    }
  } catch (error) {
    console.error('[Security] loadHeaders failed:', error);
    container.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'headers-placeholder';
    placeholder.textContent = `Failed to load: ${error.message}`;
    container.appendChild(placeholder);
    showToast({ type: 'error', message: 'Failed to load security headers' });
  }
}

function renderHeaders(container, data) {
  const settings = [
    { label: 'DEBUG Mode', value: data.debug_mode ? 'ON (disable in production!)' : 'OFF', ok: !data.debug_mode },
    { label: 'X-Frame-Options', value: data.x_frame_options, ok: data.x_frame_options === 'DENY' },
    { label: 'X-Content-Type-Options', value: data.secure_content_type_nosniff ? 'nosniff' : 'Not set', ok: !!data.secure_content_type_nosniff },
    { label: 'X-XSS-Protection', value: data.secure_browser_xss_filter ? '1; mode=block' : 'Not set', ok: !!data.secure_browser_xss_filter },
    { label: 'Secure SSL Redirect', value: data.secure_ssl_redirect ? 'Yes' : 'No (DEBUG mode)', ok: !!data.secure_ssl_redirect },
    { label: 'Session Cookie Secure', value: data.session_cookie_secure ? 'Yes' : 'No (DEBUG mode)', ok: !!data.session_cookie_secure },
    { label: 'CSRF Cookie Secure', value: data.csrf_cookie_secure ? 'Yes' : 'No (DEBUG mode)', ok: !!data.csrf_cookie_secure },
  ];

  container.innerHTML = '';

  settings.forEach((s) => {
    const dt = document.createElement('dt');
    dt.textContent = s.label;
    const dd = document.createElement('dd');
    dd.textContent = String(s.value);
    dd.classList.add(s.ok ? 'headers-list__value--ok' : 'headers-list__value--warn');
    container.appendChild(dt);
    container.appendChild(dd);
  });

  const headers = data.headers || {};
  Object.entries(headers).forEach(([key, val]) => {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = String(val);
    container.appendChild(dt);
    container.appendChild(dd);
  });
}
