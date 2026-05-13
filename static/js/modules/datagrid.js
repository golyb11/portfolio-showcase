import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, closeModal } from '../components/modal.js';

let currentPage = 1;
let totalPages = 1;
let currentSort = 'sort_order';
let currentOrder = '';
let draggedRow = null;

export function initDataGrid() {
  loadTasks();
  setupFilters();
  setupExport();
  setupAddTask();
}

function buildURL() {
  const search = document.getElementById('gridSearch')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const priority = document.getElementById('filterPriority')?.value || '';
  const params = new URLSearchParams();
  params.set('page', currentPage);
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (currentOrder && currentSort) {
    params.set('ordering', (currentOrder === 'desc' ? '-' : '') + currentSort);
  }
  return `/tasks/?${params.toString()}`;
}

async function loadTasks() {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="table-loading"><div class="loading-spinner"></div>Loading tasks...</td></tr>`;

  try {
    const response = await api.get(buildURL());
    if (response.status === 'success') {
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      currentPage = response.pagination?.current_page || 1;
      totalPages = response.pagination?.total_pages || 1;
      renderTable(data);
      updatePagination();
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading">Failed to load tasks. <button class="btn btn--ghost btn--sm" id="retryLoad">Retry</button></td></tr>`;
    document.getElementById('retryLoad')?.addEventListener('click', loadTasks);
    showToast({ type: 'error', title: 'Error', message: error.message });
  }
}

function renderTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;
  if (!tasks.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="empty-state"><span class="empty-state__icon">\u2205</span><span class="empty-state__text">No tasks found</span></div></td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const statusClass = `status-badge--${task.status}`;
    const priorityClass = `priority-badge--${task.priority}`;
    const assigned = task.assigned_to_detail ? task.assigned_to_detail.email : '\u2014';
    const dueDate = task.due_date || '\u2014';
    const title = escapeHTML(task.title);
    return `
      <tr draggable="true" data-id="${task.id}" data-sort="${task.sort_order}">
        <td class="col-drag" aria-label="Drag to reorder">\u234F</td>
        <td class="col-title" data-field="title">${title}</td>
        <td class="col-status" data-field="status"><span class="status-badge ${statusClass}">${task.status}</span></td>
        <td class="col-priority" data-field="priority"><span class="priority-badge ${priorityClass}">${task.priority}</span></td>
        <td class="col-assigned">${assigned}</td>
        <td class="col-due">${dueDate}</td>
        <td class="col-actions">
          <button class="btn btn--ghost btn--xs edit-btn" data-id="${task.id}" aria-label="Edit task">\u270E</button>
          <button class="btn btn--ghost btn--xs delete-btn" data-id="${task.id}" aria-label="Delete task">\u2717</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => startInlineEdit(btn.dataset.id));
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });

  tbody.querySelectorAll('tr[draggable]').forEach(row => {
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);
  });

  tbody.querySelectorAll('tr[draggable]').forEach(row => {
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('.col-actions') || e.target.closest('.col-drag')) return;
      startInlineEdit(row.dataset.id);
    });
  });
}

function startInlineEdit(taskId) {
  const row = document.querySelector(`tr[data-id="${taskId}"]`);
  if (!row || row.classList.contains('editing')) return;

  const prevState = {
    title: row.querySelector('.col-title')?.textContent || '',
    status: row.querySelector('.col-status .status-badge')?.textContent || 'pending',
    priority: row.querySelector('.col-priority .priority-badge')?.textContent || 'medium',
  };

  row.classList.add('editing');
  row.querySelector('.col-title').innerHTML = `<input class="inline-edit-input" value="${escapeHTML(prevState.title)}" />`;
  row.querySelector('.col-status').innerHTML = `
    <select class="inline-edit-select">
      <option value="pending" ${prevState.status === 'pending' ? 'selected' : ''}>Pending</option>
      <option value="in_progress" ${prevState.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
      <option value="completed" ${prevState.status === 'completed' ? 'selected' : ''}>Completed</option>
      <option value="failed" ${prevState.status === 'failed' ? 'selected' : ''}>Failed</option>
    </select>`;
  row.querySelector('.col-priority').innerHTML = `
    <select class="inline-edit-select">
      <option value="low" ${prevState.priority === 'low' ? 'selected' : ''}>Low</option>
      <option value="medium" ${prevState.priority === 'medium' ? 'selected' : ''}>Medium</option>
      <option value="high" ${prevState.priority === 'high' ? 'selected' : ''}>High</option>
      <option value="critical" ${prevState.priority === 'critical' ? 'selected' : ''}>Critical</option>
    </select>`;
  row.querySelector('.col-actions').innerHTML = `
    <button class="btn btn--primary btn--xs save-btn" aria-label="Save">\u2713</button>
    <button class="btn btn--ghost btn--xs cancel-btn" aria-label="Cancel">\u2717</button>`;

  row.querySelector('.save-btn').addEventListener('click', () => saveInlineEdit(taskId, row, prevState));
  row.querySelector('.cancel-btn').addEventListener('click', () => cancelInlineEdit(taskId, row, prevState));

  const input = row.querySelector('.inline-edit-input');
  if (input) {
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveInlineEdit(taskId, row, prevState);
      if (e.key === 'Escape') cancelInlineEdit(taskId, row, prevState);
    });
  }
}

async function saveInlineEdit(taskId, row, prevState) {
  const title = row.querySelector('.inline-edit-input')?.value?.trim();
  const status = row.querySelector('.col-status select')?.value;
  const priority = row.querySelector('.col-priority select')?.value;

  if (!title) {
    showToast({ type: 'warning', message: 'Title cannot be empty' });
    return;
  }

  try {
    await api.patch(`/tasks/${taskId}/`, { title, status, priority });
    showToast({ type: 'success', message: 'Task updated' });
    loadTasks();
  } catch (error) {
    cancelInlineEdit(taskId, row, prevState);
    showToast({ type: 'error', message: error.message });
  }
}

function cancelInlineEdit(taskId, row, prevState) {
  row.classList.remove('editing');
  const statusClass = `status-badge--${prevState.status}`;
  const priorityClass = `priority-badge--${prevState.priority}`;
  row.querySelector('.col-title').textContent = prevState.title;
  row.querySelector('.col-status').innerHTML = `<span class="status-badge ${statusClass}">${prevState.status}</span>`;
  row.querySelector('.col-priority').innerHTML = `<span class="priority-badge ${priorityClass}">${prevState.priority}</span>`;
  row.querySelector('.col-actions').innerHTML = `
    <button class="btn btn--ghost btn--xs edit-btn" data-id="${taskId}" aria-label="Edit task">\u270E</button>
    <button class="btn btn--ghost btn--xs delete-btn" data-id="${taskId}" aria-label="Delete task">\u2717</button>`;
  row.querySelector('.edit-btn')?.addEventListener('click', () => startInlineEdit(taskId));
  row.querySelector('.delete-btn')?.addEventListener('click', () => deleteTask(taskId));
}

async function deleteTask(taskId) {
  showModal({
    title: 'Delete Task',
    body: '<p>Are you sure you want to delete this task? This action cannot be undone.</p>',
    footer: `
      <button class="btn btn--ghost" id="modalCancelBtn">Cancel</button>
      <button class="btn btn--danger" id="modalConfirmBtn">Delete</button>`,
  });

  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
    try {
      await api.delete(`/tasks/${taskId}/`);
      showToast({ type: 'success', message: 'Task deleted' });
      closeModal();
      loadTasks();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
      closeModal();
    }
  });
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

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (!draggedRow || draggedRow === this) return;

  const rows = [...document.querySelectorAll('#tasksTableBody tr[draggable]')];
  const orderedIds = rows.map(r => r.dataset.id);

  const fromIdx = rows.indexOf(draggedRow);
  const toIdx = rows.indexOf(this);
  if (fromIdx < 0 || toIdx < 0) return;

  orderedIds.splice(fromIdx, 1);
  orderedIds.splice(toIdx, 0, draggedRow.dataset.id);

  const tbody = document.getElementById('tasksTableBody');
  if (toIdx === rows.length - 1) {
    tbody.appendChild(draggedRow);
  } else {
    tbody.insertBefore(draggedRow, rows[toIdx + (toIdx > fromIdx ? 1 : 0)]);
  }

  try {
    await api.post('/tasks/reorder/', { ordered_ids: orderedIds });
    showToast({ type: 'success', message: 'Order updated', duration: 2000 });
  } catch (error) {
    showToast({ type: 'error', message: 'Failed to save order' });
    loadTasks();
  }
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('#tasksTableBody tr').forEach(r => r.classList.remove('drag-over'));
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
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadTasks(); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; loadTasks(); }
  });

  let searchTimeout;
  document.getElementById('gridSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { currentPage = 1; loadTasks(); }, 300);
  });

  document.getElementById('filterStatus')?.addEventListener('change', () => {
    currentPage = 1; loadTasks();
  });
  document.getElementById('filterPriority')?.addEventListener('change', () => {
    currentPage = 1; loadTasks();
  });

  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sort = th.dataset.sort;
      if (currentSort === sort) {
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = sort;
        currentOrder = 'asc';
      }
      document.querySelectorAll('.data-table th').forEach(h => h.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', currentOrder === 'asc' ? 'ascending' : 'descending');
      loadTasks();
    });
  });
}

function setupExport() {
  document.getElementById('exportCsvBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('exportCsvBtn');
    btn.disabled = true;
    btn.textContent = 'Exporting...';
    try {
      const response = await api.post('/tasks/export-csv/');
      if (response.status === 'success' && response.data?.task_id) {
        showToast({ type: 'info', message: 'CSV export started. Polling for result...', duration: 3000 });
        pollExport(response.data.task_id);
      }
    } catch (error) {
      showToast({ type: 'error', message: error.message });
      btn.disabled = false;
      btn.innerHTML = '<span aria-hidden="true">\u2193</span> Export CSV';
    }
  });
}

async function pollExport(taskId, attempts = 0) {
  if (attempts > 30) {
    showToast({ type: 'error', message: 'Export timed out' });
    resetExportBtn();
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
      resetExportBtn();
      return;
    }
  } catch (error) {
    if (error.status === 404) {
      setTimeout(() => pollExport(taskId, attempts + 1), 1500);
      return;
    }
    showToast({ type: 'error', message: error.message });
  }
  resetExportBtn();
}

function resetExportBtn() {
  const btn = document.getElementById('exportCsvBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span aria-hidden="true">\u2193</span> Export CSV';
  }
}

function setupAddTask() {
  document.getElementById('addTaskBtn')?.addEventListener('click', () => {
    showModal({
      title: 'Add New Task',
      body: `
        <form id="addTaskForm" class="form-group">
          <label class="form-label" for="newTaskTitle">Title</label>
          <input class="input" id="newTaskTitle" required placeholder="Task title" maxlength="255" />
          <label class="form-label" for="newTaskDesc" style="margin-top:0.5rem;">Description</label>
          <textarea class="input" id="newTaskDesc" rows="3" placeholder="Task description" style="resize:vertical;"></textarea>
          <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
            <div style="flex:1;">
              <label class="form-label" for="newTaskStatus">Status</label>
              <select class="select" id="newTaskStatus">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div style="flex:1;">
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

    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', async () => {
      const title = document.getElementById('newTaskTitle')?.value?.trim();
      if (!title) {
        showToast({ type: 'warning', message: 'Title is required' });
        return;
      }
      const payload = {
        title,
        description: document.getElementById('newTaskDesc')?.value || '',
        status: document.getElementById('newTaskStatus')?.value || 'pending',
        priority: document.getElementById('newTaskPriority')?.value || 'medium',
      };
      try {
        await api.post('/tasks/', payload);
        showToast({ type: 'success', message: 'Task created' });
        closeModal();
        loadTasks();
      } catch (error) {
        showToast({ type: 'error', message: error.message });
      }
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default { initDataGrid };
