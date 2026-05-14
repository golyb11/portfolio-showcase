import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const GREETINGS = [
  'Welcome to the Portfolio Showcase',
  'Full-Stack Developer',
  'Python & Django Expert',
];

const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];
const PRIORITY_COLORS = {
  low: '#8b90b5',
  medium: '#5eb4ff',
  high: '#ffb94a',
  critical: '#ff5c7a',
};

let lastPriorityData = null;
let metricsInterval = null;
let resizeHandler = null;
let typingCancel = false;

export function initDashboard() {
  typingCancel = false;
  renderSkeletons();
  loadStats();
  setupRefreshButton();
  startTypingAnimation();
  startSystemMetricsPolling();

  resizeHandler = debounce(() => {
    if (lastPriorityData) drawPriorityChart(lastPriorityData);
  }, 150);
  window.addEventListener('resize', resizeHandler);
}

export function teardownDashboard() {
  typingCancel = true;
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
}

function renderSkeletons() {
  ['statTotalTasks', 'statCompletedTasks', 'statPendingTasks', 'statTotalUploads', 'statTotalUsers'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<span class="skeleton skeleton--stat"></span>';
      }
    }
  );

  const list = document.getElementById('activityList');
  if (list) {
    list.innerHTML = Array.from({ length: 4 })
      .map(
        () =>
          '<li class="activity-list__item activity-list__item--skeleton"><span class="skeleton skeleton--text"></span><span class="skeleton skeleton--text skeleton--short"></span></li>'
      )
      .join('');
  }
}

async function loadStats() {
  try {
    const response = await api.get('/dashboard/stats/');
    if (response && response.status === 'success' && response.data) {
      populateStats(response.data);
      populateActivity(response.data.recent_activity || []);
      drawPriorityChart(response.data.tasks_by_priority || {});
    } else {
      showEmptyStates('No data available.');
    }
  } catch (error) {
    console.error('[Dashboard] loadStats failed:', error);
    if (error.status === 401) {
      showEmptyStates('Sign in to see dashboard statistics.');
    } else {
      showEmptyStates(error.message || 'Failed to load statistics.');
      showToast({
        type: 'error',
        title: 'Dashboard unavailable',
        message: error.message || 'Could not load statistics',
      });
    }
    drawPriorityChart({});
  }
}

function showEmptyStates(message) {
  ['statTotalTasks', 'statCompletedTasks', 'statPendingTasks', 'statTotalUploads', 'statTotalUsers'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  const list = document.getElementById('activityList');
  if (list) {
    list.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'empty-state';
    const icon = document.createElement('span');
    icon.className = 'empty-state__icon';
    icon.innerHTML = '<svg class="icon icon--lg" aria-hidden="true"><use href="#icon-table"></use></svg>';
    const text = document.createElement('span');
    text.className = 'empty-state__text';
    text.textContent = message;
    li.appendChild(icon);
    li.appendChild(text);
    list.appendChild(li);
  }
}

function populateStats(data) {
  setValue('statTotalTasks', data.total_tasks);
  setValue('statCompletedTasks', data.completed_tasks);
  setValue('statPendingTasks', data.pending_tasks);
  setValue('statTotalUploads', data.total_uploads);
  setValue('statTotalUsers', data.total_users);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val == null ? '—' : String(val);
  el.classList.add('stat-card__value--pulse');
  setTimeout(() => el.classList.remove('stat-card__value--pulse'), 400);
}

function populateActivity(items) {
  const list = document.getElementById('activityList');
  if (!list) return;

  list.innerHTML = '';

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty-state empty-state--inline';
    const icon = document.createElement('span');
    icon.className = 'empty-state__icon';
    icon.innerHTML = '<svg class="icon icon--lg" aria-hidden="true"><use href="#icon-clock"></use></svg>';
    const text = document.createElement('span');
    text.className = 'empty-state__text';
    text.textContent = 'No recent activity';
    li.appendChild(icon);
    li.appendChild(text);
    list.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'activity-list__item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'activity-list__item-title';
    titleSpan.textContent = item.title;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'activity-list__item-meta';

    const badge = document.createElement('span');
    badge.className = `status-badge status-badge--${item.status}`;
    badge.textContent = item.status;
    metaSpan.appendChild(badge);

    const time = document.createElement('span');
    time.className = 'activity-list__item-time';
    time.textContent = ` ${formatTimeAgo(item.updated_at)}`;
    metaSpan.appendChild(time);

    li.appendChild(titleSpan);
    li.appendChild(metaSpan);
    list.appendChild(li);
  });
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function drawPriorityChart(data) {
  lastPriorityData = data;
  const canvas = document.getElementById('priorityChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const rect = parent.getBoundingClientRect();
  const w = Math.max(rect.width, 300);
  const h = 280;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const values = PRIORITY_ORDER.map((p) => Number(data[p]) || 0);
  const maxVal = Math.max(...values, 1);
  const padding = { top: 28, right: 28, bottom: 44, left: 36 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barGap = 24;
  const barCount = values.length;
  const barW = Math.min((chartW - barGap * (barCount - 1)) / barCount, 110);
  const startX = padding.left + (chartW - (barW * barCount + barGap * (barCount - 1))) / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const gridLines = 4;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i += 1) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    const value = Math.round(maxVal - (maxVal / gridLines) * i);
    ctx.fillText(String(value), padding.left - 8, y + 4);
  }

  const allZero = values.every((v) => v === 0);
  if (allZero) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No task data yet', w / 2, h / 2);
    return;
  }

  const startTime = performance.now();
  const duration = 700;

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i += 1) {
      const y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      const value = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.fillText(String(value), padding.left - 8, y + 4);
    }

    values.forEach((val, i) => {
      const targetH = (val / maxVal) * chartH;
      const currentH = targetH * eased;
      const x = startX + i * (barW + barGap);
      const y = padding.top + chartH - currentH;

      const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      const color = PRIORITY_COLORS[PRIORITY_ORDER[i]];
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, `${color}22`);
      ctx.fillStyle = gradient;

      const radius = 8;
      ctx.beginPath();
      if (currentH > radius * 2) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
      } else {
        ctx.rect(x, y, barW, currentH);
      }
      ctx.fill();

      if (progress === 1) {
        ctx.fillStyle = '#f0f3fb';
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(val), x + barW / 2, y - 10);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        PRIORITY_ORDER[i].toUpperCase(),
        x + barW / 2,
        padding.top + chartH + 20
      );
    });

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function startSystemMetricsPolling() {
  loadSystemMetrics();
  if (metricsInterval) clearInterval(metricsInterval);
  metricsInterval = setInterval(loadSystemMetrics, 10000);
}

async function loadSystemMetrics() {
  try {
    const response = await api.get('/system/metrics/');
    if (response && response.status === 'success' && response.data && !response.data.error) {
      updateMetric('cpuBar', 'cpuValue', response.data.cpu_percent, '%');
      updateMetric(
        'memBar',
        'memValue',
        response.data.memory_percent,
        '%',
        response.data.memory_used_mb,
        response.data.memory_total_mb
      );
      updateMetric('diskBar', 'diskValue', response.data.disk_percent, '%');
    }
  } catch (error) {
    if (error.status !== 401) {
      console.warn('[Dashboard] System metrics unavailable:', error.message);
    }
    ['cpuValue', 'memValue', 'diskValue'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.textContent === '—') el.textContent = '—';
    });
  }
}

function updateMetric(barId, valueId, percent, suffix, used, total) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valueId);
  const numericPercent = Number(percent) || 0;
  if (bar) {
    bar.style.width = `${Math.min(numericPercent, 100)}%`;
    const progressbar = bar.closest('[role="progressbar"]');
    if (progressbar) progressbar.setAttribute('aria-valuenow', String(Math.round(numericPercent)));
  }
  if (val) {
    if (used !== undefined && total !== undefined) {
      val.textContent = `${used} / ${total} MB`;
    } else {
      val.textContent = `${Math.round(numericPercent)}${suffix || ''}`;
    }
  }
}

function setupRefreshButton() {
  const btn = document.getElementById('refreshStats');
  if (!btn) return;
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.classList.add('btn--loading');
    renderSkeletons();
    loadStats().finally(() => {
      btn.disabled = false;
      btn.classList.remove('btn--loading');
      showToast({ type: 'info', message: 'Dashboard refreshed', duration: 2000 });
    });
  });
}

function startTypingAnimation() {
  const target = document.getElementById('typingTarget');
  if (!target) return;

  let phraseIdx = 0;
  let charIdx = 0;
  let isDeleting = false;

  function tick() {
    if (typingCancel) return;
    const phrase = GREETINGS[phraseIdx];

    target.textContent = isDeleting
      ? phrase.substring(0, charIdx - 1)
      : phrase.substring(0, charIdx + 1);

    if (isDeleting) charIdx -= 1;
    else charIdx += 1;

    let delay = isDeleting ? 35 : 70;

    if (!isDeleting && charIdx === phrase.length) {
      delay = 2200;
      isDeleting = true;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      phraseIdx = (phraseIdx + 1) % GREETINGS.length;
      delay = 400;
    }

    setTimeout(tick, delay);
  }

  tick();
}

function debounce(fn, wait) {
  let handle;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), wait);
  };
}

export { drawPriorityChart };
