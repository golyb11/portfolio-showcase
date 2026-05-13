const container = document.getElementById('toastContainer');

const ICONS = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26a0',
  info: '\u2139',
};

export function showToast({ type = 'info', title = '', message = '', duration = 5000 } = {}) {
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${ICONS[type] || ICONS.info}</span>
    <div class="toast__body">
      ${title ? `<div class="toast__title">${escapeHTML(title)}</div>` : ''}
      ${message ? `<div class="toast__message">${escapeHTML(message)}</div>` : ''}
    </div>
    <button class="toast__close" aria-label="Close notification">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast__close');
  const remove = () => {
    toast.classList.add('toast--removing');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.remove();
    }, { once: true });
  };

  closeBtn.addEventListener('click', remove);

  if (duration > 0) {
    setTimeout(remove, duration);
  }

  container.appendChild(toast);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default { showToast };
