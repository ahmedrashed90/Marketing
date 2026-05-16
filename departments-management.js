(function(){
  const DEPARTMENTS_COLLECTION = 'departments';
  const USERS_COLLECTION = 'users';
  const LOCAL_DEPARTMENTS_KEY = 'mzj_departments';
  const DEFAULT_DEPARTMENTS = [
    { id: 'photography', name: 'قسم التصوير', users: [] },
    { id: 'content', name: 'قسم المحتوى', users: [] },
    { id: 'design', name: 'قسم التصميم', users: [] },
    { id: 'montage', name: 'قسم المونتاج', users: [] },
    { id: 'publishing', name: 'قسم النشر', users: [] }
  ];

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const makeSlug = (v) => String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-\u0600-\u06FF]/g, '') || ('dept_' + Date.now());

  function canFirestore(){
    return Boolean(window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore);
  }

  function initFirebase(){
    if(canFirestore() && !firebase.apps.length){
      firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    }
  }

  function getDb(){
    initFirebase();
    return firebase.firestore();
  }

  function uniqueBy(arr, keyFn){
    const map = new Map();
    (arr || []).forEach(item => {
      const rawKey = keyFn(item);
      if(!rawKey) return;
      const key = String(rawKey).toLowerCase();
      map.set(key, { ...(map.get(key) || {}), ...item });
    });
    return Array.from(map.values());
  }

  function userKey(u){
    return String(u?.uid || u?.id || u?.email || u?.name || '').toLowerCase();
  }

  function normalizeUser(raw){
    if(!raw) return null;
    if(typeof raw === 'string'){
      return { id: raw, uid: raw, name: raw, email: '', label: raw };
    }
    const id = raw.id || raw.uid || raw.userId || raw.email || raw.name || raw.displayName || '';
    const uid = raw.uid || raw.userId || raw.id || id;
    const email = raw.email || raw.userEmail || '';
    const name = raw.name || raw.displayName || raw.fullName || raw.username || email || id;
    if(!id && !email && !name) return null;
    return {
      id,
      uid,
      name,
      displayName: raw.displayName || name,
      email,
      role: raw.role || 'user',
      department: raw.department || raw.departmentName || '',
      label: (name && email && name !== email) ? `${name} — ${email}` : (name || email || id)
    };
  }

  function normalizeDepartment(raw={}, index=0){
    const name = raw.name || raw.title || raw.departmentName || raw.sectionName || raw.department || `قسم ${index + 1}`;
    const id = raw.id || raw.docId || raw.slug || makeSlug(name);
    const rawUsers = Array.isArray(raw.users) ? raw.users
      : Array.isArray(raw.members) ? raw.members
      : Array.isArray(raw.assignees) ? raw.assignees
      : [];
    const users = uniqueBy(rawUsers.map(normalizeUser).filter(Boolean), userKey);
    return {
      id,
      name,
      slug: raw.slug || makeSlug(name),
      users,
      userIds: Array.isArray(raw.userIds) ? raw.userIds : users.map(u => u.uid || u.id).filter(Boolean),
      memberUids: Array.isArray(raw.memberUids) ? raw.memberUids : users.map(u => u.uid || u.id).filter(Boolean),
      memberEmails: Array.isArray(raw.memberEmails) ? raw.memberEmails : users.map(u => u.email).filter(Boolean),
      active: raw.active !== false,
      isDefault: Boolean(raw.isDefault),
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt || ''
    };
  }

  function getCachedUsers(){
    const users = [];
    ['mzj_admin_users_cache_v1','users','user'].forEach(key => {
      try{
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        if(Array.isArray(value)) users.push(...value.map(normalizeUser).filter(Boolean));
      }catch(e){}
    });
    return uniqueBy(users, userKey);
  }

  function cacheUsers(users){
    try{ localStorage.setItem('mzj_admin_users_cache_v1', JSON.stringify(users || [])); }catch(e){}
  }

  function cacheDepartments(depts){
    try{ localStorage.setItem(LOCAL_DEPARTMENTS_KEY, JSON.stringify(depts || [])); }catch(e){}
  }

  function getCachedDepartments(){
    try{
      const value = JSON.parse(localStorage.getItem(LOCAL_DEPARTMENTS_KEY) || '[]');
      if(Array.isArray(value)) return uniqueBy(value.map(normalizeDepartment), d => d.id);
    }catch(e){}
    return [];
  }

  async function loadUsers(){
    let users = [];
    if(canFirestore()){
      try{
        const snap = await getDb().collection(USERS_COLLECTION).get();
        snap.forEach(doc => users.push(normalizeUser({ id: doc.id, uid: doc.id, ...(doc.data() || {}) })));
        users = uniqueBy(users.filter(Boolean), userKey);
        cacheUsers(users);
        return users;
      }catch(error){
        console.error('فشل قراءة users من Firebase:', error);
      }
    }
    users = getCachedUsers();
    return users;
  }

  async function ensureDefaultDepartmentsIfEmpty(){
    if(!canFirestore()) return;
    const db = getDb();
    for(const dept of DEFAULT_DEPARTMENTS){
      const ref = db.collection(DEPARTMENTS_COLLECTION).doc(dept.id);
      const snap = await ref.get();
      if(!snap.exists){
        await ref.set({
          ...dept,
          slug: dept.id,
          userIds: [],
          memberUids: [],
          memberEmails: [],
          active: true,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  }

  async function loadDepartments(){
    let departments = [];
    if(canFirestore()){
      try{
        const db = getDb();
        let snap = await db.collection(DEPARTMENTS_COLLECTION).get();
        if(snap.empty){
          await ensureDefaultDepartmentsIfEmpty();
          snap = await db.collection(DEPARTMENTS_COLLECTION).get();
        }
        snap.forEach((doc, index) => departments.push(normalizeDepartment({ id: doc.id, docId: doc.id, ...(doc.data() || {}) }, index)));
        departments = uniqueBy(departments, d => d.id);
        cacheDepartments(departments);
        return departments;
      }catch(error){
        console.error('فشل قراءة departments من Firebase:', error);
      }
    }
    departments = getCachedDepartments();
    if(!departments.length) departments = DEFAULT_DEPARTMENTS.map(normalizeDepartment);
    return departments;
  }

  function makeDepartmentPayload(dept){
    const normalized = normalizeDepartment(dept);
    const users = uniqueBy((normalized.users || []).map(normalizeUser).filter(Boolean), userKey);
    return {
      id: normalized.id,
      name: normalized.name,
      slug: normalized.slug || makeSlug(normalized.name),
      users,
      members: users,
      userIds: users.map(u => u.uid || u.id).filter(Boolean),
      memberUids: users.map(u => u.uid || u.id).filter(Boolean),
      memberEmails: users.map(u => u.email).filter(Boolean),
      active: true,
      isDefault: normalized.isDefault || DEFAULT_DEPARTMENTS.some(d => d.id === normalized.id),
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async function saveDepartment(dept){
    const payload = makeDepartmentPayload(dept);
    if(!canFirestore()){
      const current = (await loadDepartments()).filter(d => String(d.id) !== String(payload.id));
      current.push(payload);
      cacheDepartments(current);
      return payload;
    }
    try{
      await getDb().collection(DEPARTMENTS_COLLECTION).doc(String(payload.id)).set(payload, { merge: true });
      const current = (await loadDepartments()).filter(d => String(d.id) !== String(payload.id));
      current.push(payload);
      cacheDepartments(current);
      return payload;
    }catch(error){
      console.error('فشل حفظ القسم في Firebase:', error);
      alert('فشل حفظ القسم في Firebase: ' + (error.message || error.code || error));
      throw error;
    }
  }

  async function deleteDepartment(id){
    if(canFirestore()){
      try{
        await getDb().collection(DEPARTMENTS_COLLECTION).doc(String(id)).delete();
      }catch(error){
        console.error('فشل مسح القسم من Firebase:', error);
        alert('فشل مسح القسم من Firebase: ' + (error.message || error.code || error));
        throw error;
      }
    }
    const current = (await loadDepartments()).filter(d => String(d.id) !== String(id));
    cacheDepartments(current);
  }

  let currentUsers = [];
  let currentDepartments = [];
  let editingId = '';

  function renderUserChecks(selected=[]){
    const box = $('#departmentUsersPicker');
    if(!box) return;
    const selectedKeys = new Set((selected || []).map(normalizeUser).filter(Boolean).map(userKey));
    if(!currentUsers.length){
      box.innerHTML = '<p class="template-empty">مفيش يوزرات ظاهرة من مسار users. تأكد إن اليوزرات موجودة في Firebase وإن القواعد تسمح بقراءة users.</p>';
      return;
    }
    box.innerHTML = currentUsers.map(user => {
      const key = userKey(user);
      return `<label class="permission-chip department-user-chip">
        <input type="checkbox" value="${esc(key)}" ${selectedKeys.has(key) ? 'checked' : ''}>
        <span>${esc(user.label)}</span>
      </label>`;
    }).join('');
  }

  function renderDepartments(){
    const list = $('#departmentsList');
    if(!list) return;
    if(!currentDepartments.length){
      list.innerHTML = '<p class="template-empty">لسه مفيش أقسام محفوظة.</p>';
      return;
    }
    list.innerHTML = currentDepartments.map(dept => `
      <article class="department-management-card">
        <div>
          <strong>${esc(dept.name)}</strong>
          <small>كود القسم: ${esc(dept.id)}</small>
          <div class="department-users-tags">
            ${(dept.users || []).length ? (dept.users || []).map(user => `<span>${esc(user.label || user.name || user.email || user.id)}</span>`).join('') : '<em>مفيش يوزرات مختارة</em>'}
          </div>
        </div>
        <div class="department-card-actions">
          <button type="button" class="soft-btn" data-edit-department="${esc(dept.id)}">تعديل</button>
          <button type="button" class="ghost-btn danger-btn" data-delete-department="${esc(dept.id)}">مسح</button>
        </div>
      </article>`).join('');
  }

  function resetForm(){
    editingId = '';
    $('#departmentForm')?.reset();
    const idInput = $('#departmentId');
    if(idInput) idInput.value = '';
    const title = $('#departmentFormTitle');
    if(title) title.textContent = 'إضافة قسم جديد';
    renderUserChecks([]);
  }

  function selectedUsersFromForm(){
    const selectedKeys = new Set($$('#departmentUsersPicker input:checked').map(input => input.value));
    return currentUsers.filter(user => selectedKeys.has(userKey(user)));
  }

  async function refresh(){
    currentUsers = await loadUsers();
    currentDepartments = await loadDepartments();
    renderUserChecks([]);
    renderDepartments();
  }

  async function init(){
    if(!document.body.classList.contains('departments-management-page')) return;
    await refresh();

    $('#resetDepartmentForm')?.addEventListener('click', resetForm);
    $('#selectAllDepartmentUsers')?.addEventListener('click', () => $$('#departmentUsersPicker input').forEach(input => input.checked = true));
    $('#clearDepartmentUsers')?.addEventListener('click', () => $$('#departmentUsersPicker input').forEach(input => input.checked = false));

    $('#departmentForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const nameInput = $('#departmentName');
      const idInput = $('#departmentId');
      const name = nameInput?.value.trim();
      if(!name){
        alert('اكتب اسم القسم');
        return;
      }
      const existing = currentDepartments.find(d => String(d.id) === String(editingId));
      const id = editingId || idInput?.value || makeSlug(name);
      await saveDepartment({
        ...(existing || {}),
        id,
        name,
        users: selectedUsersFromForm()
      });
      await refresh();
      resetForm();
      alert('تم حفظ القسم وربطه باليوزرات.');
    });

    document.addEventListener('click', async event => {
      const editButton = event.target.closest('[data-edit-department]');
      if(editButton){
        const dept = currentDepartments.find(d => String(d.id) === String(editButton.dataset.editDepartment));
        if(!dept) return;
        editingId = dept.id;
        const title = $('#departmentFormTitle');
        if(title) title.textContent = 'تعديل قسم';
        const nameInput = $('#departmentName');
        const idInput = $('#departmentId');
        if(nameInput) nameInput.value = dept.name;
        if(idInput) idInput.value = dept.id;
        renderUserChecks(dept.users || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const deleteButton = event.target.closest('[data-delete-department]');
      if(deleteButton && confirm('تمسح القسم ده؟')){
        await deleteDepartment(deleteButton.dataset.deleteDepartment);
        await refresh();
        resetForm();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.MZJDepartments = { loadDepartments, loadUsers, saveDepartment, deleteDepartment };
})();
