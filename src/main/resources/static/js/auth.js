class AuthApp {
    constructor() {
        window.SWPUData.seedData();
        this.bindLoginForm();
        this.bindRegisterForm();
    }

    bindLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const swpuUsername = document.getElementById('swpuUsername').value.trim();
            const password = document.getElementById('password').value;
            const swpuUsers = window.SWPUData.getSwpuUsers();
            const matched = swpuUsers.find((item) => item.swpuUsername === swpuUsername && item.password === password);
            if (!matched) {
                this.showMessage('用户名或密码错误', 'error');
                return;
            }
            if (matched.status !== 'active') {
                this.showMessage('当前账号未激活，请联系管理员', 'warning');
                return;
            }
            window.SWPUData.saveCurrentSwpuUser(matched);
            window.location.href = matched.role === 'admin' ? 'admin.html' : 'index.html';
        });
    }

    bindRegisterForm() {
        const form = document.getElementById('registerForm');
        if (!form) return;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
                this.showMessage('两次输入的密码不一致', 'error');
                return;
            }
            const swpuUsers = window.SWPUData.getSwpuUsers();
            const swpuUsername = document.getElementById('swpuUsername').value.trim();
            if (swpuUsers.some((item) => item.swpuUsername === swpuUsername)) {
                this.showMessage('用户名已存在', 'error');
                return;
            }
            const role = document.getElementById('role').value === 'viewer' ? 'engineer' : document.getElementById('role').value;
            const nextSwpuUser = {
                id: `swpuUser_${Date.now()}`,
                swpuUsername,
                password,
                name: document.getElementById('fullname').value.trim(),
                department: document.getElementById('department').value.trim(),
                employeeId: document.getElementById('employeeId').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                role,
                roles: role === 'duty' ? ['engineer', 'duty'] : [role],
                status: 'active'
            };
            swpuUsers.push(nextSwpuUser);
            window.SWPUData.persistNcicRecord('swpuUsers', swpuUsers);
            this.showMessage('注册成功，请登录系统', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1200);
        });
    }

    showMessage(text, type) {
        const message = document.createElement('div');
        message.className = `notification ${type || 'info'} show`;
        message.innerHTML = `<div class="notification-content"><i class="fas fa-circle-info"></i><span>${text}</span></div>`;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 2200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthApp();
});
