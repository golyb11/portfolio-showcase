const modal = document.getElementById('globalModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFooter = document.getElementById('modalFooter');
const modalClose = document.getElementById('modalClose');

export function showModal({ title = 'Modal', body = '', footer = '', onClose = null } = {}) {
  if (!modal) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = typeof body === 'string' ? body : '';
  if (typeof body === 'object' && body instanceof HTMLElement) {
    modalBody.innerHTML = '';
    modalBody.appendChild(body);
  }
  modalFooter.innerHTML = footer;

  modal._onCloseCallback = onClose;

  modal.showModal();
}

export function closeModal() {
  if (!modal) return;
  modal.close();
  if (typeof modal._onCloseCallback === 'function') {
    modal._onCloseCallback();
    modal._onCloseCallback = null;
  }
}

if (modal && modalClose) {
  modalClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.open) {
      closeModal();
    }
  });
}

export default { showModal, closeModal };
