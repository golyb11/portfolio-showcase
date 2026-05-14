const API_BASE = '/api';

function getCSRFToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.getAttribute('content')) {
    return meta.getAttribute('content');
  }
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function normalizeUrl(endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  let url = endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`;
  const [path, query] = url.split('?');
  const cleanPath = path.endsWith('/') ? path : `${path}/`;
  return query ? `${cleanPath}?${query}` : cleanPath;
}

async function request(endpoint, options = {}) {
  const url = normalizeUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers || {}),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRFToken'] = getCSRFToken();
  }

  let body = options.body;
  const isFormData = body instanceof FormData;

  if (body && typeof body === 'object' && !isFormData) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  if (isFormData) {
    delete headers['Content-Type'];
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers,
      body,
    });
  } catch (networkError) {
    console.error(`[API] Network error on ${method} ${url}:`, networkError);
    const err = new Error('Cannot reach the server. Check your connection.');
    err.status = 0;
    err.isNetwork = true;
    throw err;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
    if (!response.ok) {
      const err = new Error(`Download failed with status ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }

  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn(`[API] Failed to parse JSON from ${url}:`, parseError);
    }
  }

  if (response.status === 429) {
    const err = new Error((data && data.message) || 'Rate limit exceeded');
    err.status = 429;
    err.retryAfter =
      (data && data.retry_after) ||
      parseInt(response.headers.get('Retry-After') || '60', 10);
    err.data = data;
    throw err;
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { url } }));
    const err = new Error('Authentication required');
    err.status = 401;
    err.data = data;
    throw err;
  }

  if (response.status === 403) {
    const err = new Error((data && data.message) || 'Forbidden');
    err.status = 403;
    err.data = data;
    throw err;
  }

  if (!response.ok) {
    const msg = (data && data.message) || `Request failed (HTTP ${response.status})`;
    console.error(`[API] ${method} ${url} → ${response.status}:`, data);
    const err = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return request(url, { method: 'GET' });
  },
  post(endpoint, data = {}) {
    return request(endpoint, { method: 'POST', body: data });
  },
  patch(endpoint, data = {}) {
    return request(endpoint, { method: 'PATCH', body: data });
  },
  put(endpoint, data = {}) {
    return request(endpoint, { method: 'PUT', body: data });
  },
  delete(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  },
  upload(endpoint, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = normalizeUrl(endpoint);

      xhr.open('POST', url);
      xhr.setRequestHeader('X-CSRFToken', getCSRFToken());
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.withCredentials = true;

      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        let parsed = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch (e) {
          parsed = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed || { status: 'success', data: null });
          return;
        }
        const err = new Error(
          (parsed && parsed.message) || `Upload failed (HTTP ${xhr.status})`
        );
        err.status = xhr.status;
        err.data = parsed;
        if (xhr.status === 429) {
          err.retryAfter = (parsed && parsed.retry_after) || 60;
        }
        console.error(`[API] Upload ${url} → ${xhr.status}`, parsed);
        reject(err);
      });

      xhr.addEventListener('error', () => {
        console.error(`[API] Upload network error on ${url}`);
        const err = new Error('Network error during upload');
        err.status = 0;
        reject(err);
      });

      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.send(formData);
    });
  },
};

export { getCSRFToken };
