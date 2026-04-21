class InspectionHistoryPage {
  constructor() {
    this.currentUser = null;
    this.records = [];
    this.filtered = [];
    this.activeStatus = '';
    this.defaultDate = this.today();
    this.pageSize = 10;
    this.currentPage = 1;
    this.init();
  }

  async init() {
    this.currentUser = this.getCurrentUser();
    if (!this.currentUser) return;
    this.currentUser = await this.syncCurrentUser();
    if (!this.currentUser) return;

    this.renderUser();
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) dateFilter.value = this.defaultDate;
    this.bindEvents();
    await this.loadRecords();
    this.render();
  }

  getCurrentUser() {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!raw || !token) {
      window.location.href = 'login.html';
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return null;
    }
  }

  async syncCurrentUser() {
    try {
      const me = await ApiClient.get('/api/auth/me');
      if (Number(me.status) !== 1) {
        this.logout();
        return null;
      }
      const merged = Object.assign({}, this.currentUser || {}, me, {
        id: me.id || me.userId || this.currentUser.id || this.currentUser.userId || null
      });
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    } catch {
      this.logout();
      return null;
    }
  }

  async loadRecords() {
    const page = await ApiClient.get('/api/inspection/list?pageNum=1&pageSize=500');
    const currentId = Number(this.currentUser.id || this.currentUser.userId || 0);
    this.records = (page?.records || [])
      .filter((item) => !currentId || Number(item.userId || item.inspectorId || 0) === currentId)
      .sort((a, b) => new Date(b.inspectionTime || 0) - new Date(a.inspectionTime || 0));
  }

  bindEvents() {
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      await this.loadRecords();
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('resetBtn')?.addEventListener('click', () => {
      document.getElementById('keywordInput').value = '';
      document.getElementById('roomFilter').value = '';
      document.getElementById('statusFilter').value = '';
      document.getElementById('dateFilter').value = this.defaultDate;
      this.activeStatus = '';
      this.currentPage = 1;
      this.render();
    });

    document.getElementById('keywordInput')?.addEventListener('input', () => {
      this.currentPage = 1;
      this.render();
    });
    document.getElementById('roomFilter')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.render();
    });
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
      this.activeStatus = e.target.value || '';
      this.currentPage = 1;
      this.render();
    });
    document.getElementById('dateFilter')?.addEventListener('change', () => {
      this.currentPage = 1;
      this.render();
    });
    document.getElementById('detailClose')?.addEventListener('click', () => this.closeDetail());
    document.getElementById('detailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') this.closeDetail();
    });
  }

  renderUser() {
    const name = this.currentUser.fullName || this.currentUser.username || '用户';
    const roleMap = {
      admin: '系统管理员',
      engineer: '巡检人员',
      viewer: '查看人员'
    };
    const role = roleMap[String(this.currentUser.role || '').toLowerCase()] || '巡检人员';
    document.getElementById('userName').textContent = name;
    document.getElementById('userRole').textContent = role;
    document.getElementById('userAvatar').textContent = String(name).charAt(0).toUpperCase();
  }

  render() {
    this.renderRoomFilter();
    this.renderStatusNav();
    this.renderSummary();
    this.applyFilters();
    this.renderList();
    this.renderPagination();
  }

  renderRoomFilter() {
    const roomFilter = document.getElementById('roomFilter');
    const roomMap = new Map();
    this.records.forEach((item) => {
      const key = String(item.roomId || '');
      if (!key) return;
      roomMap.set(key, item.roomName || `机房 ${key}`);
    });
    const currentValue = roomFilter.value || '';
    const options = ['<option value="">全部机房</option>']
      .concat(Array.from(roomMap.entries()).map(([id, name]) => `<option value="${this.escapeHtml(id)}" ${currentValue === id ? 'selected' : ''}>${this.escapeHtml(name)}</option>`));
    roomFilter.innerHTML = options.join('');
  }

  renderStatusNav() {
    const statusList = document.getElementById('statusList');
    const buttons = [
      { value: '', label: '全部' },
      { value: 'normal', label: '正常' },
      { value: 'warning', label: '警告' },
      { value: 'error', label: '异常' },
      { value: 'unchecked', label: '未巡检' }
    ];
    statusList.innerHTML = buttons.map((item) => `<button class="status-btn ${this.activeStatus === item.value ? 'active' : ''}" data-status="${item.value}">${item.label}</button>`).join('');
    statusList.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeStatus = btn.dataset.status || '';
        document.getElementById('statusFilter').value = this.activeStatus;
        this.currentPage = 1;
        this.render();
      });
    });
  }

  renderSummary() {
    const summaryList = document.getElementById('summaryList');
    const counts = { total: this.records.length, normal: 0, warning: 0, error: 0 };
    this.records.forEach((item) => {
      const status = String(item.status || 'unchecked');
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    });
    summaryList.innerHTML = [
      `<div class="summary-item"><span>总记录</span><strong>${counts.total}</strong></div>`,
      `<div class="summary-item"><span>正常</span><strong>${counts.normal}</strong></div>`,
      `<div class="summary-item"><span>警告</span><strong>${counts.warning}</strong></div>`,
      `<div class="summary-item"><span>异常</span><strong>${counts.error}</strong></div>`
    ].join('');
  }

  applyFilters() {
    const keyword = (document.getElementById('keywordInput')?.value || '').trim().toLowerCase();
    const roomId = document.getElementById('roomFilter')?.value || '';
    const status = this.activeStatus || document.getElementById('statusFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || '';

    this.filtered = this.records.filter((item) => {
      const haystack = `${item.roomName || ''} ${item.notes || ''} ${item.richContent || ''}`.toLowerCase();
      const hitKeyword = !keyword || haystack.includes(keyword);
      const hitRoom = !roomId || String(item.roomId || '') === roomId;
      const hitStatus = !status || String(item.status || '') === status;
      const hitDate = !date || this.toDateString(item.inspectionTime) === date;
      return hitKeyword && hitRoom && hitStatus && hitDate;
    });
  }

  renderList() {
    const listEl = document.getElementById('historyList');
    const emptyEl = document.getElementById('emptyState');
    const summaryEl = document.getElementById('resultSummary');
    summaryEl.textContent = `共 ${this.filtered.length} 条巡检记录`;

    if (!this.filtered.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    const start = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filtered.slice(start, start + this.pageSize);

    listEl.innerHTML = pageItems.map((item) => `
      <article class="history-item">
        <div class="history-top">
          <div>
            <h3 class="history-title">${this.escapeHtml(item.roomName || `机房 ${item.roomId || '-'}`)}</h3>
            <div class="history-meta">巡检时间：${this.formatTime(item.inspectionTime)} · 巡检人：${this.escapeHtml(item.userName || item.inspectorName || this.currentUser.fullName || this.currentUser.username || '本人')}</div>
          </div>
          <span class="status-pill status-${this.escapeHtml(item.status || 'unchecked')}">${this.getStatusText(item.status)}</span>
        </div>
        <div class="history-tags">
          <span class="history-tag">机房 ID：${this.escapeHtml(item.roomId || '-')}</span>
          <span class="history-tag">记录 ID：${this.escapeHtml(item.id || '-')}</span>
        </div>
        <div class="history-content">${this.escapeHtml(item.notes || item.richContent || '暂无巡检备注')}</div>
        <div class="history-footer"><button class="detail-btn" type="button" data-id="${item.id}">查看详情</button></div>
      </article>
    `).join('');

    listEl.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.filtered.find((row) => String(row.id) === String(btn.dataset.id));
        if (item) this.openDetail(item);
      });
    });
  }

  renderPagination() {
    const container = document.getElementById('historyPagination');
    if (!container) return;
    const total = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    if (!this.filtered.length || total <= 1) {
      container.innerHTML = '';
      return;
    }
    if (this.currentPage > total) this.currentPage = total;
    container.innerHTML = `
      <button class="page-btn" type="button" data-page="prev" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${total} 页，共 ${this.filtered.length} 条</span>
      <button class="page-btn" type="button" data-page="next" ${this.currentPage >= total ? 'disabled' : ''}>下一页</button>
    `;
    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.page === 'prev' && this.currentPage > 1) this.currentPage -= 1;
        if (btn.dataset.page === 'next' && this.currentPage < total) this.currentPage += 1;
        this.renderList();
        this.renderPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  openDetail(item) {
    document.getElementById('detailTitle').textContent = item.roomName || `机房 ${item.roomId || '-'}`;
    document.getElementById('detailMeta').textContent = `巡检时间：${this.formatTime(item.inspectionTime)} | 巡检状态：${this.getStatusText(item.status)} | 巡检人：${item.userName || item.inspectorName || this.currentUser.fullName || this.currentUser.username || '本人'}`;
    document.getElementById('detailTags').innerHTML = `
      <span class="history-tag">机房 ID：${this.escapeHtml(item.roomId || '-')}</span>
      <span class="history-tag">记录 ID：${this.escapeHtml(item.id || '-')}</span>
      <span class="history-tag">状态：${this.getStatusText(item.status)}</span>
    `;
    document.getElementById('detailContent').textContent = item.richContent || item.notes || '暂无巡检详情';
    document.getElementById('detailModal').classList.add('active');
  }

  closeDetail() {
    document.getElementById('detailModal')?.classList.remove('active');
  }

  getStatusText(status) {
    if (status === 'normal') return '正常';
    if (status === 'warning') return '警告';
    if (status === 'error') return '异常';
    return '未巡检';
  }

  formatTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${week} ${hh}:${mm}`;
  }

  today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  toDateString(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  escapeHtml(value) {
    const text = String(value ?? '');
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.inspectionHistoryPage = new InspectionHistoryPage();
});
