(function(){
  const AUTH_KEY = 'mzj_current_user';
  const USER_COLLECTION = 'users';
  const LEGACY_USER_COLLECTION = 'user';
  const TEST_USERS = [
    { email: 'admin@mzj.local', password: '123456', name: 'مدير النظام', role: 'admin', department: 'management', pagesAccess: ['admin','dashboard','database','departments','taskTemplates','campaignsCalendar','stock','dailyTasks','content'] },
    { email: 'user@mzj.local', password: '123456', name: 'يوزر عادي', role: 'user', department: 'photography', pagesAccess: ['dashboard'] }
  ];

  const PAGE_NAME_TO_ROUTE = {
    'admin.html': 'admin',
    'test.html': 'admin',
    'stock.html': 'stock',
    'daily-tasks.html': 'dailyTasks',
    'content.html': 'content',
    'departments.html': 'departments',
    'database.html': 'database',
    'dashboard.html': 'dashboard',
    'campaigns-calendar.html': 'campaignsCalendar',
    'templates.html': 'taskTemplates',
    'login.html': 'login'
  };

  const ROUTE_ALIASES = {
    admin: 'admin',
    administration: 'admin',
    'صفحة الإدارة': 'admin',
    'الادارة': 'admin',
    stock: 'stock',
    'صفحة الاستوك': 'stock',
    dailyTasks: 'dailyTasks',
    daily_tasks: 'dailyTasks',
    'تاسكات يومية': 'dailyTasks',
    content: 'content',
    'المحتوى': 'content',
    departments: 'departments',
    'الأقسام': 'departments',
    'الاقسام': 'departments',
    database: 'database',
    'قاعدة البيانات': 'database',
    dashboard: 'dashboard',
    'الداش بورد': 'dashboard',
    campaignsCalendar: 'campaignsCalendar',
    campaigns_calendar: 'campaignsCalendar',
    'الحملات والأجندات': 'campaignsCalendar',
    'الحملات والاجندات': 'campaignsCalendar',
    taskTemplates: 'taskTemplates',
    templates: 'taskTemplates',
    'قوالب الحملات': 'taskTemplates',
    login: 'login',
    'تسجيل الدخول': 'login'
  };

  function getUser(){
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e){ return null; }
  }

  function setUser(user){
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }

  function logout(){
    localStorage.removeItem(AUTH_KEY);
    location.href = 'login.html';
  }

  function normalizeRole(role){
    const r = String(role || 'user').trim().toLowerCase();
    if (['admin','owner','super_admin','superadmin','administrator'].includes(r)) return 'admin';
    if (['marketing_manager','manager','marketing','مدير تسويق','مدير التسويق'].includes(r)) return 'marketing_manager';
    return 'user';
  }

  function normalizePageKey(value){
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (ROUTE_ALIASES[raw]) return ROUTE_ALIASES[raw];
    const lower = raw.toLowerCase();
    if (ROUTE_ALIASES[lower]) return ROUTE_ALIASES[lower];
    const fileName = raw.split('/').pop();
    if (PAGE_NAME_TO_ROUTE[fileName]) return PAGE_NAME_TO_ROUTE[fileName];
    return raw;
  }

  function normalizePages(value){
    let list = [];
    if (Array.isArray(value)) {
      list = value;
    } else if (value && typeof value === 'object') {
      list = Object.entries(value).filter(([,v]) => !!v).map(([k]) => k);
    } else if (typeof value === 'string') {
      list = value.split(',').map(v => v.trim()).filter(Boolean);
    }
    return Array.from(new Set(list.map(normalizePageKey).filter(Boolean)));
  }

  function getAllowedPages(row){
    const sources = [row?.pagesAccess, row?.pages, row?.allowedPages, row?.permissions];
    for (const source of sources) {
      const pages = normalizePages(source);
      if (pages.length) return pages;
    }
    return [];
  }

  function normalizeUserDoc(data, id, fallbackEmail){
    const row = data || {};
    const email = String(row.email || row.mail || row.userEmail || fallbackEmail || '').trim();
    const normalized = {
      id: id || row.id || row.uid || '',
      uid: row.uid || id || '',
      email,
      name: row.name || row.displayName || row.fullName || email,
      role: normalizeRole(row.role || row.type),
      department: row.department || row.departmentId || row.section || '',
      pagesAccess: getAllowedPages(row),
      password: row.password || row.pass || '',
      status: row.status || 'active',
      source: row.source || 'firestore:users'
    };
    return normalized;
  }

  function loadLocalManagedUsers(){
    const keys = ['mzj_admin_users_cache_v1','users','user'];
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
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG) return { user: null, error: 'firebase-sdk-missing' };
    const wantedEmail = String(email || '').trim().toLowerCase();
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const db = firebase.firestore();
      for (const collectionName of [USER_COLLECTION, LEGACY_USER_COLLECTION]) {
        try {
          const exactSnap = await db.collection(collectionName).where('email','==', email).limit(1).get();
          if (!exactSnap.empty) {
            const doc = exactSnap.docs[0];
            const user = normalizeUserDoc(doc.data() || {}, doc.id, email);
            user.collectionName = collectionName;
            user.source = 'firestore:' + collectionName;
            return { user, error: null };
          }
        } catch(queryErr) {
          console.warn('Firestore exact query failed:', queryErr);
        }

        const snap = await db.collection(collectionName).get();
        let matched = null;
        snap.forEach((doc) => {
          if (matched) return;
          const data = doc.data() || {};
          const possibleEmails = [data.email, data.mail, data.userEmail, data.username]
            .filter(Boolean)
            .map(v => String(v).trim().toLowerCase());
          if (possibleEmails.includes(wantedEmail)) {
            matched = normalizeUserDoc(data, doc.id, email);
            matched.collectionName = collectionName;
            matched.source = 'firestore:' + collectionName;
          }
        });
        if (matched) return { user: matched, error: null };
      }
      return { user: null, error: null };
    } catch (err) {
      console.warn('Firestore users login failed:', err);
      return { user: null, error: err };
    }
  }

  async function refreshCurrentUserFromFirestore(currentUser){
    if (!currentUser || !currentUser.email) return currentUser;
    const result = await getFirestoreUser(currentUser.email);
    if (result && result.user) {
      const fresh = {
        ...currentUser,
        ...result.user,
        role: normalizeRole(result.user.role),
        pagesAccess: result.user.pagesAccess || [],
        loginAt: currentUser.loginAt || new Date().toISOString(),
        refreshedAt: new Date().toISOString()
      };
      setUser(fresh);
      return fresh;
    }
    return currentUser;
  }

  function isAdminLike(user){
    return user && ['admin','marketing_manager'].includes(normalizeRole(user.role));
  }

  function currentRouteKey(){
    const page = location.pathname.split('/').pop() || 'login.html';
    return PAGE_NAME_TO_ROUTE[page] || page;
  }

  function firstAllowedHref(user){
    const routes = window.MZJ_ROUTES || {};
    const pages = normalizePages(user?.pagesAccess);
    const first = pages[0] || 'dashboard';
    return routes[first] || 'dashboard.html';
  }

  function enforcePageAccess(user){
    if (!user || isAdminLike(user)) return true;
    const allowed = new Set(normalizePages(user.pagesAccess));
    if (!allowed.size) allowed.add('dashboard');
    const route = currentRouteKey();
    if (route !== 'login' && !allowed.has(route)) {
      document.body.innerHTML = '<main class="main-shell"><section class="workspace-card access-denied-card"><h1>غير مسموح بالدخول</h1><p>الصفحة دي مش ضمن صلاحيات اليوزر الحالي.</p><a class="primary-btn" href="' + firstAllowedHref(user) + '">الرجوع للصفحة المسموحة</a></section></main>';
      return false;
    }
    return true;
  }

  function applyNavigationAccess(user){
    const links = document.querySelectorAll('[data-route]');
    if (!user) return;

    const adminLike = isAdminLike(user);
    const allowed = new Set(normalizePages(user.pagesAccess));
    if (!adminLike && !allowed.size) allowed.add('dashboard');

    links.forEach(link => {
      const route = normalizePageKey(link.dataset.route);
      const show = adminLike ? route !== 'login' : allowed.has(route);
      link.style.display = show ? '' : 'none';
      link.toggleAttribute('aria-hidden', !show);
    });
  }

  function applyRolePanels(user){
    document.querySelectorAll('[data-role-panel]').forEach(panel => {
      const target = isAdminLike(user) ? 'admin' : 'user';
      panel.classList.toggle('is-active', panel.dataset.rolePanel === target);
    });
    document.querySelectorAll('.role-switcher').forEach(el => el.remove());
  }

  function applyAdminOnly(user){
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      if(!isAdminLike(user)) {
        el.setAttribute('disabled','disabled');
        el.style.display = 'none';
      } else {
        el.removeAttribute('disabled');
      }
    });
  }

  function renderUserBadge(user){
    document.querySelectorAll('.auth-user-badge').forEach(el => el.remove());
    const badge = document.createElement('div');
    badge.className = 'auth-user-badge';
    const roleLabel = isAdminLike(user) ? (user.role === 'marketing_manager' ? 'Marketing Manager' : 'Admin') : 'User';
    badge.innerHTML = `<button type="button" data-auth-logout>خروج</button><span>${roleLabel}</span><strong>${user.name || user.email}</strong>`;
    document.body.appendChild(badge);
    badge.querySelector('[data-auth-logout]').addEventListener('click', logout);
  }

  function applyUserSessionToPage(user){
    document.body.dataset.userRole = user ? normalizeRole(user.role) : 'guest';
    if (!user) return;
    if (!enforcePageAccess(user)) return;
    renderUserBadge(user);
    applyNavigationAccess(user);
    applyRolePanels(user);
    applyAdminOnly(user);
  }

  window.MZJAuth = {
    getUser,
    setUser,
    logout,
    users: TEST_USERS,
    getFirestoreUser,
    loadLocalManagedUsers,
    normalizeRole,
    normalizeUserDoc,
    normalizePages,
    applyNavigationAccess,
    USER_COLLECTION,
    LEGACY_USER_COLLECTION
  };

  document.addEventListener('DOMContentLoaded', async function(){
    const page = location.pathname.split('/').pop() || 'login.html';
    let user = getUser();

    if (page !== 'login.html' && !user) {
      location.href = 'login.html';
      return;
    }

    if (page !== 'login.html' && user) {
      user = await refreshCurrentUserFromFirestore(user);
      applyUserSessionToPage(user);
    } else if (user) {
      document.body.dataset.userRole = normalizeRole(user.role);
    } else {
      document.body.dataset.userRole = 'guest';
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async function(e){
        e.preventDefault();
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        const password = document.getElementById('loginPassword')?.value || '';
        const msg = document.getElementById('loginMessage');
        if (msg) msg.textContent = 'جاري البحث في مسار users...';

        const firestoreResult = await getFirestoreUser(email);
        if (firestoreResult && firestoreResult.error && firestoreResult.error !== 'firebase-sdk-missing') {
          const code = firestoreResult.error.code || firestoreResult.error.message || firestoreResult.error;
          if(msg) msg.textContent = 'فشل قراءة مسار users من Firebase: ' + code + ' — راجع قواعد Firestore أو الصلاحيات.';
          return;
        }
        let found = firestoreResult ? firestoreResult.user : null;
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
        if (!found) { if(msg) msg.textContent = 'الحساب غير موجود في مسار users أو كلمة المرور غير صحيحة.'; return; }

        const loginUser = {
          id: found.id || found.uid || '',
          uid: found.uid || found.id || '',
          email: found.email,
          name: found.name || found.email,
          role: normalizeRole(found.role),
          department: found.department || '',
          pagesAccess: normalizePages(found.pagesAccess || found.pages || []),
          loginAt: new Date().toISOString(),
          source: found.source || 'local',
          collectionName: found.collectionName || USER_COLLECTION
        };
        setUser(loginUser);
        location.href = isAdminLike(loginUser) ? 'dashboard.html' : firstAllowedHref(loginUser);
      });
    }
  });
})();
