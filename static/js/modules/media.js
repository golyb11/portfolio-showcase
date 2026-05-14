import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

let uploading = false;

export function initMediaUpload() {
  setupDropZone();
  loadGallery();
  const refresh = document.getElementById('refreshGallery');
  if (refresh) refresh.addEventListener('click', loadGallery);
}

function setupDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  if (!dropZone || !fileInput) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'));
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'));
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleFiles(files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) {
      handleFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  dropZone.addEventListener('click', () => fileInput.click());

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

  Array.from(fileList).forEach((file) => {
    if (!allowedTypes.includes(file.type)) {
      showToast({
        type: 'error',
        title: 'Invalid type',
        message: `${file.name}: only JPG, PNG, GIF, WebP allowed`,
      });
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
  if (!queue) {
    uploading = false;
    return;
  }

  const itemId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item = document.createElement('div');
  item.className = 'upload-item';
  item.id = itemId;

  const previewImg = document.createElement('img');
  previewImg.className = 'upload-item__preview';
  previewImg.alt = 'Preview';
  item.appendChild(previewImg);

  const info = document.createElement('div');
  info.className = 'upload-item__info';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'upload-item__name';
  nameDiv.textContent = file.name;
  info.appendChild(nameDiv);

  const sizeDiv = document.createElement('div');
  sizeDiv.className = 'upload-item__size';
  sizeDiv.textContent = formatSize(file.size);
  info.appendChild(sizeDiv);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'upload-item__progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'upload-item__progress-bar';
  progressBar.style.width = '0%';
  progressWrap.appendChild(progressBar);
  info.appendChild(progressWrap);

  item.appendChild(info);

  const status = document.createElement('span');
  status.className = 'upload-item__status';
  status.textContent = 'Uploading...';
  item.appendChild(status);

  queue.appendChild(item);

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('file', file);

  api
    .upload('/media/', formData, (percent) => {
      progressBar.style.width = `${percent}%`;
    })
    .then(() => {
      progressBar.style.width = '100%';
      progressBar.classList.add('upload-item__progress-bar--success');
      status.textContent = 'Done';
      showToast({ type: 'success', message: `${file.name} uploaded` });
      loadGallery();
    })
    .catch((error) => {
      console.error('[Media] upload failed:', error);
      progressBar.classList.add('upload-item__progress-bar--error');
      status.textContent = `Error: ${error.message}`;
      showToast({ type: 'error', title: 'Upload failed', message: error.message });
    })
    .finally(() => {
      uploading = false;
      setTimeout(() => {
        const el = document.getElementById(itemId);
        if (el) el.remove();
      }, 6000);
    });
}

async function loadGallery() {
  const gallery = document.getElementById('mediaGallery');
  if (!gallery) return;

  gallery.innerHTML = '';
  for (let i = 0; i < 8; i += 1) {
    const sk = document.createElement('div');
    sk.className = 'gallery-item gallery-item--skeleton';
    gallery.appendChild(sk);
  }

  try {
    const response = await api.get('/media/?page_size=100');
    if (response && response.status === 'success') {
      const items = Array.isArray(response.data)
        ? response.data
        : response.data && response.data.results
          ? response.data.results
          : [];
      renderGallery(gallery, items);
    }
  } catch (error) {
    console.error('[Media] loadGallery failed:', error);
    const msg = error.status === 401
      ? 'Sign in to view uploaded media.'
      : 'Failed to load gallery.';
    gallery.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state empty-state--gallery';
    const icon = document.createElement('span');
    icon.className = 'empty-state__icon';
    icon.innerHTML = '<svg class="icon icon--xl" aria-hidden="true"><use href="#icon-shield"></use></svg>';
    const text = document.createElement('span');
    text.className = 'empty-state__text';
    text.textContent = msg;
    empty.appendChild(icon);
    empty.appendChild(text);
    gallery.appendChild(empty);
  }
}

function renderGallery(container, items) {
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state empty-state--gallery';
    const icon = document.createElement('span');
    icon.className = 'empty-state__icon';
    icon.innerHTML = '<svg class="icon icon--xl" aria-hidden="true"><use href="#icon-image"></use></svg>';
    const text = document.createElement('span');
    text.className = 'empty-state__text';
    text.textContent = 'No media uploaded yet. Drop some images above.';
    empty.appendChild(icon);
    empty.appendChild(text);
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const tile = document.createElement('div');
    tile.className = 'gallery-item';
    tile.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = item.original_filename || 'Uploaded image';
    img.src = item.thumbnail_url || item.file_url || '';
    img.addEventListener('error', () => {
      tile.classList.add('gallery-item--broken');
    });

    const overlay = document.createElement('div');
    overlay.className = 'gallery-item__overlay';

    const name = document.createElement('span');
    name.className = 'gallery-item__name';
    name.textContent = item.original_filename;
    overlay.appendChild(name);

    const size = document.createElement('span');
    size.className = 'gallery-item__size';
    size.textContent = formatSize(item.file_size);
    overlay.appendChild(size);

    tile.appendChild(img);
    tile.appendChild(overlay);
    container.appendChild(tile);
  });
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
