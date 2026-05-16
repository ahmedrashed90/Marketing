(function(){
  const FIRESTORE_TASK_COLLECTIONS = ['workspace_tasks'];
  let firestoreRecords = [];
  let firebaseUsers = [];
  let firebaseDepartments = [];

  const DEFAULT_EDIT_DEPARTMENTS = [
    { key: 'photography', label: 'قسم التصوير', aliases: ['photography','photo','قسم التصوير','التصوير','تصوير'] },
    { key: 'content', label: 'قسم المحتوى', aliases: ['content','قسم المحتوى','المحتوى','كتابة المحتوى'] },
    { key: 'design', label: 'قسم التصميم', aliases: ['design','قسم التصميم','التصميم','مصمم'] },
    { key: 'video', label: 'قسم المونتاج', aliases: ['video','montage','قسم المونتاج','المونتاج','الفيديو','قسم الفيديو'] },
    { key: 'publish', label: 'قسم النشر', aliases: ['publish','posting','قسم النشر','النشر'] }
  ];

  const DEPARTMENT_ALIASES = {
    photography: ['photography','photo','قسم التصوير','التصوير','تصوير'],
    content: ['content','قسم المحتوى','المحتوى','كتابة المحتوى'],
    design: ['design','قسم التصميم','التصميم','مصمم'],
    video: ['video','montage','قسم المونتاج','المونتاج','الفيديو','قسم الفيديو'],
    publish: ['publish','posting','قسم النشر','النشر'],
    archive: ['archive','قسم الارشيف','قسم الأرشيف','الأرشيف']
  };


  const PHOTOGRAPHY_CONTENT_TYPES = ['ريل', 'صور الموقع', 'فيديو HD', 'فيديو الصالة'];
  const DESIGN_DELIVERABLES = [
    ['بوست سوشيال ميديا', 'Instagram / Facebook / X'],
    ['كاروسيل', 'حملات / عروض / محتوى توعوي / سيارات'],
    ['موشن جرافيك', 'Instagram / Snapchat / Facebook'],
    ['ستوري', 'Instagram / Snapchat / Facebook'],
    ['بنر إعلاني', 'حملات ممولة / موقع'],
    ['ثامبنيل', 'YouTube / Reels / Video Cover'],
    ['إيديت صور سيارات', 'موقع / سوشيال / حملات'],
    ['ملفات مفتوحة', 'عند الحاجة للأرشفة أو التعديل لاحقًا'],
    ['نسخة نشر نهائية', 'JPG / PNG / PDF حسب المطلوب']
  ];
  const MONTAGE_DELIVERABLES = [
    ['مونتاج أجندة عادي', 'Reel 1080x1920 + نسخة نهائية للنشر'],
    ['فيديو ستوري', 'Story 1080x1920 + نسخة نهائية للنشر'],
    ['مونتاج إعلان ممول', 'Reel 1080x1920 + Video 1080x1350 + نسخة إعلان ممول'],
    ['مونتاج بمشاهد AI', 'مشاهد AI منفصلة + نسخة مراجعة أولى + نسخة نهائية'],
    ['مونتاج ريل مواصفات', 'Reel 1080x1920 + Cover عند الحاجة'],
    ['مونتاج فيديو مواصفات', 'YouTube HD Video 1920x1080 + نسخة Shorts عند الحاجة'],
    ['مونتاج ريل معرض', 'Reel 1080x1920 + Story 1080x1920 عند الحاجة'],
    ['مونتاج YouTube', 'YouTube HD Video 1920x1080 + Thumbnail + نسخة Shorts عند الحاجة']
  ];

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
      launchDate: r.launchDate || r.campaignStartDate || r.startDate || r.campaignLaunchDate || r.publishDate || r.date || r.dueDate || '',
      startDate: r.startDate || r.campaignStartDate || r.launchDate || r.campaignLaunchDate || '',
      endDate: r.endDate || r.campaignEndDate || r.finishDate || '',
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

  async function loadUsersAndDepartments(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) return;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const [usersSnap, depsSnap] = await Promise.all([
        firebase.firestore().collection('users').get(),
        firebase.firestore().collection('departments').get().catch(() => ({ forEach: () => {} }))
      ]);
      const users=[];
      usersSnap.forEach(doc => users.push({ id: doc.id, firestoreId: doc.id, ...(doc.data() || {}) }));
      firebaseUsers = users;
      const deps=[];
      depsSnap.forEach(doc => deps.push({ id: doc.id, firestoreId: doc.id, ...(doc.data() || {}) }));
      firebaseDepartments = deps;
    }catch(err){
      console.warn('فشل قراءة users/departments للتعديل:', err);
    }
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
  function taskDeliveryDate(task){ return task.deliveryDate || task.publishDate || task.submittedAt || task.doneAt || task.deliveredAt || ''; }

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
    return tasks.map((task) => {
      const deliveryLabel = key === 'publish' ? 'نشر' : 'تسليم';
      return `
      <div class="db-dept-mini">
        <strong>${esc(personLabel(task))}</strong>
        <small>تاريخ الاستلام / ${esc(formatDate(taskReceiveDate(task)))}</small>
        <small>التاريخ المطلوب / ${esc(formatDate(taskRequiredDate(task, record)))}</small>
        <small>تاريخ ${deliveryLabel} / ${esc(formatDate(taskDeliveryDate(task)))}</small>
        <small class="${calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)).includes('تأخير') ? 'is-late' : ''}">وقت التأخير: ${esc(calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)))}</small>
      </div>`;
    }).join('');
  }

  function renderSectionButton(record, section, label){
    return `<button class="view-btn db-one-view-btn" type="button" data-db-details="${esc(record.id)}" data-db-section="${esc(section)}">${esc(label)}</button>`;
  }

  function renderCellButton(record){
    return renderSectionButton(record, 'all', 'عرض البيانات');
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
      return `<article class="db-section-task"><h4>${esc(label)} — ${esc(departmentLabel(task))}</h4><div class="db-info-grid"><span>اسم المسئول: <b>${esc(personLabel(task))}</b></span><span>تاريخ الاستلام: <b>${esc(formatDate(taskReceiveDate(task)))}</b></span><span>التاريخ المطلوب: <b>${esc(formatDate(taskRequiredDate(task, record)))}</b></span><span>${key === 'publish' ? 'تاريخ النشر' : 'تاريخ التسليم'}: <b>${esc(formatDate(taskDeliveryDate(task)))}</b></span><span>وقت التأخير: <b>${esc(calcDelay(taskRequiredDate(task, record), taskDeliveryDate(task)))}</b></span><span>المطلوب: <b>${esc(task.requiredText || '--')}</b></span></div>${fileList.length ? `<div class="db-files-list">${fileList.map((f, i) => {
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

  function detailSectionHtml(record, section){
    const sections = {
      photography: `<section class="db-detail-section"><h3>عرض التصوير</h3>${attachmentsHtml(record, 'photography')}</section>`,
      content: `<section class="db-detail-section"><h3>عرض المحتوى</h3>${attachmentsHtml(record, 'content')}</section>`,
      design: `<section class="db-detail-section"><h3>عرض التصميم</h3>${attachmentsHtml(record, 'design')}</section>`,
      video: `<section class="db-detail-section"><h3>عرض الفيديو</h3>${attachmentsHtml(record, 'video')}</section>`,
      schedule: `<section class="db-detail-section"><h3>عرض جدول النشر</h3>${scheduleHtml(record)}</section>`,
      budget: `<section class="db-detail-section"><h3>عرض الميزانية</h3>${budgetHtml(record)}</section>`,
      results: `<section class="db-detail-section"><h3>عرض نتائج الحملة</h3>${resultsHtml(record)}</section>`
    };
    if(section && section !== 'all' && sections[section]) return sections[section];
    return Object.values(sections).join('');
  }

  function detailsHtml(record, section){
    return `<div class="db-modal-summary"><strong>${esc(record.name)}</strong><span>${esc(record.type)} · كود: ${esc(record.code || '--')}</span></div>${detailSectionHtml(record, section)}`;
  }

  function openDbDetails(recordId, section){
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

  function userName(user){ return user.name || user.displayName || user.username || user.email || 'يوزر'; }
  function userEmail(user){ return user.email || user.userEmail || ''; }
  function userId(user){ return user.uid || user.id || user.firestoreId || user.docId || user.email || ''; }

  function getTaskUserId(task){
    return task.userId || task.uid || task.assigneeUid || task.assigneeId || task.memberUid || '';
  }

  function getDeptSavedMembers(deptKeyValue){
    const def = DEFAULT_EDIT_DEPARTMENTS.find(d => d.key === deptKeyValue);
    const aliases = [deptKeyValue, def?.label, ...(def?.aliases || [])].map(v => String(v || '').toLowerCase());
    const dep = firebaseDepartments.find(d => {
      const vals = [d.id, d.slug, d.key, d.name, d.label, d.departmentName].map(v => String(v || '').toLowerCase());
      return vals.some(v => aliases.some(a => v && (v === a || v.includes(a) || a.includes(v))));
    });
    if(!dep) return [];
    const arr = [];
    ['users','members','memberUids','userIds','memberEmails'].forEach(k => {
      if(Array.isArray(dep[k])) arr.push(...dep[k]);
    });
    return arr;
  }

  function usersForDepartment(deptKeyValue){
    const savedMembers = getDeptSavedMembers(deptKeyValue);
    if(!savedMembers.length){
      return firebaseUsers;
    }
    const memberKeys = savedMembers.map(m => {
      if(m && typeof m === 'object') return [m.uid,m.id,m.email,m.userEmail,m.name,m.displayName].filter(Boolean).map(x => String(x).toLowerCase());
      return [String(m).toLowerCase()];
    }).flat();
    const selected = firebaseUsers.filter(u => {
      const vals = [userId(u), userEmail(u), userName(u)].filter(Boolean).map(v => String(v).toLowerCase());
      return vals.some(v => memberKeys.includes(v));
    });
    return selected.length ? selected : firebaseUsers;
  }

  function userOptionsHtml(users, selectedTask){
    const selectedEmail = String(selectedTask?.userEmail || selectedTask?.assigneeEmail || '').toLowerCase();
    const selectedId = String(getTaskUserId(selectedTask || {}) || '').toLowerCase();
    const options = ['<option value="">اختار اليوزر</option>'];
    users.forEach(u => {
      const id = userId(u);
      const email = userEmail(u);
      const name = userName(u);
      const selected = (selectedEmail && String(email).toLowerCase() === selectedEmail) || (selectedId && String(id).toLowerCase() === selectedId) ? ' selected' : '';
      options.push(`<option value="${escAttr(id)}" data-name="${escAttr(name)}" data-email="${escAttr(email)}"${selected}>${esc(name)}${email ? ' — ' + esc(email) : ''}</option>`);
    });
    return options.join('');
  }

  function taskForEditDepartment(tasks, deptKeyValue){
    return tasks.find(t => deptKey(t) === deptKeyValue) || null;
  }

  function editKindFromDeptKey(deptKeyValue){
    if(deptKeyValue === 'video') return 'montage';
    return deptKeyValue;
  }

  function selectedTitlesFromTask(task){
    const pools = [];
    if(Array.isArray(task?.deliverables)) pools.push(task.deliverables);
    if(Array.isArray(task?.selectedDeliverables)) pools.push(task.selectedDeliverables);
    if(Array.isArray(task?.specialDetails?.deliverables)) pools.push(task.specialDetails.deliverables);
    if(Array.isArray(task?.special?.deliverables)) pools.push(task.special.deliverables);
    return pools.flat().map(item => String(item?.title || item?.name || item?.value || item || '').trim()).filter(Boolean);
  }

  function renderEditChoiceCards(pairs, attrName, selectedTitles){
    const selected = new Set((selectedTitles || []).map(x => String(x).trim()));
    const kind = String(attrName || '').includes('montage') ? 'montage' : 'design';
    return pairs.map(([title, desc]) => {
      const isChecked = selected.has(title);
      return `<button class="multi-choice-card db-edit-choice-card${isChecked ? ' is-selected' : ''}" type="button" data-edit-choice-card="${escAttr(kind)}" data-title="${escAttr(title)}" data-desc="${escAttr(desc)}" data-selected="${isChecked ? '1' : '0'}" aria-pressed="${isChecked ? 'true' : 'false'}">
        <span class="multi-choice-check db-edit-choice-box" aria-hidden="true">${isChecked ? '✓' : ''}</span>
        <span class="multi-choice-title">${esc(title)}</span>
        <small>${esc(desc)}</small>
      </button>`;
    }).join('');
  }

  function photographyItemsFromTask(task){
    const raw = Array.isArray(task?.items) ? task.items :
      (Array.isArray(task?.photoItems) ? task.photoItems :
      (Array.isArray(task?.specialDetails?.items) ? task.specialDetails.items : []));
    const cleaned = raw.map(item => ({
      carType: item?.carType || item?.vehicleType || item?.car || '',
      contentType: item?.contentType || item?.type || item?.content || ''
    })).filter(item => item.carType || item.contentType);
    return cleaned.length ? cleaned : [{ carType: '', contentType: '' }];
  }

  function renderPhotoEditItem(item){
    return `<article class="photo-item-row db-edit-photo-row" data-edit-photo-item>
      <label class="mzj-field"><span>نوع السيارة</span><input type="text" data-edit-photo-car-type value="${escAttr(item?.carType || '')}" placeholder="مثال: هيونداي / النترا"></label>
      <label class="mzj-field"><span>نوع المحتوى</span><select data-edit-photo-content-type>${PHOTOGRAPHY_CONTENT_TYPES.map(t => `<option value="${escAttr(t)}"${String(item?.contentType || '') === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <button class="soft-danger-btn db-edit-photo-remove" type="button" data-edit-remove-photo-item>مسح</button>
    </article>`;
  }

  function renderEditRequirementsFields(deptKeyValue, task){
    const kind = editKindFromDeptKey(deptKeyValue);
    if(kind === 'photography'){
      return `<div class="dept-special-fields db-edit-required-fields" data-edit-special-kind="photography">
        <div class="dept-special-head">
          <strong>المطلوب</strong>
          <button class="soft-btn" type="button" data-edit-add-photo-item>+ إضافة مطلوب تصوير</button>
        </div>
        <div class="photo-items-list" data-edit-photo-items-list>
          ${photographyItemsFromTask(task).map(renderPhotoEditItem).join('')}
        </div>
      </div>`;
    }
    if(kind === 'design'){
      return `<div class="dept-special-fields db-edit-required-fields" data-edit-special-kind="design">
        <div class="dept-special-head"><strong>المطلوب</strong><span class="department-hint-inline">اختار مطلوب واحد أو أكتر من التصميم</span></div>
        <div class="multi-choice-grid" data-edit-design-choices>${renderEditChoiceCards(DESIGN_DELIVERABLES, 'data-edit-design-deliverable', selectedTitlesFromTask(task))}</div>
        <label class="mzj-field full-width-field"><span>ملاحظات إضافية</span><textarea data-edit-required-text rows="3" placeholder="اكتب أي تفاصيل إضافية للتصميم">${esc(task.notes || task.specialDetails?.notes || task.requiredNotes || '')}</textarea></label>
      </div>`;
    }
    if(kind === 'montage'){
      return `<div class="dept-special-fields db-edit-required-fields" data-edit-special-kind="montage">
        <div class="dept-special-head"><strong>المطلوب</strong><span class="department-hint-inline">اختار مطلوب واحد أو أكتر من المونتاج</span></div>
        <div class="multi-choice-grid" data-edit-montage-choices>${renderEditChoiceCards(MONTAGE_DELIVERABLES, 'data-edit-montage-deliverable', selectedTitlesFromTask(task))}</div>
        <label class="mzj-field full-width-field"><span>ملاحظات إضافية</span><textarea data-edit-required-text rows="3" placeholder="اكتب أي تفاصيل إضافية للمونتاج">${esc(task.notes || task.specialDetails?.notes || task.requiredNotes || '')}</textarea></label>
      </div>`;
    }
    return `<label class="mzj-field full-width-field db-edit-required-fields" data-edit-special-kind="${escAttr(kind)}"><span>المطلوب</span><textarea rows="3" data-edit-required-text placeholder="اكتب شرح المطلوب من القسم">${esc(task.requiredText || task.notes || '')}</textarea></label>`;
  }

  function collectEditRequirements(row, deptKeyValue){
    const kind = editKindFromDeptKey(deptKeyValue);
    if(kind === 'photography'){
      const items = Array.from(row.querySelectorAll('[data-edit-photo-item]')).map(item => ({
        carType: item.querySelector('[data-edit-photo-car-type]')?.value.trim() || '',
        contentType: item.querySelector('[data-edit-photo-content-type]')?.value || ''
      })).filter(item => item.carType || item.contentType);
      return {
        kind,
        items,
        specialDetails: { kind, items },
        requiredText: items.map(item => [item.carType ? `نوع السيارة: ${item.carType}` : '', item.contentType ? `نوع المحتوى: ${item.contentType}` : ''].filter(Boolean).join(' — ')).join(' | ')
      };
    }
    if(kind === 'design' || kind === 'montage'){
      const selected = Array.from(row.querySelectorAll(`[data-edit-choice-card="${kind}"].is-selected`)).map(item => ({
        title: item.dataset.title || '',
        details: item.dataset.desc || ''
      })).filter(item => item.title || item.details);
      const notes = row.querySelector('[data-edit-required-text]')?.value.trim() || '';
      return {
        kind,
        deliverables: selected,
        selectedDeliverables: selected,
        specialDetails: { kind, deliverables: selected, notes },
        deliverable: selected.map(item => item.title).join('، '),
        deliveryDetails: selected.map(item => [item.title, item.details].filter(Boolean).join(': ')).join(' | '),
        notes,
        requiredText: [selected.map(item => [item.title, item.details].filter(Boolean).join(': ')).join(' | '), notes].filter(Boolean).join(' — ')
      };
    }
    const notes = row.querySelector('[data-edit-required-text]')?.value.trim() || '';
    return { kind, notes, specialDetails: { kind, notes }, requiredText: notes };
  }

  function renderEditDepartmentRows(record){
    const tasks = Array.isArray(record.departmentTasks) ? record.departmentTasks : [];
    return DEFAULT_EDIT_DEPARTMENTS.map((dept, idx) => {
      const task = taskForEditDepartment(tasks, dept.key) || {};
      const active = !!taskForEditDepartment(tasks, dept.key);
      const users = usersForDepartment(dept.key);
      return `<article class="db-edit-dept-row ${active ? 'is-active' : ''}" data-edit-dept-index="${idx}" data-edit-dept-key="${escAttr(dept.key)}" data-edit-dept-label="${escAttr(dept.label)}">
        <div class="db-edit-dept-title">
          <label class="db-edit-dept-check"><input type="checkbox" data-edit-dept-enabled ${active ? 'checked' : ''}> <strong>${esc(dept.label)}</strong></label>
          <small>${esc(dept.key)}</small>
        </div>
        <div class="db-edit-grid db-edit-dept-grid">
          <label class="mzj-field"><span>اسم المسؤول</span><select data-edit-user-select>${userOptionsHtml(users, task)}</select></label>
          <label class="mzj-field"><span>إيميل المسؤول</span><input type="email" data-edit-user-email value="${escAttr(task.userEmail || task.assigneeEmail || '')}" placeholder="يتحدد تلقائيًا من اليوزر"></label>
          <label class="mzj-field"><span>تاريخ الاستلام</span><input type="date" data-edit-receive-date value="${escAttr(dateForInput(taskReceiveDate(task)))}"></label>
          <label class="mzj-field"><span>التاريخ المطلوب</span><input type="date" data-edit-required-date value="${escAttr(dateForInput(taskRequiredDate(task, record)))}"></label>
          <label class="mzj-field"><span>${dept.key === 'publish' ? 'تاريخ النشر' : 'تاريخ التسليم'}</span><input type="date" data-edit-delivery-date value="${escAttr(dateForInput(taskDeliveryDate(task)))}"></label>
        </div>
        ${renderEditRequirementsFields(dept.key, task)}
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

  async function openDbEdit(recordId){
    if(!firebaseUsers.length){ await loadUsersAndDepartments(); }
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

    const existingTasks = Array.isArray(target.departmentTasks) ? target.departmentTasks : [];
    const editedDepartmentTasks = Array.from(document.querySelectorAll('.db-edit-dept-row')).map((row) => {
      const enabled = row.querySelector('[data-edit-dept-enabled]')?.checked;
      if(!enabled) return null;
      const deptKeyValue = row.dataset.editDeptKey || '';
      const deptLabel = row.dataset.editDeptLabel || '';
      const oldTask = taskForEditDepartment(existingTasks, deptKeyValue) || {};
      const select = row.querySelector('[data-edit-user-select]');
      const selected = select?.selectedOptions?.[0];
      const uid = select?.value || oldTask.userId || oldTask.uid || oldTask.assigneeUid || '';
      const name = selected?.dataset?.name || oldTask.userName || oldTask.assigneeName || '';
      const email = row.querySelector('[data-edit-user-email]')?.value.trim() || selected?.dataset?.email || oldTask.userEmail || oldTask.assigneeEmail || '';
      const receiveDate = row.querySelector('[data-edit-receive-date]')?.value || '';
      const requiredDate = row.querySelector('[data-edit-required-date]')?.value || '';
      const deliveryDate = row.querySelector('[data-edit-delivery-date]')?.value || '';
      const requirements = collectEditRequirements(row, deptKeyValue);
      const requiredText = requirements.requiredText || '';
      const sameResponsible = String(uid || '').trim() && String(uid || '').trim() === String(oldTask.userId || oldTask.uid || oldTask.assigneeUid || '').trim();
      const keepReceipt = Boolean(sameResponsible && (oldTask.receivedConfirmed || oldTask.received || oldTask.receivedAt));
      return {
        ...oldTask,
        ...requirements,
        departmentKey: deptKeyValue,
        departmentId: deptKeyValue,
        departmentName: deptLabel,
        department: deptLabel,
        userId: uid,
        uid,
        assigneeUid: uid,
        userName: name,
        assigneeName: name,
        userDisplayName: name,
        userEmail: email,
        assigneeEmail: email,
        receiveDate: keepReceipt ? (oldTask.receiveDate || String(oldTask.receivedAt || '').slice(0, 10)) : '',
        receivedAt: keepReceipt ? (oldTask.receivedAt || '') : '',
        received: keepReceipt ? Boolean(oldTask.received || oldTask.receivedConfirmed) : false,
        receivedConfirmed: keepReceipt ? Boolean(oldTask.receivedConfirmed || oldTask.received) : false,
        receivedBy: keepReceipt ? (oldTask.receivedBy || '') : '',
        requiredDate,
        deliveryDate,
        requiredText
      };
    }).filter(Boolean);

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
      assignedDepartments: editedDepartmentTasks,
      assigneeUids: editedDepartmentTasks.map(t => t.uid || t.userId || t.assigneeUid).filter(Boolean),
      assigneeEmails: editedDepartmentTasks.map(t => t.userEmail || t.assigneeEmail).filter(Boolean),
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
    holder.innerHTML = `<div class="campaign-db-table-wrap"><table class="campaign-db-table campaign-db-final-table"><thead><tr>
      <th>م</th><th>التاريخ</th><th>كود الحملة</th><th>اسم الحملة</th><th>نوع الحملة</th><th>الهدف من الحملة</th><th>تاريخ بداية الحملة</th><th>تاريخ نهاية الحملة</th>
      <th>قسم التصوير</th><th>قسم المحتوى</th><th>قسم التصميم</th><th>قسم المونتاج</th><th>قسم النشر</th>
      <th>عرض البيانات</th><th>إجراءات</th>
    </tr></thead><tbody>${records.map((r, idx) => {
      return `<tr data-record-id="${esc(r.id)}">
        <td>${idx+1}</td><td>${esc(formatDate(r.taskDate || r.createdAt || r.launchDate))}</td><td>${esc(r.code || '--')}</td><td>${esc(r.name)}</td><td>${esc(r.campaignTypeName || r.type)}</td><td>${esc(r.goal || '--')}</td><td>${esc(formatDate(r.startDate || r.launchDate))}</td><td>${esc(formatDate(r.endDate))}</td>
        <td>${renderDeptSummary(r,'photography')}</td><td>${renderDeptSummary(r,'content')}</td><td>${renderDeptSummary(r,'design')}</td><td>${renderDeptSummary(r,'video')}</td><td>${renderDeptSummary(r,'publish')}</td>
        <td>${renderSectionButton(r,'all','عرض البيانات')}</td><td>${isAdmin() ? `<div class="db-action-stack"><button class="soft-btn db-edit-btn" type="button" data-edit-record="${esc(r.id)}" onclick="window.openDatabaseEditCampaign && window.openDatabaseEditCampaign(this.dataset.editRecord)">تعديل</button><button class="danger-btn db-delete-btn" type="button" data-delete-record="${esc(r.id)}">مسح</button></div>` : '--'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  window.openDatabaseEditCampaign = async function(recordId){
    try{
      if(!recordId){ alert('لم يتم العثور على رقم الحملة للتعديل.'); return; }
      await openDbEdit(recordId);
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
      openDbDetails(detailsBtn.dataset.dbDetails, detailsBtn.dataset.dbSection || 'all');
      return;
    }
    const editBtn = e.target.closest('[data-edit-record]');
    if(editBtn){
      e.preventDefault();
      e.stopPropagation();
      const rid = editBtn.dataset.editRecord || editBtn.closest('tr')?.dataset.recordId || '';
      if(window.openDatabaseEditCampaign) await window.openDatabaseEditCampaign(rid); else await openDbEdit(rid);
      return;
    }
    const userSelect = e.target.closest('[data-edit-user-select]');
    if(userSelect){
      const opt = userSelect.selectedOptions?.[0];
      const row = userSelect.closest('.db-edit-dept-row');
      const emailInput = row?.querySelector('[data-edit-user-email]');
      if(emailInput && opt?.dataset?.email) emailInput.value = opt.dataset.email;
      const enabled = row?.querySelector('[data-edit-dept-enabled]');
      if(enabled) enabled.checked = true;
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


  document.addEventListener('change', function(event){
    const userSelect = event.target.closest('[data-edit-user-select]');
    if(userSelect){
      const opt = userSelect.selectedOptions?.[0];
      const row = userSelect.closest('.db-edit-dept-row');
      const emailInput = row?.querySelector('[data-edit-user-email]');
      if(emailInput && opt?.dataset?.email) emailInput.value = opt.dataset.email;
      const enabled = row?.querySelector('[data-edit-dept-enabled]');
      if(enabled) enabled.checked = true;
    }
  });

  document.addEventListener('click', function(event){
    const card = event.target.closest('[data-edit-choice-card]');
    if(card){
      event.preventDefault();
      const next = !card.classList.contains('is-selected');
      card.classList.toggle('is-selected', next);
      card.dataset.selected = next ? '1' : '0';
      card.setAttribute('aria-pressed', next ? 'true' : 'false');
      const box = card.querySelector('.db-edit-choice-box');
      if(box) box.textContent = next ? '✓' : '';
      const row = card.closest('.db-edit-dept-row');
      const enabled = row?.querySelector('[data-edit-dept-enabled]');
      if(enabled) enabled.checked = true;
      return;
    }
    const addPhoto = event.target.closest('[data-edit-add-photo-item]');
    if(addPhoto){
      const list = addPhoto.closest('.db-edit-required-fields')?.querySelector('[data-edit-photo-items-list]');
      if(list) list.insertAdjacentHTML('beforeend', renderPhotoEditItem({ carType:'', contentType:'' }));
      return;
    }
    const removePhoto = event.target.closest('[data-edit-remove-photo-item]');
    if(removePhoto){
      const row = removePhoto.closest('[data-edit-photo-item]');
      const list = removePhoto.closest('[data-edit-photo-items-list]');
      if(row && list && list.querySelectorAll('[data-edit-photo-item]').length > 1) row.remove();
    }
  });

  document.addEventListener('keydown', function(event){
    const card = event.target.closest('.db-edit-choice-card');
    if(card && (event.key === 'Enter' || event.key === ' ')){
      event.preventDefault();
      card.click();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    render();
    loadUsersAndDepartments().then(loadFirestoreRecords);
    const search = document.getElementById('campaignSearch');
    if(search) search.addEventListener('input', render);
    const editForm = document.getElementById('dbEditForm');
    if(editForm) editForm.addEventListener('submit', saveDbEdit);
  });

  window.renderCampaignRecordsLive = render;
  window.reloadCampaignRecordsLive = loadFirestoreRecords;
})();
