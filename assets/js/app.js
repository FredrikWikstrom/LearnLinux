// LearnLinux Camp — shared client-side helpers
// Theme handling + lesson progress tracking (localStorage)

const CampTheme = {
  key: 'llc-theme',
  init() {
    const stored = localStorage.getItem(this.key);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.apply(stored || (prefersDark ? 'dark' : 'light'));
  },
  apply(mode) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(this.key, mode);
  },
  toggle() {
    const isDark = document.documentElement.classList.contains('dark');
    this.apply(isDark ? 'light' : 'dark');
    return !isDark;
  },
};

const CampProgress = {
  key: 'llc-progress',
  all() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
    catch { return {}; }
  },
  isDone(lessonId) { return !!this.all()[lessonId]; },
  complete(lessonId) {
    const p = this.all();
    p[lessonId] = Date.now();
    localStorage.setItem(this.key, JSON.stringify(p));
    document.dispatchEvent(new CustomEvent('camp:progress', { detail: { lessonId } }));
  },
  count() { return Object.keys(this.all()).length; },
  rank() {
    const n = this.count();
    if (n >= 15) return 'Linux Native 🐧';
    if (n >= 5) return 'Camp Resident ⛺';
    return 'Windows Refugee 🪟';
  },
};

// Loader helper to ensure CampTerminal is always available
function ensureCampTerminal() {
  if (window.CampTerminal) return Promise.resolve(window.CampTerminal);
  return new Promise((resolve, reject) => {
    const appScript = document.querySelector('script[src*="app.js"]');
    const src = appScript ? appScript.src.replace('app.js', 'terminal.js') : '/assets/js/terminal.js';
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(window.CampTerminal);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Init registry & runner: runs callbacks reliably on first load and htmx navigation
const CampInit = (fn) => {
  if (typeof fn !== 'function') return;
  const execute = () => {
    if (window.CampTerminal) {
      try { fn(); } catch (e) { console.error('[camp-init]', e); }
    } else {
      ensureCampTerminal().then(() => {
        try { fn(); } catch (e) { console.error('[camp-init]', e); }
      }).catch((err) => console.error('[camp-init] Failed to load terminal.js', err));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', execute, { once: true });
  } else {
    execute();
  }
};

// Re-execute inline scripts when htmx boosts/swaps content
document.addEventListener('htmx:afterSwap', (evt) => {
  const target = evt.detail.target || evt.detail.elt || document.body;
  const scripts = target.querySelectorAll('script');
  scripts.forEach((oldScript) => {
    if (oldScript.src) {
      if (!document.querySelector(`script[src="${oldScript.src}"]`)) {
        const s = document.createElement('script');
        s.src = oldScript.src;
        document.head.appendChild(s);
      }
    } else {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    }
  });
});

document.addEventListener('htmx:historyRestore', () => {
  const el = document.getElementById('lesson-terminal');
  if (el && el._campTerm) {
    el._campTerm.focus();
  }
});

// Apply theme immediately to avoid flash
CampTheme.init();
