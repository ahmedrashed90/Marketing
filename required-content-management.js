(function(){
  const COLLECTION = 'required_content_types';
  const SECTION_DOC_TYPE = 'section';
  const TYPE_DOC_TYPE = 'type';

  let sections = [];
  let types = [];
  let unsubscribe = null;

  function esc(v){
    return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function slug(v){
    return String(v || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || ('section-' + Date.now());
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

  function normalizeSection(row, id){
    const title = String(row?.sectionName || row?.title || row?.name || '').trim();
    if(!title) return null;
    return {
      id: id || row.id || slug(title),
      title,
      name: title,
      details: String(row.details || row.description || '').trim(),
      active: row.active !== false,
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    };
  }

  function normalizeType(row, id){
    const title = String(row?.title || row?.name || row?.contentType || '').trim();
    if(!title) return null;
    const sectionName = String(row?.sectionName || row?.contentSectionName || row?.categoryName || '').trim() || 'عام';
    const sectionId = String(row?.sectionId || row?.contentSectionId || slug(sectionName)).trim();
    return {
      id: id || row.id || '',
      title,
      name: title,
      details: String(row.details || row.description || '').trim(),
      sectionId,
      sectionName,
      active: row.active !== false,
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    };
  }

  function resetSectionForm(){
    const id = document.getElementById('contentSectionId');
    const title = document.getElementById('contentSectionTitle');
    const details = document.getElementById('contentSectionDetails');
    if(id) id.value = '';
    if(title) title.value = '';
    if(details) details.value = '';
    note('');
  }

  function openSectionForm(section){
    const card = document.getElementById('contentSectionFormCard');
    if(card) card.hidden = false;
    resetSectionForm();
    if(section){
      document.getElementById('contentSectionId').value = section.id || '';
      document.getElementById('contentSectionTitle').value = section.title || '';
      document.getElementById('contentSectionDetails').value = section.details || '';
    }
    document.getElementById('contentSectionTitle')?.focus();
  }

  function closeSectionForm(){
    const card = document.getElementById('contentSectionFormCard');
    if(card) card.hidden = true;
    resetSectionForm();
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

  function sectionTypes(section){
    return types.filter((item) => item.active !== false && String(item.sectionId) === String(section.id));
  }

  function render(){
    const list = document.getElementById('requiredContentList');
    if(!list) return;
    const visibleSections = sections.filter(item => item.active !== false);
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
      const sectionItems = sectionTypes(section);
      return `<article class="required-content-section-card" data-content-section-id="${esc(section.id)}">
        <div class="required-content-section-head">
          <div>
            <span class="eyebrow">قسم محتوى</span>
            <h4>${esc(section.title)}</h4>
            <p>${section.details ? esc(section.details) : 'أضف أنواع المحتوى الخاصة بهذا القسم.'}</p>
          </div>
          <div class="required-content-actions">
            <button class="soft-btn" type="button" data-edit-content-section="${esc(section.id)}">تعديل القسم</button>
            <button class="danger-btn" type="button" data-delete-content-section="${esc(section.id)}">مسح القسم</button>
          </div>
        </div>
        <form class="required-content-type-inline" data-add-type-form="${esc(section.id)}">
          <input type="text" data-new-type-title placeholder="اكتب نوع محتوى داخل ${esc(section.title)}" required>
          <input type="text" data-new-type-details placeholder="ملاحظات / وصف اختياري">
          <button class="primary-btn" type="submit">+ إضافة النوع</button>
        </form>
        <div class="required-content-types-list">
          ${sectionItems.length ? sectionItems.map(item => `<div class="required-content-type-pill" data-required-content-id="${esc(item.id)}">
            <div><strong>${esc(item.title)}</strong>${item.details ? `<small>${esc(item.details)}</small>` : ''}</div>
            <button class="danger-soft-btn" type="button" data-delete-required-content="${esc(item.id)}">مسح النوع</button>
          </div>`).join('') : '<p class="required-content-empty">لا توجد أنواع محتوى داخل هذا القسم حتى الآن.</p>'}
        </div>
      </article>`;
    }).join('');
  }

  async function load(){
    const list = document.getElementById('requiredContentList');
    try{
      const firestore = db();
      if(unsubscribe) unsubscribe();
      unsubscribe = firestore.collection(COLLECTION).onSnapshot((snap) => {
        sections = [];
        types = [];
        snap.forEach(doc => {
          const data = doc.data() || {};
          if(data.docType === SECTION_DOC_TYPE || data.kind === SECTION_DOC_TYPE || data.isContentSection === true){
            const section = normalizeSection(data, doc.id);
            if(section) sections.push(section);
          }else{
            const type = normalizeType(data, doc.id);
            if(type) types.push(type);
          }
        });

        const sectionMap = new Map(sections.map((section) => [String(section.id), section]));
        types.forEach((type) => {
          if(!sectionMap.has(String(type.sectionId))){
            const section = normalizeSection({ title: type.sectionName || 'عام', details: '' }, type.sectionId || slug(type.sectionName || 'عام'));
            if(section){ sections.push(section); sectionMap.set(String(section.id), section); }
          }
        });
        sections.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
        types.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
        render();
        note('');
      }, renderLoadError);
      setTimeout(() => {
        if(list && list.textContent.includes('جاري تحميل')) render();
      }, 4000);
    }catch(error){
      renderLoadError(error);
    }
  }

  async function saveSection(event){
    event.preventDefault();
    const id = document.getElementById('contentSectionId').value || '';
    const title = document.getElementById('contentSectionTitle').value.trim();
    const details = document.getElementById('contentSectionDetails').value.trim();
    if(!title){ note('⚠️ اكتب اسم قسم المحتوى.', false); return; }
    try{
      const now = new Date().toISOString();
      const newId = id || ('rcs_' + slug(title) + '_' + Date.now());
      const payload = {
        docType: SECTION_DOC_TYPE,
        kind: SECTION_DOC_TYPE,
        isContentSection: true,
        title,
        name: title,
        sectionName: title,
        details,
        description: details,
        active: true,
        updatedAt: now
      };
      if(!id) payload.createdAt = now;
      await db().collection(COLLECTION).doc(newId).set(payload, { merge:true });
      note(id ? '✅ تم تعديل قسم المحتوى.' : '✅ تم إضافة قسم المحتوى.');
      closeSectionForm();
    }catch(error){
      note('⚠️ فشل حفظ القسم: ' + (error.message || error.code || error), false);
    }
  }

  async function addType(event){
    event.preventDefault();
    const form = event.target.closest('[data-add-type-form]');
    const sectionId = form?.dataset.addTypeForm || '';
    const section = sections.find((item) => String(item.id) === String(sectionId));
    const titleInput = form?.querySelector('[data-new-type-title]');
    const detailsInput = form?.querySelector('[data-new-type-details]');
    const title = titleInput?.value.trim() || '';
    const details = detailsInput?.value.trim() || '';
    if(!section || !title){ note('⚠️ اختار القسم واكتب نوع المحتوى.', false); return; }
    try{
      const now = new Date().toISOString();
      const id = 'rct_' + slug(section.title) + '_' + Date.now();
      await db().collection(COLLECTION).doc(id).set({
        docType: TYPE_DOC_TYPE,
        kind: TYPE_DOC_TYPE,
        title,
        name: title,
        contentType: title,
        details,
        description: details,
        sectionId: section.id,
        contentSectionId: section.id,
        sectionName: section.title,
        contentSectionName: section.title,
        active: true,
        createdAt: now,
        updatedAt: now
      }, { merge:true });
      if(titleInput) titleInput.value = '';
      if(detailsInput) detailsInput.value = '';
      note('✅ تم إضافة نوع المحتوى داخل القسم.');
    }catch(error){
      note('⚠️ فشل إضافة النوع: ' + (error.message || error.code || error), false);
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
    const section = sections.find((item) => String(item.id) === String(id));
    if(!section) return;
    const related = sectionTypes(section);
    if(!confirm(`تأكيد مسح قسم "${section.title}"؟ سيتم مسح ${related.length} نوع محتوى داخله.`)) return;
    try{
      const firestore = db();
      const batch = firestore.batch();
      batch.delete(firestore.collection(COLLECTION).doc(id));
      related.forEach((item) => batch.delete(firestore.collection(COLLECTION).doc(item.id)));
      await batch.commit();
      note('✅ تم مسح القسم وكل الأنواع داخله.');
    }catch(error){
      note('⚠️ فشل مسح القسم: ' + (error.message || error.code || error), false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openContentSectionForm')?.addEventListener('click', () => openSectionForm());
    document.getElementById('cancelContentSection')?.addEventListener('click', closeSectionForm);
    document.getElementById('contentSectionForm')?.addEventListener('submit', saveSection);

    document.addEventListener('submit', (event) => {
      if(event.target?.matches?.('[data-add-type-form]')) addType(event);
    });

    document.addEventListener('click', (event) => {
      const editSection = event.target.closest('[data-edit-content-section]');
      if(editSection){
        const section = sections.find(x => String(x.id) === String(editSection.dataset.editContentSection));
        if(section) openSectionForm(section);
        return;
      }
      const delSection = event.target.closest('[data-delete-content-section]');
      if(delSection){ removeSection(delSection.dataset.deleteContentSection); return; }
      const delType = event.target.closest('[data-delete-required-content]');
      if(delType){ removeType(delType.dataset.deleteRequiredContent); }
    });

    load();
  });

  window.addEventListener('beforeunload', () => {
    try{ if(typeof unsubscribe === 'function') unsubscribe(); }catch(e){}
  });
})();
