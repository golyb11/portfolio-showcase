import { initDashboard } from './modules/dashboard.js';
import { initDataGrid } from './modules/datagrid.js';
import { initRealtime, disconnectRealtime } from './modules/realtime.js';
import { initMediaUpload } from './modules/media.js';
import { initSecurity } from './modules/security.js';
import { showToast } from './components/toast.js';

const PAGE_MODULES = {
  'dashboard': initDashboard,
  'data-grid': initDataGrid,
  'realtime': initRealtime,
  'media': initMediaUpload,
  'security': initSecurity,
};

let currentPage = null;
let currentCleanup = null;

function detectPage() {
  const path = window.location.pathname;

  if (path === '/' || path === '/dashboard/') return 'dashboard';
  if (path.startsWith('/data-grid')) return 'data-grid';
  if (path.startsWith('/realtime')) return 'realtime';
  if (path.startsWith('/media')) return 'media';
  if (path.startsWith('/security')) return 'security';

  return null;
}

async function navigateTo(url, pushState = true) {
  if (pushState) {
    history.pushState({ url }, '', url);
  }

  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const pageName = detectPage();
  const mainContent = document.getElementById('mainContent');

  if (!pageName || !mainContent) {
    window.location.href = url;
    return;
  }

  if (pageName === currentPage) {
    initPageModule(pageName);
    return;
  }

  currentPage = pageName;

  try {
    const response = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });

    if (!response.ok) {
      window.location.href = url;
      return;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.getElementById('pageContainer') || doc.querySelector('main');

    const container = document.getElementById('pageContainer');
    if (container && newContent) {
      container.innerHTML = newContent.innerHTML;
      container.style.animation = 'none';
      container.offsetHeight;
      container.style.animation = 'pageIn 0.35s ease';
    } else {
      window.location.href = url;
      return;
    }

    document.title = doc.title || 'Portfolio Showcase';
    updateActiveNav(pageName);
    initPageModule(pageName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    window.location.href = url;
  }
}

function initPageModule(pageName) {
  const initFn = PAGE_MODULES[pageName];
  if (initFn) {
    initFn();
  }

  if (pageName === 'realtime') {
    currentCleanup = disconnectRealtime;
  } else {
    currentCleanup = null;
  }
}

function updateActiveNav(pageName) {
  document.querySelectorAll('.sidebar__nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === pageName) {
      link.classList.add('active');
    }
  });
}

function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!toggle || !sidebar || !overlay) return;

  const open = () => {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      close();
    } else {
      open();
    }
  });

  overlay.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      close();
    }
  });
}

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  const html = document.documentElement;

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (icon) icon.textContent = theme === 'dark' ? '\u2600' : '\u263D';
    if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('portfolio-theme', theme);
  }

  const savedTheme = localStorage.getItem('portfolio-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('portfolio-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function initSPARouting() {
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar__nav-link');
    if (!link) return;
    if (link.getAttribute('href')?.startsWith('http')) return;
    e.preventDefault();
    navigateTo(link.href);
  });

  window.addEventListener('popstate', (e) => {
    if (e.state?.url) {
      navigateTo(e.state.url, false);
    } else {
      navigateTo(window.location.href, false);
    }
  });

  history.replaceState({ url: window.location.href }, '', window.location.href);
}

function initGlobalAuthHandler() {
  window.addEventListener('auth:required', () => {
    showToast({
      type: 'warning',
      title: 'Authentication Required',
      message: 'Please log in to access this feature.',
      duration: 6000,
    });
  });
}

function init() {
  initSidebar();
  initTheme();
  initSPARouting();
  initGlobalAuthHandler();

  const initialPage = detectPage();
  if (initialPage) {
    currentPage = initialPage;
    updateActiveNav(initialPage);
    initPageModule(initialPage);
  }
}

document.addEventListener('DOMContentLoaded', init);
