const PAGE_ROUTES = [
  { match: (p) => p === '/' || p === '' || p === '/dashboard/', name: 'dashboard' },
  { match: (p) => p.startsWith('/data-grid'), name: 'data-grid' },
  { match: (p) => p.startsWith('/realtime'), name: 'realtime' },
  { match: (p) => p.startsWith('/media'), name: 'media' },
  { match: (p) => p.startsWith('/security'), name: 'security' },
];

const moduleLoaders = {
  'dashboard': () => import('./modules/dashboard.js'),
  'data-grid': () => import('./modules/datagrid.js'),
  'realtime': () => import('./modules/realtime.js'),
  'media': () => import('./modules/media.js'),
  'security': () => import('./modules/security.js'),
};

let currentPage = null;
let currentCleanup = null;

function detectPage(pathname = window.location.pathname) {
  for (const route of PAGE_ROUTES) {
    if (route.match(pathname)) return route.name;
  }
  return null;
}

function updateActiveNav(pageName) {
  const links = document.querySelectorAll('.sidebar__nav-link');
  links.forEach((link) => {
    if (link.dataset.page === pageName) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

async function loadPageModule(pageName) {
  if (currentCleanup && typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.warn('[App] Cleanup failed:', err);
    }
    currentCleanup = null;
  }

  const loader = moduleLoaders[pageName];
  if (!loader) return;

  try {
    const mod = await loader();
    const initName =
      {
        'dashboard': 'initDashboard',
        'data-grid': 'initDataGrid',
        'realtime': 'initRealtime',
        'media': 'initMediaUpload',
        'security': 'initSecurity',
      }[pageName] || null;

    if (initName && typeof mod[initName] === 'function') {
      mod[initName]();
    }

    if (pageName === 'realtime' && typeof mod.disconnectRealtime === 'function') {
      currentCleanup = mod.disconnectRealtime;
    }
  } catch (err) {
    console.error(`[App] Failed to load module "${pageName}":`, err);
  }
}

async function navigateTo(url, pushState = true) {
  const target = new URL(url, window.location.origin);

  if (target.origin !== window.location.origin) {
    window.location.href = url;
    return;
  }

  const nextPage = detectPage(target.pathname);
  if (!nextPage) {
    window.location.href = url;
    return;
  }

  const container = document.getElementById('pageContainer');
  if (!container) {
    window.location.href = url;
    return;
  }

  container.classList.add('page-transition--leaving');

  try {
    const response = await fetch(target.href, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newInner = doc.getElementById('pageContainer');

    if (!newInner) {
      window.location.href = url;
      return;
    }

    if (pushState) {
      history.pushState({ url: target.href }, '', target.href);
    }

    container.innerHTML = newInner.innerHTML;
    container.classList.remove('page-transition--leaving');
    container.classList.remove('page-transition--enter');
    void container.offsetWidth;
    container.classList.add('page-transition--enter');

    const titleEl = doc.querySelector('title');
    document.title = titleEl ? titleEl.textContent : document.title;

    currentPage = nextPage;
    updateActiveNav(nextPage);
    loadPageModule(nextPage);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('[App] Navigation failed, falling back to full reload:', err);
    window.location.href = url;
  }
}

function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!toggle || !sidebar) return;

  const open = () => {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) close();
    else open();
  });

  if (overlay) {
    overlay.addEventListener('click', close);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      close();
    }
  });

  document.querySelectorAll('.sidebar__nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        close();
      }
    });
  });
}

function initTheme() {
  const STORAGE_KEY = 'portfolio-theme';
  const html = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme === 'dark');
    if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      console.warn('[Theme] localStorage unavailable:', err);
    }
  }

  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {}
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'dark'));

  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let hasSaved = false;
    try {
      hasSaved = !!localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (!hasSaved) applyTheme(e.matches ? 'dark' : 'light');
  });
}

function initSPARouting() {
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar__nav-link');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigateTo(link.href);
  });

  window.addEventListener('popstate', (e) => {
    const url = (e.state && e.state.url) || window.location.href;
    navigateTo(url, false);
  });

  history.replaceState({ url: window.location.href }, '', window.location.href);
}

async function initGlobalAuthHandler() {
  let toastModule = null;
  window.addEventListener('auth:required', async () => {
    if (!toastModule) {
      try {
        toastModule = await import('./components/toast.js');
      } catch (err) {
        console.error('[Auth] Failed to load toast module:', err);
        return;
      }
    }
    toastModule.showToast({
      type: 'warning',
      title: 'Sign in required',
      message: 'Some features need an authenticated session. Try /admin/ to log in.',
      duration: 6000,
    });
  });
}

function init() {
  initTheme();
  initSidebar();
  initSPARouting();
  initGlobalAuthHandler();

  const pageName = detectPage();
  if (pageName) {
    currentPage = pageName;
    updateActiveNav(pageName);
    loadPageModule(pageName);
  }

  const container = document.getElementById('pageContainer');
  if (container) {
    container.classList.add('page-transition--enter');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
