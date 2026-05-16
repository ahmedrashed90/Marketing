(function(){
  const AUTH_KEY = 'mzj_current_user';
  const USER_COLLECTION = 'user';
  const LEGACY_USER_COLLECTION = 'users';
  const TEST_USERS = [
    { email: 'admin@mzj.local', password: '123456', name: 'مدير النظام', role: 'admin', department: 'management' },
    { email: 'user@mzj.local', password: '123456', name: 'يوزر عادي', role: 'user', department: 'photography' }
  ];

  function getUser(){ try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e){ return null; } }
  function setUser(user){ localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
  function logout(){ localStorage.removeItem(AUTH_KEY); location.href = 'login.html'; }
  function normalizeRole(role){
    const r = String(role || 'user').toLowerCase();
    if (r === 'admin' || r === 'owner' || r === 'super_admin') return 'admin';
    if (r === 'marketing_manager' || r === 'manager' || r === 'marketing') return 'marketing_manager';
    return 'user';
  }
  function normalizeUserDoc(data, id, fallbackEmail){
    const row = data || {};
    const email = String(row.email || fallbackEmail || '').trim();
    return {
      id: id || row.id || row.uid || '',
      email,
      name: row.name || row.displayName || row.fullName || email,
      role: normalizeRole(row.role || row.type),
      department: row.department || row.departmentId || row.section || '',
      pagesAccess: row.pagesAccess || row.allowedPages || row.permissions || [],
      password: row.password || row.pass || '',
      source: row.source || 'firestore:user'
    };
  }
  function loadLocalManagedUsers(){
    const keys = ['mzj_admin_users_cache_v1','user','users'];
    const out = [];
    keys.forEach(key => {
      try {
        const rows = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(rows)) out.push(...rows);
      } catch(e) {}
    });
    const map = new Map();
    out.forEach(u => {
      if(!u) return;
      const obj = typeof u === 'string' ? {email:u,name:u,password:'123456'} : u;
      const email = String(obj.email || '').toLowerCase();
      if(email) map.set(email, {...(map.get(email)||{}), ...obj});
    });
    return Array.from(map.values()).map((u) => normalizeUserDoc(u, u.id, u.email));
  }

  async function getFirestoreUser(email){
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const db = firebase.firestore();
      for (const collectionName of [USER_COLLECTION, LEGACY_USER_COLLECTION]) {
        const snap = await db.collection(collectionName).where('email','==', email).limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const user = normalizeUserDoc(doc.data() || {}, doc.id, email);
          user.collectionName = collectionName;
          user.source = 'firestore:' + collectionName;
          return user;
        }
      }
      return null;
    } catch (err) {
      console.warn('Firestore user login fallback:', err);
      return null;
    }
  }

  window.MZJAuth = { getUser, logout, users: TEST_USERS, getFirestoreUser, loadLocalManagedUsers, normalizeRole, normalizeUserDoc, USER_COLLECTION };

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
        if (msg) msg.textContent = 'جاري البحث في مسار user...';

        let found = await getFirestoreUser(email);
        if (found) {
          const savedPassword = found.password || '123456';
          if (String(savedPassword) !== String(password)) {
            if(msg) msg.textContent = 'كلمة المرور غير صحيحة. لو اليوزر القديم بدون password استخدم 123456.';
            return;
          }
        }

        if (!found) {
          const localManagedUser = loadLocalManagedUsers().find(u => String(u.email || '').toLowerCase() === email.toLowerCase());
          if (localManagedUser && String(localManagedUser.password || '123456') === String(password)) {
            found = { ...localManagedUser, source: 'local-user-cache' };
          }
        }

        if (!found) found = TEST_USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!found) { if(msg) msg.textContent = 'الحساب غير موجود في مسار user أو كلمة المرور غير صحيحة.'; return; }
        setUser({ id: found.id || '', email: found.email, name: found.name || found.email, role: normalizeRole(found.role), department: found.department || '', pagesAccess: found.pagesAccess || [], loginAt: new Date().toISOString(), source: found.source || 'local', collectionName: found.collectionName || USER_COLLECTION });
        location.href = 'dashboard.html';
      });
    }

    if (user) {
      const badge = document.createElement('div');
      badge.className = 'auth-user-badge';
      badge.innerHTML = `<strong>${user.name}</strong><span>${user.role === 'admin' ? 'Admin' : (user.role === 'marketing_manager' ? 'Marketing Manager' : 'User')}</span><button type="button" data-auth-logout>خروج</button>`;
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
        if(user.role !== 'admin' && user.role !== 'marketing_manager') {
          el.setAttribute('disabled','disabled');
          el.style.display = 'none';
        }
      });
    }
  });
})();
