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

function getDriveUploadEndpoint() {
  // على Vercel نستخدم API Proxy من نفس الدومين حتى نقدر نقرأ رد Apps Script ونحفظ رابط الملف.
  // لو فتحت المشروع محليًا أو خارج Vercel يرجع للرابط المباشر الموجود في firebase-config.js.
  if (location.hostname && location.hostname.includes('vercel.app')) {
    return '/api/zoho-upload';
  }
  return getDriveUploadWebAppUrl();
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

function taskCampaignInfoValue(task, keys, fallback = '—') {
  for (const key of keys) {
    const value = task?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return fallback;
}

function renderTaskCampaignInfoBox(task) {
  const rows = [
    ['التاريخ', taskCampaignInfoValue(task, ['taskDate','date','launchDate'])],
    ['كود الحملة', taskCampaignInfoValue(task, ['campaignCode','code','campaignSerial'])],
    ['اسم الحملة', taskCampaignInfoValue(task, ['campaignName','name','title','templateName'])],
    ['نوع الحملة', taskCampaignInfoValue(task, ['taskTypeLabel','campaignType','taskType','type'])],
    ['الهدف من الحملة', taskCampaignInfoValue(task, ['campaignGoal','goal','objective','campaignObjective'])],
    ['تاريخ بداية الحملة', taskCampaignInfoValue(task, ['campaignStartDate','startDate'])],
    ['تاريخ نهاية الحملة', taskCampaignInfoValue(task, ['campaignEndDate','endDate'])]
  ];
  const escFn = typeof escapeHTML === 'function'
    ? escapeHTML
    : (value) => String(value || '').replace(/[&<>"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  return `<section class="task-campaign-info-box" data-task-campaign-info-box>
    <div class="task-campaign-info-title">بيانات الحملة</div>
    <div class="task-campaign-info-grid">
      ${rows.map(([label, value]) => `<div><small>${escFn(label)}</small><strong>${escFn(value)}</strong></div>`).join('')}
    </div>
  </section>`;
}


function isAdminUser() {
  return ['admin','marketing_manager'].includes(getCurrentUserRole());
}

function syncTaskProgress() {
  if (!taskStepButtons) return;

  const blocks = Array.from(taskStepButtons.querySelectorAll('[data-assignment-step-block]'));
  if (blocks.length) {
    let taskTotal = 0;
    let campaignTotal = 0;

    blocks.forEach((block) => {
      const buttons = Array.from(block.querySelectorAll('.task-step-btn'));
      const activeButtons = buttons.filter((btn) => btn.classList.contains('is-done'));
      const taskPercent = Math.min(100, Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.stepValue || 0), 0)));
      const campaignPercent = Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.campaignValue || 0), 0));
      const percentNode = block.querySelector('[data-assignment-task-percent]');
      const campaignNode = block.querySelector('[data-assignment-campaign-percent]');
      if (percentNode) percentNode.textContent = taskPercent + '%';
      if (campaignNode) campaignNode.textContent = campaignPercent + '%';
      taskTotal += taskPercent;
      campaignTotal += campaignPercent;
      if (activeTaskCard && block.dataset.readinessKey === activeTaskCard.dataset.readinessKey) {
        activeTaskCard.dataset.completedSteps = activeButtons.map((btn) => btn.dataset.stepIndex).join(',');
      }
    });

    const taskPercent = Math.round(taskTotal / Math.max(blocks.length, 1));
    const campaignPercent = Math.round(campaignTotal);
    if (modalTaskPercent) modalTaskPercent.textContent = taskPercent + '%';
    if (modalCampaignPercent) modalCampaignPercent.textContent = campaignPercent + '%';
    taskStepButtons.querySelectorAll('[data-modal-task-percent]').forEach((node) => node.textContent = taskPercent + '%');
    taskStepButtons.querySelectorAll('[data-modal-campaign-percent]').forEach((node) => node.textContent = campaignPercent + '%');
    taskStepButtons.querySelectorAll('[data-switch-total-task-percent]').forEach((node) => node.textContent = taskPercent + '%');
    taskStepButtons.querySelectorAll('[data-switch-total-campaign-percent]').forEach((node) => node.textContent = campaignPercent + '%');

    if (activeTaskCard) {
      const taskPercentNode = activeTaskCard.querySelector('[data-task-percent]');
      const campaignPercentNode = activeTaskCard.querySelector('[data-campaign-percent]');
      const bar = activeTaskCard.querySelector('[data-task-bar]');
      if (taskPercentNode) taskPercentNode.textContent = taskPercent + '%';
      if (campaignPercentNode) campaignPercentNode.textContent = campaignPercent + '%';
      if (bar) bar.style.width = taskPercent + '%';
    }
    return;
  }

  const allButtons = Array.from(taskStepButtons.querySelectorAll('.task-step-btn'));
  const activeButtons = allButtons.filter((btn) => btn.classList.contains('is-done'));
  const taskPercent = Math.min(100, Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.stepValue || 0), 0)));
  const campaignPercent = Math.round(activeButtons.reduce((sum, btn) => sum + Number(btn.dataset.campaignValue || 0), 0));

  if (modalTaskPercent) modalTaskPercent.textContent = taskPercent + '%';
  if (modalCampaignPercent) modalCampaignPercent.textContent = campaignPercent + '%';
  taskStepButtons.querySelectorAll('[data-modal-task-percent]').forEach((node) => node.textContent = taskPercent + '%');
  taskStepButtons.querySelectorAll('[data-modal-campaign-percent]').forEach((node) => node.textContent = campaignPercent + '%');
  taskStepButtons.querySelectorAll('[data-switch-total-task-percent]').forEach((node) => node.textContent = taskPercent + '%');
  taskStepButtons.querySelectorAll('[data-switch-total-campaign-percent]').forEach((node) => node.textContent = campaignPercent + '%');

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
    return deptTask.photoItems.map((item, index) => `مطلوب ${index + 1}: نوع السيارة: ${item.carType || '—'} — نوع المحتوى: ${item.contentType || '—'}`).join('\n');
  }
  if ((kind === 'design' || kind === 'montage') && Array.isArray(deptTask.selectedDeliverables) && deptTask.selectedDeliverables.length) {
    const text = deptTask.selectedDeliverables.map((item, index) => `مطلوب ${index + 1}: ${item.title || item.name || '—'} — ${item.desc || item.details || ''}`).join('\n');
    return [text, deptTask.requiredText].filter(Boolean).join(' | ملاحظات: ');
  }
  return deptTask.requiredText || deptTask.deliveryDetails || deptTask.required || 'لا يوجد مطلوب مكتوب';
}

function departmentTaskShortName(deptTask) {
  if (!deptTask) return 'تكليف بدون اسم';
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const unique = (items) => {
    const seen = new Set();
    return items.map(clean).filter(Boolean).filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const taskNo = clean(deptTask.taskNo || deptTask.contentTaskId || deptTask.taskCode);
  const direct = clean(deptTask.taskName || deptTask.requiredTaskName || deptTask.contentType || deptTask.deliverable || deptTask.title || deptTask.taskTitle || deptTask.name);
  if (direct && taskNo && direct !== taskNo) return `${direct} — ${taskNo}`;
  if (direct) return direct;
  if (taskNo) return taskNo;

  if (Array.isArray(deptTask.selectedDeliverables) && deptTask.selectedDeliverables.length) {
    const labels = unique(deptTask.selectedDeliverables.map((item) => item?.title || item?.name || item?.deliverable));
    if (labels.length) return labels.slice(0, 2).join(' + ') + (labels.length > 2 ? ` +${labels.length - 2}` : '');
  }

  if (Array.isArray(deptTask.photoItems) && deptTask.photoItems.length) {
    const labels = unique(deptTask.photoItems.map((item) => item?.contentType || item?.carType));
    if (labels.length) return labels.slice(0, 2).join(' + ') + (labels.length > 2 ? ` +${labels.length - 2}` : '');
  }

  if (Array.isArray(deptTask.contentItems) && deptTask.contentItems.length) {
    const labels = unique(deptTask.contentItems.map((item) => item?.contentType || item?.carType || item?.requiredText));
    if (labels.length) return labels.slice(0, 2).join(' + ') + (labels.length > 2 ? ` +${labels.length - 2}` : '');
  }

  const requirement = clean(deptTask.requiredText || deptTask.deliveryDetails || deptTask.required || '');
  const labelPatterns = [
    /نوع المحتوى\s*:?\s*([^|—]+)/i,
    /مطلوب\s*\d+\s*:?\s*([^|—]+)/i,
    /المطلوب\s*:?\s*([^|—]+)/i,
    /وصف المحتوى\s*:?\s*([^|—]+)/i
  ];
  for (const pattern of labelPatterns) {
    const match = requirement.match(pattern);
    if (match && clean(match[1])) return clean(match[1]).slice(0, 55);
  }
  if (requirement) return requirement.length > 45 ? requirement.slice(0, 45) + '...' : requirement;
  return 'تكليف بدون اسم';
}



function mzjSplitMultiValue(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return text.split(/\s*،\s*/g).map((item) => item.trim()).filter(Boolean);
}

function mzjUniqueStrings(items) {
  const seen = new Set();
  return (items || []).map((item) => String(item || '').replace(/\s+/g, ' ').trim()).filter(Boolean).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDepartmentContentItems(deptTask) {
  const directSources = [];
  if (Array.isArray(deptTask?.contentItems)) directSources.push(...deptTask.contentItems);
  if (Array.isArray(deptTask?.photoItems)) directSources.push(...deptTask.photoItems);
  if (Array.isArray(deptTask?.requiredDetails?.items)) directSources.push(...deptTask.requiredDetails.items);
  if (Array.isArray(deptTask?.selectedDeliverables)) {
    deptTask.selectedDeliverables.forEach((item) => directSources.push({
      contentType: item?.contentType || item?.title || item?.name || item?.deliverable || '',
      carType: item?.carType || '',
      requiredText: item?.requiredText || item?.details || item?.desc || '',
      printSize: item?.printSize || ''
    }));
  }

  let items = directSources.map((item) => ({
    contentType: String(item?.contentType || item?.title || item?.name || item?.deliverable || '').trim(),
    carType: String(item?.carType || item?.car || item?.vehicle || '').trim(),
    requiredText: String(item?.requiredText || item?.notes || item?.details || '').trim(),
    printSize: String(item?.printSize || item?.size || '').trim(),
    details: String(item?.details || item?.desc || '').trim()
  })).filter((item) => item.contentType || item.carType || item.requiredText || item.printSize || item.details);

  if (!items.length) {
    const cars = mzjSplitMultiValue(deptTask?.carType);
    const types = mzjSplitMultiValue(deptTask?.contentType);
    const requiredText = String(deptTask?.requiredText || deptTask?.deliveryDetails || deptTask?.required || '').trim();
    const carList = cars.length ? cars : [''];
    const typeList = types.length ? types : [''];
    carList.forEach((car) => {
      typeList.forEach((type) => {
        if (car || type || requiredText) items.push({ carType: car, contentType: type, requiredText, printSize: String(deptTask?.printSize || '').trim(), details: '' });
      });
    });
  }

  const seen = new Set();
  return items.filter((item) => {
    const key = [item.contentType, item.carType, item.requiredText, item.printSize].map((v) => String(v || '').trim().toLowerCase()).join('::');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDepartmentTaskSummary(deptTask) {
  const items = normalizeDepartmentContentItems(deptTask);
  const taskName = String(deptTask?.taskName || deptTask?.requiredTaskName || deptTask?.taskTitle || deptTask?.title || deptTask?.name || '').trim() || departmentTaskShortName(deptTask);
  const deptName = String(deptTask?.departmentName || '').trim();
  const assignee = String(deptTask?.userName || deptTask?.userDisplayName || deptTask?.assigneeName || deptTask?.responsible || deptTask?.userEmail || deptTask?.assigneeEmail || '').trim();
  const cars = mzjUniqueStrings([
    ...items.map((item) => item?.carType),
    ...mzjSplitMultiValue(deptTask?.carType)
  ].map((value) => String(value || '').trim()).filter(Boolean));
  const contentTypes = mzjUniqueStrings([
    ...items.map((item) => item?.contentType),
    ...mzjSplitMultiValue(deptTask?.contentType)
  ].map((value) => String(value || '').trim()).filter(Boolean));
  const requiredParts = mzjUniqueStrings([
    ...items.map((item) => item?.requiredText || item?.details),
    deptTask?.requiredText,
    deptTask?.deliveryDetails,
    deptTask?.required,
    deptTask?.notes
  ].map((value) => String(value || '').replace(/^اسم التاسك\s*:\s*.*$/gmi, '').trim()).filter(Boolean));
  return { taskName, deptName, assignee, cars, contentTypes, requiredParts };
}

function cleanTaskRequiredDisplayText(value) {
  let text = String(value || '').replace(/\r/g, '\n').trim();
  if (!text) return '';
  const cleanLines = text.split(/\n+/g).map((line) => {
    let item = String(line || '').trim();
    if (!item) return '';
    item = item.replace(/^اسم\s+التاسك\s*:\s*.*$/i, '').trim();
    if (!item) return '';
    const requiredMatch = item.match(/(?:^|[—\-–])\s*المطلوب\s*:\s*([\s\S]*?)(?=\s*[—\-–]\s*(?:السيارة|نوع\s+المحتوى|المقاس)\s*:|$)/i);
    if (requiredMatch) item = requiredMatch[1].trim();
    item = item
      .replace(/^مطلوب\s*\d+\s*[—\-–]?\s*/i, '')
      .replace(/^المطلوب\s*:?\s*/i, '')
      .trim();
    if (/^(?:السيارة|نوع\s+المحتوى|المقاس)\s*:/i.test(item)) return '';
    if (/\s[—\-–]\s*(?:السيارة|نوع\s+المحتوى|المقاس)\s*:/i.test(item)) {
      item = item.split(/\s[—\-–]\s*(?:السيارة|نوع\s+المحتوى|المقاس)\s*:/i)[0].trim();
    }
    return item;
  }).filter(Boolean);
  return mzjUniqueStrings(cleanLines).join('\n');
}

function taskDetailsRawSources(deptTask) {
  const values = [];
  const visit = (value, depth = 0) => {
    if (depth > 5 || value === undefined || value === null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      const clean = String(value || '').trim();
      if (clean) values.push(clean);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(deptTask || {});
  return mzjUniqueStrings(values);
}

function mzjArrayFromAny(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return mzjSplitMultiValue(value);
}


function taskFieldList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.flatMap(taskFieldList);
  }
  if (typeof value === 'object') {
    return taskFieldList(value.title || value.name || value.value || value.label || value.contentType || value.carType || value.car || value.vehicle || value.deliverable || value.display || '');
  }
  return mzjSplitMultiValue(String(value || '')).map((item) => item.trim()).filter(Boolean);
}

function normalizeSelectedContentTypeList(value) {
  return taskFieldList(value).map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeSelectedCarList(value) {
  return taskFieldList(value).map((item) => String(item || '').trim()).filter(Boolean);
}

function collectExplicitTaskValues(source, mode) {
  const values = [];
  const keyMatchers = mode === 'car'
    ? [/car/i, /vehicle/i, /سيارة/i, /سيارات/i]
    : [/contenttype/i, /content_type/i, /deliverable/i, /نوع.?المحتوى/i, /نوع.?المحتوي/i];
  const blockedKeys = mode === 'content'
    ? [/required/i, /notes/i, /details/i, /manual/i, /delivery/i, /المطلوب/i, /ملاحظات/i]
    : [/required/i, /notes/i, /manual/i, /delivery/i, /المطلوب/i, /نوع.?المحتوى/i, /نوع.?المحتوي/i];
  const pushValue = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    if (typeof value === 'object') {
      if (mode === 'content') {
        pushValue(value.title || value.name || value.value || value.label || value.contentType || value.deliverable);
      } else {
        pushValue(value.display || value.name || value.title || value.value || value.label || value.carType || value.car || value.vehicle);
      }
      return;
    }
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (clean) values.push(clean);
  };
  const visit = (obj, depth = 0) => {
    if (!obj || depth > 6) return;
    if (Array.isArray(obj)) {
      obj.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof obj !== 'object') return;
    Object.entries(obj).forEach(([key, value]) => {
      const keyText = String(key || '');
      if (keyMatchers.some((rx) => rx.test(keyText)) && !blockedKeys.some((rx) => rx.test(keyText))) pushValue(value);
      if (value && typeof value === 'object') visit(value, depth + 1);
    });
  };
  visit(source || {});
  return mzjUniqueStrings(values);
}

function parseCarsFromTaskText(value) {
  const text = String(value || '').replace(/\r/g, '\n').trim();
  if (!text) return [];
  const found = [];
  text.split(/\n+/g).forEach((line) => {
    let item = String(line || '').trim();
    if (!item) return;
    const labeled = item.match(/(?:السيارة|السيارات|نوع\s+السيارة)\s*:?[\sـ-]*([\s\S]*?)(?=\s*[—–]\s*(?:نوع\s+المحتوى|المقاس|المطلوب)\s*:|$)/i);
    if (labeled && labeled[1]) found.push(labeled[1].trim());
    const beforeType = item.match(/^([\s\S]+?)\s*[—–]\s*نوع\s+المحتوى\s*:/i);
    if (!labeled && beforeType && beforeType[1] && !/المطلوب\s*:/i.test(beforeType[1])) found.push(beforeType[1].trim());
  });
  return mzjUniqueStrings(found.map((car) => car.replace(/^مطلوب\s*\d+\s*[—\-–]?\s*/i, '').trim()).filter(Boolean));
}

function parseContentTypesFromTaskText(value) {
  const text = String(value || '').replace(/\r/g, '\n').trim();
  if (!text) return [];
  const found = [];
  text.split(/\n+/g).forEach((line) => {
    const match = String(line || '').match(/نوع\s+المحتوى\s*:?[\sـ-]*([\s\S]*?)(?=\s*(?:مطلوب\s*\d+|[—–]\s*(?:المطلوب|السيارة|المقاس)\s*:)|$)/i);
    if (match && match[1]) found.push(match[1].trim());
  });
  return mzjUniqueStrings(found.filter(Boolean));
}


function mergeTaskDetailDeptData(primary, secondary) {
  const a = primary && typeof primary === 'object' ? primary : {};
  const b = secondary && typeof secondary === 'object' ? secondary : {};
  const merged = { ...a, ...b };
  const uniqueObjects = (items) => {
    const seen = new Set();
    return (items || []).filter((item) => item && typeof item === 'object').filter((item) => {
      const key = JSON.stringify(item, Object.keys(item).sort());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const combineStringList = (key) => mzjUniqueStrings([
    ...taskFieldList(a?.[key]),
    ...taskFieldList(b?.[key])
  ]);
  ['selectedCars','selectedCarValues','selectedContentTypes','selectedContentTypeTitles'].forEach((key) => {
    const arr = combineStringList(key);
    if (arr.length) merged[key] = arr;
  });
  ['contentItems','photoItems','selectedDeliverables'].forEach((key) => {
    const arr = uniqueObjects([
      ...(Array.isArray(a?.[key]) ? a[key] : []),
      ...(Array.isArray(b?.[key]) ? b[key] : [])
    ]);
    if (arr.length) merged[key] = arr;
  });
  merged.requiredDetails = { ...(a.requiredDetails || {}), ...(b.requiredDetails || {}) };
  ['selectedCars','selectedCarValues','selectedContentTypes','selectedContentTypeTitles'].forEach((key) => {
    const arr = mzjUniqueStrings([
      ...taskFieldList(a.requiredDetails?.[key]),
      ...taskFieldList(b.requiredDetails?.[key])
    ]);
    if (arr.length) merged.requiredDetails[key] = arr;
  });
  ['items','deliverables'].forEach((key) => {
    const arr = uniqueObjects([
      ...(Array.isArray(a.requiredDetails?.[key]) ? a.requiredDetails[key] : []),
      ...(Array.isArray(b.requiredDetails?.[key]) ? b.requiredDetails[key] : [])
    ]);
    if (arr.length) merged.requiredDetails[key] = arr;
  });
  const preferText = (key) => {
    const av = String(a?.[key] || '').trim();
    const bv = String(b?.[key] || '').trim();
    return bv || av || '';
  };
  ['carType','contentType','requiredText','deliveryDetails','notes','taskName','requiredTaskName','departmentName','departmentId','userName','userDisplayName','userEmail','assigneeName','assigneeEmail','assigneeUid','userId','userUid','assignmentIndex','targetDepartmentId','targetDepartmentName'].forEach((key) => {
    const value = preferText(key);
    if (value) merged[key] = value;
  });
  return merged;
}


function mzjPickStringListFromObject(source, mode) {
  const values = [];
  const carKeys = new Set(['selectedCars','selectedCarValues','chosenCars','cars','carType','car','vehicle','vehicles','__selectedCarsFromButton']);
  const typeKeys = new Set(['selectedContentTypes','selectedContentTypeTitles','chosenContentTypes','contentTypes','contentType','contentTypeTitle','deliverable','title','name','__selectedContentTypesFromButton']);
  const blockedForType = /required|notes|details|manual|delivery|المطلوب|ملاحظات/i;
  const blockedForCar = /required|notes|manual|delivery|المطلوب|contentType|نوع.?المحتوى|نوع.?المحتوي/i;
  const push = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) { value.forEach(push); return; }
    if (typeof value === 'object') {
      if (mode === 'car') push(value.carType || value.car || value.vehicle || value.value || value.label || value.title || value.name || value.display);
      else push(value.contentType || value.contentTypeTitle || value.title || value.name || value.deliverable || value.value || value.label);
      return;
    }
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (clean && clean !== '—' && clean !== '-') values.push(clean);
  };
  const visit = (obj, depth = 0) => {
    if (!obj || depth > 8) return;
    if (Array.isArray(obj)) { obj.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof obj !== 'object') return;
    Object.entries(obj).forEach(([key, value]) => {
      const k = String(key || '');
      if (mode === 'car') {
        if ((carKeys.has(k) || /car|vehicle|سيارة|سيارات/i.test(k)) && !blockedForCar.test(k)) push(value);
      } else {
        if ((typeKeys.has(k) || /content.?type|deliverable|نوع.?المحتوى|نوع.?المحتوي/i.test(k)) && !blockedForType.test(k)) push(value);
      }
      if (value && typeof value === 'object') visit(value, depth + 1);
    });
  };
  visit(source || {});
  return mzjUniqueStrings(values);
}

function mzjCleanSelectionValues(values, requiredLines) {
  const blocked = new Set((requiredLines || []).map((v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean));
  return mzjUniqueStrings((values || []).map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter((value) => {
    if (!value || value === '—' || value === '-') return false;
    const key = value.toLowerCase();
    if (blocked.has(key)) return false;
    if (/^مطلوب\s*\d+/i.test(value) || /^المطلوب\s*:?/i.test(value)) return false;
    return true;
  }));
}

function renderTaskDetailsSummary(deptTask, deptKeyValue) {
  const safeTask = deptTask || {};
  const items = normalizeDepartmentContentItems(safeTask);

  const directRequiredSources = [
    safeTask?.requiredDetails?.manualRequired,
    safeTask?.requiredDetails?.requiredText,
    safeTask?.requiredDetails?.notes,
    safeTask?.notes,
    safeTask?.requiredText,
    safeTask?.deliveryDetails,
    safeTask?.required,
    ...(Array.isArray(safeTask?.contentItems) ? safeTask.contentItems.map((item) => item?.requiredText || item?.manualRequired || item?.notes) : []),
    ...(Array.isArray(safeTask?.photoItems) ? safeTask.photoItems.map((item) => item?.requiredText || item?.manualRequired || item?.notes) : []),
    ...(Array.isArray(safeTask?.requiredDetails?.items) ? safeTask.requiredDetails.items.map((item) => item?.requiredText || item?.manualRequired || item?.notes) : [])
  ];
  const lines = mzjUniqueStrings(directRequiredSources.map(cleanTaskRequiredDisplayText).filter(Boolean));
  const requiredKeys = new Set(lines.map((v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean));

  const cleanSelection = (values) => mzjUniqueStrings((values || []).flatMap(taskFieldList).map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter((value) => {
    if (!value || value === '—' || value === '-') return false;
    const key = value.toLowerCase();
    if (requiredKeys.has(key)) return false;
    if (/^مطلوب\s*\d+/i.test(value) || /^المطلوب\s*:?/i.test(value)) return false;
    if (/^rct_\d+/i.test(value) || /^tpl_\d+/i.test(value) || /^task_\d+/i.test(value)) return false;
    return true;
  }));

  // IMPORTANT: use the exact saved selection fields first. Do not derive display values from
  // `details` strings because those can contain mixed text like "السيارة: ... — المطلوب".
  let cars = cleanSelection([
    safeTask?.__selectedCarsFromButton,
    safeTask?.selectedCars,
    safeTask?.selectedCarValues,
    safeTask?.requiredDetails?.selectedCars,
    safeTask?.requiredDetails?.selectedCarValues
  ]);
  if (!cars.length) {
    cars = cleanSelection([
      safeTask?.carType,
      safeTask?.requiredDetails?.carType,
      ...(Array.isArray(safeTask?.contentItems) ? safeTask.contentItems.map((item) => item?.carType) : []),
      ...(Array.isArray(safeTask?.photoItems) ? safeTask.photoItems.map((item) => item?.carType) : []),
      ...(Array.isArray(safeTask?.requiredDetails?.items) ? safeTask.requiredDetails.items.map((item) => item?.carType) : []),
      ...(Array.isArray(safeTask?.requiredDetails?.deliverables) ? safeTask.requiredDetails.deliverables.map((item) => item?.carType) : []),
      ...items.map((item) => item?.carType)
    ]);
  }

  let contentTypes = cleanSelection([
    safeTask?.__selectedContentTypesFromButton,
    safeTask?.selectedContentTypes,
    safeTask?.selectedContentTypeTitles,
    safeTask?.requiredDetails?.selectedContentTypes,
    safeTask?.requiredDetails?.selectedContentTypeTitles
  ]);
  if (!contentTypes.length) {
    contentTypes = cleanSelection([
      safeTask?.contentType,
      safeTask?.requiredDetails?.contentType,
      ...(Array.isArray(safeTask?.contentItems) ? safeTask.contentItems.map((item) => item?.contentType || item?.title) : []),
      ...(Array.isArray(safeTask?.photoItems) ? safeTask.photoItems.map((item) => item?.contentType || item?.title) : []),
      ...(Array.isArray(safeTask?.requiredDetails?.items) ? safeTask.requiredDetails.items.map((item) => item?.contentType || item?.title) : []),
      ...(Array.isArray(safeTask?.requiredDetails?.deliverables) ? safeTask.requiredDetails.deliverables.map((item) => item?.contentType || item?.title) : []),
      ...items.map((item) => item?.contentType)
    ]);
  }

  const quantityMap = Object.assign({},
    safeTask?.contentTypeQuantities || {},
    safeTask?.selectedContentTypeQuantities || {},
    safeTask?.requiredDetails?.contentTypeQuantities || {},
    safeTask?.requiredDetails?.selectedContentTypeQuantities || {}
  );
  const quantityItems = [
    ...(Array.isArray(safeTask?.contentItems) ? safeTask.contentItems : []),
    ...(Array.isArray(safeTask?.photoItems) ? safeTask.photoItems : []),
    ...(Array.isArray(safeTask?.selectedDeliverables) ? safeTask.selectedDeliverables : []),
    ...(Array.isArray(safeTask?.requiredDetails?.items) ? safeTask.requiredDetails.items : []),
    ...(Array.isArray(safeTask?.requiredDetails?.deliverables) ? safeTask.requiredDetails.deliverables : []),
    ...items
  ];
  quantityItems.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const title = String(entry.contentType || entry.title || entry.name || '').trim();
    const qty = String(entry.quantity || entry.qty || entry.count || entry.requiredCount || entry.requiredQuantity || '').trim();
    if (title && qty && !quantityMap[title]) quantityMap[title] = qty;
  });
  const typeDisplayLines = contentTypes.map((type) => {
    const key = String(type || '').trim();
    const qty = String(quantityMap[key] || '').trim();
    return qty ? `${key} — العدد: ${qty}` : key;
  });

  const requiredHtml = `<section class="task-details-required-only"><small>المطلوب</small>${lines.length ? lines.map((item) => `<p>${escapeHTML(item)}</p>`).join('') : '<p>لا يوجد مطلوب مكتوب</p>'}</section>`;
  const carsHtml = `<section class="task-details-meta-lines"><small>السيارة المختارة</small>${cars.length ? cars.map((car) => `<p class="task-detail-car-line">${escapeHTML(car)}</p>`).join('') : '<p>—</p>'}</section>`;
  const typesHtml = `<section class="task-details-meta-lines"><small>نوع المحتوى</small>${typeDisplayLines.length ? typeDisplayLines.map((type) => `<p>${escapeHTML(type)}</p>`).join('') : '<p>—</p>'}</section>`;
  return `<div class="task-details-clean-stack">${requiredHtml}${carsHtml}${typesHtml}</div>`;
}

function renderStructuredDepartmentRequirement(deptTask, deptKeyValue) {
  const items = normalizeDepartmentContentItems(deptTask);
  const taskName = String(deptTask?.taskName || deptTask?.requiredTaskName || deptTask?.taskTitle || deptTask?.title || '').trim();
  const deptName = String(deptTask?.departmentName || '').trim();
  const assignee = String(deptTask?.userName || deptTask?.userDisplayName || deptTask?.assigneeName || deptTask?.responsible || deptTask?.userEmail || deptTask?.assigneeEmail || '').trim();
  const baseNotes = mzjUniqueStrings([deptTask?.notes, deptTask?.deliveryDetails, deptTask?.requiredText].map((v) => String(v || '').replace(/^اسم التاسك\s*:\s*.*$/gmi,'').trim()));
  if (!items.length && !taskName && !baseNotes.length) return '';
  const groups = new Map();
  items.forEach((item) => {
    const type = item.contentType || deptTask?.contentType || 'مطلوب';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(item);
  });
  if (!groups.size) groups.set(deptTask?.contentType || 'مطلوب', []);
  const header = `<section class="user-task-brief-card">
    <div><small>اسم التاسك</small><strong>${escapeHTML(taskName || departmentTaskShortName(deptTask))}</strong></div>
    ${deptName ? `<div><small>القسم</small><strong>${escapeHTML(deptName)}</strong></div>` : ''}
    ${assignee ? `<div><small>المسؤول</small><strong>${escapeHTML(assignee)}</strong></div>` : ''}
  </section>`;
  const html = Array.from(groups.entries()).map(([type, groupItems]) => {
    const cars = mzjUniqueStrings(groupItems.map((item) => item.carType).filter(Boolean));
    const notes = mzjUniqueStrings(groupItems.map((item) => item.requiredText).concat(baseNotes).filter((text) => text && !/^اسم التاسك\s*:/i.test(text)));
    const sizes = mzjUniqueStrings(groupItems.map((item) => item.printSize));
    return `<article class="content-type-detail-card clean-task-detail-card">
      <div class="content-type-detail-head">
        <strong>${escapeHTML(type || 'مطلوب')}</strong>
        ${cars.length ? `<span>${cars.length} سيارة</span>` : ''}
      </div>
      ${cars.length ? `<div class="content-type-car-list">${cars.map((car) => `<span class="content-type-car-chip full-car-name">${escapeHTML(car)}</span>`).join('')}</div>` : ''}
      ${sizes.length ? `<div class="content-type-size-list"><small>المقاس</small><b>${escapeHTML(sizes.join('، '))}</b></div>` : ''}
      ${notes.length ? `<div class="content-type-notes"><small>المطلوب</small>${notes.map((note) => `<p>${escapeHTML(note)}</p>`).join('')}</div>` : ''}
    </article>`;
  }).join('');
  return `${header}<div class="content-type-detail-grid">${html}</div>`;
}

function renderTaskRequirementDetails(requiredText, deptKeyValue) {
  const clean = String(requiredText || '').trim();
  if (!clean) return '<span class="task-required-line">لا يوجد مطلوب مكتوب</span>';
  const safe = (value) => escapeHTML(value);
  const splitRequirementParts = (text) => String(text || '')
    .split(/\n|\r/g)
    .map(x => x.trim())
    .filter(Boolean);
  const parts = splitRequirementParts(clean);

  if (deptKeyValue === 'shooting') {
    const looksLikePhotoItems = parts.some((part) => /نوع السيارة|نوع المحتوى/.test(part));
    const looksLikeCampaignDetails = parts.some((part) => /الهدف|الفكرة|وصف المحتوى|المطلوب من الكاتب|CTA/.test(part));
    if (looksLikePhotoItems && !looksLikeCampaignDetails) {
      const rows = parts.map((part, index) => {
        const carMatch = part.match(/نوع السيارة\s*:?\s*(.+?)(?:\s+—\s+نوع المحتوى|$)/);
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
  }

  const labelMap = [
    { key: 'taskNo', label: 'رقم التاسك', patterns: ['رقم التاسك', 'رقم المهمة'] },
    { key: 'contentType', label: 'نوع المحتوى', patterns: ['نوع المحتوى'] },
    { key: 'goal', label: 'الهدف', patterns: ['الهدف'] },
    { key: 'tangibleGoal', label: 'الهدف الملموس', patterns: ['الهدف الملموس'] },
    { key: 'idea', label: 'الفكرة', patterns: ['الفكرة'] },
    { key: 'description', label: 'وصف المحتوى', patterns: ['وصف المحتوى', 'وصف المحتوي'] },
    { key: 'message', label: 'الرسالة', patterns: ['الرسالة'] },
    { key: 'writerRequest', label: 'المطلوب من الكاتب', patterns: ['المطلوب من اليوزر / المطلوب من الكاتب', 'المطلوب من الكاتب', 'المطلوب من اليوزر'] },
    { key: 'cta', label: 'CTA', patterns: ['CTA'] }
  ];
  const labeledRows = [];
  const usedParts = new Set();

  labelMap.forEach((field) => {
    const foundIndex = parts.findIndex((part, index) => {
      if (usedParts.has(index)) return false;
      return field.patterns.some((pattern) => part.trim().startsWith(pattern + ':') || part.trim().startsWith(pattern + ' :'));
    });
    if (foundIndex === -1) return;
    const part = parts[foundIndex];
    usedParts.add(foundIndex);
    const splitIndex = part.indexOf(':');
    const value = splitIndex >= 0 ? part.slice(splitIndex + 1).trim() : part;
    if (!value) return;
    labeledRows.push({ label: field.label, value });
  });

  if (labeledRows.length < 3) {
    const markers = labelMap.flatMap((field) => field.patterns.map((pattern) => ({ label: field.label, pattern })));
    const hits = [];
    markers.forEach(({ label, pattern }) => {
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|\\s)${escapedPattern}\\s*:`, 'u');
      const match = clean.match(re);
      if (match) hits.push({ label, pattern, index: match.index + (match[1] ? match[1].length : 0) });
    });
    hits.sort((a, b) => a.index - b.index);
    const uniqueHits = [];
    const seenLabels = new Set();
    hits.forEach((hit) => {
      if (seenLabels.has(hit.label)) return;
      seenLabels.add(hit.label);
      uniqueHits.push(hit);
    });
    if (uniqueHits.length >= 3) {
      labeledRows.length = 0;
      uniqueHits.forEach((hit, index) => {
        const start = hit.index + hit.pattern.length;
        const colonIndex = clean.indexOf(':', start);
        const valueStart = colonIndex >= 0 ? colonIndex + 1 : start;
        const end = index + 1 < uniqueHits.length ? uniqueHits[index + 1].index : clean.length;
        const value = clean.slice(valueStart, end).replace(/^\s*[-–—|]*\s*/, '').trim();
        if (value) labeledRows.push({ label: hit.label, value });
      });
    }
  }

  if (labeledRows.length >= 3) {
    return `<div class="campaign-task-details-list">${labeledRows.map((row) => `
      <article class="campaign-task-detail-row">
        <strong>${safe(row.label)}</strong>
        <p>${safe(row.value)}</p>
      </article>`).join('')}</div>`;
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

function buildZohoFileUrlFromRecord(file) {
  if (!file || typeof file !== 'object') return '';

  const existingUrl =
    file.fileUrl ||
    file.url ||
    file.webViewLink ||
    file.viewUrl ||
    file.attachmentUrl ||
    file.link ||
    file.permalink ||
    file.downloadUrl ||
    '';

  if (existingUrl) return existingUrl;

  const fileId =
    file.fileId ||
    file.id ||
    file.resource_id ||
    file.resourceId ||
    '';

  if (!fileId) return '';

  return `https://workdrive.zoho.sa/file/${encodeURIComponent(fileId)}`;
}

function normalizeTaskFileRecord(file, index) {
  if (!file) return null;

  if (typeof file === 'string') {
    if (isAttachmentActionLabel(file)) return null;
    return { name: file, fileName: file, url: file, fileUrl: file, index };
  }

  const url = buildZohoFileUrlFromRecord(file);
  const rawName = file.fileName || file.name || file.title || file.label || '';

  if (!url && isAttachmentActionLabel(rawName)) return null;

  const name = rawName || (url ? 'ملف مرفق' : 'مرفق');

  return {
    ...file,
    name,
    fileName: name,
    url,
    fileUrl: url,
    webViewLink: file.webViewLink || file.viewUrl || url,
    index
  };
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
  const directWebAppUrl = getDriveUploadWebAppUrl();
  const uploadEndpoint = getDriveUploadEndpoint();
  if (!directWebAppUrl && !uploadEndpoint) {
    throw new Error('رابط Apps Script Web App غير مضاف. افتح firebase-config.js وضع الرابط في window.MZJ_DRIVE_UPLOAD_WEB_APP_URL.');
  }

  const base64 = await fileToBase64(file);
  const uploadedBy = window.MZJAuth?.getUser?.()?.email || window.MZJAuth?.getUser?.()?.name || '';
  const taskId = meta?.taskId || '';
  const departmentName = meta?.departmentName || '';

  // نرسل الشكلين معًا:
  // 1) الشكل القديم الذي كان Google Drive Apps Script يستخدمه.
  // 2) الشكل الجديد الذي Zoho Apps Script يقبله.
  const payload = {
    action: 'uploadTaskAttachment',
    fileName: file.name,
    name: file.name,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    type: file.type || 'application/octet-stream',
    contentType: file.type || 'application/octet-stream',
    base64,
    file: base64,
    fileBase64: base64,
    content: base64,
    taskId,
    task_id: taskId,
    departmentName,
    campaignName: meta?.campaignName || '',
    campaignCode: meta?.campaignCode || '',
    meta: {
      taskId,
      departmentIdentity: meta?.deptIdentity || '',
      departmentKey: meta?.deptKey || '',
      departmentName,
      campaignName: meta?.campaignName || '',
      campaignCode: meta?.campaignCode || '',
      taskType: meta?.taskType || '',
      uploadedBy
    }
  };

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let result = null;
  try {
    result = JSON.parse(text);
  } catch (error) {
    result = { ok: response.ok, success: response.ok, raw: text };
  }

  const isSuccess = response.ok && (result.ok === true || result.success === true);
  if (!isSuccess) {
    throw new Error(result.error || result.message || result.raw || 'فشل رفع الملف على Zoho WorkDrive.');
  }

  const fileId =
    result.fileId ||
    result.id ||
    result.resource_id ||
    result.resourceId ||
    '';

  const fileUrl =
    result.fileUrl ||
    result.url ||
    result.viewUrl ||
    result.webViewLink ||
    result.permalink ||
    result.downloadUrl ||
    (fileId ? `https://workdrive.zoho.sa/file/${encodeURIComponent(fileId)}` : '');

  return {
    name: result.name || result.fileName || file.name,
    fileName: result.fileName || result.name || file.name,
    url: fileUrl,
    fileUrl: fileUrl,
    webViewLink: result.webViewLink || result.viewUrl || fileUrl,
    downloadUrl: result.downloadUrl || '',
    fileId,
    mimeType: file.type || result.mimeType || '',
    size: file.size || 0,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
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


function mzjDetailsDeptKey(deptName) {
  const value = String(deptName || '').toLowerCase();
  const map = {
    shooting: ['تصوير','التصوير','photography','shooting'],
    content: ['محتوى','المحتوى','content'],
    design: ['تصميم','التصميم','design'],
    montage: ['مونتاج','المونتاج','montage'],
    publish: ['نشر','النشر','publish']
  };
  return Object.entries(map).find(([key, words]) => words.some((word) => value.includes(String(word).toLowerCase())))?.[0] || 'content';
}

function mzjDetailsLegacyReadinessKey(deptTask) {
  return deptTask?.departmentId || deptTask?.departmentName || deptTask?.userName || '';
}

function mzjDetailsDeptIdentity(dept) {
  if (typeof deptIdentity === 'function') return deptIdentity(dept);
  return [
    dept?.departmentId || dept?.departmentKey || dept?.departmentName || '',
    dept?.userId || dept?.uid || dept?.assigneeUid || dept?.userEmail || dept?.userName || ''
  ].map((value) => String(value || '').trim()).filter(Boolean).join('::');
}

function mzjDetailsReadinessKey(deptTask, deptIndex = 0) {
  const stable = deptTask?.assignmentId || deptTask?.linkKey || deptTask?.taskNo || deptTask?.contentTaskId || deptTask?.contentType || deptTask?.requiredText || mzjDetailsDeptIdentity(deptTask) || mzjDetailsLegacyReadinessKey(deptTask) || 'dept';
  return `${stable}::${deptIndex}`;
}

function mzjDetailsReadinessSteps(task, deptTask, deptIndex = 0) {
  const readiness = task?.readiness || {};
  const key = mzjDetailsReadinessKey(deptTask, deptIndex);
  const legacyKey = mzjDetailsLegacyReadinessKey(deptTask);
  return Array.isArray(readiness[key]) ? readiness[key] : (Array.isArray(readiness[legacyKey]) ? readiness[legacyKey] : []);
}

function mzjDetailsReadTasks() {
  if (typeof readTasks === 'function') return readTasks();
  if (window.MZJReadDashboardTasks) return window.MZJReadDashboardTasks();
  if (window.MZJDashboardTaskAPI?.readTasks) return window.MZJDashboardTaskAPI.readTasks();
  return [];
}


function mzjDecodeJsonDataAttr(value, fallback = []) {
  if (!value) return fallback;
  const raw = String(value || '');
  const attempts = [raw];
  try { attempts.push(decodeURIComponent(raw)); } catch (error) {}
  try { attempts.push(decodeURIComponent(decodeURIComponent(raw))); } catch (error) {}
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {}
  }
  return fallback;
}

function openTaskDetails(button) {
  if (!taskDetailsModal || !taskStepButtons) return;

  activeTaskCard = button.closest('[data-dept-task-card]') || button.closest('.department-task-card') || button.closest('.dept-card-template') || button.closest('[data-dash-task-id]');
  const deptKeyValue = button.dataset.deptKey || '';
  let deptDataFromButton = null;
  try {
    deptDataFromButton = button.dataset.deptTaskJson ? JSON.parse(decodeURIComponent(button.dataset.deptTaskJson)) : null;
  } catch (error) {
    deptDataFromButton = null;
  }

  const datasetCars = mzjDecodeJsonDataAttr(button.dataset.selectedCarsJson || '', []);
  const datasetContentTypes = mzjDecodeJsonDataAttr(button.dataset.selectedContentTypesJson || '', []);
  if (deptDataFromButton) {
    deptDataFromButton.__selectedCarsFromButton = datasetCars;
    deptDataFromButton.__selectedContentTypesFromButton = datasetContentTypes;
    if (datasetCars.length) {
      deptDataFromButton.selectedCars = datasetCars;
      deptDataFromButton.selectedCarValues = datasetCars;
      deptDataFromButton.carType = datasetCars.join('، ');
    }
    if (datasetContentTypes.length) {
      deptDataFromButton.selectedContentTypes = datasetContentTypes;
      deptDataFromButton.selectedContentTypeTitles = datasetContentTypes;
      deptDataFromButton.contentType = datasetContentTypes.join('، ');
    }
  }
  if (deptDataFromButton && (datasetCars.length || datasetContentTypes.length)) {
    const existingItems = normalizeDepartmentContentItems(deptDataFromButton);
    const carsForItems = datasetCars.length ? datasetCars : mzjUniqueStrings(existingItems.map((item) => item.carType));
    const typesForItems = datasetContentTypes.length ? datasetContentTypes : mzjUniqueStrings(existingItems.map((item) => item.contentType));
    const manualRequired = cleanTaskRequiredDisplayText(deptDataFromButton?.requiredText || deptDataFromButton?.requiredDetails?.manualRequired || deptDataFromButton?.deliveryDetails || '');
    const rebuiltItems = [];
    (carsForItems.length ? carsForItems : ['']).forEach((car) => {
      (typesForItems.length ? typesForItems : ['']).forEach((type) => {
        if (car || type || manualRequired) rebuiltItems.push({ carType: car, contentType: type, requiredText: manualRequired, printSize: deptDataFromButton?.printSize || '' });
      });
    });
    deptDataFromButton = {
      ...deptDataFromButton,
      selectedCars: datasetCars.length ? datasetCars : (deptDataFromButton.selectedCars || []),
      selectedContentTypes: datasetContentTypes.length ? datasetContentTypes : (deptDataFromButton.selectedContentTypes || []),
      contentItems: rebuiltItems.length ? rebuiltItems : (deptDataFromButton.contentItems || existingItems),
      photoItems: deptKeyValue === 'shooting' && rebuiltItems.length ? rebuiltItems : deptDataFromButton.photoItems,
      carType: datasetCars.length ? datasetCars.join('، ') : (deptDataFromButton.carType || ''),
      contentType: datasetContentTypes.length ? datasetContentTypes.join('، ') : (deptDataFromButton.contentType || '')
    };
  }

  const taskId = button.dataset.taskId || activeTaskCard?.dataset.taskId || activeTaskCard?.dataset.dashTaskId || '';
  const clickedIdentity = button.dataset.deptIdentity || activeTaskCard?.dataset.deptIdentity || mzjDetailsDeptIdentity(deptDataFromButton || {});
  const allTasks = mzjDetailsReadTasks();
  let fullTask = allTasks.find((task) => String(task.id) === String(taskId));
  if (!fullTask && taskId) {
    fullTask = allTasks.find((task) => String(task.firestoreId || task.docId || task.campaignCode || task.code) === String(taskId));
  }
  const cardCampaignCode = activeTaskCard?.dataset.campaignCode || button.dataset.campaignCode || '';
  const titleForLookup = button.dataset.taskTitle || '';
  if (!fullTask && cardCampaignCode) {
    fullTask = allTasks.find((task) => String(task.campaignCode || task.code || '').trim() === String(cardCampaignCode).trim());
  }
  if (!fullTask && titleForLookup) {
    fullTask = allTasks.find((task) => String(task.campaignName || task.name || task.title || '').trim() === String(titleForLookup).trim());
  }
  const departmentTasks = Array.isArray(fullTask?.departmentTasks) ? fullTask.departmentTasks : (deptDataFromButton ? [deptDataFromButton] : []);
  const deptIndexFromButton = button.dataset.deptIndex === undefined || button.dataset.deptIndex === '' ? -1 : Number(button.dataset.deptIndex);
  const clickedIndex = Number.isInteger(deptIndexFromButton) && deptIndexFromButton >= 0 ? deptIndexFromButton : departmentTasks.findIndex((dept) => String(mzjDetailsDeptIdentity(dept)) === String(clickedIdentity) && mzjDetailsDeptKey(dept.departmentName) === deptKeyValue);
  const clickedDeptIndex = clickedIndex >= 0 ? clickedIndex : 0;
  const clickedDept = clickedIndex >= 0 ? departmentTasks[clickedIndex] : (deptDataFromButton || {});

  const sameUserValues = [
    clickedDept.userId, clickedDept.userUid, clickedDept.uid, clickedDept.assigneeUid,
    clickedDept.userEmail, clickedDept.assigneeEmail, clickedDept.email,
    clickedDept.userName, clickedDept.userDisplayName, clickedDept.assigneeName, clickedDept.responsible
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

  const relatedAssignments = departmentTasks
    .map((dept, index) => ({ dept, index }))
    .filter(({ dept }) => {
      if (mzjDetailsDeptKey(dept.departmentName) !== deptKeyValue) return false;
      const deptValues = [
        dept.userId, dept.userUid, dept.uid, dept.assigneeUid,
        dept.userEmail, dept.assigneeEmail, dept.email,
        dept.userName, dept.userDisplayName, dept.assigneeName, dept.responsible
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      if (!sameUserValues.length) return String(mzjDetailsDeptIdentity(dept)) === String(clickedIdentity);
      return deptValues.some((value) => sameUserValues.includes(value));
    });

  const assignments = relatedAssignments.length ? relatedAssignments : [{ dept: clickedDept, index: clickedDeptIndex }];

  activeTaskDetailsMeta = {
    taskId,
    deptIdentity: clickedIdentity,
    legacyReadinessKey: activeTaskCard?.dataset.legacyReadinessKey || '',
    deptKey: deptKeyValue,
    departmentName: button.dataset.dept || '',
    campaignName: button.dataset.taskTitle || '',
    campaignCode: activeTaskCard?.dataset.campaignCode || '',
    taskType: activeTaskCard?.dataset.taskType || '',
    deptData: deptDataFromButton,
    relatedAssignments: assignments.map(({ dept, index }, assignmentIndex) => {
      const mergedDept = assignmentIndex === 0 ? mergeTaskDetailDeptData(dept, deptDataFromButton || clickedDept) : dept;
      if (assignmentIndex === 0) {
        if (datasetCars.length) {
          mergedDept.__selectedCarsFromButton = datasetCars;
          mergedDept.selectedCars = datasetCars;
          mergedDept.selectedCarValues = datasetCars;
          mergedDept.carType = datasetCars.join('، ');
        }
        if (datasetContentTypes.length) {
          mergedDept.__selectedContentTypesFromButton = datasetContentTypes;
          mergedDept.selectedContentTypes = datasetContentTypes;
          mergedDept.selectedContentTypeTitles = datasetContentTypes;
          mergedDept.contentType = datasetContentTypes.join('، ');
        }
      }
      return {
        deptIdentity: mzjDetailsDeptIdentity(mergedDept),
        readinessKey: mzjDetailsReadinessKey(mergedDept, index),
        legacyReadinessKey: mzjDetailsLegacyReadinessKey(mergedDept),
        deptIndex: index,
        deptData: mergedDept
      };
    })
  };

  if (taskDetailsDept) taskDetailsDept.textContent = button.dataset.dept || 'تفاصيل القسم';
  if (taskDetailsTitle) taskDetailsTitle.textContent = button.dataset.taskTitle || 'تفاصيل التاسك';

  const oldInfoBox = taskDetailsModal.querySelector('[data-task-campaign-info-box]');
  if (oldInfoBox) oldInfoBox.remove();
  if (fullTask && taskDetailsRequired) {
    taskDetailsRequired.insertAdjacentHTML('beforebegin', renderTaskCampaignInfoBox(fullTask));
  }

  const renderSelectedRequirement = (assignmentIndex = 0) => {
    const selectedAssignment = assignments[assignmentIndex] || assignments[0] || { dept: clickedDept };
    const selectedDeptForRender = assignmentIndex === 0
      ? mergeTaskDetailDeptData(selectedAssignment.dept, deptDataFromButton || clickedDept)
      : selectedAssignment.dept;
    if (assignmentIndex === 0) {
      if (datasetCars.length) {
        selectedDeptForRender.__selectedCarsFromButton = datasetCars;
        selectedDeptForRender.selectedCars = datasetCars;
        selectedDeptForRender.selectedCarValues = datasetCars;
        selectedDeptForRender.carType = datasetCars.join('، ');
      }
      if (datasetContentTypes.length) {
        selectedDeptForRender.__selectedContentTypesFromButton = datasetContentTypes;
        selectedDeptForRender.selectedContentTypes = datasetContentTypes;
        selectedDeptForRender.selectedContentTypeTitles = datasetContentTypes;
        selectedDeptForRender.contentType = datasetContentTypes.join('، ');
      }
    }
    if (taskDetailsRequired) {
      taskDetailsRequired.innerHTML = renderTaskDetailsSummary(selectedDeptForRender, deptKeyValue) || renderStructuredDepartmentRequirement(selectedDeptForRender, deptKeyValue) || renderTaskRequirementDetails(formatDepartmentRequirement(selectedDeptForRender), deptKeyValue);
    }
  };
  renderSelectedRequirement(0);

taskStepButtons.innerHTML = '';

  if (assignments.length > 1) {
    const switcher = document.createElement('div');
    switcher.className = 'assignment-switcher';
    switcher.setAttribute('data-assignment-switcher', 'true');
    switcher.innerHTML = `
      <div class="assignment-switcher-head">
        <div>
          <span>التكليفات المطلوبة</span>
          <strong>اختار التكليف اللي هتشتغل عليه</strong>
        </div>
        <b>${assignments.length} تكليف</b>
      </div>
      <div class="assignment-switcher-buttons">
        ${assignments.map(({ dept }, index) => {
          const shortTitle = [
            dept.contentType || dept.deliverable || dept.taskNo || '',
            dept.carType || ''
          ].filter(Boolean).join(' - ');
          return `<button type="button" class="assignment-switch-btn ${index === 0 ? 'is-active' : ''}" data-switch-assignment="${index}">
            <b>${index + 1}</b>
            <span>تكليف ${index + 1}</span>
            <em class="assignment-card-total-percent">
              <i>اكتمال التكليفات معًا: <strong data-switch-total-task-percent>0%</strong></i>
              <i>نسبة الحملة: <strong data-switch-total-campaign-percent>0%</strong></i>
            </em>
            ${shortTitle ? `<small>${escapeHTML(shortTitle)}</small>` : '<small>مطلوب مستقل</small>'}
          </button>`;
        }).join('')}
      </div>
    `;
    taskStepButtons.appendChild(switcher);
  }
  const deptCampaignShare = activeTaskCard ? Number(activeTaskCard.dataset.departmentShare || 0) : 0;
  const totalAssignments = Math.max(assignments.length, 1);

  assignments.forEach(({ dept, index: deptIndex }, assignmentIndex) => {
    const readinessKey = mzjDetailsReadinessKey(dept, deptIndex);
    const selected = mzjDetailsReadinessSteps(fullTask || {}, dept, deptIndex).map(String);
    const steps = decodeTaskSteps(button.dataset.steps || '', deptKeyValue);
    const block = document.createElement('section');
    block.className = `assignment-step-block ${assignmentIndex === 0 ? 'is-active' : ''}`;
    block.dataset.assignmentStepBlock = 'true';
    block.dataset.assignmentIndex = String(assignmentIndex);
    block.hidden = assignmentIndex !== 0;
    block.dataset.readinessKey = readinessKey;
    block.dataset.legacyReadinessKey = mzjDetailsLegacyReadinessKey(dept);
    block.dataset.deptIndex = String(deptIndex);
    block.dataset.deptIdentity = mzjDetailsDeptIdentity(dept);

    const assignmentTitle = dept.taskName || dept.requiredTaskName || dept.contentType || dept.deliverable || dept.taskNo || 'تكليف مطلوب';

    block.innerHTML = `
      <div class="assignment-actions-panel">
        <div class="assignment-actions-panel-head">
          <div class="assignment-step-title compact-title-block">
            <span>تكليف ${assignmentIndex + 1}</span>
            <strong>${escapeHTML(assignmentTitle || 'تكليف مطلوب')}</strong>
          </div>
          <div class="assignment-step-progress compact-inline-progress">
            <div><small>اكتمال التاسك</small><b data-assignment-task-percent>0%</b></div>
            <div><small>مساهمة القسم</small><b data-assignment-campaign-percent>0%</b></div>
          </div>
        </div>
        <div class="assignment-actions-title">إجراءات التكليف</div>
        <div class="assignment-step-buttons" data-assignment-step-buttons></div>
      </div>
    `;

    const buttonsWrap = block.querySelector('[data-assignment-step-buttons]');
    steps.forEach((step, stepIndex) => {
      const isApprovalStep = Boolean(step.adminOnly) || String(step.label || '').includes('اعتماد');
      const stepValue = Number(step.value || 0);
      const campaignValue = Math.round(((deptCampaignShare / totalAssignments) * stepValue / 100) * 100) / 100;
      const stepButton = document.createElement('button');
      stepButton.type = 'button';
      stepButton.className = 'task-step-btn';
      stepButton.dataset.stepIndex = String(stepIndex);
      stepButton.dataset.stepValue = String(stepValue);
      stepButton.dataset.campaignValue = String(campaignValue);
      stepButton.dataset.readinessKey = readinessKey;

      if (isApprovalStep) {
        stepButton.classList.add('is-approval-step');
        if (!isAdminUser()) {
          stepButton.disabled = true;
          stepButton.title = 'أدمن فقط';
        }
      }

      if (selected.includes(String(stepIndex))) stepButton.classList.add('is-done');
      stepButton.innerHTML = `<span>${escapeHTML(step.label || 'خطوة')}</span><small>${stepValue}% من التكليف<br>${campaignValue}% من الحملة${isApprovalStep ? '<br>أدمن فقط' : ''}</small>`;
      buttonsWrap.appendChild(stepButton);
    });

    taskStepButtons.appendChild(block);
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


// Strong capture handler: تفاصيل واعتماد must open before any dashboard/card toggle handler
document.addEventListener('click', function(event) {
  const btn = event.target.closest?.('[data-open-task-details]');
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  try {
    openTaskDetails(btn);
  } catch (error) {
    console.error('openTaskDetails failed:', error);
    alert('فشل فتح تفاصيل التاسك: ' + (error?.message || error));
  }
}, true);


document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;
  const taskDetailsButton = event.target.closest('[data-open-task-details]');
  if (taskDetailsButton) {
    event.preventDefault();
    event.stopPropagation();
    openTaskDetails(taskDetailsButton);
    return;
  }

  const assignmentSwitch = event.target.closest('[data-switch-assignment]');
  if (assignmentSwitch) {
    const index = Number(assignmentSwitch.dataset.switchAssignment || 0);
    const modal = assignmentSwitch.closest('#taskDetailsModal') || taskDetailsModal;
    modal?.querySelectorAll('[data-switch-assignment]').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.switchAssignment || 0) === index);
    });
    modal?.querySelectorAll('[data-assignment-step-block]').forEach((block) => {
      const isSelected = Number(block.dataset.assignmentIndex || 0) === index;
      block.hidden = !isSelected;
      block.classList.toggle('is-active', isSelected);
    });
    const selectedMeta = activeTaskDetailsMeta?.relatedAssignments?.[index];
    if (selectedMeta?.deptData && taskDetailsRequired) {
      taskDetailsRequired.innerHTML = renderTaskDetailsSummary(selectedMeta.deptData, activeTaskDetailsMeta?.deptKey || '') || renderStructuredDepartmentRequirement(selectedMeta.deptData, activeTaskDetailsMeta?.deptKey || '') || renderTaskRequirementDetails(formatDepartmentRequirement(selectedMeta.deptData), activeTaskDetailsMeta?.deptKey || '');
    }
    syncTaskProgress();
    return;
  }

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
        createdAt: form.dataset.editingTaskMode === '1' ? (form.dataset.originalCreatedAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
  { id: 'photography', name: 'قسم التصوير', users: [] },
  { id: 'content', name: 'قسم المحتوى', users: [] },
  { id: 'design', name: 'قسم التصميم', users: [] },
  { id: 'montage', name: 'قسم المونتاج', users: [] },
  { id: 'publishing', name: 'قسم النشر', users: [] }
];

function normalizeContentTaskDepartment(item, index = 0) {
  if (!item) return null;
  const name = item.name || item.title || item.departmentName || item.sectionName || item.department || ('قسم ' + (index + 1));
  const id = item.id || item.docId || item.uid || item.key || item.slug || item.departmentId || item.departmentKey || ('dept_' + index);
  const localValuesAsArray = (value) => {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value.flatMap(localValuesAsArray);
    if (typeof value === 'object') {
      if (value.email || value.uid || value.id || value.userId || value.name || value.displayName || value.fullName) return [value];
      return Object.values(value).flatMap(localValuesAsArray);
    }
    return String(value).split(/[,،;\n]+/).map((entry) => entry.trim()).filter(Boolean);
  };
  const usersRaw = [item.users, item.members, item.responsibles, item.assignees, item.usersList, item.team, item.teamUsers, item.selectedUsers].flatMap(localValuesAsArray);
  const users = usersRaw.map((user) => {
    const normalized = normalizeSystemUser(user);
    if (!normalized) return null;
    return {
      ...normalized,
      department: normalized.department || id,
      departmentId: normalized.departmentId || id,
      departmentName: normalized.departmentName || name,
      label: normalized.label || normalized.name || normalized.email || normalized.id || normalized.uid
    };
  }).filter(Boolean);
  const userIds = localValuesAsArray(item.userIds || item.usersIds || item.departmentUserIds);
  const memberUids = localValuesAsArray(item.memberUids || item.uids || item.userUids);
  const memberEmails = localValuesAsArray(item.memberEmails || item.emails || item.userEmails);
  const members = localValuesAsArray(item.members);
  const assignees = localValuesAsArray(item.assignees);
  const responsibles = localValuesAsArray(item.responsibles);
  const usersList = localValuesAsArray(item.usersList || item.teamUsers || item.selectedUsers);
  return {
    ...item,
    id,
    name,
    kind: item.kind || deptKindFromName(name || id),
    users,
    members,
    assignees,
    responsibles,
    usersList,
    userIds,
    memberUids,
    memberEmails,
    departmentId: item.departmentId || id,
    departmentName: item.departmentName || name
  };
}

async function loadDepartmentsFromContentTasks() {
  const normalizeList = (rows) => (rows || []).map(normalizeContentTaskDepartment).filter(Boolean);
  const mergeDepartments = (...groups) => {
    const byAlias = new Map();
    const getKey = (dept) => {
      const kind = deptKindFromName(dept?.name || dept?.kind || dept?.id || '');
      return kind || normalizeDeptCompareValue(dept?.id || dept?.name || '');
    };
    groups.flat().filter(Boolean).forEach((dept) => {
      const key = getKey(dept);
      if (!key) return;
      const old = byAlias.get(key) || {};
      const users = [...(old.users || []), ...(dept.users || [])];
      const members = [...(old.members || []), ...(dept.members || [])];
      const userIds = [...(old.userIds || []), ...(dept.userIds || [])];
      const memberUids = [...(old.memberUids || []), ...(dept.memberUids || [])];
      const memberEmails = [...(old.memberEmails || []), ...(dept.memberEmails || [])];
      const assignees = [...(old.assignees || []), ...(dept.assignees || [])];
      const responsibles = [...(old.responsibles || []), ...(dept.responsibles || [])];
      const usersList = [...(old.usersList || []), ...(dept.usersList || [])];
      byAlias.set(key, {
        ...old,
        ...dept,
        id: old.id || dept.id,
        name: dept.name || old.name,
        users,
        members,
        assignees,
        responsibles,
        usersList,
        userIds,
        memberUids,
        memberEmails
      });
    });
    return Array.from(byAlias.values()).map(normalizeContentTaskDepartment).filter(Boolean);
  };

  const defaults = normalizeList(MZJ_DEPARTMENTS_FALLBACK);

  if (window.MZJDepartments?.loadDepartments) {
    try {
      const managedDepartments = await window.MZJDepartments.loadDepartments();
      if (Array.isArray(managedDepartments) && managedDepartments.length) return mergeDepartments(defaults, normalizeList(managedDepartments));
    } catch (error) {}
  }

  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('departments').get();
      const cloudDepartments = [];
      snap.forEach((doc) => cloudDepartments.push({ id: doc.id, ...(doc.data() || {}) }));
      if (cloudDepartments.length) return mergeDepartments(defaults, normalizeList(cloudDepartments));
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
        return mergeDepartments(defaults, normalizeList(parsed));
      }
    } catch (error) {}
  }

  // Firebase-ready hook: عند تفعيل Firebase SDK وتوفير window.MZJ_DB يمكن قراءة collection content_tasks من هنا.
  if (window.MZJ_CONTENT_TASKS && Array.isArray(window.MZJ_CONTENT_TASKS)) {
    return mergeDepartments(defaults, normalizeList(window.MZJ_CONTENT_TASKS));
  }

  return defaults;
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
  const department = user.department || user.departmentId || user.departmentName || user.section || user.sectionId || user.dept || user.deptId || user.team || user.teamId || '';
  return {
    ...user,
    id: id || uid || email || name,
    uid: uid || id || email || name,
    name: name || email || id || uid,
    displayName: user.displayName || name || email || id || uid,
    email,
    department,
    departmentId: user.departmentId || user.department || user.sectionId || user.deptId || user.teamId || '',
    departmentName: user.departmentName || user.sectionName || user.deptName || user.teamName || '',
    role: user.role || 'user',
    label: email && name && email !== name ? `${name} — ${email}` : (name || email || id || uid)
  };
}

async function loadUsersFromSystemPath() {
  const collected = [];
  // لا نستخدم TEST_USERS الموجودة في auth.js داخل اختيار اليوزرات؛
  // مصدر اليوزرات هنا لازم يكون اليوزرات الحقيقية من صفحة الإدارة / localStorage / Firebase فقط.
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

  const sourceUsers = collected;
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


// Shared caches used by the create-task modal helpers.
// They must be global here because some helper functions are defined outside initCreateTaskModal().
var departmentsCache = Array.isArray(MZJ_DEPARTMENTS_FALLBACK) ? MZJ_DEPARTMENTS_FALLBACK : [];
var usersCache = [];
const MZJ_CONTENT_HUB_LABEL = 'قسم المحتوى';
const MZJ_ASSIGNMENT_LABEL = 'المطلوب';

function normalizeDeptCompareValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^قسم\s+/u, '')
    .replace(/\s+/g, ' ')
    .replace(/[ـ_,-]+/g, ' ')
    .trim();
}

function departmentKindAliases(kind) {
  const map = {
    photography: ['photography', 'photo', 'تصوير', 'التصوير', 'قسم التصوير'],
    content: ['content', 'copy', 'كتابة', 'محتوى', 'المحتوى', 'قسم المحتوى'],
    design: ['design', 'designer', 'تصميم', 'التصميم', 'قسم التصميم'],
    montage: ['montage', 'video', 'editing', 'مونتاج', 'المونتاج', 'قسم المونتاج'],
    publish: ['publish', 'publishing', 'نشر', 'النشر', 'قسم النشر']
  };
  return (map[kind] || []).map(normalizeDeptCompareValue).filter(Boolean);
}

function departmentAliasesForMatch(dept) {
  const aliases = new Set();
  if (!dept) return aliases;
  [
    dept.id, dept.uid, dept.key, dept.slug, dept.kind, dept.type, dept.name, dept.title,
    dept.label, dept.department, dept.departmentId, dept.departmentName, dept.section,
    dept.sectionId, dept.sectionName
  ].forEach((value) => {
    const normalized = normalizeDeptCompareValue(value);
    if (normalized) aliases.add(normalized);
  });
  const kind = deptKindFromName(dept.name || dept.kind || dept.id || '');
  departmentKindAliases(kind).forEach((value) => aliases.add(value));
  return aliases;
}

function collectDepartmentValuesFromUser(user) {
  const values = [];
  const push = (value) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === 'object') {
      [
        value.id, value.uid, value.key, value.slug, value.kind, value.type, value.name,
        value.title, value.label, value.department, value.departmentId, value.departmentName,
        value.section, value.sectionId, value.sectionName
      ].forEach(push);
      return;
    }
    values.push(value);
  };
  [
    user.department, user.departmentId, user.departmentName, user.departmentKey,
    user.deptId, user.dept, user.deptName, user.section, user.sectionId,
    user.sectionName, user.team, user.teamId, user.teamName, user.roleDepartment,
    user.assignedDepartment, user.assignedDepartmentId, user.assignedDepartmentIds, user.assignedDepartments,
    user.departments, user.departmentIds, user.departmentsIds, user.departmentNames, user.sections,
    user.teams, user.groups, user.permissionsDepartments, user.allowedDepartments, user.allowedDepartmentIds,
    user.managedDepartments, user.departmentRoles, user.rolesDepartments
  ].forEach(push);
  return values.map(normalizeDeptCompareValue).filter(Boolean);
}

function userMatchesDepartment(user, dept) {
  const aliases = departmentAliasesForMatch(dept);
  if (!aliases.size) return false;
  const userValues = collectDepartmentValuesFromUser(user);
  if (!userValues.length) return false;
  return userValues.some((value) => aliases.has(value));
}

function optionValueForDepartmentUser(user, dept) {
  const base = String(user.email || user.name || user.id || user.uid || '').trim();
  const deptId = String(dept?.id || dept?.name || '').trim();
  return `${base}@@${deptId}`;
}


function renderDepartmentTargetOptions(selectedIds = []) {
  const selectedSet = new Set((Array.isArray(selectedIds) ? selectedIds : [selectedIds]).map((id) => String(id || '')));
  const list = ((departmentsCache || []).filter(Boolean).length ? (departmentsCache || []) : MZJ_DEPARTMENTS_FALLBACK).filter(Boolean);
  return list.map((dept) => `<option value="${escapeHTML(dept.id || dept.name || '')}" data-department-name="${escapeHTML(dept.name || '')}" data-department-kind="${escapeHTML(deptKindFromName(dept.name || ''))}" ${selectedSet.has(String(dept.id || dept.name || '')) ? 'selected' : ''}>${escapeHTML(dept.name || dept.id || 'قسم')}</option>`).join('');
}

function usersForSelectedDepartmentIds(ids) {
  const selectedIds = (ids || []).map((id) => String(id || '')).filter(Boolean);
  if (!selectedIds.length) return usersCache || [];
  const merged = new Map();
  selectedIds.forEach((deptId) => {
    const dept = (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(deptId));
    usersForDepartment(dept, usersCache).forEach((user) => {
      const normalized = normalizeSystemUser(user);
      const key = String(normalized?.uid || normalized?.id || normalized?.email || normalized?.name || '').trim().toLowerCase();
      if (key) merged.set(key, normalized);
    });
  });
  return Array.from(merged.values());
}

function renderUserOptionsForDepartmentIds(ids, selectedValues = []) {
  const selectedSet = new Set((Array.isArray(selectedValues) ? selectedValues : [selectedValues]).map((value) => String(value || '')));
  const selectedIds = (ids || []).map((id) => String(id || '')).filter(Boolean);
  if (!selectedIds.length) return '<option value="">اختار قسم الأول</option>';

  const departments = selectedIds.map((deptId) => (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(deptId)) || { id: deptId, name: deptId });
  const options = [];
  departments.forEach((dept) => {
    usersForDepartment(dept, usersCache).map(normalizeSystemUser).filter(Boolean).forEach((user) => {
      const actualValue = user.email || user.name || user.id || user.uid || '';
      if (!actualValue) return;
      const optionValue = optionValueForDepartmentUser(user, dept);
      const isSelected = selectedSet.has(String(optionValue)) || selectedSet.has(String(actualValue));
      options.push(`<option value="${escapeHTML(optionValue)}" data-user-value="${escapeHTML(actualValue)}" data-user-id="${escapeHTML(user.id || '')}" data-user-uid="${escapeHTML(user.uid || user.id || '')}" data-user-name="${escapeHTML(user.name || '')}" data-user-email="${escapeHTML(user.email || '')}" data-user-department-id="${escapeHTML(dept.id || dept.name || '')}" data-user-department-name="${escapeHTML(dept.name || dept.id || '')}" data-user-department-kind="${escapeHTML(deptKindFromName(dept.name || dept.kind || dept.id || ''))}" ${isSelected ? 'selected' : ''}>${escapeHTML(user.label || actualValue)}</option>`);
    });
  });
  if (!options.length) return '<option value="">لا يوجد يوزرات في الأقسام المختارة</option>';
  return options.join('');
}

function mzjValuesAsArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(mzjValuesAsArray);
  if (typeof value === 'object') {
    if (value.email || value.uid || value.id || value.name || value.displayName) return [value];
    return Object.values(value).flatMap(mzjValuesAsArray);
  }
  return String(value).split(/[,،;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function usersForDepartment(dept, allUsers) {
  const normalizedAllUsers = (allUsers || []).map(normalizeSystemUser).filter(Boolean);
  const byKey = new Map();
  normalizedAllUsers.forEach((user) => {
    [user.id, user.uid, user.email, user.name, user.displayName].filter(Boolean).forEach((key) => {
      byKey.set(String(key).trim().toLowerCase(), user);
    });
  });

  const explicitUsers = mzjValuesAsArray(dept?.users).map(normalizeSystemUser).filter(Boolean);
  const deptKeys = []
    .concat(mzjValuesAsArray(dept?.userIds))
    .concat(mzjValuesAsArray(dept?.uids))
    .concat(mzjValuesAsArray(dept?.memberUids))
    .concat(mzjValuesAsArray(dept?.memberEmails))
    .concat(mzjValuesAsArray(dept?.emails))
    .concat(mzjValuesAsArray(dept?.members))
    .concat(mzjValuesAsArray(dept?.assignees))
    .concat(mzjValuesAsArray(dept?.responsibles))
    .concat(mzjValuesAsArray(dept?.usersList))
    .concat(mzjValuesAsArray(dept?.selectedUsers))
    .concat(mzjValuesAsArray(dept?.teamUsers));
  const linkedUsers = deptKeys.map((key) => {
    if (key && typeof key === 'object') return normalizeSystemUser(key);
    return byKey.get(String(key || '').trim().toLowerCase());
  }).filter(Boolean);

  const departmentUsers = normalizedAllUsers.filter((user) => userMatchesDepartment(user, dept));

  const merged = new Map();
  [...explicitUsers, ...linkedUsers, ...departmentUsers].forEach((user) => {
    const normalized = normalizeSystemUser(user);
    const key = String(normalized?.uid || normalized?.id || normalized?.email || normalized?.name || '').trim().toLowerCase();
    if (key) merged.set(key, { ...normalized, department: normalized.department || dept?.id || '', departmentId: normalized.departmentId || dept?.id || '', departmentName: normalized.departmentName || dept?.name || '' });
  });
  const kind = deptKindFromName(dept?.name || dept?.kind || dept?.id || '');
  if (kind === 'content') {
    const looseContentUsers = normalizedAllUsers.filter((user) => /content|محتو|كتابة|copy/i.test([user.department, user.departmentId, user.departmentName, user.role, user.team, user.teamName, user.sectionName, user.deptName].filter(Boolean).join(' ')));
    looseContentUsers.forEach((user) => {
      const key = String(user.uid || user.id || user.email || user.name || '').trim().toLowerCase();
      if (key) merged.set(key, { ...user, department: user.department || dept?.id || '', departmentId: user.departmentId || dept?.id || '', departmentName: user.departmentName || dept?.name || '' });
    });
  }
  const finalUsers = Array.from(merged.values());
  return finalUsers;
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

function normalizeFunnel(row, id) {
  const name = String(row?.name || row?.title || row?.label || row || '').trim();
  if (!name) return null;
  return {
    id: id || row?.id || name,
    name,
    active: row?.active !== false,
    source: row?.source || 'firebase'
  };
}

async function loadMarketingFunnels() {
  const collected = [];
  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('marketing_funnels').get();
      snap.forEach((doc) => {
        const item = normalizeFunnel(doc.data() || {}, doc.id);
        if (item && item.active !== false) collected.push(item);
      });
    } catch (error) {
      console.warn('marketing_funnels load failed:', error);
    }
  }
  const map = new Map();
  collected.filter(Boolean).forEach((funnel) => map.set(String(funnel.name).toLowerCase(), funnel));
  return Array.from(map.values());
}

async function saveMarketingFunnel(name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('اكتب اسم Funnel الأول.');
  if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
  if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
  const id = 'funnel_' + Date.now();
  await firebase.firestore().collection('marketing_funnels').doc(id).set({
    id,
    name: clean,
    active: true,
    createdAt: new Date().toISOString(),
    source: 'dashboard'
  });
  return { id, name: clean, active: true, source: 'firebase' };
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
  ['نسخة نشر نهائية', 'JPG / PNG / PDF حسب المطلوب'],
  ['مطبوعات أونلاين', 'اكتب المقاس المطلوب']
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


function mzjSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'section';
}

function normalizeRequiredContentType(row, id) {
  if (row?.docType === 'section' || row?.kind === 'section' || row?.isContentSection === true) return null;
  const title = String(row?.title || row?.name || row?.contentType || row?.label || '').trim();
  if (!title) return null;
  const sectionName = String(row?.sectionName || row?.contentSectionName || row?.categoryName || '').trim() || 'عام';
  const sectionId = String(row?.sectionId || row?.contentSectionId || mzjSlug(sectionName)).trim();
  return {
    id: id || row?.id || row?.docId || ('content_type_' + Date.now()),
    title,
    details: String(row?.details || row?.description || row?.desc || '').trim(),
    sectionId,
    sectionName,
    contentSectionId: sectionId,
    contentSectionName: sectionName,
    departmentKind: 'global',
    departmentName: 'كل الأقسام',
    active: row?.active !== false,
    createdAt: row?.createdAt || '',
    updatedAt: row?.updatedAt || ''
  };
}

function normalizeRequiredContentSection(row, id) {
  const title = String(row?.sectionName || row?.contentSectionName || row?.title || row?.name || '').trim();
  if (!title) return null;
  return {
    id: id || row?.sectionId || row?.contentSectionId || mzjSlug(title),
    title,
    name: title,
    details: String(row?.details || row?.description || '').trim(),
    active: row?.active !== false
  };
}

async function loadRequiredContentTypes() {
  const collected = [];
  const sections = [];
  if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const snap = await firebase.firestore().collection('required_content_types').get();
      snap.forEach((doc) => {
        const data = doc.data() || {};
        if (data.docType === 'section' || data.kind === 'section' || data.isContentSection === true) {
          const section = normalizeRequiredContentSection(data, doc.id);
          if (section && section.active !== false) sections.push(section);
        } else {
          const item = normalizeRequiredContentType(data, doc.id);
          if (item && item.active !== false) collected.push(item);
        }
      });
    } catch (error) {
      console.warn('required_content_types load failed:', error);
    }
  }
  const sectionMap = new Map();
  sections.forEach((section) => sectionMap.set(String(section.id), section));
  collected.forEach((item) => {
    const id = item.sectionId || mzjSlug(item.sectionName || 'عام');
    if (!sectionMap.has(String(id))) {
      sectionMap.set(String(id), { id, title: item.sectionName || 'عام', name: item.sectionName || 'عام', details: '', active: true });
    }
  });
  const typeMap = new Map();
  collected.forEach((item) => mapSetUnique(typeMap, String(item.id || item.sectionId + ':' + item.title), item));
  window.MZJRequiredContentSectionsCache = Array.from(sectionMap.values()).sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
  window.MZJRequiredContentTypesCache = Array.from(typeMap.values()).sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
  return window.MZJRequiredContentTypesCache;
}

function mapSetUnique(map, key, item) {
  map.set(key, item);
  return map;
}

function requiredContentSections() {
  const sections = Array.isArray(window.MZJRequiredContentSectionsCache) ? window.MZJRequiredContentSectionsCache : [];
  const types = Array.isArray(window.MZJRequiredContentTypesCache) ? window.MZJRequiredContentTypesCache : [];
  if (sections.length) return sections.filter((item) => item.active !== false);
  const sectionMap = new Map();
  types.forEach((item) => {
    const id = item.sectionId || mzjSlug(item.sectionName || 'عام');
    if (!sectionMap.has(id)) sectionMap.set(id, { id, title: item.sectionName || 'عام', name: item.sectionName || 'عام' });
  });
  return Array.from(sectionMap.values());
}

function requiredContentTypesForSection(sectionId) {
  const cache = Array.isArray(window.MZJRequiredContentTypesCache) ? window.MZJRequiredContentTypesCache : [];
  if (!sectionId) return [];
  return cache.filter((item) => item.active !== false && String(item.sectionId || '') === String(sectionId));
}

function requiredContentTypesForKind(kind) {
  const cache = Array.isArray(window.MZJRequiredContentTypesCache) ? window.MZJRequiredContentTypesCache : [];
  return cache.filter((item) => item.active !== false);
}

function renderRequiredContentOptions(kind, selected = '') {
  const items = requiredContentTypesForKind(kind);
  const current = String(selected || '').trim();
  if (!items.length) return '<option value="">لا توجد أنواع محتوى مضافة</option>';
  return '<option value="">اختار نوع المحتوى</option>' + items.map((item) => `<option value="${escapeHTML(item.title)}" data-desc="${escapeHTML(item.details || '')}" data-id="${escapeHTML(item.id)}" data-section-id="${escapeHTML(item.sectionId || '')}" ${current === item.title ? 'selected' : ''}>${escapeHTML(item.title)}${item.sectionName ? ' / ' + escapeHTML(item.sectionName) : ''}</option>`).join('');
}

function renderRequiredContentCards(kind, attrName) {
  const items = requiredContentTypesForKind(kind);
  if (!items.length) {
    return `<div class="required-content-empty">لا توجد أنواع محتوى مضافة. افتح صفحة المحتوى المطلوب وأضف الأقسام والأنواع.</div>`;
  }
  return items.map((item) => `
    <label class="multi-choice-card required-content-choice-card">
      <input type="checkbox" ${attrName} value="${escapeHTML(item.title)}" data-desc="${escapeHTML(item.details || '')}" data-title="${escapeHTML(item.title)}" data-required-content-id="${escapeHTML(item.id)}" data-section-id="${escapeHTML(item.sectionId || '')}">
      <span class="multi-choice-title">${escapeHTML(item.title)}</span>
      <small>${escapeHTML(item.sectionName || 'قسم محتوى')}${item.details ? ' — ' + escapeHTML(item.details) : ''}</small>
    </label>
  `).join('');
}

function renderContentSectionOptions(selected = '') {
  const current = String(selected || '').trim();
  const sections = requiredContentSections();
  if (!sections.length) return '<option value="">لا توجد أقسام محتوى</option>';
  return '<option value="">اختار قسم المحتوى</option>' + sections.map((section) => `<option value="${escapeHTML(section.id)}" ${current === String(section.id) ? 'selected' : ''}>${escapeHTML(section.title || section.name || 'قسم محتوى')}</option>`).join('');
}

function refreshContentTypesForSection(item) {
  if (!item) return;
  const sectionSelect = item.querySelector('[data-content-section-select]');
  const grid = item.querySelector('[data-universal-content-type-grid]');
  if (!grid) return;
  const selected = Array.from(item.querySelectorAll('[data-universal-content-type]:checked')).map((input) => input.value).filter(Boolean);
  grid.innerHTML = renderUniversalContentChoiceCards('content', sectionSelect?.value || '', selected);
  item.querySelectorAll('[data-universal-content-type]').forEach((input) => {
    input.closest('.universal-content-type-card')?.classList.toggle('is-checked', input.checked);
  });
}

function isOfflinePrintContent(value) {
  const text = String(value || '').toLowerCase();
  return (
    text.includes('مطبوعات اوفلاين') ||
    text.includes('مطبوعات أوفلاين') ||
    text.includes('مطبوعات offline') ||
    text.includes('offline print') ||
    text.includes('print offline')
  );
}

function renderUniversalContentChoiceCards(kind, sectionId = '', selected = []) {
  const selectedSet = new Set((Array.isArray(selected) ? selected : String(selected || '').split('،')).map((item) => String(item || '').trim()).filter(Boolean));
  if (!sectionId) return `<div class="required-content-empty">اختار قسم المحتوى الأول علشان تظهر الأنواع الخاصة به.</div>`;
  const items = requiredContentTypesForSection(sectionId);
  if (!items.length) {
    return `<div class="required-content-empty">لا توجد أنواع محتوى داخل هذا القسم. افتح صفحة المحتوى المطلوب وأضف الأنواع.</div>`;
  }
  return items.map((item) => {
    const checked = selectedSet.has(item.title);
    return `
    <label class="universal-content-type-card ${checked ? 'is-checked' : ''}" data-content-type-card>
      <input type="checkbox" data-universal-content-type value="${escapeHTML(item.title)}" data-desc="${escapeHTML(item.details || '')}" data-id="${escapeHTML(item.id)}" data-section-id="${escapeHTML(item.sectionId || '')}" data-section-name="${escapeHTML(item.sectionName || '')}" ${checked ? 'checked' : ''}>
      <span class="universal-content-type-main">
        <strong>${escapeHTML(item.title)}</strong>
        ${item.details ? `<small>${escapeHTML(item.details)}</small>` : ''}
      </span>
      <span class="content-type-quantity-field" data-content-type-quantity-wrap ${checked ? '' : 'hidden'}>
        <small>العدد</small>
        <input type="number" min="1" step="1" inputmode="numeric" data-content-type-quantity placeholder="اكتب العدد">
      </span>
    </label>`;
  }).join('');
}

function renderStockCarCheckboxCards(selected = []) {
  const selectedSet = new Set((Array.isArray(selected) ? selected : String(selected || '').split('،')).map((item) => String(item || '').trim()).filter(Boolean));
  const cars = Array.isArray(window.MZJCreateTaskStockCarsCache) ? window.MZJCreateTaskStockCarsCache : [];
  if (!cars.length) {
    return '<div class="required-content-empty">لا توجد سيارات محملة من الاستوك. تقدر تكتب المطلوب يدويًا في خانة المحتوى المطلوب.</div>';
  }
  return cars.map((car) => {
    const value = car.display || car.name || car.carName || '';
    if (!value) return '';
    return `<label class="universal-content-type-card stock-car-choice-card ${selectedSet.has(value) ? 'is-checked' : ''}">
      <input type="checkbox" data-universal-car-choice value="${escapeHTML(value)}" ${selectedSet.has(value) ? 'checked' : ''}>
      <span>${escapeHTML(value)}</span>
    </label>`;
  }).join('');
}

function refreshStockCarCheckboxGrids() {
  document.querySelectorAll('[data-universal-car-grid]').forEach((grid) => {
    const item = grid.closest('[data-universal-required-item]');
    const selected = Array.from(item?.querySelectorAll('[data-universal-car-choice]:checked') || []).map((input) => input.value).filter(Boolean);
    grid.innerHTML = renderStockCarCheckboxCards(selected);
    grid.querySelectorAll('[data-universal-car-choice]').forEach((input) => {
      input.closest('.universal-content-type-card')?.classList.toggle('is-checked', input.checked);
    });
  });
}

function renderUniversalRequiredItem(kind, removable = false) {
  return `
    <article class="universal-required-item create-assignment-table-row" data-universal-required-item>
      <div class="assignment-table-cell assignment-required-cell" data-cell-title="المطلوب">
        <textarea rows="2" data-universal-required-text placeholder="مكان لكتابة أول ماوس عليه يفتح واكتب"></textarea>
      </div>

      <div class="assignment-table-cell" data-cell-title="اختيار السيارة">
        <details class="checkbox-dropdown assignment-dropdown" data-checkbox-dropdown>
          <summary>Checkbox</summary>
          <div class="universal-content-type-grid stock-car-choice-grid dropdown-checkbox-panel" data-universal-car-grid>
            ${renderStockCarCheckboxCards()}
          </div>
        </details>
      </div>

      <div class="assignment-table-cell" data-cell-title="قسم المحتوى">
        <label class="mzj-field assignment-section-field table-select-field">
          <select data-content-section-select>
            ${renderContentSectionOptions()}
          </select>
        </label>
      </div>

      <div class="assignment-table-cell" data-cell-title="أنواع المحتوى">
        <details class="checkbox-dropdown assignment-dropdown" data-content-type-dropdown>
          <summary>دروب داون ليست</summary>
          <div class="universal-content-type-grid dropdown-checkbox-panel" data-universal-content-type-grid>
            ${renderUniversalContentChoiceCards(kind, '')}
          </div>
        </details>
      </div>

      <div class="assignment-table-cell assignment-departments-cell" data-cell-title="الأقسام">
        <select data-target-department-select multiple hidden>${renderDepartmentTargetOptions()}</select>
        <details class="checkbox-dropdown assignment-dropdown" data-department-dropdown>
          <summary>دروب داون ليست للأقسام</summary>
          <div class="dropdown-checkbox-panel department-checkbox-panel" data-department-checkbox-matrix></div>
        </details>
      </div>

      <div class="assignment-table-cell assignment-users-cell" data-cell-title="اليوزرات">
        <select data-user-select multiple hidden>${renderUserOptionsForDepartmentIds([])}</select>
        <details class="checkbox-dropdown assignment-dropdown" data-users-dropdown>
          <summary>دروب داون ليست للأسماء على حسب القسم الي اختارتة</summary>
          <div class="dropdown-checkbox-panel users-checkbox-panel" data-department-user-matrix></div>
        </details>
      </div>
      ${removable ? '<button class="soft-danger-btn" type="button" data-remove-universal-required>مسح الصف</button>' : ''}
    </article>`;
}
function buildSpecialDepartmentFields(kind) {
  const kindLabel = ({
    photography: 'التصوير',
    content: 'المطلوب',
    design: 'التصميم',
    montage: 'المونتاج',
    publish: 'النشر'
  })[kind] || 'القسم';

  return `
    <div class="dept-special-fields universal-required-fields" data-special-kind="${escapeHTML(kind)}">
      <div class="universal-required-list" data-universal-required-list>
        ${renderUniversalRequiredItem(kind)}
      </div>
    </div>`;
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
  const uploadAgendaTemplateBtn = document.getElementById('uploadAgendaTemplateBtn');
  const agendaTemplateFileInput = document.getElementById('agendaTemplateFile');
  const importedCampaignLogicSection = document.getElementById('importedCampaignLogicSection');
  const importedCampaignLogicBox = document.getElementById('importedCampaignLogicBox');

  if (!modal || !form || !typeSelect || !templateSelect || !departmentsList) return;

  departmentsCache = Array.isArray(departmentsCache) ? departmentsCache : [];
  usersCache = Array.isArray(usersCache) ? usersCache : [];
  let departmentIndex = 0;
  let platformsCache = [];
  let funnelsCache = [];
  let requiredContentTypesCache = [];
  let campaignTypesCache = [];
  let importedTemplateContext = {
    loaded: false,
    fileName: '',
    sheetName: '',
    campaignLogic: [],
    writingRules: [],
    contentExecutionTasks: []
  };
  let stockCarsCache = [];
  let stockCarsLoaded = false;

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
    funnelsCache = await loadMarketingFunnels();
    requiredContentTypesCache = await loadRequiredContentTypes();
    window.MZJRequiredContentTypesCache = requiredContentTypesCache;
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


  function selectedValuesFromSelect(select) {
    return Array.from(select?.selectedOptions || []).map((option) => option.value).filter(Boolean);
  }

  function renderDepartmentChipPicker(assignmentRow) {
    const select = assignmentRow?.querySelector('select[data-target-department-select]');
    const grid = assignmentRow?.querySelector('[data-department-chip-grid]');
    if (!select || !grid) return;
    select.innerHTML = renderDepartmentTargetOptions(selectedValuesFromSelect(select));
    const selected = new Set(selectedValuesFromSelect(select));
    grid.innerHTML = Array.from(select.options).filter((option) => option.value).map((option) => {
      const kind = deptKindFromName(option.dataset.departmentKind || option.dataset.departmentName || option.textContent || '');
      const active = selected.has(option.value);
      return `<button class="pro-select-chip ${active ? 'is-selected' : ''}" type="button" data-department-chip value="${escapeHTML(option.value)}" data-kind="${escapeHTML(kind)}">
        <span>${escapeHTML(option.textContent || option.value)}</span>
        <small>${active ? 'مختار' : 'اضغط للاختيار'}</small>
      </button>`;
    }).join('') || '<p class="required-content-empty">لا توجد أقسام محفوظة.</p>';
  }

  function renderUserChipPicker(assignmentRow) {
    const deptSelect = assignmentRow?.querySelector('select[data-target-department-select]');
    const userSelect = assignmentRow?.querySelector('select[data-user-select]');
    const grid = assignmentRow?.querySelector('[data-user-chip-grid]');
    if (!deptSelect || !userSelect || !grid) return;
    const selectedDeptIds = selectedValuesFromSelect(deptSelect);
    const selectedUsers = selectedValuesFromSelect(userSelect);
    userSelect.innerHTML = renderUserOptionsForDepartmentIds(selectedDeptIds, selectedUsers);
    const active = new Set(selectedValuesFromSelect(userSelect));
    const selectedDepartments = Array.from(deptSelect.selectedOptions || []).filter((option) => option.value).map((option) => {
      const dept = (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(option.value));
      return { id: dept?.id || option.value, name: dept?.name || option.dataset.departmentName || option.textContent || option.value, kind: deptKindFromName(dept?.name || option.dataset.departmentKind || option.textContent || '') };
    });

    if (!selectedDepartments.length) {
      grid.innerHTML = '<p class="required-content-empty">اختار قسم الأول علشان تظهر اليوزرات.</p>';
      return;
    }

    const options = Array.from(userSelect.options).filter((option) => option.value);
    grid.innerHTML = selectedDepartments.map((dept) => {
      const deptOptions = options.filter((option) => {
        const optionDeptId = String(option.dataset.userDepartmentId || '');
        const optionDeptName = String(option.dataset.userDepartmentName || '');
        return optionDeptId === String(dept.id || '') || optionDeptId === String(dept.name || '') || optionDeptName === String(dept.name || '') || optionDeptName === String(dept.id || '');
      });
      const cards = deptOptions.length ? deptOptions.map((option) => {
        const isActive = active.has(option.value);
        return `<button class="pro-select-chip user-chip ${isActive ? 'is-selected' : ''}" type="button" data-user-chip value="${escapeHTML(option.value)}" data-user-department-id="${escapeHTML(dept.id || '')}">
          <span>${escapeHTML(option.textContent || option.dataset.userValue || option.value)}</span>
          <small>${isActive ? 'مختار' : 'اختيار اليوزر'}</small>
        </button>`;
      }).join('') : '<p class="required-content-empty">لا يوجد يوزرات محفوظة لهذا القسم.</p>';
      return `<section class="department-user-chip-section" data-department-user-chip-section="${escapeHTML(dept.id || dept.name || '')}">
        <div class="department-user-chip-title">
          <strong>${escapeHTML(dept.name || dept.id || 'قسم')}</strong>
          <small>اختار يوزر أو أكثر من هذا القسم فقط</small>
        </div>
        <div class="department-user-chip-list">${cards}</div>
      </section>`;
    }).join('');
  }

  function refreshUniversalContentTypeCardState(item) {
    if (!item) return;
    item.querySelectorAll('[data-content-type-card], .universal-content-type-card').forEach((card) => {
      const input = card.querySelector('[data-universal-content-type]');
      const quantityWrap = card.querySelector('[data-content-type-quantity-wrap]');
      const quantityInput = card.querySelector('[data-content-type-quantity]');
      const checked = Boolean(input?.checked);
      card.classList.toggle('is-checked', checked);
      if (quantityWrap) quantityWrap.hidden = !checked;
      if (!checked && quantityInput) quantityInput.value = '';
    });
  }

  function renderDepartmentUserMatrix(assignmentRow) {
    const deptSelect = assignmentRow?.querySelector('select[data-target-department-select]');
    const userSelect = assignmentRow?.querySelector('select[data-user-select]');
    const deptMatrix = assignmentRow?.querySelector('[data-department-checkbox-matrix]');
    const userMatrix = assignmentRow?.querySelector('[data-department-user-matrix]');
    if (!deptSelect || !userSelect) return;
    const selectedDeptIds = selectedValuesFromSelect(deptSelect);
    const selectedUsers = selectedValuesFromSelect(userSelect);
    userSelect.innerHTML = renderUserOptionsForDepartmentIds(selectedDeptIds, selectedUsers);
    const activeDeptSet = new Set(selectedDeptIds.map(String));
    const activeUserSet = new Set(selectedValuesFromSelect(userSelect).map(String));
    const depts = Array.from(deptSelect.options || []).filter((option) => option.value).map((option) => {
      const dept = (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(option.value)) || {};
      const id = dept.id || option.value;
      const name = dept.name || option.dataset.departmentName || option.textContent || option.value;
      return {
        ...dept,
        id,
        name,
        kind: dept.kind || deptKindFromName(dept.name || option.dataset.departmentKind || option.textContent || id)
      };
    });

    if (deptMatrix) {
      deptMatrix.innerHTML = depts.length ? depts.map((dept) => {
        const active = activeDeptSet.has(String(dept.id || ''));
        return `<button class="matrix-department-head dropdown-check-row ${active ? 'is-selected' : ''}" type="button" data-matrix-department-chip value="${escapeHTML(dept.id || '')}">
          <input type="checkbox" tabindex="-1" ${active ? 'checked' : ''} aria-hidden="true">
          <strong>${escapeHTML(dept.name || dept.id || 'قسم')}</strong>
        </button>`;
      }).join('') : '<p class="required-content-empty">لا توجد أقسام محفوظة.</p>';
    }

    if (!userMatrix) return;
    const selectedDepartments = depts.filter((dept) => activeDeptSet.has(String(dept.id || '')));
    if (!selectedDepartments.length) {
      userMatrix.innerHTML = '<p class="required-content-empty">اختار قسم الأول علشان تظهر اليوزرات.</p>';
      return;
    }
    userMatrix.innerHTML = selectedDepartments.map((dept) => {
      const users = usersForDepartment(dept, usersCache).map(normalizeSystemUser).filter(Boolean);
      const userCards = users.length ? users.map((user) => {
        const actualValue = user.email || user.name || user.id || user.uid || '';
        const optionValue = optionValueForDepartmentUser(user, dept);
        const selected = activeUserSet.has(String(optionValue)) || activeUserSet.has(String(actualValue));
        return `<button class="matrix-user-chip dropdown-check-row ${selected ? 'is-selected' : ''}" type="button" data-matrix-user-chip value="${escapeHTML(optionValue)}">
          <input type="checkbox" tabindex="-1" ${selected ? 'checked' : ''} aria-hidden="true">
          <span>${escapeHTML(user.label || actualValue)}</span>
        </button>`;
      }).join('') : '<p class="required-content-empty">لا يوجد يوزرات في هذا القسم.</p>';
      return `<section class="department-user-matrix-card is-selected compact-users-section" data-matrix-department-card="${escapeHTML(dept.id || '')}">
        <strong class="compact-users-title">${escapeHTML(dept.name || dept.id || 'قسم')}</strong>
        <div class="matrix-users-row">${userCards}</div>
      </section>`;
    }).join('');
  }



  function assignmentSummaryText(values, fallback) {
    const clean = (values || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (!clean.length) return fallback;
    if (clean.length <= 2) return clean.join('، ');
    return clean.slice(0, 2).join('، ') + ' +' + (clean.length - 2);
  }

  function setDropdownSummary(details, text) {
    const summary = details?.querySelector('summary');
    if (!summary) return;
    summary.textContent = text;
    details.classList.toggle('has-selection', !/^اختار|^دروب|^Checkbox|^لا توجد/.test(String(text || '').trim()));
  }

  function updateAssignmentDropdownSummaries(scope = departmentsList) {
    const root = scope || departmentsList;
    const items = [];
    if (root?.matches?.('[data-universal-required-item]')) items.push(root);
    root?.querySelectorAll?.('[data-universal-required-item]').forEach((item) => items.push(item));
    Array.from(new Set(items)).forEach((item) => {
      const cars = Array.from(item.querySelectorAll('[data-universal-car-choice]:checked')).map((input) => input.value);
      const contentTypes = Array.from(item.querySelectorAll('[data-universal-content-type]:checked')).map((input) => {
        const card = input.closest('[data-content-type-card], .universal-content-type-card');
        const qty = card?.querySelector('[data-content-type-quantity]')?.value.trim() || '';
        return qty ? `${input.value} (${qty})` : input.value;
      });
      setDropdownSummary(item.querySelector('[data-checkbox-dropdown]'), assignmentSummaryText(cars, 'اختار السيارة'));
      setDropdownSummary(item.querySelector('[data-content-type-dropdown]'), assignmentSummaryText(contentTypes, 'اختار أنواع المحتوى'));
    });

    const rows = [];
    if (root?.matches?.('[data-department-assignment-row]')) rows.push(root);
    root?.querySelectorAll?.('[data-department-assignment-row]').forEach((row) => rows.push(row));
    Array.from(new Set(rows)).forEach((row) => {
      const deptSelect = row.querySelector('select[data-target-department-select]');
      const userSelect = row.querySelector('select[data-user-select]');
      const depts = Array.from(deptSelect?.selectedOptions || []).map((option) => option.textContent || option.value);
      const users = Array.from(userSelect?.selectedOptions || []).map((option) => option.textContent || option.dataset.userValue || option.value);
      setDropdownSummary(row.querySelector('[data-department-dropdown]'), assignmentSummaryText(depts, 'اختار الأقسام'));
      setDropdownSummary(row.querySelector('[data-users-dropdown]'), assignmentSummaryText(users, 'اختار اليوزرات'));
    });
  }

  function hydrateAssignmentPickers(scope = departmentsList) {
    const rows = [];
    if (scope?.matches?.('[data-department-assignment-row]')) rows.push(scope);
    scope?.querySelectorAll?.('[data-department-assignment-row]').forEach((assignmentRow) => rows.push(assignmentRow));
    Array.from(new Set(rows)).forEach((assignmentRow) => {
      renderDepartmentChipPicker(assignmentRow);
      renderUserChipPicker(assignmentRow);
      renderDepartmentUserMatrix(assignmentRow);
      assignmentRow.querySelectorAll('[data-universal-required-item]').forEach((item) => {
        refreshContentTypesForSection(item);
        refreshUniversalContentTypeCardState(item);
      });
      updateAssignmentDropdownSummaries(assignmentRow);
    });
  }

  function createDepartmentAssignmentHTML(dept, index = 1) {
    const kind = 'content';
    return `
      <article class="department-assignment-row professional-assignment-card" data-department-assignment-row data-assignment-index="${escapeHTML(index)}">
        ${buildSpecialDepartmentFields(kind)}
        ${index > 1 ? '<button class="soft-danger-btn assignment-remove-row-btn" type="button" data-remove-department-assignment>مسح الصف</button>' : ''}
      </article>
    `;
  }

  function refreshDepartmentAssignmentNumbers(deptRow) {
    if (!deptRow) return;
    Array.from(deptRow.querySelectorAll('[data-department-assignment-row]')).forEach((assignment, index) => {
      assignment.dataset.assignmentIndex = String(index + 1);
      const chip = assignment.querySelector('.assignment-number-chip');
      if (chip) chip.textContent = '\u062a\u0643\u0644\u064a\u0641 ' + (index + 1);
    });
  }

  function addDepartmentAssignmentRow(deptRow) {
    if (!deptRow) return null;
    const departmentId = deptRow.dataset.departmentId || '';
    const dept = departmentsCache.find((item) => String(item.id) === String(departmentId)) || { id: departmentId || 'content', name: 'قسم المحتوى' };
    const list = deptRow.querySelector('[data-department-assignments-list]');
    if (!list) return null;
    const nextIndex = list.querySelectorAll('[data-department-assignment-row]').length + 1;
    list.insertAdjacentHTML('beforeend', createDepartmentAssignmentHTML(dept, nextIndex));
    refreshDepartmentAssignmentNumbers(deptRow);
    const added = list.querySelector('[data-department-assignment-row]:last-child');
    hydrateAssignmentPickers(added);
    refreshStockCarCheckboxGrids();
    return added;
  }

  function getFirstDepartmentAssignment(row) {
    return row?.matches?.('[data-department-assignment-row]') ? row : row?.querySelector?.('[data-department-assignment-row]');
  }

  function createDepartmentRow(dept) {
    const row = document.createElement('article');
    row.className = 'department-task-row department-task-row-selectable department-accordion-row is-open is-selected content-hub-row';
    row.dataset.departmentId = dept.id || 'content';
    row.dataset.departmentKind = 'content';
    row.innerHTML = `
      <input type="checkbox" data-department-enabled hidden checked>
      <div class="department-task-body" data-department-body>
        <div class="assignment-table-wrap">
          <div class="assignment-table-header" aria-hidden="true">
            <span>المطلوب</span>
            <span>اختيار السيارة</span>
            <span>قسم المحتوى</span>
            <span>أنواع المحتوى</span>
            <span>الأقسام</span>
            <span>اليوزرات</span>
          </div>
          <div class="department-assignments-list" data-department-assignments-list>
            ${createDepartmentAssignmentHTML(dept, 1)}
          </div>
        </div>
        <div class="content-assignments-actions">
          <button class="soft-btn" type="button" data-add-department-assignment>+ إضافة صف جديد</button>
        </div>
      </div>
    `;
    departmentsList.appendChild(row);
    hydrateAssignmentPickers(row);
  }

  function renderAllDepartments() {
    departmentsList.innerHTML = '';
    const contentDept = (departmentsCache || []).find((dept) => deptKindFromName(dept.name || '') === 'content') || { id: 'content', name: MZJ_CONTENT_HUB_LABEL };
    createDepartmentRow(contentDept);
  }

  function renderBudgetFunnelOptions(selected = '') {
    const current = String(selected || '').trim();
    const options = ['<option value="">اختار Funnel</option>'];
    funnelsCache.forEach((funnel) => {
      options.push(`<option value="${escapeHTML(funnel.name)}" ${current === funnel.name ? 'selected' : ''}>${escapeHTML(funnel.name)}</option>`);
    });
    if (current && !funnelsCache.some((funnel) => funnel.name === current)) {
      options.push(`<option value="${escapeHTML(current)}" selected>${escapeHTML(current)}</option>`);
    }
    return options.join('');
  }

  function renderBudgetProductOptions(selected = '') {
    const current = String(selected || '').trim();
    const products = getPublishChoiceLabels();
    const options = ['<option value="">اختار المنتج</option>'];
    products.forEach((product) => {
      options.push(`<option value="${escapeHTML(product)}" ${current === product ? 'selected' : ''}>${escapeHTML(product)}</option>`);
    });
    if (current && !products.includes(current)) {
      options.push(`<option value="${escapeHTML(current)}" selected>${escapeHTML(current)}</option>`);
    }
    return options.join('');
  }

  function renderBudgetPlatformOptions(selected = '') {
    const current = String(selected || '').trim();
    const options = ['<option value="">اختار المنصة</option>'];
    platformsCache.forEach((platform) => {
      options.push(`<option value="${escapeHTML(platform.name)}" data-platform-id="${escapeHTML(platform.id)}" ${current === platform.name ? 'selected' : ''}>${escapeHTML(platform.name)}</option>`);
    });
    if (current && !platformsCache.some((platform) => platform.name === current)) {
      options.push(`<option value="${escapeHTML(current)}" selected>${escapeHTML(current)}</option>`);
    }
    return options.join('');
  }

  function refreshBudgetDropdownOptions() {
    if (!budgetItemsList) return;
    budgetItemsList.querySelectorAll('[data-budget-funnel]').forEach((select) => {
      const current = select.value;
      select.innerHTML = renderBudgetFunnelOptions(current);
    });
    budgetItemsList.querySelectorAll('[data-budget-product]').forEach((select) => {
      const current = select.value;
      select.innerHTML = renderBudgetProductOptions(current);
    });
    budgetItemsList.querySelectorAll('[data-budget-platform]').forEach((select) => {
      const current = select.value;
      select.innerHTML = renderBudgetPlatformOptions(current);
    });
  }

  function createBudgetItem(data = {}) {
    if (!budgetItemsList) return;
    const itemIndex = budgetItemsList.querySelectorAll('[data-budget-item]').length + 1;
    const item = document.createElement('article');
    item.className = 'budget-item-accordion is-open budget-item-simple budget-item-compact';
    item.dataset.budgetItem = String(itemIndex);
    const platformName = data.platformName || data.platform || data.platforms?.[0]?.name || '';
    const amount = data.value || data.amount || data.itemTotal || data.platforms?.[0]?.amount || '';
    item.innerHTML = `
      <div class="budget-item-body budget-item-body-compact" data-budget-body>
        <div class="budget-compact-row">
          <strong class="budget-compact-title">ميزانية ${itemIndex}</strong>
          <label class="mzj-field">
            <span>Funnel</span>
            <select data-budget-funnel>${renderBudgetFunnelOptions(data.funnel || data.funnelName || '')}</select>
          </label>
          <label class="mzj-field budget-new-funnel-inline">
            <span>Funnel جديد</span>
            <input type="text" data-new-budget-funnel placeholder="اكتب Funnel">
          </label>
          <button class="soft-btn budget-save-funnel-inline" type="button" data-save-budget-funnel>حفظ</button>
          <label class="mzj-field">
            <span>المنتج</span>
            <select data-budget-product>${renderBudgetProductOptions(data.product || data.productName || data.adName || '')}</select>
          </label>
          <label class="mzj-field">
            <span>المنصة</span>
            <select data-budget-platform>${renderBudgetPlatformOptions(platformName)}</select>
          </label>
          <label class="mzj-field">
            <span>القيمة</span>
            <input type="number" min="0" step="1" data-budget-value placeholder="القيمة" value="${escapeHTML(amount || '')}">
          </label>
          <div class="budget-total-box budget-item-total-box budget-total-inline">
            <span>الإجمالي</span>
            <strong data-budget-item-total>0</strong>
          </div>
          <button class="soft-danger-btn" type="button" data-remove-budget-item>مسح</button>
        </div>
      </div>
    `;
    budgetItemsList.appendChild(item);
    updateBudgetTotal();
  }
  function collectBudgetItem(item) {
    const platformSelect = item.querySelector('[data-budget-platform]');
    const platformOption = platformSelect?.selectedOptions?.[0];
    const amount = Number(item.querySelector('[data-budget-value]')?.value || 0);
    const platformName = platformSelect?.value || '';
    const platformId = platformOption?.dataset.platformId || platformName;
    const product = item.querySelector('[data-budget-product]')?.value || '';
    const funnel = item.querySelector('[data-budget-funnel]')?.value || '';
    const platforms = platformName || amount > 0 ? [{
      id: platformId,
      name: platformName,
      amount,
      selected: Boolean(platformName || amount > 0)
    }] : [];
    return {
      funnel,
      funnelName: funnel,
      product,
      productName: product,
      platform: platformName,
      platformName,
      value: amount,
      amount,
      adType: funnel,
      adName: product,
      publishDate: '',
      duration: '',
      adsCount: '',
      contentGoal: '',
      expectedGoal: '',
      platforms,
      itemTotal: amount
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
      if (summary) summary.textContent = `${details.funnel || 'Funnel غير محدد'} / ${details.product || 'منتج غير محدد'} / ${details.platform || 'منصة غير محددة'} — ${details.itemTotal.toLocaleString('ar-EG')}`;
      const title = item.querySelector('.budget-item-toggle strong');
      if (title) title.textContent = `إعلان / ميزانية ${index + 1}`;
    });
    budgetGrandTotalValue.textContent = grandTotal.toLocaleString('ar-EG');
  }

  function formatDateISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function arabicDayName(date) {
    return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][date.getDay()];
  }

  function arabicMonthName(date) {
    return date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  }

  function getPublishChoiceLabels() {
    const labels = [];
    const pushLabel = (label) => {
      const clean = templateCellText(label || '');
      if (clean && !labels.includes(clean)) labels.push(clean);
    };
    departmentsList?.querySelectorAll('[data-department-assignment-row]').forEach((row) => {
      const selectedDeptKinds = selectedValuesFromSelect(row.querySelector('select[data-target-department-select]')).map((deptId) => {
        const option = row.querySelector(`select[data-target-department-select] option[value="${CSS.escape(deptId)}"]`);
        const dept = (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(deptId));
        return deptKindFromName(dept?.name || option?.dataset.departmentKind || option?.dataset.departmentName || option?.textContent || deptId);
      });
      const shouldPublish = selectedDeptKinds.includes('design') || selectedDeptKinds.includes('montage');
      if (!shouldPublish) return;
      row.querySelectorAll('[data-universal-required-item]').forEach((item) => {
        const selectedTypes = Array.from(item.querySelectorAll('[data-universal-content-type]:checked'));
        const cars = Array.from(item.querySelectorAll('[data-universal-car-choice]:checked')).map((input) => templateCellText(input.value)).filter(Boolean).join('، ') || templateCellText(item.querySelector('[data-universal-car-type]')?.value || '');
        const size = templateCellText(item.querySelector('[data-universal-print-size]')?.value || '');
        const note = templateCellText(item.querySelector('[data-universal-required-text]')?.value || '');
        selectedTypes.forEach((selectedType) => {
          const title = templateCellText(selectedType?.value || '');
          const desc = templateCellText(selectedType?.dataset.desc || '');
          const label = [
            selectedDeptKinds.includes('design') ? 'تصميم' : '',
            selectedDeptKinds.includes('montage') ? 'مونتاج' : '',
            title,
            cars ? `السيارة: ${cars}` : '',
            size ? `المقاس: ${size}` : '',
            desc || note
          ].filter(Boolean).join(' — ');
          pushLabel(label);
        });
      });
    });
    return labels;
  }

  function getPublishChoicesUsedByOtherDays(currentDate = '') {
    const used = new Set();
    if (!publishScheduleRows) return used;
    publishScheduleRows.querySelectorAll('[data-publish-calendar-cell]').forEach((row) => {
      const date = row.querySelector('[data-schedule-date]')?.value || row.dataset.date || '';
      if (String(date) === String(currentDate)) return;
      row.querySelectorAll('[data-schedule-content]:checked').forEach((input) => {
        if (input.value) used.add(input.value);
      });
    });
    return used;
  }

  function renderPublishChoicesChecklist(selected = [], currentDate = '') {
    const usedElsewhere = getPublishChoicesUsedByOtherDays(currentDate);
    const values = getPublishChoiceLabels().filter((value) => selected.includes(value) || !usedElsewhere.has(value));
    if (!values.length) return '<p class="publish-choice-empty">كل عناصر النشر المختارة مستخدمة في أيام تانية. امسحها من اليوم القديم علشان تظهر هنا.</p>';
    return values.map((value, index) => {
      const id = `publish-choice-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
      return `<label class="publish-choice-checkpoint">
        <input type="checkbox" data-schedule-content value="${escapeHTML(value)}" ${selected.includes(value) ? 'checked' : ''}>
        <span>${escapeHTML(value)}</span>
      </label>`;
    }).join('');
  }

  function renderPublishCalendarDay(date, items = [], isOutOfRange = false) {
    const iso = formatDateISO(date);
    const selected = Array.isArray(items) ? items : [];
    const summary = selected.length ? selected.map((item) => `<span>${escapeHTML(item)}</span>`).join('') : '<em>اضغط لاختيار النشر</em>';
    return `
      <article class="publish-schedule-row publish-calendar-cell ${isOutOfRange ? 'is-muted' : ''}" data-publish-calendar-cell data-date="${escapeHTML(iso)}">
        <button class="publish-calendar-date-btn" type="button" data-open-publish-day ${isOutOfRange ? 'disabled' : ''}>
          <span class="publish-calendar-weekday">${escapeHTML(arabicDayName(date))}</span>
          <strong>${date.getDate()}</strong>
          <small>${escapeHTML(iso)}</small>
          <div class="publish-calendar-summary">${summary}</div>
        </button>
        <div class="publish-day-editor" data-publish-day-editor hidden>
          <input type="hidden" data-schedule-day value="${escapeHTML(arabicDayName(date))}">
          <input type="hidden" data-schedule-date value="${escapeHTML(iso)}">
          <div class="publish-choice-box">
            <strong>اختار ما سيتم نشره في اليوم ده</strong>
            <div class="publish-choice-list" data-publish-choice-list>${renderPublishChoicesChecklist(selected, iso)}</div>
          </div>
          <small class="admin-only-note">تقدر تختار أكتر من عنصر للنشر في نفس اليوم.</small>
        </div>
      </article>`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function buildPublishCalendar(force = false) {
    if (!publishScheduleRows) {
      if (note) note.textContent = '⚠️ مكان جدول النشر غير موجود في الصفحة.';
      return false;
    }

    let startValue = campaignStartDateInput?.value || '';
    let endValue = campaignEndDateInput?.value || '';

    if (!startValue) {
      startValue = document.getElementById('taskDate')?.value || todayISODate();
      if (campaignStartDateInput) campaignStartDateInput.value = startValue;
    }
    if (!endValue) {
      endValue = startValue;
      if (campaignEndDateInput) campaignEndDateInput.value = endValue;
    }

    let startDate = new Date(startValue + 'T00:00:00');
    let endDate = new Date(endValue + 'T00:00:00');

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      if (note) note.textContent = '⚠️ تاريخ بداية أو نهاية النشر غير صحيح.';
      return false;
    }

    if (endDate < startDate) {
      const fixed = startValue;
      endValue = fixed;
      if (campaignEndDateInput) campaignEndDateInput.value = fixed;
      endDate = new Date(fixed + 'T00:00:00');
    }

    const previous = new Map();
    publishScheduleRows.querySelectorAll('[data-publish-calendar-cell], .publish-schedule-row').forEach((row) => {
      const date = row.querySelector('[data-schedule-date]')?.value || row.dataset.date || '';
      const selected = Array.from(row.querySelectorAll('[data-schedule-content]:checked')).map((input) => input.value).filter(Boolean);
      if (date) previous.set(date, selected);
    });

    const months = new Map();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = monthKey(d);
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(new Date(d));
    }

    publishScheduleRows.innerHTML = '';
    publishScheduleRows.classList.add('publish-calendar-board');

    months.forEach((days) => {
      const monthStart = new Date(days[0].getFullYear(), days[0].getMonth(), 1);
      const blanks = monthStart.getDay(); // الأحد = 0
      const monthWrap = document.createElement('section');
      monthWrap.className = 'publish-calendar-month';
      monthWrap.innerHTML = `
        <div class="publish-calendar-month-head">
          <h5>${escapeHTML(arabicMonthName(days[0]))}</h5>
          <small>اضغط على أي يوم واختار ما سيتم نشره</small>
        </div>
        <div class="publish-calendar-week-header">
          ${['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'].map((day) => `<span>${day}</span>`).join('')}
        </div>
        <div class="publish-calendar-grid"></div>
      `;
      const grid = monthWrap.querySelector('.publish-calendar-grid');
      for (let i = 0; i < blanks; i += 1) {
        const blank = document.createElement('div');
        blank.className = 'publish-calendar-blank';
        grid.appendChild(blank);
      }
      days.forEach((day) => {
        const iso = formatDateISO(day);
        grid.insertAdjacentHTML('beforeend', renderPublishCalendarDay(day, previous.get(iso) || []));
      });
      publishScheduleRows.appendChild(monthWrap);
    });

    if (note) note.textContent = `✅ تم إنشاء تقويم النشر من ${startValue} إلى ${endValue}. اضغط على اليوم لاختيار المحتوى.`;
    return true;
  }

  function refreshPublishCalendarOptions() {
    if (!publishScheduleRows) return;
    if (!publishScheduleRows.querySelector('[data-publish-calendar-cell]')) {
      buildPublishCalendar(false);
      return;
    }
    publishScheduleRows.querySelectorAll('[data-publish-calendar-cell]').forEach((row) => {
      const list = row.querySelector('[data-publish-choice-list]');
      if (!list) return;
      const selected = Array.from(row.querySelectorAll('[data-schedule-content]:checked')).map((input) => input.value).filter(Boolean);
      list.innerHTML = renderPublishChoicesChecklist(selected, row.querySelector('[data-schedule-date]')?.value || row.dataset.date || '');
      const summary = row.querySelector('.publish-calendar-summary');
      if (summary) summary.innerHTML = selected.length ? selected.map((item) => `<span>${escapeHTML(item)}</span>`).join('') : '<em>اضغط لاختيار النشر</em>';
    });
  }

  function collectPublishScheduleDetails() {
    if (!publishScheduleRows) return [];
    return Array.from(publishScheduleRows.querySelectorAll('[data-publish-calendar-cell]')).map((row) => {
      const items = Array.from(row.querySelectorAll('[data-schedule-content]:checked')).map((input) => input.value).filter(Boolean);
      return {
        day: row.querySelector('[data-schedule-day]')?.value || '',
        date: row.querySelector('[data-schedule-date]')?.value || row.dataset.date || '',
        items,
        content: items.join(' + ')
      };
    }).filter((item) => item.day || item.date || item.content);
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
    assignmentRow.querySelectorAll('[data-required-text], [data-content-required-text]').forEach((textarea) => { textarea.value = ''; });
    assignmentRow.querySelectorAll('[data-content-car-type], [data-design-print-size]').forEach((input) => { input.value = ''; });
    assignmentRow.querySelectorAll('[data-design-print-size-wrap]').forEach((wrap) => { wrap.hidden = true; });
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

  function uniqueContentTypesFromImportedTasks(tasks, options = {}) {
    const sourceType = options.sourceType || importedTemplateContext?.sourceType || '';
    if (sourceType === 'agenda') {
      const map = new Map();
      (tasks || []).forEach((task, index) => {
        const contentType = templateCellText(task?.contentType) || `محتوى ${index + 1}`;
        task.linkKey = contentType;
        if (!map.has(contentType)) map.set(contentType, []);
        map.get(contentType).push(task);
      });
      return Array.from(map.entries()).map(([contentType, items]) => ({
        linkKey: contentType,
        contentType,
        label: contentType,
        items,
        isAgendaGroup: true
      }));
    }
    const map = new Map();
    (tasks || []).forEach((task) => {
      const contentType = templateCellText(task?.contentType);
      if (!contentType) return;
      if (!map.has(contentType)) map.set(contentType, []);
      map.get(contentType).push(task);
    });
    return Array.from(map.entries()).map(([contentType, items]) => ({ linkKey: contentType, contentType, label: contentType, items }));
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

  function normalizeStockCar(doc) {
    const value = doc || {};
    const vin = templateCellText(value.vin || value.id || value.docId || '');
    const carName = templateCellText(value.carName || value.name || value.title || '');
    const statement = templateCellText(value.statement || value.description || '');
    const model = templateCellText(value.model || value.year || '');
    const exteriorColor = templateCellText(value.exteriorColor || value.extColor || value.color || value.outerColor || '');
    const interiorColor = templateCellText(value.interiorColor || value.intColor || value.insideColor || '');
    const status = templateCellText(value.status || '');
    const display = [carName, statement, model, exteriorColor, interiorColor, vin ? `VIN: ${vin}` : '', status].filter(Boolean).join('\n');
    return { id: templateCellText(value.docId || vin || display), vin, carName, statement, model, exteriorColor, interiorColor, status, display };
  }

  function stockSpecKey(car) {
    return [car?.carName || 'بدون ماركة', car?.statement || 'بدون مواصفة', car?.model || 'بدون موديل'].join('\n');
  }

  function buildStockSpecsForDropdown(cars) {
    const map = new Map();
    (cars || []).forEach((car) => {
      if (!car?.carName && !car?.statement && !car?.model) return;
      const key = stockSpecKey(car);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          carName: car.carName,
          statement: car.statement,
          model: car.model,
          count: 0,
          exteriorColors: new Set(),
          interiorColors: new Set(),
          statuses: new Map()
        });
      }
      const item = map.get(key);
      item.count += 1;
      if (car.exteriorColor) item.exteriorColors.add(car.exteriorColor);
      if (car.interiorColor) item.interiorColors.add(car.interiorColor);
      if (car.status) item.statuses.set(car.status, (item.statuses.get(car.status) || 0) + 1);
    });

    return Array.from(map.values()).map((item) => {
      const exterior = Array.from(item.exteriorColors).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true })).join(' / ');
      const interior = Array.from(item.interiorColors).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true })).join(' / ');
      const statuses = Array.from(item.statuses.entries()).sort((a, b) => b[1] - a[1]).map(([status, count]) => `${status}: ${count}`).join(' / ');
      const display = [
        item.carName,
        item.statement,
        item.model
      ].filter(Boolean).join('\n');
      return { ...item, display };
    }).filter((item) => item.display).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.display.localeCompare(b.display, 'ar', { numeric: true });
    });
  }

  function shouldHideStockCar(car) {
    const status = templateCellText(car?.status).toLowerCase();
    const hasSpec = !!(car?.carName || car?.statement || car?.model);
    return !hasSpec || status.includes('أرشيف') || status.includes('مؤرشف') || status.includes('مباع تم التسليم');
  }

  async function loadStockCarsForDropdown(force = false) {
    if (stockCarsLoaded && !force) return stockCarsCache;
    stockCarsLoaded = true;
    stockCarsCache = [];
    window.MZJCreateTaskStockCarsCache = stockCarsCache;
    try {
      if (!window.firebase || !firebase.firestore || !window.MZJ_STOCK_FIREBASE_CONFIG) { window.MZJCreateTaskStockCarsCache = stockCarsCache; return stockCarsCache; }
      const appName = 'mzjStockReadonlyApp';
      let stockApp = null;
      try { stockApp = firebase.app(appName); } catch (_error) { stockApp = firebase.initializeApp(window.MZJ_STOCK_FIREBASE_CONFIG, appName); }
      const collectionName = window.MZJ_STOCK_CARS_COLLECTION || 'cars';
      const snap = await stockApp.firestore().collection(collectionName).get();
      const items = [];
      snap.forEach((doc) => {
        const car = normalizeStockCar({ ...(doc.data() || {}), docId: doc.id });
        if (!shouldHideStockCar(car)) items.push(car);
      });
      stockCarsCache = buildStockSpecsForDropdown(items);
      window.MZJCreateTaskStockCarsCache = stockCarsCache;
    } catch (error) {
      console.warn('Stock cars dropdown load failed:', error);
      stockCarsCache = [];
      window.MZJCreateTaskStockCarsCache = stockCarsCache;
    }
    window.MZJCreateTaskStockCarsCache = stockCarsCache;
    return stockCarsCache;
  }

  function renderStockCarsDatalist() {
    if (!stockCarsCache.length) return '<datalist id="stockCarsDatalist"></datalist>';
    return `<datalist id="stockCarsDatalist">${stockCarsCache.map((car) => `<option value="${escapeHTML(car.display)}"></option>`).join('')}</datalist>`;
  }

  function refreshStockCarsDatalist() {
    const html = renderStockCarsDatalist();
    const current = document.getElementById('stockCarsDatalist');
    if (current) {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const next = wrap.firstElementChild;
      if (next) current.replaceWith(next);
    } else if (form) {
      form.insertAdjacentHTML('beforeend', html);
    }
  }

  function renderContentTypeLinkAssignmentRow() {
    return `
      <div class="content-type-link-assignment" data-content-type-link-assignment>
        <label class="mzj-field"><span>القسم</span><select data-content-type-department>${renderDepartmentOptions()}</select></label>
        <label class="mzj-field"><span>اليوزر في القسم</span><select data-content-type-user><option value="">اختار القسم الأول</option></select></label>
        <label class="mzj-field content-type-car-field"><span>السيارة المطلوبة من حصر الماركات والمواصفات والألوان</span><input type="text" list="stockCarsDatalist" data-content-type-car placeholder="ابحث بالماركة / المواصفة / اللون"></label>
        <button class="danger-btn ghost-btn content-type-link-remove" type="button" data-remove-content-type-link title="مسح هذا الربط">مسح</button>
      </div>`;
  }


  function agendaTaskDisplayNo(task, index) {
    return templateCellText(task?.taskNo) || `AG-T${String(index + 1).padStart(2, '0')}`;
  }

  function renderAgendaTaskLinkBlock(task, index) {
    const taskNo = agendaTaskDisplayNo(task, index);
    const description = templateCellText(task?.title || task?.description || task?.idea || '');
    return `
      <div class="agenda-task-link-block" data-agenda-task-link-block data-task-link-key="${escapeHTML(task.linkKey || '')}">
        <div class="agenda-task-link-head">
          <strong>${escapeHTML(taskNo)}</strong>
          ${description ? `<span>${escapeHTML(description)}</span>` : ''}
        </div>
        <div class="content-type-link-assignments" data-content-type-link-list>
          ${renderContentTypeLinkAssignmentRow()}
        </div>
        <button class="secondary-btn content-type-link-add" type="button" data-add-content-type-link>+ إضافة قسم / يوزر</button>
      </div>`;
  }

  function renderContentTypeLinkingPanel(context) {
    const groups = uniqueContentTypesFromImportedTasks(context?.contentExecutionTasks || [], { sourceType: context?.sourceType || '' });
    if (!groups.length) return '';
    return `
      <div class="campaign-context-panel content-type-linking-panel" data-content-type-linking-panel>
        <h5>ربط أنواع المحتوى بالأقسام</h5>
        <p class="admin-only-note">السيستم قرأ أنواع المحتوى من الشيت. لو ده شيت أجندة، كل نوع محتوى يظهر ككارت واحد وجواه كل التكرارات تحت بعض، وكل تاسك له القسم واليوزر والسيارة الخاصة به.</p>
        <div class="content-type-linking-grid">
          ${groups.map((group) => `
            <article class="content-type-link-card ${group.isAgendaGroup ? 'is-agenda-group-card' : ''}" data-content-type-link-row data-content-type="${escapeHTML(group.contentType)}" data-link-key="${escapeHTML(group.linkKey || group.contentType)}">
              <div class="content-type-link-title">
                <strong>${escapeHTML(group.label || group.contentType)}</strong>
                <span>${group.items.length} تاسك</span>
              </div>
              ${group.isAgendaGroup ? `
                <div class="agenda-task-link-list">
                  ${group.items.map((item, itemIndex) => renderAgendaTaskLinkBlock(item, itemIndex)).join('')}
                </div>` : `
                <div class="content-type-link-assignments" data-content-type-link-list>
                  ${renderContentTypeLinkAssignmentRow()}
                </div>
                <button class="secondary-btn content-type-link-add" type="button" data-add-content-type-link>+ إضافة قسم / يوزر</button>`}
            </article>`).join('')}
        </div>
        ${renderStockCarsDatalist()}
        <button class="primary-btn" type="button" data-apply-content-type-linking>تطبيق الربط على التاسكات</button>
      </div>`;
  }

  function renderImportedExecutionTable(tasks) {
    if (!Array.isArray(tasks) || !tasks.length) return '';
    const columns = [
      ['campaignType', 'نوع الحملة', 'is-short'],
      ['contentType', 'نوع المحتوى', 'is-short'],
      ['taskNo', 'رقم التاسك', 'is-short'],
      ['goal', 'الهدف', ''],
      ['tangibleGoal', 'الهدف الملموس', ''],
      ['idea', 'الفكرة', ''],
      ['description', 'وصف المحتوى', ''],
      ['message', 'الرسالة', ''],
      ['writerRequest', 'المطلوب من الكاتب', ''],
      ['cta', 'CTA', '']
    ];
    return `
      <div class="campaign-context-panel campaign-execution-panel">
        <div class="campaign-context-panel-head">
          <div>
            <span class="eyebrow">Content Execution Direction</span>
            <h5>Content Execution Direction - آلية تنفيذ المحتوى</h5>
            <p>الجدول ده بيعرض كل البيانات المقروءة من الشيت كما هي، بالترتيب داخل حقول واضحة.</p>
          </div>
          <span class="task-count-badge">${tasks.length} تاسك</span>
        </div>
        <div class="campaign-execution-table-wrap">
          <table class="campaign-execution-table">
            <thead>
              <tr>
                ${columns.map(([, label]) => `<th>${label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tasks.map((task) => `
                <tr>
                  ${columns.map(([key, , className]) => {
                    const value = escapeHTML(task?.[key] || '—').replace(/\n/g, '<br>');
                    return `<td class="${className}">${value}</td>`;
                  }).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderImportedCampaignContext(context) {
    if (!importedCampaignLogicSection || !importedCampaignLogicBox) return;
    const logic = Array.isArray(context?.campaignLogic) ? context.campaignLogic : [];
    const rules = Array.isArray(context?.writingRules) ? context.writingRules : [];
    const executionTasks = Array.isArray(context?.contentExecutionTasks) ? context.contentExecutionTasks : [];
    const linkingHtml = renderContentTypeLinkingPanel(context);
    if (!logic.length && !rules.length && !executionTasks.length && !linkingHtml) {
      importedCampaignLogicSection.hidden = true;
      importedCampaignLogicBox.innerHTML = '';
      return;
    }
    importedCampaignLogicSection.hidden = false;
    const logicHtml = logic.length ? `
      <div class="campaign-context-panel campaign-sheet-panel">
        <div class="campaign-context-panel-head">
          <div>
            <span class="eyebrow">campaign logic</span>
            <h5>Campaign Logic</h5>
            <p>القسم ده بيتغير حسب الشيت المرفوع، وبيعرض عناصر الـ Campaign Logic بشكل منظم وواضح.</p>
          </div>
        </div>
        <div class="campaign-sheet-logic-list">
          ${logic.map((item) => `
            <article class="campaign-sheet-field">
              <strong>${escapeHTML(item.label)}</strong>
              <p>${escapeHTML(item.value).replace(/\n/g, '<br>')}</p>
            </article>`).join('')}
        </div>
      </div>` : '';
    const rulesHtml = rules.length ? `
      <div class="campaign-context-panel campaign-sheet-panel">
        <div class="campaign-context-panel-head">
          <div>
            <span class="eyebrow">قواعد كتابة المحتوى</span>
            <h5>قواعد كتابة المحتوى</h5>
            <p>القواعد دي متقروءة من نفس شيت محتوى الحملة، وبتظهر هنا بنفس النص الموجود في الشيت.</p>
          </div>
        </div>
        <article class="campaign-sheet-field campaign-sheet-field--rules">
          <strong>قواعد كتابة المحتوى</strong>
          <ul class="campaign-writing-rules">${rules.map((rule) => `<li>${escapeHTML(rule)}</li>`).join('')}</ul>
        </article>
      </div>` : '';
    const executionHtml = renderImportedExecutionTable(executionTasks);
    importedCampaignLogicBox.innerHTML = logicHtml + rulesHtml + executionHtml + linkingHtml;
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
    const mapping = new Map();

    const rows = Array.from(panel.querySelectorAll('[data-content-type-link-row]'));
    rows.forEach((row) => {
      const contentType = row.dataset.contentType || '';
      const linkKey = row.dataset.linkKey || contentType;

      const agendaBlocks = Array.from(row.querySelectorAll('[data-agenda-task-link-block]'));
      if (agendaBlocks.length) {
        agendaBlocks.forEach((block) => {
          const taskLinkKey = block.dataset.taskLinkKey || '';
          const assignments = Array.from(block.querySelectorAll('[data-content-type-link-assignment]')).map((assignment) => ({
            deptId: assignment.querySelector('[data-content-type-department]')?.value || '',
            userValue: assignment.querySelector('[data-content-type-user]')?.value || '',
            carValue: assignment.querySelector('[data-content-type-car]')?.value || ''
          })).filter((item) => item.deptId);
          if (taskLinkKey && assignments.length) mapping.set(taskLinkKey, assignments);
        });
        return;
      }

      const assignments = Array.from(row.querySelectorAll('[data-content-type-link-assignment]')).map((assignment) => ({
        deptId: assignment.querySelector('[data-content-type-department]')?.value || '',
        userValue: assignment.querySelector('[data-content-type-user]')?.value || '',
        carValue: assignment.querySelector('[data-content-type-car]')?.value || ''
      })).filter((item) => item.deptId);
      if (linkKey && assignments.length) mapping.set(linkKey, assignments);
    });

    if (!mapping.size) {
      if (note) note.textContent = '⚠️ اختار قسم واحد على الأقل لتاسك واحد.';
      return;
    }

    clearImportedContentAssignments();
    const perDeptCount = {};
    let created = 0;
    tasks.forEach((task) => {
      const taskKey = task.linkKey || templateCellText(task.contentType);
      const links = mapping.get(taskKey) || mapping.get(templateCellText(task.contentType)) || [];
      links.forEach((mapItem) => {
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
        const carLine = templateCellText(mapItem.carValue || task.carType) ? `السيارة المطلوبة: ${templateCellText(mapItem.carValue || task.carType)}` : '';
        const taskText = [carLine, task.requiredText || buildContentExecutionTaskText(task)].filter(Boolean).join('\n');
        fillAssignmentText(kind, assignmentRow, taskText);
        created += 1;
      });
    });
    importedTemplateContext.contentTypeMapping = Array.from(mapping.entries()).map(([linkKey, items]) => ({ linkKey, contentType: linkKey, items }));
    if (note) note.textContent = `✅ تم ربط ${created} تكليف. راجع المطلوب واليوزرات ثم اضغط حفظ.`;
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
      rowData.linkKey = `${rowData.contentType}__${rowData.taskNo}__${importedRows.length}`;
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
      const choices = [cells[col.choice1], cells[col.choice2], cells[col.choice3]].map(templateCellText).filter(Boolean).join('\n');
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

  function findAgendaContentSheetName(workbook) {
    const names = workbook.SheetNames || [];
    const preferred = names.find((name) => /agenda|أجندة|اجندة/i.test(name));
    if (preferred) return preferred;
    const byHeader = names.find((name) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false });
      return rows.slice(0, 20).some((row) => (row || []).some((cell) => templateCellText(cell).includes('نوع المحتوى')));
    });
    return byHeader || names[0];
  }

  function findAgendaHeaderRow(rows) {
    return (rows || []).findIndex((row) => {
      const cells = (row || []).map(templateCellText);
      return cells.some((cell) => cell.includes('نوع المحتوى') || cell.includes('نوع المحتوي'));
    });
  }

  function applyAgendaTemplateRows(rows, fileName = '', sheetName = '') {
    typeSelect.value = 'agenda';
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const headerIndex = findAgendaHeaderRow(rows);
    if (headerIndex < 0) {
      if (note) note.textContent = '⚠️ شيت الأجندة لازم يكون فيه عامود اسمه نوع المحتوى.';
      return false;
    }
    const headers = rows[headerIndex] || [];
    const col = {
      contentType: findHeaderColumnLoose(headers, ['نوع المحتوى', 'نوع المحتوي', 'Content Type']),
      taskNo: findHeaderColumnLoose(headers, ['رقم التاسك', 'رقم المهمة', 'Task No']),
      title: findHeaderColumnLoose(headers, ['العنوان', 'اسم التاسك', 'الموضوع']),
      goal: findHeaderColumnLoose(headers, ['الهدف']),
      tangibleGoal: findHeaderColumnLoose(headers, ['الهدف الملموس']),
      idea: findHeaderColumnLoose(headers, ['الفكرة', 'الفكره']),
      description: findHeaderColumnLoose(headers, ['وصف المحتوى', 'وصف المحتوي', 'الوصف']),
      message: findHeaderColumnLoose(headers, ['الرسالة', 'الرساله']),
      writerRequest: findHeaderColumnLoose(headers, ['المطلوب من الكاتب', 'المطلوب من اليوزر', 'المطلوب']),
      cta: findHeaderColumnLoose(headers, ['CTA']),
      carType: findHeaderColumnLoose(headers, ['السيارة المطلوبة', 'السيارة', 'نوع السيارة']),
      requiredDate: findHeaderColumnLoose(headers, ['التاريخ المطلوب', 'تاريخ النشر', 'تاريخ المحتوى']),
      deliveryDate: findHeaderColumnLoose(headers, ['تاريخ التسليم'])
    };
    if (col.contentType < 0) return false;
    const importedRows = [];
    for (let r = headerIndex + 1; r < rows.length; r += 1) {
      const cells = rows[r] || [];
      if (!cells.some((cell) => templateCellText(cell))) continue;
      const contentType = templateCellText(cells[col.contentType]);
      if (!contentType) continue;
      const safeColValue = (columnIndex) => columnIndex >= 0 ? templateCellText(cells[columnIndex]) : '';
      const defaultTaskNo = `AG-T${String(importedRows.length + 1).padStart(2, '0')}`;
      const rawTaskNo = safeColValue(col.taskNo);
      const rawTitle = safeColValue(col.title);
      const sameAsContentType = (value) => {
        const normalize = (item) => templateCellText(item).toLowerCase().replace(/[\s_\-–—|/\\]+/g, '');
        return normalize(value) && normalize(value) === normalize(contentType);
      };
      const rowData = {
        campaignType: 'أجندة',
        contentType,
        taskNo: rawTaskNo && !sameAsContentType(rawTaskNo) ? rawTaskNo : defaultTaskNo,
        title: rawTitle && !sameAsContentType(rawTitle) ? rawTitle : '',
        goal: safeColValue(col.goal),
        tangibleGoal: safeColValue(col.tangibleGoal),
        idea: safeColValue(col.idea),
        description: safeColValue(col.description),
        message: safeColValue(col.message),
        writerRequest: safeColValue(col.writerRequest),
        cta: safeColValue(col.cta),
        carType: safeColValue(col.carType),
        requiredDate: normalizeImportedDate(safeColValue(col.requiredDate)),
        deliveryDate: normalizeImportedDate(safeColValue(col.deliveryDate))
      };
      rowData.linkKey = `${rowData.contentType}__${rowData.taskNo}__${importedRows.length}`;
      rowData.requiredText = buildContentExecutionTaskText(rowData);
      importedRows.push(rowData);
    }
    if (!importedRows.length) {
      if (note) note.textContent = '⚠️ لم يتم العثور على صفوف أجندة بعد عامود نوع المحتوى.';
      return false;
    }
    const agendaName = campaignInfoValueBeforeExecution(rows, ['اسم الأجندة', 'اسم الاجندة', 'اسم الحملة / الأجندة']);
    if (agendaName && campaignNameInput) campaignNameInput.value = templateCellText(agendaName);
    importedTemplateContext = {
      loaded: true,
      fileName: fileName || '',
      sheetName: sheetName || '',
      campaignLogic: [],
      writingRules: [],
      contentExecutionTasks: importedRows,
      sourceType: 'agenda'
    };
    renderImportedCampaignContext(importedTemplateContext);
    if (note) note.textContent = `✅ تم قراءة ${importedRows.length} تاسك من شيت الأجندة. اختار لكل نوع محتوى الأقسام واليوزرات والسيارة المطلوبة، ثم اضغط تطبيق الربط.`;
    return true;
  }

  async function handleAgendaTemplateUpload(file) {
    if (!file) return;
    if (!window.XLSX) {
      if (note) note.textContent = '⚠️ مكتبة قراءة Excel لم يتم تحميلها. تأكد من الاتصال بالإنترنت.';
      return;
    }
    try {
      await ensureDepartments();
      await loadStockCarsForDropdown();
      refreshStockCarsDatalist();
      refreshStockCarCheckboxGrids();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = findAgendaContentSheetName(workbook);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const cleanRows = rows.map((row) => (row || []).map((cell) => templateCellText(cell))).filter((row) => row.some(Boolean));
      applyAgendaTemplateRows(cleanRows, file.name, sheetName);
    } catch (error) {
      if (note) note.textContent = '⚠️ فشل تحميل شيت الأجندة: ' + (error?.message || error);
    }
  }

  async function handleFilledTemplateUpload(file) {
    if (!file) return;
    if (!window.XLSX) {
      if (note) note.textContent = '⚠️ مكتبة قراءة Excel لم يتم تحميلها. تأكد من الاتصال بالإنترنت.';
      return;
    }
    try {
      await ensureDepartments();
      await loadStockCarsForDropdown();
      refreshStockCarsDatalist();
      refreshStockCarCheckboxGrids();
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
      return item.funnel || item.product || item.platform || item.value || item.platforms.length;
    }) : [];
    const totalBudget = items.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0);
    return {
      items,
      totalBudget,
      adsCount: items.length,
      platformsTotal: totalBudget,
      mode: 'funnel_product_platform'
    };
  }

  function collectSpecialDepartmentDetails(row, kind) {
    const items = [];
    Array.from(row.querySelectorAll('[data-universal-required-item]')).forEach((item) => {
      const contentSectionSelect = item.querySelector('[data-content-section-select]');
      const contentSectionId = contentSectionSelect?.value || '';
      const contentSectionName = contentSectionSelect?.selectedOptions?.[0]?.textContent?.trim() || '';
      const selectedTypeInputs = Array.from(item.querySelectorAll('[data-universal-content-type]')).filter((input) => input.checked || input.closest('.universal-content-type-card')?.classList.contains('is-checked'));
      const selectedTypes = selectedTypeInputs.map((input) => {
        const card = input.closest('[data-content-type-card], .universal-content-type-card');
        const qty = card?.querySelector('[data-content-type-quantity]')?.value.trim() || '';
        return {
          title: input.value.trim(),
          id: input.dataset.id || '',
          details: input.dataset.desc || '',
          quantity: qty,
          sectionId: input.dataset.sectionId || contentSectionId,
          sectionName: input.dataset.sectionName || contentSectionName
        };
      }).filter((entry) => entry.title);
      const manualRequired = item.querySelector('[data-universal-required-text]')?.value.trim() || item.querySelector('[data-universal-car-type]')?.value.trim() || '';
      const selectedCarInputs = Array.from(item.querySelectorAll('[data-universal-car-choice]')).filter((input) => input.checked || input.closest('.stock-car-choice-card')?.classList.contains('is-checked'));
      const selectedCars = selectedCarInputs.map((input) => input.value.trim()).filter(Boolean);
      const printSize = item.querySelector('[data-universal-print-size]')?.value.trim() || '';

      const carList = selectedCars.length ? selectedCars : [''];
      const typeList = selectedTypes.length ? selectedTypes : [{ title: '', id: '', details: '' }];
      carList.forEach((car) => {
        typeList.forEach((typeEntry) => {
          const rowItem = {
            requiredText: manualRequired,
            carType: car,
            contentTypes: typeEntry.title ? [typeEntry] : [],
            contentType: typeEntry.title || '',
            contentTypeId: typeEntry.id || '',
            contentSectionId: typeEntry.sectionId || contentSectionId,
            contentSectionName: typeEntry.sectionName || contentSectionName,
            details: typeEntry.details || '',
            quantity: typeEntry.quantity || '',
            printSize
          };
          if (rowItem.requiredText || rowItem.carType || rowItem.contentType || rowItem.printSize) items.push(rowItem);
        });
      });
    });

    const seen = new Set();
    const uniqueItems = items.filter((item) => {
      const key = [item.requiredText, item.carType, item.contentType, item.printSize].map((value) => String(value || '').trim().toLowerCase()).join('::');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const requiredText = mzjUniqueStrings(uniqueItems.map((item) => item.requiredText)).join('\n');

    const deliverables = uniqueItems.map((item) => ({
      title: item.contentType || item.requiredText || 'مطلوب',
      contentType: item.contentType,
      contentSectionId: item.contentSectionId,
      contentSectionName: item.contentSectionName,
      details: [item.contentSectionName ? `قسم المحتوى: ${item.contentSectionName}` : '', item.details, item.quantity ? `العدد: ${item.quantity}` : '', item.carType ? `السيارة: ${item.carType}` : '', item.requiredText].filter(Boolean).join(' — '),
      quantity: item.quantity,
      carType: item.carType,
      printSize: item.printSize,
      requiredText: item.requiredText,
      contentTypeId: item.contentTypeId
    })).filter((item) => item.title || item.details);

    return {
      kind,
      items: uniqueItems,
      deliverables,
      contentType: mzjUniqueStrings(uniqueItems.map((item) => item.contentType)).join('، '),
      contentSectionId: mzjUniqueStrings(uniqueItems.map((item) => item.contentSectionId)).join('، '),
      contentSectionName: mzjUniqueStrings(uniqueItems.map((item) => item.contentSectionName)).join('، '),
      carType: mzjUniqueStrings(uniqueItems.map((item) => item.carType)).join('، '),
      printSize: mzjUniqueStrings(uniqueItems.map((item) => item.printSize)).join('، '),
      contentTypeQuantities: uniqueItems.reduce((acc, item) => {
        if (item.contentType && item.quantity) acc[item.contentType] = item.quantity;
        return acc;
      }, {}),
      notes: mzjUniqueStrings(uniqueItems.map((item) => item.requiredText)).join('\n'),
      manualRequired: requiredText,
      requiredText,
      selectedCars: mzjUniqueStrings(uniqueItems.map((item) => item.carType)),
      selectedCarValues: mzjUniqueStrings(uniqueItems.map((item) => item.carType)),
      selectedContentTypes: mzjUniqueStrings(uniqueItems.map((item) => item.contentType)),
      selectedContentTypeTitles: mzjUniqueStrings(uniqueItems.map((item) => item.contentType))
    };
  }

  function collectDepartmentTasks() {
    const tasks = [];
    Array.from(departmentsList.querySelectorAll('.department-task-row')).forEach((deptRow) => {
      const enabled = Boolean(deptRow.querySelector('[data-department-enabled]')?.checked);
      if (!enabled) return;
      Array.from(deptRow.querySelectorAll('[data-department-assignment-row]')).forEach((assignmentRow, assignmentIndex) => {
        const baseKind = 'content';
        const special = collectSpecialDepartmentDetails(assignmentRow, baseKind);
        const requiredText = special.requiredText || '';
        const taskName = requiredText.trim();
        const targetSelect = assignmentRow.querySelector('[data-target-department-select]');
        const selectedDepartments = Array.from(targetSelect?.selectedOptions || []).filter((option) => option.value).map((option) => {
          const dept = (departmentsCache || []).find((item) => String(item.id || item.name || '') === String(option.value));
          return {
            id: dept?.id || option.value,
            name: dept?.name || option.dataset.departmentName || option.textContent || option.value,
            kind: deptKindFromName(dept?.name || option.dataset.departmentKind || option.textContent || '')
          };
        });
        const targetDepartments = selectedDepartments.length ? selectedDepartments : [{ id: 'content', name: MZJ_ASSIGNMENT_LABEL, kind: 'content' }];
        const userSelect = assignmentRow.querySelector('[data-user-select]');
        const selectedOptions = Array.from(userSelect?.selectedOptions || []).filter((option) => option.value);
        const assignmentNo = assignmentIndex + 1;
        targetDepartments.forEach((targetDept) => {
          const deptOptions = selectedOptions.filter((option) => {
            const optionDeptId = String(option.dataset.userDepartmentId || '');
            const optionDeptName = String(option.dataset.userDepartmentName || '');
            return (optionDeptId && (optionDeptId === String(targetDept.id || '') || optionDeptId === String(targetDept.name || ''))) ||
              (optionDeptName && (optionDeptName === String(targetDept.name || '') || optionDeptName === String(targetDept.id || '')));
          });
          const optionsToSave = deptOptions.length ? deptOptions : [null];
          optionsToSave.forEach((selectedOption) => {
            const selectedUser = selectedOption?.dataset.userValue || selectedOption?.dataset.userEmail || selectedOption?.value || '';
            const optionText = selectedOption?.textContent || '';
            const selectedName = selectedOption?.dataset.userName || (selectedUser ? optionText : '');
            const selectedEmail = selectedOption?.dataset.userEmail || selectedOption?.dataset.userValue || '';
            const selectedId = selectedOption?.dataset.userId || selectedOption?.dataset.userUid || selectedEmail || selectedName;
            const item = {
              enabled,
              departmentId: targetDept.id,
              departmentKind: targetDept.kind,
              departmentName: targetDept.name,
              assignmentIndex: assignmentNo,
              assignmentLabel: (targetDept.name || '') + ' / ' + 'تكليف ' + assignmentNo + (selectedName ? ' / ' + selectedName : ''),
              taskName,
              requiredTaskName: taskName,
              userId: selectedId,
              userUid: selectedOption?.dataset.userUid || selectedId,
              userName: selectedName,
              userDisplayName: selectedName,
              userEmail: selectedEmail,
              assigneeUid: selectedOption?.dataset.userUid || selectedId,
              assigneeEmail: selectedEmail,
              assigneeName: selectedName,
              receiveDate: '',
              requiredDate: '',
              deliveryDate: '',
              inspectionDate: '',
              receivedConfirmed: false,
              received: false,
              receivedAt: '',
              receivedBy: '',
              attachmentLabel: attachmentLabelForKind(targetDept.kind),
              requiredText: requiredText,
              deliveryDetails: requiredText,
              requiredDetails: { ...special, manualRequired: requiredText, assignedFromContentBlock: true, targetDepartmentId: targetDept.id, targetDepartmentName: targetDept.name },
              selectedCars: special.selectedCars || mzjUniqueStrings((special.items || []).map((entry) => entry.carType)),
              selectedCarValues: special.selectedCarValues || special.selectedCars || mzjUniqueStrings((special.items || []).map((entry) => entry.carType)),
              selectedContentTypes: special.selectedContentTypes || mzjUniqueStrings((special.items || []).map((entry) => entry.contentType)),
              selectedContentTypeTitles: special.selectedContentTypeTitles || special.selectedContentTypes || mzjUniqueStrings((special.items || []).map((entry) => entry.contentType)),
              contentSectionId: special.contentSectionId || '',
              contentSectionName: special.contentSectionName || '',
              selectedContentTypeQuantities: special.contentTypeQuantities || {},
              contentTypeQuantities: special.contentTypeQuantities || {},
              photoItems: targetDept.kind === 'photography' ? (special.items || []) : [],
              contentItems: special.items || [],
              selectedDeliverables: special.deliverables || [],
              contentType: special.contentType || '',
              carType: special.carType || '',
              printSize: special.printSize || ''
            };
            if (item.departmentId || item.userName || item.requiredText || item.taskName) tasks.push(item);
          });
        });
      });
    });
    return tasks;
  }

  function todayISODate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function setAutomaticTaskDate(force = false) {
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput) {
      if (force || !taskDateInput.value) taskDateInput.value = todayISODate();
      taskDateInput.readOnly = true;
      taskDateInput.title = 'التاريخ يتم تحديده تلقائيًا';
    }
  }

  function openCreateTaskModal(event) {
    if (event?.preventDefault) event.preventDefault();
    const showModal = () => {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    };
    showModal();
    ensureDepartments().then(async () => {
      fillTemplateOptions();
      applyDateLabels();
      ensureGeneratedCode();
      setAutomaticTaskDate();
      await loadStockCarsForDropdown();
      refreshStockCarsDatalist();
      refreshStockCarCheckboxGrids();
      updateAssignmentDropdownSummaries(departmentsList);
      refreshBudgetDropdownOptions();
      showModal();
    }).catch((error) => {
      console.error('create task modal open failed:', error);
      fillTemplateOptions();
      applyDateLabels();
      ensureGeneratedCode();
      setAutomaticTaskDate();
      if (note) note.textContent = '⚠️ فتحنا نافذة إنشاء تاسك، لكن في بيانات لم يتم تحميلها: ' + (error?.message || error?.code || error);
      showModal();
    });
  }

  function setMultiSelectValues(select, values) {
    if (!select) return;
    const set = new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean));
    Array.from(select.options || []).forEach((option) => {
      option.selected = set.has(String(option.value || '').trim()) || set.has(String(option.dataset.userValue || '').trim()) || set.has(String(option.dataset.userEmail || '').trim());
    });
  }

  function fillAssignmentFromDepartmentTasks(assignmentRow, groupRows) {
    const first = groupRows[0] || {};
    const required = first.requiredText || first.manualRequired || first.notes || first.deliveryDetails || first.taskName || '';
    const text = assignmentRow.querySelector('[data-universal-required-text]');
    if (text) text.value = required;
    const cars = mzjUniqueStrings(groupRows.flatMap((row) => []
      .concat(row.selectedCars || [])
      .concat(row.selectedCarValues || [])
      .concat(row.carType || [])
      .concat((row.contentItems || []).map((i) => i?.carType))
      .concat((row.photoItems || []).map((i) => i?.carType))
    ).filter(Boolean));
    assignmentRow.querySelectorAll('[data-universal-car-choice]').forEach((input) => {
      input.checked = cars.some((car) => String(car) === String(input.value));
      input.closest('.universal-content-type-card, .stock-car-choice-card')?.classList.toggle('is-checked', input.checked);
    });
    const types = mzjUniqueStrings(groupRows.flatMap((row) => []
      .concat(row.selectedContentTypes || [])
      .concat(row.selectedContentTypeTitles || [])
      .concat(row.contentType || [])
      .concat((row.contentItems || []).map((i) => i?.contentType || i?.title))
      .concat((row.photoItems || []).map((i) => i?.contentType || i?.title))
    ).filter((v) => v && !/^rct_/i.test(String(v))));
    const sectionIds = mzjUniqueStrings(groupRows.flatMap((row) => [row.contentSectionId, row.requiredDetails?.contentSectionId].concat((row.contentItems || []).map((i) => i?.contentSectionId))).filter(Boolean));
    const sectionNames = mzjUniqueStrings(groupRows.flatMap((row) => [row.contentSectionName, row.requiredDetails?.contentSectionName].concat((row.contentItems || []).map((i) => i?.contentSectionName))).filter(Boolean));
    const sectionSelect = assignmentRow.querySelector('[data-content-section-select]');
    if (sectionSelect) {
      if (sectionIds[0] && Array.from(sectionSelect.options).some((opt) => String(opt.value) === String(sectionIds[0]))) {
        sectionSelect.value = sectionIds[0];
      } else if (sectionNames[0]) {
        const matched = Array.from(sectionSelect.options).find((opt) => String(opt.textContent || '').trim() === String(sectionNames[0]).trim());
        if (matched) sectionSelect.value = matched.value;
      }
      refreshContentTypesForSection(assignmentRow.querySelector('[data-universal-required-item]'));
    }
    const qtyMap = Object.assign({}, ...groupRows.map((row) => row.selectedContentTypeQuantities || row.contentTypeQuantities || {}));
    assignmentRow.querySelectorAll('[data-universal-content-type]').forEach((input) => {
      input.checked = types.some((type) => String(type) === String(input.value));
      const card = input.closest('[data-content-type-card], .universal-content-type-card');
      card?.classList.toggle('is-checked', input.checked);
      const qtyWrap = card?.querySelector('[data-content-type-quantity-wrap]');
      const qtyInput = card?.querySelector('[data-content-type-quantity]');
      if (qtyWrap) qtyWrap.hidden = !input.checked;
      if (qtyInput && input.checked) qtyInput.value = qtyMap[input.value] || qtyInput.value || '';
    });
    const deptIds = mzjUniqueStrings(groupRows.map((row) => row.departmentId || row.targetDepartmentId || row.departmentName).filter(Boolean));
    const deptSelect = assignmentRow.querySelector('[data-target-department-select]');
    setMultiSelectValues(deptSelect, deptIds);
    renderDepartmentUserMatrix(assignmentRow);
    const userSelect = assignmentRow.querySelector('[data-user-select]');
    const userValues = mzjUniqueStrings(groupRows.flatMap((row) => [row.userEmail, row.assigneeEmail, row.userName, row.assigneeName, row.userId, row.userUid]).filter(Boolean));
    setMultiSelectValues(userSelect, userValues);
    renderDepartmentUserMatrix(assignmentRow);
  }

  window.MZJOpenTaskInCreateModalForEdit = async function(task) {
    if (!task) return;
    await ensureDepartments();
    await loadStockCarsForDropdown();
    openCreateTaskModal();
    form.dataset.editingTaskId = task.firestoreId || task.id || task.campaignCode || '';
    form.dataset.editingTaskMode = '1';
    form.dataset.originalCreatedAt = task.createdAt || '';
    const title = document.getElementById('createTaskTitle');
    if (title) title.textContent = 'تعديل حملة أو أجندة';
    const topSave = document.querySelector('.create-task-save-top');
    const mainSave = document.getElementById('saveTaskFromTemplate');
    if (topSave) topSave.textContent = 'حفظ تعديل الحملة / الأجندة';
    if (mainSave) mainSave.textContent = 'حفظ تعديل الحملة / الأجندة';
    if (typeSelect) typeSelect.value = task.taskType === 'agenda' ? 'agenda' : 'campaign';
    applyDateLabels();
    const setVal = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
    setVal('taskDate', task.taskDate || task.launchDate || task.campaignStartDate || '');
    setVal('campaignName', task.campaignName || task.agendaName || '');
    setVal('campaignCode', task.campaignCode || '');
    if (campaignTypeSelect && task.campaignTypeName) {
      if (!Array.from(campaignTypeSelect.options).some((opt) => opt.value === task.campaignTypeName)) campaignTypeSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHTML(task.campaignTypeName)}">${escapeHTML(task.campaignTypeName)}</option>`);
      campaignTypeSelect.value = task.campaignTypeName;
    }
    setVal('agendaMonth', task.agendaMonth || '');
    setVal('agendaYear', task.agendaYear || '');
    setVal('campaignGoal', task.campaignGoal || '');
    setVal('campaignStartDate', task.campaignStartDate || task.launchDate || '');
    setVal('campaignEndDate', task.campaignEndDate || task.endDate || '');
    setVal('campaignEndDescription', task.campaignEndDescription || task.campaignDescription || '');
    renderAllDepartments();
    const deptRow = departmentsList.querySelector('.department-task-row');
    const list = deptRow?.querySelector('[data-department-assignments-list]');
    if (list) {
      list.innerHTML = '';
      const groups = new Map();
      (task.departmentTasks || []).forEach((row, idx) => {
        const key = String(row.assignmentIndex || row.assignmentNo || (idx + 1));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });
      const groupValues = Array.from(groups.values());
      (groupValues.length ? groupValues : [[]]).forEach((rows, index) => {
        list.insertAdjacentHTML('beforeend', createDepartmentAssignmentHTML({ id: 'content', name: 'قسم المحتوى' }, index + 1));
        const assignment = list.querySelector('[data-department-assignment-row]:last-child');
        hydrateAssignmentPickers(assignment);
        if (rows.length) fillAssignmentFromDepartmentTasks(assignment, rows);
      });
      refreshDepartmentAssignmentNumbers(deptRow);
    }
    if (budgetItemsList) {
      budgetItemsList.innerHTML = '';
      const savedBudget = Array.isArray(task.budgetDetails) ? task.budgetDetails : [];
      savedBudget.forEach((item) => createBudgetItem(item));
      updateBudgetTotal();
    }
    if (publishScheduleRows) {
      buildPublishCalendar(true);
      const savedSchedule = Array.isArray(task.publishScheduleEntries) ? task.publishScheduleEntries : [];
      savedSchedule.forEach((entry) => {
        const date = entry.date || '';
        const items = Array.isArray(entry.items) ? entry.items : String(entry.content || '').split(/\s*\+\s*|،|\|/).map((x)=>x.trim()).filter(Boolean);
        const cell = publishScheduleRows.querySelector(`[data-publish-calendar-cell][data-date="${CSS.escape(date)}"]`);
        if (!cell) return;
        const list = cell.querySelector('[data-publish-choice-list]');
        if (list) list.innerHTML = renderPublishChoicesChecklist(items, date);
        cell.querySelectorAll('[data-schedule-content]').forEach((input) => { input.checked = items.includes(input.value); });
        const summary = cell.querySelector('.publish-calendar-summary');
        if (summary) summary.innerHTML = items.length ? items.map((item) => `<span>${escapeHTML(item)}</span>`).join('') : '<em>اضغط لاختيار النشر</em>';
      });
    }
    refreshStockCarCheckboxGrids();
    updateAssignmentDropdownSummaries(departmentsList);
    refreshBudgetDropdownOptions();
  };

  function closeCreateTaskModal() {
    delete form.dataset.editingTaskId;
    delete form.dataset.editingTaskMode;
    delete form.dataset.originalCreatedAt;
    const title = document.getElementById('createTaskTitle');
    if (title) title.textContent = 'نموذج إنشاء حملة أو أجندة';
    const topSave = document.querySelector('.create-task-save-top');
    const mainSave = document.getElementById('saveTaskFromTemplate');
    if (topSave) topSave.textContent = 'حفظ الحملة / الأجندة';
    if (mainSave) mainSave.textContent = 'حفظ الحملة / الأجندة';
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  window.MZJLoadReviewCampaignInCreateModal = async function(reviewDoc) {
    try {
      const review = reviewDoc || {};
      const rows = safeReviewRowsToMatrix(review.rows || []);
      if (!rows.length) {
        alert('ملف المراجعة لا يحتوي على صفوف قابلة للربط.');
        return;
      }
      await ensureDepartments();
      await loadStockCarsForDropdown();
      refreshStockCarsDatalist();
      fillTemplateOptions();
      applyImportedTemplateRows(rows, review.fileName || 'حملة تحت المراجعة', review.sheetName || 'محتوي الحمله');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      if (note) note.textContent = '✅ تم فتح الحملة المعتمدة داخل إنشاء تاسك. راجع ربط أنواع المحتوى بالأقسام واليوزرات ثم احفظ.';
    } catch (error) {
      console.error('open review in create modal failed', error);
      alert('فشل فتح الحملة للربط: ' + (error?.message || error));
    }
  };

  if (openBtn) openBtn.addEventListener('click', openCreateTaskModal);
  if (openBtnMini) openBtnMini.addEventListener('click', openCreateTaskModal);

  typeSelect.addEventListener('change', async () => {
    try { await loadTaskTemplatesFromFirebase(); } catch (error) { if (note) note.textContent = '⚠️ فشل قراءة قوالب Firebase: ' + (error?.message || error?.code || error); }
    fillTemplateOptions();
    applyDateLabels();
    ensureGeneratedCode(true);
    setAutomaticTaskDate(true);
  });

  [campaignStartDateInput, campaignEndDateInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('change', () => buildPublishCalendar(true));
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
      const assignment = deptSelect.closest('[data-content-type-link-assignment]');
      const userSelect = assignment?.querySelector('[data-content-type-user]');
      if (userSelect) userSelect.innerHTML = renderImportedUserOptionsForDepartment(deptSelect.value);
    });
    importedCampaignLogicBox.addEventListener('click', (event) => {
      const addBtn = event.target.closest?.('[data-add-content-type-link]');
      if (addBtn) {
        const card = addBtn.closest('[data-content-type-link-row]');
        const list = card?.querySelector('[data-content-type-link-list]');
        if (list) list.insertAdjacentHTML('beforeend', renderContentTypeLinkAssignmentRow());
        return;
      }
      const removeBtn = event.target.closest?.('[data-remove-content-type-link]');
      if (removeBtn) {
        const list = removeBtn.closest('[data-content-type-link-list]');
        const assignment = removeBtn.closest('[data-content-type-link-assignment]');
        if (list && assignment && list.querySelectorAll('[data-content-type-link-assignment]').length > 1) assignment.remove();
        else if (assignment) {
          const deptSelect = assignment.querySelector('[data-content-type-department]');
          const userSelect = assignment.querySelector('[data-content-type-user]');
          if (deptSelect) deptSelect.value = '';
          if (userSelect) userSelect.innerHTML = '<option value="">اختار القسم الأول</option>';
        }
        return;
      }
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
    setAutomaticTaskDate(true);
    renderTemplateFieldInputs(null);
  });

  document.addEventListener('click', (event) => {
    if (!modal.classList.contains('is-open')) return;
    modal.querySelectorAll('.checkbox-dropdown[open]').forEach((dropdown) => {
      if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !modal.classList.contains('is-open')) return;
    modal.querySelectorAll('.checkbox-dropdown[open]').forEach((dropdown) => dropdown.removeAttribute('open'));
  });

  departmentsList.addEventListener('toggle', (event) => {
    const dropdown = event.target.closest?.('.checkbox-dropdown');
    if (!dropdown || !dropdown.open) return;
    departmentsList.querySelectorAll('.checkbox-dropdown[open]').forEach((other) => {
      if (other !== dropdown) other.removeAttribute('open');
    });
  }, true);

  departmentsList.addEventListener('click', (event) => {
    const stockCarCard = event.target.closest('.stock-car-choice-card');
    if (stockCarCard) {
      const input = stockCarCard.querySelector('[data-universal-car-choice]');
      if (input) {
        event.preventDefault();
        input.checked = !input.checked;
        stockCarCard.classList.toggle('is-checked', input.checked);
        updateAssignmentDropdownSummaries(stockCarCard.closest('[data-universal-required-item]'));
        refreshPublishCalendarOptions();
        refreshBudgetDropdownOptions();
      }
      return;
    }

    const contentCard = event.target.closest('.universal-content-type-card');
    if (contentCard) {
      if (event.target.closest('[data-content-type-quantity]')) return;
      const input = contentCard.querySelector('[data-universal-content-type]');
      const item = contentCard.closest('[data-universal-required-item]');
      if (input) {
        event.preventDefault();
        input.checked = !input.checked;
        refreshUniversalContentTypeCardState(item);
        const wrap = item?.querySelector('[data-universal-print-size-wrap]');
        const sizeInput = item?.querySelector('[data-universal-print-size]');
        const selectedTexts = Array.from(item?.querySelectorAll('[data-universal-content-type]:checked') || []).map((checked) => checked.value || '');
        const shouldShowSize = selectedTexts.some(isOfflinePrintContent);
        if (wrap) wrap.hidden = !shouldShowSize;
        if (!shouldShowSize && sizeInput) sizeInput.value = '';
        if (input.checked) contentCard.querySelector('[data-content-type-quantity]')?.focus();
        updateAssignmentDropdownSummaries(contentCard.closest('[data-universal-required-item]'));
        refreshPublishCalendarOptions();
        refreshBudgetDropdownOptions();
      }
      return;
    }

    const matrixDeptChip = event.target.closest('[data-matrix-department-chip]');
    if (matrixDeptChip) {
      const assignmentRow = matrixDeptChip.closest('[data-department-assignment-row]');
      const deptSelect = assignmentRow?.querySelector('select[data-target-department-select]');
      const userSelect = assignmentRow?.querySelector('select[data-user-select]');
      const value = matrixDeptChip.getAttribute('value') || '';
      const option = Array.from(deptSelect?.options || []).find((item) => item.value === value);
      if (option) option.selected = !option.selected;
      const selectedDeptIds = selectedValuesFromSelect(deptSelect);
      const oldSelectedUsers = selectedValuesFromSelect(userSelect);
      if (userSelect) userSelect.innerHTML = renderUserOptionsForDepartmentIds(selectedDeptIds, oldSelectedUsers);
      renderDepartmentUserMatrix(assignmentRow);
      updateAssignmentDropdownSummaries(assignmentRow);
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
      return;
    }

    const matrixUserChip = event.target.closest('[data-matrix-user-chip]');
    if (matrixUserChip) {
      const assignmentRow = matrixUserChip.closest('[data-department-assignment-row]');
      const deptSelect = assignmentRow?.querySelector('select[data-target-department-select]');
      const userSelect = assignmentRow?.querySelector('select[data-user-select]');
      const selectedDeptIds = selectedValuesFromSelect(deptSelect);
      const currentUsers = selectedValuesFromSelect(userSelect);
      if (userSelect) userSelect.innerHTML = renderUserOptionsForDepartmentIds(selectedDeptIds, currentUsers);
      const value = matrixUserChip.getAttribute('value') || '';
      const option = Array.from(userSelect?.options || []).find((item) => item.value === value);
      if (option) option.selected = !option.selected;
      renderDepartmentUserMatrix(assignmentRow);
      updateAssignmentDropdownSummaries(assignmentRow);
      return;
    }

    const deptChip = event.target.closest('[data-department-chip]');
    if (deptChip) {
      const assignmentRow = deptChip.closest('[data-department-assignment-row]');
      const select = assignmentRow?.querySelector('select[data-target-department-select]');
      const value = deptChip.getAttribute('value') || '';
      const option = Array.from(select?.options || []).find((item) => item.value === value);
      if (option) option.selected = !option.selected;
      renderDepartmentChipPicker(assignmentRow);
      renderUserChipPicker(assignmentRow);
      renderDepartmentUserMatrix(assignmentRow);
      updateAssignmentDropdownSummaries(assignmentRow);
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
      return;
    }
    const userChip = event.target.closest('[data-user-chip]');
    if (userChip) {
      const assignmentRow = userChip.closest('[data-department-assignment-row]');
      const select = assignmentRow?.querySelector('select[data-user-select]');
      const value = userChip.getAttribute('value') || '';
      const option = Array.from(select?.options || []).find((item) => item.value === value);
      if (option) option.selected = !option.selected;
      renderUserChipPicker(assignmentRow);
      renderDepartmentUserMatrix(assignmentRow);
      return;
    }

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
          <label class="mzj-field"><span>نوع السيارة</span><input type="text" list="stockCarsDatalist" data-photo-car-type placeholder="اختار من حصر الماركات والمواصفات والألوان"></label>
          <label class="mzj-field"><span>نوع المحتوى</span><select data-photo-content-type>${renderRequiredContentOptions('photography')}</select></label>
          <button class="soft-danger-btn" type="button" data-remove-photo-item>مسح</button>
        `;
        list.appendChild(item);
      }
      return;
    }
    const addUniversal = event.target.closest('[data-add-universal-required]');
    if (addUniversal) {
      const fields = addUniversal.closest('[data-special-kind]');
      const kind = fields?.dataset.specialKind || 'generic';
      const list = fields?.querySelector('[data-universal-required-list]');
      if (list) {
        list.insertAdjacentHTML('beforeend', renderUniversalRequiredItem(kind, true));
      }
      return;
    }

    const removeUniversal = event.target.closest('[data-remove-universal-required]');
    if (removeUniversal) {
      removeUniversal.closest('[data-universal-required-item]')?.remove();
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
      return;
    }

    const addContent = event.target.closest('[data-add-content-item]');
    if (addContent) {
      const list = addContent.closest('.dept-special-fields')?.querySelector('[data-content-items-list]');
      if (list) {
        const item = document.createElement('article');
        item.className = 'content-item-row';
        item.dataset.contentItem = 'true';
        item.innerHTML = `
          <label class="mzj-field full-width-field">
            <span>نوع المحتوى</span>
            <select data-content-type>${renderRequiredContentOptions('content')}</select>
          </label>
          <label class="mzj-field full-width-field">
            <span>السيارة المطلوبة من الاستوك</span>
            <input type="text" list="stockCarsDatalist" data-content-car-type placeholder="اختياري - ابحث بالماركة / المواصفة">
          </label>
          <label class="mzj-field full-width-field">
            <span>ملاحظات مؤقتة</span>
            <textarea data-content-required-text rows="3" placeholder="اكتب أي تفاصيل لحين اعتماد شكل المطلوب النهائي"></textarea>
          </label>
          <button class="soft-danger-btn" type="button" data-remove-content-item>مسح</button>
        `;
        list.appendChild(item);
      }
      return;
    }
    const removeContent = event.target.closest('[data-remove-content-item]');
    if (removeContent) {
      removeContent.closest('[data-content-item]')?.remove();
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
    row.classList.toggle('is-open', willOpen);
    checkbox.checked = willOpen ? true : checkbox.checked;
    row.classList.toggle('is-selected', checkbox.checked);
  });

  departmentsList.addEventListener('change', (event) => {
    const targetDepartmentSelect = event.target.closest('select[data-target-department-select]');
    if (targetDepartmentSelect) {
      const assignmentRow = targetDepartmentSelect.closest('[data-department-assignment-row]');
      const userSelect = assignmentRow?.querySelector('[data-user-select]');
      const selectedDeptIds = Array.from(targetDepartmentSelect.selectedOptions || []).map((option) => option.value).filter(Boolean);
      const selectedUsers = Array.from(userSelect?.selectedOptions || []).map((option) => option.value).filter(Boolean);
      if (userSelect) userSelect.innerHTML = renderUserOptionsForDepartmentIds(selectedDeptIds, selectedUsers);
      renderDepartmentChipPicker(assignmentRow);
      renderUserChipPicker(assignmentRow);
      return;
    }

    const contentSectionSelect = event.target.closest('[data-content-section-select]');
    if (contentSectionSelect) {
      const item = contentSectionSelect.closest('[data-universal-required-item]');
      refreshContentTypesForSection(item);
      updateAssignmentDropdownSummaries(item);
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
      updateAssignmentDropdownSummaries(assignmentRow);
      return;
    }

    const universalSelect = event.target.closest('[data-universal-content-type]');
    if (universalSelect) {
      const item = universalSelect.closest('[data-universal-required-item]');
      refreshUniversalContentTypeCardState(item);
      const wrap = item?.querySelector('[data-universal-print-size-wrap]');
      const input = item?.querySelector('[data-universal-print-size]');
      const selectedTexts = Array.from(item?.querySelectorAll('[data-universal-content-type]:checked') || []).map((checked) => checked.value || '');
      const shouldShowSize = selectedTexts.some(isOfflinePrintContent);
      if (wrap) wrap.hidden = !shouldShowSize;
      if (!shouldShowSize && input) input.value = '';
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
      updateAssignmentDropdownSummaries(item);
      return;
    }

    const choice = event.target.closest('[data-design-deliverable], [data-montage-deliverable]');
    if (choice) {
      choice.closest('.multi-choice-card')?.classList.toggle('is-checked', choice.checked);
      if (choice.matches('[data-design-deliverable]')) {
        const assignmentRow = choice.closest('[data-department-assignment-row]');
        const wrap = assignmentRow?.querySelector('[data-design-print-size-wrap]');
        const hasPrint = !!assignmentRow?.querySelector('[data-design-deliverable][data-title="مطبوعات أونلاين"]:checked');
        if (wrap) wrap.hidden = !hasPrint;
        if (!hasPrint) {
          const input = assignmentRow?.querySelector('[data-design-print-size]');
          if (input) input.value = '';
        }
      }
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
    }
  });

  departmentsList.addEventListener('input', (event) => {
    if (event.target.closest('[data-design-print-size], [data-universal-print-size], [data-universal-car-type], [data-universal-car-choice], [data-universal-required-text], [data-content-type-quantity]')) {
      refreshPublishCalendarOptions();
      refreshBudgetDropdownOptions();
    }
  });

  if (budgetItemsList) {
    budgetItemsList.addEventListener('input', updateBudgetTotal);
    budgetItemsList.addEventListener('change', updateBudgetTotal);
    budgetItemsList.addEventListener('click', async (event) => {
      const saveFunnelBtn = event.target.closest('[data-save-budget-funnel]');
      if (saveFunnelBtn) {
        const item = saveFunnelBtn.closest('[data-budget-item]');
        const input = item?.querySelector('[data-new-budget-funnel]');
        const select = item?.querySelector('[data-budget-funnel]');
        const name = input?.value.trim() || '';
        if (!name) {
          if (note) note.textContent = '⚠️ اكتب اسم Funnel الأول.';
          return;
        }
        try {
          await saveMarketingFunnel(name);
          funnelsCache = await loadMarketingFunnels();
          refreshBudgetDropdownOptions();
          if (select) select.value = name;
          if (input) input.value = '';
          updateBudgetTotal();
          if (note) note.textContent = '✅ تم حفظ Funnel وسيظهر بعد كده في القائمة.';
        } catch (error) {
          if (note) note.textContent = '⚠️ فشل حفظ Funnel: ' + (error?.message || error?.code || error);
        }
        return;
      }

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

  if (uploadAgendaTemplateBtn && agendaTemplateFileInput) {
    uploadAgendaTemplateBtn.addEventListener('click', () => agendaTemplateFileInput.click());
    agendaTemplateFileInput.addEventListener('change', () => {
      const file = agendaTemplateFileInput.files && agendaTemplateFileInput.files[0];
      handleAgendaTemplateUpload(file).finally(() => { agendaTemplateFileInput.value = ''; });
    });
  }

  if (addPublishScheduleRowBtn) {
    addPublishScheduleRowBtn.addEventListener('click', (event) => {
      event.preventDefault();
      buildPublishCalendar(true);
    });
  }

  // احتياطي لو الزر اتعاد رسمه أو الـ listener الأصلي مااتعلقش.
  document.addEventListener('click', (event) => {
    const calendarBtn = event.target.closest('#addPublishScheduleRow');
    if (!calendarBtn) return;
    event.preventDefault();
    buildPublishCalendar(true);
  });

  if (publishScheduleRows) {
    publishScheduleRows.addEventListener('click', (event) => {
      const dayBtn = event.target.closest('[data-open-publish-day]');
      if (!dayBtn) return;
      const cell = dayBtn.closest('[data-publish-calendar-cell]');
      const editor = cell?.querySelector('[data-publish-day-editor]');
      if (!cell || !editor) return;
      const isOpen = cell.classList.contains('is-open');
      publishScheduleRows.querySelectorAll('[data-publish-calendar-cell].is-open').forEach((item) => {
        if (item !== cell) {
          item.classList.remove('is-open');
          item.querySelector('[data-publish-day-editor]')?.setAttribute('hidden', '');
        }
      });
      cell.classList.toggle('is-open', !isOpen);
      editor.hidden = isOpen;
    });
    publishScheduleRows.addEventListener('change', (event) => {
      const changed = event.target.closest('[data-schedule-content]');
      if (!changed) return;
      const cell = changed.closest('[data-publish-calendar-cell]');
      if (changed.checked) {
        publishScheduleRows.querySelectorAll('[data-publish-calendar-cell]').forEach((otherCell) => {
          if (otherCell === cell) return;
          otherCell.querySelectorAll('[data-schedule-content]').forEach((input) => {
            if (input.value === changed.value) input.checked = false;
          });
          const otherSummary = otherCell.querySelector('.publish-calendar-summary');
          const otherSelected = Array.from(otherCell.querySelectorAll('[data-schedule-content]:checked')).map((input) => input.value).filter(Boolean);
          if (otherSummary) otherSummary.innerHTML = otherSelected.length ? otherSelected.map((item) => `<span>${escapeHTML(item)}</span>`).join('') : '<em>اضغط لاختيار النشر</em>';
        });
      }
      const summary = cell?.querySelector('.publish-calendar-summary');
      const selected = Array.from(cell?.querySelectorAll('[data-schedule-content]:checked') || []).map((input) => input.value).filter(Boolean);
      if (summary) summary.innerHTML = selected.length ? selected.map((item) => `<span>${escapeHTML(item)}</span>`).join('') : '<em>اضغط لاختيار النشر</em>';
      refreshPublishCalendarOptions();
    });
  }


  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-create-task]') || event.target === modal) {
      closeCreateTaskModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeCreateTaskModal();
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

    if (!departmentTasks.length) {
      if (note) note.textContent = '⚠️ اختار قسم واحد على الأقل واكتب المطلوب.';
      return;
    }

    const formData = new FormData(form);
    const payload = {
      id: form.dataset.editingTaskId || ('task_' + Date.now()),
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
      campaignEndDescription: formData.get('campaignEndDescription') || '',
      campaignDescription: formData.get('campaignEndDescription') || '',
      launchDate: formData.get('campaignStartDate') || '',
      endDate: formData.get('campaignEndDate') || '',
      departmentTasks,
      publishScheduleEntries: collectPublishScheduleDetails(),
      publishScheduleResult: collectPublishScheduleDetails().map((item) => [item.day, item.date, item.content].filter(Boolean).join(' - ')).join(' | '),
      budgetDetails: collectBudgetDetails(),
      sourceCollection: 'workspace_tasks',
      createdAt: form.dataset.editingTaskMode === '1' ? (form.dataset.originalCreatedAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      await firebase.firestore().collection('workspace_tasks').doc(payload.id).set(payload, { merge: form.dataset.editingTaskMode === '1' });
    } catch (error) {
      console.error('workspace_tasks save failed:', error);
      if (note) note.textContent = '⚠️ فشل الحفظ في Firebase: ' + (error?.message || error?.code || error) + ' — لم يتم الحفظ محلياً.';
      return;
    }

    if (note) note.textContent = form.dataset.editingTaskMode === '1' ? '✅ تم حفظ تعديل الحملة في Firebase.' : '✅ تم حفظ التاسك في Firebase داخل مسار workspace_tasks.';
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    if (typeof window.refreshWorkspaceTasksFromFirestore === 'function') await window.refreshWorkspaceTasksFromFirestore();
    else if (typeof window.renderDashboardTasks === 'function') window.renderDashboardTasks();
    delete form.dataset.editingTaskId;
    delete form.dataset.editingTaskMode;
    delete form.dataset.originalCreatedAt;
    closeCreateTaskModal();
  });
}

initTemplatesPage();
initCreateTaskFromTemplate();


/* Campaign / agenda page + under review workflow */
(function initCampaignsAndReviewWorkflow(){
  const REVIEW_COLLECTION = 'campaign_reviews';
  const TASK_COLLECTION = 'workspace_tasks';
  const pageRoot = document.getElementById('campaignsCalendarApp');
  const dashboardReviewRootId = 'adminCampaignReviewsList';

  function currentUser(){ return window.MZJAuth?.getUser?.() || {}; }
  function isAdmin(){
    const role = String(currentUser().role || document.body.dataset.userRole || localStorage.getItem('mzj_user_role') || '').toLowerCase();
    return ['admin','marketing_manager'].includes(role);
  }
  function currentUserEmail(){ return String(currentUser().email || '').trim().toLowerCase(); }
  function isReviewOwner(review){
    const email = currentUserEmail();
    if (!email) return false;
    return String(review.submittedByEmail || review.createdByEmail || review.uploadedByEmail || '').trim().toLowerCase() === email;
  }
  function visibleReviewsForCurrentUser(reviews){
    return isAdmin() ? reviews : (reviews || []).filter(isReviewOwner);
  }
  function esc(v){ return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function cellText(value){ return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function ensureFirebase(){
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) throw new Error('Firebase SDK غير موجود');
    if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
    return firebase.firestore();
  }
  function rowToSafe(row){
    const cells = {};
    (row || []).forEach((cell, index) => {
      const text = cellText(cell);
      if (text) cells['c' + index] = text;
    });
    return { cells };
  }
  function safeReviewRowsToMatrix(rows){
    return (rows || []).map((row) => {
      const cells = row?.cells || {};
      const indexes = Object.keys(cells).map((key) => Number(String(key).replace(/^c/, ''))).filter((n) => !Number.isNaN(n));
      const max = indexes.length ? Math.max(...indexes) : -1;
      const arr = [];
      for (let i = 0; i <= max; i += 1) arr[i] = cells['c' + i] || '';
      return arr;
    }).filter((row) => row.some(Boolean));
  }
  window.safeReviewRowsToMatrix = safeReviewRowsToMatrix;

  function findCampaignContentSheet(workbook){
    const names = workbook.SheetNames || [];
    return names.find((name) => /محتو[ىي]\s*الحمله|محتو[ىي]\s*الحملة/i.test(name)) ||
      names.find((name) => /campaign/i.test(name)) || names[0];
  }
  function findValue(rows, labels){
    const wanted = labels.map(cellText);
    for (const row of rows || []) {
      for (let i = 0; i < row.length; i += 1) {
        const text = cellText(row[i]);
        if (!text) continue;
        if (wanted.some((label) => text === label || text.includes(label))) {
          for (let j = i + 1; j < row.length; j += 1) {
            const val = cellText(row[j]);
            if (val && !wanted.includes(val)) return val;
          }
        }
      }
    }
    return '';
  }
  function findHeaderRow(rows){
    const list = rows || [];
    const executionIndex = list.findIndex((row) => (row || []).some((cell) => /Content Execution Direction|آلية تنفيذ المحتوى|الية تنفيذ المحتوى/i.test(cellText(cell))));
    const start = executionIndex >= 0 ? executionIndex + 1 : 0;
    for (let i = start; i < list.length; i += 1) {
      const cells = (list[i] || []).map((cell) => cellText(cell));
      const joined = cells.join('\n');
      const hasContentType = /نوع المحتو[ىي]|Content Type/i.test(joined);
      const hasTaskNo = /رقم التاسك|Task/i.test(joined);
      if (hasContentType && hasTaskNo) return i;
    }
    return list.findIndex((row) => {
      const joined = (row || []).map((cell) => cellText(cell)).join('\n');
      return /نوع المحتو[ىي]|Content Type/i.test(joined) && /رقم التاسك|Task/i.test(joined);
    });
  }
  function contentTypesFromRows(rows){
    const idx = findHeaderRow(rows);
    if (idx < 0) return [];
    const headers = rows[idx] || [];
    const col = headers.findIndex((h) => /نوع المحتو[ىي]|Content Type/i.test(cellText(h)));
    if (col < 0) return [];
    const set = new Set();
    rows.slice(idx + 1).forEach((row) => {
      const val = cellText(row[col]);
      if (val) set.add(val);
    });
    return Array.from(set);
  }
  async function parseReviewExcel(file){
    if (!window.XLSX) throw new Error('مكتبة قراءة Excel غير محملة');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = findCampaignContentSheet(workbook);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
      .map((row) => (row || []).map(cellText)).filter((row) => row.some(Boolean));
    return {
      sheetName,
      rows,
      campaignName: findValue(rows, ['اسم الحملة', 'اسم الحملة / الأجندة']) || file.name.replace(/\.xlsx?$/i, ''),
      campaignTypeName: findValue(rows, ['نوع الحملة', 'نوع الحمله']) || '',
      contentTypes: contentTypesFromRows(rows)
    };
  }
  async function addReviewDocument(file){
    const parsed = await parseReviewExcel(file);
    const db = ensureFirebase();
    const user = currentUser();
    const id = 'review_' + Date.now();
    const payload = {
      id,
      status: 'under_review',
      fileName: file.name,
      sheetName: parsed.sheetName,
      campaignName: parsed.campaignName,
      campaignTypeName: parsed.campaignTypeName,
      contentTypes: parsed.contentTypes,
      rows: parsed.rows.map(rowToSafe),
      marks: [],
      adminNotes: '',
      submittedByName: user.name || user.displayName || user.email || '',
      submittedByEmail: user.email || '',
      submittedByUid: user.uid || user.id || '',
      createdByEmail: user.email || '',
      createdByUid: user.uid || user.id || '',
      createdAt: form.dataset.editingTaskMode === '1' ? (form.dataset.originalCreatedAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.collection(REVIEW_COLLECTION).doc(id).set(payload);
    return payload;
  }
  async function loadReviews(){
    const db = ensureFirebase();
    const snap = await db.collection(REVIEW_COLLECTION).get();
    const items = [];
    snap.forEach((doc) => items.push({ firestoreId: doc.id, ...(doc.data() || {}) }));
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  async function loadTasks(){
    const db = ensureFirebase();
    const snap = await db.collection(TASK_COLLECTION).get();
    const items = [];
    snap.forEach((doc) => items.push({ firestoreId: doc.id, ...(doc.data() || {}) }));
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  function statusLabel(status){
    if (status === 'approved') return 'معتمدة';
    if (status === 'changes_requested') return 'مطلوب تعديل';
    return 'تحت المراجعة';
  }
  function renderCampaignsCalendarPage(){
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <section class="campaign-tabs workspace-card">
        <div class="campaign-tabs-actions">
          <button class="primary-btn is-active" type="button" data-calendar-tab="campaigns">الحملات</button>
          <button class="soft-btn" type="button" data-calendar-tab="agendas">الأجندات</button>
          <button class="soft-btn" type="button" data-calendar-tab="reviews">حملات تحت المراجعة</button>
        </div>
        <div class="review-upload-box">
          <div class="review-upload-copy"><strong>رفع حملة للمراجعة والاعتماد</strong><small>اليوزر يرفع شيت الحملة، والأدمن يراجعها ويكتب الملاحظات ثم يعتمدها.</small></div>
          <input id="reviewCampaignFile" type="file" accept=".xlsx,.xls" hidden>
          <button class="primary-btn" id="uploadReviewCampaignBtn" type="button">رفع شيت حملة للمراجعة</button>
        </div>
      </section>
      <section class="workspace-card"><div id="campaignCalendarList" class="review-cards-grid"></div></section>
      <div id="campaignTaskFullModal" class="campaign-full-modal" aria-hidden="true"></div>
      <div id="campaignReviewModal" class="review-modal" aria-hidden="true"></div>`;
    bindCampaignsCalendarEvents();
    renderCampaignsCalendarList('campaigns');
  }
  async function renderCampaignsCalendarList(tab){
    const list = document.getElementById('campaignCalendarList');
    if (!list) return;
    list.innerHTML = '<p class="task-empty-note">جاري التحميل...</p>';
    try {
      if (tab === 'reviews') {
        const reviews = visibleReviewsForCurrentUser(await loadReviews());
        list.innerHTML = reviews.length ? reviews.map(renderReviewCard).join('') : '<p class="task-empty-note">لا توجد حملات تحت المراجعة حالياً.</p>';
      } else {
        const tasks = await loadTasks();
        const filtered = tasks.filter((task) => tab === 'agendas' ? task.taskType === 'agenda' : task.taskType !== 'agenda');
        list.innerHTML = filtered.length ? filtered.map(renderTaskSummaryCard).join('') : '<p class="task-empty-note">لا توجد نتائج حالياً.</p>';
      }
    } catch (error) {
      list.innerHTML = `<p class="task-empty-note">⚠️ فشل تحميل البيانات: ${esc(error?.message || error)}</p>`;
    }
  }
  function renderTaskSummaryCard(task){
    const id = esc(task.firestoreId || task.id || task.taskId || task.campaignCode || '');
    const typeLabel = task.taskType === 'agenda' ? 'أجندة' : (task.taskTypeLabel || 'حملة');
    const departmentCount = Array.isArray(task.departmentTasks) ? task.departmentTasks.length : 0;
    return `<article class="review-summary-card campaign-calendar-card" data-calendar-task-card="${id}">
      <strong>${esc(task.campaignName || task.templateName || task.agendaName || 'بدون اسم')}</strong>
      <span>${esc(task.campaignTypeName || typeLabel || '')}</span>
      <small>${esc(task.campaignCode || '')}</small>
      <p>${departmentCount ? `${departmentCount} تكليف / قسم` : 'لا توجد تكليفات مرتبطة'}</p>
      <div class="task-card-actions">
        <button class="secondary-btn" type="button" data-open-calendar-task="${id}">فتح التفاصيل</button>
      </div>
    </article>`;
  }
  function renderReviewCard(review){
    const types = (review.contentTypes || []).slice(0, 6).map(esc).join('، ');
    const canReview = isAdmin();
    const canOwnerEdit = !canReview && isReviewOwner(review) && String(review.status || '') !== 'approved';
    return `<article class="review-summary-card" data-review-id="${esc(review.firestoreId || review.id)}">
      <strong>${esc(review.campaignName || review.fileName || 'حملة بدون اسم')}</strong>
      <span>${esc(review.campaignTypeName || 'نوع غير محدد')} · ${statusLabel(review.status)}</span>
      <small>بواسطة: ${esc(review.submittedByName || review.submittedByEmail || 'غير محدد')}</small>
      ${types ? `<p>${types}</p>` : ''}
      ${review.adminNotes ? `<p class="review-note">ملاحظات الأدمن: ${esc(review.adminNotes)}</p>` : ''}
      <div class="task-card-actions">
        <button class="secondary-btn review-open-btn" type="button" data-open-review="${esc(review.firestoreId || review.id)}">${canReview ? 'مراجعة' : (canOwnerEdit ? 'عرض وتعديل' : 'عرض الملاحظات')}</button>
        ${canReview ? `<button class="danger-btn review-delete-btn" type="button" data-delete-review="${esc(review.firestoreId || review.id)}">مسح</button>` : ''}
      </div>
    </article>`;
  }
  function bindCampaignsCalendarEvents(){
    // calendar edit task type change

    document.addEventListener('change', (event) => {
      const typeSelect = event.target.closest?.('[data-calendar-edit-task-type]');
      if (!typeSelect) return;
      const modal = calendarTaskModal();
      const row = modal?.querySelector('[data-calendar-edit-agenda-row]');
      if (row) row.hidden = typeSelect.value !== 'agenda';
    });

    const fileInput = document.getElementById('reviewCampaignFile');
    const uploadBtn = document.getElementById('uploadReviewCampaignBtn');
    uploadBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'جاري الرفع...';
      try {
        await addReviewDocument(file);
        await renderCampaignsCalendarList('reviews');
        document.querySelectorAll('[data-calendar-tab]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.calendarTab === 'reviews'));
      } catch (error) { alert('فشل رفع الحملة للمراجعة: ' + (error?.message || error)); }
      finally { uploadBtn.disabled = false; uploadBtn.textContent = 'رفع شيت حملة للمراجعة'; fileInput.value = ''; }
    });
    pageRoot?.addEventListener('click', async (event) => {
      const tabBtn = event.target.closest('[data-calendar-tab]');
      if (tabBtn) {
        pageRoot.querySelectorAll('[data-calendar-tab]').forEach((btn) => btn.classList.remove('is-active'));
        tabBtn.classList.add('is-active');
        await renderCampaignsCalendarList(tabBtn.dataset.calendarTab);
        return;
      }
      const deleteBtn = event.target.closest('[data-delete-review]');
      if (deleteBtn && isAdmin()) {
        if (!confirm('هل تريد مسح حملة المراجعة؟')) return;
        try {
          await deleteReviewDocument(deleteBtn.dataset.deleteReview);
          await renderCampaignsCalendarList(pageRoot.querySelector('[data-calendar-tab].is-active')?.dataset.calendarTab || 'reviews');
          await refreshReviewViews();
        } catch (error) { alert('فشل مسح حملة المراجعة: ' + (error?.message || error)); }
        return;
      }
      const taskOpenBtn = event.target.closest('[data-open-calendar-task]');
      if (taskOpenBtn) {
        event.preventDefault();
        openCalendarTaskModal(taskOpenBtn.dataset.openCalendarTask);
        return;
      }
      const closeTaskBtn = event.target.closest('[data-close-calendar-task-modal]');
      if (closeTaskBtn) {
        closeCalendarTaskModal();
        return;
      }
      const editTaskBtn = event.target.closest('[data-edit-calendar-task]');
      if (editTaskBtn) {
        if (activeCalendarTask && window.MZJOpenTaskInCreateModalForEdit) {
          closeCalendarTaskModal();
          window.MZJOpenTaskInCreateModalForEdit(activeCalendarTask);
        } else {
          setCalendarTaskModalEditMode(true);
        }
        return;
      }
      const cancelTaskEditBtn = event.target.closest('[data-cancel-calendar-task-edit]');
      if (cancelTaskEditBtn) {
        setCalendarTaskModalEditMode(false);
        return;
      }
      const saveTaskBtn = event.target.closest('[data-save-calendar-task]');
      if (saveTaskBtn) {
        saveCalendarTaskFromModal(saveTaskBtn.dataset.saveCalendarTask);
        return;
      }
      const openBtn = event.target.closest('[data-open-review]');
      if (openBtn) openReviewModal(openBtn.dataset.openReview);
    });
  }

  let activeCalendarTask = null;
  function calendarTaskModal(){ return document.getElementById('campaignTaskFullModal'); }
  function closeCalendarTaskModal(){
    const modal = calendarTaskModal();
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = '';
    activeCalendarTask = null;
  }
  function taskDocId(task){ return String(task?.firestoreId || task?.id || task?.taskId || '').trim(); }
  async function getCalendarTaskById(id){
    const db = ensureFirebase();
    const rawId = String(id || '').trim();
    if (!rawId) throw new Error('لا يوجد ID للحملة / الأجندة');
    const direct = await db.collection(TASK_COLLECTION).doc(rawId).get();
    if (direct.exists) return { firestoreId: direct.id, ...(direct.data() || {}) };
    const snap = await db.collection(TASK_COLLECTION).where('id','==',rawId).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { firestoreId: doc.id, ...(doc.data() || {}) };
    }
    const codeSnap = await db.collection(TASK_COLLECTION).where('campaignCode','==',rawId).limit(1).get();
    if (!codeSnap.empty) {
      const doc = codeSnap.docs[0];
      return { firestoreId: doc.id, ...(doc.data() || {}) };
    }
    throw new Error('لم يتم العثور على الحملة / الأجندة');
  }
  function safeArray(value){ return Array.isArray(value) ? value : []; }
  function prettyDate(value){ return esc(value || '—'); }
  function fullModalInfoField(label, value, name, type='text'){
    const inputValue = esc(value || '');
    return `<label class="mzj-field calendar-full-edit-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${inputValue}"></label>`;
  }
  function renderCalendarTaskInfoGrid(task){
    const typeLabel = task.taskType === 'agenda' ? 'أجندة' : 'حملة';
    return `<div class="campaign-full-info-grid">
      <div><small>النوع</small><strong>${esc(task.taskTypeLabel || typeLabel)}</strong></div>
      <div><small>الاسم</small><strong>${esc(task.campaignName || task.agendaName || task.templateName || '—')}</strong></div>
      <div><small>الكود</small><strong>${esc(task.campaignCode || task.id || '—')}</strong></div>
      <div><small>نوع الحملة / الأجندة</small><strong>${esc(task.campaignTypeName || '—')}</strong></div>
      <div><small>تاريخ البداية</small><strong>${prettyDate(task.campaignStartDate || task.launchDate || task.taskDate)}</strong></div>
      <div><small>تاريخ النهاية</small><strong>${prettyDate(task.campaignEndDate || task.endDate)}</strong></div>
      <div><small>الهدف</small><strong>${esc(task.campaignGoal || '—')}</strong></div>
      <div><small>الشهر / السنة</small><strong>${esc([task.agendaMonth, task.agendaYear].filter(Boolean).join(' / ') || '—')}</strong></div>
    </div>`;
  }
  function renderCalendarTaskEditForm(task){
    const selectedType = task.taskType === 'agenda' ? 'agenda' : 'campaign';
    const campaignTypeValue = esc(task.campaignTypeName || '');
    const descValue = esc(task.campaignDescription || task.campaignEndDescription || '');
    return `<form id="calendarTaskEditForm" class="create-task-form campaign-full-edit-form calendar-create-like-edit" hidden>
      <section class="create-task-section">
        <div class="section-title-row">
          <div>
            <span class="eyebrow">تعديل البيانات</span>
            <h4>اختيار النوع وبيانات الحملة</h4>
            <p>نفس شكل فورم إنشاء تاسك، لكن الحفظ يعدل نفس الحملة / الأجندة المفتوحة.</p>
          </div>
        </div>

        <div class="create-task-grid">
          <label class="mzj-field">
            <span>نوع التاسك</span>
            <select name="taskType" data-calendar-edit-task-type>
              <option value="campaign" ${selectedType === 'campaign' ? 'selected' : ''}>حملة</option>
              <option value="agenda" ${selectedType === 'agenda' ? 'selected' : ''}>أجندة</option>
            </select>
          </label>

          <label class="mzj-field">
            <span>التاريخ</span>
            <input name="taskDate" type="date" value="${esc(task.taskDate || task.launchDate || task.campaignStartDate || '')}">
          </label>

          <label class="mzj-field">
            <span>اسم الحملة / الأجندة</span>
            <input name="campaignName" type="text" value="${esc(task.campaignName || task.agendaName || '')}" placeholder="اكتب الاسم">
          </label>

          <label class="mzj-field code-field-wrap">
            <span>كود الحملة / الأجندة</span>
            <input name="campaignCode" type="text" value="${esc(task.campaignCode || '')}" placeholder="كود الحملة / الأجندة">
          </label>

          <label class="mzj-field">
            <span>نوع الحملة / الأجندة</span>
            <input name="campaignTypeName" type="text" value="${campaignTypeValue}" placeholder="اكتب نوع الحملة / الأجندة">
          </label>

          <div class="agenda-month-year-row calendar-edit-agenda-row" data-calendar-edit-agenda-row ${selectedType === 'agenda' ? '' : 'hidden'}>
            <label class="mzj-field">
              <span>شهر الأجندة</span>
              <input name="agendaMonth" type="text" value="${esc(task.agendaMonth || '')}" placeholder="مثال: مايو">
            </label>
            <label class="mzj-field">
              <span>سنة الأجندة</span>
              <input name="agendaYear" type="text" value="${esc(task.agendaYear || '')}" placeholder="مثال: 2026">
            </label>
          </div>

          <label class="mzj-field">
            <span>الهدف من الحملة</span>
            <input name="campaignGoal" type="text" value="${esc(task.campaignGoal || '')}" placeholder="اكتب الهدف">
          </label>

          <label class="mzj-field">
            <span>تاريخ بداية الحملة</span>
            <input name="campaignStartDate" type="date" value="${esc(task.campaignStartDate || task.launchDate || '')}">
          </label>

          <label class="mzj-field">
            <span>تاريخ نهاية الحملة</span>
            <input name="campaignEndDate" type="date" value="${esc(task.campaignEndDate || task.endDate || '')}">
          </label>

          <label class="mzj-field full-width-field">
            <span>شرح تحت نهاية الحملة</span>
            <textarea name="campaignDescription" rows="3" placeholder="اكتب شرح أو ملاحظات تظهر مع نهاية الحملة">${descValue}</textarea>
          </label>
        </div>
      </section>
    </form>`;
  }
  function renderDepartmentTaskRows(task){
    const rows = safeArray(task.departmentTasks);
    if (!rows.length) return '<p class="task-empty-note">لا توجد تكليفات أقسام محفوظة لهذه الحملة / الأجندة.</p>';
    const groups = new Map();
    rows.forEach((row, idx) => {
      const key = String(row.assignmentIndex || row.assignmentNo || idx + 1);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    const renderQty = (row, type) => {
      const qty = (row.selectedContentTypeQuantities || row.contentTypeQuantities || row.requiredDetails?.contentTypeQuantities || {})[type];
      return qty ? ` <em class="campaign-type-qty">× ${esc(String(qty))}</em>` : '';
    };
    return `<div class="campaign-full-assignment-board">
      <div class="campaign-full-assignment-head">
        <span>المطلوب</span><span>اختيار السيارة</span><span>قسم المحتوى</span><span>أنواع المحتوى</span><span>الأقسام</span><span>اليوزرات</span><span>الحالة</span>
      </div>
      ${Array.from(groups.entries()).map(([key, group]) => {
        const first = group[0] || {};
        const cars = mzjUniqueStrings(group.flatMap((row) => []
          .concat(row.selectedCars || [])
          .concat(row.selectedCarValues || [])
          .concat(row.carType || [])
          .concat((row.contentItems || []).map((i)=>i?.carType))
          .concat((row.photoItems || []).map((i)=>i?.carType))
        ).filter(Boolean));
        const types = mzjUniqueStrings(group.flatMap((row) => []
          .concat(row.selectedContentTypes || [])
          .concat(row.selectedContentTypeTitles || [])
          .concat(row.contentType || [])
          .concat((row.contentItems || []).map((i)=>i?.contentType || i?.title))
          .concat((row.photoItems || []).map((i)=>i?.contentType || i?.title))
        ).filter(Boolean).filter((v)=>!/^rct_/i.test(String(v))));
        const deptNames = mzjUniqueStrings(group.map((row) => row.departmentName || row.targetDepartmentName || row.departmentId).filter(Boolean));
        const userNames = mzjUniqueStrings(group.map((row) => row.assigneeName || row.userName || row.userDisplayName || row.assigneeEmail || row.userEmail).filter(Boolean));
        const statusDone = group.every((row) => row.received || row.receivedConfirmed);
        return `<article class="campaign-full-assignment-row">
          <div class="campaign-full-assignment-cell"><small>تكليف ${esc(key)}</small><strong>${esc(first.requiredText || first.manualRequired || first.notes || first.deliveryDetails || first.taskName || '—')}</strong></div>
          <div class="campaign-full-assignment-cell">${cars.length ? cars.map((x)=>`<span class="campaign-detail-chip">${esc(x)}</span>`).join('') : '—'}</div>
          <div class="campaign-full-assignment-cell">${esc(first.contentSectionName || first.requiredDetails?.contentSectionName || '—')}</div>
          <div class="campaign-full-assignment-cell">${types.length ? types.map((x)=>`<span class="campaign-detail-chip is-type">${esc(x)}${renderQty(first, x)}</span>`).join('') : '—'}</div>
          <div class="campaign-full-assignment-cell">${deptNames.length ? deptNames.map((x)=>`<span class="campaign-detail-chip">${esc(x)}</span>`).join('') : '—'}</div>
          <div class="campaign-full-assignment-cell">${userNames.length ? userNames.map((x)=>`<span class="campaign-detail-chip">${esc(x)}</span>`).join('') : '—'}</div>
          <div class="campaign-full-assignment-cell"><span class="campaign-status-pill ${statusDone ? 'is-done' : ''}">${statusDone ? 'تم الاستلام' : 'قيد التنفيذ'}</span></div>
        </article>`;
      }).join('')}
    </div>`;
  }
  function renderPublishScheduleRows(task){
    const entries = safeArray(task.publishScheduleEntries);
    if (!entries.length) return '<p class="task-empty-note">لا يوجد جدول نشر محفوظ.</p>';
    return `<div class="campaign-full-table-wrap"><table class="campaign-full-table"><thead><tr><th>اليوم</th><th>التاريخ</th><th>المحتوى</th></tr></thead><tbody>
      ${entries.map((entry) => `<tr><td>${esc(entry.day || '—')}</td><td>${esc(entry.date || '—')}</td><td>${esc(entry.content || safeArray(entry.items).map((i)=>i?.content || i?.title || i).filter(Boolean).join('، ') || '—')}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function renderBudgetDetailsRows(task){
    const items = safeArray(task.budgetDetails);
    if (!items.length) return '<p class="task-empty-note">لا توجد ميزانيات محفوظة.</p>';
    const total = items.reduce((sum, item) => sum + Number(item.value || item.amount || item.itemTotal || 0), 0);
    return `<div class="campaign-full-table-wrap"><table class="campaign-full-table"><thead><tr><th>Funnel</th><th>المنتج</th><th>المنصة</th><th>القيمة</th></tr></thead><tbody>
      ${items.map((item) => `<tr><td>${esc(item.funnel || item.funnelName || '—')}</td><td>${esc(item.product || item.productName || item.adName || '—')}</td><td>${esc(item.platform || item.platformName || item.platforms?.[0]?.name || '—')}</td><td>${esc(String(item.value || item.amount || item.itemTotal || 0))}</td></tr>`).join('')}
    </tbody><tfoot><tr><th colspan="3">الإجمالي</th><th>${esc(String(total))}</th></tr></tfoot></table></div>`;
  }
  function renderCampaignLogicRows(task){
    const items = safeArray(task.campaignLogic);
    if (!items.length) return '<p class="task-empty-note">لا توجد تفاصيل Campaign Logic محفوظة.</p>';
    return `<div class="campaign-logic-grid">${items.map((item) => `<div><small>${esc(item.label || item.key || item.title || 'عنصر')}</small><strong>${esc(item.value || item.text || item.details || '')}</strong></div>`).join('')}</div>`;
  }
  async function openCalendarTaskModal(id){
    const modal = calendarTaskModal();
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    modal.innerHTML = '<section class="campaign-full-dialog"><p class="task-empty-note">جاري تحميل التفاصيل...</p></section>';
    try {
      const task = await getCalendarTaskById(id);
      activeCalendarTask = task;
      modal.innerHTML = renderCalendarTaskModal(task);
    } catch (error) {
      modal.innerHTML = `<section class="campaign-full-dialog"><button class="modal-close-btn" type="button" data-close-calendar-task-modal>×</button><p class="task-empty-note">⚠️ فشل فتح التفاصيل: ${esc(error?.message || error)}</p></section>`;
    }
  }
  function renderCalendarTaskModal(task){
    return `<section class="campaign-full-dialog" role="dialog" aria-modal="true">
      <div class="campaign-full-head">
        <div><span class="eyebrow">تفاصيل كاملة</span><h2>${esc(task.campaignName || task.agendaName || 'حملة / أجندة')}</h2><p>${esc(task.campaignCode || '')}</p></div>
        <button class="modal-close-btn" type="button" data-close-calendar-task-modal>×</button>
      </div>
      <div class="campaign-full-actions">
        <button class="primary-btn" type="button" data-edit-calendar-task>تعديل كامل بنفس فورم إنشاء التاسك</button>
        <button class="soft-btn" type="button" data-cancel-calendar-task-edit hidden>إلغاء التعديل</button>
        <button class="primary-btn" type="button" data-save-calendar-task="${esc(taskDocId(task))}" hidden>حفظ التعديل</button>
      </div>
      <section class="workspace-card campaign-full-view-block" data-calendar-task-view>
        <div class="campaign-full-section-head"><span class="eyebrow">بيانات أساسية</span><h3>تفاصيل الحملة / الأجندة</h3></div>
        ${renderCalendarTaskInfoGrid(task)}
      </section>
      ${renderCalendarTaskEditForm(task)}
      <section class="workspace-card campaign-full-view-block"><div class="campaign-full-section-head"><span class="eyebrow">التكليفات</span><h3>المطلوب والسيارات وأنواع المحتوى والأقسام واليوزرات</h3></div>${renderDepartmentTaskRows(task)}</section>
      <section class="workspace-card campaign-full-view-block"><div class="campaign-full-section-head"><span class="eyebrow">النشر</span><h3>جدول النشر</h3></div>${renderPublishScheduleRows(task)}</section>
      <section class="workspace-card campaign-full-view-block"><div class="campaign-full-section-head"><span class="eyebrow">الميزانية</span><h3>تفاصيل الميزانية</h3></div>${renderBudgetDetailsRows(task)}</section>
      <section class="workspace-card campaign-full-view-block"><div class="campaign-full-section-head"><span class="eyebrow">campaign logic</span><h3>تفاصيل الحملة</h3></div>${renderCampaignLogicRows(task)}</section>
    </section>`;
  }
  function setCalendarTaskModalEditMode(enabled){
    const modal = calendarTaskModal();
    if (!modal) return;
    modal.querySelector('[data-calendar-task-view]')?.toggleAttribute('hidden', enabled);
    modal.querySelector('#calendarTaskEditForm')?.toggleAttribute('hidden', !enabled);
    modal.querySelector('[data-edit-calendar-task]')?.toggleAttribute('hidden', enabled);
    modal.querySelector('[data-cancel-calendar-task-edit]')?.toggleAttribute('hidden', !enabled);
    modal.querySelector('[data-save-calendar-task]')?.toggleAttribute('hidden', !enabled);
  }
  async function saveCalendarTaskFromModal(id){
    const modal = calendarTaskModal();
    const form = modal?.querySelector('#calendarTaskEditForm');
    if (!form || !activeCalendarTask) return;
    const saveBtn = modal.querySelector('[data-save-calendar-task]');
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      taskType: data.taskType || activeCalendarTask.taskType || 'campaign',
      taskTypeLabel: (data.taskType || activeCalendarTask.taskType) === 'agenda' ? 'أجندة' : 'حملة',
      taskDate: data.taskDate || data.campaignStartDate || '',
      launchDate: data.campaignStartDate || data.taskDate || '',
      endDate: data.campaignEndDate || '',
      campaignName: data.campaignName || '',
      agendaName: data.campaignName || '',
      campaignTypeName: data.campaignTypeName || '',
      campaignCode: data.campaignCode || '',
      agendaMonth: data.agendaMonth || '',
      agendaYear: data.agendaYear || '',
      campaignStartDate: data.campaignStartDate || '',
      campaignEndDate: data.campaignEndDate || '',
      campaignGoal: data.campaignGoal || '',
      campaignDescription: data.campaignDescription || '',
      campaignEndDescription: data.campaignDescription || '',
      updatedAt: new Date().toISOString()
    };
    try {
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...'; }
      const db = ensureFirebase();
      const docId = String(id || taskDocId(activeCalendarTask));
      await db.collection(TASK_COLLECTION).doc(docId).set(payload, { merge: true });
      activeCalendarTask = { ...activeCalendarTask, ...payload };
      modal.innerHTML = renderCalendarTaskModal(activeCalendarTask);
      await renderCampaignsCalendarList(pageRoot?.querySelector('[data-calendar-tab].is-active')?.dataset.calendarTab || 'campaigns');
      alert('تم حفظ التعديل');
    } catch (error) {
      alert('فشل حفظ التعديل: ' + (error?.message || error));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ التعديل'; }
    }
  }

  async function deleteReviewDocument(id){
    if (!isAdmin()) throw new Error('زر المسح للأدمن فقط.');
    const db = ensureFirebase();
    await db.collection(REVIEW_COLLECTION).doc(String(id)).delete();
  }

  function extractReviewSections(rows){
    const matrix = (rows || []).map((row) => (row || []).map(cellText));
    const findSectionIndex = (pattern) => matrix.findIndex((row) => row.some((cell) => pattern.test(cell)));
    const logicIndex = findSectionIndex(/campaign logic/i);
    const writingIndex = findSectionIndex(/Writing Rules|قواعد كتابة المحتوى/i);
    const executionIndex = findSectionIndex(/Content Execution Direction|آلية تنفيذ المحتوى/i);

    const logicItems = [];
    if (logicIndex >= 0) {
      const stop = writingIndex > logicIndex ? writingIndex : (executionIndex > logicIndex ? executionIndex : matrix.length);
      for (let i = logicIndex; i < stop; i += 1) {
        const row = matrix[i];
        if (!row.some(Boolean)) continue;
        const label = i === logicIndex ? (row[1] || row[0] || '') : (row[1] || '');
        const value = i === logicIndex ? (row[2] || row[1] || '') : (row[2] || '');
        if (!label && !value) continue;
        if (/campaign logic/i.test(label) && !value) continue;
        logicItems.push({ rowIndex: i, label, value, labelCol: label ? 1 : 0, valueCol: 2 });
      }
    }

    const writingRules = [];
    if (writingIndex >= 0) {
      const stop = executionIndex > writingIndex ? executionIndex : matrix.length;
      for (let i = writingIndex + 1; i < stop; i += 1) {
        const row = matrix[i];
        const values = row.filter(Boolean);
        if (!values.length) continue;
        const candidate = values[values.length - 1];
        if (!candidate || /قواعد كتابة المحتوى|Writing Rules/i.test(candidate)) continue;
        writingRules.push({ rowIndex: i, text: candidate, colIndex: row.lastIndexOf(candidate) });
      }
    }

    const headerRowIndex = findHeaderRow(matrix);
    const tasks = [];
    if (headerRowIndex >= 0) {
      const headers = matrix[headerRowIndex].map(cellText);
      const getCol = (pattern) => headers.findIndex((cell) => pattern.test(cell));
      const cols = {
        campaignType: getCol(/نوع الحمله|نوع الحملة|Campaign Type/i),
        contentType: getCol(/نوع المحتو[ىي]|Content Type/i),
        taskNo: getCol(/رقم التاسك|Task/i),
        goal: getCol(/^الهدف$|Goal/i),
        tangibleGoal: getCol(/الهدف الملموس/i),
        idea: getCol(/الفكرة|Idea/i),
        description: getCol(/وصف المحتو[ىي]|Description/i),
        message: getCol(/الرسالة|Message/i),
        writerRequest: getCol(/المطلوب من الكاتب|Writer/i),
        cta: getCol(/CTA/i)
      };
      let lastCampaignType = '';
      for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
        const row = matrix[i];
        if (!row.some(Boolean)) continue;
        const contentType = cols.contentType >= 0 ? cellText(row[cols.contentType]) : '';
        const taskNo = cols.taskNo >= 0 ? cellText(row[cols.taskNo]) : '';
        if (!contentType && !taskNo) continue;
        const campaignTypeRaw = cols.campaignType >= 0 ? cellText(row[cols.campaignType]) : '';
        if (campaignTypeRaw) lastCampaignType = campaignTypeRaw;
        tasks.push({
          rowIndex: i,
          campaignType: campaignTypeRaw || lastCampaignType,
          contentType,
          taskNo,
          goal: cols.goal >= 0 ? cellText(row[cols.goal]) : '',
          tangibleGoal: cols.tangibleGoal >= 0 ? cellText(row[cols.tangibleGoal]) : '',
          idea: cols.idea >= 0 ? cellText(row[cols.idea]) : '',
          description: cols.description >= 0 ? cellText(row[cols.description]) : '',
          message: cols.message >= 0 ? cellText(row[cols.message]) : '',
          writerRequest: cols.writerRequest >= 0 ? cellText(row[cols.writerRequest]) : '',
          cta: cols.cta >= 0 ? cellText(row[cols.cta]) : '',
          cols
        });
      }
    }

    return { logicItems, writingRules, tasks };
  }

  function renderReviewField(label, value){
    if (!value) return '';
    return `<div class="review-detail-row"><span class="review-detail-label">${esc(label)}</span><p class="review-detail-value">${esc(value)}</p></div>`;
  }

  function reviewCellKey(rowIndex, field) {
    return `${rowIndex}:${field}`;
  }

  function isReviewMarked(marks, rowIndex, field = '') {
    if (!marks || !marks.size) return false;
    if (field) return marks.has(reviewCellKey(rowIndex, field));
    return marks.has(String(rowIndex)) || marks.has(Number(rowIndex));
  }

  function reviewTaskCell(task, marks, field, extraClass = '', editable = false) {
    const key = reviewCellKey(task.rowIndex, field);
    const isMarked = isReviewMarked(marks, task.rowIndex, field);
    const value = task?.[field] || '';
    const col = task?.cols && Object.prototype.hasOwnProperty.call(task.cols, field) ? task.cols[field] : -1;
    return `<td class="review-mark-cell ${editable ? 'is-editable-cell' : ''} ${extraClass} ${isMarked ? 'is-marked' : ''}" data-review-cell="${esc(key)}" data-review-line="${task.rowIndex}" data-review-field="${esc(field)}" data-review-col="${esc(col)}" ${editable && col >= 0 ? 'contenteditable="true" spellcheck="false"' : ''}>${esc(value)}</td>`;
  }

  function renderReviewTaskRow(task, marks, editable = false){
    return `<tr class="review-exec-row" data-review-row="${task.rowIndex}">
      ${reviewTaskCell(task, marks, 'campaignType', '', editable)}
      ${reviewTaskCell(task, marks, 'contentType', 'review-content-type-cell', editable)}
      ${reviewTaskCell(task, marks, 'taskNo', '', editable)}
      ${reviewTaskCell(task, marks, 'goal', '', editable)}
      ${reviewTaskCell(task, marks, 'tangibleGoal', '', editable)}
      ${reviewTaskCell(task, marks, 'idea', '', editable)}
      ${reviewTaskCell(task, marks, 'description', '', editable)}
      ${reviewTaskCell(task, marks, 'message', '', editable)}
      ${reviewTaskCell(task, marks, 'writerRequest', '', editable)}
      ${reviewTaskCell(task, marks, 'cta', '', editable)}
    </tr>`;
  }

  function closeReviewModal(modal){
    const target = modal || document.querySelector('.review-modal.is-open');
    target?.classList.remove('is-open');
    target?.setAttribute('aria-hidden','true');
  }

  async function refreshReviewViews(){
    const activeTab = pageRoot?.querySelector('[data-calendar-tab].is-active')?.dataset.calendarTab;
    if (activeTab) await renderCampaignsCalendarList(activeTab);
    const dashboardRoot = document.getElementById(dashboardReviewRootId);
    if (dashboardRoot && isAdmin()) {
      try {
        const reviews = (await loadReviews()).filter((review) => review.status !== 'approved');
        dashboardRoot.innerHTML = reviews.length ? reviews.map(renderReviewCard).join('') : '<p class="task-empty-note">لا توجد حملات تحت المراجعة حالياً.</p>';
      } catch (error) {
        dashboardRoot.innerHTML = `<p class="task-empty-note">⚠️ فشل تحميل مراجعات الحملات: ${esc(error?.message || error)}</p>`;
      }
    }
  }

  async function openReviewModal(id){
    const modal = document.getElementById('campaignReviewModal') || document.getElementById('dashboardCampaignReviewModal');
    if (!modal) return;
    const reviews = await loadReviews();
    const review = reviews.find((item) => String(item.firestoreId || item.id) === String(id));
    if (!review) return;
    const rows = safeReviewRowsToMatrix(review.rows || []);
    const sections = extractReviewSections(rows);
    const marks = new Set((review.marks || []).map((m) => {
      if (m && m.cellKey) return String(m.cellKey);
      if (m && m.field) return reviewCellKey(Number(m.rowIndex), m.field);
      return Number(m.rowIndex);
    }));
    const canEdit = isAdmin();
    const canOwnerEdit = !canEdit && isReviewOwner(review) && String(review.status || '') !== 'approved';
    const editableHint = canOwnerEdit ? '<small class="review-edit-hint">يمكنك تعديل الخانات المكتوبة ثم حفظها لإرسالها للمراجعة مرة أخرى.</small>' : '';
    modal.innerHTML = `<div class="review-modal-card review-modal-card--sheet-view" data-review-modal-id="${esc(review.firestoreId || review.id)}" data-review-rows="${esc(JSON.stringify(rows))}">
      <button class="modal-close" type="button" data-close-review-modal>×</button>
      <div class="review-modal-head review-modal-head--sheet-view">
        <div>
          <span class="review-status-badge">${esc(statusLabel(review.status))}</span>
          <h3>${esc(review.campaignName || review.fileName || 'حملة تحت المراجعة')}</h3>
          <p>${esc(review.campaignTypeName || 'نوع غير محدد')} · بواسطة ${esc(review.submittedByName || review.submittedByEmail || 'غير محدد')}</p>
        </div>
      </div>
      <div class="review-modal-layout review-modal-layout--stacked">
        <section class="review-pane review-pane--full">
          <div class="review-block review-block--sheet">
            <div class="review-block-head"><h4>Campaign Logic</h4><small>${canEdit ? 'اضغط على أي سطر لتعليمه للمراجعة' : 'راجع ملاحظات الأدمن وعدّل المطلوب'}</small></div>
            ${editableHint}
            <div class="review-rich-lines review-rich-lines--sheet">
              ${sections.logicItems.length ? sections.logicItems.map((item) => `<button type="button" class="review-line review-rich-line ${canOwnerEdit ? 'is-user-editable' : ''} ${marks.has(item.rowIndex) ? 'is-marked' : ''}" data-review-line="${item.rowIndex}"><strong>${esc(item.label)}</strong><span ${canOwnerEdit ? 'contenteditable="true" spellcheck="false" data-review-edit-cell data-review-line="'+esc(item.rowIndex)+'" data-review-col="'+esc(item.valueCol)+'"' : ''}>${esc(item.value)}</span></button>`).join('') : '<p class="task-empty-note">لا توجد بيانات campaign logic.</p>'}
            </div>
          </div>
          <div class="review-block review-block--sheet">
            <div class="review-block-head"><h4>قواعد كتابة المحتوى</h4><small>القواعد المقروءة من نفس الشيت</small></div>
            <div class="review-rich-lines review-rich-lines--rules review-rich-lines--sheet">
              ${sections.writingRules.length ? sections.writingRules.map((item) => `<button type="button" class="review-line review-rule-line ${canOwnerEdit ? 'is-user-editable' : ''} ${marks.has(item.rowIndex) ? 'is-marked' : ''}" data-review-line="${item.rowIndex}"><span ${canOwnerEdit ? 'contenteditable="true" spellcheck="false" data-review-edit-cell data-review-line="'+esc(item.rowIndex)+'" data-review-col="'+esc(item.colIndex)+'"' : ''}>${esc(item.text)}</span></button>`).join('') : '<p class="task-empty-note">لا توجد قواعد كتابة محتوى.</p>'}
            </div>
          </div>
          <div class="review-block review-block--sheet">
            <div class="review-block-head"><h4>Content Execution Direction</h4><small>البيانات المعروضة هنا مقروءة من الشيت: نوع الحملة، نوع المحتوى، رقم التاسك، الهدف، الهدف الملموس، الفكرة، وصف المحتوى، الرسالة، المطلوب من الكاتب، CTA</small></div>
            ${sections.tasks.length ? `
              <div class="review-execution-table-wrap">
                <table class="review-execution-table">
                  <thead><tr>
                    <th>نوع الحملة</th>
                    <th>نوع المحتوى</th>
                    <th>رقم التاسك</th>
                    <th>الهدف</th>
                    <th>الهدف الملموس</th>
                    <th>الفكرة</th>
                    <th>وصف المحتوى</th>
                    <th>الرسالة</th>
                    <th>المطلوب من الكاتب</th>
                    <th>CTA</th>
                  </tr></thead>
                  <tbody>${sections.tasks.map((task) => renderReviewTaskRow(task, marks, canOwnerEdit)).join('')}</tbody>
                </table>
              </div>` : '<p class="task-empty-note">لا توجد تاسكات لعرضها.</p>'}
          </div>
          <div class="review-block review-block--notes">
            <div class="review-info-grid review-info-grid--sheet-meta">
              <div class="review-info-item"><span>اسم الحملة</span><strong>${esc(review.campaignName || '-')}</strong></div>
              <div class="review-info-item"><span>نوع الحملة</span><strong>${esc(review.campaignTypeName || '-')}</strong></div>
              <div class="review-info-item"><span>حالة المراجعة</span><strong>${esc(statusLabel(review.status))}</strong></div>
              <div class="review-info-item"><span>عدد أنواع المحتوى</span><strong>${esc(String((review.contentTypes || []).length || 0))}</strong></div>
            </div>
            <label class="mzj-field"><span>ملاحظات الأدمن لليوزر</span><textarea data-review-admin-notes rows="6" placeholder="اكتب الملاحظات هنا" ${canEdit ? '' : 'readonly'}>${esc(review.adminNotes || '')}</textarea></label>
            <div class="task-card-actions review-modal-actions">
              ${canEdit ? `<button class="secondary-btn" type="button" data-save-review-marks="${esc(review.firestoreId || review.id)}">حفظ الملاحظات</button><button class="primary-btn" type="button" data-approve-review="${esc(review.firestoreId || review.id)}">اعتماد وفتح للربط</button>` : ''}
              ${canOwnerEdit ? `<button class="primary-btn" type="button" data-resubmit-review="${esc(review.firestoreId || review.id)}">حفظ التعديل وإرسال للمراجعة</button>` : ''}
            </div>
          </div>
        </section>
      </div>
    </div>`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
  }

  function rowsFromEditableReviewModal(modal){
    let rows = [];
    try { rows = JSON.parse(modal?.querySelector('[data-review-rows]')?.dataset.reviewRows || modal?.dataset.reviewRows || '[]'); }
    catch (error) { rows = []; }
    modal.querySelectorAll('[data-review-edit-cell], [data-review-cell][contenteditable="true"]').forEach((cell) => {
      const rowIndex = Number(cell.dataset.reviewLine);
      const colIndex = Number(cell.dataset.reviewCol);
      if (Number.isNaN(rowIndex) || Number.isNaN(colIndex) || colIndex < 0) return;
      if (!Array.isArray(rows[rowIndex])) rows[rowIndex] = [];
      rows[rowIndex][colIndex] = cellText(cell.innerText || cell.textContent || '');
    });
    return rows;
  }

  async function resubmitReviewFromModal(id){
    const modal = document.querySelector('.review-modal.is-open');
    const rows = rowsFromEditableReviewModal(modal);
    const db = ensureFirebase();
    const parsedRows = rows.filter((row) => (row || []).some((cell) => cellText(cell)));
    const payload = {
      rows: parsedRows.map(rowToSafe),
      status: 'under_review',
      marks: [],
      adminNotes: '',
      resubmittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contentTypes: contentTypesFromRows(parsedRows),
      campaignName: findValue(parsedRows, ['اسم الحملة', 'اسم الحملة / الأجندة']) || undefined,
      campaignTypeName: findValue(parsedRows, ['نوع الحملة', 'نوع الحمله']) || undefined
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    await db.collection(REVIEW_COLLECTION).doc(String(id)).update(payload);
    return true;
  }

  async function saveReviewFromModal(id, status){
    const modal = document.querySelector('.review-modal.is-open');
    const tableMarked = Array.from(modal.querySelectorAll('[data-review-cell].is-marked')).map((cell) => ({
      rowIndex: Number(cell.dataset.reviewLine),
      field: cell.dataset.reviewField || '',
      cellKey: cell.dataset.reviewCell || '',
      markedAt: new Date().toISOString()
    }));
    const lineMarked = Array.from(modal.querySelectorAll('.review-line.is-marked:not([data-review-cell])')).map((btn) => ({
      rowIndex: Number(btn.dataset.reviewLine),
      markedAt: new Date().toISOString()
    }));
    const marked = tableMarked.concat(lineMarked);
    const notes = modal.querySelector('[data-review-admin-notes]')?.value || '';
    const db = ensureFirebase();
    const payload = { marks: marked, adminNotes: notes, updatedAt: new Date().toISOString() };
    if (status) payload.status = status;
    else payload.status = 'changes_requested';
    await db.collection(REVIEW_COLLECTION).doc(String(id)).update(payload);
    const reviews = await loadReviews();
    return reviews.find((item) => String(item.firestoreId || item.id) === String(id));
  }
  document.addEventListener('click', async (event) => {
    const close = event.target.closest('[data-close-review-modal]');
    if (close) { closeReviewModal(close.closest('.review-modal')); }
    const modalShell = event.target.classList?.contains('review-modal') ? event.target : null;
    if (modalShell) closeReviewModal(modalShell);
    const cell = event.target.closest('[data-review-cell]');
    if (cell && isAdmin()) {
      cell.classList.toggle('is-marked');
      return;
    }
    const line = event.target.closest('[data-review-line]');
    if (line && isAdmin()) line.classList.toggle('is-marked');
    const resubmit = event.target.closest('[data-resubmit-review]');
    if (resubmit) {
      try {
        await resubmitReviewFromModal(resubmit.dataset.resubmitReview);
        closeReviewModal();
        await refreshReviewViews();
        alert('تم حفظ التعديل وإرساله للمراجعة مرة أخرى.');
      } catch (error) { alert('فشل حفظ التعديل: ' + (error?.message || error)); }
      return;
    }
    const deleteBtn = event.target.closest('[data-delete-review]');
    if (deleteBtn && isAdmin()) {
      if (!confirm('هل تريد مسح حملة المراجعة؟')) return;
      try { await deleteReviewDocument(deleteBtn.dataset.deleteReview); await refreshReviewViews(); }
      catch (error) { alert('فشل مسح حملة المراجعة: ' + (error?.message || error)); }
      return;
    }
    const save = event.target.closest('[data-save-review-marks]');
    if (save) {
      await saveReviewFromModal(save.dataset.saveReviewMarks);
      closeReviewModal();
      await refreshReviewViews();
    }
    const approve = event.target.closest('[data-approve-review]');
    if (approve) {
      const review = await saveReviewFromModal(approve.dataset.approveReview, 'approved');
      closeReviewModal();
      await refreshReviewViews();
      if (window.MZJLoadReviewCampaignInCreateModal && review) window.MZJLoadReviewCampaignInCreateModal(review);
      else alert('تم الاعتماد. افتح الداش بورد لربط الحملة.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelectorAll('.review-modal.is-open').forEach((modal) => closeReviewModal(modal));
  });

  async function renderDashboardReviewBox(){
    const anchor = document.querySelector('.dashboard-main .stats-grid');
    if (!anchor || document.getElementById('dashboardReviewSection') || !isAdmin()) return;
    const section = document.createElement('section');
    section.className = 'workspace-card dashboard-review-section';
    section.id = 'dashboardReviewSection';
    section.innerHTML = `<div class="board-head"><h3>حملات تحت المراجعة</h3><span class="column-hint">اعتماد الشيت وفتحه للربط</span></div><div id="${dashboardReviewRootId}" class="review-cards-grid"><p class="task-empty-note">جاري التحميل...</p></div><div id="dashboardCampaignReviewModal" class="review-modal" aria-hidden="true"></div>`;
    anchor.insertAdjacentElement('afterend', section);
    try {
      const reviews = (await loadReviews()).filter((review) => review.status !== 'approved');
      const root = document.getElementById(dashboardReviewRootId);
      root.innerHTML = reviews.length ? reviews.map(renderReviewCard).join('') : '<p class="task-empty-note">لا توجد حملات تحت المراجعة حالياً.</p>';
      root.addEventListener('click', (event) => {
        const del = event.target.closest('[data-delete-review]');
        if (del && isAdmin()) {
          if (!confirm('هل تريد مسح حملة المراجعة؟')) return;
          deleteReviewDocument(del.dataset.deleteReview).then(refreshReviewViews).catch((error) => alert('فشل مسح حملة المراجعة: ' + (error?.message || error)));
          return;
        }
        const btn = event.target.closest('[data-open-review]');
        if (btn) openReviewModal(btn.dataset.openReview);
      });
    } catch (error) {
      document.getElementById(dashboardReviewRootId).innerHTML = `<p class="task-empty-note">⚠️ فشل تحميل مراجعات الحملات: ${esc(error?.message || error)}</p>`;
    }
  }
  renderCampaignsCalendarPage();
  renderDashboardReviewBox();
})();



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
    montage: ['مونتاج','المونتاج','montage'],
    publish: ['نشر','النشر','publish','publishing']
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
        ...d,
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
  function readLocalDashboardTasksFallback(){
    const local = [];
    TASK_KEYS.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : (Array.isArray(parsed?.tasks) ? parsed.tasks : []));
        list.forEach((item, index) => local.push({ sourceLocalKey: key, ...(item || {}), id: item?.id || item?.firestoreId || item?.docId || `${key}_${index}` }));
      } catch (error) {
        console.warn('dashboard local fallback failed:', key, error);
      }
    });
    return local;
  }

  function readTasks(){
    const all = [];
    const source = firestoreTaskCache.length ? firestoreTaskCache : readLocalDashboardTasksFallback();
    source.forEach((task, index) => all.push(normalizeWorkspaceTask(task, (task?.sourceLocalKey ? 'local_' : 'firestore_') + index)));
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

  let dashboardLiveUnsubscribers = [];
  let dashboardLiveStarted = false;
  let dashboardLiveRenderTimer = null;

  function scheduleDashboardLiveRender() {
    clearTimeout(dashboardLiveRenderTimer);
    dashboardLiveRenderTimer = setTimeout(() => {
      window.renderDashboardTasks?.();
      if (typeof window.renderCampaignRecordsLive === 'function') window.renderCampaignRecordsLive();
    }, 80);
  }

  function setDashboardLiveStatus(statusText) {
    const badge = document.getElementById('dashboardLiveStatus');
    if (badge) badge.textContent = statusText;
  }

  function mergeFirestoreLiveRecords(collectionName, docs) {
    const others = firestoreTaskCache.filter((item) => String(item.sourceFirestoreCollection || 'workspace_tasks') !== String(collectionName));
    const next = docs.map((doc) => ({
      id: doc.id,
      firestoreId: doc.id,
      sourceFirestoreCollection: collectionName,
      ...(doc.data() || {})
    }));
    firestoreTaskCache = others.concat(next);
  }

  function startDashboardLiveSync() {
    if (dashboardLiveStarted) return;
    if (!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) {
      setDashboardLiveStatus('Live غير متاح');
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const db = firebase.firestore();
      dashboardLiveStarted = true;
      setDashboardLiveStatus('Live متصل');

      dashboardLiveUnsubscribers = FIRESTORE_TASK_COLLECTIONS.map((collectionName) => {
        return db.collection(collectionName).onSnapshot((snap) => {
          mergeFirestoreLiveRecords(collectionName, snap.docs || []);
          scheduleDashboardLiveRender();
          setDashboardLiveStatus('Live متصل');
        }, (error) => {
          console.warn('dashboard live sync failed:', collectionName, error);
          setDashboardLiveStatus('Live يحتاج تحديث');
        });
      });
    } catch (error) {
      console.warn('dashboard live setup failed:', error);
      dashboardLiveStarted = false;
      setDashboardLiveStatus('Live يحتاج تحديث');
    }
  }

  window.startDashboardLiveSync = startDashboardLiveSync;

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
      setDashboardLiveStatus('Live يحتاج تحديث');
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
  function legacyDeptReadinessKey(deptTask){
    return deptTask.departmentId || deptTask.departmentName || deptTask.userName || '';
  }
  function dashboardDeptReadinessKey(deptTask, deptIndex = 0){
    const stable = deptTask.assignmentId || deptTask.linkKey || deptTask.taskNo || deptTask.contentTaskId || deptTask.contentType || deptTask.requiredText || deptIdentity(deptTask) || legacyDeptReadinessKey(deptTask) || 'dept';
    return `${stable}::${deptIndex}`;
  }
  function readinessStepsForDept(task, deptTask, deptIndex = 0){
    const readiness = task.readiness || {};
    const key = dashboardDeptReadinessKey(deptTask, deptIndex);
    const legacyKey = legacyDeptReadinessKey(deptTask);
    const selected = Array.isArray(readiness[key]) ? readiness[key] : (Array.isArray(readiness[legacyKey]) ? readiness[legacyKey] : []);
    return selected;
  }
  function taskDeptProgress(task, deptTask, deptIndex = 0){
    const selected = readinessStepsForDept(task, deptTask, deptIndex);
    const steps = taskStepsForDept(deptKey(deptTask.departmentName));
    const total = selected.reduce((sum, index) => sum + Number(steps[Number(index)]?.value || 0), 0);
    return Math.min(100, Math.round(total));
  }
  function taskReadiness(task){
    const depts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    if (!depts.length) return 0;
    const total = depts.reduce((sum, d, index) => sum + taskDeptProgress(task, d, index), 0);
    return Math.round(total / depts.length);
  }
  function taskReceiptProgress(task){
    const depts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    if (!depts.length) return 0;
    const done = depts.filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
    return Math.round((done / depts.length) * 100);
  }

  function dashboardTodayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function publishDepartments(task){
    return (task.departmentTasks || []).filter((dept) => deptKey(dept.departmentName) === 'publish');
  }
  function ensurePublishReadyDate(task){
    const readyWithoutPublish = (task.departmentTasks || []).filter((d) => d && d.enabled !== false && deptKey(d.departmentName) !== 'publish');
    const readyPercent = readyWithoutPublish.length
      ? Math.round(readyWithoutPublish.reduce((sum, d, index) => sum + taskDeptProgress(task, d, (task.departmentTasks || []).indexOf(d)), 0) / readyWithoutPublish.length)
      : taskReadiness(task);
    if (readyPercent < 100) return false;
    const date = task.publishReadyDate || dashboardTodayISO();
    let changed = false;
    task.publishReadyDate = date;
    publishDepartments(task).forEach((dept) => {
      if (!dept.receiveDate) { dept.receiveDate = date; changed = true; }
      if (!dept.receivedAt) { dept.receivedAt = date; changed = true; }
      dept.received = true;
      dept.receivedConfirmed = true;
    });
    return changed;
  }
  function deptIdentity(dept){
    return [dept.departmentId || dept.departmentKey || dept.departmentName || '', dept.userId || dept.uid || dept.assigneeUid || dept.userEmail || dept.userName || ''].map(v => String(v || '').trim()).filter(Boolean).join('::');
  }
  function autoStage(task){
    if (task.archived === true || task.archiveDate || task.archivedAt || task.stage === 'archive') {
      task.stage = 'archive';
      return task;
    }
    if (!task.stage) task.stage = 'required';
    const ready = taskReadiness(task);
    if (task.stage !== 'archive' && ready >= 100) {
      task.stage = 'publish';
      ensurePublishReadyDate(task);
    }
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
  function deptAssigneeLabel(dept){
    return dept.userDisplayName || dept.userName || dept.assigneeName || dept.userEmail || dept.assigneeEmail || 'بدون مسؤول';
  }
  function groupDepartmentsByAssignee(depts){
    const map = new Map();
    (depts || []).filter((d) => d && d.enabled !== false).forEach((dept) => {
      const label = deptAssigneeLabel(dept);
      const key = String(dept.userId || dept.userUid || dept.assigneeUid || dept.userEmail || dept.assigneeEmail || label || '').trim() || label;
      if (!map.has(key)) map.set(key, { label, depts: [] });
      map.get(key).depts.push(dept);
    });
    return Array.from(map.values());
  }
  function taskCampaignInfoRows(task){
    return [
      ['التاريخ', task.taskDate || task.date || task.launchDate || '—'],
      ['كود الحملة', task.campaignCode || task.code || task.campaignSerial || '—'],
      ['اسم الحملة', task.campaignName || task.name || task.title || task.templateName || '—'],
      ['نوع الحملة', task.taskTypeLabel || task.campaignType || task.taskType || task.type || '—'],
      ['الهدف من الحملة', task.campaignGoal || task.goal || task.objective || task.campaignObjective || '—'],
      ['تاريخ بداية الحملة', task.campaignStartDate || task.startDate || '—'],
      ['تاريخ نهاية الحملة', task.campaignEndDate || task.endDate || '—']
    ];
  }
  function renderTaskCampaignInfoBox(task){
    const rows = taskCampaignInfoRows(task || {});
    return `<section class="task-campaign-info-box" data-task-campaign-info-box>
      <div class="task-campaign-info-title">بيانات الحملة</div>
      <div class="task-campaign-info-grid">
        ${rows.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}
      </div>
    </section>`;
  }
  function requiredCard(task){
    const receipt = taskReceiptProgress(task);
    const activeDepts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    const receivedCount = activeDepts.filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
    const totalCount = activeDepts.length || 0;
    const groupedUsers = groupDepartmentsByAssignee(activeDepts);
    return `<article class="task-template-card dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)}</span></div>
      <div class="department-progress-row"><div class="department-progress-box"><small>نسبة تم الاستلام</small><strong>${receipt}%</strong></div><div class="department-progress-box"><small>الأقسام المستلمة</small><strong>${receivedCount} / ${totalCount}</strong></div></div>
      <div class="mini-progress"><span style="width:${receipt}%"></span></div>
      <div class="receipt-strip receipt-users-strip">${groupedUsers.map((group) => {
        const done = group.depts.filter((d) => Boolean(d.receivedConfirmed || d.received || d.receivedAt)).length;
        const total = group.depts.length;
        const isDone = done >= total;
        const taskNames = group.depts.map(departmentTaskShortName).filter(Boolean).slice(0, 2).join(' + ');
        return `<span class="${isDone ? 'is-done' : ''}"><strong>${esc(group.label)}</strong><em>${esc(total > 1 ? `${total} تكليفات` : (taskNames || 'تكليف واحد'))}</em><small>${isDone ? 'تم الاستلام' : `باقي ${total - done}`}</small></span>`;
      }).join('')}</div>
      <div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div><div class="task-empty-note">المطلوب يختفي من هنا تلقائياً لما كل اليوزرات يضغطوا تم الاستلام.</div>
    </article>`;
  }
  function readinessCard(task){
    const activeDepts = (task.departmentTasks || []).filter((d) => d && d.enabled !== false);
    const depts = activeDepts.filter((d) => deptKey(d.departmentName) !== 'publish');
    const ready = depts.length ? Math.round(depts.reduce((sum, d, index) => sum + taskDeptProgress(task, d, index), 0) / depts.length) : taskReadiness(task);
    const deptCount = Math.max(activeDepts.length, 1);
    return `<article class="readiness-card dynamic-dashboard-card compact-readiness-card" data-dash-task-id="${esc(task.id)}">
      <button class="readiness-card-summary" type="button" data-toggle-readiness-details>
        <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية ${ready}%</span></div>
        <div class="mini-progress"><span style="width:${ready}%"></span></div>
        <small>اضغط لعرض الأقسام والمحتوى</small>
      </button>
      <div class="readiness-details-panel" data-readiness-details hidden>
        <div class="readiness-grid readiness-dynamic-grid readiness-approval-grid">
          ${depts.map((d, deptIndex) => {
            const realIndex = activeDepts.indexOf(d);
            const dkey = deptKey(d.departmentName);
            const steps = encodeTaskSteps(getTaskDetailsSteps(dkey));
            const key = dashboardDeptReadinessKey(d, realIndex);
            const selected = readinessStepsForDept(task, d, realIndex).join(',');
            const departmentShare = Math.round((100 / deptCount) * 100) / 100;
            const percent = taskDeptProgress(task, d, realIndex);
            const requirement = formatDepartmentRequirement(d);
            const readinessItems = normalizeDepartmentContentItems(d);
            const readinessCars = mzjUniqueStrings([
              ...(Array.isArray(d.selectedCars) ? d.selectedCars : []),
              ...(Array.isArray(d.selectedCarValues) ? d.selectedCarValues : []),
              ...(Array.isArray(d.requiredDetails?.selectedCars) ? d.requiredDetails.selectedCars : []),
              ...(Array.isArray(d.requiredDetails?.selectedCarValues) ? d.requiredDetails.selectedCarValues : []),
              ...readinessItems.map((item) => item.carType),
              ...mzjSplitMultiValue(d.carType)
            ].map((value) => String(value || '').trim()).filter(Boolean));
            const readinessTypes = mzjUniqueStrings([
              ...(Array.isArray(d.selectedContentTypes) ? d.selectedContentTypes : []),
              ...(Array.isArray(d.selectedContentTypeTitles) ? d.selectedContentTypeTitles : []),
              ...(Array.isArray(d.requiredDetails?.selectedContentTypes) ? d.requiredDetails.selectedContentTypes : []),
              ...(Array.isArray(d.requiredDetails?.selectedContentTypeTitles) ? d.requiredDetails.selectedContentTypeTitles : []),
              ...readinessItems.map((item) => item.contentType),
              ...mzjSplitMultiValue(d.contentType)
            ].map((value) => String(value || '').trim()).filter(Boolean));
            const readinessCarsJson = encodeURIComponent(JSON.stringify(readinessCars));
            const readinessTypesJson = encodeURIComponent(JSON.stringify(readinessTypes));
            return `<div class="readiness-dept-item" data-dept-task-card data-task-id="${esc(task.id)}" data-task-type="${esc(task.taskTypeLabel || task.taskType || '')}" data-campaign-code="${esc(task.campaignCode || '')}" data-readiness-key="${esc(key)}" data-legacy-readiness-key="${esc(legacyDeptReadinessKey(d))}" data-dept-identity="${esc(deptIdentity(d))}" data-dept-key="${esc(dkey)}" data-department-share="${esc(departmentShare)}" data-group-count="1" data-completed-steps="${esc(selected)}">
              <button type="button" class="readiness-open-details" data-open-task-details data-task-id="${esc(task.id)}" data-dept-index="${esc(realIndex)}" data-readiness-key="${esc(key)}" data-dept-key="${esc(dkey)}" data-dept="${esc(d.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(requirement)}" data-dept-task-json="${esc(encodeURIComponent(JSON.stringify(d || {})))}" data-selected-cars-json="${esc(readinessCarsJson)}" data-selected-content-types-json="${esc(readinessTypesJson)}" data-steps="${esc(steps)}">
                <strong>${esc(d.departmentName || 'قسم')}</strong>
                <b class="dept-task-short-name">${esc(departmentTaskShortName(d))}</b>
                <small>${percent}%</small>
                <span>${esc(deptAssigneeLabel(d))}</span>
                <em>تفاصيل واعتماد</em>
              </button>
            </div>`;
          }).join('')}
        </div>
        <div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div>
      </div>
    </article>`;
  }
  function publishCard(task){
    ensurePublishReadyDate(task);
    const done = Array.isArray(task.publishSteps) ? task.publishSteps : [];
    const percent = Math.min(100, PUBLISH_STEPS.reduce((sum, step, i) => sum + (done.includes(i) ? Number(step.value || 0) : 0), 0));
    const publishDepts = publishDepartments(task);
    const publishDept = publishDepts[0] || {};
    const receiveDate = publishDept.receiveDate || task.publishReadyDate || (publishDept.receivedAt ? String(publishDept.receivedAt).slice(0,10) : '--');
    const deliveryDate = publishDept.deliveryDate || publishDept.publishDate || task.publishStartDate || '--';
    return `<article class="readiness-card dynamic-dashboard-card compact-readiness-card compact-publish-card publish-super-compact" data-dash-task-id="${esc(task.id)}">
      <button class="readiness-card-summary" type="button" data-toggle-publish-details>
        <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية النشر ${percent}%</span></div>
        <div class="mini-progress"><span style="width:${percent}%"></span></div>
        <small>اضغط لعرض تجهيزات النشر</small>
      </button>
      <div class="publish-details-panel" data-publish-details hidden>
        <div class="publish-compact-meta">
          <span>استلام: ${esc(receiveDate)}</span>
          <span>تسليم: ${esc(deliveryDate)}</span>
          <span>المسؤول: ${esc(publishDept.departmentName ? deptAssigneeLabel(publishDept) : '--')}</span>
        </div>
        <div class="publish-compact-actions">
          <button class="primary-btn ${deliveryDate !== '--' ? 'is-done' : ''}" type="button" data-start-publish data-task-id="${esc(task.id)}" ${!userIsAdmin()?'disabled':''}>${deliveryDate !== '--' ? 'تم بدء النشر' : 'بدء النشر'}</button>
          ${PUBLISH_STEPS.map((step,i)=>`<button type="button" class="task-step-btn publish-mini-step ${done.includes(i) ? 'is-done' : ''}" data-publish-step data-task-id="${esc(task.id)}" data-step-index="${i}" ${!userIsAdmin()?'disabled':''}>${esc(step.label)} <small>${esc(step.value)}%</small></button>`).join('')}
          <button class="danger-btn publish-mini-delete" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح</button>
        </div>
      </div>
    </article>`;
  }

  function safeDashboardCard(task, title, hint){
    return `<article class="readiness-card dynamic-dashboard-card compact-readiness-card" data-dash-task-id="${esc(task.id)}">
      <button class="readiness-card-summary" type="button">
        <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)}</span></div>
        <div class="mini-progress"><span style="width:${taskReadiness(task)}%"></span></div>
        <small>${esc(hint || title)}</small>
      </button>
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

  function userDeptCard(task, deptTask, deptIndex = 0, groupedDeptTasks = null, groupedDeptIndexes = null){
    const groupDepts = Array.isArray(groupedDeptTasks) && groupedDeptTasks.length ? groupedDeptTasks : [deptTask];
    const groupIndexes = Array.isArray(groupedDeptIndexes) && groupedDeptIndexes.length ? groupedDeptIndexes : [deptIndex];
    const groupProgressSum = groupDepts.reduce((sum, d, i) => sum + taskDeptProgress(task, d, groupIndexes[i] ?? deptIndex), 0);
    const p = Math.round(groupProgressSum / Math.max(groupDepts.length, 1));
    const groupCampaignPercent = Math.round(groupProgressSum / Math.max((task.departmentTasks || []).length, 1));
    const dkey = deptKey(deptTask.departmentName);
    const steps = encodeTaskSteps(getTaskDetailsSteps(dkey));
    const key = dashboardDeptReadinessKey(deptTask, deptIndex);
    const selected = readinessStepsForDept(task, deptTask, deptIndex).join(',');
    const departmentShare = Math.round((100 / Math.max((task.departmentTasks||[]).length,1)) * 100) / 100;
    const detailItems = normalizeDepartmentContentItems(deptTask);
    const detailCars = mzjUniqueStrings([
      ...(Array.isArray(deptTask.selectedCars) ? deptTask.selectedCars : []),
      ...(Array.isArray(deptTask.requiredDetails?.selectedCars) ? deptTask.requiredDetails.selectedCars : []),
      ...detailItems.map((item) => item.carType),
      ...mzjSplitMultiValue(deptTask.carType)
    ]);
    const detailTypes = mzjUniqueStrings([
      ...(Array.isArray(deptTask.selectedContentTypes) ? deptTask.selectedContentTypes : []),
      ...(Array.isArray(deptTask.requiredDetails?.selectedContentTypes) ? deptTask.requiredDetails.selectedContentTypes : []),
      ...detailItems.map((item) => item.contentType),
      ...mzjSplitMultiValue(deptTask.contentType)
    ]);
    const detailCarsJson = encodeURIComponent(JSON.stringify(detailCars));
    const detailTypesJson = encodeURIComponent(JSON.stringify(detailTypes));
    return `<article class="department-task-card dynamic-dashboard-card user-task-card-clean" data-dept-task-card data-task-id="${esc(task.id)}" data-task-type="${esc(task.taskTypeLabel || task.taskType || '')}" data-campaign-code="${esc(task.campaignCode || '')}" data-readiness-key="${esc(key)}" data-legacy-readiness-key="${esc(legacyDeptReadinessKey(deptTask))}" data-dept-identity="${esc(deptIdentity(deptTask))}" data-dept-key="${esc(dkey)}" data-department-share="${esc(departmentShare)}" data-completed-steps="${esc(selected)}">
      <div class="task-template-top user-task-title-only"><strong>${esc(taskTitle(task))}</strong><span class="user-task-short-name">${esc(groupDepts.length > 1 ? `${groupDepts.length} تكليفات` : departmentTaskShortName(deptTask))}</span></div>
      <div class="department-task-meta labeled-task-meta user-task-meta-clean">
        <span class="meta-person"><small>المسؤول</small><strong>${esc(deptTask.userDisplayName || deptTask.userName || deptTask.userEmail || 'بدون مسؤول')}</strong></span>
        <span class="meta-receive"><small>تاريخ الاستلام</small><strong>${esc(deptTask.receiveDate || (deptTask.receivedAt ? String(deptTask.receivedAt).slice(0,10) : '—'))}</strong></span>
        <span class="meta-date meta-required"><small>${deptKindFromName(deptTask.departmentName) === 'publish' ? 'تاريخ الاطلاع' : 'تاريخ التسليم'}</small><strong>${esc(deptKindFromName(deptTask.departmentName) === 'publish' ? (deptTask.inspectionDate || '—') : (deptTask.deliveryDate || '—'))}</strong></span>
        <span class="meta-date meta-delivery"><small>${dkey === 'publish' ? 'تاريخ النشر' : 'تاريخ التسليم'}</small><strong>${esc(deptTask.deliveryDate || deptTask.publishDate || '—')}</strong></span>
        <span class="meta-status"><small>حالة الاستلام</small><strong>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم الاستلام' : 'لم يتم الاستلام'}</strong></span>
      </div>
      <div class="department-progress-row"><div class="department-progress-box"><small>اكتمال التاسك</small><strong data-task-percent>${p}%</strong></div><div class="department-progress-box"><small>نسبة الحملة</small><strong data-campaign-percent>${groupCampaignPercent}%</strong></div></div>
      <div class="mini-progress"><span data-task-bar style="width:${p}%"></span></div>
      <div class="task-card-actions"><button class="details-btn" type="button" data-open-task-details data-dept-index="${esc(deptIndex)}" data-readiness-key="${esc(key)}" data-dept-key="${esc(dkey)}" data-dept="${esc(deptTask.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(formatDepartmentRequirement(deptTask))}" data-dept-task-json="${esc(encodeURIComponent(JSON.stringify(deptTask || {})))}" data-selected-cars-json="${esc(detailCarsJson)}" data-selected-content-types-json="${esc(detailTypesJson)}" data-steps="${esc(steps)}">تفاصيل</button><button class="soft-btn receive-task-btn ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'is-done' : ''}" type="button" data-receive-task data-task-id="${esc(task.id)}" data-dept-index="${esc(deptIndex)}" data-readiness-key="${esc(key)}" data-dept-identity="${esc(deptIdentity(deptTask))}" ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'disabled' : ''}>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم تأكيد الاستلام' : 'تأكيد استلام التاسك'}</button></div>
    </article>`;
  }



  function dashboardContentTypesForDept(deptTask) {
    const items = normalizeDepartmentContentItems(deptTask);
    const types = mzjUniqueStrings(items.map((item) => item.contentType));
    return types.length ? types : [departmentTaskShortName(deptTask) || 'مطلوب'];
  }

  function dashboardFilteredDeptByContentType(deptTask, contentType) {
    const items = normalizeDepartmentContentItems(deptTask).filter((item) => String(item.contentType || '').trim() === String(contentType || '').trim());
    const filteredItems = items.length ? items : normalizeDepartmentContentItems(deptTask);
    const cars = mzjUniqueStrings(filteredItems.map((item) => item.carType));
    return {
      ...deptTask,
      __contentTypeFilter: contentType,
      contentType,
      selectedContentTypes: contentType ? [contentType] : mzjUniqueStrings(filteredItems.map((item) => item.contentType)),
      selectedCars: cars,
      carType: cars.join('، '),
      contentItems: filteredItems,
      photoItems: deptKey(deptTask.departmentName) === 'shooting' ? filteredItems : (Array.isArray(deptTask.photoItems) ? deptTask.photoItems : []),
      selectedDeliverables: filteredItems.map((item) => ({
        title: item.contentType || contentType || 'مطلوب',
        contentType: item.contentType || contentType || '',
        carType: item.carType || '',
        requiredText: item.requiredText || '',
        details: [item.carType ? `السيارة: ${item.carType}` : '', item.requiredText || ''].filter(Boolean).join(' — '),
        printSize: item.printSize || ''
      }))
    };
  }

  function userContentTypeGroupCard(group) {
    const entries = group.entries || [];
    const first = entries[0] || {};
    const firstTask = first.task || {};
    const firstDept = first.dept || {};
    const listKey = group.listKey || deptKey(firstDept.departmentName);
    const steps = encodeTaskSteps(getTaskDetailsSteps(listKey));
    const progressSum = entries.reduce((sum, entry) => sum + taskDeptProgress(entry.task, entry.dept, entry.index), 0);
    const p = Math.round(progressSum / Math.max(entries.length, 1));
    const campaignPercent = Math.round(progressSum / Math.max(entries.reduce((sum, entry) => sum + Math.max((entry.task.departmentTasks || []).length, 1), 0), 1));
    const taskRows = entries.map((entry, rowIndex) => {
      const filteredDept = dashboardFilteredDeptByContentType(entry.dept, group.contentType);
      const cars = mzjUniqueStrings(normalizeDepartmentContentItems(filteredDept).map((item) => item.carType));
      const rowContentTypes = group.contentType ? [group.contentType] : mzjUniqueStrings(normalizeDepartmentContentItems(filteredDept).map((item) => item.contentType));
      const rowCarsJson = encodeURIComponent(JSON.stringify(cars));
      const rowContentTypesJson = encodeURIComponent(JSON.stringify(rowContentTypes));
      const key = dashboardDeptReadinessKey(entry.dept, entry.index);
      const selected = readinessStepsForDept(entry.task, entry.dept, entry.index).join(',');
      const dkey = deptKey(entry.dept.departmentName);
      return `<article class="content-type-user-task-row">
        <div class="content-type-user-task-main">
          <b>${esc(entry.task.campaignName || taskTitle(entry.task) || `تاسك ${rowIndex + 1}`)}</b>
          <small>${esc(cars.length ? cars.join('، ') : departmentTaskShortName(entry.dept))}</small>
        </div>
        <button class="details-btn" type="button" data-open-task-details data-task-id="${esc(entry.task.id)}" data-dept-index="${esc(entry.index)}" data-readiness-key="${esc(key)}" data-dept-identity="${esc(deptIdentity(entry.dept))}" data-dept-key="${esc(dkey)}" data-dept="${esc(entry.dept.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(entry.task))}" data-required="${esc(formatDepartmentRequirement(filteredDept))}" data-dept-task-json="${esc(encodeURIComponent(JSON.stringify(filteredDept || {})))}" data-selected-cars-json="${esc(rowCarsJson)}" data-selected-content-types-json="${esc(rowContentTypesJson)}" data-steps="${esc(steps)}" data-completed-steps="${esc(selected)}">تفاصيل</button>
      </article>`;
    }).join('');
    return `<article class="department-task-card dynamic-dashboard-card user-content-type-group-card" data-dept-task-card data-task-id="${esc(firstTask.id || '')}" data-task-type="${esc(firstTask.taskTypeLabel || firstTask.taskType || '')}" data-campaign-code="${esc(firstTask.campaignCode || '')}" data-readiness-key="${esc(first.dept ? dashboardDeptReadinessKey(first.dept, first.index || 0) : '')}" data-legacy-readiness-key="${esc(first.dept ? legacyDeptReadinessKey(first.dept) : '')}" data-dept-identity="${esc(first.dept ? deptIdentity(first.dept) : '')}" data-dept-key="${esc(listKey)}" data-department-share="${esc(100 / Math.max(entries.length, 1))}" data-completed-steps="">
      <div class="task-template-top user-task-title-only content-type-group-head">
        <strong>${esc(group.contentType || 'نوع محتوى')}</strong>
        <span class="user-task-short-name">${esc(entries.length)} تاسك</span>
      </div>
      <div class="content-type-user-task-list">${taskRows}</div>
      <div class="department-progress-row"><div class="department-progress-box"><small>متوسط اكتمال التاسكات</small><strong data-task-percent>${p}%</strong></div><div class="department-progress-box"><small>متوسط مساهمة الحملات</small><strong data-campaign-percent>${campaignPercent}%</strong></div></div>
      <div class="mini-progress"><span data-task-bar style="width:${p}%"></span></div>
    </article>`;
  }

  window.renderDashboardTasks = function renderDashboardTasks(){
    if (!document.getElementById('adminRequiredTasks') && !document.getElementById('userShootingTasks')) return;
    const query = document.getElementById('dashboardTaskSearch')?.value || '';
    let tasks = [];
    try {
      tasks = readTasks()
        .map((task) => {
          try { return autoStage(task); }
          catch (error) { console.warn('dashboard task autoStage failed:', task?.id, error); return task; }
        })
        .filter((task) => {
          try { return taskMatchesDashboardSearch(task, query); }
          catch (error) { console.warn('dashboard search filter failed:', task?.id, error); return true; }
        });
    } catch (error) {
      console.error('dashboard render load failed:', error);
      tasks = [];
    }
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
      try {
        const publishDepts = (task.departmentTasks || []).filter((dept) => deptKey(dept.departmentName) === 'publish');
        if (task.stage === 'archive') appendCard(archive, archiveCard(task));
        else {
          if (taskReceiptProgress(task) < 100) appendCard(required, requiredCard(task));
          try {
            appendCard(readiness, readinessCard(task));
          } catch (error) {
            console.warn('readiness card failed:', task?.id, error);
            appendCard(readiness, safeDashboardCard(task, 'جاهزية المطلوب', 'اضغط تحديث لو التفاصيل لم تظهر'));
          }
          if (publishDepts.length || task.stage === 'publish') {
            try {
              appendCard(publishing, publishCard(task));
            } catch (error) {
              console.warn('publish card failed:', task?.id, error);
              appendCard(publishing, safeDashboardCard(task, 'قسم النشر', 'تجهيزات النشر'));
            }
          }
        }

        const visibleGroups = new Map();
        (task.departmentTasks || []).forEach((dept, deptIndex) => {
          const visible = assignedToCurrentUser(dept, current);
          if (!visible) return;
          const listKey = deptKey(dept.departmentName);
          dashboardContentTypesForDept(dept).forEach((contentType) => {
            const groupKey = `${listKey}::${contentType}`;
            if (!visibleGroups.has(groupKey)) visibleGroups.set(groupKey, { listKey, contentType, entries: [] });
            visibleGroups.get(groupKey).entries.push({ task, dept, index: deptIndex });
          });
        });
        visibleGroups.forEach((group) => {
          const targetList = userLists[group.listKey];
          if (!targetList) return;
          appendCard(targetList, userContentTypeGroupCard(group));
        });
      } catch (error) {
        console.warn('dashboard task card render failed:', task?.id, error);
      }
    });
    if (!tasks.length && required) {
      required.innerHTML = '<article class="task-template-card dashboard-empty-card"><div class="task-empty-note">لا توجد تاسكات محملة حالياً. اضغط تحديث أو تأكد من اتصال Firebase.</div></article>';
    }
    Object.entries(userLists).forEach(([key,el]) => ensureEmpty(el, 'لا توجد تاسكات حالياً.'));
  };

  document.addEventListener('click', function(event){
    const startPublish = event.target.closest('[data-start-publish]');
    if (startPublish) {
      if (!userIsAdmin()) return;
      const tasks = readTasks();
      const task = tasks.find(t => String(t.id) === String(startPublish.dataset.taskId));
      if (!task) return;
      const date = dashboardTodayISO();
      task.publishStartDate = task.publishStartDate || date;
      publishDepartments(task).forEach((dept) => {
        dept.deliveryDate = dept.deliveryDate || date;
        dept.publishDate = dept.publishDate || date;
      });
      task.stage = 'publish';
      autoStage(task);
      saveTaskToFirestore(task).then(() => window.renderDashboardTasks()).catch((error) => alert('فشل بدء النشر في Firebase: ' + (error?.message || error?.code || error)));
      return;
    }

    const toggleReadiness = event.target.closest('[data-toggle-readiness-details]');
    if (toggleReadiness) {
      const card = toggleReadiness.closest('.compact-readiness-card');
      const panel = card?.querySelector('[data-readiness-details]');
      if (panel) {
        panel.hidden = !panel.hidden;
        card.classList.toggle('is-open', !panel.hidden);
      }
      return;
    }

    const togglePublish = event.target.closest('[data-toggle-publish-details]');
    if (togglePublish) {
      const card = togglePublish.closest('.compact-publish-card');
      const panel = card?.querySelector('[data-publish-details]');
      if (panel) {
        panel.hidden = !panel.hidden;
        card.classList.toggle('is-open', !panel.hidden);
      }
      return;
    }

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
      task.readiness = task.readiness || {};

      const blocks = Array.from(taskStepButtons?.querySelectorAll('[data-assignment-step-block]') || []);
      if (blocks.length) {
        blocks.forEach((block) => {
          const key = block.dataset.readinessKey || '';
          const legacyKey = block.dataset.legacyReadinessKey || '';
          const selected = Array.from(block.querySelectorAll('.task-step-btn.is-done')).map((btn) => Number(btn.dataset.stepIndex)).filter((value) => !Number.isNaN(value));
          if (legacyKey && legacyKey !== key) delete task.readiness[legacyKey];
          if (key) task.readiness[key] = selected;
          const dept = (task.departmentTasks || []).find((d, index) => String(dashboardDeptReadinessKey(d, index)) === String(key));
          const stepButtons = Array.from(block.querySelectorAll('.task-step-btn'));
          const lastIndex = stepButtons.length ? Number(stepButtons[stepButtons.length - 1].dataset.stepIndex) : -1;
          if (dept && selected.includes(lastIndex)) {
            const today = todayISODate();
            if (deptKindFromName(dept.departmentName) === 'publish') dept.inspectionDate = dept.inspectionDate || today;
            else dept.deliveryDate = dept.deliveryDate || today;
          }
        });
      } else {
        const key = activeTaskCard.dataset.readinessKey || '';
        const legacyKey = activeTaskDetailsMeta?.legacyReadinessKey || '';
        if (legacyKey && legacyKey !== key) delete task.readiness[legacyKey];
        task.readiness[key] = (activeTaskCard.dataset.completedSteps || '').split(',').filter(Boolean).map(Number);
        const dept = (task.departmentTasks || []).find((d, index) => String(dashboardDeptReadinessKey(d, index)) === String(key));
        const selected = task.readiness[key] || [];
        const stepButtons = Array.from(taskStepButtons?.querySelectorAll('.task-step-btn') || []);
        const lastIndex = stepButtons.length ? Number(stepButtons[stepButtons.length - 1].dataset.stepIndex) : -1;
        if (dept && selected.includes(lastIndex)) {
          const today = todayISODate();
          if (deptKindFromName(dept.departmentName) === 'publish') dept.inspectionDate = dept.inspectionDate || today;
          else dept.deliveryDate = dept.deliveryDate || today;
        }
      }

      autoStage(task);
      saveTaskToFirestore(task).then(() => window.renderDashboardTasks()).catch((error) => alert('فشل تحديث تفاصيل التاسك في Firebase: ' + (error?.message || error?.code || error)));
    }, 0);
  });

  document.addEventListener('click', async function(event){
    const receive = event.target.closest('[data-receive-task]');
    if (!receive) return;
    if (receive.disabled) return;

    const tasks = readTasks();
    const task = tasks.find(t => String(t.id) === String(receive.dataset.taskId));
    if (!task) return;

    const current = user();
    const identity = String(receive.dataset.deptIdentity || '');
    const readinessKey = String(receive.dataset.readinessKey || '');
    const deptIndexRaw = receive.dataset.deptIndex;
    const deptIndex = deptIndexRaw === undefined || deptIndexRaw === '' ? -1 : Number(deptIndexRaw);

    const departmentTasks = Array.isArray(task.departmentTasks) ? task.departmentTasks : [];
    let dept = Number.isInteger(deptIndex) && deptIndex >= 0 ? departmentTasks[deptIndex] : null;

    if (!dept && readinessKey) {
      dept = departmentTasks.find((d, index) => String(dashboardDeptReadinessKey(d, index)) === readinessKey);
    }
    if (!dept && identity) {
      const candidates = departmentTasks
        .map((d, index) => ({ d, index }))
        .filter(({ d }) => String(deptIdentity(d)) === identity);
      dept = candidates.find(({ d }) => !(d.receivedConfirmed || d.received || d.receivedAt))?.d || candidates[0]?.d || null;
    }

    if (!dept) return;

    if (!assignedToCurrentUser(dept, current)) {
      alert('التاسك ده مش مسند لحسابك.');
      return;
    }

    receive.disabled = true;
    const oldText = receive.textContent;
    receive.textContent = 'جاري تأكيد الاستلام...';

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
      receive.disabled = false;
      receive.textContent = oldText || 'تأكيد استلام التاسك';
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
    setTimeout(() => {
      startDashboardLiveSync();
      refreshWorkspaceTasksFromFirestore();
    }, 250);
  });

  window.addEventListener('beforeunload', function(){
    dashboardLiveUnsubscribers.forEach((unsub) => {
      try { if (typeof unsub === 'function') unsub(); } catch(e) {}
    });
    dashboardLiveUnsubscribers = [];
    dashboardLiveStarted = false;
  });
})();
