(function () {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatISO(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function formatCN(d) {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  function ensureHeaderDatePicker(admin) {
    const dateDisplay = document.querySelector('.date-display');
    if (!dateDisplay) return;

    dateDisplay.style.cursor = 'pointer';
    dateDisplay.title = '点击选择日期并查看巡检记录';

    let dateInput = document.getElementById('header-date-picker');
    if (!dateInput) {
      dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.id = 'header-date-picker';
      dateInput.className = 'header-date-picker';
      dateDisplay.appendChild(dateInput);
    }

    const dateText = document.getElementById('current-date');
    const today = new Date();
    if (dateText && !dateText.textContent.trim()) {
      dateText.textContent = formatCN(today);
    }
    dateInput.value = formatISO(today);

    dateDisplay.addEventListener('click', () => {
      if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
      } else {
        dateInput.focus();
        dateInput.click();
      }
    });

    dateInput.addEventListener('change', async () => {
      const value = dateInput.value || '';
      if (!value) return;

      const d = new Date(value + 'T00:00:00');
      if (dateText && !Number.isNaN(d.getTime())) {
        dateText.textContent = formatCN(d);
      }

      if (!admin) return;
      admin.inspectionDateFilter = value;
      await admin.switchPage('inspections');
      if (typeof admin.notify === 'function') {
        admin.notify(`已切换到 ${value} 的巡检记录`, 'info');
      }
    });
  }

  function ensureNotificationPanel() {
    let panel = document.getElementById('header-notification-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'header-notification-panel';
    panel.className = 'header-notification-panel';
    panel.innerHTML = '<div class="np-empty">暂无提醒</div>';

    const header = document.querySelector('.top-header');
    if (header) header.appendChild(panel);
    return panel;
  }

  function setNotificationBadge(btn, count) {
    if (!btn) return;
    let badge = btn.querySelector('.badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge';
      btn.appendChild(badge);
    }
    if (count > 0) {
      badge.textContent = String(Math.min(count, 99));
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function buildNoticeItems(admin) {
    const notices = [];
    const pendingUsers = (admin.users || []).filter((u) => Number(u.status) === 0).length;
    const warningRooms = (admin.rooms || []).filter((r) => r.status === 'warning').length;
    const errorRooms = (admin.rooms || []).filter((r) => r.status === 'error').length;

    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const todayInspections = (admin.inspections || []).filter((r) => {
      const t = new Date(r.inspectionTime || 0);
      return !Number.isNaN(t.getTime()) && t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    }).length;

    if (pendingUsers > 0) notices.push({ level: 'warning', text: `待审核用户 ${pendingUsers} 人` });
    if (errorRooms > 0) notices.push({ level: 'error', text: `异常机房 ${errorRooms} 个` });
    if (warningRooms > 0) notices.push({ level: 'warning', text: `告警机房 ${warningRooms} 个` });
    notices.push({ level: 'info', text: `今日巡检记录 ${todayInspections} 条` });

    return notices;
  }

  function renderNoticePanel(panel, notices) {
    if (!panel) return;
    if (!notices.length) {
      panel.innerHTML = '<div class="np-empty">暂无提醒</div>';
      return;
    }

    panel.innerHTML = notices.map((n) => `
      <div class="np-item ${n.level}">
        <i class="fas ${n.level === 'error' ? 'fa-circle-exclamation' : (n.level === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info')}"></i>
        <span>${n.text}</span>
      </div>
    `).join('');
  }

  async function bindNotification(admin) {
    const btn = document.querySelector('.notification-btn');
    if (!btn) return;

    const panel = ensureNotificationPanel();

    async function refreshNotices() {
      if (!admin) return [];
      await Promise.all([admin.loadUsers(), admin.loadRooms(), admin.loadInspections()]);
      const notices = buildNoticeItems(admin);
      setNotificationBadge(btn, notices.filter((n) => n.level !== 'info').length);
      renderNoticePanel(panel, notices);
      return notices;
    }

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await refreshNotices();
      panel.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('show');
      }
    });

    await refreshNotices();
  }

  function addSelectionColumn(table, group) {
    if (!table || table.dataset.batchEnhanced === '1') return;
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const th = document.createElement('th');
    th.className = 'table-select-col';
    th.innerHTML = `<button type="button" class="select-all-btn" data-select-group="${group}" data-selected="0">全选</button>`;
    headRow.insertBefore(th, headRow.firstElementChild);
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const empty = tr.querySelector('.empty-state');
      const td = document.createElement('td');
      td.className = 'table-select-col';
      if (!empty) {
        const idCell = tr.querySelectorAll('td')[1];
        const id = idCell ? Number(idCell.textContent.trim()) : NaN;
        td.innerHTML = Number.isNaN(id) ? '' : `<input type="checkbox" class="row-select" data-select-group="${group}" value="${id}">`;
      }
      tr.insertBefore(td, tr.firstElementChild);
    });
    table.dataset.batchEnhanced = '1';
  }

  function ensureBatchButton(container, id, text) {
    if (!container || document.getElementById(id)) return document.getElementById(id);
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn btn-danger';
    btn.innerHTML = '<i class="fas fa-trash"></i>' + text;
    container.prepend(btn);
    return btn;
  }

  function patchAdmin(admin) {
    if (!admin || admin.__enhanced) return;
    admin.__enhanced = true;

    admin.paginationHtml = function (pageData, key) {
      if (!pageData || pageData.totalItems <= this.pageSize) return '';
      return `<div class="pagination"><span class="pagination-info">第 ${pageData.page} / ${pageData.total} 页，共 ${pageData.totalItems} 条</span><button class="page-btn" data-page-key="${key}" data-page="${pageData.page - 1}" ${pageData.page <= 1 ? 'disabled' : ''}>上一页</button><button class="page-btn" data-page-key="${key}" data-page="${pageData.page + 1}" ${pageData.page >= pageData.total ? 'disabled' : ''}>下一页</button></div>`;
    };

    admin.fillSequence = function (offset = 0, columnIndex = 0) {
      this.pageContainer.querySelectorAll('tbody tr').forEach((tr, idx) => {
        const cells = tr.querySelectorAll('td');
        const td = cells[columnIndex] || cells[0];
        if (td && td.textContent.trim() === '') td.textContent = String(offset + idx + 1);
      });
    };

    admin.getSelectedIds = function (group) {
      return Array.from(this.pageContainer.querySelectorAll(`.row-select[data-select-group="${group}"]:checked`))
        .map((node) => Number(node.value))
        .filter((id) => !Number.isNaN(id));
    };

    admin.bindSelection = function (group) {
      const selectAll = this.pageContainer.querySelector(`.select-all-btn[data-select-group="${group}"]`);
      const rows = Array.from(this.pageContainer.querySelectorAll(`.row-select[data-select-group="${group}"]`));
      if (!selectAll) return;
      const syncState = () => {
        const allChecked = rows.length > 0 && rows.every((item) => item.checked);
        selectAll.dataset.selected = allChecked ? '1' : '0';
        selectAll.textContent = allChecked ? '取消' : '全选';
      };
      selectAll.addEventListener('click', () => {
        const shouldSelect = selectAll.dataset.selected !== '1';
        rows.forEach((row) => { row.checked = shouldSelect; });
        syncState();
      });
      rows.forEach((row) => row.addEventListener('change', syncState));
      syncState();
    };

    admin.batchDeleteSelected = async function (group) {
      const ids = this.getSelectedIds(group);
      if (!ids.length) return this.notify('请先勾选要删除的数据', 'warning');
      const config = {
        users: { title: '用户', endpoint: '/api/user/', targetType: '用户' },
        rooms: { title: '机房', endpoint: '/api/room/', targetType: '机房' },
        knowledge: { title: '知识', endpoint: '/api/knowledge/', targetType: '知识库' },
        schedule: { title: '排班', endpoint: '/api/schedule/', targetType: '排班表' }
      }[group];
      if (!config) return;
      if (!confirm(`确定批量删除 ${ids.length} 条${config.title}数据吗？`)) return;
      try {
        for (const id of ids) {
          await ApiClient.delete(`${config.endpoint}${id}`);
          this.addLog(`批量删除${config.title}`, config.targetType, `批量删除 ID ${id}`);
        }
        this.notify(`已批量删除 ${ids.length} 条${config.title}数据`, 'success');
        await this.refreshAdminData();
        this.switchPage(this.currentPage);
      } catch (err) {
        this.notify(err.message || '批量删除失败', 'error');
      }
    };

    const originalSwitchPage = admin.switchPage.bind(admin);
    admin.switchPage = function (page) {
      originalSwitchPage(page);
      setTimeout(() => enhanceCurrentPage(this), 0);
    };
  }

  function replaceHeaderSelectWithButton(admin, group) {
    const table = admin.pageContainer.querySelector('table');
    if (!table) return;
    const headerCheckbox = table.querySelector(`.select-all[data-select-group="${group}"]`);
    if (!headerCheckbox) return;
    const th = headerCheckbox.closest('th');
    if (!th) return;
    th.classList.add('table-select-col');
    th.innerHTML = `<button type="button" class="select-all-btn" data-select-group="${group}" data-selected="0">全选</button>`;
  }

  function enhanceKnowledgePage(admin) {
    const cards = admin.pageContainer.querySelectorAll('.table-card');
    if (cards.length < 2) return;
    const listCard = cards[0];
    const filterBar = listCard.querySelector('.filter-bar');
    const table = listCard.querySelector('table');
    addSelectionColumn(table, 'knowledge');
    const button = ensureBatchButton(filterBar, 'batch-delete-knowledge', '批量删除');
    if (button && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', () => admin.batchDeleteSelected('knowledge'));
    }
    admin.bindSelection('knowledge');
    admin.fillSequence(admin.currentPageMap.knowledge ? (admin.currentPageMap.knowledge - 1) * admin.pageSize : 0, 1);
    admin.pageContainer.querySelectorAll('.tag-chip-remove').forEach((btn) => {
      btn.innerHTML = '<i class="fas fa-times"></i>';
      btn.setAttribute('aria-label', '删除标签');
      btn.title = '删除标签';
    });
  }

  function enhanceSchedulePage(admin) {
    const cards = admin.pageContainer.querySelectorAll('.table-card');
    if (cards.length < 2) return;
    const topFilterBar = cards[0].querySelector('.filter-bar');
    const table = cards[1].querySelector('table');
    addSelectionColumn(table, 'schedule');
    const button = ensureBatchButton(topFilterBar, 'batch-delete-schedule', '批量删除');
    if (button && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', () => admin.batchDeleteSelected('schedule'));
    }
    admin.bindSelection('schedule');
    admin.fillSequence(admin.currentPageMap.schedule ? (admin.currentPageMap.schedule - 1) * admin.pageSize : 0, 1);
  }

  function enhanceCurrentPage(admin) {
    if (!admin) return;
    if (admin.currentPage === 'users') {
      replaceHeaderSelectWithButton(admin, 'users');
      admin.bindSelection('users');
      admin.fillSequence(admin.currentPageMap.users ? (admin.currentPageMap.users - 1) * admin.pageSize : 0, 1);
    }
    if (admin.currentPage === 'rooms') {
      replaceHeaderSelectWithButton(admin, 'rooms');
      admin.bindSelection('rooms');
      admin.fillSequence(admin.currentPageMap.rooms ? (admin.currentPageMap.rooms - 1) * admin.pageSize : 0, 1);
    }
    if (admin.currentPage === 'knowledge') enhanceKnowledgePage(admin);
    if (admin.currentPage === 'schedule') enhanceSchedulePage(admin);
  }

  async function waitAdmin() {
    for (let i = 0; i < 80; i += 1) {
      if (window.adminSystem) return window.adminSystem;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const admin = await waitAdmin();
    patchAdmin(admin);
    ensureHeaderDatePicker(admin);
    await bindNotification(admin);
    setTimeout(() => enhanceCurrentPage(admin), 50);
  });
})();
