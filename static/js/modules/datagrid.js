import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, closeModal } from '../components/modal.js';

let currentPage = 1;
let totalPages = 1;
let currentSort = 'sort_order';
let currentOrder = '';
let draggedRow = null;
let searchTimeout = null;

export function initDataGrid() {
  setupFilters();
  setupExport();
  setupAddTask();
  loadTasks();
}

function buildURL() {
  const search = valueOf('gridSearch');
  const status = valueOf('filterStatus');
  const priority = valueOf('filterPriority');
  const params = new URLSearchParams();
  params.set('page', String(currentPage));
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (currentOrder && currentSort) {
    params.set('ordering', (currentOrder === 'desc' ? '-' : '') + currentSort);
  }
  return `/tasks/?${params.toString()}`;
}

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function renderSkeletonRows(tbody) {
  tbody.innerHTML = '';
  for (let i = 0; i < 6; i += 1) {
    const tr = document.createElement('tr');
    tr.className = 'data-table__row--skeleton';
    tr.innerHTML = `
      <td><span class="skeleton skeleton--square"></span></td>
      <td><span class="skeleton skeleton--text"></span></td>
      <td><span class="skeleton skeleton--pill"></span></td>
      <td><span class="skeleton skeleton--pill"></span></td>
      <td><span class="skeleton skeleton--text"></span></td>
      <td><span class="skeleton skeleton--text skeleton--short"></span></td>
      <td><span class="skeleton skeleton--text skeleton--short"></span></td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadTasks() {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;
  renderSkeletonRows(tbody);

  try {
    const response = await api.get(buildURL());
    if (response && response.status === 'success') {
      const data = Array.isArray(response.data)
        ? response.data
        : response.data && response.data.results
          ? response.data.results
          : [];
      currentPage = (response.pagination && response.pagination.current_page) || 1;
      totalPages = (response.pagination && response.pagination.total_pages) || 1;
      renderTable(data);
      updatePagination();
    } else {
      renderEmpty(tbody, 'No data returned.');
    }
  } catch (error) {
    console.error('[DataGrid] loadTasks failed:', error);
    const message = error.status === 401
      ? 'Sign in to view and manage tasks.'
      : error.message || 'Failed to load tasks.';
    renderError(tbody, message);
    if (error.status !== 401) {
      showToast({ type: 'error', title: 'Grid error', message });
    }
  }
}

function renderEmpty(tbody, message) {
  tbody.innerHTML = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 7;
  td.className = 'table-empty';
  td.innerHTML = `
    <div class="empty-state">
      <svg class="icon icon--xl empty-state__icon" aria-hidden="true"><use href="#icon-table"></use></svg>
      <span class="empty-state__text"></span>
    </div>`;
  td.querySelector('.empty-state__text').textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function renderError(tbody, message) {
  tbody.innerHTML = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 7;
  td.className = 'table-empty';
  td.innerHTML = `
    <div class="empty-state">
      <svg class="icon icon--xl empty-state__icon" aria-hidden="true"><use href="#icon-shield"></use></svg>
      <span class="empty-state__text"></span>
      <button class="btn btn--ghost btn--sm" id="retryLoad" style="margin-top:0.75rem;">Retry</button>
    </div>`;
  td.querySelector('.empty-state__text').textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
  const retry = document.getElementById('retryLoad');
  if (retry) retry.addEventListener('click', loadTasks);
}

function renderTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;

  if (!tasks.length) {
    renderEmpty(tbody, 'No tasks found. Try adjusting filters or add a new task.');
    return;
  }

  tbody.innerHTML = '';

  tasks.forEach((task) => {
    const tr = document.createElement('tr');
    tr.setAttribute('draggable', 'true');
    tr.dataset.id = task.id;
    tr.dataset.sort = String(task.sort_order);

    tr.appendChild(td('col-drag', '', 'Drag to reorder'));
    const dragCell = tr.querySelector('.col-drag');
    dragCell.innerHTML = '<svg class="icon icon--grip" aria-hidden="true"><use href="#icon-grip"></use></svg>';
    
    tr.appendChild(tdText('col-title', task.title, { field: 'title' }));
    tr.appendChild(tdBadge('col-status', task.status, 'status-badge'));
    tr.appendChild(tdBadge('col-priority', task.priority, 'priority-badge'));
    tr.appendChild(tdText('col-assigned', task.assigned_to_detail ? task.assigned_to_detail.email : '—'));
    tr.appendChild(tdText('col-due', task.due_date || '—'));

    const actions = document.createElement('td');
    actions.className = 'col-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--ghost btn--xs edit-btn';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-edit"></use></svg>';
    editBtn.addEventListener('click', () => startInlineEdit(task.id));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--ghost btn--xs delete-btn';
    delBtn.setAttribute('aria-label', 'Delete task');
    delBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>';
    delBtn.addEventListener('click', () => confirmDelete(task.id));
    actions.appendChild(delBtn);

    tr.appendChild(actions);

    tr.addEventListener('dragstart', handleDragStart);
    tr.addEventListener('dragover', handleDragOver);
    tr.addEventListener('dragleave', handleDragLeave);
    tr.addEventListener('drop', handleDrop);
    tr.addEventListener('dragend', handleDragEnd);

    tr.addEventListener('dblclick', (e) => {
      if (e.target.closest('.col-actions') || e.target.closest('.col-drag')) return;
      startInlineEdit(task.id);
    });

    tbody.appendChild(tr);
  });
}

function td(className, textContent, ariaLabel) {
  const cell = document.createElement('td');
  cell.className = className;
  if (textContent) cell.textContent = textContent;
  if (ariaLabel) cell.setAttribute('aria-label', ariaLabel);
  return cell;
}

function tdText(className, text, attrs = {}) {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  if (attrs.field) cell.dataset.field = attrs.field;
  return cell;
}

function tdBadge(className, value, badgeClass) {
  const cell = document.createElement('td');
  cell.className = className;
  const span = document.createElement('span');
  span.className = `${badgeClass} ${badgeClass}--${value}`;
  span.textContent = value;
  cell.appendChild(span);
  return cell;
}

function startInlineEdit(taskId) {
  const row = document.querySelector(`tr[data-id="${taskId}"]`);
  if (!row || row.classList.contains('editing')) return;

  const titleCell = row.querySelector('.col-title');
  const statusCell = row.querySelector('.col-status');
  const priorityCell = row.querySelector('.col-priority');
  const actionsCell = row.querySelector('.col-actions');

  const prevState = {
    title: titleCell ? titleCell.textContent : '',
    status: statusCell ? statusCell.querySelector('.status-badge').textContent : 'pending',
    priority: priorityCell ? priorityCell.querySelector('.priority-badge').textContent : 'medium',
  };

  row.classList.add('editing');

  titleCell.innerHTML = '';
  const titleInput = document.createElement('input');
  titleInput.className = 'inline-edit-input';
  titleInput.value = prevState.title;
  titleCell.appendChild(titleInput);

  statusCell.innerHTML = '';
  const statusSel = buildSelect(['pending', 'in_progress', 'completed', 'failed'], prevState.status);
  statusCell.appendChild(statusSel);

  priorityCell.innerHTML = '';
  const prioSel = buildSelect(['low', 'medium', 'high', 'critical'], prevState.priority);
  priorityCell.appendChild(prioSel);

  actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary btn--xs';
    saveBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg>';
    saveBtn.setAttribute('aria-label', 'Save');
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost btn--xs';
    cancelBtn.innerHTML = '&times;';
    cancelBtn.setAttribute('aria-label', 'Cancel');
  actionsCell.appendChild(saveBtn);
  actionsCell.appendChild(cancelBtn);

  saveBtn.addEventListener('click', () => saveInlineEdit(taskId, row, prevState));
  cancelBtn.addEventListener('click', () => cancelInlineEdit(taskId, row, prevState));

  titleInput.focus();
  titleInput.select();
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveInlineEdit(taskId, row, prevState);
    if (e.key === 'Escape') cancelInlineEdit(taskId, row, prevState);
  });
}

function buildSelect(options, selected) {
  const sel = document.createElement('select');
  sel.className = 'inline-edit-select';
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === selected) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

async function saveInlineEdit(taskId, row, prevState) {
  const titleInput = row.querySelector('.inline-edit-input');
  const statusSel = row.querySelector('.col-status select');
  const prioSel = row.querySelector('.col-priority select');

  const title = titleInput ? titleInput.value.trim() : '';
  if (!title) {
    showToast({ type: 'warning', message: 'Title cannot be empty' });
    return;
  }

  try {
    await api.patch(`/tasks/${taskId}/`, {
      title,
      status: statusSel.value,
      priority: prioSel.value,
    });
    showToast({ type: 'success', message: 'Task updated' });
    loadTasks();
  } catch (error) {
    console.error('[DataGrid] saveInlineEdit failed:', error);
    cancelInlineEdit(taskId, row, prevState);
    showToast({ type: 'error', message: error.message });
  }
}

function cancelInlineEdit(taskId, row, prevState) {
  row.classList.remove('editing');
  const titleCell = row.querySelector('.col-title');
  const statusCell = row.querySelector('.col-status');
  const priorityCell = row.querySelector('.col-priority');
  const actionsCell = row.querySelector('.col-actions');

  if (titleCell) titleCell.textContent = prevState.title;

  if (statusCell) {
    statusCell.innerHTML = '';
    const span = document.createElement('span');
    span.className = `status-badge status-badge--${prevState.status}`;
    span.textContent = prevState.status;
    statusCell.appendChild(span);
  }

  if (priorityCell) {
    priorityCell.innerHTML = '';
    const span = document.createElement('span');
    span.className = `priority-badge priority-badge--${prevState.priority}`;
    span.textContent = prevState.priority;
    priorityCell.appendChild(span);
  }

  if (actionsCell) {
    actionsCell.innerHTML = '';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--ghost btn--xs edit-btn';
    editBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-edit"></use></svg>';
    editBtn.addEventListener('click', () => startInlineEdit(taskId));
    actionsCell.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--ghost btn--xs delete-btn';
    delBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>';
    delBtn.addEventListener('click', () => confirmDelete(taskId));
    actionsCell.appendChild(delBtn);
  }
}

function confirmDelete(taskId) {
  showModal({
    title: 'Delete Task',
    body: '<p>Are you sure you want to delete this task? This action cannot be undone.</p>',
    footer: `
      <button class="btn btn--ghost" id="modalCancelBtn">Cancel</button>
      <button class="btn btn--danger" id="modalConfirmBtn">Delete</button>`,
  });

  const cancelBtn = document.getElementById('modalCancelBtn');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      try {
        await api.delete(`/tasks/${taskId}/`);
        showToast({ type: 'success', message: 'Task deleted' });
        closeModal();
        loadTasks();
      } catch (error) {
        console.error('[DataGrid] delete failed:', error);
        showToast({ type: 'error', message: error.message });
        closeModal();
      }
    });
  }
}

function handleDragStart(e) {
  draggedRow = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (!draggedRow || draggedRow === this) return;

  const tbody = document.getElementById('tasksTableBody');
  const rows = [...tbody.querySelectorAll('tr[draggable]')];
  const fromIdx = rows.indexOf(draggedRow);
  const toIdx = rows.indexOf(this);
  if (fromIdx < 0 || toIdx < 0) return;

  if (toIdx > fromIdx) {
    this.after(draggedRow);
  } else {
    this.before(draggedRow);
  }

  const newRows = [...tbody.querySelectorAll('tr[draggable]')];
  const orderedIds = newRows.map((r) => r.dataset.id);

  try {
    await api.post('/tasks/reorder/', { ordered_ids: orderedIds });
    showToast({ type: 'success', message: 'Order updated', duration: 2000 });
  } catch (error) {
    console.error('[DataGrid] reorder failed:', error);
    showToast({ type: 'error', message: 'Failed to save order' });
    loadTasks();
  }
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('#tasksTableBody tr').forEach((r) => r.classList.remove('drag-over'));
  draggedRow = null;
}

function updatePagination() {
  const info = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (info) info.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function setupFilters() {
  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  const search = document.getElementById('gridSearch');
  const filterStatus = document.getElementById('filterStatus');
  const filterPriority = document.getElementById('filterPriority');

  if (prev) {
    prev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        loadTasks();
      }
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage += 1;
        loadTasks();
      }
    });
  }

  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadTasks();
      }, 300);
    });
  }

  [filterStatus, filterPriority].forEach((el) => {
    if (el) {
      el.addEventListener('change', () => {
        currentPage = 1;
        loadTasks();
      });
    }
  });

  document.querySelectorAll('.data-table th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const sort = th.dataset.sort;
      if (currentSort === sort) {
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = sort;
        currentOrder = 'asc';
      }
      document.querySelectorAll('.data-table th').forEach((h) => h.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', currentOrder === 'asc' ? 'ascending' : 'descending');
      loadTasks();
    });
  });
}

function setupExport() {
  const btn = document.getElementById('exportCsvBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="btn__spinner" aria-hidden="true"></span> Exporting...';
    try {
      const response = await api.post('/tasks/export-csv/');
      if (response && response.status === 'success' && response.data && response.data.task_id) {
        showToast({ type: 'info', message: 'CSV export started. Polling for result...', duration: 3000 });
        pollExport(response.data.task_id, originalHTML);
      } else {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    } catch (error) {
      console.error('[DataGrid] export failed:', error);
      showToast({ type: 'error', message: error.message });
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });
}

async function pollExport(taskId, originalHTML, attempts = 0) {
  const btn = document.getElementById('exportCsvBtn');
  if (attempts > 30) {
    showToast({ type: 'error', message: 'Export timed out' });
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
    return;
  }
  try {
    const response = await api.get(`/tasks/export-csv-download/?task_id=${taskId}`);
    if (response instanceof Blob) {
      const url = URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tasks_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'CSV downloaded' });
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
      return;
    }
  } catch (error) {
    if (error.status === 404) {
      setTimeout(() => pollExport(taskId, originalHTML, attempts + 1), 1500);
      return;
    }
    showToast({ type: 'error', message: error.message });
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

function setupAddTask() {
  const btn = document.getElementById('addTaskBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showModal({
      title: 'Add New Task',
      body: `
        <form id="addTaskForm" class="form-stack">
          <div class="form-group">
            <label class="form-label" for="newTaskTitle">Title</label>
            <input class="input" id="newTaskTitle" required placeholder="Task title" maxlength="255" />
          </div>
          <div class="form-group">
            <label class="form-label" for="newTaskDesc">Description</label>
            <textarea class="input" id="newTaskDesc" rows="3" placeholder="Task description"></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="newTaskStatus">Status</label>
              <select class="select" id="newTaskStatus">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="newTaskPriority">Priority</label>
              <select class="select" id="newTaskPriority">
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn--ghost" id="modalCancelBtn">Cancel</button>
        <button class="btn btn--primary" id="modalSaveBtn">Save</button>`,
    });

    const cancel = document.getElementById('modalCancelBtn');
    const save = document.getElementById('modalSaveBtn');
    if (cancel) cancel.addEventListener('click', closeModal);
    if (save) {
      save.addEventListener('click', async () => {
        const title = (document.getElementById('newTaskTitle') || {}).value;
        if (!title || !title.trim()) {
          showToast({ type: 'warning', message: 'Title is required' });
          return;
        }
        const payload = {
          title: title.trim(),
          description: (document.getElementById('newTaskDesc') || {}).value || '',
          status: (document.getElementById('newTaskStatus') || {}).value || 'pending',
          priority: (document.getElementById('newTaskPriority') || {}).value || 'medium',
        };
        try {
          await api.post('/tasks/', payload);
          showToast({ type: 'success', message: 'Task created' });
          closeModal();
          loadTasks();
        } catch (error) {
          console.error('[DataGrid] create failed:', error);
          showToast({ type: 'error', message: error.message });
        }
      });
    }
  });
}

export default { initDataGrid };
