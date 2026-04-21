class ReportDetailPage {
  constructor() {
    this.currentUser = null;
    this.targetUser = null;
    this.rooms = [];
    this.inspections = [];
    this.dateFilter = this.formatDateISO(new Date());
    this.init();
  }

  async init() {
    this.currentUser = this.getCurrentUser();
    if (!this.currentUser) return;
    try {
      const me = await ApiClient.get('/api/auth/me');
      if (String(me.role || '').toLowerCase() !== 'admin') {
        this.notify('\u4ec5\u7ba1\u7406\u5458\u53ef\u67e5\u770b\u4eba\u5458\u5de1\u68c0\u660e\u7ec6', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
        return;
      }
      const currentDate = document.getElementById('report-current-date');
      if (currentDate) currentDate.textContent = new Date().toLocaleDateString('zh-CN');
      const userId = Number(new URLSearchParams(window.location.search).get('userId') || 0);
      if (!userId) return this.renderError('\u7f3a\u5c11\u7528\u6237\u53c2\u6570');
      const [userPage, roomPage, inspectionPage] = await Promise.all([
        ApiClient.get('/api/user/list?pageNum=1&pageSize=500'),
        ApiClient.get('/api/room/list?pageNum=1&pageSize=500'),
        ApiClient.get('/api/inspection/list?pageNum=1&pageSize=1000')
      ]);
      this.rooms = roomPage?.records || [];
      const users = userPage?.records || [];
      this.targetUser = users.find((u) => Number(u.id || u.userId || 0) === userId) || null;
      if (!this.targetUser) return this.renderError('\u672a\u627e\u5230\u8be5\u7528\u6237');
      this.inspections = (inspectionPage?.records || []).filter((r) => Number(r.userId || 0) === userId).sort((a, b) => new Date(b.inspectionTime || 0) - new Date(a.inspectionTime || 0));
      this.render();
    } catch (e) {
      this.renderError(e.message || '\u52a0\u8f7d\u5931\u8d25');
    }
  }

  render() {
    const container = document.getElementById('report-detail-container');
    if (!container || !this.targetUser) return;
    const dateValue = this.dateFilter || '';
    const rows = this.dateFilter ? this.inspections.filter((r) => this.getDayString(r.inspectionTime) === this.dateFilter) : this.inspections;
    const allRoomIds = new Set(this.rooms.map((room) => Number(room.id || 0)).filter(Boolean));
    const inspectedRoomIds = new Set(rows.map((r) => Number(r.roomId || 0)).filter(Boolean));
    const unfinishedRooms = this.dateFilter ? this.rooms.filter((room) => !inspectedRoomIds.has(Number(room.id || 0))) : [];
    const todayStatus = this.dateFilter && allRoomIds.size > 0 && inspectedRoomIds.size === allRoomIds.size ? '\u5df2\u5b8c\u6210' : '\u672a\u5b8c\u6210';

    container.innerHTML = `
      <div class="table-header"><h3>\u4eba\u5458\u5de1\u68c0\u660e\u7ec6</h3></div>
      <div class="report-meta">
        <div><strong>\u5de1\u68c0\u4eba\uff1a</strong>${this.escapeHtml(this.targetUser.fullName || this.targetUser.username || '')}</div>
        <div><strong>\u7528\u6237\u540d\uff1a</strong>${this.escapeHtml(this.targetUser.username || '')}</div>
        <div><strong>\u90e8\u95e8\uff1a</strong>${this.escapeHtml(this.targetUser.department || '')}</div>
        <div><strong>\u603b\u5de1\u68c0\u6b21\u6570\uff1a</strong>${this.inspections.length}</div>
      </div>
      <div class="filter-bar" style="margin-bottom:14px;">
        <input class="form-control" type="date" id="detail-date-filter" value="${dateValue}" style="max-width:220px;">
        <button class="btn btn-xs" id="detail-filter-today">\u4eca\u5929</button>
        <button class="btn btn-xs" id="detail-filter-clear">\u5168\u90e8</button>
      </div>
      <div class="table-card" style="box-shadow:none;border:1px solid #eef2f7;margin-bottom:16px;">
        <div class="table-header"><h3>\u5f53\u65e5\u672a\u5b8c\u6210\u5de1\u68c0</h3></div>
        <div style="margin-bottom:12px;color:#475467;font-size:14px;"><strong>\u5f53\u65e5\u72b6\u6001\uff1a</strong>${todayStatus}${this.dateFilter ? `\uff08${this.dateFilter}\uff09` : ''}</div>
        ${this.dateFilter ? `<div class="tag-library-list">${unfinishedRooms.length ? unfinishedRooms.map((room) => `<span class="tag-chip">${this.escapeHtml(room.name || ('#' + (room.id || '')))}</span>`).join('') : '<span style="color:#12b76a;">\u5f53\u65e5\u673a\u623f\u5df2\u5168\u90e8\u5b8c\u6210\u5de1\u68c0</span>'}</div>` : '<div style="color:#667085;">\u8bf7\u9009\u62e9\u67d0\u4e00\u5929\u67e5\u770b\u5f53\u65e5\u672a\u5b8c\u6210\u673a\u623f</div>'}
      </div>
      <div style="overflow:auto;">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>\u673a\u623f</th><th>\u72b6\u6001</th><th>\u65f6\u95f4</th><th>\u5907\u6ce8</th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr><td>${r.id ?? ''}</td><td>${this.escapeHtml(r.roomName || ('#' + (r.roomId || '')))}</td><td>${this.getInspectionStatusText(r.status)}</td><td>${this.formatTime(r.inspectionTime)}</td><td>${this.escapeHtml(r.notes || '')}</td></tr>`).join('') || `<tr><td colspan="5">${this.dateFilter ? '\u8be5\u65e5\u671f\u6682\u65e0\u5de1\u68c0\u8bb0\u5f55' : '\u6682\u65e0\u5de1\u68c0\u8bb0\u5f55'}</td></tr>`}
          </tbody>
        </table>
      </div>`;

    const dateInput = document.getElementById('detail-date-filter');
    document.getElementById('detail-filter-today')?.addEventListener('click', () => {
      this.dateFilter = this.formatDateISO(new Date());
      if (dateInput) dateInput.value = this.dateFilter;
      this.render();
    });
    document.getElementById('detail-filter-clear')?.addEventListener('click', () => {
      this.dateFilter = '';
      if (dateInput) dateInput.value = '';
      this.render();
    });
    dateInput?.addEventListener('change', () => {
      this.dateFilter = dateInput.value || '';
      this.render();
    });
  }

  renderError(message) {
    const container = document.getElementById('report-detail-container');
    if (!container) return;
    container.innerHTML = `<div style="padding:16px;color:#c62828;">${this.escapeHtml(message)}</div>`;
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

  getDayString(v) {
    const d = new Date(v || 0);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  getInspectionStatusText(status) {
    if (status === 'normal') return '\u6b63\u5e38';
    if (status === 'warning') return '\u8b66\u544a';
    if (status === 'error') return '\u5f02\u5e38';
    return this.escapeHtml(status || '');
  }

  formatTime(v) {
    if (!v) return '-';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN');
  }

  formatDateISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  escapeHtml(v) {
    const s = String(v ?? '');
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  notify(msg, type) {
    const node = document.getElementById('notification');
    if (!node) {
      alert(msg);
      return;
    }
    node.className = `notification ${type || 'info'} show`;
    node.innerHTML = `<i class="fas fa-info-circle"></i><span>${this.escapeHtml(msg)}</span>`;
    setTimeout(() => node.classList.remove('show'), 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.reportDetailPage = new ReportDetailPage();
});