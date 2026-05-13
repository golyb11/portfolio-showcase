import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

let uploading = false;

export function initMediaUpload() {
  setupDropZone();
  loadGallery();
  document.getElementById('refreshGallery')?.addEventListener('click', loadGallery);
}

function setupDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  if (!dropZone || !fileInput) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      handleFiles(files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

function handleFiles(fileList) {
  if (uploading) {
    showToast({ type: 'warning', message: 'Upload already in progress' });
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024;

  Array.from(fileList).forEach(file => {
    if (!allowedTypes.includes(file.type)) {
      showToast({ type: 'error', title: 'Invalid type', message: `${file.name}: only JPG, PNG, GIF, WebP allowed` });
      return;
    }
    if (file.size > maxSize) {
      showToast({ type: 'error', title: 'File too large', message: `${file.name}: exceeds 5MB limit` });
      return;
    }
    uploadFile(file);
  });
}

function uploadFile(file) {
  uploading = true;
  const queue = document.getElementById('uploadQueue');
  if (!queue) return;

  const item = document.createElement('div');
  item.className = 'upload-item';
  const itemId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  item.id = itemId;

  const sizeStr = formatSize(file.size);
  item.innerHTML = `
    <img class="upload-item__preview" alt="Preview" />
    <div class="upload-item__info">
      <div class="upload-item__name">${escapeHTML(file.name)}</div>
      <div class="upload-item__size">${sizeStr}</div>
      <div class="upload-item__progress"><div class="upload-item__progress-bar" style="width:0%"></div></div>
    </div>
    <span class="upload-item__status">Uploading...</span>
  `;

  queue.appendChild(item);

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = item.querySelector('.upload-item__preview');
    if (img) img.src = e.target.result;
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('file', file);

  api.upload('/media/', formData, (percent) => {
    const bar = item.querySelector('.upload-item__progress-bar');
    if (bar) bar.style.width = `${percent}%`;
  })
    .then(() => {
      const bar = item.querySelector('.upload-item__progress-bar');
      const status = item.querySelector('.upload-item__status');
      if (bar) { bar.style.width = '100%'; bar.classList.add('upload-item__progress-bar--success'); }
      if (status) status.textContent = '\u2713 Done';
      showToast({ type: 'success', message: `${file.name} uploaded` });
      uploading = false;
      loadGallery();
    })
    .catch((error) => {
      const bar = item.querySelector('.upload-item__progress-bar');
      const status = item.querySelector('.upload-item__status');
      if (bar) bar.classList.add('upload-item__progress-bar--error');
      if (status) status.textContent = `\u2717 ${error.message}`;
      showToast({ type: 'error', title: 'Upload failed', message: error.message });
      uploading = false;
    })
    .finally(() => {
      setTimeout(() => {
        const el = document.getElementById(itemId);
        if (el) el.remove();
      }, 8000);
    });
}

async function loadGallery() {
  const gallery = document.getElementById('mediaGallery');
  if (!gallery) return;
  gallery.innerHTML = '<div class="gallery-loading"><div class="loading-spinner"></div></div>';

  try {
    const response = await api.get('/media/?page_size=100');
    if (response.status === 'success') {
      const items = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      renderGallery(gallery, items);
    }
  } catch (error) {
    gallery.innerHTML = '<div class="empty-state"><span class="empty-state__icon">\u26A0</span><span class="empty-state__text">Failed to load gallery</span></div>';
    showToast({ type: 'error', message: 'Failed to load media gallery' });
  }
}

function renderGallery(container, items) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><span class="empty-state__icon">\u2B21</span><span class="empty-state__text">No media uploaded yet</span></div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const imgUrl = item.thumbnail_url || item.file_url || '';
    return `
      <div class="gallery-item" role="listitem">
        <img src="${imgUrl}" alt="${escapeHTML(item.original_filename)}" loading="lazy" />
        <div class="gallery-item__overlay">
          <span class="gallery-item__name">${escapeHTML(item.original_filename)}</span>
          <span class="gallery-item__size">${formatSize(item.file_size)}</span>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.gallery-item img').forEach(img => {
    img.addEventListener('click', () => {
      const full = itemFromImage(img);
      if (full) {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`<img src="${full}" style="max-width:100%;max-height:100vh;" />`);
        }
      }
    });
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
  });
}

function itemFromImage(img) {
  const container = img.closest('.gallery-item');
  if (!container) return null;
  const items = [...document.querySelectorAll('.gallery-item')];
  const idx = items.indexOf(container);
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
