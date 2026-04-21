class SwpuDashboardApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        window.SWPUData.seedData();
        this.currentUser = window.SWPUData.getCurrentSwpuUser();
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        window.SWPUData.updateNcicRoomStatusFromRecords();
        window.SWPUData.updateDeviceStatusFromRecords();
        window.SWPUData.updateManagementStatusFromRecords();
        this.renderUserInfo();
        this.updateAdminEntryVisibility();
        this.renderInspectionBoards();
        this.renderStats();
        this.renderRecentActivities();
        this.setupEventListeners();
        this.showSubmitSuccessFromSession();
        this.remindPendingPatrols();
    }

    renderUserInfo() {
        const swpuUserAvatar = document.querySelector('.swpuUser-avatar');
        const swpuUserName = document.querySelector('.swpuUser-name');
        const swpuUserRole = document.querySelector('.swpuUser-role');
        if (swpuUserAvatar) swpuUserAvatar.textContent = (this.currentUser.name || '巡').charAt(0);
        if (swpuUserName) swpuUserName.textContent = `${this.currentUser.name} (${this.currentUser.department})`;
        if (swpuUserRole) swpuUserRole.textContent = this.currentUser.role === 'admin' ? '系统管理员' : this.currentUser.role === 'duty' ? '值班工程师' : '巡检工程师';
    }

    updateAdminEntryVisibility() {
        const adminEntry = document.querySelector('.admin-entry');
        if (!adminEntry) return;
        adminEntry.style.display = this.currentUser.role === 'admin' ? 'block' : 'none';
    }

    renderInspectionBoards() {
        const ncicRooms = window.SWPUData.getNcicRooms();
        const devices = window.SWPUData.getDevices();
        const managementPages = window.SWPUData.getManagementPages();
        const machineList = document.getElementById('ncicRoom-list');
        const upsList = document.getElementById('ups-ncicRoom-list');
        const deviceList = document.getElementById('device-list');
        const managementList = document.getElementById('management-page-list');
        if (!machineList || !upsList || !deviceList || !managementList) return;

        machineList.innerHTML = '';
        upsList.innerHTML = '';
        deviceList.innerHTML = '';
        managementList.innerHTML = '';

        ncicRooms.forEach((ncicRoom) => {
            const item = document.createElement('a');
            item.className = 'location-item';
            item.href = `detail.html?ncicRoomId=${ncicRoom.id}`;
            item.innerHTML = `
                <div class="location-header">
                    <i class="fas ${ncicRoom.type === 'UPS机房' ? 'fa-bolt' : 'fa-server'}"></i>
                    <div class="location-name">${ncicRoom.name}</div>
                </div>
                <div class="location-details">
                    <div class="status-badge status-${ncicRoom.status}">${this.getStatusText(ncicRoom.status)}</div>
                    <div class="location-meta">
                        <span class="meta-item"><i class="fas fa-map-marker-alt"></i>${ncicRoom.location}</span>
                        <span class="meta-item"><i class="far fa-clock"></i>${ncicRoom.lastInspection ? new Date(ncicRoom.lastInspection).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '今日未巡检'}</span>
                    </div>
                </div>
            `;
            if (ncicRoom.type === 'UPS机房') {
                upsList.appendChild(item);
            } else {
                machineList.appendChild(item);
            }
        });

        devices.forEach((device) => {
            const item = document.createElement('a');
            item.className = 'device-item';
            item.href = `detail.html?deviceId=${device.id}`;
            item.innerHTML = `
                <div class="location-header">
                    <i class="fas fa-microchip"></i>
                    <div class="location-name">${device.name}</div>
                </div>
                <div class="location-details">
                    <div class="status-badge status-${device.status}">${this.getStatusText(device.status)}</div>
                    <div class="location-meta">
                        <span class="meta-item"><i class="fas fa-layer-group"></i>${device.type}</span>
                        <span class="meta-item"><i class="fas fa-location-dot"></i>${device.ncicRoomName}</span>
                    </div>
                </div>
            `;
            deviceList.appendChild(item);
        });

        managementPages.forEach((page) => {
            const item = document.createElement('a');
            item.className = 'management-item';
            item.href = `detail.html?managementId=${page.id}`;
            item.innerHTML = `
                <div class="location-header">
                    <i class="fas fa-desktop"></i>
                    <div class="location-name">${page.name}</div>
                </div>
                <div class="location-details">
                    <div class="status-badge status-${page.status}">${this.getStatusText(page.status)}</div>
                    <div class="location-meta">
                        <span class="meta-item"><i class="fas fa-sitemap"></i>${page.system}</span>
                        <span class="meta-item"><i class="fas fa-user-shield"></i>${page.owner}</span>
                    </div>
                </div>
            `;
            managementList.appendChild(item);
        });
    }

    renderStats() {
        const ncicRooms = window.SWPUData.getNcicRooms();
        const devices = window.SWPUData.getDevices();
        const managementPages = window.SWPUData.getManagementPages();
        const total = ncicRooms.length;
        const unchecked = ncicRooms.filter((item) => item.status === 'unchecked').length;
        const normal = ncicRooms.filter((item) => item.status === 'normal').length;
        const problem = ncicRooms.filter((item) => item.status === 'warning' || item.status === 'error').length;
        document.getElementById('total-ncicRooms').textContent = total;
        document.getElementById('unchecked-ncicRooms').textContent = unchecked;
        document.getElementById('normal-ncicRooms').textContent = normal;
        document.getElementById('problem-ncicRooms').textContent = problem;
        document.getElementById('total-devices').textContent = devices.length;
        document.getElementById('total-management-pages').textContent = managementPages.length;
    }

    renderRecentActivities() {
        const container = document.getElementById('recent-activities');
        if (!container) return;
        const todayAlertRecords = this.getTodayAlertRecords();
        const activeAlerts = this.getActiveTodayAlerts(todayAlertRecords);
        const activeHtml = activeAlerts.length
            ? activeAlerts.map((item) => this.renderAlertActivityItem(item)).join('')
            : this.renderEmptyAlertItem('今日暂无未处理告警', '已处理或非今日告警不会在这里显示');

        container.innerHTML = `
            <li class="activity-section-label">当前告警</li>
            ${activeHtml}
        `;
        container.querySelectorAll('[data-alert-url]').forEach((item) => {
            const openAlert = () => {
                window.location.href = item.dataset.alertUrl;
            };
            item.addEventListener('click', openAlert);
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAlert();
                }
            });
        });
        container.querySelectorAll('[data-alert-fix]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.toggleAlertFixMenu(button);
            });
        });
    }

    getTodayAlertRecords() {
        const today = window.SWPUData.getTodayDate();
        const isTodayAlert = (item) => item.date === today && this.isAlertStatus(item.status);
        const roomAlerts = window.SWPUData.getDailyPatrolList()
            .filter(isTodayAlert)
            .map((item) => ({
                ...item,
                title: item.ncicRoomName,
                subtitle: '机房巡查',
                targetType: 'room'
            }));
        const deviceAlerts = window.SWPUData.getDevicePatrolList()
            .filter(isTodayAlert)
            .map((item) => ({
                ...item,
                title: item.deviceName,
                subtitle: `硬件设备 · ${item.ncicRoomName}`,
                targetType: 'device'
            }));
        const managementAlerts = window.SWPUData.getManagementPatrolList()
            .filter(isTodayAlert)
            .map((item) => ({
                ...item,
                title: item.managementName,
                subtitle: `管理页面 · ${item.system}`,
                targetType: 'management'
            }));
        return [...roomAlerts, ...deviceAlerts, ...managementAlerts]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    getActiveTodayAlerts(todayAlertRecords) {
        const latestAlertByTarget = new Map();
        todayAlertRecords.forEach((item) => {
            const key = this.getAlertTargetKey(item);
            const existing = latestAlertByTarget.get(key);
            if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
                latestAlertByTarget.set(key, item);
            }
        });
        return Array.from(latestAlertByTarget.values())
            .filter((item) => this.isAlertStatus(this.getCurrentTargetStatus(item)))
            .filter((item) => !this.isAlertResolved(item))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    getCurrentTargetStatus(item) {
        if (item.targetType === 'device') {
            return window.SWPUData.getDevices().find((device) => device.id === item.deviceId)?.status;
        }
        if (item.targetType === 'management') {
            return window.SWPUData.getManagementPages().find((page) => page.id === item.managementId)?.status;
        }
        return window.SWPUData.getNcicRooms().find((ncicRoom) => ncicRoom.id === item.ncicRoomId)?.status;
    }

    getAlertTargetKey(item) {
        return `${item.targetType}:${item.ncicRoomId || item.deviceId || item.managementId || item.id}`;
    }

    getAlertInstanceKey(item) {
        return `${this.getAlertTargetKey(item)}:${item.id || item.timestamp || ''}`;
    }

    getResolvedAlertKeys() {
        try {
            return JSON.parse(localStorage.getItem('swpuResolvedAlertKeys') || '[]');
        } catch (error) {
            return [];
        }
    }

    isAlertResolved(item) {
        return this.getResolvedAlertKeys().includes(this.getAlertInstanceKey(item));
    }

    markAlertResolved(item) {
        const key = this.getAlertInstanceKey(item);
        const keys = new Set(this.getResolvedAlertKeys());
        keys.add(key);
        localStorage.setItem('swpuResolvedAlertKeys', JSON.stringify(Array.from(keys)));
        this.showNotification(`${item.title} 已标记为已修复`, 'success');
        const alertItem = document.querySelector(`[data-alert-key="${key}"]`);
        if (alertItem) {
            alertItem.classList.add('is-resolved');
            setTimeout(() => {
                alertItem.remove();
                if (!document.querySelector('#recent-activities [data-alert-key]')) {
                    this.renderRecentActivities();
                }
            }, 160);
            return;
        }
        this.renderRecentActivities();
    }

    getAlertTargetUrl(item) {
        if (item.targetType === 'device') {
            return `detail.html?deviceId=${encodeURIComponent(item.deviceId)}`;
        }
        if (item.targetType === 'management') {
            return `detail.html?managementId=${encodeURIComponent(item.managementId)}`;
        }
        return `detail.html?ncicRoomId=${encodeURIComponent(item.ncicRoomId)}`;
    }

    isAlertStatus(status) {
        return status === 'warning' || status === 'error';
    }

    renderAlertActivityItem(item, isRecord) {
        const iconClass = item.status === 'error' ? 'alert' : 'inspection';
        const iconName = item.status === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
        const inspector = item.inspector || '巡检人员';
        const timeText = item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : '今日';
        const alertKey = this.getAlertInstanceKey(item);
        return `
            <li class="activity-item alert-link ${isRecord ? 'alert-record-item' : ''}" data-alert-url="${this.getAlertTargetUrl(item)}" data-alert-key="${alertKey}" role="button" tabindex="0">
                <div class="activity-icon ${iconClass}"><i class="fas ${iconName}"></i></div>
                <div class="activity-details">
                    <div class="activity-title">${item.title} · ${this.getStatusText(item.status)}</div>
                    <div class="activity-time">${item.subtitle}</div>
                    <div class="activity-time">${inspector} · ${timeText}</div>
                </div>
                <button class="alert-fix-trigger" type="button" data-alert-fix="${alertKey}" aria-label="处理告警"><i class="fas fa-chevron-right"></i></button>
                <div class="alert-fix-menu" data-alert-menu="${alertKey}" hidden>
                    <button type="button" data-alert-resolved="${alertKey}"><i class="fas fa-check"></i> 已修复</button>
                </div>
            </li>
        `;
    }

    toggleAlertFixMenu(button) {
        const item = button.closest('[data-alert-key]');
        if (!item) return;
        const key = button.dataset.alertFix;
        const menu = item.querySelector(`[data-alert-menu="${key}"]`);
        document.querySelectorAll('.alert-fix-menu').forEach((target) => {
            if (target !== menu) target.hidden = true;
        });
        if (!menu) return;
        menu.hidden = !menu.hidden;
        const alertRecord = this.getActiveTodayAlerts(this.getTodayAlertRecords()).find((record) => this.getAlertInstanceKey(record) === key);
        menu.querySelector('[data-alert-resolved]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (alertRecord) this.markAlertResolved(alertRecord);
        }, { once: true });
    }

    renderEmptyAlertItem(title, subtitle) {
        return `
            <li class="activity-item activity-empty">
                <div class="activity-icon maintenance"><i class="fas fa-check"></i></div>
                <div class="activity-details">
                    <div class="activity-title">${title}</div>
                    <div class="activity-time">${subtitle}</div>
                </div>
            </li>
        `;
    }

    setupEventListeners() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        document.getElementById('btn-knowledge-base')?.addEventListener('click', () => {
            window.location.href = 'detail.html?view=knowledge';
        });
        document.getElementById('btn-my-history')?.addEventListener('click', () => {
            window.location.href = 'detail.html?view=all';
        });
        document.getElementById('btn-device-docs')?.addEventListener('click', () => {
            window.location.href = 'detail.html?view=documents';
        });

        window.addEventListener('patrolUpdated', () => {
            this.renderInspectionBoards();
            this.renderStats();
            this.renderRecentActivities();
        });
    }

    remindPendingPatrols() {
        const pending = window.SWPUData.getPendingCountByDate(window.SWPUData.getTodayDate());
        const today = window.SWPUData.getTodayDate();
        if (pending > 0 && localStorage.getItem('swpuPendingReminderMutedDate') !== today) {
            setTimeout(() => {
                this.showPendingPatrolReminder(pending, today);
            }, 800);
        }
    }

    getStatusText(status) {
        return ({ unchecked: '未检查', normal: '正常', warning: '警告', error: '异常' })[status] || status;
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type || 'info'} show`;
        notification.innerHTML = `<div class="notification-content"><i class="fas fa-circle-info"></i><span>${message}</span></div>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2800);
    }

    showSubmitSuccessFromSession() {
        const raw = sessionStorage.getItem('swpuSubmitSuccessNotice');
        if (!raw) return;
        sessionStorage.removeItem('swpuSubmitSuccessNotice');
        let notice;
        try {
            notice = JSON.parse(raw);
        } catch (error) {
            return;
        }
        document.querySelector('.submit-success-notification')?.remove();
        const submittedAt = notice.timestamp
            ? new Date(notice.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '刚刚';
        const notification = document.createElement('div');
        notification.className = `notification submit-success-notification status-${notice.status || 'normal'} show`;
        notification.innerHTML = `
            <div class="submit-success-head">
                <i class="fas fa-circle-check"></i>
                <div>
                    <strong>${notice.targetTypeText || '巡查'}状态已提交</strong>
                    <span>${notice.targetName || '巡查项目'}已更新为 ${notice.statusText || '最新状态'}</span>
                </div>
            </div>
            <div class="submit-success-meta">
                <span><i class="far fa-clock"></i>${submittedAt}</span>
                <span><i class="fas fa-user-check"></i>${notice.inspector || this.currentUser.name}</span>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 10000);
    }

    showPendingPatrolReminder(pending, today) {
        document.querySelector('.pending-reminder-notification')?.remove();
        const notification = document.createElement('div');
        notification.className = 'notification pending-reminder-notification show';
        notification.innerHTML = `
            <button class="pending-reminder-trigger" type="button" aria-expanded="false">
                <span class="pending-reminder-icon"><i class="fas fa-circle-info"></i></span>
                <span>今日还有 ${pending} 个机房待巡检，硬件与管理页面也可继续补检</span>
            </button>
            <div class="pending-reminder-actions" hidden>
                <button type="button" data-pending-action="mute-today"><i class="fas fa-bell-slash"></i> 今日不再提示</button>
                <button type="button" data-pending-action="close"><i class="fas fa-xmark"></i> 关闭</button>
            </div>
        `;
        if (document.querySelector('.submit-success-notification')) {
            notification.style.top = '128px';
        }
        const trigger = notification.querySelector('.pending-reminder-trigger');
        const actions = notification.querySelector('.pending-reminder-actions');
        const closeTimer = setTimeout(() => notification.remove(), 10000);
        trigger.addEventListener('click', () => {
            const willOpen = actions.hasAttribute('hidden');
            actions.toggleAttribute('hidden', !willOpen);
            trigger.setAttribute('aria-expanded', String(willOpen));
        });
        notification.querySelector('[data-pending-action="mute-today"]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            clearTimeout(closeTimer);
            localStorage.setItem('swpuPendingReminderMutedDate', today);
            notification.remove();
        });
        notification.querySelector('[data-pending-action="close"]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            clearTimeout(closeTimer);
            notification.remove();
        });
        document.body.appendChild(notification);
    }

    logout() {
        window.SWPUData.clearCurrentSwpuUser();
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.swpuDashboardApp = new SwpuDashboardApp();
});
