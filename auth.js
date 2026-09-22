/*
 * Shared customer session for index.html and rooms.html.
 * One token key. Same-origin /auth and /keyhole (nginx forwards Authorization).
 */
(function (root) {
  var TOKEN_KEY = 'keyhole_auth_token_v1';
  var API_BASE = '';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch (e) { return ''; }
  }

  function apiUrl(path) {
    var p = path.charAt(0) === '/' ? path : '/' + path;
    return API_BASE + p;
  }

  function headers(opts) {
    opts = opts || {};
    var h = { Accept: 'application/json' };
    if (opts.json) h['Content-Type'] = 'application/json';
    var t = token();
    if (t && opts.auth !== false) h.Authorization = 'Bearer ' + t;
    return h;
  }

  function saveToken(value) {
    if (typeof value !== 'string' || !value || value === 'undefined' || value === 'null') return false;
    localStorage.setItem(TOKEN_KEY, value);
    return localStorage.getItem(TOKEN_KEY) === value;
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function tokenFromLogin(data) {
    if (!data) return '';
    if (typeof data.token === 'string') return data.token;
    if (typeof data.access_token === 'string') return data.access_token;
    return '';
  }

  async function request(path, opts) {
    opts = opts || {};
    var res = await fetch(apiUrl(path), {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: headers({ json: !!opts.body, auth: opts.auth !== false }),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin'
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    return { res: res, data: data };
  }

  async function login(email, password) {
    var out = await request('/auth/login', {
      method: 'POST',
      body: { email: email, password: password },
      auth: false
    });
    if (!out.res.ok) {
      var detail = out.data && typeof out.data.detail === 'string' ? out.data.detail : '';
      var err = new Error(detail ? detail.split('|').pop() : 'Could not sign in.');
      err.status = out.res.status;
      throw err;
    }
    if (!saveToken(tokenFromLogin(out.data))) {
      throw new Error('Sign-in did not return a session.');
    }
    return out.data;
  }

  function confirmedInvalidSession(res, data) {
    if (!res || res.status !== 401) return false;
    var detail = String((data && data.detail) || '');
    return /session expired/i.test(detail);
  }

  async function me() {
    if (!token()) return { ok: false, user: null };
    var res, data;
    try {
      var out = await request('/keyhole/me', { method: 'GET' });
      res = out.res;
      data = out.data;
    } catch (e) {
      return { ok: false, flaky: true, user: null };
    }
    if (res.ok && data && (data.email || data.user_id)) {
      return { ok: true, user: data };
    }
    if (confirmedInvalidSession(res, data)) {
      clearToken();
      return { ok: false, cleared: true, user: null };
    }
    return { ok: false, flaky: true, user: null };
  }

  root.KeyholeAuth = {
    TOKEN_KEY: TOKEN_KEY,
    token: token,
    saveToken: saveToken,
    clearToken: clearToken,
    apiUrl: apiUrl,
    login: login,
    me: me,
    request: request
  };
})(window);
