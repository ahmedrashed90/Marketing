(function(){
  const AUTH_KEY = 'mzj_current_user';
  const TEST_USERS = [
    { email: 'admin@mzj.local', password: '123456', name: 'مدير النظام', role: 'admin', department: 'management' },
    { email: 'user@mzj.local', password: '123456', name: 'يوزر عادي', role: 'user', department: 'photography' }
  ];

  function isLoginPage(){ return /login\.html$/.test(location.pathname) || location.pathname.endsWith('/'); }
  function getUser(){ try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e){ return null; } }
  function setUser(user){ localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
  function logout(){ localStorage.removeItem(AUTH_KEY); location.href = 'login.html'; }

  window.MZJAuth = { getUser, logout, users: TEST_USERS };

  document.addEventListener('DOMContentLoaded', function(){
    const page = location.pathname.split('/').pop() || 'login.html';
    const user = getUser();
    if (page !== 'login.html' && !user) {
      location.href = 'login.html';
      return;
    }
    document.body.dataset.userRole = user ? user.role : 'guest';

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e){
        e.preventDefault();
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        const password = document.getElementById('loginPassword')?.value || '';
        const found = TEST_USERS.find(u => u.email === email && u.password === password);
        const msg = document.getElementById('loginMessage');
        if (!found) { if(msg) msg.textContent = 'بيانات الدخول غير صحيحة'; return; }
        setUser({ email: found.email, name: found.name, role: found.role, department: found.department, loginAt: new Date().toISOString() });
        location.href = 'dashboard.html';
      });
    }

    document.querySelectorAll('[data-login-fill]').forEach(btn => {
      btn.addEventListener('click', function(){
        const kind = btn.dataset.loginFill;
        const sample = TEST_USERS.find(u => u.role === kind) || TEST_USERS[0];
        const email = document.getElementById('loginEmail');
        const pass = document.getElementById('loginPassword');
        if(email) email.value = sample.email;
        if(pass) pass.value = sample.password;
      });
    });

    if (user) {
      const badge = document.createElement('div');
      badge.className = 'auth-user-badge';
      badge.innerHTML = `<strong>${user.name}</strong><span>${user.role === 'admin' ? 'Admin' : 'User'}</span><button type="button" data-auth-logout>خروج</button>`;
      document.body.appendChild(badge);
      badge.querySelector('[data-auth-logout]').addEventListener('click', logout);

      document.querySelectorAll('[data-role-panel]').forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.rolePanel === user.role);
      });
      document.querySelectorAll('.role-switcher').forEach(el => el.remove());
      document.querySelectorAll('[data-admin-only]').forEach(el => {
        if(user.role !== 'admin') el.setAttribute('disabled','disabled');
      });
    }
  });
})();
