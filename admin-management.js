(function(){
  const USERS_KEY = 'mzj_admin_users_cache_v1';
  const LEGACY_USERS_KEY = 'users';
  const OLD_USERS_KEY = 'user';
  const USER_COLLECTION = 'users';

  const pages = [
    ['admin','صفحة الإدارة','admin.html'],
    ['stock','صفحة الاستوك','stock.html'],
    ['dailyTasks','تاسكات يومية','daily-tasks.html'],
    ['content','المحتوى','content.html'],
    ['departments','الأقسام','departments.html'],
    ['database','قاعدة البيانات','database.html'],
    ['dashboard','الداش بورد','dashboard.html'],
    ['campaignsCalendar','الحملات والأجندات','campaigns-calendar.html'],
    ['taskTemplates','قوالب الحملات','templates.html'],
    ['platforms','منصات الميزانية','platforms.html']
  ];

  const deps = [
    ['management','الإدارة'],
    ['photography','قسم التصوير'],
    ['content','قسم المحتوى'],
    ['design','قسم التصميم'],
    ['editing','قسم المونتاج'],
    ['publishing','قسم النشر'],
    ['archive','قسم الأرشيف']
  ];

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  let editingUserId = '';
  let editingUserEmail = '';

  function pagesFor(user){
    return Array.isArray(user?.pagesAccess) ? user.pagesAccess :
      (Array.isArray(user?.pages) ? user.pages :
      (Array.isArray(user?.allowedPages) ? user.allowedPages :
      (Array.isArray(user?.permissions) ? user.permissions : [])));
  }

  function normalizeUser(user, id){
    const row = typeof user === 'string' ? { email:user, name:user } : (user || {});
    const email = String(row.email || row.mail || row.userEmail || '').trim();
    const pageList = pagesFor(row);
    return {
      id: id || row.id || row.uid || '',
      uid: row.uid || id || row.id || '',
      name: row.name || row.displayName || row.fullName || email,
      email,
      role: row.role || 'user',
      department: row.department || row.departmentId || row.section || 'management',
      pagesAccess: pageList,
      pages: pageList,
      password: row.password || row.pass || '123456',
      status: row.status || 'active',
      createdAt: row.createdAt || '',
      createdBy: row.createdBy || '',
      updatedAt: row.updatedAt || '',
      updatedBy: row.updatedBy || ''
    };
  }

  function uniqueUsers(arr){
    const map = new Map();
    (arr || []).forEach(u => {
      const obj = normalizeUser(u, u?.id);
      const key = String(obj.email || obj.id || obj.uid || '').toLowerCase();
      if(key) map.set(key, {...(map.get(key)||{}), ...obj});
    });
    return Array.from(map.values());
  }

  function load(){
    const all=[];
    [USERS_KEY, LEGACY_USERS_KEY, OLD_USERS_KEY].forEach(key=>{
      try{
        const v=JSON.parse(localStorage.getItem(key)||'[]');
        if(Array.isArray(v)) all.push(...v);
      }catch(e){}
    });
    return uniqueUsers(all);
  }

  function save(v){
    const users = uniqueUsers(v);
    localStorage.setItem(USERS_KEY,JSON.stringify(users));
    localStorage.setItem(LEGACY_USERS_KEY,JSON.stringify(users));
  }

  function canUseFirestore(){
    return window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore;
  }

  function db(){
    if(!canUseFirestore()) return null;
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }

  function currentAdmin(){
    return window.MZJAuth?.getUser?.() || {};
  }

  async function upsertFirestoreUser(user, previousId){
    const firestore = db();
    if(!firestore) return null;

    const payload = {
      uid: user.uid || previousId || user.id || '',
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      pages: user.pagesAccess,
      password: user.password || '123456',
      status: user.status || 'active',
      updatedAt: new Date().toISOString(),
      updatedBy: currentAdmin().id || currentAdmin().email || 'admin'
    };

    if(previousId){
      await firestore.collection(USER_COLLECTION).doc(previousId).set(payload, { merge:true });
      return previousId;
    }

    const exact = await firestore.collection(USER_COLLECTION).where('email','==',user.email).limit(1).get();
    if(!exact.empty){
      const docId = exact.docs[0].id;
      await firestore.collection(USER_COLLECTION).doc(docId).set(payload, { merge:true });
      return docId;
    }

    payload.createdAt = new Date().toISOString();
    payload.createdBy = currentAdmin().id || currentAdmin().email || 'admin';
    const ref = await firestore.collection(USER_COLLECTION).add(payload);
    await ref.set({ uid: payload.uid || ref.id }, { merge:true });
    return ref.id;
  }

  async function deleteFirestoreUser(user){
    const firestore = db();
    if(!firestore || !user?.id) return;
    await firestore.collection(USER_COLLECTION).doc(user.id).delete();
  }

  async function loadFirestoreUsers(){
    const firestore = db();
    if(!firestore) return null;
    try{
      const snap = await firestore.collection(USER_COLLECTION).get();
      const cloudUsers = snap.docs.map(d=>normalizeUser(d.data(), d.id));
      const users = uniqueUsers(cloudUsers.concat(load()));
      save(users);
      return users;
    }catch(e){
      console.warn('users firestore fallback', e);
      return null;
    }
  }

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function depName(value){
    return (deps.find(d=>d[0]===value)||[])[1] || value || '-';
  }

  function roleName(value){
    return value === 'admin' ? 'أدمن' : value === 'marketing_manager' ? 'مدير تسويق' : 'يوزر عادي';
  }

  function renderChecks(selected){
    const box = $('#adminPagesAccess');
    if(!box) return;
    const selectedSet = new Set(selected || ['dashboard','database']);
    box.innerHTML = pages.map(p=>`<label class="permission-chip"><input type="checkbox" value="${p[0]}"><span>${p[1]}</span></label>`).join('');
    $$('#adminPagesAccess input').forEach(i=>i.checked = selectedSet.has(i.value));
  }

  function resetForm(){
    editingUserId = '';
    editingUserEmail = '';
    $('#adminUserForm')?.reset();
    const password = $('#adminUserPassword');
    if(password) password.value = '123456';
    const submit = $('#adminUserSubmit');
    if(submit) submit.textContent = 'حفظ اليوزر';
    const cancel = $('#cancelUserEdit');
    if(cancel) cancel.style.display = 'none';
    renderChecks();
  }

  function fillForm(user){
    editingUserId = user.id || '';
    editingUserEmail = user.email || '';
    $('#adminUserName').value = user.name || '';
    $('#adminUserEmail').value = user.email || '';
    $('#adminUserPassword').value = user.password || '123456';
    $('#adminUserRole').value = user.role || 'user';
    $('#adminUserDepartment').value = user.department || 'management';
    renderChecks(pagesFor(user));
    const submit = $('#adminUserSubmit');
    if(submit) submit.textContent = 'تحديث اليوزر';
    const cancel = $('#cancelUserEdit');
    if(cancel) cancel.style.display = 'inline-flex';
    document.querySelector('.admin-users-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function renderUsers(){
    const list = $('#adminUsersList');
    if(!list) return;
    list.innerHTML = '<p class="template-empty">جاري تحميل اليوزرات...</p>';
    const cloud = await loadFirestoreUsers();
    const users = uniqueUsers(cloud || load());
    if(!users.length){
      list.innerHTML='<p class="template-empty">لسه مفيش يوزرات محفوظة.</p>';
      return;
    }
    list.innerHTML = users.map(u=>`
      <article class="user-permission-card" data-user-card="${esc(u.email)}">
        <div class="user-card-main">
          <strong>${esc(u.name||u.email)}</strong>
          <small>${esc(u.email)} · ${roleName(u.role)} · ${esc(depName(u.department))}</small>
          <small>كلمة المرور: <b>${esc(u.password || '123456')}</b></small>
          <div class="user-pages-list">${pagesFor(u).map(k=>`<span>${esc((pages.find(p=>p[0]===k)||[])[1]||k)}</span>`).join('') || '<em>بدون صفحات محددة</em>'}</div>
        </div>
        <div class="user-card-actions">
          <button class="soft-btn" type="button" data-edit-user="${esc(u.email)}">تعديل</button>
          <button class="ghost-btn danger-btn" type="button" data-delete-user="${esc(u.email)}">مسح</button>
        </div>
      </article>`).join('');

    $$('[data-edit-user]').forEach(btn=>btn.addEventListener('click',()=>{
      const user = users.find(u=>String(u.email).toLowerCase()===String(btn.dataset.editUser).toLowerCase());
      if(user) fillForm(user);
    }));

    $$('[data-delete-user]').forEach(btn=>btn.addEventListener('click',async()=>{
      const user = users.find(u=>String(u.email).toLowerCase()===String(btn.dataset.deleteUser).toLowerCase());
      if(!user) return;
      if(!confirm('تمسح اليوزر ده؟')) return;
      try{ await deleteFirestoreUser(user); }catch(err){ console.warn(err); alert('فشل المسح من Firebase، هيتشال من النسخة المحلية فقط.'); }
      save(load().filter(u=>String(u.email).toLowerCase() !== String(user.email).toLowerCase()));
      await renderUsers();
    }));
  }

  function init(){
    if(!document.body.classList.contains('admin-management-page')) return;

    const dep = $('#adminUserDepartment');
    if(dep) dep.innerHTML = deps.map(d=>`<option value="${d[0]}">${d[1]}</option>`).join('');

    const submitBtn = $('#adminUserForm .primary-btn[type="submit"]');
    if(submitBtn) submitBtn.id = 'adminUserSubmit';
    if($('#adminUserForm') && !$('#cancelUserEdit')){
      $('#adminUserForm').insertAdjacentHTML('beforeend','<button class="ghost-btn" id="cancelUserEdit" type="button" style="display:none">إلغاء التعديل</button>');
    }

    renderChecks();
    renderUsers();

    $('#checkAllPages')?.addEventListener('click',()=>$$('#adminPagesAccess input').forEach(i=>i.checked=true));
    $('#clearPages')?.addEventListener('click',()=>$$('#adminPagesAccess input').forEach(i=>i.checked=false));
    $('#cancelUserEdit')?.addEventListener('click', resetForm);
    $('#adminUserRole')?.addEventListener('change', e=>{
      if(e.target.value==='admin') $$('#adminPagesAccess input').forEach(i=>i.checked=true);
    });

    $('#adminUserForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const user = normalizeUser({
        id: editingUserId,
        uid: editingUserId,
        name: $('#adminUserName').value.trim(),
        email: $('#adminUserEmail').value.trim(),
        role: $('#adminUserRole').value,
        password: $('#adminUserPassword')?.value || '123456',
        department: $('#adminUserDepartment').value,
        pagesAccess: $$('#adminPagesAccess input:checked').map(i=>i.value),
        status: 'active',
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdmin().id || currentAdmin().email || 'admin'
      }, editingUserId);

      if(!user.name || !user.email){ alert('اكتب اسم اليوزر والإيميل'); return; }
      if(!user.password){ alert('اكتب كلمة المرور'); return; }
      if(!pagesFor(user).length && user.role !== 'admin'){ alert('اختار صفحة واحدة على الأقل لليوزر'); return; }

      try{
        const id = await upsertFirestoreUser(user, editingUserId);
        if(id){ user.id = id; user.uid = user.uid || id; }
      }catch(err){
        console.warn(err);
        alert('فشل الحفظ في Firebase. اتأكد من قواعد Firestore. هيتحفظ محليًا للتجربة.');
      }

      const users=load().filter(u=>String(u.email).toLowerCase()!==String(editingUserEmail || user.email).toLowerCase());
      users.push(user);
      save(users);
      resetForm();
      await renderUsers();
      alert(editingUserEmail ? 'تم تحديث اليوزر وكلمة المرور' : 'تم حفظ اليوزر');
    });
  }

  document.addEventListener('DOMContentLoaded',init);
})();
