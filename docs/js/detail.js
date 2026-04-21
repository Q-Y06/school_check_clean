class DailyPatrolDetailPage {
    constructor() {
        this.currentUser = null;
        this.currentTarget = null;
        this.currentTargetType = 'room';
        this.uploadedFiles = [];
        this.allHistoryPageSize = 10;
        this.allHistoryPage = 1;
        this.init();
    }

    init() {
        window.SWPUData.seedData();
        this.currentUser = window.SWPUData.getCurrentSwpuUser();
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        this.renderCurrentSwpuUser();
        this.bindToolbar();
        this.bindUploader();
        this.bindStatusSelector();
        this.bindSubmit();
        this.loadPageMode();
    }

    renderCurrentSwpuUser() {
        document.querySelector('.swpuUser-avatar').textContent = this.currentUser.name.charAt(0);
        document.querySelector('.swpuUser-name').textContent = this.currentUser.name;
        document.querySelector('.swpuUser-role').textContent = this.currentUser.role === 'admin' ? '管理员' : this.currentUser.role === 'duty' ? '值班工程师' : '巡检工程师';
    }

    loadPageMode() {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        if (view === 'all') {
            this.enterLibraryMode('全部巡查记录');
            this.renderAllHistory(this.normalizeStatusFilter(params.get('status')), this.normalizeDateFilter(params.get('date')) || window.SWPUData.getTodayDate());
            return;
        }
        if (view === 'knowledge') {
            this.enterLibraryMode('故障知识库');
            this.renderKnowledgeLibrary(params.get('keyword') || '');
            return;
        }
        if (view === 'documents') {
            this.enterLibraryMode('设备文档');
            this.renderDocumentLibrary(params.get('keyword') || '', params.get('device') || '');
            return;
        }

        const deviceId = params.get('deviceId');
        const managementId = params.get('managementId');
        const ncicRoomId = params.get('ncicRoomId') || params.get('roomId');
        if (deviceId) {
            this.currentTargetType = 'device';
            this.currentTarget = window.SWPUData.getDevices().find((item) => item.id === deviceId) || null;
        } else if (managementId) {
            this.currentTargetType = 'management';
            this.currentTarget = window.SWPUData.getManagementPages().find((item) => item.id === managementId) || null;
        } else {
            this.currentTargetType = 'room';
            this.currentTarget = window.SWPUData.getNcicRooms().find((item) => item.id === ncicRoomId) || null;
        }

        if (!this.currentTarget) {
            document.getElementById('ncicRoom-name').textContent = '巡查对象不存在';
            document.querySelector('.dailyPatrol-form').style.display = 'none';
            return;
        }
        this.renderTarget();
        this.renderCurrentHistory();
    }

    enterLibraryMode(title) {
        document.querySelector('.dailyPatrol-form').style.display = 'none';
        document.getElementById('ncicRoom-name').textContent = title;
        document.getElementById('ncicRoom-current-status').style.display = 'none';
        document.getElementById('ncicRoom-guide-container').style.display = 'none';
        document.querySelector('.detail-content').classList.add('library-mode');
        document.querySelector('.dailyPatrol-history').classList.add('library-history');
    }

    renderTarget() {
        const titleElement = document.getElementById('ncicRoom-name');
        const statusElement = document.getElementById('ncicRoom-current-status');
        const guideContainer = document.getElementById('ncicRoom-guide-container');
        const guideContent = document.getElementById('ncicRoom-guide-content');
        const guideHeader = guideContainer.querySelector('.guide-header');

        titleElement.textContent = this.currentTarget.name;
        statusElement.style.display = 'inline-block';
        statusElement.textContent = this.getStatusText(this.currentTarget.status || 'unchecked');
        statusElement.className = `status-badge status-${this.currentTarget.status || 'unchecked'}`;
        guideContainer.style.display = 'block';
        document.querySelector('.form-title').textContent = `${this.getTargetTypeText(this.currentTargetType)}巡查记录提交`;
        document.querySelector('.history-title').textContent = `${this.getTargetTypeText(this.currentTargetType)}巡查历史`;

        if (this.currentTargetType === 'room') {
            guideHeader.innerHTML = '<i class="fas fa-info-circle"></i> 机房巡检指南与设备信息';
            guideContent.innerHTML = `
                ${this.currentTarget.description || '<p>暂无巡检指南。</p>'}
                <div class="guide-meta-grid">
                    <div class="guide-meta-card"><strong>位置</strong><span>${this.currentTarget.location}</span></div>
                    <div class="guide-meta-card"><strong>类型</strong><span>${this.currentTarget.type}</span></div>
                </div>
            `;
            return;
        }

        if (this.currentTargetType === 'device') {
            guideHeader.innerHTML = '<i class="fas fa-microchip"></i> 硬件设备巡查要点';
            guideContent.innerHTML = `
                <p>请检查设备运行灯、管理口连通性、关键日志、资源利用率与告警状态。</p>
                <div class="guide-meta-grid">
                    <div class="guide-meta-card"><strong>设备型号</strong><span>${this.currentTarget.model || '待补充'}</span></div>
                    <div class="guide-meta-card"><strong>所在机房</strong><span>${this.currentTarget.ncicRoomName}</span></div>
                    <div class="guide-meta-card"><strong>归属部门</strong><span>${this.currentTarget.owner}</span></div>
                    <div class="guide-meta-card"><strong>累计故障率</strong><span>${this.currentTarget.inspectionCount ? `${Math.round((this.currentTarget.faultCount / this.currentTarget.inspectionCount) * 100)}%` : '0%'}</span></div>
                </div>
            `;
            return;
        }

        guideHeader.innerHTML = '<i class="fas fa-desktop"></i> 管理页面巡查要点';
        guideContent.innerHTML = `
            ${this.currentTarget.description || '<p>暂无巡查说明。</p>'}
            <div class="guide-meta-grid">
                <div class="guide-meta-card"><strong>系统归属</strong><span>${this.currentTarget.system}</span></div>
                <div class="guide-meta-card"><strong>责任部门</strong><span>${this.currentTarget.owner}</span></div>
                <div class="guide-meta-card"><strong>访问地址</strong><span>${this.currentTarget.url || '未配置'}</span></div>
            </div>
        `;
    }

    bindToolbar() {
        document.querySelectorAll('#rt-toolbar [data-cmd]').forEach((button) => {
            button.addEventListener('click', () => document.execCommand(button.dataset.cmd, false));
        });
    }

    bindStatusSelector() {
        document.querySelectorAll('.status-option').forEach((option) => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.status-option').forEach((item) => item.classList.remove('selected'));
                option.classList.add('selected');
                document.getElementById('dailyPatrol-status').value = option.dataset.status;
            });
        });
    }

    bindUploader() {
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (event) => this.handleFiles(event.target.files));
    }

    handleFiles(fileList) {
        this.uploadedFiles = [];
        this.allHistoryPageSize = 10;
        this.allHistoryPage = 1;
        const preview = document.getElementById('uploaded-images');
        preview.innerHTML = '';
        Array.from(fileList).slice(0, 4).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                this.uploadedFiles.push(reader.result);
                const image = document.createElement('img');
                image.src = reader.result;
                image.className = 'history-image';
                image.style.width = '96px';
                image.style.height = '96px';
                image.style.objectFit = 'cover';
                image.style.borderRadius = '10px';
                image.addEventListener('click', () => this.showImage(reader.result));
                preview.appendChild(image);
            };
            reader.readAsDataURL(file);
        });
    }

    bindSubmit() {
        document.addEventListener('click', (event) => {
            const submitButton = event.target.closest('#submit-dailyPatrol');
            if (!submitButton) return;
            event.preventDefault();
            this.submitDailyPatrol();
        });
        document.getElementById('modal-close').addEventListener('click', () => document.getElementById('image-modal').style.display = 'none');
    }

    submitDailyPatrol() {
        if (this.isSubmitting) return;
        const status = document.getElementById('dailyPatrol-status').value;
        const notes = document.getElementById('dailyPatrol-notes').value.trim();
        const richText = document.getElementById('rich-editor').innerHTML.trim();
        if (!status || !this.currentTarget) {
            this.showMessage('请选择巡查状态后再提交', 'error');
            return;
        }
        this.isSubmitting = true;
        const submitButton = document.getElementById('submit-dailyPatrol');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在提交';
        }
        let submitted = false;
        try {
            const dailyPatrolRecord = {
                id: `dailyPatrol-${Date.now()}`,
                date: window.SWPUData.getTodayDate(),
                timestamp: window.SWPUData.formatLocalDateTime(),
                inspector: this.currentUser.name,
                inspectorId: this.currentUser.id,
                status,
                notes,
                richText,
                richContent: richText,
                images: this.uploadedFiles
            };
            if (this.currentTargetType === 'device') {
                window.SWPUData.upsertDevicePatrolRecord(this.currentTarget.id, dailyPatrolRecord);
            } else if (this.currentTargetType === 'management') {
                window.SWPUData.upsertManagementPatrolRecord(this.currentTarget.id, dailyPatrolRecord);
            } else {
                window.SWPUData.upsertDailyPatrolRecord(this.currentTarget.id, dailyPatrolRecord);
            }
            this.applySubmittedStatus(dailyPatrolRecord);
            this.refreshCurrentTarget();
            this.renderTarget();
            this.renderCurrentHistory();
            this.addPatrolOperationLog(dailyPatrolRecord);
            this.queueSubmitSuccessNotice(dailyPatrolRecord);
            this.resetForm();
            this.showSubmitResultCard(dailyPatrolRecord);
            submitted = true;
            setTimeout(() => this.goBackAfterSubmit(), 900);
        } catch (error) {
            console.error('提交巡查记录失败', error);
            this.showMessage(`提交失败：${error.message || '请检查数据后重试'}`, 'error');
        } finally {
            if (!submitted) {
                this.isSubmitting = false;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> 提交巡查记录';
                }
            }
        }
    }

    addPatrolOperationLog(record) {
        const logs = window.SWPUData.fetchSwpuData('dutyLog', () => []);
        const targetName = this.currentTarget?.name || '巡查对象';
        logs.unshift({
            id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            action: `${targetName} ${this.getStatusText(record.status)}`,
            level: record.status === 'normal' ? 'success' : record.status === 'error' ? 'error' : 'warning',
            operator: this.currentUser?.name || record.inspector || '巡检人员',
            timestamp: record.timestamp,
            payload: {
                targetId: this.currentTarget?.id,
                targetName,
                targetType: this.currentTargetType,
                status: record.status
            }
        });
        window.SWPUData.persistNcicRecord('dutyLog', logs.slice(0, 300));
    }

    applySubmittedStatus(record) {
        const targetId = this.currentTarget?.id;
        if (!targetId || !record) return;
        if (this.currentTargetType === 'device') {
            const devices = window.SWPUData.getDevices().map((item) => item.id === targetId ? {
                ...item,
                status: record.status,
                updatedAt: record.timestamp.slice(0, 10),
                lastInspection: record.timestamp
            } : item);
            window.SWPUData.saveDevices(devices);
            return;
        }
        if (this.currentTargetType === 'management') {
            const pages = window.SWPUData.getManagementPages().map((item) => item.id === targetId ? {
                ...item,
                status: record.status,
                lastInspection: record.timestamp
            } : item);
            window.SWPUData.saveManagementPages(pages);
            return;
        }
        const rooms = window.SWPUData.getNcicRooms().map((item) => item.id === targetId ? {
            ...item,
            status: record.status,
            lastInspection: record.timestamp
        } : item);
        window.SWPUData.saveNcicRooms(rooms);
    }

    queueSubmitSuccessNotice(record) {
        if (!this.currentTarget) return;
        const notice = {
            targetName: this.currentTarget.name,
            targetType: this.currentTargetType,
            targetTypeText: this.getTargetTypeText(this.currentTargetType),
            status: record.status,
            statusText: this.getStatusText(record.status),
            inspector: this.currentUser.name,
            timestamp: record.timestamp
        };
        sessionStorage.setItem('swpuSubmitSuccessNotice', JSON.stringify(notice));
    }

    refreshCurrentTarget() {
        if (!this.currentTarget) return;
        if (this.currentTargetType === 'device') {
            this.currentTarget = window.SWPUData.getDevices().find((item) => item.id === this.currentTarget.id) || this.currentTarget;
            return;
        }
        if (this.currentTargetType === 'management') {
            this.currentTarget = window.SWPUData.getManagementPages().find((item) => item.id === this.currentTarget.id) || this.currentTarget;
            return;
        }
        this.currentTarget = window.SWPUData.getNcicRooms().find((item) => item.id === this.currentTarget.id) || this.currentTarget;
    }

    goBackAfterSubmit() {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.href = 'index.html';
    }

    renderCurrentHistory() {
        const recordMap = this.currentTargetType === 'device'
            ? window.SWPUData.getAllDevicePatrolRecords()
            : this.currentTargetType === 'management'
                ? window.SWPUData.getAllManagementPatrolRecords()
                : window.SWPUData.getAllDailyPatrolRecords();
        const records = (recordMap[this.currentTarget.id] || [])
            .slice()
            .sort((a, b) => this.getRecordTimeValue(b.timestamp) - this.getRecordTimeValue(a.timestamp))
            .map((record) => ({
            ...record,
            targetName: this.currentTarget.name,
            targetType: this.currentTargetType
        }));
        this.renderCurrentHistorySummary(records);
        this.renderHistoryList(records);
    }

    renderCurrentHistorySummary(records) {
        const historyCard = document.querySelector('.dailyPatrol-history');
        if (!historyCard) return;
        historyCard.querySelector('.history-summary')?.remove();
        const countByStatus = records.reduce((result, item) => {
            result[item.status] = (result[item.status] || 0) + 1;
            return result;
        }, {});
        const latest = records[0];
        const summary = document.createElement('div');
        summary.className = 'history-summary';
        summary.innerHTML = `
            <div><strong>${records.length}</strong><span>累计记录</span></div>
            <div><strong>${countByStatus.normal || 0}</strong><span>正常</span></div>
            <div><strong>${(countByStatus.warning || 0) + (countByStatus.error || 0)}</strong><span>告警/异常</span></div>
            <div><strong>${latest ? this.formatRecordTime(latest.timestamp, true) : '-'}</strong><span>最近提交</span></div>
        `;
        historyCard.insertBefore(summary, document.getElementById('history-list'));
    }

    renderAllHistory(statusFilter, dateFilter = '') {
        const activeDate = this.normalizeDateFilter(dateFilter);
        const roomRecords = window.SWPUData.getDailyPatrolList().map((item) => ({ ...item, targetName: item.ncicRoomName, targetType: 'room' }));
        const deviceRecords = window.SWPUData.getDevicePatrolList().map((item) => ({ ...item, targetName: item.deviceName, targetType: 'device' }));
        const managementRecords = window.SWPUData.getManagementPatrolList().map((item) => ({ ...item, targetName: item.managementName, targetType: 'management' }));
        const allRecords = [...roomRecords, ...deviceRecords, ...managementRecords];
        const records = allRecords
            .filter((item) => !statusFilter || item.status === statusFilter)
            .filter((item) => !activeDate || this.getRecordDateString(item.timestamp || item.date) === activeDate)
            .sort((a, b) => this.getRecordTimeValue(b.timestamp) - this.getRecordTimeValue(a.timestamp));
        const titlePrefix = statusFilter ? this.getHistoryFilterText(statusFilter) : '全部';
        document.querySelector('.history-title').textContent = activeDate ? `${titlePrefix}巡查记录 · ${activeDate}` : `${titlePrefix}巡查记录`;
        this.renderHistoryFilters(statusFilter, allRecords, activeDate);
        this.renderHistoryList(records, true, true, statusFilter, activeDate);
    }

    normalizeStatusFilter(status) {
        return ['normal', 'warning', 'error'].includes(status) ? status : '';
    }

    normalizeDateFilter(value) {
        const text = String(value || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    }

    renderHistoryFilters(activeStatus, allRecords, activeDate = '') {
        const historyCard = document.querySelector('.dailyPatrol-history');
        if (!historyCard) return;
        historyCard.querySelector('.history-filter-panel')?.remove();
        const countSource = activeDate ? allRecords.filter((item) => this.getRecordDateString(item.timestamp || item.date) === activeDate) : allRecords;
        const countByStatus = countSource.reduce((result, item) => {
            result[item.status] = (result[item.status] || 0) + 1;
            return result;
        }, {});
        const filters = [
            { status: '', label: '全部', count: countSource.length, icon: 'fa-list' },
            { status: 'normal', label: '正常', count: countByStatus.normal || 0, icon: 'fa-circle-check' },
            { status: 'warning', label: '报警', count: countByStatus.warning || 0, icon: 'fa-triangle-exclamation' },
            { status: 'error', label: '异常', count: countByStatus.error || 0, icon: 'fa-circle-xmark' }
        ];
        const panel = document.createElement('div');
        panel.className = 'history-filter-panel';
        panel.innerHTML = `
            <div class="history-filter-bar">
                ${filters.map((item) => `
                    <button class="history-filter-btn ${item.status === activeStatus ? 'active' : ''}" type="button" data-history-status="${item.status}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                        <strong>${item.count}</strong>
                    </button>
                `).join('')}
            </div>
            <div class="history-date-filter">
                <label><i class="fas fa-calendar-days"></i><span>按日期搜索</span><input id="history-date-filter" type="date" value="${activeDate}"></label>
                <button class="history-date-btn" type="button" id="history-date-today">今天</button>
                <button class="history-date-btn" type="button" id="history-date-clear">清空日期</button>
            </div>
        `;
        historyCard.insertBefore(panel, document.getElementById('history-list'));
        const updateQuery = (nextStatus, nextDate) => {
            const params = new URLSearchParams(window.location.search);
            params.set('view', 'all');
            nextStatus ? params.set('status', nextStatus) : params.delete('status');
            nextDate ? params.set('date', nextDate) : params.delete('date');
            window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
        };
        panel.querySelectorAll('[data-history-status]').forEach((button) => {
            button.addEventListener('click', () => {
                const nextStatus = button.dataset.historyStatus || '';
                updateQuery(nextStatus, activeDate);
                this.allHistoryPage = 1;
                this.renderAllHistory(nextStatus, activeDate);
            });
        });
        const dateInput = panel.querySelector('#history-date-filter');
        dateInput?.addEventListener('change', () => {
            const nextDate = this.normalizeDateFilter(dateInput.value);
            updateQuery(activeStatus, nextDate);
            this.allHistoryPage = 1;
            this.renderAllHistory(activeStatus, nextDate);
        });
        panel.querySelector('#history-date-today')?.addEventListener('click', () => {
            const today = window.SWPUData.getTodayDate ? window.SWPUData.getTodayDate() : this.getRecordDateString(new Date());
            updateQuery(activeStatus, today);
            this.allHistoryPage = 1;
            this.renderAllHistory(activeStatus, today);
        });
        panel.querySelector('#history-date-clear')?.addEventListener('click', () => {
            updateQuery(activeStatus, '');
            this.allHistoryPage = 1;
            this.renderAllHistory(activeStatus, '');
        });
    }

    getHistoryFilterText(status) {
        return ({ normal: '正常', warning: '报警', error: '异常' })[status] || this.getStatusText(status);
    }

    renderHistoryList(records, includeNcicRoomName, paginate = false, activeStatus = '', activeDate = '') {
        const list = document.getElementById('history-list');
        if (!records.length) {
            list.innerHTML = '<div class="empty-history"><i class="fas fa-history"></i><p>暂无巡查记录</p></div>';
            return;
        }
        const totalPages = paginate ? Math.max(1, Math.ceil(records.length / this.allHistoryPageSize)) : 1;
        if (this.allHistoryPage > totalPages) this.allHistoryPage = totalPages;
        const visibleRecords = paginate ? records.slice((this.allHistoryPage - 1) * this.allHistoryPageSize, this.allHistoryPage * this.allHistoryPageSize) : records;
        list.innerHTML = visibleRecords.map((record) => `
            <div class="history-item">
                <div class="history-header">
                    <div>
                        <strong>${includeNcicRoomName ? `${this.getTargetTypeText(record.targetType)} · ${record.targetName}` : record.targetName}</strong>
                        <span class="status-badge status-${record.status}">${this.getStatusText(record.status)}</span>
                    </div>
                    <div>${this.formatRecordTime(record.timestamp)}</div>
                </div>
                <p><strong>巡查人：</strong>${record.inspector}</p>
                ${record.ncicRoomName && includeNcicRoomName ? `<p><strong>所属机房：</strong>${record.ncicRoomName}</p>` : ''}
                ${record.system && includeNcicRoomName ? `<p><strong>系统归属：</strong>${record.system}</p>` : ''}
                ${record.notes ? `<p><strong>备注：</strong>${record.notes}</p>` : ''}
                ${record.richText ? `<div class="knowledge-solution">${record.richText}</div>` : ''}
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">${this.normalizeRecordImages(record.images).map((image) => `<img src="${image}" class="history-image" style="width:96px; height:96px; object-fit:cover; border-radius:10px; cursor:pointer;">`).join('')}</div>
            </div>
        `).join('');
        list.querySelectorAll('.history-image').forEach((image) => {
            image.addEventListener('click', () => this.showImage(image.src));
        });
        if (paginate && totalPages > 1) {
            const pager = document.createElement('div');
            pager.className = 'history-pagination';
            pager.innerHTML = `<span>第 ${this.allHistoryPage} / ${totalPages} 页，共 ${records.length} 条</span><button type="button" data-history-page="prev" ${this.allHistoryPage <= 1 ? 'disabled' : ''}>上一页</button><button type="button" data-history-page="next" ${this.allHistoryPage >= totalPages ? 'disabled' : ''}>下一页</button>`;
            list.appendChild(pager);
            pager.querySelector('[data-history-page="prev"]')?.addEventListener('click', () => {
                this.allHistoryPage -= 1;
                this.renderAllHistory(activeStatus, activeDate);
            });
            pager.querySelector('[data-history-page="next"]')?.addEventListener('click', () => {
                this.allHistoryPage += 1;
                this.renderAllHistory(activeStatus, activeDate);
            });
        }
    }

    normalizeRecordImages(images) {
        if (Array.isArray(images)) return images.filter(Boolean);
        if (!images) return [];
        if (typeof images === 'string') {
            try {
                const parsed = JSON.parse(images);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (error) {
                return images ? [images] : [];
            }
        }
        return [];
    }

    formatRecordTime(timestamp, timeOnly = false) {
        if (!timestamp) return '-';
        const value = String(timestamp);
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (match) {
            return timeOnly ? `${match[4]}:${match[5]}` : `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return timeOnly
            ? parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : parsed.toLocaleString('zh-CN', { hour12: false });
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
    getRecordTimeValue(timestamp) {
        if (!timestamp) return 0;
        const value = String(timestamp);
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
            return new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]),
                Number(match[4]),
                Number(match[5]),
                Number(match[6] || 0)
            ).getTime();
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }

    renderLibrarySearch({ type, keyword = '', deviceId = '' }) {
        const historyCard = document.querySelector('.dailyPatrol-history');
        if (!historyCard) return;
        historyCard.querySelector('.library-search-bar')?.remove();
        const devices = window.SWPUData.getDevices();
        const bar = document.createElement('div');
        bar.className = 'library-search-bar';
        bar.innerHTML = `
            <label class="library-search-field">
                <i class="fas fa-search"></i>
                <input id="library-search-input" type="search" value="${keyword}" placeholder="${type === 'documents' ? '搜索文档名称、设备型号、分类或用途' : '搜索故障、设备、标签或处理方法'}">
            </label>
            ${type === 'documents' ? `
                <select id="library-device-filter" class="library-device-filter">
                    <option value="">全部设备文档</option>
                    ${devices.map((device) => `<option value="${device.id}" ${device.id === deviceId ? 'selected' : ''}>${device.name} · ${device.model || device.type || '设备'}</option>`).join('')}
                </select>
            ` : ''}
            <button id="library-search-reset" class="library-reset-btn" type="button">清空</button>
        `;
        historyCard.insertBefore(bar, document.getElementById('history-list'));
        const input = bar.querySelector('#library-search-input');
        const select = bar.querySelector('#library-device-filter');
        const rerender = () => {
            if (type === 'documents') {
                this.renderDocumentLibrary(input.value.trim(), select?.value || '');
            } else {
                this.renderKnowledgeLibrary(input.value.trim());
            }
        };
        input.addEventListener('input', () => {
            clearTimeout(this.librarySearchTimer);
            this.librarySearchTimer = setTimeout(rerender, 180);
        });
        select?.addEventListener('change', rerender);
        bar.querySelector('#library-search-reset')?.addEventListener('click', () => {
            input.value = '';
            if (select) select.value = '';
            rerender();
        });
    }

    renderKnowledgeLibrary(keyword = '') {
        const list = document.getElementById('history-list');
        const entries = window.SWPUData.searchCollection(window.SWPUData.getKnowledgeBase(), keyword, ['title', 'category', 'solution', 'tags']);
        document.querySelector('.history-title').textContent = '故障知识库';
        this.renderLibrarySearch({ type: 'knowledge', keyword });
        list.innerHTML = entries.length ? entries.map((item) => `
            <div class="library-card">
                <div class="history-header">
                    <div>
                        <strong>${item.title}</strong>
                        <span class="status-badge status-normal">${item.category}</span>
                    </div>
                    <div>${(item.tags || []).join(' / ')}</div>
                </div>
                <div class="knowledge-solution">${item.solution}</div>
            </div>
        `).join('') : '<div class="empty-history"><i class="fas fa-book"></i><p>暂无匹配的知识库内容</p></div>';
    }

    getDocumentUrl(item) {
        const value = (item.url || item.link || item.href || '').trim();
        if (value) return value;
        const title = (item.title || '').trim();
        return /^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/)/i.test(title) ? title : '';
    }

    getDocumentViewerUrl(item) {
        const url = this.getDocumentUrl(item);
        if (!url) return '';
        const params = new URLSearchParams({
            src: url,
            title: this.getDocumentName(item)
        });
        return `document-viewer.html?${params.toString()}`;
    }

    getDocumentName(item) {
        const title = (item.title || item.name || '').trim();
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

    renderDocumentLibrary(keyword = '', deviceId = '') {
        const list = document.getElementById('history-list');
        const selectedDevice = window.SWPUData.getDevices().find((device) => device.id === deviceId);
        const deviceKeyword = selectedDevice ? `${selectedDevice.name} ${selectedDevice.model || ''} ${selectedDevice.type || ''} ${selectedDevice.ncicRoomName || ''}` : '';
        const combinedKeyword = [keyword, deviceKeyword].filter(Boolean).join(' ');
        const documents = window.SWPUData.searchCollection(window.SWPUData.getDocuments(), combinedKeyword, ['title', 'url', 'link', 'category', 'description', 'size', 'updatedAt']);
        document.querySelector('.history-title').textContent = '设备文档';
        this.renderLibrarySearch({ type: 'documents', keyword, deviceId });
        list.innerHTML = documents.length ? documents.map((item) => {
            const url = this.getDocumentUrl(item);
            const viewerUrl = this.getDocumentViewerUrl(item);
            const name = this.getDocumentName(item);
            return `
            <div class="library-card">
                <div class="history-header">
                    <div>
                        <strong>${name}</strong>
                        <span class="status-badge status-normal">${item.category}</span>
                    </div>
                    <div>${item.updatedAt}</div>
                </div>
                ${url ? `<a class="document-link" href="${viewerUrl}" target="_blank" rel="noopener"><i class="fas fa-eye"></i><span>查看文档</span><small>${url}</small></a>` : '<p class="document-link muted"><i class="fas fa-link-slash"></i><span>未配置文档链接</span></p>'}
                <p><strong>文档大小：</strong>${item.size}</p>
                <p><strong>用途说明：</strong>${item.description || '可用于设备维护、故障定位与巡查操作参考。'}</p>
            </div>
        `;
        }).join('') : '<div class="empty-history"><i class="fas fa-file-alt"></i><p>暂无匹配的设备文档</p></div>';
    }

    showImage(src) {
        document.getElementById('modal-image').src = src;
        document.getElementById('image-modal').style.display = 'flex';
    }

    resetForm() {
        document.getElementById('dailyPatrol-status').value = '';
        document.getElementById('dailyPatrol-notes').value = '';
        document.getElementById('rich-editor').innerHTML = '';
        document.getElementById('uploaded-images').innerHTML = '';
        document.querySelectorAll('.status-option').forEach((item) => item.classList.remove('selected'));
        this.uploadedFiles = [];
        this.allHistoryPageSize = 10;
        this.allHistoryPage = 1;
    }

    getTargetTypeText(type) {
        return ({ room: '机房', device: '硬件设备', management: '管理页面' })[type] || '对象';
    }

    getStatusText(status) {
        return ({ unchecked: '未检查', normal: '正常', warning: '警告', error: '异常' })[status] || status;
    }

    showMessage(text, type) {
        const message = document.createElement('div');
        message.className = `notification ${type || 'info'} show`;
        message.innerHTML = `<div class="notification-content"><i class="fas fa-circle-info"></i><span>${text}</span></div>`;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 2400);
    }

    showSubmitResultCard(record) {
        document.querySelector('.submit-result-card')?.remove();
        const message = document.createElement('div');
        message.className = `notification submit-result-card status-${record.status} show`;
        message.innerHTML = `
            <div class="submit-result-head">
                <i class="fas fa-circle-check"></i>
                <div>
                    <strong>${this.getTargetTypeText(this.currentTargetType)}巡查已提交</strong>
                    <span>${this.currentTarget.name}</span>
                </div>
            </div>
            <div class="submit-result-grid">
                <div><strong>${this.getStatusText(record.status)}</strong><span>最新状态</span></div>
                <div><strong>${this.currentUser.name}</strong><span>巡查人</span></div>
                <div><strong>${this.formatRecordTime(record.timestamp, true)}</strong><span>提交时间</span></div>
            </div>
            <p>记录已写入巡查历史，正在返回列表。</p>
        `;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 10000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dailyPatrolDetailPage = new DailyPatrolDetailPage();
});
