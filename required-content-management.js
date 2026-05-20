(function(){
  const COLLECTION = 'required_content_types';
  const DEFAULT_SECTION_ID = 'section_general';
  const DEFAULT_SECTION_NAME = 'عام';

  let sections = [];
  let types = [];
  let unsubscribe = null;

  function esc(v){
    return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function slug(text){
    const base = String(text || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\u0600-\u06FFa-z0-9_-]/g, '');
    return base || ('section_' + Date.now());
  }

  function note(msg, ok = true){
    const el = document.getElementById('requiredContentNote');
    if(el){
      el.textContent = msg || '';
      el.style.color = ok ? '#3e2420' : '#9f332f';
    }
  }

  function db(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
    if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }

  function isSectionDoc(row){
    return row?.docType === 'section' || row?.kind === 'section' || row?.isSection === true;
  }

  function normalizeSection(row, id){
    const title = String(row?.title || row?.name || row?.categoryName || row?.sectionName || '').trim();
    if(!title) return null;
    return {
      id: id || row?.id || row?.categoryId || slug(title),
      title,
      active: row?.active !== false,
      createdAt: row?.createdAt || '',
      updatedAt: row?.updatedAt || ''
    };
  }

  function normalizeType(row, id){
    if(isSectionDoc(row)) return null;
    const title = String(row?.title || row?.name || row?.contentType || row?.label || '').trim();
    if(!title) return null;
    const categoryName = String(row?.categoryName || row?.contentSectionName || row?.sectionName || row?.groupName || row?.departmentName || '').trim();
    const categoryId = String(row?.categoryId || row?.sectionId || row?.contentSectionId || '').trim();
    return {
      id: id || row?.id || row?.docId || ('rct_' + Date.now()),
      title,
      details: String(row?.details || row?.description || row?.desc || '').trim(),
      categoryId: categoryId || (categoryName ? slug(categoryName) : DEFAULT_SECTION_ID),
      categoryName: categoryName || DEFAULT_SECTION_NAME,
      active: row?.active !== false,
      createdAt: row?.createdAt || '',
      updatedAt: row?.updatedAt || ''
    };
  }

  function collectSections(rawSections, rawTypes){
    const map = new Map();
    rawSections.filter(s => s.active !== false).forEach(section => map.set(String(section.id), section));
    rawTypes.filter(t => t.active !== false).forEach(type => {
      const id = String(type.categoryId || DEFAULT_SECTION_ID);
      if(!map.has(id)) map.set(id, { id, title: type.categoryName || DEFAULT_SECTION_NAME, active:true });
    });
    return Array.from(map.values()).sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
  }

  function renderLoadError(error){
    const list = document.getElementById('requiredContentList');
    const message = error?.message || error?.code || error || 'خطأ غير معروف';
    if(list){
      list.innerHTML = `<article class="empty-database-state">
        <div class="empty-icon">!</div>
        <div>
          <span class="eyebrow">المحتوى المطلوب</span>
          <h4>فشل تحميل الأقسام</h4>
          <p>${esc(message)}</p>
        </div>
      </article>`;
    }
    note('⚠️ فشل تحميل المحتوى المطلوب: ' + message, false);
  }

  function resetSectionForm(){
    const input = document.getElementById('requiredSectionTitle');
    if(input) input.value = '';
    note('');
  }

  function openForm(){
    const card = document.getElementById('requiredContentFormCard');
    if(card) card.hidden = false;
    resetSectionForm();
    document.getElementById('requiredSectionTitle')?.focus();
  }

  function closeForm(){
    const card = document.getElementById('requiredContentFormCard');
    if(card) card.hidden = true;
    resetSectionForm();
  }

  function render(){
    const list = document.getElementById('requiredContentList');
    if(!list) return;
    const visibleSections = sections.filter(section => section.active !== false);
    const visibleTypes = types.filter(type => type.active !== false);
    if(!visibleSections.length){
      list.innerHTML = `<article class="empty-database-state">
        <div class="empty-icon">RC</div>
        <div>
          <span class="eyebrow">المحتوى المطلوب</span>
          <h4>لا توجد أقسام محتوى</h4>
          <p>اضغط إضافة قسم محتوى، وبعدها أضف أنواع المحتوى داخله.</p>
        </div>
      </article>`;
      return;
    }

    list.innerHTML = visibleSections.map(section => {
      const sectionTypes = visibleTypes.filter(type => String(type.categoryId || DEFAULT_SECTION_ID) === String(section.id));
      const cards = sectionTypes.length ? sectionTypes.map(type => `
        <article class="required-content-card compact-required-type" data-required-content-id="${esc(type.id)}">
          <div>
            <span>نوع محتوى</span>
            <h4>${esc(type.title)}</h4>
            <p>${type.details ? esc(type.details) : 'بدون وصف إضافي'}</p>
          </div>
          <div class="required-content-actions">
            <button class="soft-btn" type="button" data-edit-required-type="${esc(type.id)}">تعديل</button>
            <button class="danger-btn" type="button" data-delete-required-type="${esc(type.id)}">مسح النوع</button>
          </div>
        </article>
      `).join('') : '<p class="required-content-empty">لا توجد أنواع داخل هذا القسم. أضف أول نوع محتوى.</p>';

      return `
        <section class="required-section-card" data-required-section-id="${esc(section.id)}">
          <div class="required-section-head">
            <div>
              <span class="eyebrow">قسم محتوى</span>
              <h4>${esc(section.title)}</h4>
              <p>${sectionTypes.length} نوع محتوى</p>
            </div>
            <div class="required-content-actions">
              <button class="danger-btn" type="button" data-delete-required-section="${esc(section.id)}">مسح القسم</button>
            </div>
          </div>
          <form class="required-type-inline-form" data-add-type-form="${esc(section.id)}">
            <input type="hidden" data-type-edit-id value="" />
            <label class="mzj-field">
              <span>اسم نوع المحتوى داخل القسم</span>
              <input type="text" data-type-title placeholder="مثال: Reel / Story / Post" required />
            </label>
            <label class="mzj-field">
              <span>وصف مختصر / ملاحظات</span>
              <input type="text" data-type-details placeholder="اختياري" />
            </label>
            <div class="form-actions-row">
              <button class="primary-btn" type="submit" data-type-submit>إضافة النوع</button>
              <button class="ghost-btn" type="button" data-cancel-type-edit hidden>إلغاء التعديل</button>
            </div>
          </form>
          <div class="required-content-grid required-section-types-grid">${cards}</div>
        </section>`;
    }).join('');
  }

  async function load(){
    const list = document.getElementById('requiredContentList');
    try{
      const firestore = db();
      if(unsubscribe) unsubscribe();
      unsubscribe = firestore.collection(COLLECTION).onSnapshot((snap) => {
        const rawSections = [];
        const rawTypes = [];
        snap.forEach(doc => {
          const data = doc.data() || {};
          if(isSectionDoc(data)){
            const section = normalizeSection(data, doc.id);
            if(section) rawSections.push(section);
          }else{
            const type = normalizeType(data, doc.id);
            if(type) rawTypes.push(type);
          }
        });
        types = rawTypes.sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
        sections = collectSections(rawSections, types);
        render();
        note('');
      }, (error) => {
        console.warn('required content live failed', error);
        renderLoadError(error);
      });
      setTimeout(() => {
        if(list && list.textContent.includes('جاري تحميل')) {
          sections = [];
          types = [];
          render();
        }
      }, 4000);
    }catch(error){
      renderLoadError(error);
    }
  }

  async function saveSection(event){
    event.preventDefault();
    const title = document.getElementById('requiredSectionTitle')?.value.trim();
    if(!title){
      note('⚠️ اكتب اسم قسم المحتوى.', false);
      return;
    }
    try{
      const now = new Date().toISOString();
      const sectionId = 'rcs_' + slug(title) + '_' + Date.now();
      await db().collection(COLLECTION).doc(sectionId).set({
        docType: 'section',
        kind: 'section',
        isSection: true,
        title,
        name: title,
        categoryName: title,
        active: true,
        createdAt: now,
        updatedAt: now
      }, { merge:true });
      note('✅ تم إضافة قسم المحتوى.');
      closeForm();
    }catch(error){
      note('⚠️ فشل حفظ القسم: ' + (error.message || error.code || error), false);
    }
  }

  async function saveType(event){
    event.preventDefault();
    const form = event.target.closest('[data-add-type-form]');
    if(!form) return;
    const sectionId = form.dataset.addTypeForm;
    const section = sections.find(item => String(item.id) === String(sectionId));
    const editId = form.querySelector('[data-type-edit-id]')?.value || '';
    const title = form.querySelector('[data-type-title]')?.value.trim();
    const details = form.querySelector('[data-type-details]')?.value.trim();
    if(!section){
      note('⚠️ القسم غير موجود.', false);
      return;
    }
    if(!title){
      note('⚠️ اكتب اسم نوع المحتوى.', false);
      return;
    }
    try{
      const now = new Date().toISOString();
      const payload = {
        docType: 'content_type',
        kind: 'content_type',
        title,
        name: title,
        contentType: title,
        details,
        description: details,
        categoryId: section.id,
        sectionId: section.id,
        contentSectionId: section.id,
        categoryName: section.title,
        sectionName: section.title,
        contentSectionName: section.title,
        departmentKind: 'global',
        departmentName: section.title,
        active: true,
        updatedAt: now
      };
      const id = editId || ('rct_' + Date.now());
      if(!editId) payload.createdAt = now;
      await db().collection(COLLECTION).doc(id).set(payload, { merge:true });
      form.reset();
      form.querySelector('[data-type-edit-id]').value = '';
      form.querySelector('[data-type-submit]').textContent = 'إضافة النوع';
      const cancel = form.querySelector('[data-cancel-type-edit]');
      if(cancel) cancel.hidden = true;
      note(editId ? '✅ تم تعديل نوع المحتوى.' : '✅ تم إضافة نوع المحتوى داخل القسم.');
    }catch(error){
      note('⚠️ فشل حفظ نوع المحتوى: ' + (error.message || error.code || error), false);
    }
  }

  async function removeType(id){
    if(!id) return;
    if(!confirm('تأكيد مسح نوع المحتوى؟')) return;
    try{
      await db().collection(COLLECTION).doc(id).delete();
      note('✅ تم مسح نوع المحتوى.');
    }catch(error){
      note('⚠️ فشل مسح النوع: ' + (error.message || error.code || error), false);
    }
  }

  async function removeSection(id){
    if(!id) return;
    const section = sections.find(item => String(item.id) === String(id));
    const sectionTypes = types.filter(item => String(item.categoryId) === String(id));
    if(!confirm(`تأكيد مسح قسم "${section?.title || ''}"؟ سيتم مسح ${sectionTypes.length} نوع محتوى داخله.`)) return;
    try{
      const firestore = db();
      const batch = firestore.batch();
      batch.delete(firestore.collection(COLLECTION).doc(id));
      sectionTypes.forEach(type => batch.delete(firestore.collection(COLLECTION).doc(type.id)));
      await batch.commit();
      note('✅ تم مسح القسم وكل الأنواع الموجودة داخله.');
    }catch(error){
      note('⚠️ فشل مسح القسم: ' + (error.message || error.code || error), false);
    }
  }

  function startEditType(id){
    const type = types.find(item => String(item.id) === String(id));
    if(!type) return;
    const form = Array.from(document.querySelectorAll('[data-add-type-form]')).find(el => String(el.dataset.addTypeForm) === String(type.categoryId || DEFAULT_SECTION_ID));
    if(!form) return;
    form.querySelector('[data-type-edit-id]').value = type.id;
    form.querySelector('[data-type-title]').value = type.title || '';
    form.querySelector('[data-type-details]').value = type.details || '';
    form.querySelector('[data-type-submit]').textContent = 'حفظ التعديل';
    const cancel = form.querySelector('[data-cancel-type-edit]');
    if(cancel) cancel.hidden = false;
    form.scrollIntoView({ behavior:'smooth', block:'center' });
    form.querySelector('[data-type-title]')?.focus();
  }

  function cancelEdit(form){
    if(!form) return;
    form.reset();
    form.querySelector('[data-type-edit-id]').value = '';
    form.querySelector('[data-type-submit]').textContent = 'إضافة النوع';
    const cancel = form.querySelector('[data-cancel-type-edit]');
    if(cancel) cancel.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openRequiredContentForm')?.addEventListener('click', () => openForm());
    document.getElementById('cancelRequiredContent')?.addEventListener('click', closeForm);
    document.getElementById('requiredSectionForm')?.addEventListener('submit', saveSection);

    document.addEventListener('submit', (event) => {
      if(event.target?.matches?.('[data-add-type-form]')) saveType(event);
    });

    document.addEventListener('click', (event) => {
      const delSection = event.target.closest('[data-delete-required-section]');
      if(delSection){
        removeSection(delSection.dataset.deleteRequiredSection);
        return;
      }
      const editType = event.target.closest('[data-edit-required-type]');
      if(editType){
        startEditType(editType.dataset.editRequiredType);
        return;
      }
      const delType = event.target.closest('[data-delete-required-type]');
      if(delType){
        removeType(delType.dataset.deleteRequiredType);
        return;
      }
      const cancel = event.target.closest('[data-cancel-type-edit]');
      if(cancel){
        cancelEdit(cancel.closest('[data-add-type-form]'));
      }
    });

    load();
  });

  window.addEventListener('beforeunload', () => {
    try{ if(typeof unsubscribe === 'function') unsubscribe(); }catch(e){}
  });
})();
