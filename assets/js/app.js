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

// Apply theme immediately to avoid flash
CampTheme.init();
