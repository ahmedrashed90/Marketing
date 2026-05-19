
(function(){
  const COLLECTION = 'required_content_types';
  const DEPTS = { global: 'كل الأقسام' };

  let items = [];
  let unsubscribe = null;

  function esc(v){
    return String(v || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function note(msg, ok = true){
    const el = document.getElementById('requiredContentNote');
    if(el){
      el.textContent = msg || '';
      el.style.color = ok ? '#3e2420' : '#9f332f';
    }
  }

  function renderLoadError(error){
    const list = document.getElementById('requiredContentList');
    const message = error?.message || error?.code || error || 'خطأ غير معروف';
    if(list){
      list.innerHTML = `<article class="empty-database-state">
        <div class="empty-icon">!</div>
        <div>
          <span class="eyebrow">المحتوى المطلوب</span>
          <h4>فشل تحميل الأنواع</h4>
          <p>${esc(message)}</p>
        </div>
      </article>`;
    }
    note('⚠️ فشل تحميل المحتوى المطلوب: ' + message, false);
  }

  function db(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }

  function normalize(row, id){
    const title = String(row?.title || row?.name || row?.contentType || '').trim();
    if(!title) return null;
    return {
      id: id || row.id || '',
      title,
      details: String(row.details || row.description || '').trim(),
      departmentKind: 'global',
      departmentName: 'كل الأقسام',
      active: row.active !== false,
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    };
  }

  function resetForm(){
    document.getElementById('requiredContentId').value = '';
    document.getElementById('requiredContentTitle').value = '';
    document.getElementById('requiredContentDetails').value = '';
    note('');
  }

  function openForm(item){
    const card = document.getElementById('requiredContentFormCard');
    if(card) card.hidden = false;
    if(item){
      document.getElementById('requiredContentId').value = item.id || '';
      document.getElementById('requiredContentTitle').value = item.title || '';
      document.getElementById('requiredContentDetails').value = item.details || '';
    }else{
      resetForm();
    }
    document.getElementById('requiredContentTitle')?.focus();
  }

  function closeForm(){
    const card = document.getElementById('requiredContentFormCard');
    if(card) card.hidden = true;
    resetForm();
  }

  function render(){
    const list = document.getElementById('requiredContentList');
    if(!list) return;
    const visible = items.filter(item => item.active !== false);
    if(!visible.length){
      list.innerHTML = `<article class="empty-database-state">
        <div class="empty-icon">RC</div>
        <div>
          <span class="eyebrow">المحتوى المطلوب</span>
          <h4>لا توجد أنواع محتوى</h4>
          <p>اضغط إضافة نوع محتوى لإضافة اختيارات تظهر بعد كده في الداش بورد.</p>
        </div>
      </article>`;
      return;
    }

    list.innerHTML = visible.map(item => `
      <article class="required-content-card" data-required-content-id="${esc(item.id)}">
        <div>
          <span>${esc(DEPTS[item.departmentKind] || item.departmentName || 'عام')}</span>
          <h4>${esc(item.title)}</h4>
          <p>${item.details ? esc(item.details) : 'بدون وصف إضافي'}</p>
        </div>
        <div class="required-content-actions">
          <button class="soft-btn" type="button" data-edit-required-content="${esc(item.id)}">تعديل</button>
          <button class="danger-btn" type="button" data-delete-required-content="${esc(item.id)}">مسح</button>
        </div>
      </article>
    `).join('');
  }

  async function load(){
    const list = document.getElementById('requiredContentList');
    try{
      const firestore = db();
      if(unsubscribe) unsubscribe();

      // بدون orderBy عشان الصفحة ما تحتاجش index وما تعلقش على جاري التحميل
      unsubscribe = firestore.collection(COLLECTION).onSnapshot((snap) => {
        items = [];
        snap.forEach(doc => {
          const item = normalize(doc.data() || {}, doc.id);
          if(item) items.push(item);
        });
        items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
        render();
        note('');
      }, (error) => {
        console.warn('required content live failed', error);
        renderLoadError(error);
      });

      // أمان: لو الـ onSnapshot ما رجعش بسرعة لأي سبب، نعرض حالة فاضية بدل التحميل المستمر
      setTimeout(() => {
        if(list && list.textContent.includes('جاري تحميل')) {
          items = [];
          render();
        }
      }, 4000);
    }catch(error){
      renderLoadError(error);
    }
  }

  async function save(event){
    event.preventDefault();
    const id = document.getElementById('requiredContentId').value || '';
    const title = document.getElementById('requiredContentTitle').value.trim();
    const details = document.getElementById('requiredContentDetails').value.trim();
    if(!title){
      note('⚠️ اكتب اسم نوع المحتوى.', false);
      return;
    }
    try{
      const now = new Date().toISOString();
      const payload = {
        title,
        name: title,
        details,
        description: details,
        departmentKind: 'global',
        departmentName: 'كل الأقسام',
        active: true,
        updatedAt: now
      };
      const firestore = db();
      if(id){
        await firestore.collection(COLLECTION).doc(id).set(payload, { merge:true });
        items = items.map((item) => item.id === id ? normalize({ ...item, ...payload }, id) : item).filter(Boolean);
        note('✅ تم تعديل نوع المحتوى.');
      }else{
        payload.createdAt = now;
        const newId = 'rct_' + Date.now();
        await firestore.collection(COLLECTION).doc(newId).set(payload, { merge:true });
        const item = normalize(payload, newId);
        if(item) items.unshift(item);
        note('✅ تم إضافة نوع المحتوى.');
      }
      render();
      closeForm();
    }catch(error){
      note('⚠️ فشل الحفظ: ' + (error.message || error.code || error), false);
    }
  }

  async function remove(id){
    if(!id) return;
    if(!confirm('تأكيد مسح نوع المحتوى؟')) return;
    try{
      await db().collection(COLLECTION).doc(id).delete();
      note('✅ تم مسح نوع المحتوى.');
    }catch(error){
      note('⚠️ فشل المسح: ' + (error.message || error.code || error), false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openRequiredContentForm')?.addEventListener('click', () => openForm());
    document.getElementById('cancelRequiredContent')?.addEventListener('click', closeForm);
    document.getElementById('requiredContentForm')?.addEventListener('submit', save);

    document.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit-required-content]');
      if(edit){
        const item = items.find(x => String(x.id) === String(edit.dataset.editRequiredContent));
        if(item) openForm(item);
        return;
      }
      const del = event.target.closest('[data-delete-required-content]');
      if(del){
        remove(del.dataset.deleteRequiredContent);
      }
    });

    load();
  });

  window.addEventListener('beforeunload', () => {
    try{ if(typeof unsubscribe === 'function') unsubscribe(); }catch(e){}
  });
})();
