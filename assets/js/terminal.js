// LearnLinux Camp — Simulated Linux Terminal
// A safe, guided fake shell for lessons. Data-driven via a JSON lesson config:
//
//   new CampTerminal(el, {
//     user: 'camper', host: 'camp-vm',
//     fs: { '/home/camper': { type: 'dir', children: { 'notes.txt': {type:'file'}, 'docs': {type:'dir', children:{}} } } },
//     steps: [
//       { hint: 'List the files in your home directory',
//         check: cmd => /^ls\b/.test(cmd),
//         success: 'Nice! `ls` is the Linux `dir`.' },
//     ],
//     onComplete: () => CampProgress.complete('5.1'),
//   });
//
// Supported commands (general): ls, cd, pwd, cat, touch, mkdir, rm, echo, whoami, clear, help

class CampTerminal {
  constructor(el, config = {}) {
    this.el = el;
    this.cfg = config;
    this.user = config.user || 'camper';
    this.host = config.host || 'camp-vm';
    this.cwd = `/home/${this.user}`;
    this.fs = config.fs || this.defaultFs();
    this.steps = config.steps || [];
    this.stepIdx = 0;
    this.history = [];
    this.hIdx = -1;
    this.onComplete = config.onComplete || (() => {});

    this.render();
    this.bind();
    this.boot();

    // Focus terminal when entering the page
    requestAnimationFrame(() => this.focus());
    setTimeout(() => this.focus(), 80);
  }

  defaultFs() {
    return {
      [this.cwd]: { type: 'dir', children: { 'welcome.txt': { type: 'file', content: 'Welcome to Linux camp!\n' } } },
    };
  }

  // ---------- UI ----------
  render() {
    this.el.classList.add('camp-term');
    this.el.innerHTML = `
      <div class="camp-term-output"></div>
      <div class="camp-term-inputrow" hx-boost="false" hx-disable>
        <span class="camp-term-prompt"></span>
        <div class="camp-term-inputwrap">
          <span class="camp-term-echo" aria-hidden="true"><span class="camp-term-echo-before"></span><span class="camp-term-cursor"><span class="camp-term-cursor-char">&nbsp;</span></span><span class="camp-term-echo-after"></span></span>
          <input class="camp-term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus aria-label="Terminal input">
        </div>
      </div>`;
    this.out = this.el.querySelector('.camp-term-output');
    this.input = this.el.querySelector('.camp-term-input');
    this.echoBefore = this.el.querySelector('.camp-term-echo-before');
    this.echoAfter = this.el.querySelector('.camp-term-echo-after');
    this.cursor = this.el.querySelector('.camp-term-cursor');
    this.cursorChar = this.el.querySelector('.camp-term-cursor-char');
    this.promptEl = this.el.querySelector('.camp-term-prompt');
    this.updatePrompt();
    this.syncEcho();
  }

  focus() {
    if (!this.input) return;
    try {
      this.input.focus({ preventScroll: true });
    } catch {
      this.input.focus();
    }
    this.el.classList.add('is-focused');
  }

  syncEcho() {
    const val = this.input.value || '';
    let start = this.input.selectionStart;
    let end = this.input.selectionEnd;
    if (start === null || typeof start === 'undefined') start = val.length;
    if (end === null || typeof end === 'undefined') end = val.length;

    if (start !== end) {
      const sMin = Math.min(start, end);
      const sMax = Math.max(start, end);
      this.echoBefore.textContent = val.slice(0, sMin);
      this.cursorChar.textContent = '\u00a0';
      this.cursor.style.display = 'none';
      this.echoAfter.innerHTML = `<span class="camp-term-selected">${this.escape(val.slice(sMin, sMax))}</span>${this.escape(val.slice(sMax))}`;
    } else {
      this.cursor.style.display = '';
      const before = val.slice(0, start);
      const charUnder = val.slice(start, start + 1);
      const after = val.slice(start + (charUnder ? 1 : 0));

      this.echoBefore.textContent = before;
      // Use non-breaking space for empty or regular space to maintain monospace cursor width
      this.cursorChar.textContent = (!charUnder || charUnder === ' ') ? '\u00a0' : charUnder;
      this.echoAfter.textContent = after;
    }

    // Briefly hold the cursor steady while typing, like xterm/Windows Terminal
    this.cursor.classList.add('typing');
    clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursor.classList.remove('typing'), 450);
  }

  updatePrompt() {
    const short = this.cwd.replace(`/home/${this.user}`, '~');
    this.promptEl.innerHTML =
      `<span class="camp-term-user">${this.user}@${this.host}</span><span class="camp-term-colon">:</span>` +
      `<span class="camp-term-path">${short}</span><span class="camp-term-dollar">$</span>`;
  }

  bind() {
    // Focus listeners
    this.input.addEventListener('focus', () => {
      this.el.classList.add('is-focused');
      this.syncEcho();
    });
    this.input.addEventListener('blur', () => {
      this.el.classList.remove('is-focused');
      this.syncEcho();
    });

    // Keystroke and sync listeners
    this.input.addEventListener('input', () => this.syncEcho());
    this.input.addEventListener('keyup', () => this.syncEcho());
    this.input.addEventListener('click', () => this.syncEcho());
    this.input.addEventListener('select', () => this.syncEcho());

    // Sync when selection/caret position changes in document
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.input) {
        this.syncEcho();
      }
    });

    // Keyboard navigation, command execution & history
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const cmd = this.input.value.trim();
        this.input.value = '';
        this.syncEcho();
        if (cmd) { this.history.push(cmd); this.hIdx = this.history.length; }
        this.exec(cmd);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.hIdx > 0) {
          this.hIdx--;
          this.input.value = this.history[this.hIdx] || '';
          this.syncEcho();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.hIdx < this.history.length) {
          this.hIdx++;
          this.input.value = this.history[this.hIdx] || '';
          this.syncEcho();
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const sel = window.getSelection();
        if (!sel || !sel.toString().length) {
          if (this.input.value) {
            e.preventDefault();
            this.print(`${this.promptEl.innerHTML} <span class="camp-term-cmd">${this.escape(this.input.value)}^C</span>`);
            this.input.value = '';
            this.syncEcho();
          }
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.exec('clear');
        return;
      }
      queueMicrotask(() => this.syncEcho());
    });

    // Re-focus on terminal clicks unless selecting text
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
      this.focus();
    });

    const win = this.el.closest('.term-window');
    if (win) {
      win.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        this.focus();
      });
    }
  }

  boot() {
    this.print(`<span class="camp-term-muted">Welcome to your Linux camp VM. Type <b>help</b> to see available commands.</span>`);
    if (this.steps.length) this.printStep();
  }

  print(html) {
    const line = document.createElement('div');
    line.className = 'camp-term-line';
    line.innerHTML = html;
    this.out.appendChild(line);
    this.out.scrollTop = this.out.scrollHeight;
  }

  printCmd(cmd) {
    this.print(`${this.promptEl.innerHTML} <span class="camp-term-cmd">${this.escape(cmd)}</span>`);
  }

  escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  printStep() {
    const s = this.steps[this.stepIdx];
    this.print(`<span class="camp-term-task">📋 Task ${this.stepIdx + 1}/${this.steps.length}: ${this.escape(s.hint)}</span>`);
  }

  // ---------- FS helpers ----------
  resolve(path) {
    if (!path) return this.cwd;
    if (path === '~') return `/home/${this.user}`;
    let parts = path.startsWith('/') ? path.split('/') : (this.cwd + '/' + path).split('/');
    const out = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') out.pop(); else out.push(p);
    }
    return '/' + out.join('/');
  }

  node(path) {
    if (path === '/') return { type: 'dir', children: this.rootChildren() };
    if (this.fs[path]) return this.fs[path];
    // look up as child of parent
    const parent = this.fs[path.substring(0, path.lastIndexOf('/')) || '/'];
    const name = path.split('/').pop();
    if (parent && parent.children && parent.children[name]) return parent.children[name];
    return this.fs[path] || null;
  }

  rootChildren() {
    const dirs = {};
    for (const p of Object.keys(this.fs)) {
      const top = p.split('/')[1];
      if (top && !dirs[top]) dirs[top] = { type: 'dir', synthetic: true, children: {} };
    }
    return dirs;
  }

  childrenOf(path) {
    const out = {};
    // direct node children
    const n = this.node(path);
    if (n && n.children) Object.assign(out, n.children);
    // discover nested fs paths (e.g. deeper dirs)
    for (const p of Object.keys(this.fs)) {
      if (p.startsWith(path === '/' ? '/' : path + '/') && p !== path) {
        const rest = p.slice(path === '/' ? 1 : path.length + 1).split('/')[0];
        if (rest && !out[rest]) {
          out[rest] = p === `${path === '/' ? '/' : path + '/'}${rest}` ? this.fs[p] : { type: 'dir', synthetic: true, children: {} };
        }
      }
    }
    return out;
  }

  setNode(path, nodeValue) {
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const parent = this.fs[parentPath];
    const name = path.split('/').pop();
    if (parent && parent.children) parent.children[name] = nodeValue;
    else this.fs[path] = nodeValue;
    if (nodeValue && nodeValue.type === 'dir' && !nodeValue.synthetic) this.fs[path] = nodeValue;
  }

  // ---------- Command execution ----------
  exec(raw) {
    this.printCmd(raw);
    if (!raw) return;

    // guided-step check happens regardless of builtin result
    const parts = raw.split(/\s+/);
    const [cmd, ...args] = parts;
    let handled = true;

    switch (cmd) {
      case 'help':
        this.print('Available: ls cd pwd cat touch mkdir rm echo whoami clear help');
        break;
      case 'clear':
        this.out.innerHTML = '';
        if (this.steps.length && this.stepIdx < this.steps.length) this.printStep();
        break;
      case 'whoami':
        this.print(this.user);
        break;
      case 'pwd':
        this.print(this.cwd);
        break;
      case 'echo':
        this.print(this.escape(args.join(' ').replace(/^["']|["']$/g, '')));
        break;
      case 'ls': this.cmdLs(args); break;
      case 'cd': this.cmdCd(args); break;
      case 'cat': this.cmdCat(args); break;
      case 'touch': this.cmdTouch(args); break;
      case 'mkdir': this.cmdMkdir(args); break;
      case 'rm': this.cmdRm(args); break;
      default:
        handled = false;
        this.print(`<span class="camp-term-err">bash: ${this.escape(cmd)}: command not found</span> <span class="camp-term-muted">(this is a simulated shell — try <b>help</b>)</span>`);
    }

    this.updatePrompt();
    this.checkStep(raw);
    return handled;
  }

  cmdLs(args) {
    const target = this.resolve(args.find(a => !a.startsWith('-')) || this.cwd);
    const n = this.node(target);
    if (!n) return this.print(`<span class="camp-term-err">ls: cannot access '${this.escape(target)}': No such file or directory</span>`);
    if (n.type === 'file') return this.print(this.escape(target.split('/').pop()));
    const kids = Object.keys(this.childrenOf(target));
    if (!kids.length) return;
    const showAll = args.some(a => a.startsWith('-') && a.includes('a'));
    const items = showAll ? ['.', '..', ...kids] : kids;
    this.print(items.map(k => {
      const child = this.childrenOf(target)[k];
      return child && child.type === 'dir'
        ? `<span class="camp-term-dir">${this.escape(k)}/</span>`
        : this.escape(k);
    }).join('  '));
  }

  cmdCd(args) {
    const target = this.resolve(args[0] || '~');
    const n = this.node(target);
    if (!n) return this.print(`<span class="camp-term-err">bash: cd: ${this.escape(args[0] || '')}: No such file or directory</span>`);
    if (n.type !== 'dir') return this.print(`<span class="camp-term-err">bash: cd: ${this.escape(args[0])}: Not a directory</span>`);
    this.cwd = target;
  }

  cmdCat(args) {
    if (!args.length) return this.print('<span class="camp-term-err">cat: missing operand</span>');
    for (const a of args) {
      const target = this.resolve(a);
      const n = this.node(target);
      if (!n) this.print(`<span class="camp-term-err">cat: ${this.escape(a)}: No such file or directory</span>`);
      else if (n.type === 'dir') this.print(`<span class="camp-term-err">cat: ${this.escape(a)}: Is a directory</span>`);
      else this.print(this.escape(n.content || ''));
    }
  }

  cmdTouch(args) {
    const flags = args.filter(a => a.startsWith('-'));
    const files = args.filter(a => !a.startsWith('-'));
    if (!files.length) return this.print('<span class="camp-term-err">touch: missing file operand</span>');
    for (const f of files) {
      const target = this.resolve(f);
      if (!this.node(target)) this.setNode(target, { type: 'file', content: '' });
    }
  }

  cmdMkdir(args) {
    const dirs = args.filter(a => !a.startsWith('-'));
    if (!dirs.length) return this.print('<span class="camp-term-err">mkdir: missing operand</span>');
    for (const d of dirs) {
      const target = this.resolve(d);
      if (this.node(target)) this.print(`<span class="camp-term-err">mkdir: cannot create directory '${this.escape(d)}': File exists</span>`);
      else this.setNode(target, { type: 'dir', children: {} });
    }
  }

  cmdRm(args) {
    const flags = args.filter(a => a.startsWith('-')).join('');
    const targets = args.filter(a => !a.startsWith('-'));
    if (!targets.length) return this.print('<span class="camp-term-err">rm: missing operand</span>');
    for (const t of targets) {
      const target = this.resolve(t);
      const n = this.node(target);
      if (!n) { this.print(`<span class="camp-term-err">rm: cannot remove '${this.escape(t)}': No such file or directory</span>`); continue; }
      if (n.type === 'dir' && !flags.includes('r')) {
        this.print(`<span class="camp-term-err">rm: cannot remove '${this.escape(t)}': Is a directory</span>`); continue;
      }
      const parent = this.fs[target.substring(0, target.lastIndexOf('/')) || '/'];
      if (parent && parent.children) delete parent.children[target.split('/').pop()];
      delete this.fs[target];
    }
  }

  // ---------- Guided steps ----------
  checkStep(cmd) {
    if (this.stepIdx >= this.steps.length) return;
    const step = this.steps[this.stepIdx];
    if (step.check && step.check(cmd, this)) {
      this.stepIdx++;
      this.print(`<span class="camp-term-ok">✅ ${this.escape(step.success || 'Correct!')}</span>`);
      if (this.stepIdx < this.steps.length) {
        this.printStep();
      } else {
        this.print('<span class="camp-term-ok">🎉 Lesson complete! Great work, camper.</span>');
        this.el.dispatchEvent(new CustomEvent('camp:lesson-complete', { bubbles: true }));
        this.onComplete();
      }
    }
  }
}

window.CampTerminal = CampTerminal;
