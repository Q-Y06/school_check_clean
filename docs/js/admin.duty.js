(function (window) {
    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function getDutyUsers() {
        return window.SWPUData.getSwpuUsers()
            .filter((user) => user.status !== 'inactive' && ((user.roles || []).includes('duty') || user.role === 'duty' || user.role === 'engineer'));
    }

    function getDutyList() {
        return window.SWPUData.fetchSwpuData('ncicDutyList', () => []);
    }

    function saveDutyList(list) {
        window.SWPUData.persistNcicRecord('ncicDutyList', list);
    }

    function ensureMonthDuties(viewDate) {
        const users = getDutyUsers();
        const list = getDutyList();
        if (!users.length) return list;
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        let changed = false;
        for (let day = 1; day <= days; day += 1) {
            const current = new Date(year, month, day);
            const key = dateKey(current);
            if (!list.some((item) => item.date === key)) {
                const user = users[(day - 1) % users.length];
                list.push({
                    id: `duty-${key}`,
                    date: key,
                    swpuUserId: user.id,
                    swpuUserName: user.name,
                    phone: user.phone || '',
                    note: '负责当日机房巡检、告警跟进与交接班记录。'
                });
                changed = true;
            }
        }
        if (changed) saveDutyList(list);
        return list;
    }

    function renderDayOptions(selectedId) {
        return getDutyUsers().map((user) => {
            const selected = user.id === selectedId ? 'selected' : '';
            return `<option value="${user.id}" ${selected}>${user.name} / ${user.phone || '未填写电话'}</option>`;
        }).join('');
    }

    const module = {
        viewDate: new Date(),
        root: null,

        mount(container) {
            this.root = container;
            this.bind();
            this.render();
        },

        bind() {
            this.root.querySelector('#dutyPrevMonth')?.addEventListener('click', () => {
                this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
                this.render();
            });
            this.root.querySelector('#dutyToday')?.addEventListener('click', () => {
                this.viewDate = new Date();
                this.render();
            });
            this.root.querySelector('#dutyNextMonth')?.addEventListener('click', () => {
                this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
                this.render();
            });
        },

        render() {
            const title = this.root.querySelector('#dutyCalendarTitle');
            const grid = this.root.querySelector('#dutyCalendarGrid');
            const summary = this.root.querySelector('#dutySummary');
            if (!title || !grid || !summary) return;

            const list = ensureMonthDuties(this.viewDate);
            const users = getDutyUsers();
            const year = this.viewDate.getFullYear();
            const month = this.viewDate.getMonth();
            const first = new Date(year, month, 1);
            const days = new Date(year, month + 1, 0).getDate();
            const today = dateKey(new Date());
            title.textContent = `${year}年${month + 1}月`;

            const monthDuties = list.filter((item) => item.date && item.date.startsWith(`${year}-${pad(month + 1)}-`));
            const todayDuty = list.find((item) => item.date === today);
            summary.innerHTML = `
                <div class="stat-card"><div class="stat-info"><h3>本月排班</h3><div class="stat-number">${monthDuties.length}</div><div class="stat-trend">已自动补齐</div></div></div>
                <div class="stat-card"><div class="stat-info"><h3>值班人员</h3><div class="stat-number">${users.length}</div><div class="stat-trend">可参与排班</div></div></div>
                <div class="stat-card"><div class="stat-info"><h3>今日值班</h3><div class="stat-number stat-number-text">${todayDuty ? todayDuty.swpuUserName : '未排班'}</div><div class="stat-trend">${todayDuty ? todayDuty.phone : '请补充人员'}</div></div></div>
            `;

            const blanks = Array.from({ length: first.getDay() }, () => '<div class="duty-day is-empty"></div>');
            const cells = Array.from({ length: days }, (_, index) => {
                const current = new Date(year, month, index + 1);
                const key = dateKey(current);
                const record = list.find((item) => item.date === key) || {};
                return `
                    <div class="duty-day ${key === today ? 'is-today' : ''}">
                        <div class="duty-day-number">${index + 1}</div>
                        <select data-duty-date="${key}" aria-label="${key} 值班人员">
                            ${renderDayOptions(record.swpuUserId)}
                        </select>
                        <div class="duty-phone">${record.phone || ''}</div>
                    </div>
                `;
            });
            grid.innerHTML = blanks.concat(cells).join('');
            grid.querySelectorAll('[data-duty-date]').forEach((select) => {
                select.addEventListener('change', () => this.updateDuty(select.dataset.dutyDate, select.value));
            });
        },

        updateDuty(date, userId) {
            const user = getDutyUsers().find((item) => item.id === userId);
            if (!user) return;
            const list = getDutyList();
            const nextRecord = {
                id: `duty-${date}`,
                date,
                swpuUserId: user.id,
                swpuUserName: user.name,
                phone: user.phone || '',
                note: '负责当日机房巡检、告警跟进与交接班记录。'
            };
            const index = list.findIndex((item) => item.date === date);
            if (index >= 0) list.splice(index, 1, nextRecord);
            else list.push(nextRecord);
            saveDutyList(list);
            window.swpuAdminApp?.showNotification?.('值班排班已更新', 'success');
            this.render();
        }
    };

    window.adminDutyModule = module;
})(window);
