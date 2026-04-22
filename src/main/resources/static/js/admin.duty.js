(function () {
    const dataKit = window.SWPUData;

    function notify(message, type = 'info') {
        const app = window.adminSystem || window.swpuAdminApp;
        if (app && typeof app.showNotification === 'function') {
            app.showNotification(message, type);
        }
    }

    function getDutyUsers() {
        const userMap = new Map();
        dataKit.getSwpuUsers()
            .filter((item) => item.status !== 'inactive' && (((item.roles || []).includes('duty')) || item.role === 'duty' || item.role === 'engineer'))
            .forEach((item) => userMap.set(item.id, item));

        dataKit.fetchSwpuData('ncicDutyList', () => []).forEach((item) => {
            if (item.swpuUserId && !userMap.has(item.swpuUserId)) {
                userMap.set(item.swpuUserId, {
                    id: item.swpuUserId,
                    name: item.swpuUserName,
                    employeeId: item.swpuUserId,
                    phone: item.phone,
                    role: 'duty',
                    roles: ['duty']
                });
            }
        });
        return Array.from(userMap.values());
    }

    function createDutyLogRecord(action, payload) {
        const logList = dataKit.fetchSwpuData('dutyLog', () => []);
        const currentSwpuUser = dataKit.getCurrentSwpuUser();
        logList.unshift({
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            action,
            operator: currentSwpuUser ? currentSwpuUser.name : '系统',
            timestamp: new Date().toISOString(),
            payload
        });
        dataKit.persistNcicRecord('dutyLog', logList);
    }

    function fetchDutyList() {
        try {
            const dutyList = dataKit.fetchSwpuData('ncicDutyList', () => [])
                .filter((item) => item && item.date)
                .sort((a, b) => a.date.localeCompare(b.date));
            return { code: 0, msg: 'ok', data: dutyList };
        } catch (error) {
            return { code: 1, msg: error.message, data: [] };
        }
    }

    function saveDuty(payload, options) {
        const config = options || {};
        if (!payload.date) {
            return { code: 2, msg: '请选择值班日期', data: null };
        }
        if (!config.skipConfirm && !window.confirm(`确认保存 ${payload.date} 的值班安排吗？`)) {
            return { code: 1, msg: 'cancelled', data: null };
        }

        const dutyUsers = getDutyUsers();
        const matchedSwpuUser = dutyUsers.find((item) => item.id === payload.swpuUserId || item.employeeId === payload.employeeId || item.name === payload.swpuUserName);
        if (!matchedSwpuUser) {
            return { code: 2, msg: '未找到值班人员', data: null };
        }

        const dutyList = dataKit.fetchSwpuData('ncicDutyList', () => []);
        const nextDuty = {
            id: payload.id || `duty-${payload.date}`,
            date: payload.date,
            swpuUserId: matchedSwpuUser.id,
            swpuUserName: matchedSwpuUser.name,
            phone: payload.phone || matchedSwpuUser.phone || '',
            note: (payload.note || '').slice(0, 200)
        };

        const existingIndex = dutyList.findIndex((item) => item.date === nextDuty.date || item.id === nextDuty.id);
        if (existingIndex >= 0) {
            dutyList.splice(existingIndex, 1, nextDuty);
        } else {
            dutyList.push(nextDuty);
        }

        dutyList.sort((a, b) => a.date.localeCompare(b.date));
        dataKit.persistNcicRecord('ncicDutyList', dutyList);
        createDutyLogRecord('saveDuty', nextDuty);
        return { code: 0, msg: '保存成功', data: nextDuty };
    }

    function deleteDuty(id) {
        const dutyList = dataKit.fetchSwpuData('ncicDutyList', () => []);
        const target = dutyList.find((item) => item.id === id);
        if (!target) {
            return { code: 1, msg: '未找到值班记录', data: null };
        }
        if (!window.confirm(`确认删除 ${target.date} 的值班安排吗？`)) {
            return { code: 2, msg: 'cancelled', data: null };
        }
        const nextList = dutyList.filter((item) => item.id !== id);
        dataKit.persistNcicRecord('ncicDutyList', nextList);
        createDutyLogRecord('deleteDuty', target);
        return { code: 0, msg: '删除成功', data: target };
    }

    const adminDutyModule = {
        container: null,
        viewedMonth: null,

        mount(container) {
            this.container = container;
            this.viewedMonth = new Date();
            this.viewedMonth.setDate(1);
            this.cacheElements();
            this.renderDutyUserOptions();
            this.bindEvents();
            this.setFormFromDate(dataKit.getTodayDate());
            this.renderDutyTable();
            this.renderCalendar();
        },

        cacheElements() {
            this.dutyDate = this.container.querySelector('#dutyDate');
            this.dutyUserSelect = this.container.querySelector('#dutyUserSelect');
            this.dutyPhone = this.container.querySelector('#dutyPhone');
            this.dutyNote = this.container.querySelector('#dutyNote');
            this.dutyImportInput = this.container.querySelector('#dutyImportInput');
            this.dutyTableBody = this.container.querySelector('#dutyTableBody');
            this.calendarEl = this.container.querySelector('#dutyCalendar');
            this.monthTitle = this.container.querySelector('#dutyMonthTitle');
            this.monthTotal = this.container.querySelector('#dutyMonthTotal');
            this.todayPerson = this.container.querySelector('#dutyTodayPerson');
            this.missingDays = this.container.querySelector('#dutyMissingDays');
        },

        bindEvents() {
            this.container.querySelector('#dutyRefreshBtn').addEventListener('click', () => {
                this.renderDutyTable();
                this.renderCalendar();
                notify('值班排期已刷新', 'success');
            });
            this.container.querySelector('#dutyPrevMonth').addEventListener('click', () => this.changeMonth(-1));
            this.container.querySelector('#dutyNextMonth').addEventListener('click', () => this.changeMonth(1));
            this.container.querySelector('#dutyTodayBtn').addEventListener('click', () => {
                this.viewedMonth = new Date();
                this.viewedMonth.setDate(1);
                this.setFormFromDate(dataKit.getTodayDate());
                this.renderDutyTable();
                this.renderCalendar();
            });
            this.container.querySelector('#dutySaveBtn').addEventListener('click', () => this.handleSave());
            this.container.querySelector('#dutyDeleteBtn').addEventListener('click', () => this.handleDelete());
            this.container.querySelector('#dutyResetBtn').addEventListener('click', () => this.setFormFromDate(dataKit.getTodayDate(), true));
            this.container.querySelector('#dutyBatchImport').addEventListener('click', () => this.dutyImportInput.click());
            this.dutyImportInput.addEventListener('change', (event) => this.importExcelFile(event.target.files[0]));
            this.dutyDate.addEventListener('change', () => this.setFormFromDate(this.dutyDate.value));
            this.dutyUserSelect.addEventListener('change', () => {
                const selected = getDutyUsers().find((item) => item.id === this.dutyUserSelect.value);
                this.dutyPhone.value = selected ? selected.phone || '' : '';
            });
        },

        changeMonth(offset) {
            this.viewedMonth.setMonth(this.viewedMonth.getMonth() + offset);
            this.viewedMonth.setDate(1);
            const nextDate = this.formatDate(this.viewedMonth);
            this.setFormFromDate(nextDate);
            this.renderDutyTable();
            this.renderCalendar();
        },

        formatDate(date) {
            const pad = (value) => String(value).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        },

        getMonthRange() {
            const year = this.viewedMonth.getFullYear();
            const month = this.viewedMonth.getMonth();
            const first = new Date(year, month, 1);
            const last = new Date(year, month + 1, 0);
            return { year, month, first, last, days: last.getDate() };
        },

        isInViewedMonth(dateText) {
            const { year, month } = this.getMonthRange();
            const date = new Date(`${dateText}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        },

        renderDutyUserOptions() {
            const dutyUsers = getDutyUsers();
            this.dutyUserSelect.innerHTML = dutyUsers.length
                ? dutyUsers.map((swpuUser) => `<option value="${swpuUser.id}">${swpuUser.name} (${swpuUser.employeeId || swpuUser.id})</option>`).join('')
                : '<option value="">暂无值班人员</option>';
        },

        setFormFromDate(date, clearOnly) {
            this.dutyDate.value = date;
            const dutyUsers = getDutyUsers();
            if (clearOnly) {
                this.dutyNote.value = '';
                this.dutyUserSelect.selectedIndex = 0;
                this.dutyPhone.value = dutyUsers[0] ? dutyUsers[0].phone || '' : '';
                return;
            }
            const dutyList = fetchDutyList().data;
            const matched = dutyList.find((item) => item.date === date);
            if (matched) {
                this.dutyUserSelect.value = matched.swpuUserId;
                this.dutyPhone.value = matched.phone || '';
                this.dutyNote.value = matched.note || '';
            } else {
                this.dutyUserSelect.selectedIndex = 0;
                this.dutyPhone.value = dutyUsers[0] ? dutyUsers[0].phone || '' : '';
                this.dutyNote.value = '';
            }
        },

        handleSave() {
            const result = saveDuty({
                date: this.dutyDate.value,
                swpuUserId: this.dutyUserSelect.value,
                phone: this.dutyPhone.value,
                note: this.dutyNote.value
            });
            if (result.code === 0) {
                notify(result.msg, 'success');
                this.viewedMonth = new Date(`${this.dutyDate.value}T00:00:00`);
                this.viewedMonth.setDate(1);
                this.renderDutyTable();
                this.renderCalendar();
            } else if (result.msg !== 'cancelled') {
                notify(result.msg, 'error');
            }
        },

        handleDelete() {
            const dutyList = fetchDutyList().data;
            const matched = dutyList.find((item) => item.date === this.dutyDate.value);
            if (!matched) {
                notify('当天暂无排班记录', 'warning');
                return;
            }
            const result = deleteDuty(matched.id);
            if (result.code === 0) {
                notify(result.msg, 'success');
                this.setFormFromDate(this.dutyDate.value, true);
                this.renderDutyTable();
                this.renderCalendar();
            }
        },

        importExcelFile(file) {
            if (!file) {
                return;
            }
            if (typeof XLSX === 'undefined') {
                notify('当前环境未加载 Excel 解析库', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                if (!rows.length) {
                    notify('导入文件为空', 'warning');
                    return;
                }
                if (!window.confirm(`确认批量导入 ${rows.length} 条值班安排吗？`)) {
                    return;
                }
                rows.forEach((row) => {
                    saveDuty({
                        date: row['日期'] || row.date,
                        employeeId: row['工号'] || row.employeeId,
                        swpuUserName: row['姓名'] || row.name,
                        phone: row['手机号'] || row.phone,
                        note: row['备注'] || ''
                    }, { skipConfirm: true });
                });
                createDutyLogRecord('importDuty', { filename: file.name, count: rows.length });
                notify(`已导入 ${rows.length} 条值班记录`, 'success');
                this.renderDutyTable();
                this.renderCalendar();
            };
            reader.readAsBinaryString(file);
        },

        renderDutyTable() {
            const dutyList = fetchDutyList().data.filter((item) => this.isInViewedMonth(item.date));
            this.dutyTableBody.innerHTML = dutyList.length ? dutyList.map((item) => `
                <tr>
                    <td>${item.date}</td>
                    <td>${item.swpuUserName}</td>
                    <td>${item.phone || '-'}</td>
                    <td>${item.note || '-'}</td>
                    <td>
                        <button class="action-btn delete" data-duty-id="${item.id}" type="button" title="删除"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="5" class="empty-state">本月暂无值班安排</td></tr>';
            this.dutyTableBody.querySelectorAll('[data-duty-id]').forEach((button) => {
                button.addEventListener('click', () => {
                    const result = deleteDuty(button.dataset.dutyId);
                    if (result.code === 0) {
                        notify(result.msg, 'success');
                        this.renderDutyTable();
                        this.renderCalendar();
                    }
                });
            });
        },

        renderCalendar() {
            const dutyList = fetchDutyList().data;
            const dutyMap = new Map(dutyList.map((item) => [item.date, item]));
            const { year, month, first, days } = this.getMonthRange();
            const today = dataKit.getTodayDate();
            const selectedDate = this.dutyDate.value;
            const monthDutyList = dutyList.filter((item) => this.isInViewedMonth(item.date));
            const missingCount = Math.max(days - monthDutyList.length, 0);
            const todayDuty = dutyMap.get(today);

            this.monthTitle.textContent = `${year} 年 ${month + 1} 月`;
            this.monthTotal.textContent = monthDutyList.length;
            this.todayPerson.textContent = todayDuty ? todayDuty.swpuUserName : '未安排';
            this.missingDays.textContent = missingCount;

            const cells = [];
            const weekdayOffset = first.getDay();
            for (let i = 0; i < weekdayOffset; i += 1) {
                cells.push('<button class="duty-day-cell is-empty" type="button" disabled></button>');
            }
            for (let day = 1; day <= days; day += 1) {
                const date = new Date(year, month, day);
                const dateText = this.formatDate(date);
                const duty = dutyMap.get(dateText);
                const classes = [
                    'duty-day-cell',
                    dateText === today ? 'is-today' : '',
                    dateText === selectedDate ? 'is-selected' : '',
                    duty ? 'has-duty' : 'is-missing'
                ].filter(Boolean).join(' ');
                cells.push(`
                    <button class="${classes}" type="button" data-duty-date="${dateText}">
                        <span class="duty-day-number">${day}</span>
                        ${duty ? `
                            <strong class="duty-day-name">${duty.swpuUserName}</strong>
                            <span class="duty-day-phone">${duty.phone || '未填手机号'}</span>
                        ` : '<span class="duty-empty-chip">未排班</span>'}
                    </button>
                `);
            }
            this.calendarEl.innerHTML = `
                <div class="duty-weekdays">
                    <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                </div>
                <div class="duty-month-grid">${cells.join('')}</div>
            `;
            this.calendarEl.querySelectorAll('[data-duty-date]').forEach((button) => {
                button.addEventListener('click', () => {
                    this.setFormFromDate(button.dataset.dutyDate);
                    this.renderCalendar();
                });
            });
        }
    };

    window.adminDutyModule = {
        fetchDutyList,
        saveDuty,
        deleteDuty,
        mount: adminDutyModule.mount.bind(adminDutyModule)
    };
})();
