import { showToast } from '../components/toast.js';

let socket = null;
let reconnectAttempts = 0;
const maxReconnects = 10;
let reconnectDelay = 1000;
let intentionalClose = false;
let msgCount = 0;
let reconnectHandle = null;
let pingHandle = null;

export function initRealtime() {
  intentionalClose = false;
  reconnectAttempts = 0;
  msgCount = 0;
  reconnectDelay = 1000;
  setupTerminalForm();
  connect();
}

function getWsUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws/chat/general/`;
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = getWsUrl();
  updateWSState('connecting', 'Connecting...');

  try {
    socket = new WebSocket(wsUrl);
  } catch (e) {
    console.error('[Realtime] WebSocket constructor failed:', e);
    updateWSState('disconnected', 'Disconnected');
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', handleOpen);
  socket.addEventListener('message', handleSocketMessage);
  socket.addEventListener('close', handleClose);
  socket.addEventListener('error', handleError);
}

function handleOpen() {
  updateWSState('connected', 'Connected');
  reconnectAttempts = 0;
  reconnectDelay = 1000;
  updateReconnectCount();
  appendLine({
    type: 'connection',
    content: '[Connection established]',
    timestamp: new Date().toISOString(),
  });

  if (pingHandle) clearInterval(pingHandle);
  pingHandle = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch (err) {
        console.warn('[Realtime] Ping failed:', err);
      }
    }
  }, 30000);
}

function handleSocketMessage(event) {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch {
    appendLine({
      type: 'system',
      content: String(event.data),
      timestamp: new Date().toISOString(),
    });
    return;
  }
  handleMessage(data);
}

function handleClose(event) {
  if (pingHandle) {
    clearInterval(pingHandle);
    pingHandle = null;
  }
  updateWSState('disconnected', 'Disconnected');
  if (intentionalClose) return;

  appendLine({
    type: 'error',
    content: `[Connection closed (${event.code}). Reconnecting...]`,
    timestamp: new Date().toISOString(),
  });
  scheduleReconnect();
}

function handleError(e) {
  console.error('[Realtime] WebSocket error:', e);
  updateWSState('disconnected', 'Disconnected');
  appendLine({
    type: 'error',
    content: '[Connection error]',
    timestamp: new Date().toISOString(),
  });
}

function scheduleReconnect() {
  if (intentionalClose) return;
  if (reconnectAttempts >= maxReconnects) {
    appendLine({
      type: 'error',
      content: '[Max reconnection attempts reached]',
      timestamp: new Date().toISOString(),
    });
    updateWSState('disconnected', 'Disconnected (max retries)');
    return;
  }
  reconnectAttempts += 1;
  updateReconnectCount();
  updateWSState('connecting', `Reconnecting (${reconnectAttempts}/${maxReconnects})`);

  if (reconnectHandle) clearTimeout(reconnectHandle);
  reconnectHandle = setTimeout(() => {
    reconnectHandle = null;
    connect();
  }, reconnectDelay);

  reconnectDelay = Math.min(reconnectDelay * 1.6, 30000);
}

function handleMessage(data) {
  switch (data.type) {
    case 'chat_message':
      appendLine({
        type: 'user',
        author: data.author,
        content: data.content,
        timestamp: data.timestamp,
      });
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
      appendLine({
        type: 'system',
        content: JSON.stringify(data),
        timestamp: new Date().toISOString(),
      });
  }
}

function appendLine({ type, author, content, timestamp }) {
  const output = document.getElementById('terminalOutput');
  if (!output) return;

  const line = document.createElement('div');
  line.className = `terminal-line terminal-line--${type}`;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'terminal-line__time';
  timeSpan.textContent = `[${timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}] `;
  line.appendChild(timeSpan);

  if (type === 'user' && author) {
    const authorSpan = document.createElement('span');
    authorSpan.className = 'terminal-line__author';
    authorSpan.textContent = `${author}: `;
    line.appendChild(authorSpan);
  }

  const contentSpan = document.createElement('span');
  contentSpan.className = 'terminal-line__content';
  contentSpan.textContent = content;
  line.appendChild(contentSpan);

  output.appendChild(line);
  output.scrollTop = output.scrollHeight;

  while (output.children.length > 500) {
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

function updateWSState(state, label) {
  const dot = document.querySelector('.ws-dot');
  const text = document.getElementById('wsStatusText');
  if (dot) {
    dot.className = `ws-dot ws-dot--${state}`;
  }
  if (text) {
    text.textContent = label;
  }
}

function updateReconnectCount() {
  const el = document.getElementById('infoReconnects');
  if (el) el.textContent = String(reconnectAttempts);
}

function incrementMsgCount() {
  msgCount += 1;
  const el = document.getElementById('infoMsgCount');
  if (el) el.textContent = String(msgCount);
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

    try {
      socket.send(
        JSON.stringify({
          type: 'chat_message',
          author: 'You',
          content,
        })
      );
      input.value = '';
      input.focus();
    } catch (err) {
      console.error('[Realtime] Failed to send message:', err);
      showToast({ type: 'error', message: 'Failed to send message' });
    }
  });
}

export function disconnectRealtime() {
  intentionalClose = true;
  if (reconnectHandle) {
    clearTimeout(reconnectHandle);
    reconnectHandle = null;
  }
  if (pingHandle) {
    clearInterval(pingHandle);
    pingHandle = null;
  }
  if (socket) {
    try {
      socket.close(1000, 'User navigated away');
    } catch {}
    socket = null;
  }
}
