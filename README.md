
# LearnLinux
Web site with the goal of learning Linux to Windows refugees

# The Linux Learning Camp for Windows Refugees 🏕️

A modern, interactive learning site that teaches **Linux to people coming from Windows**.
We assume you know basic `cmd` and maybe some PowerShell — and we build on that knowledge,
always showing the Windows equivalent side-by-side with the Linux way.

## Target audience

Windows users switching to Linux. No prior Linux experience required — basic familiarity
with `cmd.exe` or PowerShell helps, and the course explicitly maps familiar Windows concepts
(Registry, `C:\`, `dir`, Task Manager…) onto their Linux counterparts.

## Learning path

0. **Try Linux safely** — Live USB (Ventoy), virtual machines, WSL as a stepping stone
1. **About Linux/GNU**
2. **Distributions**
   - 2.1 Distro family tree
   - 2.2 Top 10 popular distros
   - 2.3 Desktops (GNOME, KDE)
3. **Install Linux**
   - 3.1 Drivers (included vs. manual, e.g. Nvidia)
   - 3.2 Package managers (third party, Flatpak)
   - 3.3 Codecs
4. **Initial setup** — post-install checklist, the filesystem hierarchy vs. `C:\`,
   Windows-equivalents cheat-sheet (Registry → config files, Task Manager → `htop`,
   Services → systemd)
5. **Learn the Linux Terminal** (with a "coming from cmd/PowerShell" primer)
   - File operations · Directory operations · Permissions · User & group management ·
     Process management · Networking · Package management · Job scheduling ·
     Disk & filesystem · Hardware/system info · Compression & archiving ·
     Text processing · Kernel & modules · System control · Logging & monitoring ·
     Checksums & integrity · Date & time · *(bonus: mail, printing)*
6. **Text editors** — vim, nano, desktop alternatives
7. **Scripting** — bash for PowerShell users

### Roadmap

- 🖥️ Fully interactive sandbox terminal in the browser (simulated shell today, real
  VM/container sessions later)
- 📚 New topic tracks: **Git**, programming languages, container technologies
- 🏆 Camp ranks & progress badges (Windows Refugee → Camp Resident → Linux Native)
- 🛟 Troubleshooting / "getting help" topic (`man`, `--help`, `journalctl`)

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Styling | **Tailwind CSS** (Play CDN) | Utility classes right in the HTML, no build step |
| Interactivity | **htmx** | Dynamic AJAX swaps, `hx-boost="true"` navigation |
| Micro-interactions | **Alpine.js** | Client-side toggles, drawers, modals |
| Theme | **Windows 11 / Fluent** | Familiar Mica-inspired palette, `#0067c0` accent, rounded corners |
| Terminal | Simulated shell (vanilla JS) | Safe, guided exercises that validate answers — no backend needed |

## Development

No build step required — everything loads from CDNs. Serve the folder statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## Contributing

Lessons live in `learn/`. Each lesson is a self-contained HTML page using the shared
header/sidebar/footer pattern. The simulated terminal component lives in
`assets/js/terminal.js` and is configured per-lesson via JSON.
