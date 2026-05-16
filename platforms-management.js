(function(){
  const COLLECTION = 'marketing_platforms';
  const DEFAULTS = ['سناب شات','تيك توك','انستجرام','فيس بوك','يوتيوب','جوجل','لينكد ان','حملات واتساب','TV'];
  const $ = (s,r=document)=>r.querySelector(s);
  let editingId = '';

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function db(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }
  function slugify(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,'_');}
  function note(text){ const el=$('#platformNote'); if(el) el.textContent=text; }
  function reset(){
    editingId='';
    $('#platformForm')?.reset();
    const active=$('#platformActive'); if(active) active.checked=true;
    const btn=$('#savePlatformBtn'); if(btn) btn.textContent='حفظ المنصة';
    const cancel=$('#cancelPlatformEdit'); if(cancel) cancel.hidden=true;
  }
  async function loadPlatforms(){
    const firestore=db();
    const snap=await firestore.collection(COLLECTION).get();
    return snap.docs.map(d=>({id:d.id,...(d.data()||{})}));
  }
  async function render(){
    const list=$('#platformsList');
    if(!list) return;
    list.innerHTML='<p class="template-empty">جاري تحميل المنصات...</p>';
    try{
      const rows=await loadPlatforms();
      if(!rows.length){list.innerHTML='<p class="template-empty">لا توجد منصات محفوظة. اضغط إضافة المنصات الأساسية أو أضف منصة جديدة.</p>';return;}
      list.innerHTML=rows.map(row=>`<article class="platform-card ${row.active===false?'is-disabled':''}">
        <div><strong>${esc(row.name)}</strong><small>${esc(row.key||'')} · ${row.active===false?'غير مفعلة':'مفعلة'}</small></div>
        <div class="task-card-actions">
          <button class="soft-btn" type="button" data-edit-platform="${esc(row.id)}">تعديل</button>
          <button class="danger-btn" type="button" data-delete-platform="${esc(row.id)}">مسح</button>
        </div>
      </article>`).join('');
    }catch(error){
      list.innerHTML='<p class="template-empty">فشل تحميل المنصات من Firebase: '+esc(error.message||error.code||error)+'</p>';
    }
  }
  async function savePlatform(event){
    event.preventDefault();
    const name=$('#platformName')?.value.trim();
    if(!name){note('⚠️ اكتب اسم المنصة.');return;}
    const payload={
      name,
      key: $('#platformKey')?.value.trim() || slugify(name),
      active: Boolean($('#platformActive')?.checked),
      updatedAt: new Date().toISOString(),
      updatedBy: window.MZJAuth?.getUser?.()?.email || 'admin'
    };
    try{
      const firestore=db();
      if(editingId){
        await firestore.collection(COLLECTION).doc(editingId).set(payload,{merge:true});
        note('✅ تم تحديث المنصة.');
      }else{
        payload.createdAt=new Date().toISOString();
        payload.createdBy=window.MZJAuth?.getUser?.()?.email || 'admin';
        await firestore.collection(COLLECTION).add(payload);
        note('✅ تم حفظ المنصة.');
      }
      reset();
      await render();
    }catch(error){
      note('⚠️ فشل الحفظ في Firebase: '+(error.message||error.code||error));
    }
  }
  async function seedDefaults(){
    try{
      const firestore=db();
      const existing=await loadPlatforms();
      const names=new Set(existing.map(p=>String(p.name||'').trim().toLowerCase()));
      const batch=firestore.batch();
      DEFAULTS.forEach((name,index)=>{
        if(names.has(name.toLowerCase())) return;
        const ref=firestore.collection(COLLECTION).doc();
        batch.set(ref,{name,key:slugify(name)||('platform_'+index),active:true,createdAt:new Date().toISOString(),createdBy:window.MZJAuth?.getUser?.()?.email||'admin',updatedAt:new Date().toISOString()});
      });
      await batch.commit();
      note('✅ تم إضافة المنصات الأساسية.');
      await render();
    }catch(error){note('⚠️ فشل إضافة المنصات: '+(error.message||error.code||error));}
  }
  document.addEventListener('click',async(event)=>{
    const edit=event.target.closest('[data-edit-platform]');
    const del=event.target.closest('[data-delete-platform]');
    if(edit){
      const rows=await loadPlatforms();
      const row=rows.find(r=>String(r.id)===String(edit.dataset.editPlatform));
      if(!row) return;
      editingId=row.id;
      $('#platformName').value=row.name||'';
      $('#platformKey').value=row.key||'';
      $('#platformActive').checked=row.active!==false;
      $('#savePlatformBtn').textContent='تحديث المنصة';
      $('#cancelPlatformEdit').hidden=false;
      document.querySelector('.platforms-panel')?.scrollIntoView({behavior:'smooth'});
    }
    if(del){
      if(!confirm('تمسح المنصة من Firebase؟')) return;
      try{await db().collection(COLLECTION).doc(del.dataset.deletePlatform).delete(); note('✅ تم مسح المنصة.'); await render();}
      catch(error){note('⚠️ فشل المسح: '+(error.message||error.code||error));}
    }
  });
  document.addEventListener('DOMContentLoaded',()=>{
    $('#platformForm')?.addEventListener('submit',savePlatform);
    $('#cancelPlatformEdit')?.addEventListener('click',reset);
    $('#seedDefaultPlatforms')?.addEventListener('click',seedDefaults);
    render();
  });
})();
