let boundOnce = false;

function els() {
  return {
    modal: document.getElementById('globalModal'),
    title: document.getElementById('modalTitle'),
    body: document.getElementById('modalBody'),
    footer: document.getElementById('modalFooter'),
    close: document.getElementById('modalClose'),
  };
}

function bindGlobalHandlers() {
  if (boundOnce) return;
  boundOnce = true;

  const { modal, close } = els();
  if (!modal) return;

  if (close) close.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    const rect = modal.getBoundingClientRect();
    const inDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inDialog) closeModal();
  });

  modal.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });
}

export function showModal({ title = 'Modal', body = '', footer = '', onClose = null } = {}) {
  const { modal, title: titleEl, body: bodyEl, footer: footerEl } = els();
  if (!modal || !titleEl || !bodyEl || !footerEl) {
    console.warn('[Modal] Modal DOM not available');
    return;
  }

  bindGlobalHandlers();

  titleEl.textContent = title;

  bodyEl.innerHTML = '';
  if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  } else if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  }

  footerEl.innerHTML = typeof footer === 'string' ? footer : '';

  modal._onCloseCallback = typeof onClose === 'function' ? onClose : null;

  if (typeof modal.showModal === 'function') {
    try {
      modal.showModal();
    } catch (err) {
      modal.setAttribute('open', '');
    }
  } else {
    modal.setAttribute('open', '');
  }
}

export function closeModal() {
  const { modal } = els();
  if (!modal) return;

  if (typeof modal.close === 'function') {
    try {
      modal.close();
    } catch {
      modal.removeAttribute('open');
    }
  } else {
    modal.removeAttribute('open');
  }

  if (typeof modal._onCloseCallback === 'function') {
    try {
      modal._onCloseCallback();
    } catch (err) {
      console.warn('[Modal] onClose error:', err);
    }
    modal._onCloseCallback = null;
  }
}

export default { showModal, closeModal };
