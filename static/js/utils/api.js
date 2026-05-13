const API_BASE = '/api';

function getCSRFToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) return meta.getAttribute('content');
  const cookie = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
  return cookie ? cookie.split('=')[1] : '';
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCSRFToken(),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
    config.headers['X-CSRFToken'] = getCSRFToken();
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.message || 'Rate limit exceeded');
      err.status = 429;
      err.retryAfter = data.retry_after || parseInt(response.headers.get('Retry-After') || '60', 10);
      throw err;
    }

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:required'));
      const err = new Error('Authentication required');
      err.status = 401;
      throw err;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return response.blob();
    }

    return response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      const netErr = new Error('Network error — please check your connection');
      netErr.status = 0;
      throw netErr;
    }
    throw error;
  }
}

export const api = {
  get: (endpoint, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return request(url, { method: 'GET' });
  },

  post: (endpoint, data = {}) => {
    return request(endpoint, { method: 'POST', body: data });
  },

  patch: (endpoint, data = {}) => {
    return request(endpoint, { method: 'PATCH', body: data });
  },

  delete: (endpoint) => {
    return request(endpoint, { method: 'DELETE' });
  },

  upload: (endpoint, formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${endpoint}`);
      xhr.setRequestHeader('X-CSRFToken', getCSRFToken());

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ status: 'success', data: null });
          }
        } else if (xhr.status === 429) {
          try {
            const data = JSON.parse(xhr.responseText);
            const err = new Error(data.message || 'Rate limit exceeded');
            err.status = 429;
            err.retryAfter = data.retry_after || 60;
            reject(err);
          } catch {
            reject(new Error('Rate limit exceeded'));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      xhr.send(formData);
    });
  },
};

export { getCSRFToken };
