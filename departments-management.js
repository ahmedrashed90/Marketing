(function(){
  const USERS_COLLECTION = 'users';
  const DEPARTMENTS_COLLECTION = 'departments';
  const DEFAULT_DEPARTMENTS = [
    { id: 'photography', name: 'قسم التصوير', users: [] },
    { id: 'content', name: 'قسم المحتوى', users: [] },
    { id: 'design', name: 'قسم التصميم', users: [] },
    { id: 'montage', name: 'قسم المونتاج', users: [] },
    { id: 'publishing', name: 'قسم النشر', users: [] }
  ];

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nowIso = () => new Date().toISOString();

  function makeSlug(value){
    const cleaned = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\-\u0600-\u06FF]/g, '');
    return cleaned || ('dept_' + Date.now());
  }

  function canFirestore(){
    return Boolean(window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore);
  }

  function initFirebase(){
    if(!canFirestore()) return null;
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }

  function uniqueBy(items, keyFn){
    const map = new Map();
    (items || []).forEach(item => {
      const key = String(keyFn(item) || '').toLowerCase();
      if(!key) return;
      map.set(key, { ...(map.get(key) || {}), ...item });
    });
    return Array.from(map.values());
  }

  function normalizeUser(raw){
    if(!raw) return null;
    if(typeof raw === 'string'){
      return { id: raw, uid: raw, name: raw, displayName: raw, email: '', role: 'user', label: raw };
    }
    const email = String(raw.email || raw.mail || raw.userEmail || '').trim();
    const uid = String(raw.uid || raw.userId || raw.id || email || raw.name || raw.displayName || '').trim();
    const id = String(raw.id || raw.uid || raw.userId || email || raw.name || raw.displayName || '').trim();
    const name = String(raw.name || raw.displayName || raw.fullName || raw.username || email || id || '').trim();
    if(!id && !uid && !email && !name) return null;
    return {
      id: id || uid || email || name,
      uid: uid || id || email || name,
      name: name || email || id,
      displayName: raw.displayName || name || email || id,
      email,
      role: raw.role || 'user',
      department: raw.department || raw.departmentId || raw.section || '',
      label: (name && email && name !== email) ? `${name} — ${email}` : (name || email || id || uid)
    };
  }

  function userKey(user){
    const u = normalizeUser(user);
    return String(u?.uid || u?.id || u?.email || u?.name || '').toLowerCase();
  }

  function normalizeDepartment(raw={}, index=0){
    const name = raw.name || raw.title || raw.departmentName || raw.sectionName || raw.department || DEFAULT_DEPARTMENTS[index]?.name || `قسم ${index + 1}`;
    const id = raw.id || raw.docId || raw.slug || makeSlug(name);
    const rawUsers = Array.isArray(raw.users) ? raw.users
      : Array.isArray(raw.members) ? raw.members
      : Array.isArray(raw.assignees) ? raw.assignees
      : [];
    const users = uniqueBy(rawUsers.map(normalizeUser).filter(Boolean), userKey);
    const userIds = Array.isArray(raw.userIds) ? raw.userIds : users.map(user => user.uid || user.id).filter(Boolean);
    const memberUids = Array.isArray(raw.memberUids) ? raw.memberUids : userIds;
    const memberEmails = Array.isArray(raw.memberEmails) ? raw.memberEmails : users.map(user => user.email).filter(Boolean);
    return {
      id: String(id),
      name: String(name),
      slug: raw.slug || makeSlug(name),
      users,
      members: users,
      userIds,
      memberUids,
      memberEmails,
      active: raw.active !== false,
      isDefault: Boolean(raw.isDefault || DEFAULT_DEPARTMENTS.some(d => d.id === id)),
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt || ''
    };
  }

  function status(message, type='info'){
    const target = $('#departmentsStatus') || $('#departmentsList');
    if(!target) return;
    if(target.id === 'departmentsList' && type === 'info') return;
    const html = `<div class="template-empty department-status department-status-${esc(type)}">${esc(message)}</div>`;
    if(target.id === 'departmentsStatus') target.innerHTML = html;
    else target.innerHTML = html;
  }

  function getCachedUsers(){
    const users = [];
    ['mzj_admin_users_cache_v1','users','user'].forEach(key => {
      try{
        const rows = JSON.parse(localStorage.getItem(key) || '[]');
        if(Array.isArray(rows)) users.push(...rows.map(normalizeUser).filter(Boolean));
      }catch(error){}
    });
    return uniqueBy(users, userKey);
  }

  async function loadUsers(){
    let users = [];
    const db = initFirebase();
    if(db){
      try{
        const snap = await db.collection(USERS_COLLECTION).get();
        snap.forEach(doc => users.push(normalizeUser({ id: doc.id, uid: doc.id, ...(doc.data() || {}) })));
        users = uniqueBy(users.filter(Boolean), userKey);
        try{ localStorage.setItem('mzj_admin_users_cache_v1', JSON.stringify(users)); }catch(error){}
        return users;
      }catch(error){
        console.error('فشل قراءة users من Firebase:', error);
        status('فشل قراءة اليوزرات من Firebase: ' + (error.message || error.code || error), 'error');
      }
    }
    users = getCachedUsers();
    return users;
  }

  async function loadDepartments(){
    const db = initFirebase();
    let departments = [];
    if(db){
      try{
        const snap = await db.collection(DEPARTMENTS_COLLECTION).get();
        snap.forEach((doc, index) => departments.push(normalizeDepartment({ id: doc.id, docId: doc.id, ...(doc.data() || {}) }, index)));
        departments = uniqueBy(departments, department => department.id);
        if(departments.length) return departments;
      }catch(error){
        console.error('فشل قراءة departments من Firebase:', error);
        status('فشل قراءة الأقسام من Firebase: ' + (error.message || error.code || error), 'error');
      }
    }
    return DEFAULT_DEPARTMENTS.map(normalizeDepartment);
  }

  function makeDepartmentPayload(department){
    const normalized = normalizeDepartment(department);
    const users = uniqueBy((normalized.users || []).map(normalizeUser).filter(Boolean), userKey);
    return {
      id: normalized.id,
      name: normalized.name,
      slug: normalized.slug || makeSlug(normalized.name),
      users,
      members: users,
      userIds: users.map(user => user.uid || user.id).filter(Boolean),
      memberUids: users.map(user => user.uid || user.id).filter(Boolean),
      memberEmails: users.map(user => user.email).filter(Boolean),
      active: true,
      isDefault: DEFAULT_DEPARTMENTS.some(d => d.id === normalized.id) || normalized.isDefault,
      createdAt: normalized.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  async function saveDepartment(department){
    const db = initFirebase();
    if(!db){
      alert('Firebase غير متصل. لم يتم حفظ القسم.');
      throw new Error('firebase-not-ready');
    }
    const payload = makeDepartmentPayload(department);
    await db.collection(DEPARTMENTS_COLLECTION).doc(String(payload.id)).set(payload, { merge: true });
    return payload;
  }

  async function deleteDepartment(id){
    const db = initFirebase();
    if(!db){
      alert('Firebase غير متصل. لم يتم مسح القسم.');
      throw new Error('firebase-not-ready');
    }
    await db.collection(DEPARTMENTS_COLLECTION).doc(String(id)).delete();
  }

  let currentUsers = [];
  let currentDepartments = [];
  let editingId = '';

  function renderUserChecks(selected=[]){
    const box = $('#departmentUsersPicker');
    if(!box) return;
    const selectedKeys = new Set((selected || []).map(normalizeUser).filter(Boolean).map(userKey));
    if(!currentUsers.length){
      box.innerHTML = '<p class="template-empty">مفيش يوزرات ظاهرة من مسار users. راجع صفحة الإدارة أو قواعد Firebase.</p>';
      return;
    }
    box.innerHTML = currentUsers.map(user => {
      const key = userKey(user);
      return `<label class="permission-chip department-user-chip">
        <input type="checkbox" value="${esc(key)}" ${selectedKeys.has(key) ? 'checked' : ''}>
        <span>${esc(user.label || user.name || user.email || user.id)}</span>
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
    list.innerHTML = currentDepartments.map(department => `
      <article class="department-management-card">
        <div>
          <strong>${esc(department.name)}</strong>
          <small>كود القسم: ${esc(department.id)}</small>
          <div class="department-users-tags">
            ${(department.users || []).length ? (department.users || []).map(user => `<span>${esc(user.label || user.name || user.email || user.id)}</span>`).join('') : '<em>مفيش يوزرات مختارة</em>'}
          </div>
        </div>
        <div class="department-card-actions">
          <button type="button" class="soft-btn" data-edit-department="${esc(department.id)}">تعديل</button>
          <button type="button" class="ghost-btn danger-btn" data-delete-department="${esc(department.id)}">مسح</button>
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
    status('جاري تحميل الأقسام واليوزرات...', 'info');
    currentUsers = await loadUsers();
    currentDepartments = await loadDepartments();
    renderUserChecks([]);
    renderDepartments();
    const st = $('#departmentsStatus');
    if(st) st.innerHTML = '';
  }

  async function init(){
    if(!document.body.classList.contains('departments-management-page')) return;
    try{
      await refresh();
    }catch(error){
      console.error('فشل تشغيل صفحة الأقسام:', error);
      status('فشل تشغيل صفحة الأقسام: ' + (error.message || error.code || error), 'error');
    }

    $('#resetDepartmentForm')?.addEventListener('click', resetForm);
    $('#selectAllDepartmentUsers')?.addEventListener('click', () => $$('#departmentUsersPicker input').forEach(input => input.checked = true));
    $('#clearDepartmentUsers')?.addEventListener('click', () => $$('#departmentUsersPicker input').forEach(input => input.checked = false));

    $('#departmentForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const name = $('#departmentName')?.value.trim();
      if(!name){
        alert('اكتب اسم القسم');
        return;
      }
      const existing = currentDepartments.find(department => String(department.id) === String(editingId));
      const id = editingId || $('#departmentId')?.value || makeSlug(name);
      try{
        await saveDepartment({
          ...(existing || {}),
          id,
          name,
          users: selectedUsersFromForm()
        });
        await refresh();
        resetForm();
        alert('تم حفظ القسم وربطه باليوزرات.');
      }catch(error){
        console.error('فشل حفظ القسم:', error);
        alert('فشل حفظ القسم في Firebase: ' + (error.message || error.code || error));
      }
    });

    document.addEventListener('click', async event => {
      const editButton = event.target.closest('[data-edit-department]');
      if(editButton){
        const department = currentDepartments.find(item => String(item.id) === String(editButton.dataset.editDepartment));
        if(!department) return;
        editingId = department.id;
        const title = $('#departmentFormTitle');
        if(title) title.textContent = 'تعديل قسم';
        const nameInput = $('#departmentName');
        const idInput = $('#departmentId');
        if(nameInput) nameInput.value = department.name;
        if(idInput) idInput.value = department.id;
        renderUserChecks(department.users || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const deleteButton = event.target.closest('[data-delete-department]');
      if(deleteButton && confirm('تمسح القسم ده؟')){
        try{
          await deleteDepartment(deleteButton.dataset.deleteDepartment);
          await refresh();
          resetForm();
        }catch(error){
          console.error('فشل مسح القسم:', error);
          alert('فشل مسح القسم من Firebase: ' + (error.message || error.code || error));
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.MZJDepartments = { loadDepartments, loadUsers, saveDepartment, deleteDepartment };
})();
