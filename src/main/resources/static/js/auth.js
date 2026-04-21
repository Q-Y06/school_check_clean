class AuthApp {
    constructor() {
        window.SWPUData.seedData();
        this.bindLoginForm();
        this.bindRegisterForm();
    }

    bindLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const swpuUsername = document.getElementById('swpuUsername').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
            }
            try {
                const loginUser = await window.ApiClient.postJson('/api/auth/login', {
                    username: swpuUsername,
                    password
                });
                const currentUser = this.toSwpuUser(loginUser);
                localStorage.setItem('token', loginUser.token);
                localStorage.setItem('user', JSON.stringify(loginUser));
                window.SWPUData.saveCurrentSwpuUser(currentUser);
                window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'index.html';
            } catch (error) {
                this.showMessage(error.message || '登录失败，请稍后重试', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
                }
            }
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

    toSwpuUser(loginUser) {
        const role = loginUser.role || 'engineer';
        return {
            id: loginUser.id || `swpuUser_${loginUser.userId}`,
            userId: loginUser.userId,
            swpuUsername: loginUser.swpuUsername || loginUser.username,
            username: loginUser.username,
            name: loginUser.name || loginUser.fullName || loginUser.username,
            fullName: loginUser.fullName || loginUser.name || loginUser.username,
            phone: loginUser.phone || '',
            email: loginUser.email || '',
            department: loginUser.department || '',
            employeeId: loginUser.employeeId || '',
            role,
            roles: role === 'admin' ? ['admin'] : ['engineer'],
            status: Number(loginUser.status) === 1 ? 'active' : 'inactive'
        };
    }

    showMessage(text, type) {
        const message = document.createElement('div');
        message.className = `notification ${type || 'info'} show`;
        message.innerHTML = `<div class="notification-content"><i class="fas fa-circle-info"></i><span>${text}</span></div>`;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 3200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthApp();
});
