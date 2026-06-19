# ⚡ TaskFlow — DOM Mastery Project

A hands-on project built to deeply understand core JavaScript and DOM concepts through real, working code.

---

## 🧠 Core JS Concepts Used

### 1. Event Delegation

Instead of attaching a click listener to every single button, TaskFlow uses **one listener on the parent container** that handles all button clicks inside it.

```js
document.getElementById('tasks-container').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = parseInt(btn.getAttribute('data-id'));

    if (action === 'delete') deleteTask(id);
    if (action === 'complete') toggleComplete(id);
    if (action === 'edit') startEdit(id, btn.closest('.task-card'));
});
```

**Why this works:** Events bubble up from the clicked element to its ancestors. So clicking a `<button>` inside `.task-card` inside `#tasks-container` — the event travels up and gets caught by the container's listener.

**Why it matters:** New task cards added dynamically still work — no need to re-attach listeners. This is the real power of delegation.

---

### 2. Attributes vs Properties

These are not the same thing. The distinction becomes clear in the "Attributes vs Properties" section of the app.

```js
const inp = document.getElementById('demo-input');

inp.value                  // DOM property — live, updates as user types
inp.getAttribute('value')  // HTML attribute — stays fixed to the initial HTML value
```

**Key rule:** Attributes are what's written in HTML. Properties are what the DOM holds in memory. They start the same but diverge the moment the user interacts.

**In this project**, every task card stores its state using `data-*` attributes so filters and event delegation can read them without touching the `tasks` array:

```js
card.setAttribute('data-id', task.id);
card.setAttribute('data-status', task.status);
card.setAttribute('data-category', task.category);
```

---

### 3. All Four Attribute API Methods

```js
el.getAttribute('data-id')          // read — returns string or null
el.setAttribute('data-demo', 'on')  // write — sets or overwrites
el.removeAttribute('data-demo')     // delete
el.hasAttribute('data-theme')       // check — returns true/false
```

And the `dataset` shortcut (camelCase in JS → kebab-case in HTML, auto-converted):

```js
document.documentElement.dataset.theme = 'dark';
// same as setAttribute('data-theme', 'dark')
```

---

### 4. DOM Manipulation — No innerHTML (Mostly)

Task cards are built purely with `createElement`, `appendChild`, and `createTextNode`. This avoids XSS risks that come with directly injecting `innerHTML`.

```js
function buildTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-id', task.id);

    const titleEl = document.createElement('div');
    titleEl.className = 'task-title';
    titleEl.appendChild(document.createTextNode(task.title));
    // ...
}
```

**`replaceWith()`** is used in multiple places to swap a card with a fresh rebuild — cleaner than manually updating individual properties:

```js
card.replaceWith(buildTaskCard(task));  // toggleComplete, saveEdit, cancelEdit
```

---

### 5. DocumentFragment for Batch DOM Inserts

When loading all tasks at startup, they are collected into a `DocumentFragment` first, then inserted into the DOM in a single operation. This reduces repaints.

```js
const frag = document.createDocumentFragment();
tasks.forEach(t => frag.append(buildTaskCard(t)));
container.append(frag);
```

Without this, appending N cards one by one would trigger N layout recalculations.

---

### 6. Event Bubbling

Default behavior — events fire on the target first, then travel up through ancestors.

```js
childEl.addEventListener('click', () => console.log('child'));  // fires 1st
parentEl.addEventListener('click', () => console.log('parent')); // fires 2nd
grandparentEl.addEventListener('click', () => console.log('grandparent')); // fires 3rd
```

This is exactly what makes event delegation possible.

---

### 7. Event Capturing

The opposite direction — outermost ancestor fires first, travels down to the target. Enabled by passing `true` as the third argument:

```js
grandparentEl.addEventListener('click', handler, true);  // fires 1st (capture)
parentEl.addEventListener('click', handler, true);       // fires 2nd
childEl.addEventListener('click', handler, true);        // fires last (target)
```

**In practice:** Capturing is rarely used, but understanding it explains the full event lifecycle — capture down, bubble up.

---

### 8. `event.target` vs `event.currentTarget`

Inside any event listener:

- `event.target` — the element that was actually clicked (deepest element)
- `event.currentTarget` — the element the listener is attached to

In the delegation pattern, `currentTarget` is always `#tasks-container`, while `target` could be any button inside it. `.closest('[data-action]')` is used to safely walk up from `e.target` to the button, even if the user clicks the emoji text inside the button.

---

### 9. localStorage for Persistence

Tasks and the active theme are saved to `localStorage` so state survives page refreshes.

```js
function saveTasks() {
    localStorage.setItem('taskflow-tasks', JSON.stringify(tasks));
    localStorage.setItem('taskflow-nextid', nextId);
}

// On load
let tasks = JSON.parse(localStorage.getItem('taskflow-tasks') || '[]');
```

An IIFE (Immediately Invoked Function Expression) restores the theme on load without waiting for a button click:

```js
(function () {
    const saved = localStorage.getItem('taskflow-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
```

---

### 10. Theme Toggle — setAttribute + dataset

The theme toggle uses both `setAttribute` and `dataset` to set the same attribute — just to practice both APIs side-by-side:

```js
html.setAttribute('data-theme', next);   // setAttribute
html.dataset.theme = next;               // dataset — identical result
```

CSS then responds to `[data-theme="dark"]` and `[data-theme="light"]` via CSS custom properties.

---

### 11. Inline Edit Flow — DOM Swap Pattern

When editing a task, the title `<div>` is replaced with an `<input>`, and the action buttons are replaced with Save/Cancel. On save or cancel, the whole card is rebuilt from the original data object.

```js
function startEdit(id, card) {
    const titleEl = card.querySelector('.task-title');
    const input = document.createElement('input');
    input.value = task.title;
    titleEl.replaceWith(input);  // swap text with input
}

function cancelEdit(id, card) {
    const task = tasks.find(t => t.id === id);
    card.replaceWith(buildTaskCard(task));  // rebuild from source of truth
}
```

The `tasks` array is the source of truth. DOM is just the view.

---

### 12. Filter — Reading data-* Attributes

The search and filter logic reads directly from data attributes on task cards, avoiding a full re-render:

```js
document.querySelectorAll('.task-card').forEach(card => {
    const title    = card.querySelector('.task-title')?.textContent.toLowerCase();
    const category = card.getAttribute('data-category');
    const status   = card.getAttribute('data-status');

    const match = title.includes(query) && 
                  (catF === 'all' || category === catF) && 
                  (statF === 'all' || status === statF);

    card.style.display = match ? 'flex' : 'none';
});
```

HTML bytes → Parsing → Tokenization → DOM Tree ──┐

├──→ Render Tree → Layout → Paint → Composite

CSS bytes  → Parsing → CSSOM Tree ────────────────┘

- `display: none` → excluded from Render Tree entirely
- `visibility: hidden` → included in Render Tree, but invisible
- Changing layout properties (width, margin) triggers **reflow** (expensive)
- Changing only paint properties (color, background) triggers **repaint** (cheaper)
- Using `transform` and `opacity` only triggers **compositing** (cheapest — GPU-handled)

---

## 📁 Project Structure

---

## 🔄 Browser Rendering Pipeline (Quick Reference)

taskflow/

├── index.html   — markup, sections, event hooks

├── style.css    — CSS custom properties, dark/light themes, component styles

└── script.js    — all JS logic

---

## 💡 Key Takeaways

| Concept | Where Used |
|---|---|
| Event delegation | `#tasks-container` click handler |
| Bubbling | Powers delegation; shown in Event Propagation demo |
| Capturing | Demonstrated separately with `true` flag |
| `data-*` attributes | Task cards store id, status, category |
| `getAttribute` / `setAttribute` | Theme toggle, delegation reads |
| `dataset` | Theme toggle (alternate syntax practice) |
| `replaceWith()` | Toggle complete, inline edit save/cancel |
| `DocumentFragment` | Batch task render on load |
| `localStorage` | Task persistence + theme memory |
| IIFE | Theme restore on page load |

---

## 💡 Key Takeaways

| Concept | Where Used |
|---|---|
| Event delegation | `#tasks-container` click handler |
| Bubbling | Powers delegation; shown in Event Propagation demo |
| Capturing | Demonstrated separately with `true` flag |
| `data-*` attributes | Task cards store id, status, category |
| `getAttribute` / `setAttribute` | Theme toggle, delegation reads |
| `dataset` | Theme toggle (alternate syntax practice) |
| `replaceWith()` | Toggle complete, inline edit save/cancel |
| `DocumentFragment` | Batch task render on load |
| `localStorage` | Task persistence + theme memory |
| IIFE | Theme restore on page load |

