import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

let rlCount = 0;
let cooldownTimer = null;
let secondsLeft = 0;

export function initSecurity() {
  setupXSSTest();
  setupRateLimitTest();
  document.getElementById('loadHeadersBtn')?.addEventListener('click', loadSecurityHeaders);
}

function setupXSSTest() {
  const form = document.getElementById('xssForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('xssInput');
    const rawInput = input?.value || '';

    try {
      const response = await api.post('/security/xss-test/', { input: rawInput });
      if (response.status === 'success' && response.data) {
        displayXSSResult(rawInput, response.data);
      }
    } catch (error) {
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
      badge.textContent = 'YES \u2014 Sanitized';
      badge.className = 'result-box__badge result-box__badge--yes';
    } else {
      badge.textContent = 'NO \u2014 Clean input';
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
      rlCount++;
      updateRlCounter();
      addLogEntry(true, response.data?.message || 'Request allowed');
    } catch (error) {
      if (error.status === 429) {
        rlCount++;
        updateRlCounter();
        addLogEntry(false, `Rate limited: ${error.message}`);
        startCooldown(error.retryAfter || 60);
      } else {
        addLogEntry(false, error.message);
      }
    } finally {
      if (!cooldownTimer) btn.disabled = false;
    }
  });
}

function updateRlCounter() {
  const el = document.getElementById('rlRequestCount');
  if (el) {
    el.textContent = rlCount;
    if (rlCount >= 5) {
      el.style.color = 'var(--color-danger)';
    }
  }

  if (rlCount >= 5 && !cooldownTimer) {
    document.getElementById('cooldownDisplay').hidden = false;
  }
}

function startCooldown(seconds) {
  const display = document.getElementById('cooldownDisplay');
  const timer = document.getElementById('cooldownTimer');
  const btn = document.getElementById('rateLimitBtn');

  secondsLeft = seconds;
  if (display) display.hidden = false;
  if (timer) timer.textContent = secondsLeft;
  if (btn) btn.disabled = true;

  cooldownTimer = setInterval(() => {
    secondsLeft--;
    if (timer) timer.textContent = secondsLeft;
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
  container.innerHTML = '<div class="headers-placeholder">Loading...</div>';

  try {
    const response = await api.get('/security/headers/');
    if (response.status === 'success' && response.data) {
      renderHeaders(container, response.data);
    }
  } catch (error) {
    container.innerHTML = `<div class="headers-placeholder">Failed to load: ${escapeHTML(error.message)}</div>`;
    showToast({ type: 'error', message: 'Failed to load security headers' });
  }
}

function renderHeaders(container, data) {
  const settings = [
    { label: 'DEBUG Mode', value: data.debug_mode ? 'ON (disable in production!)' : 'OFF' },
    { label: 'X-Frame-Options', value: data.x_frame_options },
    { label: 'X-Content-Type-Options', value: data.secure_content_type_nosniff ? 'nosniff' : 'Not set' },
    { label: 'X-XSS-Protection', value: data.secure_browser_xss_filter ? '1; mode=block' : 'Not set' },
    { label: 'Secure SSL Redirect', value: data.secure_ssl_redirect ? 'Yes' : 'No (DEBUG mode)' },
    { label: 'Session Cookie Secure', value: data.session_cookie_secure ? 'Yes' : 'No (DEBUG mode)' },
    { label: 'CSRF Cookie Secure', value: data.csrf_cookie_secure ? 'Yes' : 'No (DEBUG mode)' },
  ];

  const headerItems = data.headers || {};
  const headerEntries = Object.entries(headerItems);

  let html = '';
  settings.forEach(s => {
    html += `<dt>${escapeHTML(s.label)}</dt><dd>${escapeHTML(String(s.value))}</dd>`;
  });
  headerEntries.forEach(([key, val]) => {
    html += `<dt>${escapeHTML(key)}</dt><dd>${escapeHTML(String(val))}</dd>`;
  });

  container.innerHTML = html;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
