(function (window) {
  const API_BASE = window.API_BASE || window.location.origin || '';
  const HEARTBEAT_INTERVAL_MS = 60000;
  const NAVIGATION_INTENT_KEY = 'schoolCheckNavigationIntentAt';
  const NAVIGATION_INTENT_TTL_MS = 3000;
  let heartbeatTimer = null;
  let listenersBound = false;
  let keepaliveLogoutSent = false;

  function getToken() {
    return localStorage.getItem('token') || '';
  }

  function getPagePath() {
    return (window.location.pathname || '').toLowerCase();
  }

  function isAuthPage(page = getPagePath()) {
    return page.endsWith('/login.html') || page.endsWith('/register.html');
  }

  function getCurrentUserKey() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.username || user.userId || user.id || '';
    } catch (error) {
      return '';
    }
  }

  function clearActiveTabForCurrentUser() {
    const userKey = getCurrentUserKey();
    if (!userKey) {
      return;
    }
    localStorage.removeItem('schoolCheckActiveTab:' + userKey);
  }

  function clearNavigationIntent() {
    try {
      sessionStorage.removeItem(NAVIGATION_INTENT_KEY);
    } catch (error) {}
  }

  function clearAuthAndRedirect() {
    clearActiveTabForCurrentUser();
    clearNavigationIntent();
    localStorage.removeItem('swpuUser');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!isAuthPage()) {
      window.location.href = 'login.html';
    }
  }

  function navigate(url, options) {
    const opts = options || {};
    if (!url) {
      return;
    }
    markNavigationIntent();
    if (opts.replace) {
      window.location.replace(url);
      return;
    }
    window.location.href = url;
  }

  function goBack(fallbackUrl) {
    markNavigationIntent();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (fallbackUrl) {
      navigate(fallbackUrl);
    }
  }

  function getTabId() {
    let tabId = sessionStorage.getItem('schoolCheckTabId');
    if (!tabId) {
      tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('schoolCheckTabId', tabId);
    }
    return tabId;
  }

  function redirectDuplicateTab() {
    sessionStorage.setItem('schoolCheckDuplicateTab', '1');
    if (!isAuthPage()) {
      window.location.href = 'login.html?reason=duplicate';
    }
  }

  function isAuxiliaryPage(page) {
    return ['/document-viewer.html', '/report-detail.html'].some((suffix) => page.endsWith(suffix));
  }

  function markNavigationIntent() {
    try {
      sessionStorage.setItem(NAVIGATION_INTENT_KEY, String(Date.now()));
    } catch (error) {}
  }

  function hasRecentNavigationIntent() {
    try {
      const value = Number(sessionStorage.getItem(NAVIGATION_INTENT_KEY) || '0');
      return value > 0 && (Date.now() - value) < NAVIGATION_INTENT_TTL_MS;
    } catch (error) {
      return false;
    }
  }

  function hasAuthenticatedSession() {
    return !isAuthPage() && !!getToken() && !!getCurrentUserKey();
  }

  function enforceSingleActiveTab() {
    const page = getPagePath();
    if (isAuthPage(page) || isAuxiliaryPage(page)) {
      return;
    }
    const token = getToken();
    const userKey = getCurrentUserKey();
    if (!token || !userKey) {
      return;
    }

    const tabId = getTabId();
    const activeKey = `schoolCheckActiveTab:${userKey}`;
    const ttl = 12000;

    function readActiveTab() {
      try {
        return JSON.parse(localStorage.getItem(activeKey) || 'null');
      } catch (error) {
        return null;
      }
    }

    function heartbeat() {
      const now = Date.now();
      const active = readActiveTab();
      if (active && active.tabId !== tabId && now - Number(active.updatedAt || 0) < ttl) {
        redirectDuplicateTab();
        return false;
      }
      localStorage.setItem(activeKey, JSON.stringify({ tabId, updatedAt: now }));
      return true;
    }

    if (!heartbeat()) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!heartbeat()) {
        window.clearInterval(timer);
      }
    }, 5000);

    window.addEventListener('beforeunload', () => {
      const active = readActiveTab();
      if (active && active.tabId === tabId) {
        localStorage.removeItem(activeKey);
      }
    });
  }

  function setupNavigationIntentTracking() {
    if (listenersBound) {
      return;
    }
    listenersBound = true;
    clearNavigationIntent();
    window.addEventListener('pageshow', clearNavigationIntent);
    document.addEventListener('click', (event) => {
      const link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) {
        return;
      }
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      try {
        const nextUrl = new URL(link.href, window.location.href);
        if (nextUrl.origin === window.location.origin) {
          markNavigationIntent();
        }
      } catch (error) {}
    }, true);
    document.addEventListener('submit', markNavigationIntent, true);
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
      const error = new Error(`Request returned non-JSON: ${response.status}`);
      error.status = response.status;
      error.code = response.status;
      error.data = null;
      throw error;
    }

    if (!response.ok) {
      const msg = (json && (json.msg || json.message)) || `HTTP ${response.status}`;
      if (response.status === 401 && !path.startsWith('/api/auth/')) {
        clearAuthAndRedirect();
      }
      const error = new Error(msg);
      error.status = response.status;
      error.code = json && typeof json.code !== 'undefined' ? json.code : response.status;
      error.data = json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : null;
      throw error;
    }

    if (json && typeof json.code !== 'undefined' && json.code !== 200) {
      if (json.code === 401 && !path.startsWith('/api/auth/')) {
        clearAuthAndRedirect();
      }
      const error = new Error(json.msg || 'Request failed');
      error.status = response.status;
      error.code = json.code;
      error.data = Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : null;
      throw error;
    }

    return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
  }

  async function sendHeartbeat() {
    if (!hasAuthenticatedSession()) {
      return;
    }
    const token = getToken();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/auth/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`
        },
        body: '{}',
        credentials: 'include'
      });
      if (response.status === 401) {
        clearAuthAndRedirect();
      }
    } catch (error) {}
  }

  function setupSessionHeartbeat() {
    if (isAuthPage() || !window.fetch) {
      return;
    }
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
    }
    if (!hasAuthenticatedSession()) {
      return;
    }
    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);
    window.addEventListener('focus', sendHeartbeat);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    });
    sendHeartbeat();
  }

  function sendKeepaliveLogout() {
    if (keepaliveLogoutSent || !window.fetch || !hasAuthenticatedSession() || hasRecentNavigationIntent()) {
      return;
    }
    const token = getToken();
    if (!token) {
      return;
    }
    keepaliveLogoutSent = true;
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`
      },
      body: '{}',
      credentials: 'include',
      keepalive: true
    }).catch(() => {
      keepaliveLogoutSent = false;
    });
  }

  function setupCloseLogout() {
    if (isAuthPage()) {
      return;
    }
    window.addEventListener('pagehide', sendKeepaliveLogout);
  }

  window.ApiClient = {
    API_BASE,
    request,
    clearAuthAndRedirect,
    navigate,
    goBack,
    markNavigationIntent,
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
      } finally {
        clearAuthAndRedirect();
      }
    }
  };

  setupNavigationIntentTracking();
  enforceSingleActiveTab();
  setupCloseLogout();
  setupSessionHeartbeat();
})(window);
