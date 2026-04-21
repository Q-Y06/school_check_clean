class DutySchedulePage {
  constructor() {
    this.currentUser = null;
    this.schedules = [];
    this.viewDate = new Date();
    this.selectedDate = this.formatISO(new Date());
    this.init();
  }

  async init() {
    this.currentUser = this.getCurrentUser();
    if (!this.currentUser) return;
    await this.loadSchedules();
    this.bindEvents();
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

  async loadSchedules() {
    const page = await ApiClient.get('/api/schedule/list?pageNum=1&pageSize=500');
    this.schedules = (page?.records || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }

  bindEvents() {
    document.getElementById('prev-month')?.addEventListener('click', () => {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
      this.render();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
      this.render();
    });
    document.getElementById('today-btn')?.addEventListener('click', () => {
      const now = new Date();
      this.viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      this.selectedDate = this.formatISO(now);
      this.render();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
  }

  render() {
    this.renderCalendar();
    this.renderDetail();
  }

  renderCalendar() {
    const monthLabel = document.getElementById('month-label');
    const grid = document.getElementById('calendar-grid');
    if (!monthLabel || !grid) return;

    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    monthLabel.textContent = `${year}年 ${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const dayMap = new Map();

    this.schedules.forEach((item) => {
      const key = this.dateOnly(item.scheduleDate);
      const list = dayMap.get(key) || [];
      list.push(item);
      dayMap.set(key, list);
    });

    const cells = [];
    for (let i = 0; i < startWeekday; i += 1) {
      cells.push('<div class="day-card day-empty"></div>');
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const items = dayMap.get(dateStr) || [];
      const allDone = items.length > 0 && items.every((item) => String(item.shiftType || '') === '已完成');
      const state = items.length === 0 ? { text: '无排班', cls: 'empty' } : (allDone ? { text: '已巡检完成', cls: 'done' } : { text: '未巡检完成', cls: 'pending' });
      const isActive = dateStr === this.selectedDate;
      const isToday = dateStr === this.formatISO(new Date());
      cells.push(`
        <button class="day-card ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">
          <span class="day-num">${day}</span>
          <span class="day-count">${items.length ? `值班 ${items.length} 项` : '无排班'}</span>
          <span class="day-state ${state.cls}">${state.text}</span>
          ${items.slice(0, 2).map((item) => `<span class="day-user">${this.escapeHtml(item.userName || '-')}</span>`).join('')}
        </button>
      `);
    }

    grid.innerHTML = cells.join('');
    grid.querySelectorAll('.day-card[data-date]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedDate = button.dataset.date;
        this.render();
      });
    });
  }

  renderDetail() {
    const title = document.getElementById('detail-title');
    const status = document.getElementById('detail-status');
    const list = document.getElementById('detail-list');
    if (!title || !status || !list) return;

    const items = this.schedules.filter((item) => this.dateOnly(item.scheduleDate) === this.selectedDate);
    const allDone = items.length > 0 && items.every((item) => String(item.shiftType || '') === '已完成');
    title.textContent = `${this.selectedDate} 值班安排`;
    status.textContent = items.length === 0 ? '当天无排班' : (allDone ? '当天巡检已完成' : '当天巡检未完成');

    if (!items.length) {
      list.innerHTML = '<div class="empty-box">当天暂无值班安排</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <div class="detail-item">
        <div class="detail-item-head">
          <div class="detail-name">${this.escapeHtml(item.userName || '-')}</div>
          <div class="day-state ${String(item.shiftType || '') === '已完成' ? 'done' : 'pending'}">${String(item.shiftType || '') === '已完成' ? '已完成' : '未完成'}</div>
        </div>
        <div class="detail-room">机房：${this.escapeHtml(item.roomName || '-')}</div>
        <div class="detail-note">备注：${this.escapeHtml(item.notes || '无')}</div>
      </div>
    `).join('');
  }

  dateOnly(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return this.formatISO(date);
  }

  formatISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dutySchedulePage = new DutySchedulePage();
});
