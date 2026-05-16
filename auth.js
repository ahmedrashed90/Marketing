(function(){
  const AUTH_KEY = 'mzj_current_user';
  const TEST_USERS = [
    { email: 'ceo@mzjcars.com', password: '123456', name: 'Ahmed Khaatan', role: 'admin', department: 'management' },
    { email: 'khataan.1992@gmail.com', password: '123456', name: 'Abdullah Khataan', role: 'admin', department: 'management' },
    { email: 'admin@mzj.local', password: '123456', name: 'مدير النظام', role: 'admin', department: 'management' },
    { email: 'user@mzj.local', password: '123456', name: 'يوزر عادي', role: 'user', department: 'photography' }
  ];

  function getUser(){ try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e){ return null; } }
  function setUser(user){ localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
  function logout(){ localStorage.removeItem(AUTH_KEY); location.href = 'login.html'; }
  function normalizeRole(role){ return String(role || 'user').toLowerCase() === 'admin' ? 'admin' : 'user'; }

  async function getFirestoreUser(email){
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('users').where('email','==', email).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const data = doc.data() || {};
      return {
        id: doc.id,
        email: data.email || email,
        name: data.name || data.displayName || data.email || email,
        role: normalizeRole(data.role),
        department: data.department || data.departmentId || '',
        pagesAccess: data.pagesAccess || data.allowedPages || [],
        source: 'firestore'
      };
    } catch (err) {
      console.warn('Firestore users login fallback:', err);
      return null;
    }
  }

  window.MZJAuth = { getUser, logout, users: TEST_USERS, getFirestoreUser };

  document.addEventListener('DOMContentLoaded', function(){
    const page = location.pathname.split('/').pop() || 'login.html';
    const user = getUser();
    if (page !== 'login.html' && !user) {
      location.href = 'login.html';
      return;
    }
    document.body.dataset.userRole = user ? user.role : 'guest';
    if (user && user.role !== 'admin' && Array.isArray(user.pagesAccess) && user.pagesAccess.length) {
      const routeMap = window.MZJ_ROUTES || {};
      const currentFile = page;
      const allowedFiles = user.pagesAccess.map(k => routeMap[k] || k);
      if (!allowedFiles.includes(currentFile) && currentFile !== 'login.html') {
        document.body.innerHTML = '<main class="main-shell"><section class="workspace-card access-denied-card"><h1>غير مسموح بالدخول</h1><p>الصفحة دي مش ضمن صلاحيات اليوزر الحالي.</p><a class="primary-btn" href="dashboard.html">الرجوع للداش بورد</a></section></main>';
        return;
      }
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async function(e){
        e.preventDefault();
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        const password = document.getElementById('loginPassword')?.value || '';
        const msg = document.getElementById('loginMessage');
        if (msg) msg.textContent = 'جاري تسجيل الدخول...';

        let found = null;
        const firestoreUser = await getFirestoreUser(email);
        if (firestoreUser && (password === '123456' || password === '')) {
          found = { ...firestoreUser, password: '123456' };
        }
        if (!found) found = TEST_USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!found) { if(msg) msg.textContent = 'بيانات الدخول غير صحيحة، أو الحساب غير موجود في users.'; return; }
        setUser({ email: found.email, name: found.name, role: normalizeRole(found.role), department: found.department || '', pagesAccess: found.pagesAccess || [], loginAt: new Date().toISOString(), source: found.source || 'local' });
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
      if (user && user.role !== 'admin' && Array.isArray(user.pagesAccess) && user.pagesAccess.length) {
        document.querySelectorAll('[data-route]').forEach(link => {
          if (!user.pagesAccess.includes(link.dataset.route) && link.dataset.route !== 'login') link.style.display = 'none';
        });
      }
      document.querySelectorAll('[data-admin-only]').forEach(el => {
        if(user.role !== 'admin') {
          el.setAttribute('disabled','disabled');
          el.style.display = 'none';
        }
      });
    }
  });
})();
