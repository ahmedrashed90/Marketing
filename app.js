const sidebar = document.getElementById('sidebar');
const toggleButton = document.getElementById('sidebarToggle');

const savedState = localStorage.getItem('marketingSidebarState');
if (savedState === 'collapsed') {
  sidebar.classList.add('is-collapsed');
  document.body.classList.add('sidebar-collapsed');
}

toggleButton.addEventListener('click', () => {
  sidebar.classList.toggle('is-collapsed');
  document.body.classList.toggle('sidebar-collapsed');

  const isCollapsed = sidebar.classList.contains('is-collapsed');
  localStorage.setItem('marketingSidebarState', isCollapsed ? 'collapsed' : 'open');
});

const detailsModal = document.getElementById('detailsModal');
const detailsTitle = document.getElementById('detailsTitle');
const detailsContent = document.getElementById('detailsContent');

function openDetailsModal(title, content) {
  if (!detailsModal || !detailsTitle || !detailsContent) return;
  detailsTitle.textContent = title;
  detailsContent.innerHTML = '';
  content.split('|').map(item => item.trim()).filter(Boolean).forEach(item => {
    const line = document.createElement('p');
    line.textContent = item;
    detailsContent.appendChild(line);
  });
  detailsModal.classList.add('is-open');
  detailsModal.setAttribute('aria-hidden', 'false');
}

function closeDetailsModal() {
  if (!detailsModal) return;
  detailsModal.classList.remove('is-open');
  detailsModal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('.view-btn');
  if (viewButton) {
    openDetailsModal(viewButton.dataset.title || 'عرض التفاصيل', viewButton.dataset.content || 'لا توجد تفاصيل حالياً');
  }

  if (event.target.closest('[data-close-modal]')) {
    closeDetailsModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDetailsModal();
});


const roleButtons = document.querySelectorAll('[data-role-view]');
const rolePanels = document.querySelectorAll('[data-role-panel]');

if (roleButtons.length && rolePanels.length) {
  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.roleView;

      roleButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      rolePanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.rolePanel === target));
    });
  });
}


// Routes for the new marketing system version
(function initNewRoutes() {
  const routes = window.MZJ_ROUTES || {};
  document.querySelectorAll('[data-route]').forEach((link) => {
    const routeKey = link.dataset.route;
    if (routes[routeKey]) link.setAttribute('href', routes[routeKey]);
  });

  const currentPage = (location.pathname.split('/').pop() || 'admin.html').toLowerCase();
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
    link.classList.toggle('active', href === currentPage || (currentPage === 'test.html' && href === 'admin.html'));
  });
})();

const taskDetailsModal = document.getElementById('taskDetailsModal');
const taskDetailsTitle = document.getElementById('taskDetailsTitle');
const taskDetailsDept = document.getElementById('taskDetailsDept');
const taskDetailsRequired = document.getElementById('taskDetailsRequired');
const taskStepButtons = document.getElementById('taskStepButtons');
const modalTaskPercent = document.getElementById('modalTaskPercent');
const modalCampaignPercent = document.getElementById('modalCampaignPercent');
let activeTaskCard = null;
let activeTaskDetailsMeta = null;
let taskAttachmentInput = null;

function getDriveUploadWebAppUrl() {
  return String(window.MZJ_DRIVE_UPLOAD_WEB_APP_URL || '').trim();
}

function rawDeptIdentity(dept) {
  if (!dept || typeof dept !== 'object') return '';
  return [
    dept.departmentId || dept.departmentKey || dept.departmentName || dept.id || dept.department || dept.name || '',
    dept.userId || dept.userUid || dept.uid || dept.assigneeUid || dept.userEmail || dept.assigneeEmail || dept.userName || dept.assigneeName || ''
  ].map((value) => String(value || '').trim()).filter(Boolean).join('::');
}

function getCurrentUserRole() {
  const authUser = window.MZJAuth?.getUser?.();
  return authUser?.role || document.body.dataset.userRole || localStorage.getItem('mzj_user_role') || 'user';
}

function isAdminUser() {
  return ['admin','marketing_manager'].includes(getCurrentUserRole());
}

function syncTaskProgress() {
  if (!taskStepButtons) return;

  const allButtons = Array.from(taskStepButtons.querySelectorAll('.task-step-btn'));
  const activeButtons = allButtons.filter((btn) => btn.classList.contains('is-done'));
  const taskPercent = Math.min(100, Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.stepValue || 0), 0)));
  const campaignPercent = Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.campaignValue || 0), 0));

  if (modalTaskPercent) modalTaskPercent.textContent = taskPercent + '%';
  if (modalCampaignPercent) modalCampaignPercent.textContent = campaignPercent + '%';

  if (activeTaskCard) {
    const selectedIndexes = activeButtons.map((btn) => btn.dataset.stepIndex).join(',');
    activeTaskCard.dataset.completedSteps = selectedIndexes;

    const taskPercentNode = activeTaskCard.querySelector('[data-task-percent]');
    const campaignPercentNode = activeTaskCard.querySelector('[data-campaign-percent]');
    const bar = activeTaskCard.querySelector('[data-task-bar]');

    if (taskPercentNode) taskPercentNode.textContent = taskPercent + '%';
    if (campaignPercentNode) campaignPercentNode.textContent = campaignPercent + '%';
    if (bar) bar.style.width = taskPercent + '%';
  }
}

function taskStepsForDept(deptKeyValue) {
  if (deptKeyValue === 'shooting') {
    return [
      { label: 'التصوير قبل الفلترة', value: 20 },
      { label: 'الاعتماد', value: 20, adminOnly: true },
      { label: 'الاديت', value: 20 },
      { label: 'الاعتماد', value: 20, adminOnly: true },
      { label: 'التسليم و الارفاق', value: 20 }
    ];
  }
  if (deptKeyValue === 'content' || deptKeyValue === 'publish') {
    return [
      { label: 'نموذج المحتوى', value: 20 },
      { label: 'الاعتماد', value: 20, adminOnly: true },
      { label: 'كتابة المحتوى', value: 20 },
      { label: 'الاعتماد', value: 20, adminOnly: true },
      { label: 'التسليم و الارفاق', value: 20 }
    ];
  }
  if (deptKeyValue === 'design') {
    return [
      { label: 'النسخة الأولى', value: 35 },
      { label: 'الاعتماد', value: 35, adminOnly: true },
      { label: 'التسليم و الارفاق', value: 30 }
    ];
  }
  if (deptKeyValue === 'montage') {
    return [
      { label: 'اختيار اللقطات المناسبة', value: 10 },
      { label: 'تجهيز مشاهد الذكاء الاصطناعي', value: 10 },
      { label: 'فويس أوفر', value: 10 },
      { label: 'الهوك', value: 10 },
      { label: 'الاعتماد', value: 15, adminOnly: true },
      { label: 'النسخة الأولى', value: 20 },
      { label: 'الاعتماد', value: 15, adminOnly: true },
      { label: 'التسليم و الارفاق', value: 10 }
    ];
  }
  return [
    { label: 'التصوير قبل الفلترة', value: 20 },
    { label: 'الاعتماد', value: 20, adminOnly: true },
    { label: 'الاديت', value: 20 },
    { label: 'الاعتماد', value: 20, adminOnly: true },
    { label: 'التسليم و الارفاق', value: 20 }
  ];
}

function encodeTaskSteps(steps) {
  return (steps || []).map((step) => [step.label || '', Number(step.value || 0), step.adminOnly ? '1' : '0'].join('::')).join('|');
}

function decodeTaskSteps(encoded, deptKeyValue) {
  const raw = String(encoded || '').split('|').map((step) => step.trim()).filter(Boolean);
  if (!raw.length) return taskStepsForDept(deptKeyValue);
  return raw.map((item) => {
    const parts = item.split('::');
    if (parts.length >= 2) return { label: parts[0] || '', value: Number(parts[1] || 0), adminOnly: parts[2] === '1' };
    const label = parts[0] || item;
    return { label, value: 20, adminOnly: label.includes('اعتماد') };
  });
}

function getTaskDetailsSteps(deptKeyValue) {
  return taskStepsForDept(deptKeyValue);
}

function formatDepartmentRequirement(deptTask) {
  if (!deptTask) return 'لا يوجد مطلوب مكتوب';
  const kind = deptKindFromName(deptTask.departmentName);
  if (kind === 'photography' && Array.isArray(deptTask.photoItems) && deptTask.photoItems.length) {
    return deptTask.photoItems.map((item, index) => `مطلوب ${index + 1}: نوع السيارة: ${item.carType || '—'} — نوع المحتوى: ${item.contentType || '—'}`).join(' | ');
  }
  if ((kind === 'design' || kind === 'montage') && Array.isArray(deptTask.selectedDeliverables) && deptTask.selectedDeliverables.length) {
    const text = deptTask.selectedDeliverables.map((item, index) => `مطلوب ${index + 1}: ${item.title || item.name || '—'} — ${item.desc || item.details || ''}`).join(' | ');
    return [text, deptTask.requiredText].filter(Boolean).join(' | ملاحظات: ');
  }
  return deptTask.requiredText || deptTask.deliveryDetails || deptTask.required || 'لا يوجد مطلوب مكتوب';
}

function renderTaskRequirementDetails(requiredText, deptKeyValue) {
  const clean = String(requiredText || '').trim();
  if (!clean) return '<span class="task-required-line">لا يوجد مطلوب مكتوب</span>';
  const safe = (value) => escapeHTML(value);
  const parts = clean.split('|').map(x => x.trim()).filter(Boolean);

  if (deptKeyValue === 'shooting') {
    const rows = parts.map((part, index) => {
      const carMatch = part.match(/نوع السيارة\s*:?\s*([^—|]+)/);
      const contentMatch = part.match(/نوع المحتوى\s*:?\s*(.+)$/);
      const car = carMatch ? carMatch[1].trim() : part.replace(/^مطلوب\s*\d+\s*:?/,'').trim();
      const content = contentMatch ? contentMatch[1].trim() : '—';
      return `<article class="photo-required-row">
        <div class="photo-required-cell"><small>نوع السيارة</small><strong>${safe(car || '—')}</strong></div>
        <div class="photo-required-cell"><small>نوع المحتوى</small><strong>${safe(content || '—')}</strong></div>
      </article>`;
    }).join('');
    return `<div class="photo-required-grid">${rows}</div>`;
  }

  return parts.map(x => `<span class="task-required-line">${safe(x)}</span>`).join('');
}


function isAttachmentActionLabel(value) {
  const text = String(value || '').trim();
  return text === 'إرفاق ملف' ||
    text === 'إرفاق ملف التصوير' ||
    text === 'إرفاق ملف الصور' ||
    text === 'إرفاق ملف الفيديو' ||
    text === 'إرفاق ملف اسكريبت';
}

function normalizeTaskFileRecord(file, index) {
  if (!file) return null;
  if (typeof file === 'string') {
    if (isAttachmentActionLabel(file)) return null;
    return { name: file, fileName: file, url: file, fileUrl: file, index };
  }
  const url = file.fileUrl || file.url || file.webViewLink || file.attachmentUrl || file.link || '';
  const rawName = file.fileName || file.name || file.title || file.label || '';
  if (!url && isAttachmentActionLabel(rawName)) return null;
  const name = rawName || (url ? 'ملف مرفق' : 'مرفق');
  return { ...file, name, fileName: name, url, fileUrl: url, index };
}

function getTaskDeptByMeta(meta) {
  if (meta?.deptData && typeof meta.deptData === 'object') return meta.deptData;
  if (!meta?.taskId) return null;
  const taskSource = typeof window.MZJReadDashboardTasks === 'function' ? window.MZJReadDashboardTasks() : [];
  const task = taskSource.find((item) => String(item.id || item.firestoreId || item.docId) === String(meta.taskId));
  if (!task) return null;
  const departments = Array.isArray(task.departmentTasks) ? task.departmentTasks : [];
  return departments.find((dept) => rawDeptIdentity(dept) === String(meta.deptIdentity || '') || deptIdentity(dept) === String(meta.deptIdentity || '')) || null;
}

function getDeptAttachmentFiles(dept) {
  if (!dept) return [];
  const combined = [];
  ['driveFiles', 'attachments', 'files', 'links'].forEach((key) => {
    const value = dept[key];
    if (Array.isArray(value)) value.forEach((file) => combined.push(file));
  });

  const normalizedFromArrays = combined.map(normalizeTaskFileRecord).filter(Boolean);
  const legacyUrl = dept.fileUrl || dept.attachmentUrl || '';

  // لا نعرض حقل attachmentLabel كأنه ملف مستقل.
  // لو عندنا arrays مرفقات، هي المصدر الأساسي، وحقل fileUrl القديم لا يتكرر كصف تاني.
  if (!normalizedFromArrays.length && legacyUrl) {
    normalizedFromArrays.push({
      name: dept.fileName || dept.attachmentFileName || 'ملف مرفق',
      fileName: dept.fileName || dept.attachmentFileName || 'ملف مرفق',
      url: legacyUrl,
      fileUrl: legacyUrl,
      uploadedAt: dept.uploadedAt || dept.attachmentUploadedAt || dept.updatedAt || ''
    });
  }

  const seen = new Set();
  return normalizedFromArrays.filter((file) => {
    const key = String(file.fileId || file.fileUrl || file.url || file.name || file.index || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function taskAttachmentKey(file) {
  const normalized = normalizeTaskFileRecord(file) || {};
  return String(
    normalized.fileId ||
    normalized.id ||
    normalized.fileUrl ||
    normalized.url ||
    normalized.webViewLink ||
    normalized.name ||
    normalized.fileName ||
    normalized.index ||
    ''
  ).trim();
}

function renderTaskAttachmentList(meta) {
  const dept = getTaskDeptByMeta(meta);
  const files = getDeptAttachmentFiles(dept).slice(0, 2);
  const rows = [];
  for (let index = 0; index < 2; index += 1) {
    const file = files[index];
    if (!file) {
      rows.push(`
        <tr class="is-empty">
          <td>${index + 1}</td>
          <td colspan="3">لا يوجد ملف في هذا الصف</td>
        </tr>
      `);
      continue;
    }
    const url = file.fileUrl || file.url || '';
    const name = file.fileName || file.name || 'ملف مرفق';
    const date = file.uploadedAt ? String(file.uploadedAt).slice(0, 10) : '-';
    const key = taskAttachmentKey(file) || String(index);
    rows.push(`
      <tr>
        <td>${index + 1}</td>
        <td>${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(name)}</a>` : `<span>${escapeHTML(name)}</span>`}</td>
        <td>${escapeHTML(date)}</td>
        <td><button type="button" class="danger-soft-btn task-attachment-delete-btn" data-delete-task-attachment="${escapeHTML(encodeURIComponent(key))}">مسح</button></td>
      </tr>
    `);
  }

  return `
    <div class="task-attachment-list is-table">
      <div class="task-attachment-head">
        <strong>المرفقات الحالية</strong>
        <small>${files.length} / 2</small>
      </div>
      <div class="task-attachment-table-wrap">
        <table class="task-attachment-table">
          <thead>
            <tr>
              <th>م</th>
              <th>الملف</th>
              <th>تاريخ الرفع</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function attachmentLabelForDeptKey(deptKeyValue) {
  if (deptKeyValue === 'shooting') return 'إرفاق ملف التصوير';
  if (deptKeyValue === 'design') return 'إرفاق ملف الصور';
  if (deptKeyValue === 'montage') return 'إرفاق ملف الفيديو';
  return 'إرفاق ملف اسكريبت';
}

function ensureTaskAttachmentInput() {
  if (taskAttachmentInput) return taskAttachmentInput;
  taskAttachmentInput = document.createElement('input');
  taskAttachmentInput.type = 'file';
  taskAttachmentInput.hidden = true;
  taskAttachmentInput.setAttribute('data-task-attachment-input', 'true');
  document.body.appendChild(taskAttachmentInput);
  taskAttachmentInput.addEventListener('change', handleTaskAttachmentSelected);
  return taskAttachmentInput;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadTaskFileToDrive(file, meta) {
  const webAppUrl = getDriveUploadWebAppUrl();
  if (!webAppUrl) {
    throw new Error('رابط Apps Script Web App غير مضاف. افتح firebase-config.js وضع الرابط في window.MZJ_DRIVE_UPLOAD_WEB_APP_URL.');
  }

  const base64 = await fileToBase64(file);
  const payload = {
    action: 'uploadTaskAttachment',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64,
    meta: {
      taskId: meta?.taskId || '',
      departmentIdentity: meta?.deptIdentity || '',
      departmentKey: meta?.deptKey || '',
      departmentName: meta?.departmentName || '',
      campaignName: meta?.campaignName || '',
      campaignCode: meta?.campaignCode || '',
      taskType: meta?.taskType || '',
      uploadedBy: window.MZJAuth?.getUser?.()?.email || window.MZJAuth?.getUser?.()?.name || ''
    }
  };

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let result = null;
  try { result = JSON.parse(text); } catch (error) { result = { ok: response.ok, raw: text }; }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || result.message || 'فشل رفع الملف على Google Drive.');
  }
  return {
    name: result.name || file.name,
    fileName: result.fileName || result.name || file.name,
    url: result.url || result.fileUrl || result.webViewLink || '',
    fileUrl: result.fileUrl || result.url || result.webViewLink || '',
    fileId: result.fileId || result.id || '',
    mimeType: file.type || result.mimeType || '',
    size: file.size || 0,
    uploadedAt: new Date().toISOString(),
    uploadedBy: payload.meta.uploadedBy,
    departmentKey: payload.meta.departmentKey,
    departmentName: payload.meta.departmentName
  };
}

function filterAttachmentArrayByKey(value, fileKey) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => taskAttachmentKey(item) !== String(fileKey || ''));
}

async function removeTaskAttachmentFromFirebase(meta, encodedFileKey) {
  const fileKey = decodeURIComponent(String(encodedFileKey || ''));
  if (!fileKey) throw new Error('لم يتم تحديد الملف المطلوب مسحه.');
  if (!meta?.taskId) throw new Error('لا يوجد رقم للتاسك لمسح المرفق.');
  if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود.');
  if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);

  const db = firebase.firestore();
  const docRef = db.collection('workspace_tasks').doc(String(meta.taskId));
  const snap = await docRef.get();
  if (!snap.exists) throw new Error('لم يتم العثور على الحملة في workspace_tasks لمسح المرفق.');

  const data = snap.data() || {};
  const departmentTasks = Array.isArray(data.departmentTasks) ? data.departmentTasks : [];
  let removed = false;
  const updatedDepartments = departmentTasks.map((dept) => {
    const sameDept = rawDeptIdentity(dept) === String(meta.deptIdentity || '');
    if (!sameDept) return dept;

    const beforeCount = getDeptAttachmentFiles(dept).length;
    const nextFiles = filterAttachmentArrayByKey(dept.files, fileKey);
    const nextAttachments = filterAttachmentArrayByKey(dept.attachments, fileKey);
    const nextDriveFiles = filterAttachmentArrayByKey(dept.driveFiles, fileKey);
    const nextDept = {
      ...dept,
      files: nextFiles,
      attachments: nextAttachments,
      driveFiles: nextDriveFiles,
      updatedAt: new Date().toISOString()
    };
    if (taskAttachmentKey({ fileUrl: dept.fileUrl || dept.attachmentUrl || '', name: dept.attachmentLabel || 'ملف مرفق' }) === fileKey) {
      nextDept.fileUrl = '';
      nextDept.attachmentUrl = '';
    }
    const afterCount = getDeptAttachmentFiles(nextDept).length;
    if (afterCount < beforeCount) removed = true;
    return nextDept;
  });

  await docRef.set({
    departmentTasks: updatedDepartments,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  if (meta.deptData && typeof meta.deptData === 'object') {
    const nextDeptData = {
      ...meta.deptData,
      files: filterAttachmentArrayByKey(meta.deptData.files, fileKey),
      attachments: filterAttachmentArrayByKey(meta.deptData.attachments, fileKey),
      driveFiles: filterAttachmentArrayByKey(meta.deptData.driveFiles, fileKey),
      updatedAt: new Date().toISOString()
    };
    if (taskAttachmentKey({ fileUrl: meta.deptData.fileUrl || meta.deptData.attachmentUrl || '', name: meta.deptData.attachmentLabel || 'ملف مرفق' }) === fileKey) {
      nextDeptData.fileUrl = '';
      nextDeptData.attachmentUrl = '';
    }
    meta.deptData = nextDeptData;
  }

  if (typeof window.MZJRefreshDashboardTaskCache === 'function') {
    window.MZJRefreshDashboardTaskCache(String(meta.taskId), updatedDepartments);
  }
  return removed;
}

async function saveTaskAttachmentToFirebase(meta, fileRecord) {
  if (!meta?.taskId) throw new Error('لا يوجد رقم للتاسك لحفظ المرفق.');
  if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود.');
  if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);

  const db = firebase.firestore();
  const docRef = db.collection('workspace_tasks').doc(String(meta.taskId));
  const snap = await docRef.get();
  if (!snap.exists) throw new Error('لم يتم العثور على الحملة في workspace_tasks لحفظ المرفق.');

  const data = snap.data() || {};
  const departmentTasks = Array.isArray(data.departmentTasks) ? data.departmentTasks : [];
  const updatedDepartments = departmentTasks.map((dept) => {
    const sameDept = rawDeptIdentity(dept) === String(meta.deptIdentity || '');
    if (!sameDept) return dept;
    const files = Array.isArray(dept.files) ? dept.files.slice() : [];
    const attachments = Array.isArray(dept.attachments) ? dept.attachments.slice() : [];
    const driveFiles = Array.isArray(dept.driveFiles) ? dept.driveFiles.slice() : [];
    files.push(fileRecord);
    attachments.push(fileRecord);
    driveFiles.push(fileRecord);
    return {
      ...dept,
      files,
      attachments,
      driveFiles,
      fileUrl: fileRecord.fileUrl || fileRecord.url || '',
      attachmentUrl: fileRecord.fileUrl || fileRecord.url || '',
      updatedAt: new Date().toISOString()
    };
  });

  await docRef.set({
    departmentTasks: updatedDepartments,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  if (meta.deptData && typeof meta.deptData === 'object') {
    const currentFiles = Array.isArray(meta.deptData.files) ? meta.deptData.files.slice() : [];
    const currentAttachments = Array.isArray(meta.deptData.attachments) ? meta.deptData.attachments.slice() : [];
    const currentDriveFiles = Array.isArray(meta.deptData.driveFiles) ? meta.deptData.driveFiles.slice() : [];
    currentFiles.push(fileRecord);
    currentAttachments.push(fileRecord);
    currentDriveFiles.push(fileRecord);
    meta.deptData = {
      ...meta.deptData,
      files: currentFiles,
      attachments: currentAttachments,
      driveFiles: currentDriveFiles,
      fileUrl: fileRecord.fileUrl || fileRecord.url || '',
      attachmentUrl: fileRecord.fileUrl || fileRecord.url || '',
      updatedAt: new Date().toISOString()
    };
  }
  if (typeof window.MZJRefreshDashboardTaskCache === 'function') {
    window.MZJRefreshDashboardTaskCache(String(meta.taskId), updatedDepartments);
  }
}

async function handleTaskAttachmentSelected(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file || !activeTaskDetailsMeta) return;
  const uploadButton = taskDetailsModal?.querySelector('[data-upload-task-attachment]');
  const oldText = uploadButton?.textContent || '';
  const currentFilesCount = getDeptAttachmentFiles(getTaskDeptByMeta(activeTaskDetailsMeta)).length;
  if (currentFilesCount >= 2) {
    alert('الحد الأقصى 2 مرفقات. امسح ملف قديم أولاً ثم ارفع الملف الجديد.');
    return;
  }
  try {
    if (uploadButton) { uploadButton.disabled = true; uploadButton.textContent = 'جاري الرفع...'; }
    const fileRecord = await uploadTaskFileToDrive(file, activeTaskDetailsMeta);
    await saveTaskAttachmentToFirebase(activeTaskDetailsMeta, fileRecord);
    alert('تم رفع الملف بنجاح.');
    const attachBox = taskDetailsModal?.querySelector('[data-task-attachment-box]');
    if (attachBox) {
      attachBox.innerHTML = `<button class="soft-btn upload-task-file-btn" type="button" data-upload-task-attachment>${attachmentLabelForDeptKey(activeTaskDetailsMeta?.deptKey || '')}</button>${renderTaskAttachmentList(activeTaskDetailsMeta)}`;
    }
    if (window.renderDashboardTasks) window.renderDashboardTasks();
  } catch (error) {
    console.error('task attachment upload failed:', error);
    alert('فشل رفع المرفق: ' + (error.message || error.code || error));
  } finally {
    if (uploadButton) { uploadButton.disabled = false; uploadButton.textContent = oldText || attachmentLabelForDeptKey(activeTaskDetailsMeta?.deptKey || ''); }
  }
}

function openTaskDetails(button) {
  if (!taskDetailsModal || !taskStepButtons) return;

  activeTaskCard = button.closest('[data-dept-task-card]') || button.closest('.dept-card-template');
  const selected = (activeTaskCard?.dataset.completedSteps || '').split(',').filter(Boolean);
  let deptDataFromButton = null;
  try {
    deptDataFromButton = button.dataset.deptTaskJson ? JSON.parse(decodeURIComponent(button.dataset.deptTaskJson)) : null;
  } catch (error) {
    deptDataFromButton = null;
  }
  activeTaskDetailsMeta = {
    taskId: activeTaskCard?.dataset.taskId || '',
    deptIdentity: activeTaskCard?.dataset.deptIdentity || '',
    deptKey: button.dataset.deptKey || '',
    departmentName: button.dataset.dept || '',
    campaignName: button.dataset.taskTitle || '',
    campaignCode: activeTaskCard?.dataset.campaignCode || '',
    taskType: activeTaskCard?.dataset.taskType || '',
    deptData: deptDataFromButton
  };

  if (taskDetailsDept) taskDetailsDept.textContent = button.dataset.dept || 'تفاصيل القسم';
  if (taskDetailsTitle) taskDetailsTitle.textContent = button.dataset.taskTitle || 'تفاصيل التاسك';
  if (taskDetailsRequired) {
    taskDetailsRequired.innerHTML = renderTaskRequirementDetails(button.dataset.required || '', button.dataset.deptKey || '');
  }

  taskStepButtons.innerHTML = '';
  const deptKeyValue = button.dataset.deptKey || activeTaskDetailsMeta?.deptKey || '';
  const steps = decodeTaskSteps(button.dataset.steps || '', deptKeyValue);
  const deptCampaignShare = activeTaskCard ? Number(activeTaskCard.dataset.departmentShare || 0) : 0;

  steps.forEach((step, index) => {
    const isApprovalStep = Boolean(step.adminOnly) || String(step.label || '').includes('اعتماد');
    const stepValue = Number(step.value || 0);
    const campaignValue = Math.round((deptCampaignShare * stepValue / 100) * 100) / 100;
    const stepButton = document.createElement('button');
    stepButton.type = 'button';
    stepButton.className = 'task-step-btn';
    stepButton.dataset.stepIndex = String(index);
    stepButton.dataset.stepValue = String(stepValue);
    stepButton.dataset.campaignValue = String(campaignValue);

    if (isApprovalStep) {
      stepButton.classList.add('is-approval-step');
      if (!isAdminUser()) {
        stepButton.disabled = true;
        stepButton.title = 'أدمن فقط';
      }
    }

    if (selected.includes(String(index))) stepButton.classList.add('is-done');
    stepButton.innerHTML = `<span>${escapeHTML(step.label || 'خطوة')}</span><small>${stepValue}% من التاسك<br>${campaignValue}% من الحملة${isApprovalStep ? '<br>أدمن فقط' : ''}</small>`;
    taskStepButtons.appendChild(stepButton);
  });

  let attachBox = taskDetailsModal.querySelector('[data-task-attachment-box]');
  if (!attachBox && taskStepButtons) {
    attachBox = document.createElement('div');
    attachBox.className = 'task-attachment-box';
    attachBox.setAttribute('data-task-attachment-box', 'true');
    taskStepButtons.insertAdjacentElement('afterend', attachBox);
  }
  if (attachBox) {
    attachBox.innerHTML = `<button class="soft-btn upload-task-file-btn" type="button" data-upload-task-attachment>${attachmentLabelForDeptKey(button.dataset.deptKey || '')}</button>${renderTaskAttachmentList(activeTaskDetailsMeta)}`;
  }
  taskDetailsModal.classList.add('is-open');
  taskDetailsModal.setAttribute('aria-hidden', 'false');
  syncTaskProgress();
}

function closeTaskDetails() {
  if (!taskDetailsModal) return;
  taskDetailsModal.classList.remove('is-open');
  taskDetailsModal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (event) => {
  const taskDetailsButton = event.target.closest('[data-open-task-details]');
  if (taskDetailsButton) openTaskDetails(taskDetailsButton);

  const uploadTaskAttachment = event.target.closest('[data-upload-task-attachment]');
  if (uploadTaskAttachment) {
    ensureTaskAttachmentInput().click();
  }

  const deleteTaskAttachment = event.target.closest('[data-delete-task-attachment]');
  if (deleteTaskAttachment) {
    const encodedKey = deleteTaskAttachment.getAttribute('data-delete-task-attachment') || '';
    if (!encodedKey || !activeTaskDetailsMeta) return;
    if (!confirm('هل تريد مسح هذا المرفق من قاعدة البيانات؟')) return;
    const oldText = deleteTaskAttachment.textContent;
    deleteTaskAttachment.disabled = true;
    deleteTaskAttachment.textContent = 'جاري المسح...';
    removeTaskAttachmentFromFirebase(activeTaskDetailsMeta, encodedKey)
      .then(() => {
        const attachBox = taskDetailsModal?.querySelector('[data-task-attachment-box]');
        if (attachBox) {
          attachBox.innerHTML = `<button class="soft-btn upload-task-file-btn" type="button" data-upload-task-attachment>${attachmentLabelForDeptKey(activeTaskDetailsMeta?.deptKey || '')}</button>${renderTaskAttachmentList(activeTaskDetailsMeta)}`;
        }
        if (window.renderDashboardTasks) window.renderDashboardTasks();
      })
      .catch((error) => {
        console.error('task attachment delete failed:', error);
        alert('فشل مسح المرفق: ' + (error.message || error.code || error));
      })
      .finally(() => {
        deleteTaskAttachment.disabled = false;
        deleteTaskAttachment.textContent = oldText || 'مسح';
      });
  }

  const stepButton = event.target.closest('.task-step-btn');
  if (stepButton && !stepButton.disabled) {
    stepButton.classList.toggle('is-done');
    syncTaskProgress();
  }

  if (event.target.closest('[data-close-task-modal]') || event.target === taskDetailsModal) {
    closeTaskDetails();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTaskDetails();
});

// Dynamic Excel templates for campaigns and agendas
const MZJ_TEMPLATE_COLLECTION = 'campaign_templates';
const MZJ_CREATED_TASKS_KEY = 'mzj_created_tasks_from_templates_v1';
let MZJ_TASK_TEMPLATES_CACHE = [];

function getMarketingFirestore() {
  if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) {
    throw new Error('Firebase SDK غير موجود أو firebase-config.js غير محمل.');
  }
  if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
  return firebase.firestore();
}

function normalizeTemplateRows(rows) {
  if (!rows) return [];
  if (Array.isArray(rows)) {
    return rows.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => String(cell ?? '').trim());
      if (row && Array.isArray(row.cells)) return row.cells.map((cell) => String(cell ?? '').trim());
      return [];
    }).filter((row) => row.some(Boolean));
  }
  if (typeof rows === 'object') {
    return Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map((key) => {
      const row = rows[key];
      if (Array.isArray(row)) return row.map((cell) => String(cell ?? '').trim());
      if (row && Array.isArray(row.cells)) return row.cells.map((cell) => String(cell ?? '').trim());
      return [];
    }).filter((row) => row.some(Boolean));
  }
  return [];
}

function firestoreSafeTemplate(template, id) {
  const copy = JSON.parse(JSON.stringify({ ...template, id }));
  const rows = normalizeTemplateRows(copy.rows);
  copy.headers = Array.isArray(copy.headers) ? copy.headers.map((cell) => String(cell ?? '').trim()) : [];
  copy.sampleRow = Array.isArray(copy.sampleRow) ? copy.sampleRow.map((cell) => String(cell ?? '').trim()) : [];
  // Firestore rejects an array that directly contains arrays.
  // Store each row as a map with a cells array, then normalize it back on read.
  copy.rows = rows.map((cells, index) => ({ index, cells }));
  copy.rowsCount = Number(copy.rowsCount || rows.length || 0);
  return copy;
}

function normalizeTaskTemplate(docId, data = {}) {
  const template = { id: data.id || docId, ...data };
  template.type = template.type || 'campaign';
  template.headers = Array.isArray(template.headers) ? template.headers : [];
  template.sampleRow = Array.isArray(template.sampleRow) ? template.sampleRow : [];
  template.rows = normalizeTemplateRows(template.rows);
  template.rowsCount = Number(template.rowsCount || template.rows.length || 0);
  return template;
}

function loadTaskTemplates() {
  return Array.isArray(MZJ_TASK_TEMPLATES_CACHE) ? MZJ_TASK_TEMPLATES_CACHE : [];
}

async function loadTaskTemplatesFromFirebase() {
  const db = getMarketingFirestore();
  const snap = await db.collection(MZJ_TEMPLATE_COLLECTION).get();
  const templates = [];
  snap.forEach((doc) => templates.push(normalizeTaskTemplate(doc.id, doc.data() || {})));
  templates.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  MZJ_TASK_TEMPLATES_CACHE = templates;
  return templates;
}

async function saveTaskTemplateToFirebase(template) {
  const db = getMarketingFirestore();
  const id = template.id || ('tpl_' + Date.now());
  const payload = firestoreSafeTemplate(template, id);
  await db.collection(MZJ_TEMPLATE_COLLECTION).doc(id).set(payload, { merge: true });
  await loadTaskTemplatesFromFirebase();
  return normalizeTaskTemplate(id, payload);
}

async function deleteTaskTemplateFromFirebase(id) {
  if (!id) return;
  const db = getMarketingFirestore();
  await db.collection(MZJ_TEMPLATE_COLLECTION).doc(String(id)).delete();
  await loadTaskTemplatesFromFirebase();
}

function templateMatchesType(template, taskType) {
  return template.type === 'both' || template.type === taskType;
}

function typeLabel(type) {
  if (type === 'campaign') return 'الحملات فقط';
  if (type === 'agenda') return 'الأجندات فقط';
  return 'الحملات والأجندات';
}

function getTemplateRows(template) {
  if (!template) return [];
  const normalizedRows = normalizeTemplateRows(template.rows);
  if (normalizedRows.length) return normalizedRows;
  const headers = Array.isArray(template.headers) ? template.headers : [];
  const sample = Array.isArray(template.sampleRow) ? template.sampleRow : [];
  return [headers, sample].filter((row) => row && row.some((cell) => String(cell ?? '').trim()));
}

function renderTemplateSheet(container, template, options = {}) {
  if (!container) return;
  const title = options.title || 'معاينة القالب';
  const editable = Boolean(options.editable);
  const rows = getTemplateRows(template);
  if (!template || !rows.length) {
    container.innerHTML = `<strong>${title}</strong><p>لا يوجد قالب حملة مختار حالياً.</p>`;
    return;
  }

  const maxCols = Math.max(...rows.map((row) => row.length), 1);
  const rowsHtml = rows.map((row, rowIndex) => {
    const cells = Array.from({ length: maxCols }).map((_, colIndex) => {
      const value = row[colIndex] || '';
      if (editable) {
        return `<td><input type="text" data-template-cell data-template-row="${rowIndex}" data-template-col="${colIndex}" value="${escapeHTML(value)}" placeholder="اكتب هنا"></td>`;
      }
      return `<td>${escapeHTML(value)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="template-sheet-head">
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(template.name || 'قالب حملة')} ${template.fileName ? '— ' + escapeHTML(template.fileName) : ''}</p>
    </div>
    <div class="template-sheet-scroll">
      <table class="template-sheet-table ${editable ? 'is-editable' : ''}">
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function renderTemplatePreview(container, template, titlePrefix = 'شكل القالب') {
  renderTemplateSheet(container, template, { title: titlePrefix, editable: false });
}

function initTemplatesPage() {
  const form = document.getElementById('templateUploadForm');
  const list = document.getElementById('savedTemplateList');
  const preview = document.getElementById('templatePreviewBox');
  const sheetName = document.getElementById('templateSheetName');
  const note = document.getElementById('templateFormNote');
  const clearBtn = document.getElementById('clearTemplateForm');
  if (!form || !list) return;

  const nameInput = document.getElementById('templateName');
  const typeInput = document.getElementById('templateType');
  const fileInput = document.getElementById('templateFile');
  let pendingTemplateData = null;

  async function renderSavedTemplates() {
    let templates = [];
    try {
      templates = await loadTaskTemplatesFromFirebase();
      if (note) note.textContent = 'القوالب محفوظة على Firebase وتظهر لكل الأدمن واليوزرات المصرح لهم.';
    } catch (error) {
      templates = loadTaskTemplates();
      if (note) note.textContent = '⚠️ فشل قراءة Templates من Firebase: ' + (error?.message || error?.code || error);
    }
    if (!templates.length) {
      list.innerHTML = '<p class="template-empty">لسه مفيش Templates محفوظة. ارفع أول شيت واحفظه باسم.</p>';
      return;
    }

    list.innerHTML = templates.map((template) => `
      <article class="saved-template-item" data-template-id="${template.id}">
        <div>
          <strong>${template.name}</strong>
          <small>${typeLabel(template.type)} — ${template.headers.length} خانة — ${template.fileName || ''}</small>
        </div>
        <div class="template-item-actions">
          <button class="soft-btn" type="button" data-preview-template="${template.id}">معاينة</button>
          <button class="danger-btn" type="button" data-delete-template="${template.id}">حذف</button>
        </div>
      </article>
    `).join('');
  }


  function normalizedWorkbookSheetName(name) {
    return templateCellText(name).toLowerCase().replace(/[\s_\-]+/g, '').replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه');
  }

  function pickCampaignContentSheetName(workbook) {
    const names = workbook?.SheetNames || [];
    if (!names.length) return '';
    const wanted = [
      'محتوي الحمله',
      'محتوى الحملة',
      'محتوي الحملة',
      'محتوى الحمله',
      'campaign content',
      'campaign_content'
    ].map(normalizedWorkbookSheetName);
    const exact = names.find((name) => wanted.includes(normalizedWorkbookSheetName(name)));
    if (exact) return exact;
    const loose = names.find((name) => {
      const key = normalizedWorkbookSheetName(name);
      return (key.includes('محتوي') || key.includes('محتوى')) && (key.includes('الحمله') || key.includes('الحملة'));
    });
    if (loose) return loose;
    return names[0];
  }

  async function parseTemplateFile(file) {
    if (!window.XLSX) throw new Error('مكتبة قراءة Excel لم يتم تحميلها. تأكد من الاتصال بالإنترنت أو أضف ملف xlsx.full.min.js محلياً.');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = pickCampaignContentSheetName(workbook);
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const cleanRows = rawRows
      .map((row) => (row || []).map((cell) => String(cell ?? '').trim()))
      .filter((row) => row.some(Boolean));
    const headerRow = (cleanRows[0] || []).map((cell) => String(cell).trim()).filter(Boolean);
    if (!headerRow.length) throw new Error('الشيت لازم يكون فيه بيانات في أول صف.');
    const sampleRow = (cleanRows[1] || []).map((cell) => String(cell).trim());
    return { sheetName: firstSheetName, headers: headerRow, sampleRow, rows: cleanRows, rowsCount: cleanRows.length };
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    pendingTemplateData = null;
    if (!file) return;
    try {
      const parsed = await parseTemplateFile(file);
      pendingTemplateData = parsed;
      if (sheetName) sheetName.textContent = parsed.sheetName;
      renderTemplatePreview(preview, {
        name: nameInput.value || 'Template جديد',
        type: typeInput.value,
        fileName: file.name,
        headers: parsed.headers,
        sampleRow: parsed.sampleRow
      }, 'معاينة القالب');
      if (note) note.textContent = 'تمت قراءة الشيت. اضغط حفظ Template في السيستم.';
    } catch (error) {
      if (note) note.textContent = '⚠️ ' + error.message;
      renderTemplatePreview(preview, null, 'شكل القالب');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      if (!pendingTemplateData) pendingTemplateData = await parseTemplateFile(file);
      const template = {
        id: 'tpl_' + Date.now(),
        name: nameInput.value.trim(),
        type: typeInput.value,
        fileName: file.name,
        sheetName: pendingTemplateData.sheetName,
        headers: pendingTemplateData.headers,
        sampleRow: pendingTemplateData.sampleRow,
        rows: pendingTemplateData.rows || [],
        rowsCount: pendingTemplateData.rowsCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'firebase'
      };
      await saveTaskTemplateToFirebase(template);
      await renderSavedTemplates();
      renderTemplatePreview(preview, template, 'تم حفظ القالب');
      if (note) note.textContent = '✅ تم حفظ Template على Firebase وسيظهر عند باقي اليوزرات.';
      form.reset();
      pendingTemplateData = null;
    } catch (error) {
      if (note) note.textContent = '⚠️ ' + error.message;
    }
  });

  list.addEventListener('click', async (event) => {
    const previewButton = event.target.closest('[data-preview-template]');
    const deleteButton = event.target.closest('[data-delete-template]');
    const templates = loadTaskTemplates();

    if (previewButton) {
      const template = templates.find((item) => item.id === previewButton.dataset.previewTemplate);
      renderTemplatePreview(preview, template, 'معاينة القالب');
      if (sheetName && template) sheetName.textContent = template.sheetName || 'Template محفوظ';
    }

    if (deleteButton) {
      try {
        await deleteTaskTemplateFromFirebase(deleteButton.dataset.deleteTemplate);
        await renderSavedTemplates();
        if (note) note.textContent = 'تم حذف Template من Firebase.';
      } catch (error) {
        if (note) note.textContent = '⚠️ فشل حذف Template من Firebase: ' + (error?.message || error?.code || error);
      }
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      form.reset();
      pendingTemplateData = null;
      renderTemplatePreview(preview, null, 'شكل القالب');
      if (sheetName) sheetName.textContent = 'لم يتم رفع ملف';
      if (note) note.textContent = 'جاهز لرفع Template جديد.';
    });
  }

  renderSavedTemplates();
}


function escapeHTML(value) {
  return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

const MZJ_DEPARTMENTS_FALLBACK = [
  { id: 'photography', name: 'قسم التصوير', users: ['ناجي'] },
  { id: 'content', name: 'قسم المحتوى', users: ['بلال'] },
  { id: 'design', name: 'قسم التصميم', users: ['عبدالله'] },
  { id: 'montage', name: 'قسم المونتاج', users: ['محمود'] },
  { id: 'publishing', name: 'قسم النشر', users: ['حسام'] }
];

function normalizeContentTaskDepartment(item, index) {
  const name = item?.name || item?.title || item?.departmentName || item?.sectionName || item?.department || ('قسم ' + (index + 1));
  const usersRaw = item?.users || item?.members || item?.responsibles || item?.assignees || item?.team || [];
  const users = Array.isArray(usersRaw)
    ? usersRaw.map((user) => {
        if (typeof user === 'string') return { name: user, email: user, label: user };
        const userName = user?.name || user?.displayName || user?.fullName || user?.email || '';
        const userEmail = user?.email || '';
        const userId = user?.id || user?.uid || userEmail || userName;
        if (!userId && !userName && !userEmail) return null;
        return {
          id: userId,
          name: userName,
          email: userEmail,
          department: user?.department || user?.departmentId || '',
          label: userEmail && userName && userEmail !== userName ? `${userName} — ${userEmail}` : (userName || userEmail || userId)
        };
      }).filter(Boolean)
    : [];
  const userIds = Array.isArray(item?.userIds) ? item.userIds : [];
  const memberUids = Array.isArray(item?.memberUids) ? item.memberUids : [];
  const memberEmails = Array.isArray(item?.memberEmails) ? item.memberEmails : [];
  return {
    id: item?.id || item?.docId || ('dept_' + index),
    name,
    users,
    userIds,
    memberUids,
    memberEmails
  };
}

async function loadDepartmentsFromContentTasks() {
  if (window.MZJDepartments?.loadDepartments) {
    try {
      const managedDepartments = await window.MZJDepartments.loadDepartments();
      if (Array.isArray(managedDepartments) && managedDepartments.length) return managedDepartments.map(normalizeContentTaskDepartment);
    } catch (error) {}
  }

  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('departments').get();
      const cloudDepartments = [];
      snap.forEach((doc) => cloudDepartments.push({ id: doc.id, ...(doc.data() || {}) }));
      if (cloudDepartments.length) return cloudDepartments.map(normalizeContentTaskDepartment);
    } catch (error) { console.warn('departments firestore fallback:', error); }
  }

  const localSources = [
    'mzj_departments',
    'content_tasks',
    'mzj_content_tasks',
    'mzj_content_departments'
  ];

  for (const key of localSources) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(normalizeContentTaskDepartment);
      }
    } catch (error) {}
  }

  // Firebase-ready hook: عند تفعيل Firebase SDK وتوفير window.MZJ_DB يمكن قراءة collection content_tasks من هنا.
  if (window.MZJ_CONTENT_TASKS && Array.isArray(window.MZJ_CONTENT_TASKS)) {
    return window.MZJ_CONTENT_TASKS.map(normalizeContentTaskDepartment);
  }

  return MZJ_DEPARTMENTS_FALLBACK;
}

function renderDepartmentOptions(departments) {
  return '<option value="">اختار القسم</option>' + departments.map((dept) => (
    `<option value="${escapeHTML(dept.id)}">${escapeHTML(dept.name)}</option>`
  )).join('');
}


function normalizeSystemUser(user) {
  if (!user) return null;
  if (typeof user === 'string') {
    const value = user.trim ? user.trim() : String(user);
    return value ? { id: value, uid: value, name: value, email: '', department: '', label: value } : null;
  }
  const email = String(user.email || user.mail || user.userEmail || '').trim();
  const uid = String(user.uid || user.userId || user.id || email || user.name || user.displayName || '').trim();
  const id = String(user.id || user.uid || user.userId || email || user.name || user.displayName || '').trim();
  const name = String(user.name || user.displayName || user.fullName || user.username || email || id || uid || '').trim();
  if (!id && !uid && !name && !email) return null;
  const department = user.department || user.departmentId || user.departmentName || user.section || user.sectionId || '';
  return {
    id: id || uid || email || name,
    uid: uid || id || email || name,
    name: name || email || id || uid,
    displayName: user.displayName || name || email || id || uid,
    email,
    department,
    departmentId: user.departmentId || user.department || '',
    departmentName: user.departmentName || user.sectionName || '',
    role: user.role || 'user',
    label: email && name && email !== name ? `${name} — ${email}` : (name || email || id || uid)
  };
}

async function loadUsersFromSystemPath() {
  const collected = [];
  const fallback = (window.MZJAuth?.users || []).map(normalizeSystemUser).filter(Boolean);
  if (window.MZJAuth?.loadLocalManagedUsers) collected.push(...window.MZJAuth.loadLocalManagedUsers().map(normalizeSystemUser).filter(Boolean));

  ['mzj_admin_users_cache_v1','users','user'].forEach((key) => {
    try {
      const localUsers = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(localUsers) && localUsers.length) collected.push(...localUsers.map(normalizeSystemUser).filter(Boolean));
    } catch (error) {}
  });

  if (window.firebase && window.MZJ_FIREBASE_CONFIG) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('users').get();
      snap.forEach((doc) => collected.push(normalizeSystemUser({ id: doc.id, ...(doc.data() || {}) })));
    } catch (error) {
      console.warn('users path fallback:', error);
    }
  }

  const sourceUsers = collected.length ? collected : fallback;
  const map = new Map();
  sourceUsers.filter(Boolean).forEach((user) => {
    const key = String(user.email || user.name || user.id).toLowerCase();
    if (key) map.set(key, { ...(map.get(key) || {}), ...user });
  });
  return Array.from(map.values());
}

function renderUserOptions(users, departmentId = '', allowFallback = true) {
  const list = (users || []).filter(Boolean).map(normalizeSystemUser).filter(Boolean);
  if (!list.length) {
    return '<option value="">لا يوجد يوزرات محفوظة - أضفهم من صفحة الأقسام</option>';
  }
  const deptFiltered = departmentId ? list.filter((user) => !user.department || String(user.department) === String(departmentId)) : list;
  const finalList = (deptFiltered.length || !allowFallback) ? deptFiltered : list;
  if (!finalList.length) return '<option value="">لا يوجد يوزرات في هذا القسم</option>';
  return '<option value="">اختار اليوزر</option>' + finalList.map((user) => {
    const value = user.email || user.name || user.id;
    return `<option value="${escapeHTML(value)}" data-user-id="${escapeHTML(user.id || '')}" data-user-uid="${escapeHTML(user.uid || user.id || '')}" data-user-name="${escapeHTML(user.name || '')}" data-user-email="${escapeHTML(user.email || '')}">${escapeHTML(user.label || value)}</option>`;
  }).join('');
}

function usersForDepartment(dept, allUsers) {
  const normalizedAllUsers = (allUsers || []).map(normalizeSystemUser).filter(Boolean);
  const byKey = new Map();
  normalizedAllUsers.forEach((user) => {
    [user.id, user.uid, user.email, user.name, user.displayName].filter(Boolean).forEach((key) => {
      byKey.set(String(key).trim().toLowerCase(), user);
    });
  });

  const explicitUsers = Array.isArray(dept?.users) ? dept.users.map(normalizeSystemUser).filter(Boolean) : [];
  const deptKeys = []
    .concat(Array.isArray(dept?.userIds) ? dept.userIds : [])
    .concat(Array.isArray(dept?.memberUids) ? dept.memberUids : [])
    .concat(Array.isArray(dept?.memberEmails) ? dept.memberEmails : [])
    .concat(Array.isArray(dept?.members) ? dept.members : [])
    .concat(Array.isArray(dept?.assignees) ? dept.assignees : []);
  const linkedUsers = deptKeys.map((key) => {
    if (key && typeof key === 'object') return normalizeSystemUser(key);
    return byKey.get(String(key || '').trim().toLowerCase());
  }).filter(Boolean);

  const deptId = String(dept?.id || '').trim().toLowerCase();
  const deptName = String(dept?.name || dept?.departmentName || '').trim().toLowerCase();
  const departmentUsers = normalizedAllUsers.filter((user) => {
    const values = [user.department, user.departmentId, user.departmentName, user.section, user.sectionId]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return values.includes(deptId) || values.includes(deptName);
  });

  const merged = new Map();
  [...explicitUsers, ...linkedUsers, ...departmentUsers].forEach((user) => {
    const key = String(user.uid || user.id || user.email || user.name || '').trim().toLowerCase();
    if (key) merged.set(key, { ...user, department: user.department || dept?.id || '' });
  });
  return Array.from(merged.values());
}

const DEFAULT_MARKETING_PLATFORMS = [
  'سناب شات', 'تيك توك', 'انستجرام', 'فيس بوك', 'يوتيوب', 'جوجل', 'لينكد ان', 'حملات واتساب', 'TV'
];

function normalizePlatform(row, id) {
  const name = String(row?.name || row?.platformName || row?.title || row || '').trim();
  if (!name) return null;
  return {
    id: id || row?.id || name,
    key: row?.key || row?.slug || name.toLowerCase().replace(/\s+/g, '_'),
    name,
    active: row?.active !== false,
    source: row?.source || 'firebase'
  };
}

async function loadMarketingPlatforms() {
  const defaults = DEFAULT_MARKETING_PLATFORMS.map((name, index) => normalizePlatform({ name, key: 'platform_' + index, active: true, source: 'default' }, 'default_' + index));
  const collected = [];
  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('marketing_platforms').get();
      snap.forEach((doc) => {
        const item = normalizePlatform(doc.data() || {}, doc.id);
        if (item && item.active !== false) collected.push(item);
      });
    } catch (error) {
      console.warn('marketing_platforms load failed:', error);
    }
  }
  const source = collected.length ? collected : defaults;
  const map = new Map();
  source.filter(Boolean).forEach((platform) => map.set(String(platform.name).toLowerCase(), platform));
  return Array.from(map.values());
}

const DEFAULT_CAMPAIGN_TYPES = ['حملة بيعية', 'حملة تسويقية', 'حملة تفاعلية', 'حملة محتوى', 'أجندة'];

function normalizeCampaignType(row, id) {
  const name = String(row?.name || row?.title || row?.label || row || '').trim();
  if (!name) return null;
  return {
    id: id || row?.id || name,
    name,
    active: row?.active !== false
  };
}

async function loadCampaignTypes() {
  const collected = [];
  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('marketing_campaign_types').get();
      snap.forEach((doc) => {
        const item = normalizeCampaignType(doc.data() || {}, doc.id);
        if (item && item.active !== false) collected.push(item);
      });
    } catch (error) {
      console.warn('marketing_campaign_types load failed:', error);
    }
  }
  const source = collected.length ? collected : DEFAULT_CAMPAIGN_TYPES.map((name, index) => ({ id: 'default_' + index, name, active: true }));
  const map = new Map();
  source.filter(Boolean).forEach((item) => map.set(String(item.name).toLowerCase(), item));
  return Array.from(map.values());
}

function generateCampaignCode(taskType = 'campaign', agendaMonth = '', agendaYear = '') {
  if (taskType === 'agenda') {
    const now = new Date();
    const month = String(agendaMonth || (now.getMonth() + 1)).padStart(2, '0');
    const year = String(agendaYear || now.getFullYear());
    return `AG-${month}-${year}`;
  }
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CA-${y}${m}${d}-${rand}`;
}

function monthRangeDates(year, month) {
  const y = Number(year) || new Date().getFullYear();
  const m = Math.max(1, Math.min(12, Number(month) || (new Date().getMonth() + 1)));
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

function deptKindFromName(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('تصوير') || value.includes('photo') || value.includes('shoot')) return 'photography';
  if (value.includes('محتوى') || value.includes('content') || value.includes('نشر')) return value.includes('نشر') ? 'publish' : 'content';
  if (value.includes('تصميم') || value.includes('design')) return 'design';
  if (value.includes('مونتاج') || value.includes('فيديو') || value.includes('montage') || value.includes('video')) return 'montage';
  return 'generic';
}

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

function renderOptionPairs(pairs) {
  return '<option value="">اختار المطلوب</option>' + pairs.map(([title, desc]) => `<option value="${escapeHTML(title)}" data-desc="${escapeHTML(desc)}">${escapeHTML(title)} — ${escapeHTML(desc)}</option>`).join('');
}

function renderMultiChoicePairs(pairs, groupName, attrName) {
  return pairs.map(([title, desc], index) => `
    <label class="multi-choice-card">
      <input type="checkbox" ${attrName} value="${escapeHTML(title)}" data-desc="${escapeHTML(desc)}" data-title="${escapeHTML(title)}">
      <span class="multi-choice-title">${escapeHTML(title)}</span>
      <small>${escapeHTML(desc)}</small>
    </label>
  `).join('');
}

function attachmentLabelForKind(kind) {
  if (kind === 'photography') return 'إرفاق ملف التصوير';
  if (kind === 'content' || kind === 'publish') return 'إرفاق ملف اسكريبت';
  if (kind === 'design') return 'إرفاق ملف الصور';
  if (kind === 'montage') return 'إرفاق ملف الفيديو';
  return 'إرفاق ملف';
}

function buildSpecialDepartmentFields(kind) {
  if (kind === 'photography') {
    return `
      <div class="dept-special-fields" data-special-kind="photography">
        <div class="dept-special-head">
          <strong>المطلوب</strong>
          <button class="soft-btn" type="button" data-add-photo-item>+ إضافة مطلوب تصوير</button>
        </div>
        <div class="photo-items-list" data-photo-items-list>
          <article class="photo-item-row" data-photo-item>
            <label class="mzj-field"><span>نوع السيارة</span><input type="text" data-photo-car-type placeholder="مثال: هيونداي / النترا"></label>
            <label class="mzj-field"><span>نوع المحتوى</span><select data-photo-content-type>${PHOTOGRAPHY_CONTENT_TYPES.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('')}</select></label>
          </article>
        </div>
        <label class="mzj-field full-width-field"><span>ملاحظات / تفاصيل التصوير</span><textarea data-required-text rows="3" placeholder="اكتب تفاصيل التصوير من التاسك"></textarea></label>
      </div>`;
  }
  if (kind === 'design') {
    return `
      <div class="dept-special-fields" data-special-kind="design">
        <div class="dept-special-head">
          <strong>المطلوب</strong>
          <span class="department-hint-inline">اختار مطلوب واحد أو أكتر من التصميم</span>
        </div>
        <div class="multi-choice-grid" data-design-choices>
          ${renderMultiChoicePairs(DESIGN_DELIVERABLES, 'design', 'data-design-deliverable')}
        </div>
        <label class="mzj-field full-width-field"><span>ملاحظات إضافية</span><textarea data-required-text rows="3" placeholder="اكتب أي تفاصيل إضافية للتصميم"></textarea></label>
      </div>`;
  }
  if (kind === 'montage') {
    return `
      <div class="dept-special-fields" data-special-kind="montage">
        <div class="dept-special-head">
          <strong>المطلوب</strong>
          <span class="department-hint-inline">اختار مطلوب واحد أو أكتر من المونتاج</span>
        </div>
        <div class="multi-choice-grid" data-montage-choices>
          ${renderMultiChoicePairs(MONTAGE_DELIVERABLES, 'montage', 'data-montage-deliverable')}
        </div>
        <label class="mzj-field full-width-field"><span>ملاحظات إضافية</span><textarea data-required-text rows="3" placeholder="اكتب أي تفاصيل إضافية للمونتاج"></textarea></label>
      </div>`;
  }
  return `
    <label class="mzj-field full-width-field dept-special-fields" data-special-kind="${escapeHTML(kind)}">
      <span>المطلوب</span>
      <textarea data-required-text rows="3" placeholder="اكتب شرح المطلوب من القسم"></textarea>
    </label>`;
}

function initCreateTaskFromTemplate() {
  const openBtn = document.getElementById('createTaskOpen');
  const openBtnMini = document.getElementById('createTaskOpenMini');
  const modal = document.getElementById('createTaskModal');
  const form = document.getElementById('createTaskForm');
  const typeSelect = document.getElementById('createTaskType');
  const templateSelect = document.getElementById('createTaskTemplate');
  const templateWrap = document.getElementById('templateSelectWrap');
  const preview = document.getElementById('createTaskTemplatePreview');
  const templateFieldsForm = document.getElementById('templateFieldsForm');
  const templateFieldsInputGrid = document.getElementById('templateFieldsInputGrid');
  const departmentsList = document.getElementById('departmentTaskList');
  const addDepartmentBtn = null;
  const note = document.getElementById('createTaskFormNote');
  const campaignCodeInput = document.getElementById('campaignCode');
  const campaignNameInput = document.getElementById('campaignName');
  const generateCampaignCodeBtn = document.getElementById('generateCampaignCodeBtn');
  const campaignTypeSelect = document.getElementById('campaignTypeName');
  const newCampaignTypeInput = document.getElementById('newCampaignTypeName');
  const addCampaignTypeBtn = document.getElementById('addCampaignTypeBtn');
  const campaignTypeAddRow = document.querySelector('.campaign-type-add-row');
  const agendaMonthYearWrap = document.getElementById('agendaMonthYearWrap');
  const agendaMonthSelect = document.getElementById('agendaMonth');
  const agendaYearSelect = document.getElementById('agendaYear');
  const campaignStartDateInput = document.getElementById('campaignStartDate');
  const campaignEndDateInput = document.getElementById('campaignEndDate');
  const campaignGoalInput = document.getElementById('campaignGoal');
  const campaignStartDateLabel = document.getElementById('campaignStartDateLabel');
  const campaignEndDateLabel = document.getElementById('campaignEndDateLabel');
  const budgetItemsList = document.getElementById('budgetItemsList');
  const addBudgetItemBtn = document.getElementById('addBudgetItem');
  const budgetGrandTotalValue = document.getElementById('budgetGrandTotalValue');
  const publishScheduleRows = document.getElementById('publishScheduleRows');
  const addPublishScheduleRowBtn = document.getElementById('addPublishScheduleRow');
  const uploadFilledTemplateBtn = document.getElementById('uploadFilledTemplateBtn');
  const filledTemplateFileInput = document.getElementById('filledTemplateFile');
  const importedCampaignLogicSection = document.getElementById('importedCampaignLogicSection');
  const importedCampaignLogicBox = document.getElementById('importedCampaignLogicBox');

  if (!modal || !form || !typeSelect || !templateSelect || !departmentsList) return;

  let departmentsCache = [];
  let usersCache = [];
  let departmentIndex = 0;
  let platformsCache = [];
  let campaignTypesCache = [];
  let importedTemplateContext = {
    loaded: false,
    fileName: '',
    sheetName: '',
    campaignLogic: [],
    writingRules: [],
    contentExecutionTasks: []
  };

  function renderCampaignTypesOptions() {
    if (!campaignTypeSelect) return;
    const current = campaignTypeSelect.value;
    campaignTypeSelect.innerHTML = '<option value="">اختار نوع الحملة</option>' + campaignTypesCache.map((type) => `<option value="${escapeHTML(type.name)}">${escapeHTML(type.name)}</option>`).join('');
    if (!Array.from(campaignTypeSelect.options).some((opt) => opt.value === 'أجندة')) {
      campaignTypeSelect.insertAdjacentHTML('beforeend', '<option value="أجندة">أجندة</option>');
    }
    if (current) campaignTypeSelect.value = current;
  }

  async function refreshCampaignTypes() {
    campaignTypesCache = await loadCampaignTypes();
    renderCampaignTypesOptions();
  }

  function fillAgendaYears() {
    if (!agendaYearSelect || agendaYearSelect.options.length) return;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 1; y <= currentYear + 3; y += 1) years.push(y);
    agendaYearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
    agendaYearSelect.value = String(currentYear);
  }

  function getAgendaName(month, year) {
    const monthOption = agendaMonthSelect?.querySelector(`option[value="${month}"]`);
    const monthName = (monthOption?.textContent || month || '').trim();
    return `${monthName} ${year}`.trim();
  }

  function applyAgendaDefaults(forceDates = true) {
    if (typeSelect?.value !== 'agenda') return;
    fillAgendaYears();
    const now = new Date();
    if (agendaMonthSelect && !agendaMonthSelect.value) agendaMonthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
    if (agendaYearSelect && !agendaYearSelect.value) agendaYearSelect.value = String(now.getFullYear());
    const month = agendaMonthSelect?.value || String(now.getMonth() + 1).padStart(2, '0');
    const year = agendaYearSelect?.value || String(now.getFullYear());
    const range = monthRangeDates(year, month);
    if (campaignCodeInput) campaignCodeInput.value = generateCampaignCode('agenda', month, year);
    if (campaignNameInput) campaignNameInput.value = getAgendaName(month, year);
    if (campaignTypeSelect) campaignTypeSelect.value = 'أجندة';
    if (campaignGoalInput) campaignGoalInput.value = 'تفاعلي';
    if (forceDates) {
      if (campaignStartDateInput) campaignStartDateInput.value = range.start;
      if (campaignEndDateInput) campaignEndDateInput.value = range.end;
    }
  }

  function applyDateLabels() {
    const isAgenda = typeSelect?.value === 'agenda';
    if (campaignStartDateLabel) campaignStartDateLabel.textContent = isAgenda ? 'تاريخ بداية الأجندة' : 'تاريخ بداية الحملة';
    if (campaignEndDateLabel) campaignEndDateLabel.textContent = isAgenda ? 'تاريخ نهاية الأجندة' : 'تاريخ نهاية الحملة';
    if (agendaMonthYearWrap) agendaMonthYearWrap.hidden = !isAgenda;
    if (campaignTypeAddRow) {
      campaignTypeAddRow.hidden = isAgenda;
      campaignTypeAddRow.classList.toggle('is-hidden', isAgenda);
    }
    if (newCampaignTypeInput) newCampaignTypeInput.closest('.mzj-field')?.classList.toggle('is-hidden', isAgenda);
    if (addCampaignTypeBtn) addCampaignTypeBtn.classList.toggle('is-hidden', isAgenda);
    if (campaignTypeSelect) campaignTypeSelect.disabled = isAgenda;
    if (campaignNameInput) campaignNameInput.readOnly = isAgenda;
    if (isAgenda) applyAgendaDefaults(true);
  }

  function ensureGeneratedCode(force = false) {
    if (!campaignCodeInput) return;
    if (typeSelect?.value === 'agenda') {
      if (force || !campaignCodeInput.value) applyAgendaDefaults(false);
      return;
    }
    if (force || !campaignCodeInput.value || String(campaignCodeInput.value).startsWith('AG-')) campaignCodeInput.value = generateCampaignCode(typeSelect?.value || 'campaign');
  }

  async function ensureDepartments() {
    departmentsCache = await loadDepartmentsFromContentTasks();
    usersCache = await loadUsersFromSystemPath();
    platformsCache = await loadMarketingPlatforms();
    await refreshCampaignTypes();
    try { await loadTaskTemplatesFromFirebase(); } catch (error) { if (note) note.textContent = '⚠️ فشل قراءة قوالب Firebase: ' + (error?.message || error?.code || error); }
    applyDateLabels();
    ensureGeneratedCode();
    // نرسم الأقسام في كل فتح للنافذة علشان أي تعديل في صفحة الأقسام يظهر فورًا
    // سواء نوع الإنشاء حملة أو أجندة. كل قسم له قائمة يوزرات مستقلة من departments.
    renderAllDepartments();
    if (budgetItemsList && !budgetItemsList.children.length) createBudgetItem();
    updateBudgetTotal();
  }

  function fillTemplateOptions() {
    const taskType = typeSelect.value;
    const showTemplates = taskType === 'campaign';
    if (templateWrap) templateWrap.hidden = !showTemplates;

    templateSelect.value = '';

    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    renderTemplateFieldInputs(null);

    if (!showTemplates) {
      templateSelect.innerHTML = '<option value="">اختار قالب حملة محفوظ</option>';
      return;
    }

    const matching = loadTaskTemplates().filter((template) => templateMatchesType(template, 'campaign'));
    templateSelect.innerHTML = '<option value="">اختار قالب حملة محفوظ</option>' + matching.map((template) => `<option value="${escapeHTML(template.id)}">${escapeHTML(template.name)}</option>`).join('');
  }

  function getSelectedTemplate() {
    return loadTaskTemplates().find((template) => template.id === templateSelect.value);
  }

  function renderTemplateFieldInputs(template) {
    // القالب هنا يستخدم فقط كاختيار لنوع/شكل الحملة.
    // لا نعرض شكل الشيت ولا نطلب ملء خاناته داخل إنشاء الحملة؛ اليوزرات هترفع شغلها لاحقًا حسب المطلوب.
    if (templateFieldsForm) templateFieldsForm.hidden = true;
    if (templateFieldsInputGrid) templateFieldsInputGrid.innerHTML = '';
  }

  function collectTemplateValues() {
    return { rows: [], flat: [] };
  }

  function createDepartmentAssignmentHTML(dept, index = 1) {
    const kind = deptKindFromName(dept.name);
    return `
      <article class="department-assignment-row" data-department-assignment-row data-assignment-index="${escapeHTML(index)}">
        <div class="department-assignment-head">
          <strong>\u062a\u0643\u0644\u064a\u0641 ${escapeHTML(index)}</strong>
          <button class="soft-danger-btn" type="button" data-remove-department-assignment>\u0645\u0633\u062d \u0627\u0644\u062a\u0643\u0644\u064a\u0641</button>
        </div>
        <div class="department-task-grid department-task-core-grid">
          <label class="mzj-field">
            <span>\u0627\u0644\u064a\u0648\u0632\u0631 / \u0627\u0644\u0645\u0633\u0624\u0648\u0644</span>
            <select data-user-select>${renderUserOptions(usersForDepartment(dept, usersCache), '', false)}</select>
          </label>

          <label class="mzj-field">
            <span>\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u0637\u0644\u0648\u0628</span>
            <input type="date" data-required-date>
          </label>

          <label class="mzj-field">
            <span>${kind === 'publish' ? '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0646\u0634\u0631' : '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u0644\u064a\u0645'}</span>
            <input type="date" data-delivery-date>
          </label>
        </div>

        ${buildSpecialDepartmentFields(kind)}
      </article>
    `;
  }

  function refreshDepartmentAssignmentNumbers(deptRow) {
    if (!deptRow) return;
    Array.from(deptRow.querySelectorAll('[data-department-assignment-row]')).forEach((assignment, index) => {
      assignment.dataset.assignmentIndex = String(index + 1);
      const title = assignment.querySelector('.department-assignment-head strong');
      if (title) title.textContent = '\u062a\u0643\u0644\u064a\u0641 ' + (index + 1);
    });
  }

  function addDepartmentAssignmentRow(deptRow) {
    if (!deptRow) return null;
    const departmentId = deptRow.dataset.departmentId || '';
    const dept = departmentsCache.find((item) => String(item.id) === String(departmentId));
    if (!dept) return null;
    const list = deptRow.querySelector('[data-department-assignments-list]');
    if (!list) return null;
    const nextIndex = list.querySelectorAll('[data-department-assignment-row]').length + 1;
    list.insertAdjacentHTML('beforeend', createDepartmentAssignmentHTML(dept, nextIndex));
    refreshDepartmentAssignmentNumbers(deptRow);
    return list.querySelector('[data-department-assignment-row]:last-child');
  }

  function getFirstDepartmentAssignment(row) {
    return row?.matches?.('[data-department-assignment-row]') ? row : row?.querySelector?.('[data-department-assignment-row]');
  }

  function createDepartmentRow(dept) {
    const row = document.createElement('article');
    const kind = deptKindFromName(dept.name);
    row.className = 'department-task-row department-task-row-selectable department-accordion-row';
    row.dataset.departmentId = dept.id;
    row.dataset.departmentKind = kind;
    row.innerHTML = `
      <div class="department-row-head">
        <input type="checkbox" data-department-enabled hidden>
        <button class="department-toggle-btn" type="button" data-department-toggle>
          <strong>${escapeHTML(dept.name)}</strong>
          <small>\u0627\u0641\u062a\u062d \u0627\u0644\u0642\u0633\u0645 \u0648\u0636\u064a\u0641 \u0623\u0643\u062b\u0631 \u0645\u0646 \u064a\u0648\u0632\u0631\u060c \u0648\u0644\u0643\u0644 \u064a\u0648\u0632\u0631 \u0645\u0637\u0644\u0648\u0628 \u0645\u062e\u062a\u0644\u0641</small>
        </button>
        <span class="department-source-label">departments</span>
      </div>

      <div class="department-task-body" data-department-body>
        <div class="department-assignments-head">
          <strong>\u062a\u0643\u0644\u064a\u0641\u0627\u062a ${escapeHTML(dept.name)}</strong>
          <button class="soft-btn" type="button" data-add-department-assignment>+ \u0625\u0636\u0627\u0641\u0629 \u064a\u0648\u0632\u0631 / \u0645\u0637\u0644\u0648\u0628</button>
        </div>
        <div class="department-assignments-list" data-department-assignments-list>
          ${createDepartmentAssignmentHTML(dept, 1)}
        </div>
        <p class="admin-only-note department-receive-note">\u062a\u0623\u0643\u064a\u062f \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u062a\u0627\u0633\u0643 \u0648\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641 \u064a\u062a\u0645 \u0645\u0646 \u0643\u0627\u0631\u062a \u0627\u0644\u064a\u0648\u0632\u0631 \u0641\u064a \u0627\u0644\u062f\u0627\u0634 \u0628\u0648\u0631\u062f.</p>
      </div>
    `;
    departmentsList.appendChild(row);
  }

  function renderAllDepartments() {
    departmentsList.innerHTML = '';
    departmentsCache.forEach((dept) => createDepartmentRow(dept));
  }

  function createBudgetPlatformRows(itemIndex) {
    if (!platformsCache.length) {
      return '<p class="template-empty">لا توجد منصات. أضفها من صفحة منصات الميزانية.</p>';
    }
    return platformsCache.map((platform) => `
      <article class="platform-budget-row budget-item-platform-row" data-platform-budget-row data-platform-id="${escapeHTML(platform.id)}" data-platform-name="${escapeHTML(platform.name)}">
        <label class="platform-budget-check">
          <input type="checkbox" data-platform-check>
          <strong>${escapeHTML(platform.name)}</strong>
        </label>
        <input type="number" min="0" step="1" data-platform-amount placeholder="ميزانية ${escapeHTML(platform.name)} لهذا الإعلان">
      </article>
    `).join('');
  }

  function createBudgetItem(data = {}) {
    if (!budgetItemsList) return;
    const itemIndex = budgetItemsList.querySelectorAll('[data-budget-item]').length + 1;
    const item = document.createElement('article');
    item.className = 'budget-item-accordion is-open';
    item.dataset.budgetItem = String(itemIndex);
    item.innerHTML = `
      <div class="budget-item-head">
        <button class="budget-item-toggle" type="button" data-budget-toggle>
          <strong>إعلان / ميزانية ${itemIndex}</strong>
          <small data-budget-item-summary>اضغط للفتح والإغلاق</small>
        </button>
        <button class="soft-danger-btn" type="button" data-remove-budget-item>مسح</button>
      </div>

      <div class="budget-item-body" data-budget-body>
        <div class="create-task-grid budget-fields-grid">
          <label class="mzj-field"><span>نوع الإعلان</span><input type="text" data-budget-ad-type placeholder="مثال: بيعي / كاش / توعوي" value="${escapeHTML(data.adType || '')}"></label>
          <label class="mzj-field"><span>اسم الإعلان</span><input type="text" data-budget-ad-name placeholder="مثال: سيارة هيونداي / النترا" value="${escapeHTML(data.adName || '')}"></label>
          <label class="mzj-field"><span>تاريخ النشر</span><input type="date" data-budget-publish-date value="${escapeHTML(data.publishDate || '')}"></label>
          <label class="mzj-field"><span>مدة الإعلان</span><input type="text" data-budget-duration placeholder="مثال: 7 أيام" value="${escapeHTML(data.duration || '')}"></label>
          <label class="mzj-field"><span>عدد الإعلانات</span><input type="number" min="0" data-budget-ads-count placeholder="0" value="${escapeHTML(data.adsCount || '')}"></label>
          <label class="mzj-field"><span>هدف المحتوى</span><input type="text" data-budget-content-goal placeholder="اكتب هدف المحتوى" value="${escapeHTML(data.contentGoal || '')}"></label>
          <label class="mzj-field"><span>الهدف المتوقع</span><input type="text" data-budget-expected-goal placeholder="اكتب الهدف المتوقع" value="${escapeHTML(data.expectedGoal || '')}"></label>
        </div>

        <div class="platform-budget-area budget-item-platforms-area">
          <div class="platform-budget-head">
            <strong>ميزانية المنصات لهذا الإعلان</strong>
            <small>اختار المنصات المطلوبة واكتب ميزانية كل منصة للإعلان الحالي فقط.</small>
          </div>
          <div class="budget-platforms-list compact-budget-platforms" data-budget-platforms-list>
            ${createBudgetPlatformRows(itemIndex)}
          </div>
          <div class="budget-total-box budget-item-total-box">
            <span>إجمالي هذا الإعلان</span>
            <strong data-budget-item-total>0</strong>
          </div>
        </div>
      </div>
    `;
    budgetItemsList.appendChild(item);
    updateBudgetTotal();
  }

  function collectBudgetItem(item) {
    const platforms = Array.from(item.querySelectorAll('[data-platform-budget-row]')).map((row) => {
      const checked = row.querySelector('[data-platform-check]')?.checked;
      const amount = Number(row.querySelector('[data-platform-amount]')?.value || 0);
      return {
        id: row.dataset.platformId || '',
        name: row.dataset.platformName || '',
        amount,
        selected: Boolean(checked)
      };
    }).filter((platform) => platform.selected || platform.amount > 0);
    const itemTotal = platforms.reduce((sum, platform) => sum + Number(platform.amount || 0), 0);
    return {
      adType: item.querySelector('[data-budget-ad-type]')?.value.trim() || '',
      adName: item.querySelector('[data-budget-ad-name]')?.value.trim() || '',
      publishDate: item.querySelector('[data-budget-publish-date]')?.value || '',
      duration: item.querySelector('[data-budget-duration]')?.value.trim() || '',
      adsCount: item.querySelector('[data-budget-ads-count]')?.value || '',
      contentGoal: item.querySelector('[data-budget-content-goal]')?.value.trim() || '',
      expectedGoal: item.querySelector('[data-budget-expected-goal]')?.value.trim() || '',
      platforms,
      itemTotal
    };
  }

  function updateBudgetTotal() {
    if (!budgetItemsList || !budgetGrandTotalValue) return;
    let grandTotal = 0;
    Array.from(budgetItemsList.querySelectorAll('[data-budget-item]')).forEach((item, index) => {
      const details = collectBudgetItem(item);
      grandTotal += details.itemTotal;
      const totalEl = item.querySelector('[data-budget-item-total]');
      if (totalEl) totalEl.textContent = details.itemTotal.toLocaleString('ar-EG');
      const summary = item.querySelector('[data-budget-item-summary]');
      if (summary) summary.textContent = `${details.adName || 'إعلان بدون اسم'} — الإجمالي ${details.itemTotal.toLocaleString('ar-EG')}`;
      const title = item.querySelector('.budget-item-toggle strong');
      if (title) title.textContent = `إعلان / ميزانية ${index + 1}`;
    });
    budgetGrandTotalValue.textContent = grandTotal.toLocaleString('ar-EG');
  }

  function createPublishScheduleRow(data = {}) {
    if (!publishScheduleRows) return;
    const row = document.createElement('article');
    row.className = 'publish-schedule-row';
    row.innerHTML = `
      <label class="mzj-field"><span>اليوم</span>
        <select data-schedule-day>
          <option value="">اختار اليوم</option>
          ${['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(day => `<option value="${day}" ${data.day === day ? 'selected' : ''}>${day}</option>`).join('')}
        </select>
      </label>
      <label class="mzj-field"><span>التاريخ</span><input type="date" data-schedule-date value="${escapeHTML(data.date || '')}"></label>
      <label class="mzj-field schedule-content-field"><span>ماذا سيتم نشره؟</span><input type="text" data-schedule-content placeholder="اكتب المحتوى أو النشاط" value="${escapeHTML(data.content || '')}"></label>
      <button class="soft-danger-btn schedule-remove-btn" type="button" data-remove-schedule-row>مسح</button>
    `;
    publishScheduleRows.appendChild(row);
  }

  function collectPublishScheduleDetails() {
    if (!publishScheduleRows) return [];
    return Array.from(publishScheduleRows.querySelectorAll('.publish-schedule-row')).map((row) => ({
      day: row.querySelector('[data-schedule-day]')?.value || '',
      date: row.querySelector('[data-schedule-date]')?.value || '',
      content: row.querySelector('[data-schedule-content]')?.value.trim() || ''
    })).filter((item) => item.day || item.date || item.content);
  }


  function templateCellText(value) {
    if (value == null) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return String(value).replace(/\s+/g, ' ').trim();
  }


  function normalizedWorkbookSheetName(name) {
    return templateCellText(name)
      .toLowerCase()
      .replace(/[\s_\-]+/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ىي]/g, 'ي')
      .replace(/ة/g, 'ه');
  }

  function pickCampaignContentSheetName(workbook) {
    const names = workbook?.SheetNames || [];
    if (!names.length) return '';
    const wanted = [
      'محتوي الحمله',
      'محتوى الحملة',
      'محتوي الحملة',
      'محتوى الحمله',
      'campaign content',
      'campaign_content'
    ].map(normalizedWorkbookSheetName);
    const exact = names.find((name) => wanted.includes(normalizedWorkbookSheetName(name)));
    if (exact) return exact;
    const loose = names.find((name) => {
      const key = normalizedWorkbookSheetName(name);
      return (key.includes('محتوي') || key.includes('محتوى')) && (key.includes('الحمله') || key.includes('الحملة'));
    });
    if (loose) return loose;
    return names[0];
  }

  function normalizeImportedDate(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const text = templateCellText(value);
    if (!text) return '';
    const iso = text.match(/(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const slash = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/);
    if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
    return '';
  }

  function findImportedValue(rows, labels) {
    const wanted = labels.map((label) => String(label).trim());
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c += 1) {
        const cell = templateCellText(row[c]);
        if (!cell) continue;
        const hit = wanted.some((label) => cell === label || cell.includes(label));
        if (!hit) continue;
        const candidates = [row[c - 1], row[c + 1], rows[r + 1]?.[c], rows[r - 1]?.[c]];
        const found = candidates.find((value) => templateCellText(value));
        if (found != null) return found;
      }
    }
    return '';
  }

  function setSelectValueByText(select, rawValue, allowCreate = false) {
    if (!select) return;
    const value = templateCellText(rawValue);
    if (!value) return;
    const normalized = value.toLowerCase();
    const match = Array.from(select.options).find((option) => {
      const text = templateCellText(option.textContent).toLowerCase();
      const val = templateCellText(option.value).toLowerCase();
      return text === normalized || val === normalized || text.includes(normalized) || normalized.includes(text);
    });
    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (allowCreate) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setDepartmentUser(row, rawUser) {
    const select = row?.querySelector('[data-user-select]');
    if (!select) return;
    const value = templateCellText(rawUser);
    if (!value) return;
    const normalized = value.toLowerCase();
    const option = Array.from(select.options).find((opt) => {
      const text = templateCellText(opt.textContent).toLowerCase();
      const email = templateCellText(opt.dataset.userEmail || '').toLowerCase();
      const name = templateCellText(opt.dataset.userName || '').toLowerCase();
      return text.includes(normalized) || normalized.includes(text) || email === normalized || name.includes(normalized) || normalized.includes(name);
    });
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function openAndEnableDepartmentRow(row) {
    if (!row) return;
    const checkbox = row.querySelector('[data-department-enabled]');
    if (checkbox) checkbox.checked = true;
    row.classList.add('is-open', 'is-selected');
  }

  function findDepartmentRowByKind(kind) {
    return Array.from(departmentsList.querySelectorAll('.department-task-row')).find((row) => row.dataset.departmentKind === kind);
  }

  function extractDatesFromRow(row) {
    return (row || []).map(normalizeImportedDate).filter(Boolean);
  }

  function extractFirstUserLikeValue(row) {
    return (row || []).map(templateCellText).find((cell) => {
      if (!cell) return false;
      if (/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(cell) || /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(cell)) return false;
      if (cell.includes('قسم') || cell.includes('تاريخ') || cell.includes('إرفاق') || cell === '√') return false;
      return true;
    }) || '';
  }

  function fillDepartmentFromImportedRow(kind, sourceRow) {
    const row = findDepartmentRowByKind(kind);
    if (!row || !sourceRow) return;
    openAndEnableDepartmentRow(row);
    const user = extractFirstUserLikeValue(sourceRow.filter((cell) => !templateCellText(cell).includes('قسم')));
    const assignmentRow = getFirstDepartmentAssignment(row) || row;
    setDepartmentUser(assignmentRow, user);
    const dates = extractDatesFromRow(sourceRow);
    const requiredDate = dates[1] || dates[0] || '';
    const deliveryDate = dates[2] || dates[1] || '';
    const requiredInput = assignmentRow.querySelector('[data-required-date]');
    const deliveryInput = assignmentRow.querySelector('[data-delivery-date]');
    if (requiredInput && requiredDate) requiredInput.value = requiredDate;
    if (deliveryInput && deliveryDate) deliveryInput.value = deliveryDate;
  }

  function fillPhotographyItemsFromText(text) {
    const row = findDepartmentRowByKind('photography');
    if (!row) return;
    const lines = String(text || '').split(/\n|\||،|,/).map((line) => line.trim()).filter(Boolean);
    const matched = lines.filter((line) => PHOTOGRAPHY_CONTENT_TYPES.some((type) => line.includes(type)));
    if (!matched.length) return;
    openAndEnableDepartmentRow(row);
    const assignmentRow = getFirstDepartmentAssignment(row) || row;
    const list = assignmentRow.querySelector('[data-photo-items-list]');
    if (!list) return;
    list.innerHTML = '';
    matched.forEach((line) => {
      const item = document.createElement('article');
      item.className = 'photo-item-row';
      item.dataset.photoItem = 'true';
      const foundType = PHOTOGRAPHY_CONTENT_TYPES.find((type) => line.includes(type)) || PHOTOGRAPHY_CONTENT_TYPES[0];
      const carType = line.replace(foundType, '').replace(/نوع السيارة|نوع المحتوى|[:：\-]/g, '').trim();
      item.innerHTML = `
        <label class="mzj-field"><span>نوع السيارة</span><input type="text" data-photo-car-type placeholder="مثال: هيونداي / النترا" value="${escapeHTML(carType)}"></label>
        <label class="mzj-field"><span>نوع المحتوى</span><select data-photo-content-type>${PHOTOGRAPHY_CONTENT_TYPES.map(t => `<option value="${escapeHTML(t)}" ${t === foundType ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}</select></label>
        <button class="soft-danger-btn" type="button" data-remove-photo-item>مسح</button>
      `;
      list.appendChild(item);
    });
  }

  function fillTextDepartment(kind, rawText) {
    const row = findDepartmentRowByKind(kind);
    if (!row) return;
    const text = templateCellText(rawText);
    if (!text) return;
    openAndEnableDepartmentRow(row);
    const assignmentRow = getFirstDepartmentAssignment(row) || row;
    const textarea = assignmentRow.querySelector('[data-required-text]');
    if (textarea) textarea.value = text;
  }

  function selectDeliverablesByText(kind, rawText) {
    const row = findDepartmentRowByKind(kind);
    if (!row) return;
    const text = templateCellText(rawText);
    if (!text) return;
    openAndEnableDepartmentRow(row);
    const attr = kind === 'design' ? '[data-design-deliverable]' : '[data-montage-deliverable]';
    const assignmentRow = getFirstDepartmentAssignment(row) || row;
    assignmentRow.querySelectorAll(attr).forEach((input) => {
      const title = templateCellText(input.dataset.title || input.value);
      const desc = templateCellText(input.dataset.desc || '');
      const checked = title && (text.includes(title) || title.includes(text) || (desc && text.includes(desc)));
      if (checked) {
        input.checked = true;
        input.closest('.multi-choice-card')?.classList.add('is-checked');
      }
    });
    const textarea = assignmentRow.querySelector('[data-required-text]');
    if (textarea && !textarea.value) textarea.value = text;
  }


  // Excel upload: Simple dashboard template parser.
  // Expected columns: القسم | اليوزر بالاسم | التاريخ المطلوب | تاريخ التسليم | المطلوب كتابة | اختيار 1 | اختيار 2 | اختيار 3 | نوع السيارة | نوع محتوى التصوير
  function importHeaderKey(value) {
    return templateCellText(value).replace(/[\sـ_\-\/\\]+/g, '').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
  }

  function findImportColumn(headers, variants) {
    const wanted = variants.map(importHeaderKey);
    return headers.findIndex((header) => {
      const key = importHeaderKey(header);
      return wanted.some((variant) => key === variant || key.includes(variant) || variant.includes(key));
    });
  }

  function findSimpleAssignmentsHeader(rows) {
    return rows.findIndex((row) => {
      const joined = (row || []).map(importHeaderKey).join('|');
      return joined.includes('القسم') && (joined.includes('اليوزر') || joined.includes('المسؤول') || joined.includes('المسئول'));
    });
  }

  function addOrGetDepartmentAssignment(deptRow, index) {
    const list = deptRow?.querySelector('[data-department-assignments-list]');
    if (!list) return null;
    while (list.querySelectorAll('[data-department-assignment-row]').length <= index) addDepartmentAssignmentRow(deptRow);
    refreshDepartmentAssignmentNumbers(deptRow);
    return list.querySelectorAll('[data-department-assignment-row]')[index] || null;
  }

  function clearAssignmentRequirement(assignmentRow) {
    if (!assignmentRow) return;
    assignmentRow.querySelectorAll('[data-design-deliverable], [data-montage-deliverable]').forEach((input) => {
      input.checked = false;
      input.closest('.multi-choice-card')?.classList.remove('is-checked');
    });
    assignmentRow.querySelectorAll('[data-required-text]').forEach((textarea) => { textarea.value = ''; });
    const photoList = assignmentRow.querySelector('[data-photo-items-list]');
    if (photoList) photoList.innerHTML = '';
  }

  function selectDeliverablesInsideAssignment(kind, assignmentRow, rawText) {
    const text = templateCellText(rawText);
    if (!text || !assignmentRow) return;
    const attr = kind === 'design' ? '[data-design-deliverable]' : '[data-montage-deliverable]';
    assignmentRow.querySelectorAll(attr).forEach((input) => {
      const title = templateCellText(input.dataset.title || input.value);
      const desc = templateCellText(input.dataset.desc || '');
      const checked = title && (text.includes(title) || title.includes(text) || (desc && text.includes(desc)));
      if (checked) {
        input.checked = true;
        input.closest('.multi-choice-card')?.classList.add('is-checked');
      }
    });
  }

  function fillPhotoInsideAssignment(assignmentRow, carType, contentType, freeText) {
    if (!assignmentRow) return;
    const list = assignmentRow.querySelector('[data-photo-items-list]');
    if (!list) return;
    list.innerHTML = '';
    const source = templateCellText(contentType || freeText);
    const chosenType = PHOTOGRAPHY_CONTENT_TYPES.find((type) => source.includes(type)) || '';
    const car = templateCellText(carType || freeText).replace(chosenType, '').trim();
    const item = document.createElement('article');
    item.className = 'photo-item-row';
    item.dataset.photoItem = 'true';
    item.innerHTML = `
      <label class="mzj-field"><span>نوع السيارة / شرح المطلوب</span><input type="text" data-photo-car-type placeholder="مثال: هيونداي / النترا" value="${escapeHTML(car)}"></label>
      <label class="mzj-field"><span>نوع المحتوى</span><select data-photo-content-type><option value="">اختار نوع المحتوى</option>${PHOTOGRAPHY_CONTENT_TYPES.map(t => `<option value="${escapeHTML(t)}" ${t === chosenType ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}</select></label>
      <button class="soft-danger-btn" type="button" data-remove-photo-item>مسح</button>
    `;
    list.appendChild(item);
  }



  // Campaign strategy sheet parser: reads rows under
  // "Content Execution Direction - آلية تنفيذ المحتوى" and converts every content row
  // into linked department assignments. Users stay empty so the marketing manager can
  // choose the responsible user from each department after upload.
  function normalizedSheetHeader(value) {
    return importHeaderKey(value).replace(/[^\u0600-\u06ffa-z0-9]/g, '');
  }

  function findHeaderColumnLoose(headers, variants) {
    const wanted = variants.map(normalizedSheetHeader).filter(Boolean);
    return headers.findIndex((header) => {
      const key = normalizedSheetHeader(header);
      return key && wanted.some((variant) => key === variant || key.includes(variant) || variant.includes(key));
    });
  }

  function findContentExecutionHeader(rows) {
    const sectionIndex = rows.findIndex((row) => row.some((cell) => {
      const text = templateCellText(cell).toLowerCase();
      return text.includes('content execution direction') || text.includes('آلية تنفيذ المحتوى') || text.includes('الية تنفيذ المحتوى');
    }));
    const start = sectionIndex >= 0 ? sectionIndex + 1 : 0;
    for (let r = start; r < Math.min(rows.length, start + 12); r += 1) {
      const row = rows[r] || [];
      const joined = row.map(normalizedSheetHeader).join('|');
      if ((joined.includes('نوعالمحتوى') || joined.includes('نوعالمحتوي')) && joined.includes('رقمالتاسك')) return r;
    }
    return -1;
  }

  function compactTaskText(parts) {
    return parts.map(templateCellText).filter(Boolean).join('\n');
  }

  function contentTypeRules(rawType, rowData) {
    const type = templateCellText(rawType).toLowerCase();
    const desc = templateCellText(rowData.description).toLowerCase();
    const text = `${type} ${desc}`;
    const rules = {
      design: [],
      montage: [],
      photoType: '',
      photoText: ''
    };

    if (type.includes('carousel') || type.includes('كاروسيل')) rules.design.push('كاروسيل');
    if (type.includes('static') || type.includes('post') || type.includes('بوست')) rules.design.push('بوست سوشيال ميديا');
    if (type.includes('story') || type.includes('ستوري')) rules.design.push('ستوري');
    if (type.includes('banner') || type.includes('بنر')) rules.design.push('بنر إعلاني');
    if (type.includes('thumbnail') || type.includes('ثامبنيل')) rules.design.push('ثامبنيل');
    if (type.includes('reel') || type.includes('film') || type.includes('video') || type.includes('youtube')) {
      rules.design.push('ثامبنيل', 'نسخة نشر نهائية');
    }

    if (type.includes('showroom')) rules.montage.push('مونتاج ريل معرض');
    else if (type.includes('youtube')) rules.montage.push('مونتاج YouTube');
    else if (type.includes('film')) rules.montage.push('مونتاج YouTube');
    else if (type.includes('story')) rules.montage.push('فيديو ستوري');
    else if (type.includes('ad') || type.includes('إعلان') || type.includes('اعلان')) rules.montage.push('مونتاج إعلان ممول');
    else if (type.includes('ai')) rules.montage.push('مونتاج بمشاهد AI');
    else if (type.includes('spec') || type.includes('مواصفات')) rules.montage.push('مونتاج ريل مواصفات');
    else if (type.includes('reel')) rules.montage.push('مونتاج أجندة عادي');

    if (type.includes('static') || type.includes('post') || type.includes('carousel') || type.includes('كاروسيل')) rules.photoType = 'صور الموقع';
    if (type.includes('film') || type.includes('youtube') || type.includes('video')) rules.photoType = 'فيديو HD';
    if (type.includes('showroom') || desc.includes('صالة') || desc.includes('المكان')) rules.photoType = 'فيديو الصالة';
    if (type.includes('reel') && !rules.photoType) rules.photoType = 'ريل';

    rules.photoText = compactTaskText([
      rowData.taskNo ? `رقم التاسك: ${rowData.taskNo}` : '',
      rawType ? `نوع المحتوى: ${rawType}` : '',
      rowData.description ? `وصف المحتوى: ${rowData.description}` : '',
      rowData.idea ? `الفكرة: ${rowData.idea}` : ''
    ]);

    return rules;
  }

  function fillAssignmentText(kind, assignmentRow, text) {
    const textarea = assignmentRow?.querySelector('[data-required-text]');
    if (textarea) textarea.value = templateCellText(text);
  }

  function addContentExecutionAssignment(kind, deptIndexes, rowData, filler) {
    const deptRow = findDepartmentRowByKind(kind);
    if (!deptRow) return false;
    openAndEnableDepartmentRow(deptRow);
    const index = deptIndexes[kind] || 0;
    deptIndexes[kind] = index + 1;
    const assignmentRow = addOrGetDepartmentAssignment(deptRow, index);
    if (!assignmentRow) return false;
    clearAssignmentRequirement(assignmentRow);
    const requiredInput = assignmentRow.querySelector('[data-required-date]');
    const deliveryInput = assignmentRow.querySelector('[data-delivery-date]');
    if (requiredInput && rowData.requiredDate) requiredInput.value = rowData.requiredDate;
    if (deliveryInput && rowData.deliveryDate) deliveryInput.value = rowData.deliveryDate;
    filler(assignmentRow);
    return true;
  }

  function findSectionMarkerRow(rows, variants) {
    const wanted = variants.map((v) => templateCellText(v).toLowerCase());
    return rows.findIndex((row) => (row || []).some((cell) => {
      const text = templateCellText(cell).toLowerCase();
      return text && wanted.some((variant) => text.includes(variant));
    }));
  }

  function findCellPosition(rows, variants) {
    const wanted = variants.map((v) => templateCellText(v).toLowerCase());
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c += 1) {
        const text = templateCellText(row[c]).toLowerCase();
        if (text && wanted.some((variant) => text.includes(variant))) return { row: r, col: c };
      }
    }
    return { row: -1, col: -1 };
  }

  function extractCampaignLogicFromRows(rows) {
    const marker = findCellPosition(rows, ['campaign logic']);
    if (marker.row < 0) return [];
    const stopWords = ['writing rules', 'قواعد كتابة المحتوى', 'content execution direction', 'آلية تنفيذ المحتوى', 'الية تنفيذ المحتوى'];
    const labelCol = marker.col + 1;
    const valueCol = marker.col + 2;
    const items = [];
    for (let r = marker.row; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (r > marker.row) {
        const joined = row.map(templateCellText).join(' ').toLowerCase();
        if (stopWords.some((word) => joined.includes(word))) break;
      }
      const label = templateCellText(row[labelCol]) || templateCellText(row.find((cell, i) => i !== marker.col && i !== valueCol && templateCellText(cell)));
      const value = templateCellText(row[valueCol]) || templateCellText(row[labelCol + 1]);
      if (!label || !value) continue;
      if (label.toLowerCase().includes('campaign logic')) continue;
      items.push({ label, value });
    }
    return items;
  }

  function extractWritingRulesFromRows(rows) {
    const start = findSectionMarkerRow(rows, ['Writing Rules', 'قواعد كتابة المحتوى']);
    if (start < 0) return [];
    const end = findSectionMarkerRow(rows.slice(start + 1), ['Content Execution Direction', 'آلية تنفيذ المحتوى', 'الية تنفيذ المحتوى']);
    const until = end >= 0 ? start + 1 + end : rows.length;
    const rules = [];
    const skip = ['writing rules', 'قواعد كتابة المحتوى', 'محتوي حملات mzj', 'محتوى حملات mzj'];
    for (let r = start + 1; r < until; r += 1) {
      const row = rows[r] || [];
      row.forEach((cell) => {
        const text = templateCellText(cell);
        if (!text) return;
        const lower = text.toLowerCase();
        if (skip.some((word) => lower.includes(word.toLowerCase()))) return;
        if (!rules.includes(text)) rules.push(text);
      });
    }
    return rules;
  }

  function uniqueContentTypesFromImportedTasks(tasks) {
    const map = new Map();
    (tasks || []).forEach((task) => {
      const contentType = templateCellText(task?.contentType);
      if (!contentType) return;
      if (!map.has(contentType)) map.set(contentType, []);
      map.get(contentType).push(task);
    });
    return Array.from(map.entries()).map(([contentType, items]) => ({ contentType, items }));
  }

  function renderDepartmentOptions(selectedId = '') {
    return '<option value="">اختار القسم</option>' + departmentsCache.map((dept) => `<option value="${escapeHTML(dept.id)}" ${String(selectedId) === String(dept.id) ? 'selected' : ''}>${escapeHTML(dept.name)}</option>`).join('');
  }

  function departmentById(id) {
    return departmentsCache.find((dept) => String(dept.id) === String(id));
  }

  function renderImportedUserOptionsForDepartment(deptId, selectedValue = '') {
    const dept = departmentById(deptId);
    const users = dept ? usersForDepartment(dept, usersCache) : [];
    const html = renderUserOptions(users, '', false);
    if (!selectedValue) return html;
    const wrap = document.createElement('select');
    wrap.innerHTML = html;
    const wanted = templateCellText(selectedValue).toLowerCase();
    const opt = Array.from(wrap.options).find((option) => {
      const value = templateCellText(option.value).toLowerCase();
      const text = templateCellText(option.textContent).toLowerCase();
      const email = templateCellText(option.dataset.userEmail || '').toLowerCase();
      const name = templateCellText(option.dataset.userName || '').toLowerCase();
      return value === wanted || text.includes(wanted) || email === wanted || name === wanted;
    });
    if (opt) opt.selected = true;
    return wrap.innerHTML;
  }

  function renderContentTypeLinkingPanel(context) {
    const groups = uniqueContentTypesFromImportedTasks(context?.contentExecutionTasks || []);
    if (!groups.length) return '';
    return `
      <div class="campaign-context-panel content-type-linking-panel" data-content-type-linking-panel>
        <h5>ربط أنواع المحتوى بالأقسام</h5>
        <p class="admin-only-note">السيستم قرأ أنواع المحتوى من الشيت. اختار لكل نوع محتوى القسم واليوزر المسؤول، وبعدها اضغط تطبيق الربط. كل التاسكات من نفس النوع هتنزل في القسم واليوزر المختارين.</p>
        <div class="content-type-linking-grid">
          ${groups.map((group) => `
            <article class="content-type-link-card" data-content-type-link-row data-content-type="${escapeHTML(group.contentType)}">
              <div class="content-type-link-title">
                <strong>${escapeHTML(group.contentType)}</strong>
                <span>${group.items.length} تاسك</span>
              </div>
              <label class="mzj-field"><span>القسم</span><select data-content-type-department>${renderDepartmentOptions()}</select></label>
              <label class="mzj-field"><span>اليوزر في القسم</span><select data-content-type-user><option value="">اختار القسم الأول</option></select></label>
            </article>`).join('')}
        </div>
        <button class="primary-btn" type="button" data-apply-content-type-linking>تطبيق الربط على التاسكات</button>
      </div>`;
  }

  function renderImportedCampaignContext(context) {
    if (!importedCampaignLogicSection || !importedCampaignLogicBox) return;
    const logic = Array.isArray(context?.campaignLogic) ? context.campaignLogic : [];
    const rules = Array.isArray(context?.writingRules) ? context.writingRules : [];
    const linkingHtml = renderContentTypeLinkingPanel(context);
    if (!logic.length && !rules.length && !linkingHtml) {
      importedCampaignLogicSection.hidden = true;
      importedCampaignLogicBox.innerHTML = '';
      return;
    }
    importedCampaignLogicSection.hidden = false;
    const logicHtml = logic.length ? `
      <div class="campaign-context-panel">
        <h5>campaign logic</h5>
        <div class="campaign-context-kv">
          ${logic.map((item) => `<article><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.value).replace(/\n/g, '<br>')}</p></article>`).join('')}
        </div>
      </div>` : '';
    const rulesHtml = rules.length ? `
      <div class="campaign-context-panel">
        <h5>قواعد كتابة المحتوى</h5>
        <ul class="campaign-writing-rules">${rules.map((rule) => `<li>${escapeHTML(rule)}</li>`).join('')}</ul>
      </div>` : '';
    importedCampaignLogicBox.innerHTML = logicHtml + rulesHtml + linkingHtml;
  }

  function findDepartmentRowById(id) {
    return Array.from(departmentsList.querySelectorAll('.department-task-row')).find((row) => String(row.dataset.departmentId || '') === String(id));
  }

  function setAssignmentUserByValue(assignmentRow, rawValue) {
    const select = assignmentRow?.querySelector('[data-user-select]');
    if (!select) return;
    const value = templateCellText(rawValue);
    if (!value) return;
    const wanted = value.toLowerCase();
    const option = Array.from(select.options).find((opt) => {
      const val = templateCellText(opt.value).toLowerCase();
      const text = templateCellText(opt.textContent).toLowerCase();
      const email = templateCellText(opt.dataset.userEmail || '').toLowerCase();
      const name = templateCellText(opt.dataset.userName || '').toLowerCase();
      return val === wanted || email === wanted || name === wanted || text.includes(wanted);
    });
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function clearImportedContentAssignments() {
    renderAllDepartments();
  }

  function applyContentTypeLinkingFromPanel(panel) {
    const tasks = importedTemplateContext.contentExecutionTasks || [];
    if (!tasks.length) {
      if (note) note.textContent = '⚠️ ارفع الشيت الأول علشان تظهر أنواع المحتوى.';
      return;
    }
    const rows = Array.from(panel.querySelectorAll('[data-content-type-link-row]'));
    const mapping = new Map();
    rows.forEach((row) => {
      const contentType = row.dataset.contentType || '';
      const deptId = row.querySelector('[data-content-type-department]')?.value || '';
      const userValue = row.querySelector('[data-content-type-user]')?.value || '';
      if (contentType && deptId) mapping.set(contentType, { deptId, userValue });
    });
    if (!mapping.size) {
      if (note) note.textContent = '⚠️ اختار قسم واحد على الأقل لنوع محتوى واحد.';
      return;
    }
    clearImportedContentAssignments();
    const perDeptCount = {};
    let created = 0;
    tasks.forEach((task) => {
      const mapItem = mapping.get(templateCellText(task.contentType));
      if (!mapItem) return;
      const dept = departmentById(mapItem.deptId);
      const deptRow = findDepartmentRowById(mapItem.deptId);
      if (!dept || !deptRow) return;
      const kind = deptRow.dataset.departmentKind || deptKindFromName(dept.name);
      openAndEnableDepartmentRow(deptRow);
      const key = String(mapItem.deptId);
      const idx = perDeptCount[key] || 0;
      perDeptCount[key] = idx + 1;
      const assignmentRow = addOrGetDepartmentAssignment(deptRow, idx);
      if (!assignmentRow) return;
      assignmentRow.dataset.importedContentAssignment = 'true';
      assignmentRow.dataset.importedContentType = task.contentType || '';
      clearAssignmentRequirement(assignmentRow);
      setAssignmentUserByValue(assignmentRow, mapItem.userValue);
      fillAssignmentText(kind, assignmentRow, task.requiredText || buildContentExecutionTaskText(task));
      created += 1;
    });
    importedTemplateContext.contentTypeMapping = Array.from(mapping.entries()).map(([contentType, item]) => ({ contentType, ...item }));
    if (note) note.textContent = `✅ تم ربط ${created} تاسك حسب نوع المحتوى. راجع المطلوب واليوزرات ثم اضغط حفظ.`;
  }

  function campaignInfoValueBeforeExecution(rows, labels) {
    const executionHeader = findContentExecutionHeader(rows);
    const limit = executionHeader > 0 ? executionHeader : rows.length;
    return findImportedValue(rows.slice(0, limit), labels);
  }

  function buildContentExecutionTaskText(rowData) {
    return compactTaskText([
      rowData.taskNo ? `رقم التاسك: ${rowData.taskNo}` : '',
      rowData.contentType ? `نوع المحتوى: ${rowData.contentType}` : '',
      rowData.goal ? `الهدف: ${rowData.goal}` : '',
      rowData.tangibleGoal ? `الهدف الملموس: ${rowData.tangibleGoal}` : '',
      rowData.idea ? `الفكرة: ${rowData.idea}` : '',
      rowData.description ? `وصف المحتوى: ${rowData.description}` : '',
      rowData.message ? `الرسالة: ${rowData.message}` : '',
      rowData.writerRequest ? `المطلوب من اليوزر / المطلوب من الكاتب: ${rowData.writerRequest}` : '',
      rowData.cta ? `CTA: ${rowData.cta}` : ''
    ]);
  }

  function applyContentExecutionDirectionFromRows(rows, context = {}) {
    const headerIndex = findContentExecutionHeader(rows);
    if (headerIndex < 0) return false;
    const headers = rows[headerIndex] || [];
    const col = {
      campaignType: findHeaderColumnLoose(headers, ['نوع الحملة', 'نوع الحمله']),
      contentType: findHeaderColumnLoose(headers, ['نوع المحتوى', 'نوع المحتوي']),
      taskNo: findHeaderColumnLoose(headers, ['رقم التاسك', 'رقم المهمة']),
      goal: findHeaderColumnLoose(headers, ['الهدف']),
      tangibleGoal: findHeaderColumnLoose(headers, ['الهدف الملموس']),
      idea: findHeaderColumnLoose(headers, ['الفكرة', 'الفكره']),
      description: findHeaderColumnLoose(headers, ['وصف المحتوى', 'وصف المحتوي']),
      message: findHeaderColumnLoose(headers, ['الرسالة', 'الرساله']),
      writerRequest: findHeaderColumnLoose(headers, ['المطلوب من الكاتب', 'المطلوب']),
      cta: findHeaderColumnLoose(headers, ['CTA'])
    };
    if (col.contentType < 0 || col.taskNo < 0) return false;

    const importedRows = [];
    let lastCampaignType = '';
    for (let r = headerIndex + 1; r < rows.length; r += 1) {
      const cells = rows[r] || [];
      if (!cells.some((cell) => templateCellText(cell))) continue;
      const firstCell = templateCellText(cells[0]);
      if (firstCell && (firstCell.includes('جدول النشر') || firstCell.includes('الميزانية') || firstCell.includes('Budget'))) break;
      const contentType = templateCellText(cells[col.contentType]);
      const taskNo = templateCellText(cells[col.taskNo]);
      if (!contentType || !taskNo) continue;
      const campaignType = templateCellText(cells[col.campaignType]) || lastCampaignType;
      if (campaignType) lastCampaignType = campaignType;
      const rowData = {
        campaignType,
        contentType,
        taskNo,
        goal: templateCellText(cells[col.goal]),
        tangibleGoal: templateCellText(cells[col.tangibleGoal]),
        idea: templateCellText(cells[col.idea]),
        description: templateCellText(cells[col.description]),
        message: templateCellText(cells[col.message]),
        writerRequest: templateCellText(cells[col.writerRequest]),
        cta: templateCellText(cells[col.cta]),
        requiredDate: '',
        deliveryDate: ''
      };
      rowData.requiredText = buildContentExecutionTaskText(rowData);
      importedRows.push(rowData);

      // لا يتم تنزيل التاسك على أي قسم تلقائيًا.
      // بعد الرفع تظهر لوحة ربط أنواع المحتوى بالأقسام واليوزرات.
    }

    if (!importedRows.length) return false;
    importedTemplateContext = {
      ...importedTemplateContext,
      loaded: true,
      fileName: context.fileName || importedTemplateContext.fileName || '',
      sheetName: context.sheetName || importedTemplateContext.sheetName || '',
      campaignLogic: context.campaignLogic || importedTemplateContext.campaignLogic || [],
      writingRules: context.writingRules || importedTemplateContext.writingRules || [],
      contentExecutionTasks: importedRows
    };
    renderImportedCampaignContext(importedTemplateContext);
    if (note) note.textContent = `✅ تم قراءة ${importedRows.length} تاسك من آلية تنفيذ المحتوى. اختار لكل نوع محتوى القسم واليوزر من لوحة الربط، ثم اضغط تطبيق الربط.`;
    return true;
  }

  function applySimpleAssignmentsFromRows(rows) {
    const headerIndex = findSimpleAssignmentsHeader(rows);
    if (headerIndex < 0) return false;
    const headers = rows[headerIndex] || [];
    const col = {
      department: findImportColumn(headers, ['القسم']),
      user: findImportColumn(headers, ['اليوزر بالاسم', 'اليوزر', 'المسؤول', 'المسئول']),
      requiredDate: findImportColumn(headers, ['التاريخ المطلوب', 'تاريخ المطلوب']),
      deliveryDate: findImportColumn(headers, ['تاريخ التسليم', 'تاريخ النشر']),
      text: findImportColumn(headers, ['المطلوب كتابة', 'شرح المطلوب', 'المطلوب']),
      choice1: findImportColumn(headers, ['اختيار 1', 'المطلوب اختيار 1']),
      choice2: findImportColumn(headers, ['اختيار 2', 'المطلوب اختيار 2']),
      choice3: findImportColumn(headers, ['اختيار 3', 'المطلوب اختيار 3']),
      carType: findImportColumn(headers, ['نوع السيارة']),
      photoType: findImportColumn(headers, ['نوع محتوى التصوير', 'نوع المحتوى', 'مطلوب التصوير'])
    };
    const perDeptCount = {};
    let imported = 0;
    rows.slice(headerIndex + 1).forEach((row) => {
      const cells = row || [];
      if (!cells.some((cell) => templateCellText(cell))) return;
      const deptText = templateCellText(cells[col.department]);
      if (!deptText || deptText.includes('بعد الرفع') || deptText.includes('جدول النشر') || deptText.includes('الميزانية')) return;
      const kind = deptKindFromName(deptText);
      const deptRow = findDepartmentRowByKind(kind);
      if (!deptRow) return;
      openAndEnableDepartmentRow(deptRow);
      const idx = perDeptCount[kind] || 0;
      perDeptCount[kind] = idx + 1;
      const assignmentRow = addOrGetDepartmentAssignment(deptRow, idx);
      if (!assignmentRow) return;
      clearAssignmentRequirement(assignmentRow);
      setDepartmentUser(assignmentRow, cells[col.user]);
      const requiredInput = assignmentRow.querySelector('[data-required-date]');
      const deliveryInput = assignmentRow.querySelector('[data-delivery-date]');
      const requiredDate = normalizeImportedDate(cells[col.requiredDate]);
      const deliveryDate = normalizeImportedDate(cells[col.deliveryDate]);
      if (requiredInput && requiredDate) requiredInput.value = requiredDate;
      if (deliveryInput && deliveryDate) deliveryInput.value = deliveryDate;
      const freeText = templateCellText(cells[col.text]);
      const choices = [cells[col.choice1], cells[col.choice2], cells[col.choice3]].map(templateCellText).filter(Boolean).join(' | ');
      if (kind === 'design' || kind === 'montage') {
        selectDeliverablesInsideAssignment(kind, assignmentRow, choices);
        const textarea = assignmentRow.querySelector('[data-required-text]');
        if (textarea) textarea.value = freeText;
      } else if (kind === 'photography') {
        fillPhotoInsideAssignment(assignmentRow, cells[col.carType], cells[col.photoType], freeText || choices);
      } else {
        const textarea = assignmentRow.querySelector('[data-required-text]');
        if (textarea) textarea.value = freeText || choices;
      }
      imported += 1;
    });
    if (note) note.textContent = imported ? `✅ تم تحميل ${imported} تكليف من Template. راجع البيانات ثم اضغط حفظ.` : '⚠️ لم يتم العثور على تكليفات واضحة داخل Template.';
    return true;
  }

  function applyImportedSchedule(rows) {
    const scheduleStart = rows.findIndex((row) => row.some((cell) => templateCellText(cell).includes('إنشاء جدول النشر') || templateCellText(cell).includes('جدول النشر')));
    if (scheduleStart < 0 || !publishScheduleRows) return;
    publishScheduleRows.innerHTML = '';
    const stopWords = ['إنشاء الميزانية', 'الميزانية', 'تقرير النتائج', 'النتائج'];
    for (let r = scheduleStart + 1; r < Math.min(rows.length, scheduleStart + 12); r += 1) {
      const row = rows[r] || [];
      if (row.some((cell) => stopWords.some((word) => templateCellText(cell).includes(word)))) break;
      row.forEach((cell) => {
        const text = templateCellText(cell);
        if (!text) return;
        const date = normalizeImportedDate(cell) || normalizeImportedDate(text);
        const day = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].find((d) => text.includes(d)) || '';
        if (date || day || text.includes(':')) {
          createPublishScheduleRow({ day, date, content: text.replace(day, '').replace(date, '').replace(':', '').trim() });
        }
      });
    }
  }

  function applyImportedBudget(rows) {
    const budgetStart = rows.findIndex((row) => row.some((cell) => templateCellText(cell).includes('إنشاء الميزانية') || templateCellText(cell).includes('الميزانية')));
    if (budgetStart < 0 || !budgetItemsList) return;
    budgetItemsList.innerHTML = '';
    const budgetRows = rows.slice(budgetStart + 1, Math.min(rows.length, budgetStart + 8));
    const nonEmpty = budgetRows.flat().map(templateCellText).filter(Boolean);
    if (!nonEmpty.length) {
      createBudgetItem();
      return;
    }
    createBudgetItem({ adName: nonEmpty[0] || '', contentGoal: nonEmpty[1] || '', expectedGoal: nonEmpty[2] || '' });
    updateBudgetTotal();
  }

  function applyImportedTemplateRows(rows, fileName = '', sheetName = '') {
    const getBeforeExecution = (labels) => campaignInfoValueBeforeExecution(rows, labels);
    const taskTypeValue = templateCellText(getBeforeExecution(['نوع التاسك', 'نوع المهمة']));
    if (taskTypeValue.includes('أجندة')) typeSelect.value = 'agenda';
    else typeSelect.value = 'campaign';
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const campaignLogic = extractCampaignLogicFromRows(rows);
    const writingRules = extractWritingRulesFromRows(rows);
    importedTemplateContext = {
      loaded: false,
      fileName: fileName || '',
      sheetName: sheetName || '',
      campaignLogic,
      writingRules,
      contentExecutionTasks: []
    };
    renderImportedCampaignContext(importedTemplateContext);

    const taskDate = normalizeImportedDate(getBeforeExecution(['التاريخ']));
    const name = getBeforeExecution(['اسم الحملة', 'اسم الأجندة', 'اسم الحملة / الأجندة']);
    const code = getBeforeExecution(['كود الحملة', 'كود الأجندة', 'كود الحملة / الأجندة']);
    const goal = getBeforeExecution(['الهدف من الحملة', 'الهدف من الأجندة', 'الهدف الاستراتيجي للحملة', 'الهدف النهائي للحملة']);
    const typeName = getBeforeExecution(['نوع الحملة', 'نوع الحمله', 'نوع الأجندة']);
    const startDate = normalizeImportedDate(getBeforeExecution(['تاريخ بداية الحملة', 'تاريخ بداية الأجندة', 'تاريخ نزول الحملة']));
    const endDate = normalizeImportedDate(getBeforeExecution(['تاريخ نهاية الحملة', 'تاريخ نهاية الأجندة']));

    if (taskDate && form.elements.taskDate) form.elements.taskDate.value = taskDate;
    if (name && form.elements.campaignName) form.elements.campaignName.value = templateCellText(name);
    if (code && campaignCodeInput) campaignCodeInput.value = templateCellText(code);
    if (goal && form.elements.campaignGoal) form.elements.campaignGoal.value = templateCellText(goal);
    if (typeName) setSelectValueByText(campaignTypeSelect, typeName, true);
    if (startDate && form.elements.campaignStartDate) form.elements.campaignStartDate.value = startDate;
    if (endDate && form.elements.campaignEndDate) form.elements.campaignEndDate.value = endDate;

    // شيت الحملات الاستراتيجي: نقرأ جدول Content Execution Direction كتاسكات خام فقط.
    // الربط بتصميم/مونتاج/تصوير/نشر يدوي حاليًا، بدون أي تخمين من نوع المحتوى.
    if (applyContentExecutionDirectionFromRows(rows, { fileName, sheetName, campaignLogic, writingRules })) {
      applyImportedSchedule(rows);
      applyImportedBudget(rows);
      return;
    }

    // قالب الرفع الجديد عبارة عن جدول تكليفات بسيط. نقرأ كل صف لوحده بدل ما نقرأ نص الشيت كله
    // حتى لا تختلط مطلوبات التصميم والمونتاج والمحتوى مع بعض.
    if (applySimpleAssignmentsFromRows(rows)) {
      applyImportedSchedule(rows);
      applyImportedBudget(rows);
      return;
    }

    // fallback للقوالب القديمة فقط.
    const sectionKinds = [
      ['photography', ['قسم التصوير']],
      ['content', ['قسم المحتوى']],
      ['design', ['قسم التصميم']],
      ['montage', ['قسم المونتاج', 'قسم الفيديو']],
      ['publish', ['قسم النشر']]
    ];
    sectionKinds.forEach(([kind, names]) => {
      const foundRow = rows.find((row) => row.some((cell) => names.some((name) => templateCellText(cell).includes(name))));
      if (foundRow) fillDepartmentFromImportedRow(kind, foundRow);
    });

    const fullText = rows.map((row) => row.map(templateCellText).join(' ')).join('\n');
    fillPhotographyItemsFromText(fullText);
    fillTextDepartment('content', get(['مطلوب قسم المحتوى', 'شرح المطلوب للمحتوى', 'المحتوى المطلوب']) || '');
    fillTextDepartment('publish', get(['مطلوب قسم النشر', 'شرح المطلوب للنشر', 'النشر المطلوب']) || '');
    selectDeliverablesByText('design', fullText);
    selectDeliverablesByText('montage', fullText);
    applyImportedSchedule(rows);
    applyImportedBudget(rows);

    if (note) note.textContent = `✅ تم تحميل بيانات Template من ملف ${fileName || 'Excel'} داخل نموذج إنشاء التاسك. راجع الأقسام والميزانية ثم اضغط حفظ.`;
  }

  async function handleFilledTemplateUpload(file) {
    if (!file) return;
    if (!window.XLSX) {
      if (note) note.textContent = '⚠️ مكتبة قراءة Excel لم يتم تحميلها. تأكد من الاتصال بالإنترنت.';
      return;
    }
    try {
      await ensureDepartments();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = pickCampaignContentSheetName(workbook);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const cleanRows = rows.map((row) => (row || []).map((cell) => templateCellText(cell))).filter((row) => row.some(Boolean));
      applyImportedTemplateRows(cleanRows, file.name, sheetName);
    } catch (error) {
      if (note) note.textContent = '⚠️ فشل تحميل Template: ' + (error?.message || error);
    }
  }

  function collectBudgetDetails() {
    const items = budgetItemsList ? Array.from(budgetItemsList.querySelectorAll('[data-budget-item]')).map(collectBudgetItem).filter((item) => {
      return item.adType || item.adName || item.publishDate || item.duration || item.adsCount || item.contentGoal || item.expectedGoal || item.platforms.length;
    }) : [];
    const totalBudget = items.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0);
    return {
      items,
      totalBudget,
      adsCount: items.length,
      platformsTotal: totalBudget,
      mode: 'items_by_ad'
    };
  }

  function collectSpecialDepartmentDetails(row, kind) {
    if (kind === 'photography') {
      const items = Array.from(row.querySelectorAll('[data-photo-item]')).map((item) => ({
        carType: item.querySelector('[data-photo-car-type]')?.value.trim() || '',
        contentType: item.querySelector('[data-photo-content-type]')?.value || ''
      })).filter((item) => item.carType || item.contentType);
      const notes = row.querySelector('[data-required-text]')?.value.trim() || '';
      const itemText = items.map((item) => [item.carType ? `نوع السيارة: ${item.carType}` : '', item.contentType ? `نوع المحتوى: ${item.contentType}` : ''].filter(Boolean).join(' — ')).join(' | ');
      return {
        kind,
        items,
        notes,
        requiredText: [itemText, notes].filter(Boolean).join(' — ')
      };
    }
    if (kind === 'design') {
      const selected = Array.from(row.querySelectorAll('[data-design-deliverable]:checked')).map((item) => ({
        title: item.dataset.title || item.value || '',
        details: item.dataset.desc || ''
      })).filter((item) => item.title || item.details);
      const notes = row.querySelector('[data-required-text]')?.value.trim() || '';
      return {
        kind,
        deliverables: selected,
        deliverable: selected.map((item) => item.title).join('، '),
        deliveryDetails: selected.map((item) => [item.title, item.details].filter(Boolean).join(': ')).join(' | '),
        notes,
        requiredText: [selected.map((item) => [item.title, item.details].filter(Boolean).join(': ')).join(' | '), notes].filter(Boolean).join(' — ')
      };
    }
    if (kind === 'montage') {
      const selected = Array.from(row.querySelectorAll('[data-montage-deliverable]:checked')).map((item) => ({
        title: item.dataset.title || item.value || '',
        details: item.dataset.desc || ''
      })).filter((item) => item.title || item.details);
      const notes = row.querySelector('[data-required-text]')?.value.trim() || '';
      return {
        kind,
        deliverables: selected,
        deliverable: selected.map((item) => item.title).join('، '),
        deliveryDetails: selected.map((item) => [item.title, item.details].filter(Boolean).join(': ')).join(' | '),
        notes,
        requiredText: [selected.map((item) => [item.title, item.details].filter(Boolean).join(': ')).join(' | '), notes].filter(Boolean).join(' — ')
      };
    }
    const notes = row.querySelector('[data-required-text]')?.value.trim() || '';
    return { kind, notes, requiredText: notes };
  }

  function collectDepartmentTasks() {
    const tasks = [];
    Array.from(departmentsList.querySelectorAll('.department-task-row')).forEach((deptRow) => {
      const enabled = Boolean(deptRow.querySelector('[data-department-enabled]')?.checked);
      if (!enabled) return;
      const departmentId = deptRow.dataset.departmentId || '';
      const department = departmentsCache.find((dept) => String(dept.id) === String(departmentId));
      const kind = deptRow.dataset.departmentKind || deptKindFromName(department?.name || '');
      Array.from(deptRow.querySelectorAll('[data-department-assignment-row]')).forEach((assignmentRow, assignmentIndex) => {
        const special = collectSpecialDepartmentDetails(assignmentRow, kind);
        const requiredText = special.requiredText || '';
        const selectedUser = assignmentRow.querySelector('[data-user-select]')?.value || '';
        const selectedOption = assignmentRow.querySelector('[data-user-select] option:checked');
        const optionText = selectedOption?.textContent || '';
        const selectedName = selectedOption?.dataset.userName || (selectedUser ? optionText : '');
        const selectedEmail = selectedOption?.dataset.userEmail || selectedUser;
        const selectedId = selectedOption?.dataset.userId || selectedOption?.dataset.userUid || selectedEmail || selectedName;
        const assignmentNo = assignmentIndex + 1;
        const item = {
          enabled,
          departmentId,
          departmentKind: kind,
          departmentName: department?.name || '',
          assignmentIndex: assignmentNo,
          assignmentLabel: (department?.name || '') + ' - ' + '\u062a\u0643\u0644\u064a\u0641 ' + assignmentNo,
          userId: selectedId,
          userUid: selectedOption?.dataset.userUid || selectedId,
          userName: selectedName,
          userDisplayName: selectedName,
          userEmail: selectedEmail,
          assigneeUid: selectedOption?.dataset.userUid || selectedId,
          assigneeEmail: selectedEmail,
          assigneeName: selectedName,
          receiveDate: '',
          requiredDate: assignmentRow.querySelector('[data-required-date]')?.value || '',
          deliveryDate: assignmentRow.querySelector('[data-delivery-date]')?.value || '',
          receivedConfirmed: false,
          received: false,
          receivedAt: '',
          receivedBy: '',
          attachmentLabel: attachmentLabelForKind(kind),
          requiredText,
          requiredDetails: special
        };
        if (item.departmentId || item.userName || item.requiredText) tasks.push(item);
      });
    });
    return tasks;
  }

  function openCreateTaskModal() {
    ensureDepartments().then(() => {
      fillTemplateOptions();
      applyDateLabels();
      ensureGeneratedCode();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  if (openBtn) openBtn.addEventListener('click', openCreateTaskModal);
  if (openBtnMini) openBtnMini.addEventListener('click', openCreateTaskModal);

  typeSelect.addEventListener('change', async () => {
    try { await loadTaskTemplatesFromFirebase(); } catch (error) { if (note) note.textContent = '⚠️ فشل قراءة قوالب Firebase: ' + (error?.message || error?.code || error); }
    fillTemplateOptions();
    applyDateLabels();
    ensureGeneratedCode(true);
  });

  [agendaMonthSelect, agendaYearSelect].forEach((select) => {
    if (!select) return;
    select.addEventListener('change', () => {
      if (typeSelect.value === 'agenda') applyAgendaDefaults(true);
    });
  });

  if (importedCampaignLogicBox) {
    importedCampaignLogicBox.addEventListener('change', (event) => {
      const deptSelect = event.target.closest?.('[data-content-type-department]');
      if (!deptSelect) return;
      const row = deptSelect.closest('[data-content-type-link-row]');
      const userSelect = row?.querySelector('[data-content-type-user]');
      if (userSelect) userSelect.innerHTML = renderImportedUserOptionsForDepartment(deptSelect.value);
    });
    importedCampaignLogicBox.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-apply-content-type-linking]');
      if (!btn) return;
      const panel = btn.closest('[data-content-type-linking-panel]');
      if (panel) applyContentTypeLinkingFromPanel(panel);
    });
  }

  if (generateCampaignCodeBtn) {
    generateCampaignCodeBtn.addEventListener('click', () => ensureGeneratedCode(true));
  }

  if (addCampaignTypeBtn) {
    addCampaignTypeBtn.addEventListener('click', async () => {
      const name = newCampaignTypeInput?.value.trim() || '';
      if (!name) {
        if (note) note.textContent = '⚠️ اكتب نوع الحملة الجديد الأول.';
        return;
      }
      try {
        if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
        if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const id = 'type_' + Date.now();
        await firebase.firestore().collection('marketing_campaign_types').doc(id).set({ id, name, active: true, createdAt: new Date().toISOString() });
        if (newCampaignTypeInput) newCampaignTypeInput.value = '';
        await refreshCampaignTypes();
        if (campaignTypeSelect) campaignTypeSelect.value = name;
        if (note) note.textContent = '✅ تم حفظ نوع الحملة الجديد في السيستم.';
      } catch (error) {
        if (note) note.textContent = '⚠️ فشل حفظ نوع الحملة في Firebase: ' + (error?.message || error?.code || error);
      }
    });
  }

  templateSelect.addEventListener('change', () => {
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    renderTemplateFieldInputs(null);
  });

  departmentsList.addEventListener('click', (event) => {
    const addAssignment = event.target.closest('[data-add-department-assignment]');
    if (addAssignment) {
      const deptRow = addAssignment.closest('.department-task-row');
      addDepartmentAssignmentRow(deptRow);
      const checkbox = deptRow?.querySelector('[data-department-enabled]');
      if (checkbox) checkbox.checked = true;
      deptRow?.classList.add('is-open', 'is-selected');
      return;
    }
    const removeAssignment = event.target.closest('[data-remove-department-assignment]');
    if (removeAssignment) {
      const deptRow = removeAssignment.closest('.department-task-row');
      const list = removeAssignment.closest('[data-department-assignments-list]');
      if (list && list.querySelectorAll('[data-department-assignment-row]').length > 1) {
        removeAssignment.closest('[data-department-assignment-row]')?.remove();
        refreshDepartmentAssignmentNumbers(deptRow);
      } else if (note) {
        note.textContent = '\u26a0\ufe0f \u0644\u0627\u0632\u0645 \u064a\u0641\u0636\u0644 \u062a\u0643\u0644\u064a\u0641 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u062f\u0627\u062e\u0644 \u0627\u0644\u0642\u0633\u0645.';
      }
      return;
    }
    const addPhoto = event.target.closest('[data-add-photo-item]');
    if (addPhoto) {
      const list = addPhoto.closest('.dept-special-fields')?.querySelector('[data-photo-items-list]');
      if (list) {
        const item = document.createElement('article');
        item.className = 'photo-item-row';
        item.dataset.photoItem = 'true';
        item.innerHTML = `
          <label class="mzj-field"><span>نوع السيارة</span><input type="text" data-photo-car-type placeholder="مثال: هيونداي / النترا"></label>
          <label class="mzj-field"><span>نوع المحتوى</span><select data-photo-content-type>${PHOTOGRAPHY_CONTENT_TYPES.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('')}</select></label>
          <button class="soft-danger-btn" type="button" data-remove-photo-item>مسح</button>
        `;
        list.appendChild(item);
      }
      return;
    }
    const removePhoto = event.target.closest('[data-remove-photo-item]');
    if (removePhoto) {
      removePhoto.closest('[data-photo-item]')?.remove();
      return;
    }
    const btn = event.target.closest('[data-department-toggle]');
    if (!btn) return;
    const row = btn.closest('.department-task-row');
    const checkbox = row?.querySelector('[data-department-enabled]');
    if (!row || !checkbox) return;
    const willOpen = !row.classList.contains('is-open');
    departmentsList.querySelectorAll('.department-task-row.is-open').forEach((other) => {
      if (other !== row) other.classList.remove('is-open');
    });
    row.classList.toggle('is-open', willOpen);
    checkbox.checked = willOpen ? true : checkbox.checked;
    row.classList.toggle('is-selected', checkbox.checked);
  });

  departmentsList.addEventListener('change', (event) => {
    const choice = event.target.closest('[data-design-deliverable], [data-montage-deliverable]');
    if (choice) {
      choice.closest('.multi-choice-card')?.classList.toggle('is-checked', choice.checked);
    }
  });

  if (budgetItemsList) {
    budgetItemsList.addEventListener('input', updateBudgetTotal);
    budgetItemsList.addEventListener('change', updateBudgetTotal);
    budgetItemsList.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-budget-toggle]');
      if (toggle) {
        const item = toggle.closest('[data-budget-item]');
        item?.classList.toggle('is-open');
      }
      const remove = event.target.closest('[data-remove-budget-item]');
      if (remove) {
        remove.closest('[data-budget-item]')?.remove();
        updateBudgetTotal();
      }
    });
  }

  if (addBudgetItemBtn) {
    addBudgetItemBtn.addEventListener('click', () => createBudgetItem());
  }


  if (uploadFilledTemplateBtn && filledTemplateFileInput) {
    uploadFilledTemplateBtn.addEventListener('click', () => filledTemplateFileInput.click());
    filledTemplateFileInput.addEventListener('change', () => {
      const file = filledTemplateFileInput.files && filledTemplateFileInput.files[0];
      handleFilledTemplateUpload(file).finally(() => { filledTemplateFileInput.value = ''; });
    });
  }

  if (addPublishScheduleRowBtn) {
    addPublishScheduleRowBtn.addEventListener('click', () => createPublishScheduleRow());
  }

  if (publishScheduleRows) {
    publishScheduleRows.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-remove-schedule-row]');
      if (!removeBtn) return;
      removeBtn.closest('.publish-schedule-row')?.remove();
    });
  }


  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-create-task]') || event.target === modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedTemplate = getSelectedTemplate();
    const taskType = typeSelect.value;
    const departmentTasks = collectDepartmentTasks();

    if (!taskType) {
      if (note) note.textContent = '⚠️ اختار حملة أو أجندة الأول.';
      return;
    }

    if (taskType === 'campaign' && !selectedTemplate && !importedTemplateContext.loaded) {
      if (note) note.textContent = '⚠️ اختار قالب حملة محفوظ أو ارفع شيت حملة جاهز الأول.';
      return;
    }

    if (!departmentTasks.length) {
      if (note) note.textContent = '⚠️ اختار قسم واحد على الأقل واكتب المطلوب.';
      return;
    }

    const formData = new FormData(form);
    const payload = {
      id: 'task_' + Date.now(),
      taskType,
      taskTypeLabel: taskType === 'campaign' ? 'حملة' : 'أجندة',
      templateId: selectedTemplate?.id || '',
      templateName: selectedTemplate?.name || importedTemplateContext.fileName || '',
      templateFields: selectedTemplate?.headers || [],
      templateValues: collectTemplateValues(),
      importedTemplateFileName: importedTemplateContext.fileName || '',
      importedTemplateSheetName: importedTemplateContext.sheetName || '',
      campaignLogic: importedTemplateContext.campaignLogic || [],
      writingRules: importedTemplateContext.writingRules || [],
      contentExecutionTasks: importedTemplateContext.contentExecutionTasks || [],
      taskDate: formData.get('taskDate') || '',
      campaignName: taskType === 'agenda' ? getAgendaName(agendaMonthSelect?.value || '', agendaYearSelect?.value || '') : (formData.get('campaignName') || ''),
      campaignCode: formData.get('campaignCode') || generateCampaignCode(taskType),
      campaignTypeName: taskType === 'agenda' ? 'أجندة' : (formData.get('campaignTypeName') || ''),
      agendaMonth: taskType === 'agenda' ? (agendaMonthSelect?.value || '') : '',
      agendaYear: taskType === 'agenda' ? (agendaYearSelect?.value || '') : '',
      campaignGoal: taskType === 'agenda' ? 'تفاعلي' : (formData.get('campaignGoal') || ''),
      campaignStartDate: formData.get('campaignStartDate') || '',
      campaignEndDate: formData.get('campaignEndDate') || '',
      launchDate: formData.get('campaignStartDate') || '',
      endDate: formData.get('campaignEndDate') || '',
      departmentTasks,
      publishScheduleEntries: collectPublishScheduleDetails(),
      publishScheduleResult: collectPublishScheduleDetails().map((item) => [item.day, item.date, item.content].filter(Boolean).join(' - ')).join(' | '),
      budgetDetails: collectBudgetDetails(),
      sourceCollection: 'workspace_tasks',
      createdAt: new Date().toISOString(),
      stage: 'required',
      readiness: {},
      publishSteps: []
    };

    payload.departmentTasks = payload.departmentTasks.map((dept) => ({
      ...dept,
      receivedConfirmed: false,
      receivedAt: '',
      receivedBy: ''
    }));
    payload.receiptProgress = 0;

    try {
      if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) {
        throw new Error('Firebase SDK غير موجود في الصفحة');
      }
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      payload.firestoreId = payload.id;
      payload.sourceFirestoreCollection = 'workspace_tasks';
      await firebase.firestore().collection('workspace_tasks').doc(payload.id).set(payload);
    } catch (error) {
      console.error('workspace_tasks save failed:', error);
      if (note) note.textContent = '⚠️ فشل الحفظ في Firebase: ' + (error?.message || error?.code || error) + ' — لم يتم الحفظ محلياً.';
      return;
    }

    if (note) note.textContent = '✅ تم حفظ التاسك في Firebase داخل مسار workspace_tasks.';
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    if (typeof window.refreshWorkspaceTasksFromFirestore === 'function') await window.refreshWorkspaceTasksFromFirestore();
    else if (typeof window.renderDashboardTasks === 'function') window.renderDashboardTasks();
  });
}

initTemplatesPage();
initCreateTaskFromTemplate();


/* Dashboard dynamic created tasks, user assignment, publishing workflow */
(function initDynamicDashboardTasks(){
  const TASK_KEY = 'mzj_created_tasks_from_templates_v1';
  const TASK_KEYS = ['mzj_created_tasks_from_templates_v1','workspace_tasks','mzj_workspace_tasks','mzj_dashboard_tasks_v2','mzj_campaign_records_v1'];
  const FIRESTORE_TASK_COLLECTIONS = ['workspace_tasks'];
  let firestoreTaskCache = [];
  const DEPT_MAP = {
    shooting: ['تصوير','التصوير','photography','shooting'],
    content: ['محتوى','المحتوى','content'],
    design: ['تصميم','التصميم','design'],
    montage: ['مونتاج','المونتاج','montage']
  };
  const PUBLISH_STEPS = [
    { label: 'التجهيز 1', value: 35 },
    { label: 'الاعتماد', value: 30, adminOnly: true },
    { label: 'النشر', value: 35 }
  ];

  function normalizeWorkspaceTask(task, fallbackId){
    if (!task || typeof task !== 'object') return null;
    const id = task.id || task.firestoreId || task.docId || fallbackId || ('task_' + Math.random().toString(36).slice(2));
    const labelRaw = task.taskTypeLabel || task.taskType || task.type || task.kind || 'حملة';
    const label = String(labelRaw).includes('أج') || String(labelRaw).toLowerCase().includes('agenda') ? 'أجندة' : (String(labelRaw).includes('تاسك') ? 'تاسك' : 'حملة');
    const deptTasks = Array.isArray(task.departmentTasks) ? task.departmentTasks : (Array.isArray(task.departments) ? task.departments : (Array.isArray(task.tasks) ? task.tasks : []));
    return {
      ...task,
      id,
      taskType: task.taskType || (label === 'أجندة' ? 'agenda' : 'campaign'),
      taskTypeLabel: label,
      campaignName: task.campaignName || task.name || task.title || task.agendaName || task.taskName || '',
      campaignCode: task.campaignCode || task.code || task.taskCode || '',
      campaignGoal: task.campaignGoal || task.goal || task.objective || '',
      launchDate: task.launchDate || task.campaignLaunchDate || task.publishDate || task.date || task.dueDate || '',
      departmentTasks: deptTasks.map((d, i) => ({
        enabled: d.enabled !== false,
        departmentId: d.departmentId || d.id || d.department || d.section || ('dept_' + i),
        departmentName: d.departmentName || d.name || d.department || d.sectionName || d.section || 'قسم',
        userId: d.userId || d.userUid || d.assigneeUid || d.uid || '',
        userUid: d.userUid || d.assigneeUid || d.uid || d.userId || '',
        userName: d.userName || d.userDisplayName || d.assigneeName || d.responsible || d.assignee || d.owner || d.user || '',
        userDisplayName: d.userDisplayName || d.userName || d.assigneeName || d.responsible || d.assignee || d.owner || d.user || '',
        userEmail: d.userEmail || d.assigneeEmail || d.email || '',
        assigneeUid: d.assigneeUid || d.userUid || d.userId || d.uid || '',
        assigneeEmail: d.assigneeEmail || d.userEmail || d.email || '',
        assigneeName: d.assigneeName || d.userDisplayName || d.userName || '',
        receiveDate: d.receiveDate || d.receivedAt || d.startDate || '',
        requiredDate: d.requiredDate || d.deadline || d.dueDate || '',
        deliveryDate: d.deliveryDate || d.deliveredAt || d.completedAt || '',
        receivedAt: d.receivedAt || '',
        receivedBy: d.receivedBy || '',
        receivedConfirmed: Boolean(d.receivedConfirmed || d.confirmed || d.received || d.receivedAt),
        files: Array.isArray(d.files) ? d.files : [],
        attachments: Array.isArray(d.attachments) ? d.attachments : [],
        driveFiles: Array.isArray(d.driveFiles) ? d.driveFiles : [],
        links: Array.isArray(d.links) ? d.links : [],
        fileUrl: d.fileUrl || '',
        attachmentUrl: d.attachmentUrl || '',
        attachmentLabel: d.attachmentLabel || d.attachment || d.fileName || '',
        requiredText: d.requiredText || d.description || d.details || d.required || ''
      })),
      readiness: task.readiness || {},
      publishSteps: Array.isArray(task.publishSteps) ? task.publishSteps : [],
      stage: task.stage || 'required'
    };
  }
  function readTasks(){
    const all = [];
    firestoreTaskCache.forEach((task, index) => all.push(normalizeWorkspaceTask(task, 'firestore_' + index)));
    const map = new Map();
    all.filter(Boolean).forEach((task) => map.set(String(task.id), { ...(map.get(String(task.id)) || {}), ...task }));
    return Array.from(map.values());
  }
  window.MZJReadDashboardTasks = readTasks;
  window.MZJRefreshDashboardTaskCache = function refreshDashboardTaskCache(taskId, departmentTasks){
    const idx = firestoreTaskCache.findIndex((item) => String(item.id || item.firestoreId || item.docId) === String(taskId));
    if (idx >= 0) {
      firestoreTaskCache[idx] = {
        ...firestoreTaskCache[idx],
        departmentTasks,
        updatedAt: new Date().toISOString()
      };
    }
  };
  async function saveTaskToFirestore(task){
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
    if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    const collectionName = task.sourceFirestoreCollection || 'workspace_tasks';
    const docId = task.firestoreId || task.docId || task.id;
    if (!docId) throw new Error('لا يوجد ID للتاسك');
    const cleanTask = JSON.parse(JSON.stringify({ ...task, firestoreId: docId, sourceFirestoreCollection: collectionName }));
    await firebase.firestore().collection(collectionName).doc(String(docId)).set(cleanTask, { merge: true });
    const index = firestoreTaskCache.findIndex((item) => String(item.id || item.firestoreId || item.docId) === String(task.id));
    if (index >= 0) firestoreTaskCache[index] = cleanTask;
    else firestoreTaskCache.unshift(cleanTask);
  }
  function writeTasks(tasks){ firestoreTaskCache = tasks; }
  async function refreshWorkspaceTasksFromFirestore(){
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const loaded = [];
      for (const collectionName of FIRESTORE_TASK_COLLECTIONS) {
        const snap = await firebase.firestore().collection(collectionName).get();
        snap.forEach((doc) => loaded.push({ id: doc.id, firestoreId: doc.id, sourceFirestoreCollection: collectionName, ...(doc.data() || {}) }));
      }
      firestoreTaskCache = loaded;
      window.renderDashboardTasks?.();
    } catch (error) {
      console.warn('workspace_tasks load failed:', error);
      firestoreTaskCache = [];
      window.renderDashboardTasks?.();
    }
  }
  window.refreshWorkspaceTasksFromFirestore = refreshWorkspaceTasksFromFirestore;
  async function deleteTaskEverywhere(taskId){
    const tasks = readTasks();
    const target = tasks.find((task) => String(task.id) === String(taskId));
    if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const collectionName = target?.sourceFirestoreCollection || 'workspace_tasks';
        const docId = target?.firestoreId || target?.docId || target?.id;
        if (docId) await firebase.firestore().collection(collectionName).doc(String(docId)).delete();
      } catch (error) {
        console.error('workspace_tasks delete failed:', error);
        alert('فشل مسح الحملة من Firebase: ' + (error?.message || error?.code || error));
      }
    }
    firestoreTaskCache = firestoreTaskCache.filter((task) => String(task.id || task.firestoreId) !== String(taskId));
    writeTasks(readTasks().filter((task) => String(task.id) !== String(taskId)));
  }
  function esc(v){ return String(v || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function user(){ return window.MZJAuth?.getUser?.() || null; }
  function userIsAdmin(){ return ['admin','marketing_manager'].includes(String(user()?.role || document.body.dataset.userRole || '').toLowerCase()); }
  function normMatchValue(value){ return String(value || '').trim().toLowerCase(); }
  function assignedToCurrentUser(dept, current){
    if (userIsAdmin()) return true;
    if (!current) return false;
    const currentValues = [current.id, current.uid, current.email, current.name, current.displayName]
      .map(normMatchValue).filter(Boolean);
    const deptValues = [
      dept.userId, dept.userUid, dept.assigneeUid,
      dept.userEmail, dept.assigneeEmail, dept.email,
      dept.userName, dept.userDisplayName, dept.assigneeName, dept.responsible
    ].map(normMatchValue).filter(Boolean);
    return deptValues.some((value) => currentValues.includes(value));
  }
  window.MZJDashboardTaskAPI = { readTasks, saveTaskToFirestore, assignedToCurrentUser, user, deptIdentity, taskTitle: (task) => task.campaignName || task.templateName || task.campaignCode || 'حملة بدون اسم' };
  function taskTitle(task){ return task.campaignName || task.templateName || task.campaignCode || 'حملة بدون اسم'; }
  function deptKey(deptName){
    const value = String(deptName || '').toLowerCase();
    return Object.entries(DEPT_MAP).find(([key, words]) => words.some(w => value.includes(String(w).toLowerCase())))?.[0] || 'content';
  }
  function taskDeptProgress(task, deptTask){
    const readiness = task.readiness || {};
    const key = deptTask.departmentId || deptTask.departmentName || deptTask.userName || '';
    const selected = Array.isArray(readiness[key]) ? readiness[key] : [];
    const steps = taskStepsForDept(deptKey(deptTask.departmentName));
    const total = selected.reduce((sum, index) => sum + Number(steps[Number(index)]?.value || 0), 0);
    return Math.min(100, Math.round(total));
  }
  function taskReadiness(task){
    const depts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    if (!depts.length) return 0;
    const total = depts.reduce((sum, d) => sum + taskDeptProgress(task, d), 0);
    return Math.round(total / depts.length);
  }
  function taskReceiptProgress(task){
    const depts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    if (!depts.length) return 0;
    const done = depts.filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
    return Math.round((done / depts.length) * 100);
  }
  function deptIdentity(dept){
    return [dept.departmentId || dept.departmentKey || dept.departmentName || '', dept.userId || dept.uid || dept.assigneeUid || dept.userEmail || dept.userName || ''].map(v => String(v || '').trim()).filter(Boolean).join('::');
  }
  function autoStage(task){
    if (!task.stage) task.stage = 'required';
    const ready = taskReadiness(task);
    if (task.stage !== 'archive' && ready >= 100) task.stage = 'publish';
    if ((task.publishSteps || []).length >= PUBLISH_STEPS.length) task.stage = 'archive';
    return task;
  }
  function clearList(id, emptyText){
    const el = document.getElementById(id);
    if (!el) return null;
    el.innerHTML = `<article class="task-template-card dashboard-empty-card"><div class="task-empty-note">${esc(emptyText)}</div></article>`;
    return el;
  }
  function ensureEmpty(el, text){
    if (el && !el.children.length) el.innerHTML = `<article class="task-template-card dashboard-empty-card"><div class="task-empty-note">${esc(text)}</div></article>`;
  }
  function appendCard(el, html){
    if (!el) return;
    if (el.querySelector('.dashboard-empty-card,.dashboard-placeholder')) el.innerHTML = '';
    el.insertAdjacentHTML('beforeend', html);
  }
  function meta(task){
    return `${esc(task.taskTypeLabel)} — ${esc(task.campaignCode || 'بدون كود')} — ${esc(task.launchDate || task.taskDate || 'بدون تاريخ')}`;
  }
  function requiredCard(task){
    const receipt = taskReceiptProgress(task);
    const receivedCount = (task.departmentTasks || []).filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
    const totalCount = (task.departmentTasks || []).filter((d) => d && d.enabled !== false).length || 0;
    return `<article class="task-template-card dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)}</span></div>
      <div class="department-progress-row"><div class="department-progress-box"><small>نسبة تم الاستلام</small><strong>${receipt}%</strong></div><div class="department-progress-box"><small>الأقسام المستلمة</small><strong>${receivedCount} / ${totalCount}</strong></div></div>
      <div class="mini-progress"><span style="width:${receipt}%"></span></div>
      <div class="receipt-strip">${(task.departmentTasks||[]).map(d=>`<span class="${(d.receivedConfirmed || d.received || d.receivedAt) ? 'is-done' : ''}">${esc(d.departmentName || 'قسم')} — ${(d.receivedConfirmed || d.received || d.receivedAt) ? 'تم الاستلام' : 'لم يتم الاستلام'}</span>`).join('')}</div>
      <div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div><div class="task-empty-note">المطلوب يختفي من هنا تلقائياً لما كل الأقسام تضغط تم الاستلام.</div>
    </article>`;
  }
  function readinessCard(task){
    const ready = taskReadiness(task);
    const depts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    const deptCount = Math.max(depts.length, 1);
    return `<article class="readiness-card dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية ${ready}%</span></div>
      <div class="mini-progress"><span style="width:${ready}%"></span></div>
      <div class="readiness-grid readiness-dynamic-grid readiness-approval-grid">
        ${depts.map((d) => {
          const dkey = deptKey(d.departmentName);
          const steps = encodeTaskSteps(getTaskDetailsSteps(dkey));
          const key = d.departmentId || d.departmentName || d.userName || '';
          const selected = ((task.readiness || {})[key] || []).join(',');
          const departmentShare = Math.round((100 / deptCount) * 100) / 100;
          const percent = taskDeptProgress(task, d);
          const requirement = formatDepartmentRequirement(d);
          return `<div class="readiness-dept-item" data-dept-task-card data-task-id="${esc(task.id)}" data-task-type="${esc(task.taskTypeLabel || task.taskType || '')}" data-campaign-code="${esc(task.campaignCode || '')}" data-readiness-key="${esc(key)}" data-dept-identity="${esc(deptIdentity(d))}" data-dept-key="${esc(dkey)}" data-department-share="${esc(departmentShare)}" data-completed-steps="${esc(selected)}">
            <button type="button" class="readiness-open-details" data-open-task-details data-dept-key="${esc(dkey)}" data-dept="${esc(d.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(requirement)}" data-dept-task-json="${esc(encodeURIComponent(JSON.stringify(d || {})))}" data-steps="${esc(steps)}">
              <strong>${esc(d.departmentName || 'قسم')}</strong>
              <small>${percent}%</small>
              <span>${esc(d.userDisplayName || d.userName || d.userEmail || 'بدون مسؤول')}</span>
              <em>تفاصيل واعتماد</em>
            </button>
          </div>`;
        }).join('')}
      </div><div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div>
    </article>`;
  }
  function publishCard(task){
    const done = Array.isArray(task.publishSteps) ? task.publishSteps : [];
    const percent = Math.min(100, PUBLISH_STEPS.reduce((sum, step, i) => sum + (done.includes(i) ? Number(step.value || 0) : 0), 0));
    const publishDept = (task.departmentTasks || []).find((d) => deptKey(d.departmentName) === 'publish') || {};
    const publishInfo = publishDept.departmentName ? `<div class="publish-info-box">
      <strong>${esc(task.taskTypeLabel || 'حملة')} — كود الحملة: ${esc(task.campaignCode || '--')} — تاريخ نزول الحملة: ${esc(task.launchDate || task.campaignStartDate || '--')}</strong>
      <small>اسم المسئول / ${esc(publishDept.userDisplayName || publishDept.userName || publishDept.userEmail || '--')}، تاريخ الاستلام / ${esc(publishDept.receiveDate || (publishDept.receivedAt ? String(publishDept.receivedAt).slice(0,10) : '--'))}، التاريخ المطلوب / ${esc(publishDept.requiredDate || '--')}، تاريخ النشر / ${esc(publishDept.deliveryDate || publishDept.publishDate || '--')}</small>
    </div>` : '';
    return `<article class="dept-card-template dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية النشر ${percent}%</span></div>
      ${publishInfo}
      <div class="mini-progress"><span style="width:${percent}%"></span></div>
      <div class="publish-actions-grid">
        ${PUBLISH_STEPS.map((step,i)=>`<button type="button" class="task-step-btn ${done.includes(i) ? 'is-done' : ''}" data-publish-step data-task-id="${esc(task.id)}" data-step-index="${i}" ${!userIsAdmin()?'disabled':''}><span>${esc(step.label)}</span><small>${esc(step.value)}%</small></button>`).join('')}
      </div><div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div>
    </article>`;
  }
  function archiveCard(task){
    return `<article class="dept-card-template dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — تم النشر والأرشفة</span></div>
      <div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div><div class="task-empty-note">الحملة اتنقلت تلقائياً إلى الأرشيف بعد اكتمال أزرار النشر.</div>
    </article>`;
  }

  function normalizeSearchText(value){
    return String(value || '').toLowerCase().replace(/[\u064B-\u065F]/g,'').trim();
  }
  function dashboardSearchHaystack(task){
    const parts = [];
    const push = (v) => { if (v !== undefined && v !== null) parts.push(String(v)); };
    ['id','title','name','taskType','type','campaignType','campaignName','agendaName','campaignCode','campaignSerial','code','goal','campaignGoal','objective','startDate','endDate','campaignStartDate','campaignEndDate','launchDate','campaignLaunchDate'].forEach(k => push(task[k]));
    (task.departmentTasks || []).forEach((d) => {
      ['departmentName','departmentId','userName','userDisplayName','userEmail','uid','userId','requiredText','deliveryDetails','requiredType','carType','contentType','requiredDate','deliveryDate','receiveDate'].forEach(k => push(d[k]));
      if (Array.isArray(d.selectedDeliverables)) d.selectedDeliverables.forEach((item) => {
        push(item?.title); push(item?.details); push(item?.desc);
      });
      if (Array.isArray(d.photoItems)) d.photoItems.forEach((item) => { push(item?.carType); push(item?.contentType); });
    });
    if (task.budget) {
      push(task.budget.totalBudget);
      (task.budget.items || []).forEach((item) => {
        ['adType','adName','publishDate','duration','adsCount','contentGoal','expectedGoal','itemTotal'].forEach(k => push(item[k]));
        (item.platforms || []).forEach((pl) => { push(pl.name); push(pl.amount); });
      });
    }
    (task.publishSchedule || task.publishScheduleItems || []).forEach((item) => { push(item.day); push(item.date); push(item.content); });
    return normalizeSearchText(parts.join(' '));
  }
  function taskMatchesDashboardSearch(task, query){
    const q = normalizeSearchText(query);
    if (!q) return true;
    return dashboardSearchHaystack(task).includes(q);
  }

  function userDeptCard(task, deptTask){
    const p = taskDeptProgress(task, deptTask);
    const dkey = deptKey(deptTask.departmentName);
    const steps = encodeTaskSteps(getTaskDetailsSteps(dkey));
    const key = deptTask.departmentId || deptTask.departmentName || deptTask.userName || '';
    const selected = ((task.readiness || {})[key] || []).join(',');
    const departmentShare = Math.round((100 / Math.max((task.departmentTasks||[]).length,1)) * 100) / 100;
    return `<article class="department-task-card dynamic-dashboard-card user-task-card-clean" data-dept-task-card data-task-id="${esc(task.id)}" data-task-type="${esc(task.taskTypeLabel || task.taskType || '')}" data-campaign-code="${esc(task.campaignCode || '')}" data-readiness-key="${esc(key)}" data-dept-identity="${esc(deptIdentity(deptTask))}" data-dept-key="${esc(dkey)}" data-department-share="${esc(departmentShare)}" data-completed-steps="${esc(selected)}">
      <div class="task-template-top user-task-title-only"><strong>${esc(taskTitle(task))}</strong></div>
      <div class="department-task-meta labeled-task-meta user-task-meta-clean">
        <span class="meta-person"><small>المسؤول</small><strong>${esc(deptTask.userDisplayName || deptTask.userName || deptTask.userEmail || 'بدون مسؤول')}</strong></span>
        <span class="meta-receive"><small>تاريخ الاستلام</small><strong>${esc(deptTask.receiveDate || (deptTask.receivedAt ? String(deptTask.receivedAt).slice(0,10) : '—'))}</strong></span>
        <span class="meta-date meta-required"><small>التاريخ المطلوب</small><strong>${esc(deptTask.requiredDate || '—')}</strong></span>
        <span class="meta-date meta-delivery"><small>${dkey === 'publish' ? 'تاريخ النشر' : 'تاريخ التسليم'}</small><strong>${esc(deptTask.deliveryDate || deptTask.publishDate || '—')}</strong></span>
        <span class="meta-status"><small>حالة الاستلام</small><strong>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم الاستلام' : 'لم يتم الاستلام'}</strong></span>
      </div>
      <div class="department-progress-row"><div class="department-progress-box"><small>اكتمال التاسك</small><strong data-task-percent>${p}%</strong></div><div class="department-progress-box"><small>نسبة الحملة</small><strong data-campaign-percent>${Math.round(p / Math.max((task.departmentTasks||[]).length,1))}%</strong></div></div>
      <div class="mini-progress"><span data-task-bar style="width:${p}%"></span></div>
      <div class="task-card-actions"><button class="details-btn" type="button" data-open-task-details data-dept-key="${esc(dkey)}" data-dept="${esc(deptTask.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(formatDepartmentRequirement(deptTask))}" data-dept-task-json="${esc(encodeURIComponent(JSON.stringify(deptTask || {})))}" data-steps="${esc(steps)}">تفاصيل</button><button class="soft-btn receive-task-btn ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'is-done' : ''}" type="button" data-receive-task data-task-id="${esc(task.id)}" data-dept-identity="${esc(deptIdentity(deptTask))}" ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'disabled' : ''}>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم تأكيد الاستلام' : 'تأكيد استلام التاسك'}</button></div>
    </article>`;
  }

  window.renderDashboardTasks = function renderDashboardTasks(){
    if (!document.getElementById('adminRequiredTasks') && !document.getElementById('userShootingTasks')) return;
    const query = document.getElementById('dashboardTaskSearch')?.value || '';
    const tasks = readTasks().map(autoStage).filter((task) => taskMatchesDashboardSearch(task, query));
    const required = clearList('adminRequiredTasks','لا توجد تاسكات مطلوبة حالياً.');
    const readiness = clearList('adminReadinessTasks','لا توجد حملات في جاهزية المطلوب حالياً.');
    const publishing = clearList('adminPublishingTasks','لا توجد حملات جاهزة للنشر حالياً.');
    const archive = clearList('adminArchiveTasks','لا توجد حملات مؤرشفة حالياً.');
    const userLists = {
      shooting: clearList('userShootingTasks','لا توجد تاسكات لقسم التصوير حالياً.'),
      content: clearList('userContentTasks','لا توجد تاسكات لقسم المحتوى حالياً.'),
      design: clearList('userDesignTasks','لا توجد تاسكات لقسم التصميم حالياً.'),
      montage: clearList('userMontageTasks','لا توجد تاسكات لقسم المونتاج حالياً.')
    };
    const current = user();
    tasks.forEach(task => {
      const ready = taskReadiness(task);
      if (task.stage === 'archive') appendCard(archive, archiveCard(task));
      else if (task.stage === 'publish') appendCard(publishing, publishCard(task));
      else {
        if (taskReceiptProgress(task) < 100) appendCard(required, requiredCard(task));
        appendCard(readiness, readinessCard(task));
      }
      (task.departmentTasks || []).forEach(dept => {
        const visible = assignedToCurrentUser(dept, current);
        if (!visible) return;
        appendCard(userLists[deptKey(dept.departmentName)], userDeptCard(task, dept));
      });
    });
    Object.entries(userLists).forEach(([key,el]) => ensureEmpty(el, 'لا توجد تاسكات حالياً.'));
  };

  document.addEventListener('click', function(event){
    const pub = event.target.closest('[data-publish-step]');
    if (pub) {
      if (!userIsAdmin()) return;
      const tasks = readTasks();
      const task = tasks.find(t => t.id === pub.dataset.taskId);
      if (!task) return;
      const idx = Number(pub.dataset.stepIndex);
      task.publishSteps = Array.isArray(task.publishSteps) ? task.publishSteps : [];
      if (!task.publishSteps.includes(idx)) task.publishSteps.push(idx);
      if (task.publishSteps.length >= PUBLISH_STEPS.length) task.stage = 'archive';
      autoStage(task);
      saveTaskToFirestore(task).then(() => window.renderDashboardTasks()).catch((error) => alert('فشل تحديث النشر في Firebase: ' + (error?.message || error?.code || error)));
      return;
    }
  });

  document.addEventListener('click', function(event){
    const step = event.target.closest('#taskStepButtons .task-step-btn');
    if (!step || !activeTaskCard || !activeTaskCard.dataset.taskId) return;
    setTimeout(function(){
      const tasks = readTasks();
      const task = tasks.find(t => t.id === activeTaskCard.dataset.taskId);
      if (!task) return;
      const key = activeTaskCard.dataset.readinessKey || '';
      task.readiness = task.readiness || {};
      task.readiness[key] = (activeTaskCard.dataset.completedSteps || '').split(',').filter(Boolean).map(Number);
      autoStage(task);
      saveTaskToFirestore(task).then(() => window.renderDashboardTasks()).catch((error) => alert('فشل تحديث تفاصيل التاسك في Firebase: ' + (error?.message || error?.code || error)));
    }, 0);
  });

  document.addEventListener('click', async function(event){
    const receive = event.target.closest('[data-receive-task]');
    if (!receive) return;
    const tasks = readTasks();
    const task = tasks.find(t => String(t.id) === String(receive.dataset.taskId));
    if (!task) return;
    const current = user();
    const identity = String(receive.dataset.deptIdentity || '');
    const dept = (task.departmentTasks || []).find((d) => String(deptIdentity(d)) === identity);
    if (!dept) return;
    if (!assignedToCurrentUser(dept, current)) {
      alert('التاسك ده مش مسند لحسابك.');
      return;
    }
    dept.receivedConfirmed = true;
    dept.received = true;
    dept.receivedAt = new Date().toISOString();
    dept.receiveDate = new Date().toISOString().slice(0,10);
    dept.receivedBy = current?.email || current?.uid || current?.id || current?.name || '';
    task.receiptProgress = taskReceiptProgress(task);
    task.receiveProgress = task.receiptProgress;
    task.receiveDoneCount = (task.departmentTasks || []).filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
    task.receiveTotalCount = (task.departmentTasks || []).filter((d) => d && d.enabled !== false).length;
    try {
      await saveTaskToFirestore(task);
      window.renderDashboardTasks();
    } catch (error) {
      alert('فشل تأكيد الاستلام في Firebase: ' + (error?.message || error?.code || error));
    }
  });

  document.addEventListener('click', async function(event){
    const del = event.target.closest('[data-delete-task]');
    if (!del) return;
    if (!userIsAdmin()) return;
    const ok = confirm('تأكيد مسح الحملة/الأجندة من الداش بورد وقاعدة البيانات؟');
    if (!ok) return;
    await deleteTaskEverywhere(del.dataset.deleteTask);
    window.renderDashboardTasks();
    if (typeof window.renderCampaignRecordsLive === 'function') window.renderCampaignRecordsLive();
  });

  document.addEventListener('input', function(event){
    if (event.target && event.target.id === 'dashboardTaskSearch') {
      window.renderDashboardTasks?.();
    }
  });

  document.addEventListener('click', function(event){
    const refresh = event.target.closest('#dashboardRefreshBtn');
    if (!refresh) return;
    refreshWorkspaceTasksFromFirestore?.();
    setTimeout(window.renderDashboardTasks, 250);
  });

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(window.renderDashboardTasks, 120);
    setTimeout(refreshWorkspaceTasksFromFirestore, 250);
  });
})();
