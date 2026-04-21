class AdminSystem {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.isLoadingPage = false;
        this.pendingPage = null;
        this.dashboardTrendChart = null;
        this.dashboardStatusChart = null;
        this.reportTrendChart = null;
        this.reportDeviceChart = null;
        this.skeletonTemplate = '';
        this.statusRefreshTimer = null;
        this.recordPageSize = 10;
        this.recordPages = { dailyPatrols: 1, logs: 1 };
        this.recordDates = { dailyPatrols: '', logs: '' };
        this.init();
    }

    init() {
        window.SWPUData.seedData();
        const defaultRecordDate = window.SWPUData.getTodayDate ? window.SWPUData.getTodayDate() : this.getRecordDateString(new Date());
        this.recordDates.dailyPatrols = this.recordDates.dailyPatrols || defaultRecordDate;
        this.recordDates.logs = this.recordDates.logs || defaultRecordDate;
        this.checkAuth();
        this.updateCurrentDate();
        this.updateUserInfo();
        this.setupEventListeners();
        this.refreshNotificationButton();
        const initialPage = window.location.hash.replace('#', '') || 'dashboard';
        this.switchPage(initialPage, true);
        this.startAutoStatusRefresh();
    }

    checkAuth() {
        const swpuUser = window.SWPUData.getCurrentSwpuUser();
        if (!swpuUser) {
            window.location.href = 'login.html';
            return;
        }
        if (swpuUser.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        this.currentUser = swpuUser;
    }

    updateCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        }
    }

    updateUserInfo() {
        const swpuUserAvatar = document.querySelector('.swpuUser-avatar');
        const swpuUserName = document.querySelector('.swpuUser-name');
        const swpuUserRole = document.querySelector('.swpuUser-role');
        if (swpuUserAvatar) swpuUserAvatar.textContent = (this.currentUser.name || '管').charAt(0);
        if (swpuUserName) swpuUserName.textContent = this.currentUser.name;
        if (swpuUserRole) swpuUserRole.textContent = '系统管理员';
    }

    setupEventListeners() {
        document.querySelectorAll('.sidebar-menu li').forEach((item) => {
            item.addEventListener('click', () => this.switchPage(item.dataset.page));
        });

        const menuToggle = document.querySelector('.menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('show'));
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleMessageCenter();
            });
        }

        document.addEventListener('click', (event) => {
            const panel = document.getElementById('messageCenter');
            const button = document.querySelector('.notification-btn');
            if (panel?.classList.contains('active') && !panel.contains(event.target) && !button?.contains(event.target)) {
                this.toggleMessageCenter(false);
            }
        });

        window.addEventListener('hashchange', () => {
            const page = window.location.hash.replace('#', '') || 'dashboard';
            this.switchPage(page, true);
        });

        window.addEventListener('patrolUpdated', () => {
            if (this.isLoadingPage) {
                return;
            }
            if (this.currentPage === 'dashboard' || this.currentPage === 'reports' || this.currentPage === 'dailyPatrols' || this.currentPage === 'devices' || this.currentPage === 'managementPages') {
                this.loadPage(this.currentPage);
            }
            this.refreshNotificationButton();
            if (document.getElementById('messageCenter')?.classList.contains('active')) {
                this.renderMessageCenter();
            }
        });

        window.addEventListener('swpu:data-changed', (event) => {
            if (this.isLoadingPage) {
                return;
            }
            const changedKey = event.detail?.key;
            if (['devices', 'managementPages', 'dailyPatrolRecords', 'devicePatrolRecords', 'managementPatrolRecords', 'ncicDutyList', 'ncicRooms'].includes(changedKey)) {
                this.refreshNotificationButton();
                if (document.getElementById('messageCenter')?.classList.contains('active')) {
                    this.renderMessageCenter();
                }
            }
            if ((changedKey === 'devices' || changedKey === 'managementPages' || changedKey === 'dailyPatrolRecords' || changedKey === 'devicePatrolRecords' || changedKey === 'managementPatrolRecords' || changedKey === 'ncicRooms') && (this.currentPage === 'reports' || this.currentPage === 'dashboard' || this.currentPage === 'devices' || this.currentPage === 'managementPages')) {
                this.loadPage(this.currentPage);
            }
        });
    }

    switchPage(page, skipHashUpdate) {
        this.currentPage = page;
        document.querySelectorAll('.sidebar-menu li').forEach((item) => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        if (window.innerWidth <= 992) {
            document.querySelector('.sidebar')?.classList.remove('show');
        }
        if (!skipHashUpdate) {
            window.location.hash = page;
        }
        this.loadPage(page);
    }

    async getSkeletonTemplate() {
        if (this.skeletonTemplate) {
            return this.skeletonTemplate;
        }
        try {
            const response = await fetch('common/skeleton.html');
            this.skeletonTemplate = await response.text();
        } catch (error) {
            this.skeletonTemplate = '<div class="skeleton-shell"><div class="skeleton-block skeleton-banner"></div><div class="skeleton-grid"><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div></div><div class="skeleton-block skeleton-table"></div></div>';
        }
        return this.skeletonTemplate;
    }

    async loadPage(page) {
        if (this.isLoadingPage) {
            this.pendingPage = page;
            return;
        }

        const skeleton = document.getElementById('skeleton-wrapper');
        const container = document.getElementById('page-container');
        if (!container || !skeleton) return;

        this.isLoadingPage = true;
        try {
            skeleton.style.display = 'block';
            skeleton.innerHTML = await this.getSkeletonTemplate();
            container.style.display = 'none';
            this.destroyCharts();

            if (page === 'duty') {
                await this.renderDutyPage(container);
            } else {
                this.renderPageContent(page, container);
            }

            requestAnimationFrame(() => {
                container.style.display = 'block';
                skeleton.style.display = 'none';
            });
        } finally {
            this.isLoadingPage = false;
            if (this.pendingPage && this.pendingPage !== page) {
                const nextPage = this.pendingPage;
                this.pendingPage = null;
                this.loadPage(nextPage);
            } else {
                this.pendingPage = null;
            }
        }
    }

    renderPageContent(page, container) {
        switch (page) {
            case 'dashboard':
                this.renderDashboard(container);
                break;
            case 'swpuUsers':
                this.renderSwpuUsers(container);
                break;
            case 'ncicRooms':
                this.renderNcicRooms(container);
                break;
            case 'devices':
                this.renderDevices(container);
                break;
            case 'managementPages':
                this.renderManagementPages(container);
                break;
            case 'dailyPatrols':
                this.renderDailyPatrols(container);
                break;
            case 'reports':
                this.renderReports(container);
                break;
            case 'knowledge':
                this.renderKnowledgeBase(container);
                break;
            case 'documents':
                this.renderDocuments(container);
                break;
            case 'settings':
                this.renderSettings(container);
                break;
            case 'logs':
                this.renderLogs(container);
                break;
            default:
                this.renderDashboard(container);
        }
    }

    getStatusText(status) {
        return ({ unchecked: '未检查', normal: '正常', warning: '警告', error: '异常', active: '启用', inactive: '停用' })[status] || status;
    }

    getRoleText(role) {
        return ({ admin: '管理员', engineer: '巡检工程师', duty: '值班工程师' })[role] || role;
    }

    renderToolbar(title, options = {}) {
        return `
            <div class="table-header table-toolbar">
                <div>
                    <h3>${title}</h3>
                    ${options.note ? `<div class="table-note">${options.note}</div>` : ''}
                </div>
                <div class="toolbar-actions">
                    ${options.searchPlaceholder ? `<input class="form-control toolbar-search" id="${options.searchId}" placeholder="${options.searchPlaceholder}">` : ''}
                    ${(options.actionButtons || []).map((button) => `<button class="btn ${button.className || ''}" id="${button.id}" type="button"><i class="fas ${button.icon}"></i>${button.label}</button>`).join('')}
                    ${options.primaryAction ? `<button class="btn" id="${options.primaryAction.id}"><i class="fas fa-plus"></i>${options.primaryAction.label}</button>` : ''}
                </div>
            </div>
        `;
    }

    bindSearch(inputId, callback) {
        document.getElementById(inputId)?.addEventListener('input', (event) => callback(event.target.value.trim()));
    }

    addOperationLog(action, payload = {}, level = 'info') {
        const logs = window.SWPUData.fetchSwpuData('dutyLog', () => []);
        logs.unshift({
            id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            action,
            level,
            operator: this.currentUser?.name || '系统',
            timestamp: window.SWPUData.formatLocalDateTime ? window.SWPUData.formatLocalDateTime() : new Date().toISOString(),
            payload
        });
        window.SWPUData.persistNcicRecord('dutyLog', logs.slice(0, 300));
    }

    getStatusRefreshSettings() {
        const enabled = window.localStorage.getItem('ncicStatusRefreshEnabled') === 'true';
        const time = window.localStorage.getItem('ncicStatusRefreshTime') || '08:00';
        const scopes = this.getStatusRefreshScopes();
        return { enabled, time: /^\d{2}:\d{2}$/.test(time) ? time : '08:00', scopes };
    }

    getStatusRefreshScopes() {
        const raw = window.localStorage.getItem('ncicStatusRefreshScopes');
        if (!raw) {
            return ['rooms'];
        }
        try {
            const scopes = JSON.parse(raw);
            return Array.isArray(scopes) && scopes.length ? scopes : ['rooms'];
        } catch (error) {
            return ['rooms'];
        }
    }

    startAutoStatusRefresh() {
        if (this.statusRefreshTimer) {
            clearTimeout(this.statusRefreshTimer);
            this.statusRefreshTimer = null;
        }
        const settings = this.getStatusRefreshSettings();
        if (!settings.enabled) {
            return;
        }
        const [hour, minute] = settings.time.split(':').map(Number);
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(hour, minute, 0, 0);
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        this.statusRefreshTimer = setTimeout(() => {
            this.refreshSelectedStatuses(settings.scopes, { silent: true, source: 'auto' });
            this.startAutoStatusRefresh();
        }, nextRun.getTime() - now.getTime());
    }

    refreshAllNcicRoomStatuses(options = {}) {
        return this.refreshSelectedStatuses(['rooms'], options);
    }

    refreshSelectedStatuses(scopes = ['rooms'], options = {}) {
        const scopeSet = new Set(scopes);
        const result = { total: 0, changed: 0, scopes: Array.from(scopeSet) };
        if (scopeSet.has('rooms')) {
            const roomResult = this.refreshRoomStatusesOnly();
            result.total += roomResult.total;
            result.changed += roomResult.changed;
        }
        if (scopeSet.has('devices')) {
            const deviceResult = this.refreshDeviceStatusesOnly();
            result.total += deviceResult.total;
            result.changed += deviceResult.changed;
        }
        if (scopeSet.has('managementPages')) {
            const managementResult = this.refreshManagementStatusesOnly();
            result.total += managementResult.total;
            result.changed += managementResult.changed;
        }
        this.addOperationLog(options.source === 'auto' ? '自动刷新状态' : '刷新状态', {
            total: result.total,
            changed: result.changed,
            scopes: result.scopes,
            source: options.source || 'manual'
        }, result.changed ? 'success' : 'info');
        if (!options.silent) {
            this.showNotification(`已刷新 ${result.total} 项状态，变化 ${result.changed} 项`, 'success');
        }
        if (['dashboard', 'reports', 'ncicRooms', 'dailyPatrols', 'devices', 'managementPages'].includes(this.currentPage)) {
            this.loadPage(this.currentPage);
        }
        this.refreshNotificationButton();
        return result;
    }

    refreshRoomStatusesOnly() {
        const before = window.SWPUData.getNcicRooms().map((item) => ({ id: item.id, status: item.status }));
        const refreshedRooms = window.SWPUData.getNcicRooms().map((room) => ({
            ...room,
            status: 'unchecked',
            lastInspection: null
        }));
        window.SWPUData.saveNcicRooms(refreshedRooms);
        const changedCount = refreshedRooms.filter((room) => {
            const previous = before.find((item) => item.id === room.id);
            return previous && previous.status !== room.status;
        }).length;
        return { total: refreshedRooms.length, changed: changedCount };
    }

    refreshDeviceStatusesOnly() {
        const before = window.SWPUData.getDevices().map((item) => ({ id: item.id, status: item.status }));
        const refreshedDevices = window.SWPUData.getDevices().map((device) => ({
            ...device,
            status: 'unchecked',
            updatedAt: window.SWPUData.getTodayDate()
        }));
        window.SWPUData.saveDevices(refreshedDevices);
        const changedCount = refreshedDevices.filter((device) => {
            const previous = before.find((item) => item.id === device.id);
            return previous && previous.status !== device.status;
        }).length;
        return { total: refreshedDevices.length, changed: changedCount };
    }

    refreshManagementStatusesOnly() {
        const before = window.SWPUData.getManagementPages().map((item) => ({ id: item.id, status: item.status }));
        const refreshedPages = window.SWPUData.getManagementPages().map((page) => ({
            ...page,
            status: 'unchecked',
            lastInspection: null
        }));
        window.SWPUData.saveManagementPages(refreshedPages);
        const changedCount = refreshedPages.filter((page) => {
            const previous = before.find((item) => item.id === page.id);
            return previous && previous.status !== page.status;
        }).length;
        return { total: refreshedPages.length, changed: changedCount };
    }

    showFormModal(config) {
        const modalId = config.modalId || 'taskModal';
        const modal = document.getElementById(modalId);
        if (!modal) return;
        const title = modal.querySelector('.modal-header h2');
        const body = modal.querySelector('.modal-body');
        title.textContent = config.title;
        body.innerHTML = `
            <form id="dynamicForm">
                ${config.fields.map((field) => this.renderField(field, config.values || {})).join('')}
                <div class="form-row">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" data-close-modal="${modalId}">取消</button>
                </div>
            </form>
        `;
        modal.classList.add('active');
        body.querySelector(`[data-close-modal="${modalId}"]`)?.addEventListener('click', () => closeModal(modalId));
        body.querySelector('#dynamicForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = event.submitter || body.querySelector('#dynamicForm button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.dataset.originalText = submitButton.textContent;
                submitButton.textContent = '保存中...';
            }
            const formData = this.collectFormData(config.fields, body);
            try {
                const result = await config.onSubmit(formData);
                if (result !== false) {
                    closeModal(modalId);
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = submitButton.dataset.originalText || '保存';
                }
            }
        });
    }

    renderField(field, values) {
        const value = values[field.name] ?? field.value ?? '';
        if (field.type === 'select') {
            return `
                <div class="form-group ${field.fullWidth ? 'form-group-full' : ''}">
                    <label class="form-label" for="${field.name}">${field.label}</label>
                    <select class="form-control" id="${field.name}" name="${field.name}">
                        ${field.options.map((option) => `<option value="${option.value}" ${String(option.value) === String(value) ? 'selected' : ''}>${option.label}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        if (field.type === 'textarea') {
            return `
                <div class="form-group ${field.fullWidth ? 'form-group-full' : ''}">
                    <label class="form-label" for="${field.name}">${field.label}</label>
                    <textarea class="form-control" id="${field.name}" name="${field.name}" rows="${field.rows || 4}" ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>${value}</textarea>
                </div>
            `;
        }
        if (field.type === 'file') {
            return `
                <div class="form-group ${field.fullWidth ? 'form-group-full' : ''}">
                    <label class="form-label" for="${field.name}">${field.label}</label>
                    <input class="form-control document-upload-input" id="${field.name}" name="${field.name}" type="file" ${field.accept ? `accept="${field.accept}"` : ''}>
                    ${field.help ? `<div class="form-help">${field.help}</div>` : ''}
                </div>
            `;
        }
        return `
            <div class="form-group ${field.fullWidth ? 'form-group-full' : ''}">
                <label class="form-label" for="${field.name}">${field.label}</label>
                <input class="form-control" id="${field.name}" name="${field.name}" type="${field.type || 'text'}" value="${value}" ${field.readonly ? 'readonly' : ''} ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}>
            </div>
        `;
    }

    collectFormData(fields, container) {
        return fields.reduce((result, field) => {
            const element = container.querySelector(`#${field.name}`);
            if (field.type === 'file') {
                result[field.name] = element?.files?.[0] || null;
            } else {
                result[field.name] = element ? element.value.trim() : '';
            }
            return result;
        }, {});
    }

    downloadWorkbook(fileName, sheetName, rows) {
        if (!window.XLSX) {
            this.showNotification('当前未加载导出组件，无法导出', 'warning');
            return;
        }
        const worksheet = window.XLSX.utils.json_to_sheet(rows);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        window.XLSX.writeFile(workbook, fileName);
    }

    triggerImport(accept, onLoad) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                await onLoad(file);
            } catch (error) {
                this.showNotification(error.message || '导入失败，请检查文件格式', 'error');
            }
        });
        document.body.appendChild(input);
        input.click();
        requestAnimationFrame(() => input.remove());
    }

    async readImportRows(file) {
        if (file.name.toLowerCase().endsWith('.json')) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                throw new Error('JSON 文件必须为数组结构');
            }
            return parsed;
        }
        if (!window.XLSX) {
            throw new Error('当前未加载导入组件，无法读取文件');
        }
        const buffer = await file.arrayBuffer();
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return window.XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    }

    renderDashboard(container) {
        const swpuUsers = window.SWPUData.getSwpuUsers();
        const ncicRooms = window.SWPUData.getNcicRooms();
        const alerts = this.getDashboardAlerts(6);
        const todayDuty = window.SWPUData.getTodayDutyRecord();
        const todayPending = window.SWPUData.getPendingCountByDate(window.SWPUData.getTodayDate());

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-info"><h3>用户总数</h3><div class="stat-number">${swpuUsers.length}</div><div class="stat-trend">活跃 ${swpuUsers.filter((item) => item.status === 'active').length}</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-building"></i></div>
                    <div class="stat-info"><h3>机房数量</h3><div class="stat-number">${ncicRooms.length}</div><div class="stat-trend">首页核心机房不可删除</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clipboard-check"></i></div>
                    <div class="stat-info"><h3>今日待巡检</h3><div class="stat-number">${todayPending}</div><div class="stat-trend">已完成 ${ncicRooms.length - todayPending}</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-info"><h3>今日值班</h3><div class="stat-number stat-number-text">${todayDuty ? todayDuty.swpuUserName : '未排班'}</div><div class="stat-trend">${todayDuty ? todayDuty.phone : '请在值班管理中维护'}</div></div>
                </div>
            </div>
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-header"><h3>近 7 天巡检趋势</h3><span class="table-note">固定图表高度，避免页面自动变大</span></div>
                    <div class="chart-canvas-wrap"><canvas id="dashboardTrendChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <div class="chart-header"><h3>当前状态分布</h3></div>
                    <div class="chart-canvas-wrap chart-canvas-wrap-small"><canvas id="dashboardStatusChart"></canvas></div>
                </div>
            </div>
            <div class="table-card">
                <div class="table-header"><h3>最近告警</h3></div>
                <table>
                    <thead><tr><th>对象</th><th>状态</th><th>巡检人/来源</th><th>时间</th></tr></thead>
                    <tbody>
                        ${alerts.length ? alerts.map((item) => `<tr><td>${item.title || item.ncicRoomName || '-'}</td><td>${this.getStatusText(item.status || item.level)}</td><td>${item.inspector || item.operator || '系统'}</td><td>${this.formatRecordTime(item.timestamp)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">暂无未处理告警</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        this.renderDashboardCharts();
    }

    renderDashboardCharts() {
        const trend = window.SWPUData.createDailyPatrolTrend(7);
        const ncicRooms = window.SWPUData.getNcicRooms();
        const normalCount = ncicRooms.filter((item) => item.status === 'normal').length;
        const warningCount = ncicRooms.filter((item) => item.status === 'warning').length;
        const uncheckedCount = ncicRooms.filter((item) => item.status === 'unchecked').length;

        this.destroyCharts();

        const trendCanvas = document.getElementById('dashboardTrendChart');
        const statusCanvas = document.getElementById('dashboardStatusChart');
        if (trendCanvas && window.Chart) {
            this.dashboardTrendChart = new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: trend.map((item) => item.date.slice(5)),
                    datasets: [
                        { label: '完成率', data: trend.map((item) => item.completed), borderColor: '#1a73e8', backgroundColor: 'rgba(26,115,232,.15)', tension: .35, fill: true },
                        { label: '逾期率', data: trend.map((item) => item.overdue), borderColor: '#f2994a', backgroundColor: 'rgba(242,153,74,.1)', tension: .35, fill: true }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, resizeDelay: 120 }
            });
        }
        if (statusCanvas && window.Chart) {
            this.dashboardStatusChart = new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['正常', '警告', '待巡检'],
                    datasets: [{ data: [normalCount, warningCount, uncheckedCount], backgroundColor: ['#27ae60', '#f2994a', '#95a5a6'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, resizeDelay: 120 }
            });
        }
    }

    renderSwpuUsers(container, keyword = '') {
        const swpuUsers = window.SWPUData.getSwpuUsers().filter((item) => !keyword || `${item.name}${item.swpuUsername}${item.department}${item.employeeId}`.includes(keyword));
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('用户管理', { searchId: 'swpuUserSearch', searchPlaceholder: '搜索姓名/用户名/部门/工号', primaryAction: { id: 'addSwpuUserBtn', label: '新增用户' } })}
                <table>
                    <thead><tr><th>姓名</th><th>用户名</th><th>部门</th><th>角色</th><th>状态</th><th>电话</th><th>操作</th></tr></thead>
                    <tbody>${swpuUsers.map((item) => `<tr><td>${item.name}</td><td>${item.swpuUsername}</td><td>${item.department}</td><td>${item.roles.map((role) => this.getRoleText(role)).join(' / ')}</td><td>${this.getStatusText(item.status)}</td><td>${item.phone}</td><td><button class="action-btn edit" data-edit-swpu-user="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-swpu-user="${item.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
        this.bindSearch('swpuUserSearch', (value) => this.renderSwpuUsers(container, value));
        document.getElementById('addSwpuUserBtn')?.addEventListener('click', () => this.openSwpuUserEditor());
        container.querySelectorAll('[data-edit-swpu-user]').forEach((button) => button.addEventListener('click', () => this.openSwpuUserEditor(button.dataset.editSwpuUser)));
        container.querySelectorAll('[data-delete-swpu-user]').forEach((button) => button.addEventListener('click', () => this.deleteSwpuUser(button.dataset.deleteSwpuUser)));
    }

    renderNcicRooms(container, keyword = '') {
        const ncicRooms = window.SWPUData.getNcicRooms().filter((item) => !keyword || `${item.name}${item.type}${item.location}`.includes(keyword));
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('机房管理', {
                    searchId: 'ncicRoomSearch',
                    searchPlaceholder: '搜索机房名称/类型/位置',
                    actionButtons: [{ id: 'refreshNcicRoomStatusBtn', icon: 'fa-rotate', label: '刷新所有状态', className: 'btn-secondary-lite' }],
                    primaryAction: { id: 'addNcicRoomBtn', label: '新增机房' },
                    note: 'NCIC = 网信中心，刷新会把所选机房重置为未检查'
                })}
                <table>
                    <thead><tr><th>机房</th><th>类型</th><th>位置</th><th>状态</th><th>核心</th><th>最近巡检</th><th>操作</th></tr></thead>
                    <tbody>${ncicRooms.map((item) => `<tr><td>${item.name}</td><td>${item.type}</td><td>${item.location}</td><td>${this.getStatusText(item.status)}</td><td>${item.isCore ? '<span class="role-badge role-admin">首页核心</span>' : '-'}</td><td>${item.lastInspection ? new Date(item.lastInspection).toLocaleString('zh-CN') : '-'}</td><td><button class="action-btn edit" data-edit-ncic-room="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-ncic-room="${item.id}" ${item.isCore ? 'disabled title="首页核心机房不可删除"' : ''}><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
        this.bindSearch('ncicRoomSearch', (value) => this.renderNcicRooms(container, value));
        document.getElementById('refreshNcicRoomStatusBtn')?.addEventListener('click', () => this.refreshAllNcicRoomStatuses());
        document.getElementById('addNcicRoomBtn')?.addEventListener('click', () => this.openNcicRoomEditor());
        container.querySelectorAll('[data-edit-ncic-room]').forEach((button) => button.addEventListener('click', () => this.openNcicRoomEditor(button.dataset.editNcicRoom)));
        container.querySelectorAll('[data-delete-ncic-room]').forEach((button) => button.addEventListener('click', () => this.deleteNcicRoom(button.dataset.deleteNcicRoom)));
    }

    renderDevices(container, keyword = '') {
        const devices = window.SWPUData.getDevices().filter((item) => !keyword || `${item.name}${item.type}${item.model || ''}${item.ncicRoomName}${item.owner || ''}`.includes(keyword));
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('设备与仪器管理', { searchId: 'deviceSearch', searchPlaceholder: '搜索设备名称/类型/机房', primaryAction: { id: 'addDeviceBtn', label: '新增设备仪器' }, note: '设备故障率 = 故障次数 / 巡检次数' })}
                <table>
                    <thead><tr><th>设备仪器</th><th>类型</th><th>所在机房</th><th>型号</th><th>状态</th><th>故障率</th><th>操作</th></tr></thead>
                    <tbody>${devices.map((item) => `<tr><td>${item.name}</td><td>${item.type}</td><td>${item.ncicRoomName}</td><td>${item.model || '-'}</td><td>${this.getStatusText(item.status)}</td><td>${item.inspectionCount ? `${Math.round((item.faultCount / item.inspectionCount) * 100)}% (${item.faultCount}/${item.inspectionCount})` : '0%'}</td><td><button class="action-btn edit" data-edit-device="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-device="${item.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
        this.bindSearch('deviceSearch', (value) => this.renderDevices(container, value));
        document.getElementById('addDeviceBtn')?.addEventListener('click', () => this.openDeviceEditor());
        container.querySelectorAll('[data-edit-device]').forEach((button) => button.addEventListener('click', () => this.openDeviceEditor(button.dataset.editDevice)));
        container.querySelectorAll('[data-delete-device]').forEach((button) => button.addEventListener('click', () => this.deleteDevice(button.dataset.deleteDevice)));
    }

    renderManagementPages(container, keyword = '') {
        const managementPages = window.SWPUData.getManagementPages().filter((item) => !keyword || `${item.name}${item.type}${item.system}${item.owner}`.includes(keyword));
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('管理页面管理', { searchId: 'managementPageSearch', searchPlaceholder: '搜索页面名称/系统/责任部门', primaryAction: { id: 'addManagementPageBtn', label: '新增管理页面' }, note: '管理页面状态由前台巡查记录自动回写' })}
                <table>
                    <thead><tr><th>页面名称</th><th>分类</th><th>系统归属</th><th>责任部门</th><th>状态</th><th>最近巡查</th><th>操作</th></tr></thead>
                    <tbody>${managementPages.length ? managementPages.map((item) => `<tr><td>${item.name}</td><td>${item.type}</td><td>${item.system}</td><td>${item.owner}</td><td>${this.getStatusText(item.status)}</td><td>${item.lastInspection ? new Date(item.lastInspection).toLocaleString('zh-CN') : '未巡查'}</td><td><button class="action-btn edit" data-edit-management-page="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-management-page="${item.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">暂无管理页面数据</td></tr>'}</tbody>
                </table>
            </div>
        `;
        this.bindSearch('managementPageSearch', (value) => this.renderManagementPages(container, value));
        document.getElementById('addManagementPageBtn')?.addEventListener('click', () => this.openManagementPageEditor());
        container.querySelectorAll('[data-edit-management-page]').forEach((button) => button.addEventListener('click', () => this.openManagementPageEditor(button.dataset.editManagementPage)));
        container.querySelectorAll('[data-delete-management-page]').forEach((button) => button.addEventListener('click', () => this.deleteManagementPage(button.dataset.deleteManagementPage)));
    }

    renderDailyPatrols(container, keyword = '', dateFilter = this.recordDates.dailyPatrols) {
        const activeDate = this.normalizeDateFilter(dateFilter);
        this.recordDates.dailyPatrols = activeDate;
        const records = window.SWPUData.getDailyPatrolList()
            .filter((item) => !keyword || `${item.ncicRoomName}${item.inspector}${item.status}${item.notes || ''}`.includes(keyword))
            .filter((item) => !activeDate || this.getRecordDateString(item.timestamp || item.date) === activeDate)
            .sort((a, b) => this.getRecordTimeValue(b.timestamp) - this.getRecordTimeValue(a.timestamp));
        const pageData = this.getPagedRecords(records, 'dailyPatrols');
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('巡检记录', { searchId: 'dailyPatrolSearch', searchPlaceholder: '搜索机房/巡检人/状态/备注', primaryAction: { id: 'addDailyPatrolBtn', label: '新增巡检' }, note: `当前日期 ${activeDate || '全部'}，共 ${records.length} 条` })}
                <div class="admin-record-filter">
                    <label><i class="fas fa-calendar-days"></i><span>记录日期</span><input id="dailyPatrolDateFilter" type="date" value="${activeDate}"></label>
                    <button type="button" id="dailyPatrolTodayBtn">今天</button>
                    <button type="button" id="dailyPatrolClearDateBtn">清空日期</button>
                </div>
                <table>
                    <thead><tr><th>机房</th><th>状态</th><th>巡检人</th><th>备注</th><th>时间</th><th>操作</th></tr></thead>
                    <tbody>${pageData.items.length ? pageData.items.map((item) => `<tr><td>${item.ncicRoomName}</td><td>${this.getStatusText(item.status)}</td><td>${item.inspector}</td><td>${item.notes || '-'}</td><td>${this.formatRecordTime(item.timestamp)}</td><td><button class="action-btn edit" data-edit-daily-patrol="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-daily-patrol="${item.id}" data-delete-room-id="${item.ncicRoomId}"><i class="fas fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">暂无巡检记录</td></tr>'}</tbody>
                </table>
                ${this.renderAdminPagination('dailyPatrols', pageData)}
            </div>
        `;
        this.bindSearch('dailyPatrolSearch', (value) => {
            this.recordPages.dailyPatrols = 1;
            this.renderDailyPatrols(container, value, this.recordDates.dailyPatrols);
        });
        document.getElementById('dailyPatrolDateFilter')?.addEventListener('change', (event) => {
            this.recordPages.dailyPatrols = 1;
            this.renderDailyPatrols(container, document.getElementById('dailyPatrolSearch')?.value.trim() || '', event.target.value);
        });
        document.getElementById('dailyPatrolTodayBtn')?.addEventListener('click', () => {
            this.recordPages.dailyPatrols = 1;
            this.renderDailyPatrols(container, document.getElementById('dailyPatrolSearch')?.value.trim() || '', window.SWPUData.getTodayDate());
        });
        document.getElementById('dailyPatrolClearDateBtn')?.addEventListener('click', () => {
            this.recordPages.dailyPatrols = 1;
            this.renderDailyPatrols(container, document.getElementById('dailyPatrolSearch')?.value.trim() || '', '');
        });
        this.bindAdminPagination(container, 'dailyPatrols', () => this.renderDailyPatrols(container, document.getElementById('dailyPatrolSearch')?.value.trim() || '', this.recordDates.dailyPatrols));
        document.getElementById('addDailyPatrolBtn')?.addEventListener('click', () => this.openDailyPatrolEditor());
        container.querySelectorAll('[data-edit-daily-patrol]').forEach((button) => button.addEventListener('click', () => this.openDailyPatrolEditor(button.dataset.editDailyPatrol)));
        container.querySelectorAll('[data-delete-daily-patrol]').forEach((button) => button.addEventListener('click', () => this.deleteDailyPatrol(button.dataset.deleteRoomId, button.dataset.deleteDailyPatrol)));
    }
    renderReports(container) {
        const report = window.SWPUData.createFaultRateReport(30);
        const topRooms = report.roomFaultRates.slice(0, 8);
        const topDevices = report.deviceFaultRates.slice(0, 8);
        container.innerHTML = `
            <div class="stats-grid report-summary-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-building-shield"></i></div>
                    <div class="stat-info"><h3>机房最高故障率</h3><div class="stat-number stat-number-text">${topRooms[0] ? `${topRooms[0].name}` : '暂无数据'}</div><div class="stat-trend">${topRooms[0] ? `${topRooms[0].faultRate}%` : '近 30 天无巡检记录'}</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-microchip"></i></div>
                    <div class="stat-info"><h3>设备最高故障率</h3><div class="stat-number stat-number-text">${topDevices[0] ? `${topDevices[0].name}` : '暂无数据'}</div><div class="stat-trend">${topDevices[0] ? `${topDevices[0].faultRate}%` : '当前无设备数据'}</div></div>
                </div>
            </div>
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-header"><h3>机房故障率排行</h3><span class="table-note">近 30 天异常巡检次数占比</span></div>
                    <div class="chart-canvas-wrap"><canvas id="reportRoomChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <div class="chart-header"><h3>设备仪器故障率排行</h3><span class="table-note">基于设备巡检次数与故障次数统计</span></div>
                    <div class="chart-canvas-wrap"><canvas id="reportDeviceChart"></canvas></div>
                </div>
            </div>
            <div class="charts-grid">
                <div class="table-card">
                    <div class="table-header"><h3>机房故障率明细</h3></div>
                    <table>
                        <thead><tr><th>机房</th><th>巡检次数</th><th>异常次数</th><th>故障率</th></tr></thead>
                        <tbody>${report.roomFaultRates.length ? report.roomFaultRates.map((item) => `<tr><td>${item.name}</td><td>${item.inspectionCount}</td><td>${item.faultCount}</td><td>${item.faultRate}%</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">暂无机房故障率数据</td></tr>'}</tbody>
                    </table>
                </div>
                <div class="table-card">
                    <div class="table-header"><h3>设备仪器故障率明细</h3></div>
                    <table>
                        <thead><tr><th>设备仪器</th><th>所属机房</th><th>巡检次数</th><th>故障次数</th><th>故障率</th></tr></thead>
                        <tbody>${report.deviceFaultRates.length ? report.deviceFaultRates.map((item) => `<tr><td>${item.name}</td><td>${item.ncicRoomName}</td><td>${item.inspectionCount}</td><td>${item.faultCount}</td><td>${item.faultRate}%</td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">暂无设备故障率数据</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
        const roomCanvas = document.getElementById('reportRoomChart');
        const deviceCanvas = document.getElementById('reportDeviceChart');
        if (roomCanvas && window.Chart) {
            this.reportTrendChart = new Chart(roomCanvas, {
                type: 'bar',
                data: {
                    labels: topRooms.map((item) => item.name),
                    datasets: [
                        { label: '机房故障率', data: topRooms.map((item) => item.faultRate), borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,.55)', borderRadius: 8 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, resizeDelay: 120, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }
        if (deviceCanvas && window.Chart) {
            this.reportDeviceChart = new Chart(deviceCanvas, {
                type: 'bar',
                data: {
                    labels: topDevices.map((item) => item.name),
                    datasets: [
                        { label: '设备故障率', data: topDevices.map((item) => item.faultRate), borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,.55)', borderRadius: 8 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, resizeDelay: 120, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }
    }

    getMessageCenterItems() {
        const pendingCount = window.SWPUData.getPendingCountByDate(window.SWPUData.getTodayDate());
        const todayDuty = window.SWPUData.getTodayDutyRecord();
        const dailyPatrolAlerts = this.getActiveRoomAlerts(5).map((item) => ({
            type: item.status === 'error' ? 'error' : 'warning',
            icon: item.status === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation',
            title: `${item.ncicRoomName} ${this.getStatusText(item.status)}`,
            desc: `${item.inspector} · ${new Date(item.timestamp).toLocaleString('zh-CN')}`,
            page: 'dailyPatrols',
            targetUrl: `detail.html?ncicRoomId=${encodeURIComponent(item.ncicRoomId || '')}`,
            timestamp: new Date(item.timestamp).getTime()
        }));
        const deviceAlerts = window.SWPUData.getDevices()
            .filter((item) => item.status === 'warning' || item.status === 'error')
            .map((item) => ({
                type: item.status === 'error' ? 'error' : 'warning',
                icon: item.status === 'error' ? 'fa-microchip' : 'fa-screwdriver-wrench',
                title: `${item.name} 设备异常`,
                desc: `${item.ncicRoomName} · 当前状态 ${this.getStatusText(item.status)}`,
                page: 'devices',
                targetUrl: `detail.html?deviceId=${encodeURIComponent(item.id)}`,
                timestamp: new Date(item.updatedAt || window.SWPUData.getTodayDate()).getTime()
            }));
        const managementAlerts = window.SWPUData.getManagementPages()
            .filter((item) => item.status === 'warning' || item.status === 'error')
            .map((item) => ({
                type: item.status === 'error' ? 'error' : 'warning',
                icon: item.status === 'error' ? 'fa-desktop' : 'fa-window-maximize',
                title: `${item.name} 页面异常`,
                desc: `${item.system} · 当前状态 ${this.getStatusText(item.status)}`,
                page: 'managementPages',
                targetUrl: `detail.html?managementId=${encodeURIComponent(item.id)}`,
                timestamp: new Date(item.lastInspection || window.SWPUData.getTodayDate()).getTime()
            }));
        const systemItems = [];
        if (todayDuty) {
            systemItems.push({
                type: todayDuty.pendingCount > 0 ? 'warning' : 'info',
                icon: 'fa-calendar-check',
                title: `今日值班：${todayDuty.swpuUserName}`,
                desc: todayDuty.pendingCount > 0 ? `还有 ${todayDuty.pendingCount} 个机房待巡检` : '今日巡检任务已闭环',
                page: todayDuty.pendingCount > 0 ? 'dailyPatrols' : 'duty',
                targetUrl: todayDuty.pendingCount > 0 ? 'detail.html?view=all' : '',
                timestamp: Date.now()
            });
        }
        if (pendingCount > 0) {
            systemItems.push({
                type: 'warning',
                icon: 'fa-bell',
                title: '待巡检提醒',
                desc: `当前仍有 ${pendingCount} 个机房未完成巡检`,
                page: 'dailyPatrols',
                targetUrl: 'detail.html?view=all',
                timestamp: Date.now() - 1
            });
        }
        return [...systemItems, ...dailyPatrolAlerts, ...deviceAlerts, ...managementAlerts]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 8);
    }

    getActiveRoomAlerts(limit) {
        const currentRooms = new Map(window.SWPUData.getNcicRooms().map((item) => [item.id, item]));
        const latestAlertByRoom = new Map();
        window.SWPUData.getRecentAlerts(50).forEach((item) => {
            const currentRoom = currentRooms.get(item.ncicRoomId);
            if (!currentRoom || (currentRoom.status !== 'warning' && currentRoom.status !== 'error')) {
                return;
            }
            const existing = latestAlertByRoom.get(item.ncicRoomId);
            if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
                latestAlertByRoom.set(item.ncicRoomId, {
                    ...item,
                    status: currentRoom.status
                });
            }
        });
        return Array.from(latestAlertByRoom.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    getDashboardAlerts(limit) {
        const activeAlerts = window.SWPUData.getUnifiedRecentAlerts(50)
            .filter((item) => {
                if (item.targetType === 'room') {
                    const room = window.SWPUData.getNcicRooms().find((target) => target.id === item.ncicRoomId);
                    return room && (room.status === 'warning' || room.status === 'error');
                }
                if (item.targetType === 'device') {
                    const device = window.SWPUData.getDevices().find((target) => target.id === item.deviceId);
                    return device && (device.status === 'warning' || device.status === 'error');
                }
                if (item.targetType === 'management') {
                    const page = window.SWPUData.getManagementPages().find((target) => target.id === item.managementId);
                    return page && (page.status === 'warning' || page.status === 'error');
                }
                return item.status === 'warning' || item.status === 'error';
            })
            .map((item) => ({
                ...item,
                title: item.title || item.ncicRoomName || item.deviceName || item.managementName
            }));
        const logAlerts = window.SWPUData.fetchSwpuData('dutyLog', () => [])
            .filter((item) => item.level === 'warning' || item.level === 'error' || /告警|异常|失败/.test(item.action || ''))
            .map((item) => ({
                ...item,
                title: item.payload?.targetName || item.payload?.name || item.action,
                status: item.level === 'error' ? 'error' : 'warning'
            }));
        return [...activeAlerts, ...logAlerts]
            .sort((a, b) => this.getRecordTimeValue(b.timestamp) - this.getRecordTimeValue(a.timestamp))
            .slice(0, limit);
    }

    formatRecordTime(timestamp) {
        if (!timestamp) return '-';
        const value = String(timestamp);
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (match) return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN', { hour12: false });
    }

    getRecordTimeValue(timestamp) {
        if (!timestamp) return 0;
        const value = String(timestamp);
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)).getTime();
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }

    normalizeDateFilter(value) {
        const text = String(value || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    }

    getRecordDateString(value) {
        if (!value) return '';
        const text = String(value);
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
        const parsed = value instanceof Date ? value : new Date(text);
        if (Number.isNaN(parsed.getTime())) return '';
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }

    getPagedRecords(records, key) {
        const totalPages = Math.max(1, Math.ceil(records.length / this.recordPageSize));
        const page = Math.min(Math.max(1, Number(this.recordPages[key] || 1)), totalPages);
        this.recordPages[key] = page;
        const start = (page - 1) * this.recordPageSize;
        return {
            page,
            totalPages,
            totalItems: records.length,
            items: records.slice(start, start + this.recordPageSize)
        };
    }

    renderAdminPagination(key, pageData) {
        if (!pageData || pageData.totalItems <= this.recordPageSize) return '';
        return `
            <div class="admin-record-pagination" data-record-pagination="${key}">
                <span>第 ${pageData.page} / ${pageData.totalPages} 页，共 ${pageData.totalItems} 条</span>
                <button type="button" data-record-page="prev" ${pageData.page <= 1 ? 'disabled' : ''}>上一页</button>
                <button type="button" data-record-page="next" ${pageData.page >= pageData.totalPages ? 'disabled' : ''}>下一页</button>
            </div>
        `;
    }

    bindAdminPagination(container, key, rerender) {
        container.querySelector(`[data-record-pagination="${key}"] [data-record-page="prev"]`)?.addEventListener('click', () => {
            this.recordPages[key] = Math.max(1, Number(this.recordPages[key] || 1) - 1);
            rerender();
        });
        container.querySelector(`[data-record-pagination="${key}"] [data-record-page="next"]`)?.addEventListener('click', () => {
            this.recordPages[key] = Number(this.recordPages[key] || 1) + 1;
            rerender();
        });
    }
    refreshNotificationButton() {
        const badge = document.querySelector('.notification-btn .badge');
        if (!badge) return;
        const count = this.getMessageCenterItems().length;
        badge.textContent = String(count);
        badge.style.display = count ? 'inline-flex' : 'none';
    }

    ensureMessageCenter() {
        let panel = document.getElementById('messageCenter');
        if (panel) {
            return panel;
        }
        panel = document.createElement('div');
        panel.id = 'messageCenter';
        panel.className = 'message-center';
        panel.innerHTML = `
            <div class="message-center-header">
                <div>
                    <h3>消息提醒</h3>
                    <div class="table-note">机房、设备与值班联动提醒</div>
                </div>
                <button class="close-btn" type="button" data-close-message-center><i class="fas fa-times"></i></button>
            </div>
            <div class="message-center-body"></div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('[data-close-message-center]')?.addEventListener('click', () => this.toggleMessageCenter(false));
        panel.addEventListener('click', (event) => event.stopPropagation());
        return panel;
    }

    renderMessageCenter() {
        const panel = this.ensureMessageCenter();
        const body = panel.querySelector('.message-center-body');
        const items = this.getMessageCenterItems();
        body.innerHTML = items.length ? items.map((item, index) => `
            <button class="message-item ${item.type}" type="button" data-message-page="${item.page}" data-message-index="${index}">
                <span class="message-item-icon"><i class="fas ${item.icon}"></i></span>
                <span class="message-item-content">
                    <span class="message-item-title">${item.title}</span>
                    <span class="message-item-desc">${item.desc}</span>
                </span>
            </button>
        `).join('') : '<div class="empty-state">暂无新的提醒消息</div>';
        body.querySelectorAll('[data-message-page]').forEach((button) => {
            button.addEventListener('click', () => {
                const item = items[Number(button.dataset.messageIndex)];
                this.toggleMessageCenter(false);
                if (item?.targetUrl) {
                    window.location.href = item.targetUrl;
                    return;
                }
                this.switchPage(button.dataset.messagePage);
            });
        });
    }

    toggleMessageCenter(force) {
        const panel = this.ensureMessageCenter();
        const nextActive = typeof force === 'boolean' ? force : !panel.classList.contains('active');
        if (nextActive) {
            this.renderMessageCenter();
        }
        panel.classList.toggle('active', nextActive);
    }

    async renderDutyPage(container) {
        try {
            const response = await fetch('admin-duty.html');
            container.innerHTML = await response.text();
        } catch (error) {
            container.innerHTML = '<div class="table-card"><div class="empty-state">值班页面片段加载失败</div></div>';
            return;
        }
        window.adminDutyModule.mount(container);
    }

    renderKnowledgeBase(container, keyword = '') {
        const entries = window.SWPUData.searchCollection(window.SWPUData.getKnowledgeBase(), keyword, ['title', 'category', 'solution', 'tags']);
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('知识库', {
                    searchId: 'knowledgeSearchInput',
                    searchPlaceholder: '搜索故障、设备、分类、标签或处理方法',
                    actionButtons: [
                        { id: 'exportKnowledgeBtn', label: '导出', icon: 'fa-file-export', className: 'btn-secondary-lite' },
                        { id: 'importKnowledgeBtn', label: '导入', icon: 'fa-file-import', className: 'btn-secondary-lite' }
                    ],
                    primaryAction: { id: 'addKnowledgeBtn', label: '新增条目' }
                })}
                ${entries.length ? entries.map((item) => `<div class="knowledge-item"><div class="knowledge-head"><div><div class="knowledge-title">${item.title}</div><div class="knowledge-meta">${item.category} · ${item.tags.join(', ')}</div></div><div class="inline-actions"><button class="action-btn edit" data-edit-knowledge="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-knowledge="${item.id}"><i class="fas fa-trash"></i></button></div></div><div class="knowledge-solution">${item.solution}</div></div>`).join('') : '<div class="empty-state">暂无匹配的知识库条目</div>'}
            </div>
        `;
        const knowledgeInput = document.getElementById('knowledgeSearchInput');
        if (knowledgeInput) knowledgeInput.value = keyword;
        this.bindSearch('knowledgeSearchInput', (value) => this.renderKnowledgeBase(container, value));
        document.getElementById('exportKnowledgeBtn')?.addEventListener('click', () => this.exportKnowledgeBase());
        document.getElementById('importKnowledgeBtn')?.addEventListener('click', () => this.importKnowledgeBase());
        document.getElementById('addKnowledgeBtn')?.addEventListener('click', () => this.openKnowledgeEditor());
        container.querySelectorAll('[data-edit-knowledge]').forEach((button) => button.addEventListener('click', () => this.openKnowledgeEditor(button.dataset.editKnowledge)));
        container.querySelectorAll('[data-delete-knowledge]').forEach((button) => button.addEventListener('click', () => this.deleteKnowledge(button.dataset.deleteKnowledge)));
    }

    getDocumentUrl(item) {
        const value = String(item.url || item.link || item.href || '').trim();
        if (value) return value;
        const title = String(item.title || '').trim();
        return /^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/)/i.test(title) ? title : '';
    }

    getDocumentName(item) {
        const title = String(item.title || item.name || '').trim();
        if (title && !/^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/)/i.test(title)) return title;
        const url = this.getDocumentUrl(item);
        if (!url) return '设备文档';
        try {
            const path = new URL(url, window.location.href).pathname;
            return decodeURIComponent(path.split('/').filter(Boolean).pop() || url);
        } catch (error) {
            return url.split(/[\\/]/).filter(Boolean).pop() || url;
        }
    }

    renderDocumentLink(item) {
        const url = this.getDocumentUrl(item);
        if (!url) return '<span class="table-note">未配置链接</span>';
        const params = new URLSearchParams({ src: url, title: this.getDocumentName(item) });
        return `<a class="table-link" href="document-viewer.html?${params.toString()}" target="_blank" rel="noopener"><i class="fas fa-eye"></i> 查看文档</a>`;
    }

    async uploadDocumentFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/ncic/documents/upload', {
            method: 'POST',
            body: formData
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.code !== 200) {
            throw new Error(payload?.msg || '文档上传失败');
        }
        return payload.data || {};
    }

    renderDocuments(container, keyword = '') {
        const documents = window.SWPUData.searchCollection(window.SWPUData.getDocuments(), keyword, ['title', 'url', 'link', 'category', 'size', 'updatedAt', 'description']);
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('设备文档', {
                    searchId: 'documentSearchInput',
                    searchPlaceholder: '搜索文档链接、名称、设备型号、分类或用途',
                    actionButtons: [
                        { id: 'exportDocumentBtn', label: '导出', icon: 'fa-file-export', className: 'btn-secondary-lite' },
                        { id: 'importDocumentBtn', label: '导入', icon: 'fa-file-import', className: 'btn-secondary-lite' }
                    ],
                    primaryAction: { id: 'addDocumentBtn', label: '新增文档' }
                })}
                <table>
                    <thead><tr><th>文档</th><th>文档链接</th><th>分类</th><th>大小</th><th>更新时间</th><th>内容摘要</th><th>操作</th></tr></thead>
                    <tbody>${documents.length ? documents.map((item) => `<tr><td>${this.getDocumentName(item)}</td><td>${this.renderDocumentLink(item)}</td><td>${item.category}</td><td>${item.size}</td><td>${item.updatedAt}</td><td>${item.description || '-'}</td><td><button class="action-btn edit" data-edit-document="${item.id}"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-delete-document="${item.id}"><i class="fas fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">暂无匹配的设备文档</td></tr>'}</tbody>
                </table>
            </div>
        `;
        const documentInput = document.getElementById('documentSearchInput');
        if (documentInput) documentInput.value = keyword;
        this.bindSearch('documentSearchInput', (value) => this.renderDocuments(container, value));
        document.getElementById('exportDocumentBtn')?.addEventListener('click', () => this.exportDocuments());
        document.getElementById('importDocumentBtn')?.addEventListener('click', () => this.importDocuments());
        document.getElementById('addDocumentBtn')?.addEventListener('click', () => this.openDocumentEditor());
        container.querySelectorAll('[data-edit-document]').forEach((button) => button.addEventListener('click', () => this.openDocumentEditor(button.dataset.editDocument)));
        container.querySelectorAll('[data-delete-document]').forEach((button) => button.addEventListener('click', () => this.deleteDocument(button.dataset.deleteDocument)));
    }

    renderSettings(container) {
        const webhookUrl = window.localStorage.getItem('dutyWebhookUrl') || '';
        const patrolSocketUrl = window.localStorage.getItem('patrolSocketUrl') || '';
        const aiApiUrl = window.localStorage.getItem('adminAiApiUrl') || '';
        const aiModel = window.localStorage.getItem('adminAiModel') || '';
        const aiApiKey = this.escapeHtml(window.localStorage.getItem('adminAiApiKey') || '');
        const aiKeyMasked = window.localStorage.getItem('adminAiKeyMasked') || '未配置';
        const statusRefreshSettings = this.getStatusRefreshSettings();
        const scopeLabels = {
            rooms: '机房',
            devices: '硬件设备',
            managementPages: '管理页面'
        };
        const scopeText = statusRefreshSettings.scopes.map((item) => scopeLabels[item] || item).join('、');
        container.innerHTML = `
            <div class="table-card settings-page-card">
                <div class="table-header settings-page-header">
                    <div>
                        <h3>系统设置</h3>
                        <div class="table-note">配置消息推送、每日固定刷新时间和要重置的板块。</div>
                    </div>
                </div>
                <div class="settings-grid">
                    <section class="settings-panel">
                        <div class="settings-panel-title">
                            <i class="fas fa-link"></i>
                            <div>
                                <h4>连接配置</h4>
                                <p>用于值班通知和巡检实时推送。</p>
                            </div>
                        </div>
                        <div class="form-group"><label class="form-label" for="dutyWebhookUrl">值班提醒 Webhook</label><input class="form-control" id="dutyWebhookUrl" value="${webhookUrl}" placeholder="企业微信/钉钉 webhook"></div>
                        <div class="form-group"><label class="form-label" for="patrolSocketUrl">巡检 WebSocket 地址</label><input class="form-control" id="patrolSocketUrl" value="${patrolSocketUrl}" placeholder="如需实时推送再填写 ws://..."></div>
                    </section>
                    <section class="settings-panel">
                        <div class="settings-panel-title">
                            <i class="fas fa-rotate"></i>
                            <div>
                                <h4>状态刷新</h4>
                                <p>每日到点后把所选板块重置为未检查。</p>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ncicStatusRefreshTime">每日自动刷新时间</label>
                            <input class="form-control" id="ncicStatusRefreshTime" type="time" value="${statusRefreshSettings.time}">
                        </div>
                        <div class="settings-check-card">
                            <div>
                                <label class="form-label">自动刷新状态</label>
                                <p class="table-note">开启后会在每天固定时间，把选择的板块重置为未检查。</p>
                            </div>
                            <label class="settings-switch">
                                <input type="checkbox" id="ncicStatusRefreshEnabled" ${statusRefreshSettings.enabled ? 'checked' : ''}>
                                <span></span>
                                <strong id="ncicStatusRefreshEnabledText">${statusRefreshSettings.enabled ? '已开启' : '已关闭'}</strong>
                            </label>
                        </div>
                        <div class="settings-scope-card">
                            <label class="form-label">状态刷新范围</label>
                            <div class="settings-scope-row">
                                <span id="ncicStatusRefreshScopeText">${scopeText || '未选择'}</span>
                                <button class="btn btn-secondary-lite" id="openRefreshScopeDialog" type="button"><i class="fas fa-sliders"></i>选择范围</button>
                            </div>
                            <p class="table-note">未选择某个板块时，手动刷新和每日自动刷新都不会改变它的状态。</p>
                        </div>
                    </section>
                    <section class="settings-panel">
                        <div class="settings-panel-title">
                            <i class="fas fa-robot"></i>
                            <div>
                                <h4>AI 回答配置</h4>
                                <p>作为小巡默认 AI 配置，可填写任意 OpenAI 兼容接口。</p>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="adminAiApiKey">AI API Key</label>
                            <input class="form-control" id="adminAiApiKey" type="password" value="${aiApiKey}" placeholder="留空则保留当前 Key：${aiKeyMasked}">
                            <p class="table-note">保存后会保留在当前浏览器，便于继续修改；请勿在公共电脑保存。</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="adminAiModel">模型</label>
                            <input class="form-control" id="adminAiModel" value="${aiModel}" placeholder="例如 deepseek-chat / gpt-4o-mini / qwen-plus">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="adminAiApiUrl">接口地址</label>
                            <input class="form-control" id="adminAiApiUrl" value="${aiApiUrl}" placeholder="例如 https://api.deepseek.com/chat/completions">
                        </div>
                        <button class="btn btn-secondary-lite" id="validateAiSettingsBtn" type="button"><i class="fas fa-plug-circle-check"></i>校验 AI 配置</button>
                    </section>
                </div>
                <div class="settings-actions duty-action-row">
                    <button class="btn" id="saveSettingsBtn"><i class="fas fa-save"></i>保存设置</button>
                    <button class="btn btn-secondary-lite" id="runStatusRefreshNowBtn"><i class="fas fa-rotate"></i>立即刷新状态</button>
                </div>
            </div>
        `;
        this.loadAiSettingsIntoForm();
        document.getElementById('runStatusRefreshNowBtn')?.addEventListener('click', () => this.refreshSelectedStatuses(this.getStatusRefreshScopes()));
        document.getElementById('openRefreshScopeDialog')?.addEventListener('click', () => this.openRefreshScopeDialog(() => this.renderSettings(container)));
        document.getElementById('validateAiSettingsBtn')?.addEventListener('click', () => this.validateAiSettingsFromForm());
        const refreshSwitch = document.getElementById('ncicStatusRefreshEnabled');
        const syncRefreshSwitchLabel = () => {
            const label = document.getElementById('ncicStatusRefreshEnabledText');
            if (!refreshSwitch || !label) return;
            label.textContent = refreshSwitch.checked ? '已开启' : '已关闭';
            refreshSwitch.closest('.settings-switch')?.classList.toggle('is-on', refreshSwitch.checked);
        };
        refreshSwitch?.addEventListener('change', syncRefreshSwitchLabel);
        syncRefreshSwitchLabel();
        document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
            window.localStorage.setItem('dutyWebhookUrl', document.getElementById('dutyWebhookUrl').value.trim());
            const socketValue = document.getElementById('patrolSocketUrl').value.trim();
            if (socketValue) {
                window.localStorage.setItem('patrolSocketUrl', socketValue);
            } else {
                window.localStorage.removeItem('patrolSocketUrl');
            }
            const refreshTime = document.getElementById('ncicStatusRefreshTime').value || '08:00';
            const enabled = document.getElementById('ncicStatusRefreshEnabled').checked;
            window.localStorage.setItem('ncicStatusRefreshTime', refreshTime);
            window.localStorage.removeItem('ncicStatusRefreshMinutes');
            window.localStorage.setItem('ncicStatusRefreshEnabled', String(enabled));
            if (!window.localStorage.getItem('ncicStatusRefreshScopes')) {
                window.localStorage.setItem('ncicStatusRefreshScopes', JSON.stringify(['rooms']));
            }
            this.startAutoStatusRefresh();
            this.lastAiSettingsSuccessMessage = '';
            const aiSaved = await this.saveAiSettingsFromForm();
            if (!aiSaved) {
                this.showNotification('基础设置已保存，但 AI 配置保存失败', 'warning', {
                    persistent: true,
                    detail: this.lastAiSettingsError || '请检查 AI API Key、接口地址和模型是否正确。',
                    detailLabel: '查看原因'
                });
                return;
            }
            const aiSuccessMessage = this.lastAiSettingsSuccessMessage;
            this.addOperationLog('保存系统设置', {
                autoRefreshEnabled: enabled,
                autoRefreshTime: refreshTime,
                refreshScopes: this.getStatusRefreshScopes(),
                hasWebhook: Boolean(document.getElementById('dutyWebhookUrl').value.trim()),
                hasSocket: Boolean(socketValue)
            }, 'success');
            this.showNotification(aiSuccessMessage || '设置已保存', 'success');
            this.renderSettings(container);
        });
    }

    async loadAiSettingsIntoForm() {
        try {
            const response = await fetch('/api/ai/settings');
            if (!response.ok) return;
            const data = await response.json();
            if (data.apiUrl) {
                window.localStorage.setItem('adminAiApiUrl', data.apiUrl);
                const input = document.getElementById('adminAiApiUrl');
                if (input) input.value = data.apiUrl;
            } else {
                window.localStorage.removeItem('adminAiApiUrl');
                const input = document.getElementById('adminAiApiUrl');
                if (input) input.value = '';
            }
            if (data.model) {
                window.localStorage.setItem('adminAiModel', data.model);
                const input = document.getElementById('adminAiModel');
                if (input) input.value = data.model;
            } else {
                window.localStorage.removeItem('adminAiModel');
                const input = document.getElementById('adminAiModel');
                if (input) input.value = '';
            }
            if (data.apiKeyMasked) {
                window.localStorage.setItem('adminAiKeyMasked', data.apiKeyMasked);
                const input = document.getElementById('adminAiApiKey');
                if (input) input.placeholder = `留空则保留当前 Key：${data.apiKeyMasked || '未配置'}`;
            } else {
                window.localStorage.removeItem('adminAiKeyMasked');
                const input = document.getElementById('adminAiApiKey');
                if (input) input.placeholder = '留空则保留当前 Key：未配置';
            }
        } catch (error) {
            console.warn('读取 AI 设置失败', error);
        }
    }

    async saveAiSettingsFromForm() {
        const apiKey = document.getElementById('adminAiApiKey')?.value.trim() || '';
        const apiUrl = document.getElementById('adminAiApiUrl')?.value.trim() || '';
        const model = document.getElementById('adminAiModel')?.value.trim() || '';
        const hasExistingKey = Boolean(window.localStorage.getItem('adminAiKeyMasked'));
        if (!apiKey && !apiUrl && !model && !hasExistingKey) {
            return true;
        }
        window.localStorage.setItem('adminAiApiUrl', apiUrl);
        window.localStorage.setItem('adminAiModel', model);
        if (apiKey) {
            window.localStorage.setItem('adminAiApiKey', apiKey);
        }
        try {
            const response = await fetch('/api/ai/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, apiUrl, model })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.lastAiSettingsError = data.message || 'AI 配置校验失败，请检查 API Key、接口地址和模型';
                return false;
            }
            if (data.apiKeyMasked) {
                window.localStorage.setItem('adminAiKeyMasked', data.apiKeyMasked);
            } else {
                window.localStorage.removeItem('adminAiKeyMasked');
                window.localStorage.removeItem('adminAiApiKey');
            }
            this.lastAiSettingsSuccessMessage = 'AI 配置成功，系统设置已保存';
            return true;
        } catch (error) {
            console.warn('保存 AI 设置失败', error);
            this.lastAiSettingsError = '无法连接 AI 设置接口，请确认后端服务正在运行。';
            return false;
        }
    }

    async validateAiSettingsFromForm() {
        const apiKey = document.getElementById('adminAiApiKey')?.value.trim() || '';
        const apiUrl = document.getElementById('adminAiApiUrl')?.value.trim() || '';
        const model = document.getElementById('adminAiModel')?.value.trim() || '';
        try {
            const response = await fetch('/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, apiUrl, model })
            });
            const data = await response.json().catch(() => ({}));
            this.showNotification(data.message || (response.ok ? 'AI 配置校验通过' : 'AI 配置校验失败'), response.ok ? 'success' : 'warning');
        } catch (error) {
            this.showNotification('无法连接 AI 校验接口，请确认后端服务正在运行', 'error');
        }
    }

    openSwpuUserEditor(swpuUserId) {
        const swpuUsers = window.SWPUData.getSwpuUsers();
        const targetSwpuUser = swpuUsers.find((item) => item.id === swpuUserId);
        const isEditing = Boolean(targetSwpuUser);
        this.showFormModal({
            modalId: 'swpuUserModal',
            title: isEditing ? '编辑用户' : '新增用户',
            values: targetSwpuUser || {
                id: `swpuUser_${Date.now()}`,
                swpuUsername: '',
                password: 'password123',
                name: '',
                employeeId: '',
                department: '网络与信息化中心',
                phone: '',
                email: '',
                role: 'engineer',
                status: 'active'
            },
            fields: [
                { name: 'id', label: '用户 ID', readonly: true },
                { name: 'swpuUsername', label: '用户名', placeholder: '请输入登录用户名' },
                { name: 'password', label: '密码', placeholder: '请输入密码' },
                { name: 'name', label: '姓名', placeholder: '请输入姓名' },
                { name: 'employeeId', label: '工号', placeholder: '请输入工号' },
                { name: 'department', label: '部门', placeholder: '请输入部门名称' },
                { name: 'phone', label: '手机号', placeholder: '请输入手机号' },
                { name: 'email', label: '邮箱', type: 'email', placeholder: '请输入邮箱' },
                {
                    name: 'role',
                    label: '角色',
                    type: 'select',
                    options: [
                        { value: 'admin', label: '管理员' },
                        { value: 'engineer', label: '巡检工程师' },
                        { value: 'duty', label: '值班工程师' }
                    ]
                },
                {
                    name: 'status',
                    label: '状态',
                    type: 'select',
                    options: [
                        { value: 'active', label: '启用' },
                        { value: 'inactive', label: '停用' }
                    ]
                }
            ],
            onSubmit: (formData) => {
                if (!formData.swpuUsername || !formData.name || !formData.employeeId) {
                    this.showNotification('请完整填写用户名、姓名和工号', 'warning');
                    return false;
                }
                const duplicated = swpuUsers.some((item) => item.swpuUsername === formData.swpuUsername && item.id !== formData.id);
                if (duplicated) {
                    this.showNotification('用户名已存在，请更换后再保存', 'warning');
                    return false;
                }
                const nextSwpuUser = {
                    ...(targetSwpuUser || {}),
                    ...formData,
                    role: formData.role,
                    roles: formData.role === 'duty' ? ['engineer', 'duty'] : [formData.role]
                };
                const nextSwpuUsers = isEditing
                    ? swpuUsers.map((item) => (item.id === formData.id ? nextSwpuUser : item))
                    : [...swpuUsers, nextSwpuUser];
                window.SWPUData.saveSwpuUsers(nextSwpuUsers);
                this.renderSwpuUsers(document.getElementById('page-container'));
                this.showNotification(isEditing ? '用户信息已更新' : '用户已新增', 'success');
                return true;
            }
        });
    }

    deleteSwpuUser(swpuUserId) {
        const swpuUsers = window.SWPUData.getSwpuUsers();
        const targetSwpuUser = swpuUsers.find((item) => item.id === swpuUserId);
        if (!targetSwpuUser) {
            this.showNotification('未找到目标用户', 'warning');
            return;
        }
        if (this.currentUser && targetSwpuUser.id === this.currentUser.id) {
            this.showNotification('当前登录管理员不可删除', 'warning');
            return;
        }
        if (!window.confirm(`确认删除用户“${targetSwpuUser.name}”吗？`)) {
            return;
        }
        window.SWPUData.saveSwpuUsers(swpuUsers.filter((item) => item.id !== swpuUserId));
        this.renderSwpuUsers(document.getElementById('page-container'));
        this.showNotification('用户已删除', 'success');
    }

    openNcicRoomEditor(ncicRoomId) {
        const ncicRooms = window.SWPUData.getNcicRooms();
        const targetNcicRoom = ncicRooms.find((item) => item.id === ncicRoomId);
        const isEditing = Boolean(targetNcicRoom);
        this.showFormModal({
            modalId: 'ncicRoomModal',
            title: isEditing ? '编辑机房' : '新增机房',
            values: targetNcicRoom || {
                id: `ncicRoom-${Date.now()}`,
                name: '',
                type: '机房',
                location: '',
                status: 'unchecked',
                description: '',
                isCore: false
            },
            fields: [
                { name: 'id', label: '机房 ID', readonly: true },
                { name: 'name', label: '机房名称', placeholder: '例如 明理楼 8212' },
                { name: 'type', label: '机房类型', placeholder: '例如 UPS机房 / 机房' },
                { name: 'location', label: '位置', placeholder: '请输入位置' },
                {
                    name: 'status',
                    label: '当前状态',
                    type: 'select',
                    options: [
                        { value: 'unchecked', label: '未检查' },
                        { value: 'normal', label: '正常' },
                        { value: 'warning', label: '警告' },
                        { value: 'error', label: '异常' }
                    ]
                },
                {
                    name: 'isCore',
                    label: '首页核心机房',
                    type: 'select',
                    options: [
                        { value: 'false', label: '否' },
                        { value: 'true', label: '是（影响首页数量统计）' }
                    ]
                },
                { name: 'description', label: '机房说明', type: 'textarea', fullWidth: true, rows: 4, maxlength: 300 }
            ],
            onSubmit: (formData) => {
                if (!formData.name || !formData.location) {
                    this.showNotification('请填写机房名称和位置', 'warning');
                    return false;
                }
                const nextNcicRoom = {
                    ...(targetNcicRoom || {}),
                    ...formData,
                    isCore: formData.isCore === 'true'
                };
                const nextNcicRooms = isEditing
                    ? ncicRooms.map((item) => (item.id === formData.id ? nextNcicRoom : item))
                    : [...ncicRooms, nextNcicRoom];
                window.SWPUData.saveNcicRooms(nextNcicRooms);
                this.renderNcicRooms(document.getElementById('page-container'));
                this.showNotification(isEditing ? '机房信息已更新' : '机房已新增', 'success');
                return true;
            }
        });
    }

    deleteNcicRoom(ncicRoomId) {
        const ncicRooms = window.SWPUData.getNcicRooms();
        const targetNcicRoom = ncicRooms.find((item) => item.id === ncicRoomId);
        if (!targetNcicRoom) {
            this.showNotification('未找到目标机房', 'warning');
            return;
        }
        if (targetNcicRoom.isCore) {
            this.showNotification('首页核心机房不可删除', 'warning');
            return;
        }
        if (!window.confirm(`确认删除机房“${targetNcicRoom.name}”吗？`)) {
            return;
        }
        window.SWPUData.saveNcicRooms(ncicRooms.filter((item) => item.id !== ncicRoomId));
        this.renderNcicRooms(document.getElementById('page-container'));
        this.showNotification('机房已删除', 'success');
    }

    openDeviceEditor(deviceId) {
        const devices = window.SWPUData.getDevices();
        const ncicRooms = window.SWPUData.getNcicRooms();
        const targetDevice = devices.find((item) => item.id === deviceId);
        const isEditing = Boolean(targetDevice);
        this.showFormModal({
            modalId: 'taskModal',
            title: isEditing ? '编辑设备' : '新增设备',
            values: targetDevice || {
                id: `device_${Date.now()}`,
                name: '',
                model: '',
                type: '服务器',
                ncicRoomId: ncicRooms[0]?.id || '',
                owner: '网络与信息化中心',
                status: 'normal',
                inspectionCount: 12,
                faultCount: 0,
                updatedAt: window.SWPUData.getTodayDate()
            },
            fields: [
                { name: 'id', label: '设备 ID', readonly: true },
                { name: 'name', label: '设备名称', placeholder: '请输入设备名称' },
                { name: 'model', label: '设备型号', placeholder: '请输入设备型号' },
                { name: 'type', label: '设备类型', placeholder: '请输入设备类型' },
                {
                    name: 'ncicRoomId',
                    label: '所在机房',
                    type: 'select',
                    options: ncicRooms.map((item) => ({ value: item.id, label: item.name }))
                },
                { name: 'owner', label: '归属部门', placeholder: '请输入归属部门' },
                { name: 'inspectionCount', label: '巡检次数', type: 'number', placeholder: '请输入巡检次数' },
                { name: 'faultCount', label: '故障次数', type: 'number', placeholder: '请输入故障次数' },
                { name: 'updatedAt', label: '最近更新时间', type: 'date' },
                {
                    name: 'status',
                    label: '设备状态',
                    type: 'select',
                    options: [
                        { value: 'normal', label: '正常' },
                        { value: 'warning', label: '警告' },
                        { value: 'error', label: '异常' },
                        { value: 'inactive', label: '停用' }
                    ]
                }
            ],
            onSubmit: (formData) => {
                if (!formData.name || !formData.ncicRoomId) {
                    this.showNotification('请填写设备名称并选择机房', 'warning');
                    return false;
                }
                const linkedNcicRoom = ncicRooms.find((item) => item.id === formData.ncicRoomId);
                const nextDevice = {
                    ...(targetDevice || {}),
                    ...formData,
                    inspectionCount: Number(formData.inspectionCount) || 0,
                    faultCount: Number(formData.faultCount) || 0,
                    ncicRoomName: linkedNcicRoom ? linkedNcicRoom.name : '未知机房'
                };
                const nextDevices = isEditing
                    ? devices.map((item) => (item.id === formData.id ? nextDevice : item))
                    : [...devices, nextDevice];
                window.SWPUData.saveDevices(nextDevices);
                this.renderDevices(document.getElementById('page-container'));
                this.showNotification(isEditing ? '设备信息已更新' : '设备已新增', 'success');
                return true;
            }
        });
    }

    deleteDevice(deviceId) {
        const devices = window.SWPUData.getDevices();
        const targetDevice = devices.find((item) => item.id === deviceId);
        if (!targetDevice) {
            this.showNotification('未找到目标设备', 'warning');
            return;
        }
        if (!window.confirm(`确认删除设备“${targetDevice.name}”吗？`)) {
            return;
        }
        window.SWPUData.saveDevices(devices.filter((item) => item.id !== deviceId));
        this.renderDevices(document.getElementById('page-container'));
        this.showNotification('设备已删除', 'success');
    }

    openManagementPageEditor(managementPageId) {
        const managementPages = window.SWPUData.getManagementPages();
        const targetManagementPage = managementPages.find((item) => item.id === managementPageId);
        const isEditing = Boolean(targetManagementPage);
        this.showFormModal({
            modalId: 'taskModal',
            title: isEditing ? '编辑管理页面' : '新增管理页面',
            values: targetManagementPage || {
                id: `mgmt_${Date.now()}`,
                name: '',
                type: '业务系统',
                system: '',
                owner: '网络与信息化中心',
                url: '',
                status: 'unchecked',
                description: ''
            },
            fields: [
                { name: 'id', label: '页面 ID', readonly: true },
                { name: 'name', label: '页面名称', placeholder: '请输入管理页面名称' },
                { name: 'type', label: '分类', placeholder: '例如 数据库 / 存储管理 / 虚拟化' },
                { name: 'system', label: '系统归属', placeholder: '请输入系统归属' },
                { name: 'owner', label: '责任部门', placeholder: '请输入责任部门' },
                { name: 'url', label: '访问地址', placeholder: '请输入访问地址' },
                {
                    name: 'status',
                    label: '当前状态',
                    type: 'select',
                    options: [
                        { value: 'unchecked', label: '未检查' },
                        { value: 'normal', label: '正常' },
                        { value: 'warning', label: '警告' },
                        { value: 'error', label: '异常' }
                    ]
                },
                { name: 'description', label: '巡查说明', type: 'textarea', fullWidth: true, rows: 5, maxlength: 400 }
            ],
            onSubmit: (formData) => {
                if (!formData.name || !formData.system || !formData.owner) {
                    this.showNotification('请完整填写页面名称、系统归属和责任部门', 'warning');
                    return false;
                }
                const nextManagementPage = {
                    ...(targetManagementPage || {}),
                    ...formData
                };
                const nextManagementPages = isEditing
                    ? managementPages.map((item) => (item.id === formData.id ? nextManagementPage : item))
                    : [...managementPages, nextManagementPage];
                window.SWPUData.saveManagementPages(nextManagementPages);
                this.renderManagementPages(document.getElementById('page-container'));
                this.showNotification(isEditing ? '管理页面已更新' : '管理页面已新增', 'success');
                return true;
            }
        });
    }

    deleteManagementPage(managementPageId) {
        const managementPages = window.SWPUData.getManagementPages();
        const targetManagementPage = managementPages.find((item) => item.id === managementPageId);
        if (!targetManagementPage) {
            this.showNotification('未找到目标管理页面', 'warning');
            return;
        }
        if (!window.confirm(`确认删除管理页面“${targetManagementPage.name}”吗？`)) {
            return;
        }
        window.SWPUData.saveManagementPages(managementPages.filter((item) => item.id !== managementPageId));
        this.renderManagementPages(document.getElementById('page-container'));
        this.showNotification('管理页面已删除', 'success');
    }

    openDailyPatrolEditor(dailyPatrolId) {
        const records = window.SWPUData.getDailyPatrolList();
        const ncicRooms = window.SWPUData.getNcicRooms();
        const swpuUsers = window.SWPUData.getSwpuUsers().filter((item) => item.role === 'admin' || item.roles.includes('engineer') || item.roles.includes('duty'));
        const targetRecord = records.find((item) => item.id === dailyPatrolId);
        const isEditing = Boolean(targetRecord);
        const defaultTimestamp = targetRecord?.timestamp || new Date().toISOString();
        this.showFormModal({
            modalId: 'taskModal',
            title: isEditing ? '编辑巡检记录' : '新增巡检记录',
            values: targetRecord || {
                id: `patrol_${Date.now()}`,
                ncicRoomId: ncicRooms[0]?.id || '',
                inspector: this.currentUser?.name || swpuUsers[0]?.name || '',
                status: 'normal',
                date: defaultTimestamp.slice(0, 10),
                time: defaultTimestamp.slice(11, 16),
                notes: ''
            },
            fields: [
                { name: 'id', label: '记录 ID', readonly: true },
                {
                    name: 'ncicRoomId',
                    label: '巡检机房',
                    type: 'select',
                    options: ncicRooms.map((item) => ({ value: item.id, label: item.name }))
                },
                {
                    name: 'inspector',
                    label: '巡检人',
                    type: 'select',
                    options: swpuUsers.map((item) => ({ value: item.name, label: `${item.name} / ${item.department}` }))
                },
                {
                    name: 'status',
                    label: '巡检结果',
                    type: 'select',
                    options: [
                        { value: 'normal', label: '正常' },
                        { value: 'warning', label: '警告' },
                        { value: 'error', label: '异常' },
                        { value: 'unchecked', label: '待巡检' }
                    ]
                },
                { name: 'date', label: '日期', type: 'date' },
                { name: 'time', label: '时间', type: 'time' },
                { name: 'notes', label: '备注', type: 'textarea', fullWidth: true, rows: 4, maxlength: 300 }
            ],
            onSubmit: (formData) => {
                if (!formData.ncicRoomId || !formData.inspector || !formData.date) {
                    this.showNotification('请完整填写巡检机房、巡检人和日期', 'warning');
                    return false;
                }
                const timestamp = `${formData.date}T${formData.time || '08:00'}:00`;
                window.SWPUData.upsertDailyPatrolRecord(formData.ncicRoomId, {
                    id: formData.id,
                    inspector: formData.inspector,
                    status: formData.status,
                    date: formData.date,
                    timestamp,
                    notes: formData.notes
                });
                this.renderDailyPatrols(document.getElementById('page-container'));
                this.showNotification(isEditing ? '巡检记录已更新' : '巡检记录已新增', 'success');
                return true;
            }
        });
    }

    deleteDailyPatrol(ncicRoomId, dailyPatrolId) {
        const record = window.SWPUData.getDailyPatrolList().find((item) => item.id === dailyPatrolId);
        if (!record) {
            this.showNotification('未找到目标巡检记录', 'warning');
            return;
        }
        if (!window.confirm(`确认删除 ${record.ncicRoomName} 的巡检记录吗？`)) {
            return;
        }
        window.SWPUData.deleteDailyPatrolRecord(ncicRoomId, dailyPatrolId);
        this.renderDailyPatrols(document.getElementById('page-container'));
        this.showNotification('巡检记录已删除', 'success');
    }

    openKnowledgeEditor(knowledgeId) {
        const entries = window.SWPUData.getKnowledgeBase();
        const targetEntry = entries.find((item) => item.id === knowledgeId);
        const isEditing = Boolean(targetEntry);
        this.showFormModal({
            modalId: 'taskModal',
            title: isEditing ? '编辑知识条目' : '新增知识条目',
            values: targetEntry || {
                id: `kb_${Date.now()}`,
                title: '',
                category: '巡检指引',
                tags: '',
                solution: ''
            },
            fields: [
                { name: 'id', label: '条目 ID', readonly: true },
                { name: 'title', label: '标题', placeholder: '请输入标题' },
                { name: 'category', label: '分类', placeholder: '例如 巡检指引 / 故障处理' },
                { name: 'tags', label: '标签', placeholder: '多个标签请用逗号分隔' },
                { name: 'solution', label: '内容', type: 'textarea', fullWidth: true, rows: 6, maxlength: 500 }
            ],
            onSubmit: (formData) => {
                if (!formData.title || !formData.solution) {
                    this.showNotification('请填写标题和内容', 'warning');
                    return false;
                }
                const nextEntry = {
                    ...(targetEntry || {}),
                    ...formData,
                    tags: formData.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
                };
                const nextEntries = isEditing
                    ? entries.map((item) => (item.id === formData.id ? nextEntry : item))
                    : [...entries, nextEntry];
                window.SWPUData.saveKnowledgeBase(nextEntries);
                this.renderKnowledgeBase(document.getElementById('page-container'));
                this.showNotification(isEditing ? '知识条目已更新' : '知识条目已新增', 'success');
                return true;
            }
        });
    }

    exportKnowledgeBase() {
        const entries = window.SWPUData.getKnowledgeBase().map((item) => ({
            标题: item.title,
            分类: item.category,
            标签: (item.tags || []).join(', '),
            内容: item.solution
        }));
        this.downloadWorkbook(`swpu-knowledge-base-${window.SWPUData.getTodayDate()}.xlsx`, '知识库', entries);
        this.showNotification('知识库已导出', 'success');
    }

    async importKnowledgeBase() {
        this.triggerImport('.xlsx,.xls,.json', async (file) => {
            const rows = await this.readImportRows(file);
            const nextEntries = rows
                .map((row, index) => ({
                    id: row.id || row.ID || row.Id || `kb_import_${Date.now()}_${index}`,
                    title: String(row.标题 || row.title || row.Title || '').trim(),
                    category: String(row.分类 || row.category || row.Category || '巡检指引').trim(),
                    tags: String(row.标签 || row.tags || row.Tags || '')
                        .split(/[,，]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    solution: String(row.内容 || row.solution || row.Solution || '').trim()
                }))
                .filter((item) => item.title && item.solution);
            if (!nextEntries.length) {
                throw new Error('未读取到有效知识库内容，请检查表头是否为 标题/分类/标签/内容');
            }
            window.SWPUData.saveKnowledgeBase(nextEntries);
            this.renderKnowledgeBase(document.getElementById('page-container'));
            this.showNotification(`知识库已导入 ${nextEntries.length} 条`, 'success');
        });
    }

    deleteKnowledge(knowledgeId) {
        const entries = window.SWPUData.getKnowledgeBase();
        const targetEntry = entries.find((item) => item.id === knowledgeId);
        if (!targetEntry) {
            this.showNotification('未找到目标知识条目', 'warning');
            return;
        }
        if (!window.confirm(`确认删除知识条目“${targetEntry.title}”吗？`)) {
            return;
        }
        window.SWPUData.saveKnowledgeBase(entries.filter((item) => item.id !== knowledgeId));
        this.renderKnowledgeBase(document.getElementById('page-container'));
        this.showNotification('知识条目已删除', 'success');
    }

    openDocumentEditor(documentId) {
        const documents = window.SWPUData.getDocuments();
        const targetDocument = documents.find((item) => item.id === documentId);
        const isEditing = Boolean(targetDocument);
        this.showFormModal({
            modalId: 'taskModal',
            title: isEditing ? '编辑文档' : '新增文档',
            values: targetDocument || {
                id: `doc_${Date.now()}`,
                title: '',
                url: '',
                category: '设备资料',
                size: '1.0 MB',
                updatedAt: window.SWPUData.getTodayDate(),
                description: ''
            },
            fields: [
                { name: 'id', label: '文档 ID', readonly: true },
                { name: 'title', label: '显示名称', placeholder: '例如 IBM 刀片服务器维护手册' },
                { name: 'documentFile', label: isEditing ? '重新上传文档' : '上传文档', type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html,.htm,.zip,.rar', fullWidth: true, help: isEditing ? '不选择文件时保留当前文档；重新上传后会替换为新的查看地址。' : '请选择要上传的文档，系统会自动生成查看地址。' },
                { name: 'category', label: '分类', placeholder: '例如 UPS / 服务器 / 巡检表' },
                { name: 'size', label: '大小', placeholder: '例如 2.4 MB' },
                { name: 'updatedAt', label: '更新时间', type: 'date' },
                { name: 'description', label: '内容摘要', type: 'textarea', fullWidth: true, rows: 4, maxlength: 300 }
            ],
            onSubmit: async (formData) => {
                let uploadedDocument = {};
                if (formData.documentFile) {
                    try {
                        uploadedDocument = await this.uploadDocumentFile(formData.documentFile);
                    } catch (error) {
                        this.showNotification(error.message || '文档上传失败', 'error');
                        return false;
                    }
                }
                const url = uploadedDocument.url || targetDocument?.url || '';
                if (!url || !formData.category) {
                    this.showNotification('请上传文档并补充分类', 'warning');
                    return false;
                }
                const nextDocument = {
                    ...(targetDocument || {}),
                    ...formData,
                    documentFile: undefined,
                    title: formData.title || uploadedDocument.title || this.getDocumentName({ ...formData, url }),
                    url,
                    size: formData.size || uploadedDocument.size || '1.0 MB'
                };
                const nextDocuments = isEditing
                    ? documents.map((item) => (item.id === formData.id ? nextDocument : item))
                    : [...documents, nextDocument];
                window.SWPUData.saveDocuments(nextDocuments);
                this.renderDocuments(document.getElementById('page-container'));
                this.showNotification(isEditing ? '文档信息已更新' : '文档已新增', 'success');
                return true;
            }
        });
    }

    exportDocuments() {
        const documents = window.SWPUData.getDocuments().map((item) => ({
            显示名称: this.getDocumentName(item),
            文档链接: this.getDocumentUrl(item),
            分类: item.category,
            大小: item.size,
            更新时间: item.updatedAt,
            内容摘要: item.description || ''
        }));
        this.downloadWorkbook(`swpu-device-documents-${window.SWPUData.getTodayDate()}.xlsx`, '设备文档', documents);
        this.showNotification('设备文档已导出', 'success');
    }

    async importDocuments() {
        this.triggerImport('.xlsx,.xls,.json', async (file) => {
            const rows = await this.readImportRows(file);
            const nextDocuments = rows
                .map((row, index) => ({
                    id: row.id || row.ID || row.Id || `doc_import_${Date.now()}_${index}`,
                    title: String(row.显示名称 || row.文档名称 || row.title || row.Title || '').trim(),
                    url: String(row.文档链接 || row.url || row.URL || row.link || row.Link || '').trim(),
                    category: String(row.分类 || row.category || row.Category || '设备资料').trim(),
                    size: String(row.大小 || row.size || row.Size || '1.0 MB').trim(),
                    updatedAt: String(row.更新时间 || row.updatedAt || row.UpdatedAt || window.SWPUData.getTodayDate()).trim(),
                    description: String(row.内容摘要 || row.description || row.Description || '').trim()
                }))
                .map((item) => ({ ...item, url: item.url || (/^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/)/i.test(item.title) ? item.title : '') }))
                .filter((item) => item.url);
            if (!nextDocuments.length) {
                throw new Error('未读取到有效设备文档内容，请检查表头是否包含 文档链接/分类/大小/更新时间/内容摘要');
            }
            window.SWPUData.saveDocuments(nextDocuments);
            this.renderDocuments(document.getElementById('page-container'));
            this.showNotification(`设备文档已导入 ${nextDocuments.length} 条`, 'success');
        });
    }

    deleteDocument(documentId) {
        const documents = window.SWPUData.getDocuments();
        const targetDocument = documents.find((item) => item.id === documentId);
        if (!targetDocument) {
            this.showNotification('未找到目标文档', 'warning');
            return;
        }
        if (!window.confirm(`确认删除文档“${targetDocument.title}”吗？`)) {
            return;
        }
        window.SWPUData.saveDocuments(documents.filter((item) => item.id !== documentId));
        this.renderDocuments(document.getElementById('page-container'));
        this.showNotification('文档已删除', 'success');
    }

    renderLogs(container, keyword = '', dateFilter = this.recordDates.logs) {
        const activeDate = this.normalizeDateFilter(dateFilter);
        this.recordDates.logs = activeDate;
        const logs = window.SWPUData.fetchSwpuData('dutyLog', () => []);
        const filteredLogs = logs
            .filter((item) => !activeDate || this.getRecordDateString(item.timestamp || item.date) === activeDate)
            .filter((item) => {
                const haystack = `${item.timestamp || ''}${item.operator || ''}${item.action || ''}${item.level || ''}${JSON.stringify(item.payload || {})}`;
                return !keyword || haystack.includes(keyword);
            })
            .sort((a, b) => this.getRecordTimeValue(b.timestamp) - this.getRecordTimeValue(a.timestamp));
        const pageData = this.getPagedRecords(filteredLogs, 'logs');
        container.innerHTML = `
            <div class="table-card">
                ${this.renderToolbar('操作日志', {
                    searchId: 'operationLogSearch',
                    searchPlaceholder: '搜索时间/操作人/动作/内容',
                    actionButtons: [
                        { id: 'exportOperationLogsBtn', icon: 'fa-file-export', label: '导出日志', className: 'btn-secondary-lite' },
                        { id: 'clearOperationLogsBtn', icon: 'fa-trash', label: '清空日志', className: 'btn-secondary' }
                    ],
                    note: `共 ${logs.length} 条，当前日期显示 ${filteredLogs.length} 条`
                })}
                <div class="admin-record-filter">
                    <label><i class="fas fa-calendar-days"></i><span>日志日期</span><input id="operationLogDateFilter" type="date" value="${activeDate}"></label>
                    <button type="button" id="operationLogTodayBtn">今天</button>
                    <button type="button" id="operationLogClearDateBtn">清空日期</button>
                </div>
                <table>
                    <thead><tr><th>时间</th><th>级别</th><th>操作人</th><th>动作</th><th>内容</th></tr></thead>
                    <tbody>${pageData.items.length ? pageData.items.map((item) => `
                        <tr>
                            <td>${this.formatRecordTime(item.timestamp)}</td>
                            <td><span class="log-level log-${item.level || 'info'}">${this.getLogLevelText(item.level)}</span></td>
                            <td>${item.operator || '系统'}</td>
                            <td>${item.action || '-'}</td>
                            <td><code class="log-payload">${this.escapeHtml(JSON.stringify(item.payload || {}))}</code></td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" class="empty-state">暂无操作日志</td></tr>'}</tbody>
                </table>
                ${this.renderAdminPagination('logs', pageData)}
            </div>
        `;
        this.bindSearch('operationLogSearch', (value) => {
            this.recordPages.logs = 1;
            this.renderLogs(container, value, this.recordDates.logs);
        });
        document.getElementById('operationLogDateFilter')?.addEventListener('change', (event) => {
            this.recordPages.logs = 1;
            this.renderLogs(container, document.getElementById('operationLogSearch')?.value.trim() || '', event.target.value);
        });
        document.getElementById('operationLogTodayBtn')?.addEventListener('click', () => {
            this.recordPages.logs = 1;
            this.renderLogs(container, document.getElementById('operationLogSearch')?.value.trim() || '', window.SWPUData.getTodayDate());
        });
        document.getElementById('operationLogClearDateBtn')?.addEventListener('click', () => {
            this.recordPages.logs = 1;
            this.renderLogs(container, document.getElementById('operationLogSearch')?.value.trim() || '', '');
        });
        this.bindAdminPagination(container, 'logs', () => this.renderLogs(container, document.getElementById('operationLogSearch')?.value.trim() || '', this.recordDates.logs));
        document.getElementById('exportOperationLogsBtn')?.addEventListener('click', () => {
            this.downloadWorkbook(`swpu-operation-logs-${window.SWPUData.getTodayDate()}.xlsx`, '操作日志', filteredLogs.map((item) => ({
                时间: item.timestamp,
                级别: this.getLogLevelText(item.level),
                操作人: item.operator || '系统',
                动作: item.action || '',
                内容: JSON.stringify(item.payload || {})
            })));
            this.addOperationLog('导出操作日志', { count: filteredLogs.length, date: activeDate || 'all' }, 'info');
        });
        document.getElementById('clearOperationLogsBtn')?.addEventListener('click', () => {
            if (!window.confirm('确认清空全部操作日志吗？')) {
                return;
            }
            window.SWPUData.persistNcicRecord('dutyLog', []);
            this.showNotification('操作日志已清空', 'success');
            this.renderLogs(container);
        });
    }
    openRefreshScopeDialog(onSaved) {
        const modal = document.getElementById('taskModal');
        if (!modal) return;
        const body = modal.querySelector('.modal-body');
        const title = modal.querySelector('.modal-header h2');
        const selectedScopes = new Set(this.getStatusRefreshScopes());
        title.textContent = '选择状态刷新范围';
        body.innerHTML = `
            <div class="refresh-scope-dialog">
                <p class="table-note">选择每日固定刷新和立即刷新要处理的板块。</p>
                <label class="refresh-scope-option">
                    <input type="checkbox" value="rooms" ${selectedScopes.has('rooms') ? 'checked' : ''}>
                    <span><i class="fas fa-building"></i></span>
                    <strong>机房</strong>
                    <small>按今日机房巡检记录刷新状态</small>
                </label>
                <label class="refresh-scope-option">
                    <input type="checkbox" value="devices" ${selectedScopes.has('devices') ? 'checked' : ''}>
                    <span><i class="fas fa-microchip"></i></span>
                    <strong>硬件设备</strong>
                    <small>按今日设备巡检记录刷新状态</small>
                </label>
                <label class="refresh-scope-option">
                    <input type="checkbox" value="managementPages" ${selectedScopes.has('managementPages') ? 'checked' : ''}>
                    <span><i class="fas fa-desktop"></i></span>
                    <strong>管理页面</strong>
                    <small>按今日管理页面巡检记录刷新状态</small>
                </label>
                <div class="form-row">
                    <button class="btn btn-primary" id="saveRefreshScopeBtn" type="button">保存范围</button>
                    <button class="btn btn-secondary" type="button" data-close-modal="taskModal">取消</button>
                </div>
            </div>
        `;
        modal.classList.add('active');
        body.querySelector('[data-close-modal="taskModal"]')?.addEventListener('click', () => closeModal('taskModal'));
        body.querySelector('#saveRefreshScopeBtn')?.addEventListener('click', () => {
            const scopes = Array.from(body.querySelectorAll('.refresh-scope-option input:checked')).map((item) => item.value);
            if (!scopes.length) {
                this.showNotification('请至少选择一个刷新范围', 'warning');
                return;
            }
            window.localStorage.setItem('ncicStatusRefreshScopes', JSON.stringify(scopes));
            this.addOperationLog('设置状态刷新范围', { scopes }, 'success');
            closeModal('taskModal');
            this.startAutoStatusRefresh();
            this.showNotification('刷新范围已保存', 'success');
            if (onSaved) onSaved();
        });
    }

    getLogLevelText(level) {
        return ({ success: '成功', warning: '提醒', error: '错误', info: '信息' })[level || 'info'] || level;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    destroyCharts() {
        [this.dashboardTrendChart, this.dashboardStatusChart, this.reportTrendChart, this.reportDeviceChart].forEach((chart) => {
            if (chart) {
                chart.destroy();
            }
        });
        this.dashboardTrendChart = null;
        this.dashboardStatusChart = null;
        this.reportTrendChart = null;
        this.reportDeviceChart = null;
    }

    showNotification(message, type = 'info', options = {}) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }
        const detail = options.detail || '';
        const safeMessage = this.escapeHtml(message);
        const safeDetail = this.escapeHtml(detail);
        notification.className = `notification ${type} show${detail ? ' interactive' : ''}`;
        notification.innerHTML = `
            <button class="notification-main" type="button" aria-expanded="false">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${safeMessage}</span>
            </button>
            ${detail ? `
                <div class="notification-actions" hidden>
                    <button type="button" data-notification-action="detail"><i class="fas fa-circle-question"></i>${options.detailLabel || '查看原因'}</button>
                    <button type="button" data-notification-action="close"><i class="fas fa-xmark"></i>关闭</button>
                </div>
                <div class="notification-detail" hidden>${safeDetail}</div>
            ` : ''}
        `;
        if (detail) {
            const main = notification.querySelector('.notification-main');
            const actions = notification.querySelector('.notification-actions');
            const detailBox = notification.querySelector('.notification-detail');
            main?.addEventListener('click', () => {
                const willOpen = actions.hasAttribute('hidden');
                actions.toggleAttribute('hidden', !willOpen);
                main.setAttribute('aria-expanded', String(willOpen));
            });
            notification.querySelector('[data-notification-action="detail"]')?.addEventListener('click', (event) => {
                event.stopPropagation();
                detailBox.toggleAttribute('hidden', !detailBox.hasAttribute('hidden'));
            });
            notification.querySelector('[data-notification-action="close"]')?.addEventListener('click', (event) => {
                event.stopPropagation();
                notification.classList.remove('show');
            });
        }
        if (!options.persistent) {
            this.notificationTimer = setTimeout(() => notification.classList.remove('show'), options.duration || 3000);
        }
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'error': return 'fa-circle-xmark';
            default: return 'fa-circle-info';
        }
    }

    logout() {
        window.SWPUData.clearCurrentSwpuUser();
        window.location.href = 'login.html';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminSystem = new AdminSystem();
});

window.closeModal = closeModal;
window.toggleFullscreen = toggleFullscreen;
