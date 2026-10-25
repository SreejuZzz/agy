/**
 * Terminal: press ~ (or the Terminal chip in Contact) for a small shell over the page.
 * `help` lists the commands; `cd` and `ssh contact` take you to a chapter; Tab completes and
 * ↑/↓ walk the history. A modal <dialog>, so focus stays inside it and Escape closes it.
 */

const PROMPT = 'guest@sreejuzzz:~$';

export function createTerminal({ milestones, skills, sections, onNavigate, ambient, lenis }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'terminal';
    dialog.setAttribute('aria-label', 'Terminal');
    dialog.innerHTML = `
        <div class="code-window terminal-window">
            <div class="code-header">
                <span class="code-dots" aria-hidden="true"><span></span><span></span><span></span></span>
                <span class="code-title">guest@sreejuzzz — bash</span>
                <button type="button" class="chip chip--small terminal-close" aria-label="Close terminal">esc</button>
            </div>
            <div class="code-body terminal-screen" role="log" aria-live="polite"></div>
            <form class="terminal-input-row">
                <label class="terminal-prompt" for="terminal-input">${PROMPT}</label>
                <input id="terminal-input" class="terminal-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
            </form>
        </div>
    `;
    document.body.appendChild(dialog);
    const screen = dialog.querySelector('.terminal-screen');
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input');

    const print = (text = '', cls = '') => {
        const line = document.createElement('div');
        line.className = `terminal-out ${cls}`.trim();
        line.textContent = text;
        screen.appendChild(line);
        screen.scrollTop = screen.scrollHeight;
    };
    const table = rows => {
        const widths = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length)));
        rows.forEach((r, i) => print(r.map((cell, c) => cell.padEnd(widths[c] + 3)).join('').trimEnd(), i === 0 ? 'is-dim' : ''));
    };

    const current = milestones[milestones.length - 1];
    const since = parseInt(milestones[0].period, 10);
    const go = (id, label) => {
        print(`→ ${label}`, 'is-accent');
        setTimeout(() => { close(); onNavigate(`#${id}`); }, 350);
    };

    const COMMANDS = {
        help: () => {
            table([
                ['COMMAND', 'WHAT IT DOES'],
                ['whoami', 'who runs this place'],
                ['ls', 'the chapters of this site'],
                ['cd <chapter>', 'go to a chapter (cd skills, cd ..)'],
                ['experience', 'the career so far'],
                ['kubectl get pods', 'the same, as a cluster'],
                ['skills', 'the tech stack'],
                ['projects', 'case studies and repos'],
                ['certs', 'certifications'],
                ['ssh contact', 'get in touch'],
                ['uptime', 'how long this has been running'],
                ['sound on|off', 'ambient sound'],
                ['clear, exit', ''],
            ]);
        },
        whoami: () => {
            print('Sreejith M S');
            print(`${current.title} @ ${current.company}`, 'is-dim');
            print('RHCSA · AWS SAA · 700+ students mentored', 'is-dim');
        },
        ls: () => print(sections.map(s => `${s.dir}/`).join('   '), 'is-accent'),
        cd: ([target = '~']) => {
            const name = target.replace(/\/$/, '').toLowerCase();
            if (name === '~' || name === '..' || name === '/' || name === 'home') return go('home', 'home');
            const s = sections.find(s => s.dir === name);
            if (!s) return print(`cd: ${target}: No such file or directory`, 'is-error');
            go(s.id, s.dir);
        },
        experience: () => [...milestones].reverse().forEach(m =>
            print(`${m.period.padEnd(16)}${m.title} · ${m.company.split(',')[0]}`)),
        kubectl: args => {
            if (args.join(' ') !== 'get pods') return print('try: kubectl get pods', 'is-dim');
            const now = new Date().getFullYear();
            table([
                ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'],
                ...milestones.map((m, i) => {
                    const start = parseInt(m.period, 10);
                    const end = i === milestones.length - 1 ? now : parseInt(milestones[i + 1].period, 10);
                    const live = i === milestones.length - 1;
                    return [
                        m.title.toLowerCase().replace(/&/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
                        live ? '1/1' : '0/1',
                        live ? 'Running' : 'Completed',
                        '0',
                        `${Math.max(1, end - start)}y`,
                    ];
                }),
            ]);
        },
        skills: () => skills.forEach(g => {
            print(g.category, 'is-accent');
            print(`  ${g.skills.join(' · ')}`);
        }),
        projects: () => {
            document.querySelectorAll('.case-study h3').forEach((h, i) => print(`case-0${i + 1}   ${h.textContent}`));
            document.querySelectorAll('.oss-row').forEach(a => print(`repo      ${a.querySelector('.oss-name').textContent}  ${a.href}`, 'is-dim'));
        },
        certs: () => {
            print('RHCSA     #250-136-470');
            print('AWS SAA   April 2026');
        },
        ssh: ([host]) => {
            if (host !== 'contact') return print(`ssh: Could not resolve hostname ${host ?? ''}`.trim(), 'is-error');
            print('Connecting to contact…', 'is-dim');
            print('email     sreejithmsreenivas@gmail.com');
            print('github    github.com/SreejuZzz');
            print('linkedin  linkedin.com/in/sreejith-sreenivas-110bb217a');
            go('portal-contact', 'contact');
        },
        uptime: () => {
            const years = new Date().getFullYear() - since;
            print(`up ${years} years, since ${since} · load average: kubernetes, terraform, mentoring`);
        },
        sound: ([state]) => {
            if (!ambient) return print('sound: not available', 'is-error');
            const value = state === 'on' ? true : state === 'off' ? false : !ambient.on;
            ambient.setOn(value);
            print(`ambient sound ${value ? 'on' : 'off'}`, 'is-dim');
        },
        sudo: () => print('guest is not in the sudoers file. This incident will be reported.', 'is-error'),
        rm: args => print(args.includes('-rf') ? 'Nice try. Backups are tested here.' : 'rm: permission denied', 'is-error'),
        date: () => print(new Date().toString()),
        echo: args => print(args.join(' ')),
        pwd: () => print('/home/guest'),
        history: () => history.forEach((h, i) => print(`${String(i + 1).padStart(4)}  ${h}`)),
        clear: () => screen.replaceChildren(),
        exit: () => close(),
    };
    COMMANDS.cat = ([file]) => file?.startsWith('about') ? COMMANDS.whoami() : print(`cat: ${file ?? ''}: try whoami`, 'is-dim');
    COMMANDS.contact = () => COMMANDS.ssh(['contact']);
    COMMANDS.man = COMMANDS.help;

    const history = [];
    let historyAt = 0;

    function run(line) {
        print(`${PROMPT} ${line}`, 'is-cmd');
        const [name, ...args] = line.trim().split(/\s+/);
        if (!name) return;
        history.push(line);
        const command = COMMANDS[name.toLowerCase()];
        if (command) command(args);
        else print(`${name}: command not found. Type help.`, 'is-error');
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        const line = input.value;
        input.value = '';
        run(line);
        historyAt = history.length;
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            historyAt = Math.min(Math.max(historyAt + (e.key === 'ArrowUp' ? -1 : 1), 0), history.length);
            input.value = history[historyAt] ?? '';
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const [name, arg] = input.value.split(/\s+/);
            const pool = arg !== undefined && name === 'cd' ? sections.map(s => s.dir) : Object.keys(COMMANDS);
            const word = arg ?? name;
            const hits = pool.filter(p => p.startsWith(word));
            if (hits.length === 1) input.value = arg !== undefined ? `${name} ${hits[0]}` : `${hits[0]} `;
            else if (hits.length > 1) print(hits.join('   '), 'is-dim');
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            COMMANDS.clear();
        }
    });

    let opener = null;
    function open() {
        if (dialog.open) return;
        opener = document.activeElement;
        if (!screen.childElementCount) {
            print('Last login: just now, from the Orion Spur', 'is-dim');
            print('Type help to see what this shell can do.', 'is-dim');
        }
        dialog.showModal();
        lenis?.stop();
        input.focus();
    }
    function close() {
        if (!dialog.open) return;
        dialog.close();
        lenis?.start();   // now, not on the (queued) close event, so a jump that follows can scroll
    }
    dialog.addEventListener('close', () => {
        lenis?.start();
        opener?.focus?.({ preventScroll: true });
    });
    dialog.querySelector('.terminal-close').addEventListener('click', close);
    // A click on the backdrop (outside the window) closes it
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });

    document.addEventListener('keydown', e => {
        if (e.key !== '~' && e.key !== '`') return;
        if (e.ctrlKey || e.metaKey || e.altKey || dialog.open) return;
        const t = e.target;
        if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        open();
    });

    return { open, close };
}
