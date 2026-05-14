const ICONS = {
  success: 'icon-check',
  error: 'icon-trash',
  warning: 'icon-clock',
  info: 'icon-layers',
};

function createIconSVG(iconId) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${iconId}`);
  svg.appendChild(use);
  return svg;
}

function getContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notifications');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast({ type = 'info', title = '', message = '', duration = 4000 } = {}) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast__icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.appendChild(createIconSVG(ICONS[type] || ICONS.info));
  toast.appendChild(iconSpan);

  const body = document.createElement('div');
  body.className = 'toast__body';

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast__title';
    titleEl.textContent = title;
    body.appendChild(titleEl);
  }

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'toast__message';
    msgEl.textContent = message;
    body.appendChild(msgEl);
  }

  toast.appendChild(body);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.innerHTML = '<svg class="icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  toast.appendChild(closeBtn);

  const remove = () => {
    toast.classList.add('toast--removing');
    toast.addEventListener(
      'animationend',
      () => {
        if (toast.parentNode) toast.remove();
      },
      { once: true }
    );
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 400);
  };

  closeBtn.addEventListener('click', remove);

  if (duration > 0) {
    setTimeout(remove, duration);
  }

  container.appendChild(toast);
  return toast;
}

export default { showToast };
