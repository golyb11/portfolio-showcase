import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const GREETINGS = [
  'Welcome to the Portfolio Showcase',
  'Full-Stack Developer',
  'Python & Django Expert',
];

export function initDashboard() {
  loadStats();
  setupRefreshButton();
  startTypingAnimation();
}

async function loadStats() {
  try {
    const response = await api.get('/dashboard/stats/');
    if (response.status === 'success' && response.data) {
      populateStats(response.data);
      populateActivity(response.data.recent_activity || []);
      drawPriorityChart(response.data.tasks_by_priority || {});
      loadSystemMetrics();
    }
  } catch (error) {
    showToast({ type: 'error', title: 'Error', message: 'Failed to load dashboard stats' });
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
  if (el) {
    el.textContent = val ?? '\u2014';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'pageIn 0.3s ease';
  }
}

function populateActivity(items) {
  const list = document.getElementById('activityList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<li class="empty-state"><span class="empty-state__text">No recent activity</span></li>';
    return;
  }
  list.innerHTML = items.map(item => {
    const statusClass = `status-badge--${item.status}`;
    return `
      <li class="activity-list__item">
        <span class="activity-list__item-title">${escapeText(item.title)}</span>
        <span class="activity-list__item-meta">
          <span class="status-badge ${statusClass}">${item.status}</span>
          ${formatTimeAgo(item.updated_at)}
        </span>
      </li>`;
  }).join('');
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return ' Just now';
  if (mins < 60) return ` ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return ` ${hours}h ago`;
  return ` ${Math.floor(hours / 24)}d ago`;
}

function drawPriorityChart(data) {
  const canvas = document.getElementById('priorityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const priorities = ['low', 'medium', 'high', 'critical'];
  const colors = {
    low: '#6b6f85',
    medium: '#60a5fa',
    high: '#facc15',
    critical: '#f87171',
  };
  const values = priorities.map(p => data[p] || 0);
  const maxVal = Math.max(...values, 1);
  const padding = { top: 20, right: 30, bottom: 40, left: 10 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barGap = 20;
  const barCount = values.length;
  const barW = Math.min((chartW - barGap * (barCount - 1)) / barCount, 120);

  const startX = padding.left + (chartW - (barW * barCount + barGap * (barCount - 1))) / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#252840';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + barW * barCount + barGap * (barCount - 1), y);
    ctx.stroke();

    ctx.fillStyle = '#6b6f85';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / gridLines) * i), startX - 6, y + 4);
  }

  values.forEach((val, i) => {
    const barH = (val / maxVal) * chartH;
    const x = startX + i * (barW + barGap);
    const y = padding.top + chartH - barH;

    const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    gradient.addColorStop(0, colors[priorities[i]]);
    gradient.addColorStop(1, colors[priorities[i]] + '44');
    ctx.fillStyle = gradient;

    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, padding.top + chartH);
    ctx.lineTo(x, padding.top + chartH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();

    ctx.fillStyle = '#e4e6f0';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barW / 2, y - 8);

    ctx.fillStyle = '#a0a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(priorities[i].toUpperCase(), x + barW / 2, padding.top + chartH + 18);
  });
}

async function loadSystemMetrics() {
  try {
    const response = await api.get('/system/metrics/');
    if (response.status === 'success' && response.data && !response.data.error) {
      updateMetric('cpuBar', 'cpuValue', response.data.cpu_percent, '%');
      updateMetric('memBar', 'memValue', response.data.memory_percent, '%', response.data.memory_used_mb, response.data.memory_total_mb);
      updateMetric('diskBar', 'diskValue', response.data.disk_percent, '%');
    }
  } catch {}
}

function updateMetric(barId, valueId, percent, suffix, used, total) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valueId);
  if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
  if (val) {
    if (used !== undefined && total !== undefined) {
      val.textContent = `${used} / ${total} MB`;
    } else {
      val.textContent = `${Math.round(percent)}${suffix || ''}`;
    }
  }
}

function setupRefreshButton() {
  const btn = document.getElementById('refreshStats');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      loadStats().finally(() => {
        btn.disabled = false;
        showToast({ type: 'info', message: 'Dashboard refreshed', duration: 2000 });
      });
    });
  }
}

function startTypingAnimation() {
  const target = document.getElementById('typingTarget');
  if (!target) return;
  let phraseIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let currentPhrase = '';

  function tick() {
    const phrase = GREETINGS[phraseIdx];
    if (isDeleting) {
      currentPhrase = phrase.substring(0, charIdx - 1);
      charIdx--;
    } else {
      currentPhrase = phrase.substring(0, charIdx + 1);
      charIdx++;
    }

    target.textContent = currentPhrase;

    let delay = isDeleting ? 40 : 80;

    if (!isDeleting && charIdx === phrase.length) {
      delay = 2000;
      isDeleting = true;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      phraseIdx = (phraseIdx + 1) % GREETINGS.length;
      delay = 300;
    }

    setTimeout(tick, delay);
  }

  tick();
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('priorityChart');
  if (canvas && canvas.getContext('2d')) {
    drawPriorityChart(typeof lastPriorityData !== 'undefined' ? lastPriorityData : {});
  }
});

let lastPriorityData = null;
const origDrawPriorityChart = drawPriorityChart;
const proxiedDraw = function(data) {
  lastPriorityData = data;
  return origDrawPriorityChart(data);
};
export { proxiedDraw as drawPriorityChart };
