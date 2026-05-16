(function(){
  const FIRESTORE_TASK_COLLECTIONS = ['workspace_tasks'];
  let firestoreRecords = [];

  const DEPARTMENT_ALIASES = {
    photography: ['photography','photo','قسم التصوير','التصوير','تصوير'],
    content: ['content','قسم المحتوى','المحتوى','كتابة المحتوى'],
    design: ['design','قسم التصميم','التصميم','مصمم'],
    video: ['video','montage','قسم المونتاج','المونتاج','الفيديو','قسم الفيديو'],
    publish: ['publish','posting','قسم النشر','النشر'],
    archive: ['archive','قسم الارشيف','قسم الأرشيف','الأرشيف']
  };

  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
  }

  function normalizeDate(value){
    if(!value) return '';
    if(typeof value === 'string') return value;
    if(value && typeof value.toDate === 'function') return value.toDate().toISOString().slice(0,10);
    if(value && typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString().slice(0,10);
    try { return new Date(value).toISOString().slice(0,10); } catch(e) { return String(value); }
  }

  function formatDate(value){
    const raw = normalizeDate(value);
    if(!raw) return '--';
    const d = new Date(raw);
    if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB');
    return raw;
  }

  function calcDelay(required, delivered){
    if(!required) return 'لا يوجد تاريخ مطلوب';
    const req = new Date(normalizeDate(required));
    if(Number.isNaN(req.getTime())) return '--';
    const end = delivered ? new Date(normalizeDate(delivered)) : new Date();
    const days = Math.ceil((end - req) / 86400000);
    return days > 0 ? `${days} يوم تأخير` : 'لا يوجد تأخير';
  }

  function currentUser(){
    try { return JSON.parse(localStorage.getItem('mzj_current_user') || localStorage.getItem('marketingCurrentUser') || '{}'); }
    catch(e){ return {}; }
  }

  function isAdmin(){
    const user = currentUser();
    const role = String(user.role || '').toLowerCase();
    return role === 'admin' || role === 'administrator' || String(user.email||'').toLowerCase() === 'mr.ahmed_rashed@outlook.sa';
  }

  function normalizeRecord(r, fallbackId){
    if(!r || typeof r !== 'object') return null;
    const labelRaw = r.taskTypeLabel || r.taskType || r.type || r.kind || 'حملة';
    const labelText = String(labelRaw).toLowerCase();
    const type = String(labelRaw).includes('أج') || labelText.includes('agenda') ? 'أجندة' : (String(labelRaw).includes('تاسك') ? 'تاسك' : 'حملة');
    const departmentTasks = Array.isArray(r.departmentTasks) ? r.departmentTasks : (Array.isArray(r.assignedDepartments) ? r.assignedDepartments : []);
    return {
      ...r,
      id: r.id || r.firestoreId || r.docId || fallbackId,
      type,
      name: r.name || r.campaignName || r.title || r.agendaName || r.taskName || 'حملة / أجندة',
      code: r.code || r.campaignCode || r.taskCode || r.campaignSerial || '',
      goal: r.goal || r.campaignGoal || r.taskGoal || r.objective || '',
      launchDate: r.launchDate || r.campaignLaunchDate || r.publishDate || r.date || r.dueDate || '',
      requiredDate: r.requiredDate || r.deadline || r.launchDate || r.dueDate || '',
      deliveryDate: r.deliveryDate || r.completedAt || r.deliveredAt || '',
      createdAt: r.createdAt || r.created || '',
      departmentTasks,
      publishScheduleEntries: Array.isArray(r.publishScheduleEntries) ? r.publishScheduleEntries : (Array.isArray(r.scheduleEntries) ? r.scheduleEntries : []),
      budgetDetails: r.budgetDetails || r.budget || {},
      resultsDetails: r.resultsDetails || r.results || r.campaignResults || null,
      sourceFirestoreCollection: r.sourceFirestoreCollection || 'workspace_tasks'
    };
  }

  function loadRecords(){
    const map = new Map();
    firestoreRecords.map((item, idx) => normalizeRecord(item, 'firestore_' + idx)).filter(Boolean).forEach((item) => {
      map.set(String(item.id), item);
    });
    return Array.from(map.values()).sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }

  async function loadFirestoreRecords(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) return;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const loaded=[];
      for(const col of FIRESTORE_TASK_COLLECTIONS){
        const snap = await firebase.firestore().collection(col).get();
        snap.forEach(doc => loaded.push({id: doc.id, firestoreId: doc.id, sourceFirestoreCollection: col, ...(doc.data() || {})}));
      }
      firestoreRecords = loaded;
      render();
    }catch(err){
      console.warn('فشل قراءة workspace_tasks:', err);
      const holder=document.getElementById('campaignRecordsLive');
      if(holder) holder.innerHTML = `<article class="empty-database-state"><div class="empty-icon">!</div><div><span class="eyebrow">فشل قراءة Firebase</span><h4>${esc(err.message || err.code || err)}</h4><p>راجع قواعد Firestore لمسار workspace_tasks.</p></div></article>`;
    }
  }

  function deptKey(task){
    const raw = [task.departmentKey, task.departmentId, task.departmentName, task.department, task.sectionName, task.section].filter(Boolean).join(' ').toLowerCase();
    for(const [key, aliases] of Object.entries(DEPARTMENT_ALIASES)){
      if(aliases.some(a => raw.includes(String(a).toLowerCase()))) return key;
    }
    return 'other';
  }

  function departmentLabel(task){
    return task.departmentName || task.department || task.sectionName || task.section || 'قسم غير محدد';
  }

  function personLabel(task){
    return task.userName || task.assigneeName || task.userDisplayName || task.responsibleName || task.name || task.userEmail || task.assigneeEmail || '--';
  }

  function taskReceiveDate(task){ return task.receiveDate || task.startDate || task.receivedAt || task.acceptedAt || task.taskReceiveDate || ''; }
  function taskRequiredDate(task, record){ return task.requiredDate || task.deadline || task.dueDate || record.requiredDate || record.launchDate || ''; }
  function taskDeliveryDate(task){ return task.deliveryDate || task.submittedAt || task.doneAt || task.deliveredAt || ''; }

  function dateForInput(value){
    const raw = normalizeDate(value);
    if(!raw || raw === '--') return '';
    const d = new Date(raw);
    if(!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
    const m = String(raw).match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    return '';
  }

  function renderDeptSummary(record, key){
    const tasks = record.departmentTasks.filter(t => deptKey(t) === key);
    if(!tasks.length) return '<span class="db-muted">--</span>';
    return tasks.map((task) => `
      <div class="db-dept-mini">
        <strong>${esc(personLabel(task))}</strong>
        <small>استلام: ${esc(formatDate(taskReceiveDate(task)))}</small>
        <small>مطلوب: ${esc(formatDate(taskRequiredDate(task, record)))}</small>
        <small>تسليم: ${esc(formatDate(taskDeliveryDate(task)))}</small>
        <small class="${calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)).includes('تأخير') ? 'is-late' : ''}">وقت التأخير: ${esc(calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)))}</small>
      </div>
    `).join('');
  }

  function renderCellButton(record){
    return `<button class="view-btn db-one-view-btn" type="button" data-db-details="${esc(record.id)}">عرض البيانات</button>`;
  }

  function scheduleHtml(record){
    const rows = record.publishScheduleEntries || [];
    if(!rows.length && !record.publishScheduleResult) return '<p class="db-empty-line">لا يوجد جدول نشر محفوظ.</p>';
    const result = record.publishScheduleResult ? `<p class="db-note-line"><strong>ملخص جدول النشر:</strong> ${esc(record.publishScheduleResult)}</p>` : '';
    const table = rows.length ? `<div class="db-inner-table"><table><thead><tr><th>اليوم</th><th>التاريخ</th><th>ما سيتم نشره</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.day || '--')}</td><td>${esc(formatDate(r.date))}</td><td>${esc(r.content || '--')}</td></tr>`).join('')}</tbody></table></div>` : '';
    return result + table;
  }

  function budgetHtml(record){
    const budget = record.budgetDetails || record.budget || {};
    const items = Array.isArray(budget.items) ? budget.items : [];
    if(!items.length) return '<p class="db-empty-line">لا توجد ميزانية محفوظة.</p>';
    return `<div class="db-budget-list">${items.map((item, idx) => {
      const platforms = Array.isArray(item.platforms) ? item.platforms : [];
      return `<article class="db-budget-item"><h4>إعلان ${idx+1}: ${esc(item.adName || 'بدون اسم')}</h4>
        <div class="db-info-grid"><span>نوع الإعلان: <b>${esc(item.adType || '--')}</b></span><span>تاريخ النشر: <b>${esc(formatDate(item.publishDate))}</b></span><span>مدة الإعلان: <b>${esc(item.duration || '--')}</b></span><span>عدد الإعلانات: <b>${esc(item.adsCount || '--')}</b></span><span>هدف المحتوى: <b>${esc(item.contentGoal || '--')}</b></span><span>الهدف المتوقع: <b>${esc(item.expectedGoal || '--')}</b></span></div>
        <div class="db-inner-table"><table><thead><tr><th>المنصة</th><th>الميزانية</th></tr></thead><tbody>${platforms.length ? platforms.map(p => `<tr><td>${esc(p.name || p.platform || '--')}</td><td>${esc(Number(p.amount || 0).toLocaleString('ar-EG'))}</td></tr>`).join('') : '<tr><td colspan="2">لا توجد منصات محددة</td></tr>'}</tbody></table></div>
        <p class="db-total-line">إجمالي الإعلان: ${esc(Number(item.itemTotal || 0).toLocaleString('ar-EG'))}</p>
      </article>`;
    }).join('')}<p class="db-grand-total">إجمالي الميزانية: ${esc(Number(budget.totalBudget || 0).toLocaleString('ar-EG'))}</p></div>`;
  }

  function attachmentsHtml(record, key){
    const tasks = record.departmentTasks.filter(t => deptKey(t) === key);
    const label = ({photography:'عرض التصوير',content:'عرض المحتوى',design:'عرض التصميم',video:'عرض الفيديو'}[key] || 'عرض القسم');
    if(!tasks.length) return `<p class="db-empty-line">لا توجد بيانات في ${esc(label)}.</p>`;
    return tasks.map((task) => {
      const files = task.files || task.attachments || task.links || task.fileUrls || task.attachmentUrls || [];
      const fileList = Array.isArray(files) ? files : (files ? [files] : []);
      return `<article class="db-section-task"><h4>${esc(label)} — ${esc(departmentLabel(task))}</h4><div class="db-info-grid"><span>اسم المسئول: <b>${esc(personLabel(task))}</b></span><span>تاريخ الاستلام: <b>${esc(formatDate(taskReceiveDate(task)))}</b></span><span>التاريخ المطلوب: <b>${esc(formatDate(taskRequiredDate(task, record)))}</b></span><span>تاريخ التسليم: <b>${esc(formatDate(taskDeliveryDate(task)))}</b></span><span>وقت التأخير: <b>${esc(calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)))}</b></span><span>المطلوب: <b>${esc(task.requiredText || '--')}</b></span></div>${fileList.length ? `<div class="db-files-list">${fileList.map((f, i) => {
        const url = typeof f === 'string' ? f : (f.url || f.fileUrl || f.downloadURL || '');
        const name = typeof f === 'string' ? `ملف ${i+1}` : (f.name || f.fileName || `ملف ${i+1}`);
        return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>` : `<span>${esc(name)}</span>`;
      }).join('')}</div>` : '<p class="db-empty-line">لا توجد مرفقات محفوظة من اليوزر.</p>'}</article>`;
    }).join('');
  }

  function resultsHtml(record){
    const results = record.resultsDetails || record.results || record.campaignResults;
    if(!results) return '<p class="db-empty-line">لا يوجد تقرير نتائج محفوظ.</p>';
    if(typeof results === 'string') return `<p>${esc(results)}</p>`;
    if(Array.isArray(results)) return `<div class="db-inner-table"><table><tbody>${results.map((r, i) => `<tr><th>نتيجة ${i+1}</th><td>${esc(typeof r === 'object' ? JSON.stringify(r) : r)}</td></tr>`).join('')}</tbody></table></div>`;
    return `<div class="db-inner-table"><table><tbody>${Object.entries(results).map(([k,v]) => `<tr><th>${esc(k)}</th><td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function detailsHtml(record){
    return `<div class="db-modal-summary"><strong>${esc(record.name)}</strong><span>${esc(record.type)} · كود: ${esc(record.code || '--')}</span></div>
      <section class="db-detail-section"><h3>عرض التصوير</h3>${attachmentsHtml(record, 'photography')}</section>
      <section class="db-detail-section"><h3>عرض المحتوى</h3>${attachmentsHtml(record, 'content')}</section>
      <section class="db-detail-section"><h3>عرض التصميم</h3>${attachmentsHtml(record, 'design')}</section>
      <section class="db-detail-section"><h3>عرض الفيديو</h3>${attachmentsHtml(record, 'video')}</section>
      <section class="db-detail-section"><h3>عرض جدول النشر</h3>${scheduleHtml(record)}</section>
      <section class="db-detail-section"><h3>عرض الميزانية</h3>${budgetHtml(record)}</section>
      <section class="db-detail-section"><h3>عرض نتائج الحملة</h3>${resultsHtml(record)}</section>`;
  }

  function openDbDetails(recordId){
    const record = loadRecords().find(r => String(r.id) === String(recordId));
    if(!record) return;
    const modal = document.getElementById('detailsModal');
    const title = document.getElementById('detailsTitle');
    const content = document.getElementById('detailsContent');
    if(!modal || !title || !content) return;
    title.textContent = 'عرض بيانات الحملة / الأجندة';
    content.innerHTML = detailsHtml(record);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function escAttr(value){ return esc(value).replace(/`/g, '&#096;'); }

  function renderEditDepartmentRows(record){
    const tasks = Array.isArray(record.departmentTasks) ? record.departmentTasks : [];
    if(!tasks.length) return '<p class="db-empty-line">لا توجد أقسام محفوظة داخل هذه الحملة.</p>';
    return tasks.map((task, idx) => {
      const kind = deptKey(task);
      return `<article class="db-edit-dept-row" data-edit-dept-index="${idx}">
        <div class="db-edit-dept-title">
          <strong>${esc(departmentLabel(task))}</strong>
          <small>${esc(kind)}</small>
        </div>
        <div class="db-edit-grid db-edit-dept-grid">
          <label class="mzj-field"><span>اسم المسؤول</span><input type="text" data-edit-user-name value="${escAttr(personLabel(task) === '--' ? '' : personLabel(task))}"></label>
          <label class="mzj-field"><span>إيميل المسؤول</span><input type="email" data-edit-user-email value="${escAttr(task.userEmail || task.assigneeEmail || '')}"></label>
          <label class="mzj-field"><span>تاريخ الاستلام</span><input type="date" data-edit-receive-date value="${escAttr(dateForInput(taskReceiveDate(task)))}"></label>
          <label class="mzj-field"><span>التاريخ المطلوب</span><input type="date" data-edit-required-date value="${escAttr(dateForInput(taskRequiredDate(task, record)))}"></label>
          <label class="mzj-field"><span>تاريخ التسليم</span><input type="date" data-edit-delivery-date value="${escAttr(dateForInput(taskDeliveryDate(task)))}"></label>
          <label class="mzj-field full-width-field"><span>المطلوب</span><textarea rows="3" data-edit-required-text>${esc(task.requiredText || task.notes || '')}</textarea></label>
        </div>
      </article>`;
    }).join('');
  }

  function closeDbEdit(){
    const modal = document.getElementById('dbEditModal');
    if(!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    modal.style.display = '';
  }

  function openDbEdit(recordId){
    const record = loadRecords().find(r => String(r.id) === String(recordId));
    if(!record) return;
    const modal = document.getElementById('dbEditModal');
    if(!modal) return;
    document.getElementById('dbEditRecordId').value = record.id || '';
    document.getElementById('dbEditTaskType').value = (record.taskType || record.type || '').toString().includes('أج') || record.taskType === 'agenda' ? 'agenda' : (record.taskType === 'task' ? 'task' : 'campaign');
    document.getElementById('dbEditName').value = record.name || '';
    document.getElementById('dbEditCode').value = record.code || '';
    document.getElementById('dbEditCampaignType').value = record.campaignTypeName || record.campaignType || '';
    document.getElementById('dbEditGoal').value = record.goal || '';
    document.getElementById('dbEditStartDate').value = dateForInput(record.campaignStartDate || record.launchDate || record.taskDate || record.date);
    document.getElementById('dbEditEndDate').value = dateForInput(record.campaignEndDate || record.endDate);
    const deps = document.getElementById('dbEditDepartments');
    if(deps) deps.innerHTML = renderEditDepartmentRows(record);
    const note = document.getElementById('dbEditNote');
    if(note) note.textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'grid';
  }

  async function saveDbEdit(event){
    event.preventDefault();
    const form = event.currentTarget;
    const recordId = document.getElementById('dbEditRecordId')?.value || '';
    const target = loadRecords().find(r => String(r.id) === String(recordId));
    const note = document.getElementById('dbEditNote');
    if(!target){ if(note) note.textContent = '⚠️ لم يتم العثور على الحملة.'; return; }

    const editedDepartmentTasks = Array.isArray(target.departmentTasks) ? target.departmentTasks.map((task, idx) => {
      const row = document.querySelector(`[data-edit-dept-index="${idx}"]`);
      if(!row) return task;
      const name = row.querySelector('[data-edit-user-name]')?.value.trim() || '';
      const email = row.querySelector('[data-edit-user-email]')?.value.trim() || '';
      const receiveDate = row.querySelector('[data-edit-receive-date]')?.value || '';
      const requiredDate = row.querySelector('[data-edit-required-date]')?.value || '';
      const deliveryDate = row.querySelector('[data-edit-delivery-date]')?.value || '';
      const requiredText = row.querySelector('[data-edit-required-text]')?.value.trim() || '';
      return {
        ...task,
        userName: name || task.userName || task.assigneeName || '',
        assigneeName: name || task.assigneeName || task.userName || '',
        userDisplayName: name || task.userDisplayName || task.userName || '',
        userEmail: email || task.userEmail || task.assigneeEmail || '',
        assigneeEmail: email || task.assigneeEmail || task.userEmail || '',
        receiveDate,
        receivedAt: receiveDate || task.receivedAt || '',
        requiredDate,
        deliveryDate,
        requiredText
      };
    }) : [];

    const taskType = document.getElementById('dbEditTaskType')?.value || 'campaign';
    const payload = {
      taskType,
      taskTypeLabel: taskType === 'agenda' ? 'أجندة' : (taskType === 'task' ? 'تاسك' : 'حملة'),
      campaignName: document.getElementById('dbEditName')?.value.trim() || '',
      name: document.getElementById('dbEditName')?.value.trim() || '',
      campaignCode: document.getElementById('dbEditCode')?.value.trim() || '',
      code: document.getElementById('dbEditCode')?.value.trim() || '',
      campaignTypeName: document.getElementById('dbEditCampaignType')?.value.trim() || '',
      campaignGoal: document.getElementById('dbEditGoal')?.value.trim() || '',
      goal: document.getElementById('dbEditGoal')?.value.trim() || '',
      campaignStartDate: document.getElementById('dbEditStartDate')?.value || '',
      launchDate: document.getElementById('dbEditStartDate')?.value || '',
      campaignEndDate: document.getElementById('dbEditEndDate')?.value || '',
      endDate: document.getElementById('dbEditEndDate')?.value || '',
      departmentTasks: editedDepartmentTasks,
      updatedAt: new Date().toISOString()
    };

    try{
      if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
      if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const col = target.sourceFirestoreCollection || 'workspace_tasks';
      const docId = target.firestoreId || target.docId || target.id;
      await firebase.firestore().collection(col).doc(String(docId)).set(payload, { merge: true });
      firestoreRecords = firestoreRecords.map(r => String(r.id || r.firestoreId) === String(recordId) ? { ...r, ...payload } : r);
      if(note) note.textContent = '✅ تم حفظ التعديل في Firebase.';
      render();
      setTimeout(closeDbEdit, 450);
    }catch(err){
      console.error('db edit save failed:', err);
      if(note) note.textContent = '⚠️ فشل حفظ التعديل في Firebase: ' + (err.message || err.code || err);
    }
  }

  async function deleteRecord(recordId){
    const target = loadRecords().find(r => String(r.id) === String(recordId));
    if(window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore){
      try{
        if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const col = target?.sourceFirestoreCollection || 'workspace_tasks';
        const docId = target?.firestoreId || target?.docId || target?.id;
        if(docId) await firebase.firestore().collection(col).doc(String(docId)).delete();
      }catch(err){ alert('فشل مسح الحملة من Firebase: ' + (err.message || err.code || err)); return; }
    }
    firestoreRecords = firestoreRecords.filter(r => String(r.id || r.firestoreId) !== String(recordId));
    render();
  }

  function render(){
    const holder = document.getElementById('campaignRecordsLive');
    if(!holder) return;
    const search = String(document.getElementById('campaignSearch')?.value || '').trim().toLowerCase();
    let records = loadRecords();
    if(search){
      records = records.filter(r => [r.name,r.code,r.type,r.goal,r.launchDate].some(v => String(v||'').toLowerCase().includes(search)));
    }
    if(!records.length){
      holder.innerHTML='<article class="empty-database-state"><div class="empty-icon">DB</div><div><span class="eyebrow">قاعدة البيانات جاهزة</span><h4>لا توجد حملات أو أجندات مطابقة</h4><p>الحملات والأجندات تظهر هنا من Firebase من مسار workspace_tasks فقط.</p></div></article>';
      return;
    }
    holder.innerHTML = `<div class="campaign-db-table-wrap"><table class="campaign-db-table"><thead><tr>
      <th>م</th><th>نوع الحملة</th><th>اسم الحملة</th><th>كود الحملة</th><th>الهدف من الحملة</th><th>تاريخ نزول الحملة</th>
      <th>قسم التصوير</th><th>قسم المحتوى</th><th>قسم التصميم</th><th>قسم المونتاج</th><th>قسم النشر</th>
      <th>تاريخ التسليم</th><th>وقت التأخير</th><th>عرض البيانات</th><th>إجراءات</th>
    </tr></thead><tbody>${records.map((r, idx) => {
      const req = r.requiredDate || r.launchDate || r.deadline;
      const del = r.deliveryDate || r.completedAt;
      return `<tr data-record-id="${esc(r.id)}">
        <td>${idx+1}</td><td>${esc(r.type)}</td><td>${esc(r.name)}</td><td>${esc(r.code || '--')}</td><td>${esc(r.goal || '--')}</td><td>${esc(formatDate(r.launchDate))}</td>
        <td>${renderDeptSummary(r,'photography')}</td><td>${renderDeptSummary(r,'content')}</td><td>${renderDeptSummary(r,'design')}</td><td>${renderDeptSummary(r,'video')}</td><td>${renderDeptSummary(r,'publish')}</td>
        <td>${esc(formatDate(del))}</td><td>${esc(calcDelay(req, del))}</td><td>${renderCellButton(r)}</td><td>${isAdmin() ? `<div class="db-action-stack"><button class="soft-btn db-edit-btn" type="button" data-edit-record="${esc(r.id)}" onclick="window.openDatabaseEditCampaign && window.openDatabaseEditCampaign(this.dataset.editRecord)">تعديل</button><button class="danger-btn db-delete-btn" type="button" data-delete-record="${esc(r.id)}">مسح</button></div>` : '--'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  window.openDatabaseEditCampaign = function(recordId){
    try{
      if(!recordId){ alert('لم يتم العثور على رقم الحملة للتعديل.'); return; }
      openDbEdit(recordId);
      const modal = document.getElementById('dbEditModal');
      if(modal){
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden','false');
        modal.style.display = 'grid';
      }
    }catch(err){
      console.error('openDatabaseEditCampaign failed:', err);
      alert('تعذر فتح تعديل الحملة: ' + (err.message || err));
    }
  };

  document.addEventListener('click', async (e) => {
    const detailsBtn = e.target.closest('[data-db-details]');
    if(detailsBtn){
      e.preventDefault();
      e.stopPropagation();
      openDbDetails(detailsBtn.dataset.dbDetails);
      return;
    }
    const editBtn = e.target.closest('[data-edit-record]');
    if(editBtn){
      e.preventDefault();
      e.stopPropagation();
      const rid = editBtn.dataset.editRecord || editBtn.closest('tr')?.dataset.recordId || '';
      window.openDatabaseEditCampaign ? window.openDatabaseEditCampaign(rid) : openDbEdit(rid);
      return;
    }
    const closeEditBtn = e.target.closest('[data-close-db-edit]');
    if(closeEditBtn){
      e.preventDefault();
      closeDbEdit();
      return;
    }
    const deleteBtn = e.target.closest('[data-delete-record]');
    if(deleteBtn){
      const ok = confirm('تأكيد مسح الحملة/الأجندة من Firebase؟');
      if(!ok) return;
      await deleteRecord(deleteBtn.dataset.deleteRecord);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    render();
    loadFirestoreRecords();
    const search = document.getElementById('campaignSearch');
    if(search) search.addEventListener('input', render);
    const editForm = document.getElementById('dbEditForm');
    if(editForm) editForm.addEventListener('submit', saveDbEdit);
  });

  window.renderCampaignRecordsLive = render;
  window.reloadCampaignRecordsLive = loadFirestoreRecords;
})();
