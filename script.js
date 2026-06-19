// pulling saved tasks from localStorage
// if nothing saved yet, start with empty array
let tasks = JSON.parse(localStorage.getItem('taskflow-tasks') || '[]');
let nextId = parseInt(localStorage.getItem('taskflow-nextid') || '1');


// ─── NAVIGATION ──────────────────────────────────────

const sectionMeta = {
    tasks: { title: 'Task Manager', sub: 'Manage, organise and track your tasks' },
    attr: { title: 'Attributes vs Properties', sub: 'Understand the DOM attribute/property distinction' },
    events: { title: 'Event Propagation', sub: 'Bubbling, Capturing and Delegation — visualised' },
    pipeline: { title: 'Browser Pipeline', sub: 'From HTML bytes to pixels on screen' },
};

function showSection(id) {
    // remove active from all first
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // then activate the one we want
    document.getElementById('section-' + id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(id)) {
            n.classList.add('active');
        }
    });

    const m = sectionMeta[id];
    document.getElementById('section-title').textContent = m.title;
    document.getElementById('section-sub').textContent = m.sub;

    if (id === 'attr') renderAttrTaskList();
}


// ─── THEME TOGGLE ────────────────────────────────────
// storing theme in both setAttribute and dataset just to practice both

function toggleTheme() {
    const html = document.documentElement;

    const current = html.getAttribute('data-theme');   // getAttribute
    const next = current === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', next);             // setAttribute
    html.dataset.theme = next;                         // dataset (same thing, different way)

    document.getElementById('theme-label').textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
    localStorage.setItem('taskflow-theme', next);
}

// restore whatever theme the user had last time
(function () {
    const saved = localStorage.getItem('taskflow-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        document.documentElement.dataset.theme = saved;
        const label = document.getElementById('theme-label');
        if (label) label.textContent = saved === 'dark' ? '🌙 Dark' : '☀️ Light';
    }
})();


// ─── ADD TASK ────────────────────────────────────────

function addTask() {
    const input = document.getElementById('task-input');
    const catSel = document.getElementById('cat-select');
    const title = input.value.trim();

    if (!title) {
        showToast('Please enter a task title!', 'danger');
        return;
    }

    const task = {
        id: nextId++,
        title,
        category: catSel.value,
        status: 'pending',
        createdAt: Date.now(),
    };

    tasks.unshift(task); // newest goes to top
    saveTasks();

    const card = buildTaskCard(task);
    const container = document.getElementById('tasks-container');

    // if empty state is showing, remove it before adding a card
    const empty = document.getElementById('empty-state');
    if (empty) empty.remove();

    container.prepend(card); // prepend so newest task is always at top

    updateStats();
    input.value = '';
    showToast('Task added! 🎉', 'success');
}


// ─── BUILD TASK CARD ─────────────────────────────────
// building the whole card using createElement, no innerHTML here
// just practicing DOM manipulation properly

function buildTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.status === 'completed' ? ' completed' : '');

    // storing task info as data attributes so we can read them later
    card.setAttribute('data-id', task.id);
    card.setAttribute('data-status', task.status);
    card.setAttribute('data-category', task.category);

    // check circle — shows a tick if completed
    const check = document.createElement('div');
    check.className = 'task-check';
    if (task.status === 'completed') {
        check.appendChild(document.createTextNode('✓'));
    }

    // task info section
    const info = document.createElement('div');
    info.className = 'task-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'task-title';
    titleEl.appendChild(document.createTextNode(task.title));

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const tag = document.createElement('span');
    tag.className = 'tag tag-' + task.category;
    tag.appendChild(document.createTextNode(catEmoji(task.category) + ' ' + task.category));

    const idBadge = document.createElement('span');
    idBadge.className = 'task-id';
    idBadge.appendChild(document.createTextNode('#' + task.id));

    meta.append(tag, idBadge);
    info.append(titleEl, meta);

    // action buttons
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const btnEdit = makeBtn('✏️', 'btn btn-ghost btn-sm', 'edit', task.id);
    const btnComplete = makeBtn(
        task.status === 'completed' ? '↩️' : '✅',
        'btn btn-success btn-sm', 'complete', task.id
    );
    const btnDelete = makeBtn('🗑️', 'btn btn-danger btn-sm', 'delete', task.id);

    actions.append(btnEdit, btnComplete, btnDelete);
    card.append(check, info, actions);

    return card;
}

// small helper to make buttons — keeps buildTaskCard cleaner
function makeBtn(label, cls, action, id) {
    const b = document.createElement('button');
    b.className = cls;
    b.setAttribute('data-action', action);
    b.setAttribute('data-id', id);
    b.appendChild(document.createTextNode(label));
    return b;
}

function catEmoji(cat) {
    const map = { work: '💼', personal: '🏠', study: '📚', health: '💪', other: '🔖' };
    return map[cat] || '🔖';
}


// ─── EVENT DELEGATION ────────────────────────────────
// instead of adding click listeners to every single button,
// one listener on the container handles everything
// this is event delegation — uses event bubbling under the hood

document.getElementById('tasks-container').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = parseInt(btn.getAttribute('data-id'));

    if (action === 'delete') deleteTask(id);
    if (action === 'complete') toggleComplete(id);
    if (action === 'edit') startEdit(id, btn.closest('.task-card'));
    if (action === 'save') saveEdit(id, btn.closest('.task-card'));
    if (action === 'cancel') cancelEdit(id, btn.closest('.task-card'));
});


// ─── DELETE ──────────────────────────────────────────

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();

    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) {
        // small fade out before removing
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        card.style.transition = 'all 0.2s';
        setTimeout(() => card.remove(), 200);
    }

    updateStats();
    checkEmpty();
    showToast('Task deleted 🗑️', 'danger');
}


// ─── TOGGLE COMPLETE ─────────────────────────────────

function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.status = task.status === 'completed' ? 'pending' : 'completed';
    saveTasks();

    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    if (card) {
        card.setAttribute('data-status', task.status);
        card.classList.toggle('completed', task.status === 'completed');

        // rebuild card so the button icon updates too
        const fresh = buildTaskCard(task);
        card.replaceWith(fresh); // replaceWith — swaps old card with fresh one
    }

    updateStats();
    showToast(task.status === 'completed' ? 'Task completed! ✅' : 'Task reopened ↩️');
}


// ─── INLINE EDIT ─────────────────────────────────────

function startEdit(id, card) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // swap the title text with an input field
    const titleEl = card.querySelector('.task-title');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.title;
    input.className = 'task-edit-input';
    titleEl.replaceWith(input); // replaceWith

    // swap action buttons with save/cancel
    const actions = card.querySelector('.task-actions');
    const saveBtn = makeBtn('💾 Save', 'btn btn-success btn-sm', 'save', id);
    const cancelBtn = makeBtn('✖ Cancel', 'btn btn-ghost btn-sm', 'cancel', id);
    actions.innerHTML = '';
    actions.append(saveBtn, cancelBtn);
}

function saveEdit(id, card) {
    const input = card.querySelector('.task-edit-input');
    const newTitle = input ? input.value.trim() : '';

    if (!newTitle) {
        showToast('Title cannot be empty!', 'danger');
        return;
    }

    const task = tasks.find(t => t.id === id);
    if (task) {
        task.title = newTitle;
        saveTasks();
    }

    // rebuild card with updated title
    card.replaceWith(buildTaskCard(task));
    showToast('Task updated ✏️');
}

function cancelEdit(id, card) {
    const task = tasks.find(t => t.id === id);
    if (task) card.replaceWith(buildTaskCard(task)); // just rebuild from original data
}


// ─── SEARCH & FILTER ─────────────────────────────────

function filterTasks() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const catF = document.getElementById('filter-cat').value;
    const statF = document.getElementById('filter-status').value;

    document.querySelectorAll('.task-card').forEach(card => {
        const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
        const category = card.getAttribute('data-category');
        const status = card.getAttribute('data-status');

        const matchQ = title.includes(query);
        const matchC = catF === 'all' || category === catF;
        const matchS = statF === 'all' || status === statF;

        card.style.display = (matchQ && matchC && matchS) ? 'flex' : 'none';
    });
}


// ─── STATS ───────────────────────────────────────────

function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'completed').length;
    const cats = new Set(tasks.map(t => t.category)).size;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-done').textContent = done;
    document.getElementById('stat-pending').textContent = total - done;
    document.getElementById('stat-cats').textContent = cats;
}

function checkEmpty() {
    const container = document.getElementById('tasks-container');
    const cards = container.querySelectorAll('.task-card');
    let empty = document.getElementById('empty-state');

    if (cards.length === 0 && !empty) {
        empty = document.createElement('div');
        empty.id = 'empty-state';
        empty.className = 'empty-state';
        empty.innerHTML = '<div class="big">📭</div><p>No tasks yet. Add your first task above!</p>';
        container.append(empty);
    }
}

function clearAllTasks() {
    if (!tasks.length) { showToast('No tasks to clear!', 'danger'); return; }
    if (!confirm('Clear ALL tasks? This cannot be undone.')) return;

    tasks = [];
    saveTasks();
    renderAllTasks();
    updateStats();
    showToast('All tasks cleared 🗑️', 'danger');
}


// ─── RENDER & SAVE ───────────────────────────────────

function renderAllTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';

    if (!tasks.length) {
        const empty = document.createElement('div');
        empty.id = 'empty-state';
        empty.className = 'empty-state';
        empty.innerHTML = '<div class="big">📭</div><p>No tasks yet. Add your first task above!</p>';
        container.append(empty);
        return;
    }

    // using DocumentFragment to batch all cards into DOM in one go
    // instead of appending one by one (fewer repaints)
    const frag = document.createDocumentFragment();
    tasks.forEach(t => frag.append(buildTaskCard(t)));
    container.append(frag);
}

function saveTasks() {
    localStorage.setItem('taskflow-tasks', JSON.stringify(tasks));
    localStorage.setItem('taskflow-nextid', nextId);
}


// ─── ATTRIBUTES VS PROPERTIES DEMO ───────────────────
// this section shows the difference between .value and getAttribute('value')

function updateAttrDemo() {
    const inp = document.getElementById('demo-input');

    // .value = live DOM property, updates as user types
    document.getElementById('prop-out').textContent = inp.value;

    // getAttribute('value') = original HTML attribute, stays fixed
    document.getElementById('attr-out').textContent = inp.getAttribute('value');
}

function renderAttrTaskList() {
    const list = document.getElementById('attr-task-list');
    list.innerHTML = '';

    if (!tasks.length) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">Add some tasks first to inspect their attributes here.</p>';
        return;
    }

    // show first 5 tasks with their data attributes
    tasks.slice(0, 5).forEach(task => {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--info);';
        card.textContent =
            `data-id="${task.id}"  data-status="${task.status}"  data-category="${task.category}"  ` +
            `(title: "${task.title.substring(0, 30)}${task.title.length > 30 ? '…' : ''}")`;
        list.append(card);
    });
}

// small demo buttons to try out attribute methods live
function demoGetAttr() {
    const el = document.querySelector('.task-card') || document.documentElement;
    const result = el.getAttribute('data-id') || el.getAttribute('data-theme');
    log('attr-console', `getAttribute('data-id')\n→ "${result}"\n(Returns string or null)`);
}

function demoSetAttr() {
    document.documentElement.setAttribute('data-demo', 'active');
    log('attr-console', `setAttribute('data-demo', 'active')\n→ Set on <html>\n→ getAttribute('data-demo') === "active"`);
}

function demoRemoveAttr() {
    document.documentElement.removeAttribute('data-demo');
    log('attr-console', `removeAttribute('data-demo')\n→ Removed from <html>\n→ hasAttribute('data-demo') is now false`);
}

function demoHasAttr() {
    const hasTheme = document.documentElement.hasAttribute('data-theme');
    log('attr-console', `hasAttribute('data-theme')\n→ ${hasTheme}`);
}

function demoDataset() {
    document.documentElement.dataset.demoDataset = 'hello-dataset';
    log('attr-console', `dataset.demoDataset = 'hello-dataset'\n→ Sets data-demo-dataset="hello-dataset"\n→ camelCase in JS = kebab-case in HTML, auto converted`);
}

function log(id, msg) {
    document.getElementById(id).textContent = msg;
}


// ─── EVENT PROPAGATION DEMOS ─────────────────────────

// BUBBLING — default behavior, no extra argument needed
// order: child → parent → grandparent
const gpBubble = document.getElementById('gp-bubble');
const pBubble = document.getElementById('p-bubble');
const childBubble = document.getElementById('child-bubble');

childBubble.addEventListener('click', function (e) {
    logProp('bubble-log', '👶 Child fired first', 'bubble');
});
pBubble.addEventListener('click', function (e) {
    logProp('bubble-log', '👨 Parent fired next (event bubbled up)', 'bubble');
});
gpBubble.addEventListener('click', function (e) {
    if (e.target === gpBubble) return;
    logProp('bubble-log', '👴 Grandparent fired last (bubbled all the way up)', 'bubble');
});


// CAPTURING — pass { capture: true } or just true as 3rd argument
// order: grandparent → parent → child (opposite of bubbling)
const gpCapture = document.getElementById('gp-capture');
const pCapture = document.getElementById('p-capture');
const childCapture = document.getElementById('child-capture');

gpCapture.addEventListener('click', function (e) {
    if (e.target === gpCapture) return;
    logProp('capture-log', '👴 Grandparent fired first (capturing, top to bottom)', 'capture');
}, true); // true = capture phase

pCapture.addEventListener('click', function (e) {
    logProp('capture-log', '👨 Parent fired next (still going down)', 'capture');
}, true);

childCapture.addEventListener('click', function (e) {
    logProp('capture-log', '👶 Child fired last (reached the target)', 'capture');
}, true);


function logProp(logId, msg, type) {
    const box = document.getElementById(logId);
    box.querySelectorAll('span[style*="italic"]').forEach(s => s.remove());

    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + type;
    entry.textContent = '→ ' + msg;
    box.append(entry);
    box.scrollTop = box.scrollHeight;
}

function clearLog(id) {
    const box = document.getElementById(id);
    box.innerHTML = '<span style="color:var(--text-muted);font-style:italic">Log cleared. Click to see events again…</span>';
}


// ─── EVENT DELEGATION DEMO ───────────────────────────
// one listener on the parent list handles clicks on all chips
// works even for chips added after the page loads — that's the point

const fruits = ['Mango', 'Grapes', 'Watermelon', 'Peach', 'Pear', 'Kiwi'];
let fi = 0;

function addDelegationItem() {
    const list = document.getElementById('delegation-list');
    const name = fruits[fi % fruits.length]; fi++;

    const chip = document.createElement('button');
    chip.className = 'chip active';
    chip.setAttribute('data-item', name);
    chip.appendChild(document.createTextNode('🍑 ' + name));
    list.append(chip);
}

// single parent listener — catches clicks on any chip, current or future
document.getElementById('delegation-list').addEventListener('click', function (e) {
    const chip = e.target.closest('[data-item]');
    if (!chip) return;

    const item = chip.getAttribute('data-item');
    const box = document.getElementById('delegation-log');
    box.querySelectorAll('span[style*="italic"]').forEach(s => s.remove());

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.color = 'var(--success)';
    entry.textContent = `→ Clicked "${item}" — caught by parent listener`;
    box.append(entry);
    box.scrollTop = box.scrollHeight;
});


// ─── TOAST ───────────────────────────────────────────

function showToast(msg, type = 'default') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.append(toast);
    setTimeout(() => toast.remove(), 2800);
}


// ─── INIT ────────────────────────────────────────────

renderAllTasks();
updateStats();

// Enter key to add task quickly
document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
});

// ─── HAMBURGER MENU ───────────────────────────────────

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.toggle('open');
    btn.classList.toggle('open');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.remove('open');
    btn.classList.remove('open');
    overlay.classList.remove('active');
}