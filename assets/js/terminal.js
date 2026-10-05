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
      <form class="camp-term-inputrow">
        <span class="camp-term-prompt"></span>
        <input class="camp-term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input">
      </form>`;
    this.out = this.el.querySelector('.camp-term-output');
    this.input = this.el.querySelector('.camp-term-input');
    this.promptEl = this.el.querySelector('.camp-term-prompt');
    this.updatePrompt();
    this.el.addEventListener('click', () => this.input.focus());
  }

  updatePrompt() {
    const short = this.cwd.replace(`/home/${this.user}`, '~');
    this.promptEl.innerHTML =
      `<span class="camp-term-user">${this.user}@${this.host}</span><span class="camp-term-colon">:</span>` +
      `<span class="camp-term-path">${short}</span><span class="camp-term-dollar">$</span>`;
  }

  bind() {
    this.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const cmd = this.input.value.trim();
      this.input.value = '';
      if (cmd) { this.history.push(cmd); this.hIdx = this.history.length; }
      this.exec(cmd);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (this.hIdx > 0) { this.hIdx--; this.input.value = this.history[this.hIdx] || ''; } }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (this.hIdx < this.history.length) { this.hIdx++; this.input.value = this.history[this.hIdx] || ''; } }
    });
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
