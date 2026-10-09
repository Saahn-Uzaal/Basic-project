const API = '/api/tasks';

const form = document.getElementById('task-form');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const list = document.getElementById('task-list');
const empty = document.getElementById('empty');
const message = document.getElementById('message');
const template = document.getElementById('task-template');

let editingId = null;

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Lỗi ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'Thêm';
  cancelBtn.hidden = true;
}

function render(tasks) {
  list.replaceChildren();
  empty.hidden = tasks.length > 0;

  for (const task of tasks) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.toggle('done', task.completed);
    node.querySelector('.task-title').textContent = task.title;
    node.querySelector('.task-desc').textContent = task.description || '';

    const toggle = node.querySelector('.task-toggle');
    toggle.checked = task.completed;
    toggle.addEventListener('change', () =>
      save(task.id, { title: task.title, description: task.description, completed: toggle.checked })
    );

    node.querySelector('.task-edit').addEventListener('click', () => {
      editingId = task.id;
      titleInput.value = task.title;
      descInput.value = task.description || '';
      submitBtn.textContent = 'Cập nhật';
      cancelBtn.hidden = false;
      titleInput.focus();
    });

    node.querySelector('.task-delete').addEventListener('click', async () => {
      if (!confirm(`Xóa "${task.title}"?`)) return;
      try {
        await request(`${API}/${task.id}`, { method: 'DELETE' });
        if (editingId === task.id) resetForm();
        await load();
      } catch (err) {
        showMessage(err.message);
      }
    });

    list.appendChild(node);
  }
}

async function load() {
  try {
    render(await request(API));
    showMessage('');
  } catch (err) {
    showMessage(err.message);
  }
}

async function save(id, payload) {
  try {
    await request(id ? `${API}/${id}` : API, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    await load();
    return true;
  } catch (err) {
    showMessage(err.message);
    return false;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: titleInput.value,
    description: descInput.value.trim() || null,
  };
  if (await save(editingId, payload)) resetForm();
});

cancelBtn.addEventListener('click', resetForm);

load();
