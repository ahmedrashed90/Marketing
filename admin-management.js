(function(){
  const USERS_KEY = 'mzj_admin_users_cache_v1';
  const LEGACY_USERS_KEY = 'users';
  const OLD_USERS_KEY = 'users';
  const pages = [
    ['admin','صفحة الإدارة','admin.html'],['stock','صفحة الاستوك','stock.html'],['dailyTasks','تاسكات يومية','daily-tasks.html'],['content','المحتوى','content.html'],['departments','الأقسام','departments.html'],['database','قاعدة البيانات','database.html'],['dashboard','الداش بورد','dashboard.html'],['campaignsCalendar','الحملات والأجندات','campaigns-calendar.html'],['taskTemplates','قوالب الحملات','templates.html']
  ];
  const deps = [['management','الإدارة'],['photography','قسم التصوير'],['content','قسم المحتوى'],['design','قسم التصميم'],['editing','قسم المونتاج'],['publishing','قسم النشر'],['archive','قسم الأرشيف']];
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  function uniqueUsers(arr){
    const map = new Map();
    (arr || []).forEach(u => {
      if(!u) return;
      const obj = typeof u === 'string' ? {name:u,email:u} : u;
      const key = String(obj.email || obj.name || obj.id || '').toLowerCase();
      if(key) map.set(key, {...(map.get(key)||{}), ...obj});
    });
    return Array.from(map.values());
  }
  function load(){
    const all=[];
    [USERS_KEY, LEGACY_USERS_KEY, OLD_USERS_KEY].forEach(key=>{
      try{ const v=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(v)) all.push(...v); }catch(e){}
    });
    return uniqueUsers(all);
  }
  function save(v){
    const users = uniqueUsers(v);
    localStorage.setItem(USERS_KEY,JSON.stringify(users));
    localStorage.setItem(LEGACY_USERS_KEY,JSON.stringify(users));
    localStorage.setItem(OLD_USERS_KEY,JSON.stringify(users));
  }
  function canUseFirestore(){return window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore}
  async function addFirestoreUser(user){
    if(!canUseFirestore()) return null;
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    const ref = await firebase.firestore().collection('users').add(user);
    return ref.id;
  }
  async function loadFirestoreUsers(){
    if(!canUseFirestore()) return null;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('users').get();
      return uniqueUsers(snap.docs.map(d=>({id:d.id,...d.data()})).concat(load()));
    }catch(e){console.warn('user firestore fallback',e);return null;}
  }
  function esc(v){return String(v??'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
  function renderChecks(){
    const box = $('#adminPagesAccess'); if(!box) return;
    box.innerHTML = pages.map(p=>`<label class="permission-chip"><input type="checkbox" value="${p[0]}"><span>${p[1]}</span></label>`).join('');
    $$('#adminPagesAccess input').forEach(i=>i.checked = ['dashboard','database'].includes(i.value));
  }
  async function renderUsers(){
    const list = $('#adminUsersList'); if(!list) return;
    const cloud = await loadFirestoreUsers();
    const users = cloud || load();
    if(!users.length){list.innerHTML='<p class="template-empty">لسه مفيش يوزرات مضافة من صفحة الإدارة.</p>';return;}
    list.innerHTML = users.map(u=>`
      <article class="user-permission-card">
        <div><strong>${esc(u.name||u.email)}</strong><small>${esc(u.email)} · ${esc(u.role||'user')} · ${esc(u.department||'-')}</small></div>
        <div class="user-pages-list">${(u.pagesAccess||[]).map(k=>`<span>${esc((pages.find(p=>p[0]===k)||[])[1]||k)}</span>`).join('')}</div>
      </article>`).join('');
  }
  function init(){
    if(!document.body.classList.contains('admin-management-page')) return;
    const dep = $('#adminUserDepartment'); if(dep) dep.innerHTML = deps.map(d=>`<option value="${d[0]}">${d[1]}</option>`).join('');
    renderChecks(); renderUsers();
    $('#checkAllPages')?.addEventListener('click',()=>$$('#adminPagesAccess input').forEach(i=>i.checked=true));
    $('#clearPages')?.addEventListener('click',()=>$$('#adminPagesAccess input').forEach(i=>i.checked=false));
    $('#adminUserRole')?.addEventListener('change', e=>{ if(e.target.value==='admin') $$('#adminPagesAccess input').forEach(i=>i.checked=true); });
    $('#adminUserForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const current = window.MZJAuth?.getUser?.() || {};
      const user = {
        name: $('#adminUserName').value.trim(), email: $('#adminUserEmail').value.trim(), role: $('#adminUserRole').value, password: $('#adminUserPassword')?.value || '123456',
        department: $('#adminUserDepartment').value, pagesAccess: $$('#adminPagesAccess input:checked').map(i=>i.value),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: current.id || current.email || 'admin'
      };
      if(!user.name || !user.email){ alert('اكتب اسم اليوزر والإيميل'); return; }
      if(!user.pagesAccess.length && user.role !== 'admin'){ alert('اختار صفحة واحدة على الأقل لليوزر'); return; }
      try{ const id = await addFirestoreUser(user); if(id) user.id=id; }catch(err){ console.warn(err); }
      const users=load().filter(u=>u.email!==user.email); users.push(user); save(users);
      $('#adminUserForm').reset(); renderChecks(); await renderUsers(); alert('تم حفظ اليوزر في مسار user وتجهيز صلاحيات الصفحات');
    });
  }
  document.addEventListener('DOMContentLoaded',init);
})();
