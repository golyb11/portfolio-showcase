import { showToast } from '../components/toast.js';

let socket = null;
let reconnectAttempts = 0;
let maxReconnects = 10;
let reconnectDelay = 1000;
let intentionalClose = false;
let msgCount = 0;

export function initRealtime() {
  connect();
  setupTerminalForm();
}

function connect() {
  if (socket && socket.readyState !== WebSocket.CLOSED) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsURL = `${protocol}//${window.location.host}/ws/chat/general/`;

  updateWSState('connecting');

  try {
    socket = new WebSocket(wsURL);
  } catch (e) {
    updateWSState('disconnected');
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    updateWSState('connected');
    reconnectAttempts = 0;
    reconnectDelay = 1000;
    appendLine({ type: 'connection', content: '[Connection established]', timestamp: new Date().toISOString() });
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch {
      appendLine({ type: 'system', content: event.data, timestamp: new Date().toISOString() });
    }
  });

  socket.addEventListener('close', (event) => {
    updateWSState('disconnected');
    if (!intentionalClose) {
      appendLine({
        type: 'error',
        content: `[Connection closed (${event.code}). Reconnecting...]`,
        timestamp: new Date().toISOString(),
      });
      scheduleReconnect();
    }
  });

  socket.addEventListener('error', () => {
    updateWSState('disconnected');
    appendLine({ type: 'error', content: '[Connection error]', timestamp: new Date().toISOString() });
  });
}

function scheduleReconnect() {
  if (reconnectAttempts >= maxReconnects) {
    appendLine({ type: 'error', content: '[Max reconnection attempts reached]', timestamp: new Date().toISOString() });
    return;
  }
  reconnectAttempts++;
  updateReconnectCount();
  document.getElementById('wsStatusText')?.textContent = `Reconnecting (${reconnectAttempts}/${maxReconnects})`;

  setTimeout(() => {
    connect();
  }, reconnectDelay);

  reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
}

function handleMessage(data) {
  switch (data.type) {
    case 'chat_message':
      appendLine({ type: 'user', author: data.author, content: data.content, timestamp: data.timestamp });
      incrementMsgCount();
      break;

    case 'connection_established':
      appendLine({ type: 'connection', content: data.message, timestamp: data.timestamp });
      break;

    case 'server_status':
      updateServerStatus(data);
      break;

    case 'pong':
      break;

    case 'error':
      appendLine({ type: 'error', content: data.message, timestamp: data.timestamp });
      break;

    default:
      appendLine({ type: 'system', content: JSON.stringify(data), timestamp: new Date().toISOString() });
  }
}

function appendLine({ type, author, content, timestamp }) {
  const output = document.getElementById('terminalOutput');
  if (!output) return;

  const line = document.createElement('div');
  line.className = `terminal-line terminal-line--${type}`;

  const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const prefix = type === 'user' ? `<span style="color:#60a5fa">${escapeHTML(author || 'Anonymous')}</span>` : '';

  line.innerHTML = `<span style="color:#6b6f85">[${time}]</span> ${prefix}${prefix ? ': ' : ''}${escapeHTML(content)}`;

  output.appendChild(line);
  output.scrollTop = output.scrollHeight;

  if (output.children.length > 500) {
    output.removeChild(output.firstElementChild);
  }
}

function updateServerStatus(data) {
  const cpu = document.getElementById('rtCpu');
  const mem = document.getElementById('rtMem');
  const time = document.getElementById('rtTime');
  if (cpu) cpu.textContent = `${data.cpu_percent}%`;
  if (mem) mem.textContent = `${data.memory_percent}% (${data.memory_used_mb} MB)`;
  if (time) time.textContent = new Date(data.timestamp).toLocaleTimeString();
}

function updateWSState(state) {
  const dot = document.querySelector('.ws-dot');
  const text = document.getElementById('wsStatusText');
  if (dot) {
    dot.className = 'ws-dot';
    dot.classList.add(`ws-dot--${state}`);
  }
  if (text) {
    const labels = { connected: 'Connected', disconnected: 'Disconnected', connecting: 'Connecting...' };
    text.textContent = labels[state] || state;
  }
}

function updateReconnectCount() {
  const el = document.getElementById('infoReconnects');
  if (el) el.textContent = reconnectAttempts;
}

function incrementMsgCount() {
  msgCount++;
  const el = document.getElementById('infoMsgCount');
  if (el) el.textContent = msgCount;
}

function setupTerminalForm() {
  const form = document.getElementById('terminalForm');
  const input = document.getElementById('terminalInput');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showToast({ type: 'warning', message: 'Not connected to server' });
      return;
    }

    socket.send(JSON.stringify({
      type: 'chat_message',
      author: 'You',
      content: content,
    }));
    input.value = '';
    input.focus();
  });
}

export function disconnectRealtime() {
  intentionalClose = true;
  if (socket) {
    socket.close(1000, 'User navigated away');
    socket = null;
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
