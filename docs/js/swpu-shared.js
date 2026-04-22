(function () {
    const STORAGE_KEYS = {
        swpuUsers: 'swpuUsers',
        swpuUser: 'swpuUser',
        ncicRooms: 'ncicRooms',
        devices: 'devices',
        managementPages: 'managementPages',
        documents: 'documents',
        dailyPatrolRecords: 'dailyPatrolRecords',
        devicePatrolRecords: 'devicePatrolRecords',
        managementPatrolRecords: 'managementPatrolRecords',
        ncicDutyList: 'ncicDutyList',
        dutyLog: 'duty_log',
        knowledgeBase: 'knowledgeBase'
    };
    const DATABASE_KEYS = new Set([
        STORAGE_KEYS.swpuUsers,
        STORAGE_KEYS.ncicRooms,
        STORAGE_KEYS.devices,
        STORAGE_KEYS.managementPages,
        STORAGE_KEYS.documents,
        STORAGE_KEYS.dailyPatrolRecords,
        STORAGE_KEYS.devicePatrolRecords,
        STORAGE_KEYS.managementPatrolRecords,
        STORAGE_KEYS.ncicDutyList,
        STORAGE_KEYS.dutyLog
    ]);
    let databaseSnapshot = null;
    let hydratingFromDatabase = false;
    const hydratedDatabaseKeys = new Set();
    const COMMON_SEARCH_TERMS = [
        'ups', 'ibm', 'netapp', 'oracle', 'dg', 'rac', 'bladecenter',
        '故障', '告警', '异常', '处理', '巡检', '机房', '服务器', '存储', '网络',
        '电源', '电池', '旁路', '容量', '门禁', '空调', '温湿度', '数据库', '文档', '手册'
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSearchText(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.map(normalizeSearchText).join(' ');
        if (typeof value === 'object') return Object.values(value).map(normalizeSearchText).join(' ');
        return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function getSearchTerms(keyword) {
        const normalized = normalizeSearchText(keyword);
        if (!normalized) return [];
        const terms = new Set();
        normalized.split(/[\s,，;；|/]+/).filter(Boolean).forEach((item) => terms.add(item));
        (normalized.match(/[a-z0-9][a-z0-9._-]*/g) || []).forEach((item) => terms.add(item));
        COMMON_SEARCH_TERMS.forEach((item) => {
            const term = normalizeSearchText(item);
            if (normalized.includes(term)) terms.add(term);
        });
        if (terms.size > 1) terms.delete(normalized);
        return Array.from(terms);
    }

    function getSearchHaystack(item, extraFields = []) {
        const values = [item];
        extraFields.forEach((field) => {
            if (typeof field === 'function') {
                values.push(field(item));
            } else if (item && Object.prototype.hasOwnProperty.call(item, field)) {
                values.push(item[field]);
            }
        });
        return normalizeSearchText(values);
    }

    function scoreSearchMatch(item, keyword, extraFields = []) {
        const terms = getSearchTerms(keyword);
        if (!terms.length) return 1;
        const haystack = getSearchHaystack(item, extraFields);
        return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
    }

    function searchCollection(items, keyword, extraFields = []) {
        const terms = getSearchTerms(keyword);
        if (!terms.length) return items.slice();
        return items
            .map((item) => ({ item, score: scoreSearchMatch(item, keyword, extraFields) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.item);
    }

    function hasDatabaseData(value) {
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        return value && typeof value === 'object' && Object.keys(value).length > 0;
    }

    function requestJson(method, url, body, async) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, async !== false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(body === undefined ? null : JSON.stringify(body));
            if (async === false && xhr.status >= 200 && xhr.status < 300) {
                return JSON.parse(xhr.responseText);
            }
        } catch (error) {
            console.warn('数据库同步请求失败', error);
        }
        return null;
    }

    function loadDatabaseSnapshot() {
        const response = requestJson('GET', '/api/ncic/bootstrap', undefined, false);
        return response && response.code === 200 && response.data ? response.data : {};
    }

    function syncDatabaseRecord(key, value) {
        const targetKey = STORAGE_KEYS[key] || key;
        if (hydratingFromDatabase || !DATABASE_KEYS.has(targetKey)) {
            return;
        }
        if (window.fetch) {
            const payload = JSON.stringify(value);
            fetch(`/api/ncic/sync/${encodeURIComponent(targetKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: payload.length < 60000
            }).catch((error) => console.warn(`${targetKey} 同步到数据库失败`, error));
        } else {
            requestJson('POST', `/api/ncic/sync/${encodeURIComponent(targetKey)}`, value, true);
        }
    }

    function hydrateNcicRecord(key, value) {
        hydratingFromDatabase = true;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } finally {
            hydratingFromDatabase = false;
        }
    }

    function getTodayDate() {
        return new Date().toLocaleDateString('sv-SE');
    }

    function formatLocalDateTime(date = new Date()) {
        const pad = (value) => String(value).padStart(2, '0');
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join('-') + 'T' + [
            pad(date.getHours()),
            pad(date.getMinutes()),
            pad(date.getSeconds())
        ].join(':');
    }

    function formatDate(date) {
        return new Date(date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    function createId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function createDefaultSwpuUsers() {
        return [
            {
                id: 'swpuUser_1',
                swpuUsername: 'admin',
                password: 'password123',
                name: '夏秀平',
                phone: '19881805106',
                email: 'admin@swpu.edu.cn',
                department: '网络与信息化中心',
                employeeId: 'SWPU0001',
                role: 'admin',
                roles: ['admin'],
                status: 'active'
            },
            {
                id: 'swpuUser_2',
                swpuUsername: 'engineer',
                password: 'password123',
                name: '陈睿曦',
                phone: '13398289659',
                email: 'engineer@swpu.edu.cn',
                department: '运维部',
                employeeId: 'SWPU0101',
                role: 'engineer',
                roles: ['engineer', 'duty'],
                status: 'active'
            },
            {
                id: 'swpuUser_3',
                swpuUsername: 'duty',
                password: 'password123',
                name: '张悦',
                phone: '18113190179',
                email: 'duty@swpu.edu.cn',
                department: '值班组',
                employeeId: 'SWPU0102',
                role: 'duty',
                roles: ['engineer', 'duty'],
                status: 'active'
            }
        ];
    }

    function createDefaultNcicRooms() {
        // NCIC = 网信中心
        return [
            {
                id: 'ncicRoom-1',
                name: '明理楼 8210',
                type: '机房',
                location: '明理楼 8 楼',
                status: 'unchecked',
                description: '<p>检查 ORACLE RAC 节点状态、磁盘余量与告警日志。</p>',
                lastInspection: null,
                isCore: true
            },
            {
                id: 'ncicRoom-2',
                name: '明理楼 8211',
                type: '机房',
                location: '明理楼 8 楼',
                status: 'unchecked',
                description: '<p>检查 NetApp 存储状态与控制器健康度。</p>',
                lastInspection: null,
                isCore: true
            },
            {
                id: 'ncicRoom-3',
                name: '明理楼 8108',
                type: '机房',
                location: '明理楼 8 楼',
                status: 'unchecked',
                description: '<p>检查空调温湿度、机柜门禁与告警灯状态。</p>',
                lastInspection: null,
                isCore: true
            },
            {
                id: 'ncicRoom-4',
                name: '明理楼 UPS-112',
                type: 'UPS机房',
                location: '明理楼 1 楼',
                status: 'unchecked',
                description: '<p>检查 UPS 主机负载率、电池组电压和告警面板。</p>',
                lastInspection: null,
                isCore: true
            },
            {
                id: 'ncicRoom-5',
                name: '明理楼 UPS-110',
                type: 'UPS机房',
                location: '明理楼 1 楼',
                status: 'unchecked',
                description: '<p>检查旁路状态、蓄电池温度和漏液情况。</p>',
                lastInspection: null,
                isCore: true
            }
        ];
    }

    function createDefaultDevices() {
        return [
            { id: 'device_1', name: 'IBM 刀片服务器', model: 'BladeCenter H', type: '服务器', ncicRoomId: 'ncicRoom-1', ncicRoomName: '明理楼 8210', status: 'normal', owner: '网络与信息化中心', inspectionCount: 48, faultCount: 1, updatedAt: '2026-04-10' },
            { id: 'device_2', name: 'NetApp 存储', model: 'FAS2750', type: '存储', ncicRoomId: 'ncicRoom-2', ncicRoomName: '明理楼 8211', status: 'normal', owner: '网络与信息化中心', inspectionCount: 52, faultCount: 2, updatedAt: '2026-04-10' },
            { id: 'device_3', name: 'UPS 主机 A', model: 'Eaton 93PR', type: 'UPS', ncicRoomId: 'ncicRoom-4', ncicRoomName: '明理楼 UPS-112', status: 'warning', owner: '运维部', inspectionCount: 40, faultCount: 5, updatedAt: '2026-04-11' },
            { id: 'device_4', name: '核心交换机 01', model: 'S12700E', type: '交换机', ncicRoomId: 'ncicRoom-1', ncicRoomName: '明理楼 8210', status: 'normal', owner: '网络与信息化中心', inspectionCount: 60, faultCount: 1, updatedAt: '2026-04-10' },
            { id: 'device_5', name: '精密空调 A', model: 'Vertiv PEX4', type: '空调', ncicRoomId: 'ncicRoom-3', ncicRoomName: '明理楼 8108', status: 'warning', owner: '后勤保障部', inspectionCount: 35, faultCount: 4, updatedAt: '2026-04-11' },
            { id: 'device_6', name: '温湿度传感器 01', model: 'THS-200', type: '传感器', ncicRoomId: 'ncicRoom-3', ncicRoomName: '明理楼 8108', status: 'normal', owner: '网络与信息化中心', inspectionCount: 32, faultCount: 1, updatedAt: '2026-04-09' },
            { id: 'device_7', name: '门禁控制器', model: 'ACS-900', type: '安防', ncicRoomId: 'ncicRoom-2', ncicRoomName: '明理楼 8211', status: 'error', owner: '保卫处', inspectionCount: 28, faultCount: 6, updatedAt: '2026-04-11' },
            { id: 'device_8', name: '漏水检测主机', model: 'LD-800', type: '监测仪', ncicRoomId: 'ncicRoom-5', ncicRoomName: '明理楼 UPS-110', status: 'normal', owner: '运维部', inspectionCount: 30, faultCount: 0, updatedAt: '2026-04-08' }
        ];
    }

    function createDefaultManagementPages() {
        return [
            { id: 'mgmt_1', name: '高密存储管理页面', type: '存储管理', system: '存储平台', status: 'unchecked', owner: '网络与信息化中心', url: 'https://storage.swpu.edu.cn', description: '<p>检查管理平台登录状态、容量告警与复制任务。</p>' },
            { id: 'mgmt_2', name: 'ORACLE RAC', type: '数据库', system: '数据库集群', status: 'unchecked', owner: '数据库组', url: 'https://rac.swpu.edu.cn', description: '<p>检查实例状态、监听服务和磁盘组使用率。</p>' },
            { id: 'mgmt_3', name: 'ORACLE DG', type: '数据库', system: '灾备系统', status: 'unchecked', owner: '数据库组', url: 'https://dg.swpu.edu.cn', description: '<p>检查主备同步延迟和日志应用状态。</p>' },
            { id: 'mgmt_4', name: '站群系统', type: '业务系统', system: '站群', status: 'unchecked', owner: '应用平台主管组', url: 'https://site.swpu.edu.cn', description: '<p>检查站点发布、静态化任务和证书有效期。</p>' },
            { id: 'mgmt_5', name: '云平台', type: '虚拟化', system: '云资源池', status: 'unchecked', owner: '虚拟化平台主管组', url: 'https://cloud.swpu.edu.cn', description: '<p>检查宿主机告警、集群容量和虚机运行状态。</p>' },
            { id: 'mgmt_6', name: '数据库审计', type: '安全平台', system: '审计平台', status: 'unchecked', owner: '网络安全组', url: 'https://audit.swpu.edu.cn', description: '<p>检查告警策略、日志采集与报表生成状态。</p>' }
        ];
    }

    function normalizeSwpuUserRole(role) {
        return role === 'viewer' ? 'engineer' : (role || 'engineer');
    }

    function normalizeSwpuUser(swpuUser) {
        const role = normalizeSwpuUserRole(swpuUser.role);
        let roles = Array.isArray(swpuUser.roles) ? swpuUser.roles.filter((item) => item && item !== 'viewer') : [];
        if (role === 'admin') {
            roles = ['admin'];
        } else if (role === 'duty') {
            roles = Array.from(new Set(['engineer', 'duty', ...roles]));
        } else {
            roles = Array.from(new Set(['engineer', ...roles.filter((item) => item !== 'duty' && item !== 'admin')]));
        }
        return {
            ...swpuUser,
            role,
            roles
        };
    }

    function normalizeSwpuUsers(swpuUsers) {
        return (swpuUsers || []).map(normalizeSwpuUser);
    }

    function normalizeDevice(device) {
        return {
            ...device,
            model: device.model || '待补充',
            owner: device.owner || '网络与信息化中心',
            inspectionCount: Number(device.inspectionCount) || 0,
            faultCount: Number(device.faultCount) || 0,
            updatedAt: device.updatedAt || getTodayDate()
        };
    }

    function normalizeManagementPage(page) {
        return {
            ...page,
            owner: page.owner || '网络与信息化中心',
            system: page.system || page.type || '管理平台',
            url: page.url || '#',
            description: page.description || '<p>暂无巡查说明。</p>',
            status: page.status || 'unchecked'
        };
    }

    function mergeDefaults(existingList, defaultList) {
        const existingMap = new Map((existingList || []).map((item) => [item.id, item]));
        const merged = defaultList.map((item) => existingMap.get(item.id) ? { ...item, ...existingMap.get(item.id) } : item);
        (existingList || []).forEach((item) => {
            if (!merged.some((mergedItem) => mergedItem.id === item.id)) {
                merged.push(item);
            }
        });
        return merged;
    }

    function createDefaultDocuments() {
        return [
            {
                id: 'doc_example_inspection',
                title: '巡检提交操作示例.html',
                url: 'docs/inspection-submit-example.html',
                category: '操作示例',
                size: '12 KB',
                updatedAt: '2026-04-19',
                description: '示例文档，演示如何填写巡检状态、备注、上传截图并提交记录。'
            },
            {
                id: 'doc_1',
                title: 'IBM 刀片服务器维护手册.pdf',
                url: 'docs/IBM-BladeCenter-H-maintenance.pdf',
                category: '服务器',
                size: '2.5 MB',
                updatedAt: '2026-04-01',
                description: '包含电源模块、风扇、管理口、故障灯判定与常见重启步骤，适用于 BladeCenter H 日常维护。'
            },
            {
                id: 'doc_2',
                title: 'UPS 日常巡检表.xlsx',
                url: 'docs/UPS-daily-inspection.xlsx',
                category: 'UPS',
                size: '0.8 MB',
                updatedAt: '2026-04-03',
                description: '记录 UPS 输入输出、电池组温度、旁路状态、负载率与告警灯状态的标准巡检模板。'
            },
            {
                id: 'doc_3',
                title: 'NetApp 存储巡检操作指引.docx',
                url: 'docs/NetApp-storage-inspection.docx',
                category: '存储',
                size: '1.2 MB',
                updatedAt: '2026-04-06',
                description: '涵盖控制器健康状态、磁盘池告警、快照保留策略、复制链路与容量阈值检查项。'
            },
            {
                id: 'doc_4',
                title: '数据库审计平台异常处置清单.pdf',
                url: 'docs/database-audit-troubleshooting.pdf',
                category: '安全平台',
                size: '1.6 MB',
                updatedAt: '2026-04-07',
                description: '整理数据库审计平台登录失败、日志中断、告警积压等异常的排查步骤与恢复命令。'
            },
            {
                id: 'doc_5',
                title: '管理页面巡查标准项.xlsx',
                url: 'docs/management-page-checklist.xlsx',
                category: '管理页面',
                size: '0.9 MB',
                updatedAt: '2026-04-09',
                description: '用于站群系统、云平台、ORACLE RAC/DG、高密存储管理页面的可用性、容量和告警巡查。'
            }
        ];
    }

    function createDefaultKnowledgeBase() {
        return [
            {
                id: 'kb-1',
                title: 'NetApp 存储巡检要点',
                category: '巡检指引',
                solution: '登录 ONTAP 后优先检查控制器状态、聚合容量、磁盘池健康度和 Snapshot 占比；若发现聚合空间低于 15%，需立即标记为警告并通知存储平台主管组。',
                tags: ['存储', 'NetApp', '容量']
            },
            {
                id: 'kb-2',
                title: 'UPS 异常处理流程',
                category: '故障处理',
                solution: '先查看是否处于旁路模式，再核对输入输出电压、电池温度与负载率；若同时出现蜂鸣器持续告警和负载突增，需立刻通知值班工程师并安排现场复核。',
                tags: ['UPS', '电源', '告警']
            },
            {
                id: 'kb-3',
                title: '门禁控制器离线排查',
                category: '故障处理',
                solution: '确认控制器供电正常后，检查交换机端口灯、管理 VLAN 与控制器心跳；如连续三次 ping 不通，可重启控制器服务并在 10 分钟后复测。',
                tags: ['门禁', '安防', '网络']
            },
            {
                id: 'kb-4',
                title: 'ORACLE DG 同步延迟检查',
                category: '数据库',
                solution: '在主库和备库分别检查归档日志生成与应用情况，重点关注 transport lag 和 apply lag；若延迟超过 15 分钟，应归类为异常并附带日志截图。',
                tags: ['Oracle', 'DG', '数据库']
            },
            {
                id: 'kb-5',
                title: '精密空调高温告警处置',
                category: '环境监控',
                solution: '先确认回风温度和送风温度是否超阈值，再检查过滤网堵塞、压缩机状态与冷凝水排放；若机房温度持续上升，需同步检查相邻机柜负载情况。',
                tags: ['空调', '温湿度', '机房环境']
            }
        ];
    }

    function createDefaultDutyList() {
        const dutyUsers = createDefaultSwpuUsers().filter((item) => item.roles.includes('duty'));
        const base = new Date();
        base.setDate(1);
        const list = [];
        const currentMonth = base.getMonth();
        let index = 0;
        while (base.getMonth() === currentMonth) {
            const dutyUser = dutyUsers[index % dutyUsers.length];
            list.push({
                id: `duty-${base.toISOString().slice(0, 10)}`,
                date: base.toLocaleDateString('sv-SE'),
                swpuUserId: dutyUser.id,
                swpuUserName: dutyUser.name,
                phone: dutyUser.phone,
                note: '负责当日机房巡检、告警跟进与交接班记录。'
            });
            base.setDate(base.getDate() + 1);
            index += 1;
        }
        return list;
    }

    function dispatchDataChanged(key, value) {
        window.dispatchEvent(new CustomEvent('swpu:data-changed', { detail: { key, value: clone(value) } }));
    }

    function fetchSwpuData(key, fallbackValue) {
        const targetKey = STORAGE_KEYS[key] || key;
        const raw = localStorage.getItem(targetKey);
        if (raw) {
            try {
                hydratedDatabaseKeys.add(targetKey);
                return JSON.parse(raw);
            } catch (error) {
                console.warn(`解析 ${targetKey} 失败`, error);
            }
        }
        if (!hydratedDatabaseKeys.has(targetKey) && databaseSnapshot && Object.prototype.hasOwnProperty.call(databaseSnapshot, targetKey) && hasDatabaseData(databaseSnapshot[targetKey])) {
            const databaseValue = databaseSnapshot[targetKey];
            hydrateNcicRecord(targetKey, databaseValue);
            hydratedDatabaseKeys.add(targetKey);
            return clone(databaseValue);
        }

        const resolvedFallback = typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
        if (resolvedFallback !== undefined) {
            persistNcicRecord(targetKey, resolvedFallback);
            return clone(resolvedFallback);
        }
        return null;
    }

    function persistNcicRecord(key, value) {
        const targetKey = STORAGE_KEYS[key] || key;
        localStorage.setItem(targetKey, JSON.stringify(value));
        syncDatabaseRecord(targetKey, value);
        dispatchDataChanged(targetKey, value);
        return clone(value);
    }

    function getLatestTodayRecord(recordList, today) {
        return (recordList || [])
            .filter((item) => item.date === today)
            .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
            .pop();
    }

    function seedData() {
        const swpuUsers = normalizeSwpuUsers(fetchSwpuData('swpuUsers', createDefaultSwpuUsers));
        const ncicRooms = mergeDefaults(fetchSwpuData('ncicRooms', createDefaultNcicRooms), createDefaultNcicRooms());
        const rawDevices = fetchSwpuData('devices', createDefaultDevices);
        const rawManagementPages = fetchSwpuData('managementPages', createDefaultManagementPages);
        const deviceCatalogMigrated = localStorage.getItem('devicesCatalogSeedV2') === 'done';
        const devices = (deviceCatalogMigrated ? rawDevices : mergeDefaults(rawDevices, createDefaultDevices())).map(normalizeDevice);
        const managementPages = mergeDefaults(rawManagementPages, createDefaultManagementPages()).map(normalizeManagementPage);
        persistNcicRecord('swpuUsers', swpuUsers);
        persistNcicRecord('ncicRooms', ncicRooms);
        persistNcicRecord('devices', devices);
        persistNcicRecord('managementPages', managementPages);
        localStorage.setItem('devicesCatalogSeedV2', 'done');
        fetchSwpuData('documents', createDefaultDocuments);
        fetchSwpuData('dailyPatrolRecords', () => ({}));
        fetchSwpuData('devicePatrolRecords', () => ({}));
        fetchSwpuData('managementPatrolRecords', () => ({}));
        fetchSwpuData('ncicDutyList', createDefaultDutyList);
        fetchSwpuData('dutyLog', () => []);
        fetchSwpuData('knowledgeBase', createDefaultKnowledgeBase);
    }

    function getCurrentSwpuUser() {
        const swpuUser = fetchSwpuData('swpuUser');
        if (!swpuUser) {
            return null;
        }
        const normalizedSwpuUser = normalizeSwpuUser(swpuUser);
        if (JSON.stringify(swpuUser) !== JSON.stringify(normalizedSwpuUser)) {
            persistNcicRecord('swpuUser', normalizedSwpuUser);
        }
        return normalizedSwpuUser;
    }

    function saveCurrentSwpuUser(swpuUser) {
        persistNcicRecord('swpuUser', normalizeSwpuUser(swpuUser));
    }

    function clearCurrentSwpuUser() {
        const token = localStorage.getItem('token') || '';
        if (token && window.fetch) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
                keepalive: true
            }).catch(() => {});
        }
        localStorage.removeItem(STORAGE_KEYS.swpuUser);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }

    function getSwpuUsers() {
        return normalizeSwpuUsers(fetchSwpuData('swpuUsers', createDefaultSwpuUsers));
    }

    function saveSwpuUsers(swpuUsers) {
        return persistNcicRecord('swpuUsers', normalizeSwpuUsers(swpuUsers));
    }

    function getNcicRooms() {
        return fetchSwpuData('ncicRooms', createDefaultNcicRooms);
    }

    function saveNcicRooms(ncicRooms) {
        return persistNcicRecord('ncicRooms', ncicRooms);
    }

    function getDevices() {
        return fetchSwpuData('devices', createDefaultDevices).map(normalizeDevice);
    }

    function saveDevices(devices) {
        return persistNcicRecord('devices', devices.map(normalizeDevice));
    }

    function getManagementPages() {
        return fetchSwpuData('managementPages', createDefaultManagementPages).map(normalizeManagementPage);
    }

    function saveManagementPages(managementPages) {
        return persistNcicRecord('managementPages', managementPages.map(normalizeManagementPage));
    }

    function normalizeDocument(document) {
        const defaultsById = createDefaultDocuments().reduce((result, item) => {
            result[item.id] = item;
            return result;
        }, {});
        const fallback = defaultsById[document.id] || {};
        const title = String(document.title || document.name || fallback.title || '').trim();
        const url = String(document.url || document.link || document.href || fallback.url || '').trim()
            || (/^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/)/i.test(title) ? title : '');
        return {
            ...fallback,
            ...document,
            title: title || url || '设备文档',
            url
        };
    }

    function getDocuments() {
        return mergeDefaults(fetchSwpuData('documents', createDefaultDocuments), createDefaultDocuments()).map(normalizeDocument);
    }

    function saveDocuments(documents) {
        return persistNcicRecord('documents', documents.map(normalizeDocument));
    }

    function getKnowledgeBase() {
        return fetchSwpuData('knowledgeBase', createDefaultKnowledgeBase);
    }

    function saveKnowledgeBase(knowledgeBase) {
        return persistNcicRecord('knowledgeBase', knowledgeBase);
    }

    function getAllDailyPatrolRecords() {
        return fetchSwpuData('dailyPatrolRecords', () => ({}));
    }

    function getAllDevicePatrolRecords() {
        return fetchSwpuData('devicePatrolRecords', () => ({}));
    }

    function getAllManagementPatrolRecords() {
        return fetchSwpuData('managementPatrolRecords', () => ({}));
    }

    function normalizeImages(images) {
        if (Array.isArray(images)) {
            return images;
        }
        if (!images) {
            return [];
        }
        if (typeof images === 'string') {
            try {
                const parsed = JSON.parse(images);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return images ? [images] : [];
            }
        }
        return [];
    }

    function normalizePatrolRecord(record) {
        return {
            ...record,
            timestamp: record.timestamp || formatLocalDateTime(),
            date: record.date || String(record.timestamp || formatLocalDateTime()).slice(0, 10),
            richText: record.richText || record.richContent || '',
            richContent: record.richContent || record.richText || '',
            images: normalizeImages(record.images)
        };
    }

    function getDailyPatrolList() {
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        return Object.entries(dailyPatrolRecords).flatMap(([ncicRoomId, records]) => {
            const ncicRoom = getNcicRooms().find((item) => item.id === ncicRoomId);
            return (records || []).map((dailyPatrolRecord) => ({
                ...normalizePatrolRecord(dailyPatrolRecord),
                ncicRoomId,
                ncicRoomName: ncicRoom ? ncicRoom.name : '未知机房'
            }));
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function getDevicePatrolList() {
        const patrolRecords = getAllDevicePatrolRecords();
        return Object.entries(patrolRecords).flatMap(([deviceId, records]) => {
            const device = getDevices().find((item) => item.id === deviceId);
            return (records || []).map((record) => ({
                ...normalizePatrolRecord(record),
                deviceId,
                deviceName: device ? device.name : '未知设备',
                ncicRoomName: device ? device.ncicRoomName : '未知机房',
                targetType: 'device'
            }));
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function getManagementPatrolList() {
        const patrolRecords = getAllManagementPatrolRecords();
        return Object.entries(patrolRecords).flatMap(([managementId, records]) => {
            const page = getManagementPages().find((item) => item.id === managementId);
            return (records || []).map((record) => ({
                ...normalizePatrolRecord(record),
                managementId,
                managementName: page ? page.name : '未知管理页面',
                system: page ? page.system : '未知系统',
                targetType: 'management'
            }));
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function updateNcicRoomStatusFromRecords() {
        const ncicRooms = getNcicRooms();
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        const today = getTodayDate();
        const updatedNcicRooms = ncicRooms.map((ncicRoom) => {
            const latestRecord = getLatestTodayRecord(dailyPatrolRecords[ncicRoom.id], today);
            return {
                ...ncicRoom,
                status: latestRecord ? latestRecord.status : 'unchecked',
                lastInspection: latestRecord ? latestRecord.timestamp : ncicRoom.lastInspection
            };
        });
        if (JSON.stringify(updatedNcicRooms) !== JSON.stringify(ncicRooms)) {
            saveNcicRooms(updatedNcicRooms);
        }
        return updatedNcicRooms;
    }

    function updateDeviceStatusFromRecords() {
        const devices = getDevices();
        const patrolRecords = getAllDevicePatrolRecords();
        const today = getTodayDate();
        const updatedDevices = devices.map((device) => {
            const recordList = patrolRecords[device.id] || [];
            const latestRecord = getLatestTodayRecord(recordList, today);
            return {
                ...device,
                status: latestRecord ? latestRecord.status : 'unchecked',
                updatedAt: latestRecord ? latestRecord.timestamp.slice(0, 10) : device.updatedAt,
                inspectionCount: recordList.length ? recordList.length : device.inspectionCount,
                faultCount: recordList.length ? recordList.filter((item) => item.status === 'warning' || item.status === 'error').length : device.faultCount
            };
        });
        if (JSON.stringify(updatedDevices) !== JSON.stringify(devices)) {
            saveDevices(updatedDevices);
        }
        return updatedDevices;
    }

    function updateManagementStatusFromRecords() {
        const managementPages = getManagementPages();
        const patrolRecords = getAllManagementPatrolRecords();
        const today = getTodayDate();
        const updatedPages = managementPages.map((page) => {
            const latestRecord = getLatestTodayRecord(patrolRecords[page.id], today);
            return {
                ...page,
                status: latestRecord ? latestRecord.status : 'unchecked',
                lastInspection: latestRecord ? latestRecord.timestamp : page.lastInspection || null
            };
        });
        if (JSON.stringify(updatedPages) !== JSON.stringify(managementPages)) {
            saveManagementPages(updatedPages);
        }
        return updatedPages;
    }

    function upsertDailyPatrolRecord(ncicRoomId, dailyPatrolRecord) {
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        const recordList = dailyPatrolRecords[ncicRoomId] || [];
        dailyPatrolRecord = normalizePatrolRecord(dailyPatrolRecord);
        const index = recordList.findIndex((item) => item.id === dailyPatrolRecord.id);
        if (index >= 0) {
            recordList.splice(index, 1, dailyPatrolRecord);
        } else {
            recordList.push(dailyPatrolRecord);
        }
        dailyPatrolRecords[ncicRoomId] = recordList;
        persistNcicRecord('dailyPatrolRecords', dailyPatrolRecords);
        updateNcicRoomStatusFromRecords();
        window.dispatchEvent(new CustomEvent('patrolUpdated', { detail: { ncicRoomId, dailyPatrolRecord } }));
        return dailyPatrolRecord;
    }

    function deleteDailyPatrolRecord(ncicRoomId, dailyPatrolRecordId) {
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        const recordList = (dailyPatrolRecords[ncicRoomId] || []).filter((item) => item.id !== dailyPatrolRecordId);
        dailyPatrolRecords[ncicRoomId] = recordList;
        persistNcicRecord('dailyPatrolRecords', dailyPatrolRecords);
        updateNcicRoomStatusFromRecords();
        window.dispatchEvent(new CustomEvent('patrolUpdated', { detail: { ncicRoomId, dailyPatrolRecordId, deleted: true } }));
    }

    function upsertDevicePatrolRecord(deviceId, record) {
        const patrolRecords = getAllDevicePatrolRecords();
        const recordList = patrolRecords[deviceId] || [];
        record = normalizePatrolRecord(record);
        const index = recordList.findIndex((item) => item.id === record.id);
        if (index >= 0) {
            recordList.splice(index, 1, record);
        } else {
            recordList.push(record);
        }
        patrolRecords[deviceId] = recordList;
        persistNcicRecord('devicePatrolRecords', patrolRecords);
        updateDeviceStatusFromRecords();
        window.dispatchEvent(new CustomEvent('patrolUpdated', { detail: { deviceId, record, targetType: 'device' } }));
        return record;
    }

    function upsertManagementPatrolRecord(managementId, record) {
        const patrolRecords = getAllManagementPatrolRecords();
        const recordList = patrolRecords[managementId] || [];
        record = normalizePatrolRecord(record);
        const index = recordList.findIndex((item) => item.id === record.id);
        if (index >= 0) {
            recordList.splice(index, 1, record);
        } else {
            recordList.push(record);
        }
        patrolRecords[managementId] = recordList;
        persistNcicRecord('managementPatrolRecords', patrolRecords);
        updateManagementStatusFromRecords();
        window.dispatchEvent(new CustomEvent('patrolUpdated', { detail: { managementId, record, targetType: 'management' } }));
        return record;
    }

    function getPendingCountByDate(date) {
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        return getNcicRooms().filter((ncicRoom) => {
            const hasRecord = (dailyPatrolRecords[ncicRoom.id] || []).some((item) => item.date === date);
            return !hasRecord;
        }).length;
    }

    function getTodayDutyRecord() {
        const today = getTodayDate();
        const dutyList = fetchSwpuData('ncicDutyList', createDefaultDutyList);
        const swpuUsers = getSwpuUsers();
        let dutyRecord = dutyList.find((item) => item.date === today);
        if (!dutyRecord) {
            const dutyUsers = swpuUsers.filter((item) => (item.roles || []).includes('duty') || item.role === 'duty');
            const availableUsers = dutyUsers.length ? dutyUsers : swpuUsers.filter((item) => item.status !== 'inactive');
            if (!availableUsers.length) {
                return null;
            }
            const dayIndex = Math.max(0, new Date(`${today}T00:00:00`).getDate() - 1);
            const dutyUser = availableUsers[dayIndex % availableUsers.length];
            dutyRecord = {
                id: `duty-${today}`,
                date: today,
                swpuUserId: dutyUser.id,
                swpuUserName: dutyUser.name,
                phone: dutyUser.phone,
                note: '负责当日机房巡检、告警跟进与交接班记录。'
            };
            dutyList.push(dutyRecord);
            persistNcicRecord('ncicDutyList', dutyList);
        }
        const swpuUser = swpuUsers.find((item) => item.id === dutyRecord.swpuUserId) || null;
        return {
            ...dutyRecord,
            swpuUser,
            pendingCount: getPendingCountByDate(today)
        };
    }

    function createDailyPatrolTrend(days) {
        const ncicRoomCount = getNcicRooms().length || 1;
        const dailyPatrolRecords = getAllDailyPatrolRecords();
        return Array.from({ length: days }, (_, offset) => {
            const current = new Date();
            current.setDate(current.getDate() - (days - offset - 1));
            const date = current.toLocaleDateString('sv-SE');
            const completed = Object.values(dailyPatrolRecords).filter((records) => (records || []).some((item) => item.date === date)).length;
            const completedRate = Math.round((completed / ncicRoomCount) * 100);
            return {
                date,
                completed: completedRate,
                overdue: Math.max(0, 100 - completedRate)
            };
        });
    }

    function createFaultRateReport(days = 30) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));
        const roomFaultRates = getNcicRooms().map((ncicRoom) => {
            const records = (getAllDailyPatrolRecords()[ncicRoom.id] || []).filter((item) => new Date(item.timestamp) >= start);
            const inspectionCount = records.length;
            const faultCount = records.filter((item) => item.status === 'warning' || item.status === 'error').length;
            return {
                id: ncicRoom.id,
                name: ncicRoom.name,
                inspectionCount,
                faultCount,
                faultRate: inspectionCount ? Math.round((faultCount / inspectionCount) * 100) : 0
            };
        }).sort((a, b) => b.faultRate - a.faultRate || b.faultCount - a.faultCount);

        const deviceFaultRates = getDevices().map((device) => ({
            id: device.id,
            name: device.name,
            ncicRoomName: device.ncicRoomName,
            inspectionCount: Number(device.inspectionCount) || 0,
            faultCount: Number(device.faultCount) || 0,
            faultRate: (Number(device.inspectionCount) || 0) ? Math.round(((Number(device.faultCount) || 0) / Number(device.inspectionCount)) * 100) : 0,
            status: device.status
        })).sort((a, b) => b.faultRate - a.faultRate || b.faultCount - a.faultCount);

        return {
            roomFaultRates,
            deviceFaultRates
        };
    }

    function getUnifiedRecentAlerts(limit) {
        const roomAlerts = getRecentAlerts(limit).map((item) => ({
            ...item,
            title: item.ncicRoomName,
            subtitle: '机房巡查',
            targetType: 'room'
        }));
        const deviceAlerts = getDevicePatrolList()
            .filter((item) => item.status === 'warning' || item.status === 'error')
            .map((item) => ({
                ...item,
                title: item.deviceName,
                subtitle: `硬件设备 · ${item.ncicRoomName}`,
                targetType: 'device'
            }));
        const managementAlerts = getManagementPatrolList()
            .filter((item) => item.status === 'warning' || item.status === 'error')
            .map((item) => ({
                ...item,
                title: item.managementName,
                subtitle: `管理页面 · ${item.system}`,
                targetType: 'management'
            }));
        return [...roomAlerts, ...deviceAlerts, ...managementAlerts]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    function getRecentAlerts(limit) {
        return getDailyPatrolList().filter((item) => item.status === 'warning' || item.status === 'error').slice(0, limit);
    }

    databaseSnapshot = loadDatabaseSnapshot();
    seedData();

    window.SWPUData = {
        STORAGE_KEYS,
        clone,
        createId,
        getTodayDate,
        formatLocalDateTime,
        formatDate,
        fetchSwpuData,
        persistNcicRecord,
        normalizeSearchText,
        getSearchTerms,
        scoreSearchMatch,
        searchCollection,
        seedData,
        getCurrentSwpuUser,
        saveCurrentSwpuUser,
        clearCurrentSwpuUser,
        getSwpuUsers,
        saveSwpuUsers,
        getNcicRooms,
        saveNcicRooms,
        getDevices,
        saveDevices,
        getManagementPages,
        saveManagementPages,
        getDocuments,
        saveDocuments,
        getKnowledgeBase,
        saveKnowledgeBase,
        getAllDailyPatrolRecords,
        getAllDevicePatrolRecords,
        getAllManagementPatrolRecords,
        getDailyPatrolList,
        getDevicePatrolList,
        getManagementPatrolList,
        upsertDailyPatrolRecord,
        deleteDailyPatrolRecord,
        upsertDevicePatrolRecord,
        upsertManagementPatrolRecord,
        getTodayDutyRecord,
        getPendingCountByDate,
        createDailyPatrolTrend,
        createFaultRateReport,
        getRecentAlerts,
        getUnifiedRecentAlerts,
        updateDeviceStatusFromRecords,
        updateManagementStatusFromRecords,
        updateNcicRoomStatusFromRecords
    };
})();
