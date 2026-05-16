(function(){
  const DEPARTMENTS_KEY = 'mzj_departments';
  const USER_KEYS = ['mzj_admin_users_cache_v1','users','user'];
  const DEFAULT_DEPARTMENTS = [
    { id: 'photography', name: 'قسم التصوير', users: [] },
    { id: 'content', name: 'قسم المحتوى', users: [] },
    { id: 'design', name: 'قسم التصميم', users: [] },
    { id: 'montage', name: 'قسم المونتاج', users: [] },
    { id: 'publishing', name: 'قسم النشر', users: [] }
  ];
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc = (v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = (v)=> String(v || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '') || ('dept_' + Date.now());

  function canFirestore(){ return window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore; }
  function initFirebase(){ if(canFirestore() && !firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG); }
  function uniqueBy(arr, keyFn){ const m=new Map(); (arr||[]).forEach(x=>{ const k=keyFn(x); if(k) m.set(String(k).toLowerCase(), {...(m.get(String(k).toLowerCase())||{}), ...x}); }); return Array.from(m.values()); }
  function normalizeUser(u){
    if(!u) return null;
    if(typeof u === 'string') return { id:u, name:u, email:u, label:u };
    const name = u.name || u.displayName || u.fullName || u.email || '';
    const email = u.email || '';
    const id = u.id || u.uid || email || name;
    if(!id && !name && !email) return null;
    return { id, name, email, role:u.role||'user', department:u.department||'', label: (name && email && name!==email) ? `${name} — ${email}` : (name||email||id) };
  }
  function normalizeDept(d={}, i=0){
    const name = d.name || d.title || d.departmentName || d.sectionName || d.department || `قسم ${i+1}`;
    const id = d.id || d.docId || slug(name);
    const rawUsers = Array.isArray(d.users) ? d.users : (Array.isArray(d.members) ? d.members : (Array.isArray(d.assignees) ? d.assignees : []));
    const users = rawUsers.map(normalizeUser).filter(Boolean);
    return { id, name, users, createdAt:d.createdAt||'', updatedAt:d.updatedAt||'' };
  }
  function readLocalDepartments(){
    const merged=[];
    [DEPARTMENTS_KEY,'content_tasks','mzj_content_tasks','mzj_content_departments'].forEach(k=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)) merged.push(...v.map(normalizeDept)); }catch(e){} });
    return uniqueBy(merged, d=>d.id);
  }
  function writeLocalDepartments(depts){
    const normalized = uniqueBy((depts||[]).map(normalizeDept), d=>d.id);
    localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(normalized));
    localStorage.setItem('content_tasks', JSON.stringify(normalized));
  }
  async function loadUsers(){
    const users=[];
    USER_KEYS.forEach(k=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)) users.push(...v.map(normalizeUser).filter(Boolean)); }catch(e){} });
    if(canFirestore()){
      try{ initFirebase(); const snap=await firebase.firestore().collection('users').get(); snap.forEach(doc=>users.push(normalizeUser({id:doc.id, ...(doc.data()||{})}))); }catch(e){ console.warn('load user fallback', e); }
    }
    return uniqueBy(users.filter(Boolean), u=>u.email||u.id||u.name);
  }
  async function loadDepartments(){
    let depts = readLocalDepartments();
    if(canFirestore()){
      try{ initFirebase(); const snap=await firebase.firestore().collection('departments').get(); const cloud=[]; snap.forEach(doc=>cloud.push(normalizeDept({id:doc.id, ...(doc.data()||{})}))); if(cloud.length) depts = cloud; }catch(e){ console.warn('load departments fallback', e); }
    }
    if(!depts.length) depts = DEFAULT_DEPARTMENTS.map(normalizeDept);
    writeLocalDepartments(depts);
    return depts;
  }
  async function saveDepartment(dept){
    const depts = (await loadDepartments()).filter(d=>String(d.id)!==String(dept.id));
    const payload = normalizeDept({ ...dept, updatedAt:new Date().toISOString() });
    depts.push(payload); writeLocalDepartments(depts);
    if(canFirestore()){
      try{ initFirebase(); await firebase.firestore().collection('departments').doc(String(payload.id)).set(payload, { merge:true }); }catch(e){ console.warn('save department fallback', e); }
    }
    return payload;
  }
  async function deleteDepartment(id){
    const depts = (await loadDepartments()).filter(d=>String(d.id)!==String(id));
    writeLocalDepartments(depts);
    if(canFirestore()){
      try{ initFirebase(); await firebase.firestore().collection('departments').doc(String(id)).delete(); }catch(e){ console.warn('delete department fallback', e); }
    }
  }

  let currentUsers=[];
  let currentDepartments=[];
  let editingId='';
  function renderUserChecks(selected=[]){
    const box = $('#departmentUsersPicker'); if(!box) return;
    const selectedKeys = new Set((selected||[]).map(u=>String(u.email||u.id||u.name).toLowerCase()));
    if(!currentUsers.length){ box.innerHTML = '<p class="template-empty">مفيش يوزرات ظاهرة من مسار users. أضف اليوزرات من صفحة الإدارة أو تأكد من قواعد Firebase.</p>'; return; }
    box.innerHTML = currentUsers.map(u=>{
      const key = String(u.email||u.id||u.name).toLowerCase();
      return `<label class="permission-chip department-user-chip"><input type="checkbox" value="${esc(key)}" ${selectedKeys.has(key)?'checked':''}><span>${esc(u.label)}</span></label>`;
    }).join('');
  }
  function renderList(){
    const list = $('#departmentsList'); if(!list) return;
    if(!currentDepartments.length){ list.innerHTML = '<p class="template-empty">لسه مفيش أقسام محفوظة.</p>'; return; }
    list.innerHTML = currentDepartments.map(d=>`
      <article class="department-management-card">
        <div>
          <strong>${esc(d.name)}</strong>
          <small>كود القسم: ${esc(d.id)}</small>
          <div class="department-users-tags">${(d.users||[]).length ? d.users.map(u=>`<span>${esc(u.label||u.name||u.email||u.id)}</span>`).join('') : '<em>مفيش يوزرات مختارة</em>'}</div>
        </div>
        <div class="department-card-actions">
          <button type="button" class="soft-btn" data-edit-department="${esc(d.id)}">تعديل</button>
          <button type="button" class="ghost-btn danger-btn" data-delete-department="${esc(d.id)}">مسح</button>
        </div>
      </article>`).join('');
  }
  function resetForm(){ editingId=''; $('#departmentForm')?.reset(); $('#departmentId').value=''; $('#departmentFormTitle').textContent='إضافة قسم جديد'; renderUserChecks([]); }
  async function refresh(){ currentUsers = await loadUsers(); currentDepartments = await loadDepartments(); renderUserChecks([]); renderList(); }
  function selectedUsersFromForm(){
    const checked = new Set($$('#departmentUsersPicker input:checked').map(i=>i.value));
    return currentUsers.filter(u=>checked.has(String(u.email||u.id||u.name).toLowerCase()));
  }
  function init(){
    if(!document.body.classList.contains('departments-management-page')) return;
    refresh();
    $('#resetDepartmentForm')?.addEventListener('click', resetForm);
    $('#selectAllDepartmentUsers')?.addEventListener('click', ()=>$$('#departmentUsersPicker input').forEach(i=>i.checked=true));
    $('#clearDepartmentUsers')?.addEventListener('click', ()=>$$('#departmentUsersPicker input').forEach(i=>i.checked=false));
    $('#departmentForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const name = $('#departmentName').value.trim();
      if(!name){ alert('اكتب اسم القسم'); return; }
      const id = editingId || $('#departmentId').value || slug(name);
      await saveDepartment({ id, name, users: selectedUsersFromForm(), createdAt: new Date().toISOString() });
      await refresh(); resetForm(); alert('تم حفظ القسم وربطه باليوزرات.');
    });
    document.addEventListener('click', async e=>{
      const edit = e.target.closest('[data-edit-department]');
      if(edit){
        const dept = currentDepartments.find(d=>String(d.id)===String(edit.dataset.editDepartment));
        if(!dept) return;
        editingId = dept.id; $('#departmentFormTitle').textContent='تعديل قسم'; $('#departmentName').value=dept.name; $('#departmentId').value=dept.id; renderUserChecks(dept.users||[]); window.scrollTo({top:0, behavior:'smooth'});
      }
      const del = e.target.closest('[data-delete-department]');
      if(del && confirm('تمسح القسم ده؟')){ await deleteDepartment(del.dataset.deleteDepartment); await refresh(); resetForm(); }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
  window.MZJDepartments = { loadDepartments, loadUsers, saveDepartment };
})();
