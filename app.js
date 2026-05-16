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

function getCurrentUserRole() {
  const authUser = window.MZJAuth?.getUser?.();
  return authUser?.role || document.body.dataset.userRole || localStorage.getItem('mzj_user_role') || 'user';
}

function isAdminUser() {
  return ['admin','marketing_manager'].includes(getCurrentUserRole());
}

function syncTaskProgress() {
  if (!taskStepButtons) return;

  const activeButtons = Array.from(taskStepButtons.querySelectorAll('.task-step-btn.is-done'));
  const completed = activeButtons.length;
  const taskPercent = completed * 20;
  const campaignPercent = completed * 5;

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

function openTaskDetails(button) {
  if (!taskDetailsModal || !taskStepButtons) return;

  activeTaskCard = button.closest('[data-dept-task-card]') || button.closest('.dept-card-template');
  const selected = (activeTaskCard?.dataset.completedSteps || '').split(',').filter(Boolean);

  if (taskDetailsDept) taskDetailsDept.textContent = button.dataset.dept || 'تفاصيل القسم';
  if (taskDetailsTitle) taskDetailsTitle.textContent = button.dataset.taskTitle || 'تفاصيل التاسك';
  if (taskDetailsRequired) taskDetailsRequired.textContent = button.dataset.required || 'هنا يظهر المطلوب بعد ربط التاسك بالداتا.';

  taskStepButtons.innerHTML = '';
  const steps = (button.dataset.steps || '').split('|').map((step) => step.trim()).filter(Boolean);

  steps.forEach((step, index) => {
    const isApprovalStep = step.includes('اعتماد');
    const stepButton = document.createElement('button');
    stepButton.type = 'button';
    stepButton.className = 'task-step-btn';
    stepButton.dataset.stepIndex = String(index);
    stepButton.dataset.stepValue = '20';
    stepButton.dataset.campaignValue = '5';

    if (isApprovalStep) {
      stepButton.dataset.adminOnly = 'true';
      if (!isAdminUser()) {
        stepButton.disabled = true;
        stepButton.title = 'زر الاعتماد خاص بالأدمن فقط';
      }
    }

    if (selected.includes(String(index))) stepButton.classList.add('is-done');
    stepButton.innerHTML = `<span>${step}</span><small>20% من التاسك<br>5% من الحملة${isApprovalStep ? '<br>أدمن فقط' : ''}</small>`;
    taskStepButtons.appendChild(stepButton);
  });

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
const MZJ_TEMPLATE_STORAGE_KEY = 'mzj_task_templates_v2';
const MZJ_CREATED_TASKS_KEY = 'mzj_created_tasks_from_templates_v1';

function loadTaskTemplates() {
  try {
    return JSON.parse(localStorage.getItem(MZJ_TEMPLATE_STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function saveTaskTemplates(templates) {
  localStorage.setItem(MZJ_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
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
  if (Array.isArray(template.rows) && template.rows.length) {
    return template.rows
      .map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [])
      .filter((row) => row.some(Boolean));
  }
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

  function renderSavedTemplates() {
    const templates = loadTaskTemplates();
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

  async function parseTemplateFile(file) {
    if (!window.XLSX) throw new Error('مكتبة قراءة Excel لم يتم تحميلها. تأكد من الاتصال بالإنترنت أو أضف ملف xlsx.full.min.js محلياً.');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
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
      const templates = loadTaskTemplates();
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
        createdAt: new Date().toISOString()
      };
      templates.unshift(template);
      saveTaskTemplates(templates);
      renderSavedTemplates();
      renderTemplatePreview(preview, template, 'تم حفظ القالب');
      if (note) note.textContent = '✅ تم حفظ Template وسيظهر في نموذج إنشاء التاسك.';
      form.reset();
      pendingTemplateData = null;
    } catch (error) {
      if (note) note.textContent = '⚠️ ' + error.message;
    }
  });

  list.addEventListener('click', (event) => {
    const previewButton = event.target.closest('[data-preview-template]');
    const deleteButton = event.target.closest('[data-delete-template]');
    const templates = loadTaskTemplates();

    if (previewButton) {
      const template = templates.find((item) => item.id === previewButton.dataset.previewTemplate);
      renderTemplatePreview(preview, template, 'معاينة القالب');
      if (sheetName && template) sheetName.textContent = template.sheetName || 'Template محفوظ';
    }

    if (deleteButton) {
      const next = templates.filter((item) => item.id !== deleteButton.dataset.deleteTemplate);
      saveTaskTemplates(next);
      renderSavedTemplates();
      if (note) note.textContent = 'تم حذف Template.';
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
  return {
    id: item?.id || item?.docId || ('dept_' + index),
    name,
    users
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
  if (typeof user === 'string') return { name: user, email: user, label: user };
  const name = user.name || user.displayName || user.fullName || user.email || '';
  const email = user.email || '';
  if (!name && !email) return null;
  return {
    id: user.id || user.uid || email || name,
    name,
    email,
    department: user.department || user.departmentId || '',
    role: user.role || 'user',
    label: email && name && email !== name ? `${name} — ${email}` : (name || email)
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
  const deptUsers = Array.isArray(dept?.users) ? dept.users.map(normalizeSystemUser).filter(Boolean) : [];
  if (deptUsers.length) return deptUsers;
  return (allUsers || []).filter((user) => String(user.department || '') === String(dept?.id || '')).map(normalizeSystemUser).filter(Boolean);
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

function generateCampaignCode(taskType = 'campaign') {
  const prefix = taskType === 'agenda' ? 'AG' : 'CA';
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
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
  const generateCampaignCodeBtn = document.getElementById('generateCampaignCodeBtn');
  const campaignTypeSelect = document.getElementById('campaignTypeName');
  const newCampaignTypeInput = document.getElementById('newCampaignTypeName');
  const addCampaignTypeBtn = document.getElementById('addCampaignTypeBtn');
  const campaignStartDateLabel = document.getElementById('campaignStartDateLabel');
  const campaignEndDateLabel = document.getElementById('campaignEndDateLabel');
  const budgetItemsList = document.getElementById('budgetItemsList');
  const addBudgetItemBtn = document.getElementById('addBudgetItem');
  const budgetGrandTotalValue = document.getElementById('budgetGrandTotalValue');
  const publishScheduleRows = document.getElementById('publishScheduleRows');
  const addPublishScheduleRowBtn = document.getElementById('addPublishScheduleRow');

  if (!modal || !form || !typeSelect || !templateSelect || !departmentsList) return;

  let departmentsCache = [];
  let usersCache = [];
  let departmentIndex = 0;
  let platformsCache = [];
  let campaignTypesCache = [];

  function renderCampaignTypesOptions() {
    if (!campaignTypeSelect) return;
    const current = campaignTypeSelect.value;
    campaignTypeSelect.innerHTML = '<option value="">اختار نوع الحملة</option>' + campaignTypesCache.map((type) => `<option value="${escapeHTML(type.name)}">${escapeHTML(type.name)}</option>`).join('');
    if (current) campaignTypeSelect.value = current;
  }

  async function refreshCampaignTypes() {
    campaignTypesCache = await loadCampaignTypes();
    renderCampaignTypesOptions();
  }

  function applyDateLabels() {
    const isAgenda = typeSelect?.value === 'agenda';
    if (campaignStartDateLabel) campaignStartDateLabel.textContent = isAgenda ? 'تاريخ بداية الأجندة' : 'تاريخ بداية الحملة';
    if (campaignEndDateLabel) campaignEndDateLabel.textContent = isAgenda ? 'تاريخ نهاية الأجندة' : 'تاريخ نهاية الحملة';
  }

  function ensureGeneratedCode(force = false) {
    if (!campaignCodeInput) return;
    if (force || !campaignCodeInput.value) campaignCodeInput.value = generateCampaignCode(typeSelect?.value || 'campaign');
  }

  async function ensureDepartments() {
    departmentsCache = await loadDepartmentsFromContentTasks();
    usersCache = await loadUsersFromSystemPath();
    platformsCache = await loadMarketingPlatforms();
    await refreshCampaignTypes();
    applyDateLabels();
    ensureGeneratedCode();
    if (!departmentsList.children.length) renderAllDepartments();
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
          <small>اضغط لفتح القسم وتحديد اليوزر والمطلوب</small>
        </button>
        <span class="department-source-label">departments</span>
      </div>

      <div class="department-task-body" data-department-body>
        <div class="department-task-grid department-task-core-grid">
          <label class="mzj-field">
            <span>اليوزر / المسؤول</span>
            <select data-user-select>${renderUserOptions(usersForDepartment(dept, usersCache), dept.id, false)}</select>
          </label>

          <label class="mzj-field">
            <span>التاريخ المطلوب</span>
            <input type="date" data-required-date>
          </label>

          <label class="mzj-field">
            <span>تاريخ التسليم</span>
            <input type="date" data-delivery-date>
          </label>
        </div>

        ${buildSpecialDepartmentFields(kind)}

        <p class="admin-only-note department-receive-note">تأكيد استلام التاسك وتاريخ الاستلام ورفع الملف يتم من كارت اليوزر في الداش بورد.</p>
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
      return {
        kind,
        items,
        requiredText: items.map((item) => [item.carType ? `نوع السيارة: ${item.carType}` : '', item.contentType ? `نوع المحتوى: ${item.contentType}` : ''].filter(Boolean).join(' — ')).join(' | ')
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
    return Array.from(departmentsList.querySelectorAll('.department-task-row')).map((row) => {
      const enabled = Boolean(row.querySelector('[data-department-enabled]')?.checked);
      const departmentId = row.dataset.departmentId || '';
      const department = departmentsCache.find((dept) => String(dept.id) === String(departmentId));
      const kind = row.dataset.departmentKind || deptKindFromName(department?.name || '');
      const special = collectSpecialDepartmentDetails(row, kind);
      const requiredText = special.requiredText || '';
      const selectedUser = row.querySelector('[data-user-select]')?.value || '';
      const selectedOption = row.querySelector('[data-user-select] option:checked');
      const selectedName = selectedOption?.dataset.userName || selectedOption?.textContent || selectedUser;
      const selectedEmail = selectedOption?.dataset.userEmail || selectedUser;
      const selectedId = selectedOption?.dataset.userId || selectedOption?.dataset.userUid || selectedEmail || selectedName;
      return {
        enabled,
        departmentId,
        departmentKind: kind,
        departmentName: department?.name || '',
        userId: selectedId,
        userUid: selectedOption?.dataset.userUid || selectedId,
        userName: selectedName,
        userDisplayName: selectedName,
        userEmail: selectedEmail,
        assigneeUid: selectedOption?.dataset.userUid || selectedId,
        assigneeEmail: selectedEmail,
        assigneeName: selectedName,
        receiveDate: '',
        requiredDate: row.querySelector('[data-required-date]')?.value || '',
        deliveryDate: row.querySelector('[data-delivery-date]')?.value || '',
        receivedConfirmed: false,
        received: false,
        receivedAt: '',
        receivedBy: '',
        attachmentLabel: attachmentLabelForKind(kind),
        requiredText,
        requiredDetails: special
      };
    }).filter((task) => task.enabled && (task.departmentId || task.userName || task.requiredText));
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

  typeSelect.addEventListener('change', () => {
    fillTemplateOptions();
    applyDateLabels();
    ensureGeneratedCode(true);
  });

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

    if (taskType === 'campaign' && !selectedTemplate) {
      if (note) note.textContent = '⚠️ اختار قالب حملة محفوظ الأول.';
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
      templateName: selectedTemplate?.name || '',
      templateFields: selectedTemplate?.headers || [],
      templateValues: collectTemplateValues(),
      taskDate: formData.get('taskDate') || '',
      campaignName: formData.get('campaignName') || '',
      campaignCode: formData.get('campaignCode') || generateCampaignCode(taskType),
      campaignTypeName: formData.get('campaignTypeName') || '',
      campaignGoal: formData.get('campaignGoal') || '',
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
  const PUBLISH_STEPS = ['التجهيز 1','التجهيز 2','التجهيز 3','الاعتماد','النشر'];

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
  function taskTitle(task){ return task.campaignName || task.templateName || task.campaignCode || 'حملة بدون اسم'; }
  function deptKey(deptName){
    const value = String(deptName || '').toLowerCase();
    return Object.entries(DEPT_MAP).find(([key, words]) => words.some(w => value.includes(String(w).toLowerCase())))?.[0] || 'content';
  }
  function taskDeptProgress(task, deptTask){
    const readiness = task.readiness || {};
    const key = deptTask.departmentId || deptTask.departmentName || deptTask.userName || '';
    return Array.isArray(readiness[key]) ? readiness[key].length * 20 : 0;
  }
  function taskReadiness(task){
    const depts = task.departmentTasks || [];
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
    return String(dept.departmentId || dept.departmentName || dept.userId || dept.userEmail || dept.userName || '');
  }
  function autoStage(task){
    if (!task.stage) task.stage = 'required';
    const ready = taskReadiness(task);
    if (task.stage !== 'archive' && ready >= 100) task.stage = 'publish';
    if ((task.publishSteps || []).length >= 5) task.stage = 'archive';
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
    return `<article class="readiness-card dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية ${ready}%</span></div>
      <div class="mini-progress"><span style="width:${ready}%"></span></div>
      <div class="readiness-grid readiness-dynamic-grid">
        ${(task.departmentTasks||[]).map(d => `<div><strong>${esc(d.departmentName || 'قسم')}</strong><small>${taskDeptProgress(task,d)}%</small><small>${esc(d.requiredText || 'لا يوجد مطلوب مكتوب')}</small></div>`).join('')}
      </div><div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div>
    </article>`;
  }
  function publishCard(task){
    const done = task.publishSteps || [];
    const percent = done.length * 20;
    return `<article class="dept-card-template dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)} — جاهزية النشر ${percent}%</span></div>
      <div class="mini-progress"><span style="width:${percent}%"></span></div>
      <div class="publish-actions-grid">
        ${PUBLISH_STEPS.map((step,i)=>`<button type="button" class="task-step-btn ${done.includes(i) ? 'is-done' : ''}" data-publish-step data-task-id="${esc(task.id)}" data-step-index="${i}" ${!userIsAdmin()?'disabled':''}><span>${esc(step)}</span><small>20%</small></button>`).join('')}
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
    const steps = dkey === 'shooting' ? 'تصوير الجزء 1|الاعتماد|تصوير الجزء 2|الاعتماد|الإرفاق' :
      dkey === 'design' ? 'تصميم الجزء 1|الاعتماد|تصميم الجزء 2|الاعتماد|الإرفاق' :
      dkey === 'montage' ? 'مونتاج الجزء 1|الاعتماد|مونتاج الجزء 2|الاعتماد|الإرفاق' : 'نموذج المحتوى|الاعتماد|كتابة المحتوى|الاعتماد|الإرفاق';
    const key = deptTask.departmentId || deptTask.departmentName || deptTask.userName || '';
    const selected = ((task.readiness || {})[key] || []).join(',');
    return `<article class="department-task-card dynamic-dashboard-card" data-dept-task-card data-task-id="${esc(task.id)}" data-readiness-key="${esc(key)}" data-completed-steps="${esc(selected)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)}</span></div>
      <div class="department-task-meta labeled-task-meta">
        <span><small>المسؤول</small><strong>${esc(deptTask.userDisplayName || deptTask.userName || deptTask.userEmail || 'بدون مسؤول')}</strong></span>
        <span><small>تاريخ الاستلام</small><strong>${esc(deptTask.receiveDate || '—')}</strong></span>
        <span><small>التاريخ المطلوب</small><strong>${esc(deptTask.requiredDate || '—')}</strong></span>
        <span><small>تاريخ التسليم</small><strong>${esc(deptTask.deliveryDate || '—')}</strong></span>
        <span><small>حالة الاستلام</small><strong>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم الاستلام' : 'لم يتم الاستلام'}</strong></span>
      </div>
      <div class="department-progress-row"><div class="department-progress-box"><small>اكتمال التاسك</small><strong data-task-percent>${p}%</strong></div><div class="department-progress-box"><small>نسبة الحملة</small><strong data-campaign-percent>${Math.round(p / Math.max((task.departmentTasks||[]).length,1))}%</strong></div></div>
      <div class="mini-progress"><span data-task-bar style="width:${p}%"></span></div>
      <div class="task-card-actions"><button class="details-btn" type="button" data-open-task-details data-dept-key="${esc(dkey)}" data-dept="${esc(deptTask.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(deptTask.requiredText || 'لا يوجد مطلوب مكتوب')}" data-steps="${esc(steps)}">تفاصيل</button><button class="soft-btn receive-task-btn ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'is-done' : ''}" type="button" data-receive-task data-task-id="${esc(task.id)}" data-dept-identity="${esc(deptIdentity(deptTask))}" ${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'disabled' : ''}>${(deptTask.receivedConfirmed || deptTask.received || deptTask.receivedAt) ? 'تم الاستلام' : 'تم الاستلام'}</button></div>
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
      if (task.publishSteps.length >= 5) task.stage = 'archive';
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
