(() => {
  const protectedPages = new Set(['admin.html', 'inscricoes.html', 'painel.html']);
  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const SESSION_KEY = 'poliedro_operational_auth_v415';
  const ADMIN_USER = 'admin';
  const ADMIN_PASSWORD = 'PoliedroSkills2026';

  function localAuthenticated() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; }
    catch (_) { return false; }
  }

  function setLocalAuthenticated(value) {
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  async function serverSession() {
    if (location.protocol === 'file:') return { authenticated: false, unavailable: true };
    try {
      const response = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('session');
      return await response.json();
    } catch (_) {
      return { authenticated: false, unavailable: true };
    }
  }

  async function isAuthenticated() {
    if (location.protocol !== 'file:') {
      const session = await serverSession();
      if (!session.unavailable) {
        setLocalAuthenticated(Boolean(session.authenticated));
        return Boolean(session.authenticated);
      }
    }
    return localAuthenticated();
  }

  function setProtectedVisibility(authenticated) {
    document.querySelectorAll('[data-protected-nav], [data-protected-link]').forEach((element) => {
      element.hidden = !authenticated;
      element.style.display = authenticated ? '' : 'none';
    });
    document.querySelectorAll('[data-public-login]').forEach((element) => {
      element.hidden = authenticated;
      element.style.display = authenticated ? 'none' : '';
    });
    document.querySelectorAll('[data-admin-logout]').forEach((element) => {
      element.hidden = !authenticated;
      element.style.display = authenticated ? '' : 'none';
    });
  }

  async function login(usuario, senha) {
    // Tenta primeiro a validação do servidor quando disponível.
    if (location.protocol !== 'file:') {
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify({ usuario, senha })
        });
        const data = await response.json();
        if (response.ok && data.ok) {
          setLocalAuthenticated(true);
          return { ok: true };
        }
        if (!response.ok) return { ok: false, message: data.message || 'Usuário ou senha incorretos.' };
      } catch (_) {
        // fallback local abaixo
      }
    }

    // Fallback para uso local/offline. É uma barreira operacional, não segurança de produção.
    if (usuario === ADMIN_USER && senha === ADMIN_PASSWORD) {
      setLocalAuthenticated(true);
      return { ok: true, local: true };
    }
    return { ok: false, message: 'Usuário ou senha incorretos.' };
  }

  async function logout() {
    setLocalAuthenticated(false);
    if (location.protocol !== 'file:') {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    }
  }

  async function init() {
    const authenticated = await isAuthenticated();
    setProtectedVisibility(authenticated);

    if (protectedPages.has(currentPage) && !authenticated) {
      const next = encodeURIComponent(currentPage);
      location.replace(`login.html?next=${next}`);
      return;
    }

    document.querySelectorAll('[data-admin-logout]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        await logout();
        location.href = 'index.html';
      });
    });
  }

  window.PoliedroAuth = { login, logout, isAuthenticated, setProtectedVisibility };
  document.addEventListener('DOMContentLoaded', init);
})();
