(function (window) {
  const API_BASE = window.API_BASE || 'http://localhost:8080';

  function getToken() {
    return localStorage.getItem('token') || '';
  }

  function clearAuthAndRedirect() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    const page = (window.location.pathname || '').toLowerCase();
    if (!page.endsWith('/login.html') && !page.endsWith('/register.html')) {
      window.location.href = 'login.html';
    }
  }

  async function request(path, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = getToken();
    if (token) {
      headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const isFormData = (typeof FormData !== 'undefined') && (opts.body instanceof FormData);
    if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body,
      credentials: 'include'
    });

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new Error(`接口返回非JSON: ${response.status}`);
    }

    if (!response.ok) {
      const msg = (json && (json.msg || json.message)) || `HTTP ${response.status}`;
      if (response.status === 401 && !path.startsWith('/api/auth/')) {
        clearAuthAndRedirect();
      }
      throw new Error(msg);
    }

    if (json && typeof json.code !== 'undefined' && json.code !== 200) {
      if (json.code === 401 && !path.startsWith('/api/auth/')) {
        clearAuthAndRedirect();
      }
      throw new Error(json.msg || '请求失败');
    }

    return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
  }

  window.ApiClient = {
    API_BASE,
    request,
    get: function (path) { return request(path); },
    postJson: function (path, data) {
      return request(path, { method: 'POST', body: JSON.stringify(data || {}) });
    },
    putJson: function (path, data) {
      return request(path, { method: 'PUT', body: JSON.stringify(data || {}) });
    },
    delete: function (path) {
      return request(path, { method: 'DELETE' });
    },
    logout: async function () {
      try {
        await request('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      } catch (error) {
        // Local cleanup should still happen when the backend is unreachable.
      } finally {
        clearAuthAndRedirect();
      }
    }
  };
})(window);
