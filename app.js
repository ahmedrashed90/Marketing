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

function renderTemplatePreview(container, template, titlePrefix = 'شكل القالب') {
  if (!container) return;
  if (!template || !Array.isArray(template.headers) || !template.headers.length) {
    container.innerHTML = '<strong>' + titlePrefix + '</strong><p>لا يوجد Template مختار حالياً.</p>';
    return;
  }

  const chips = template.headers.map((header, index) => {
    const safeHeader = String(header || ('Field ' + (index + 1))).replace(/[<>&]/g, (ch) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]));
    const sample = template.sampleRow && template.sampleRow[index] ? String(template.sampleRow[index]).replace(/[<>&]/g, (ch) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch])) : 'خانة في النموذج';
    return `<div class="template-field-chip"><small>${index + 1}</small><strong>${safeHeader}</strong><small>${sample}</small></div>`;
  }).join('');

  container.innerHTML = `
    <strong>${titlePrefix}: ${template.name}</strong>
    <p>${template.fileName || 'Excel Template'} — ${typeLabel(template.type)}</p>
    <div class="template-fields-grid">${chips}</div>
  `;
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
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerRow = (rows[0] || []).map((cell) => String(cell).trim()).filter(Boolean);
    if (!headerRow.length) throw new Error('الشيت لازم يكون فيه أسماء أعمدة في أول صف.');
    const sampleRow = (rows[1] || []).map((cell) => String(cell).trim());
    return { sheetName: firstSheetName, headers: headerRow, sampleRow, rowsCount: rows.length };
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
      console.warn('user path fallback:', error);
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
    return `<option value="${escapeHTML(value)}" data-user-name="${escapeHTML(user.name || '')}" data-user-email="${escapeHTML(user.email || '')}">${escapeHTML(user.label || value)}</option>`;
  }).join('');
}

function usersForDepartment(dept, allUsers) {
  const deptUsers = Array.isArray(dept?.users) ? dept.users.map(normalizeSystemUser).filter(Boolean) : [];
  if (deptUsers.length) return deptUsers;
  return (allUsers || []).filter((user) => String(user.department || '') === String(dept?.id || '')).map(normalizeSystemUser).filter(Boolean);
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

  if (!modal || !form || !typeSelect || !templateSelect || !departmentsList) return;

  let departmentsCache = [];
  let usersCache = [];
  let departmentIndex = 0;

  async function ensureDepartments() {
    departmentsCache = await loadDepartmentsFromContentTasks();
    usersCache = await loadUsersFromSystemPath();
    if (!departmentsList.children.length) renderAllDepartments();
  }

  function fillTemplateOptions() {
    const taskType = typeSelect.value;
    const showTemplates = taskType === 'campaign' || taskType === 'agenda';
    if (templateWrap) templateWrap.hidden = !showTemplates;

    if (!showTemplates) {
      templateSelect.innerHTML = '<option value="">اختار Template محفوظ</option>';
      renderTemplatePreview(preview, null, 'شكل الحملة / الأجندة');
      renderTemplateFieldInputs(null);
      return;
    }

    const matching = loadTaskTemplates().filter((template) => templateMatchesType(template, taskType));
    const label = taskType === 'campaign' ? 'اختار قالب حملة محفوظ' : 'اختار قالب أجندة محفوظ';
    templateSelect.innerHTML = `<option value="">${label}</option>` + matching.map((template) => `<option value="${escapeHTML(template.id)}">${escapeHTML(template.name)}</option>`).join('');
    renderTemplatePreview(preview, null, taskType === 'campaign' ? 'شكل الحملة' : 'شكل الأجندة');
    renderTemplateFieldInputs(null);

    if (!matching.length) {
      preview.innerHTML = `<strong>${taskType === 'campaign' ? 'قوالب الحملات' : 'قوالب الأجندات'}</strong><p>لا يوجد قوالب محفوظة لهذا النوع حالياً. ارفع Template من صفحة قوالب الحملات.</p>`;
    }
  }

  function getSelectedTemplate() {
    return loadTaskTemplates().find((template) => template.id === templateSelect.value);
  }

  function renderTemplateFieldInputs(template) {
    if (!templateFieldsForm || !templateFieldsInputGrid) return;
    const headers = Array.isArray(template?.headers) ? template.headers.filter(Boolean) : [];
    if (!headers.length) {
      templateFieldsForm.hidden = true;
      templateFieldsInputGrid.innerHTML = '';
      return;
    }
    templateFieldsForm.hidden = false;
    templateFieldsInputGrid.innerHTML = headers.map((header, index) => {
      const value = template.sampleRow && template.sampleRow[index] ? template.sampleRow[index] : '';
      return `<label class="mzj-field template-dynamic-field"><span>${escapeHTML(header)}</span><input type="text" data-template-field="${index}" data-template-header="${escapeHTML(header)}" placeholder="اكتب ${escapeHTML(header)}" value="${escapeHTML(value)}"></label>`;
    }).join('');
  }

  function collectTemplateValues() {
    if (!templateFieldsInputGrid) return [];
    return Array.from(templateFieldsInputGrid.querySelectorAll('[data-template-field]')).map((input) => ({
      header: input.dataset.templateHeader || '',
      value: input.value || ''
    }));
  }

  function createDepartmentRow(dept) {
    const row = document.createElement('article');
    row.className = 'department-task-row department-task-row-selectable';
    row.dataset.departmentId = dept.id;
    row.innerHTML = `
      <div class="department-row-head">
        <label class="department-check-line">
          <input type="checkbox" data-department-enabled>
          <strong>${escapeHTML(dept.name)}</strong>
        </label>
        <span class="department-source-label">content_tasks</span>
      </div>

      <div class="department-task-grid">
        <label class="mzj-field">
          <span>اليوزر / المسؤول</span>
          <select data-user-select>${renderUserOptions(usersForDepartment(dept, usersCache), dept.id, false)}</select>
        </label>

        <label class="mzj-field">
          <span>تاريخ الاستلام</span>
          <input type="date" data-receive-date>
        </label>

        <label class="mzj-field">
          <span>التاريخ المطلوب</span>
          <input type="date" data-required-date>
        </label>

        <label class="mzj-field">
          <span>تاريخ التسليم</span>
          <input type="date" data-delivery-date>
        </label>

        <label class="mzj-field checkbox-field">
          <span>تأكيد استلام التاسك</span>
          <input type="checkbox" data-received-confirm>
        </label>

        <label class="mzj-field">
          <span>إرفاق المهام</span>
          <input type="text" data-attachment-label placeholder="مثال: إرفاق ملف التصوير">
        </label>
      </div>

      <label class="mzj-field full-width-field">
        <span>المطلوب</span>
        <textarea data-required-text rows="3" placeholder="اكتب المطلوب من القسم ده"></textarea>
      </label>
    `;
    departmentsList.appendChild(row);
  }

  function renderAllDepartments() {
    departmentsList.innerHTML = '';
    departmentsCache.forEach((dept) => createDepartmentRow(dept));
  }

  function collectDepartmentTasks() {
    return Array.from(departmentsList.querySelectorAll('.department-task-row')).map((row) => {
      const enabled = Boolean(row.querySelector('[data-department-enabled]')?.checked);
      const departmentId = row.dataset.departmentId || '';
      const department = departmentsCache.find((dept) => String(dept.id) === String(departmentId));
      const selectedUser = row.querySelector('[data-user-select]')?.value || '';
      const requiredText = row.querySelector('[data-required-text]')?.value.trim() || '';
      return {
        enabled,
        departmentId,
        departmentName: department?.name || '',
        userName: selectedUser,
        userDisplayName: row.querySelector('[data-user-select] option:checked')?.dataset.userName || row.querySelector('[data-user-select] option:checked')?.textContent || selectedUser,
        userEmail: row.querySelector('[data-user-select] option:checked')?.dataset.userEmail || selectedUser,
        receiveDate: row.querySelector('[data-receive-date]')?.value || '',
        requiredDate: row.querySelector('[data-required-date]')?.value || '',
        deliveryDate: row.querySelector('[data-delivery-date]')?.value || '',
        receivedConfirmed: Boolean(row.querySelector('[data-received-confirm]')?.checked),
        attachmentLabel: row.querySelector('[data-attachment-label]')?.value.trim() || '',
        requiredText
      };
    }).filter((task) => task.enabled && (task.departmentId || task.userName || task.requiredText));
  }

  function openCreateTaskModal() {
    ensureDepartments().then(() => {
      fillTemplateOptions();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  if (openBtn) openBtn.addEventListener('click', openCreateTaskModal);
  if (openBtnMini) openBtnMini.addEventListener('click', openCreateTaskModal);

  typeSelect.addEventListener('change', fillTemplateOptions);

  templateSelect.addEventListener('change', () => {
    const selected = getSelectedTemplate();
    renderTemplatePreview(preview, selected, typeSelect.value === 'campaign' ? 'شكل الحملة' : 'شكل الأجندة');
    renderTemplateFieldInputs(selected);
  });


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
      campaignCode: formData.get('campaignCode') || '',
      campaignGoal: formData.get('campaignGoal') || '',
      launchDate: formData.get('launchDate') || '',
      departmentTasks,
      publishScheduleTemplate: document.getElementById('publishScheduleTemplate')?.files?.[0]?.name || '',
      budgetPlanTemplate: document.getElementById('budgetPlanTemplate')?.files?.[0]?.name || '',
      resultsReportTemplate: document.getElementById('resultsReportTemplate')?.files?.[0]?.name || '',
      sourceCollection: 'workspace_tasks',
      createdAt: new Date().toISOString(),
      stage: 'required',
      readiness: {},
      publishSteps: []
    };

    try {
      if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
        if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const ref = await firebase.firestore().collection('workspace_tasks').add(payload);
        payload.firestoreId = ref.id;
        payload.sourceFirestoreCollection = 'workspace_tasks';
      }
    } catch (error) {
      console.warn('workspace_tasks save fallback:', error);
    }

    const tasks = JSON.parse(localStorage.getItem(MZJ_CREATED_TASKS_KEY) || '[]');
    tasks.unshift(payload);
    localStorage.setItem(MZJ_CREATED_TASKS_KEY, JSON.stringify(tasks));

    try {
      const oldPathTasks = JSON.parse(localStorage.getItem('workspace_tasks') || '[]');
      oldPathTasks.unshift(payload);
      localStorage.setItem('workspace_tasks', JSON.stringify(oldPathTasks));
    } catch (error) {}

    if (note) note.textContent = '✅ تم حفظ التاسك في مسار workspace_tasks وظهر في الداش بورد وقاعدة البيانات.';
    renderTemplatePreview(preview, selectedTemplate, '✅ تم حفظ التاسك من القالب');
    if (typeof window.renderDashboardTasks === 'function') window.renderDashboardTasks();
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
        userName: d.userName || d.responsible || d.assignee || d.owner || d.user || '',
        userEmail: d.userEmail || d.email || d.assigneeEmail || '',
        receiveDate: d.receiveDate || d.receivedAt || d.startDate || '',
        requiredDate: d.requiredDate || d.deadline || d.dueDate || '',
        deliveryDate: d.deliveryDate || d.deliveredAt || d.completedAt || '',
        receivedConfirmed: Boolean(d.receivedConfirmed || d.confirmed || d.received),
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
    TASK_KEYS.forEach((key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(parsed)) parsed.forEach((task, index) => all.push(normalizeWorkspaceTask(task, key + '_' + index)));
      } catch(e) {}
    });
    firestoreTaskCache.forEach((task, index) => all.push(normalizeWorkspaceTask(task, 'firestore_' + index)));
    const map = new Map();
    all.filter(Boolean).forEach((task) => map.set(String(task.id), { ...(map.get(String(task.id)) || {}), ...task }));
    return Array.from(map.values());
  }
  function writeTasks(tasks){ localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); }
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
      console.warn('workspace_tasks load fallback:', error);
    }
  }
  async function deleteTaskEverywhere(taskId){
    const tasks = readTasks();
    const target = tasks.find((task) => String(task.id) === String(taskId));
    TASK_KEYS.forEach((key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(parsed.filter((task) => String(task.id || task.firestoreId || task.docId) !== String(taskId))));
        }
      } catch(e) {}
    });
    if (window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const collectionName = target?.sourceFirestoreCollection || 'workspace_tasks';
        const docId = target?.firestoreId || target?.docId || target?.id;
        if (docId) await firebase.firestore().collection(collectionName).doc(String(docId)).delete();
      } catch (error) {
        console.warn('workspace_tasks delete fallback:', error);
      }
    }
    firestoreTaskCache = firestoreTaskCache.filter((task) => String(task.id || task.firestoreId) !== String(taskId));
    writeTasks(readTasks().filter((task) => String(task.id) !== String(taskId)));
  }
  function esc(v){ return String(v || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function user(){ return window.MZJAuth?.getUser?.() || null; }
  function userIsAdmin(){ return (user()?.role || document.body.dataset.userRole) === 'admin'; }
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
    return `<article class="task-template-card dynamic-dashboard-card" data-dash-task-id="${esc(task.id)}">
      <div class="task-template-top"><strong>${esc(taskTitle(task))}</strong><span>${meta(task)}</span></div>
      <div class="receipt-strip">${(task.departmentTasks||[]).map(d=>`<span>${esc(d.departmentName || 'قسم')}</span>`).join('')}</div>
      <div class="task-card-actions"><button class="danger-btn" type="button" data-delete-task="${esc(task.id)}" data-admin-only>مسح الحملة</button></div><div class="task-empty-note">المطلوب اتسجل، وهيظهر لكل يوزر حسب القسم والمسؤول المختار.</div>
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
      <div class="department-task-meta"><span>${esc(deptTask.userName || 'بدون مسؤول')}</span><span>${esc(deptTask.receiveDate || '—')}</span><span>${esc(deptTask.requiredDate || '—')}</span><span>${esc(deptTask.deliveryDate || '—')}</span><span>—</span></div>
      <div class="department-progress-row"><div class="department-progress-box"><small>اكتمال التاسك</small><strong data-task-percent>${p}%</strong></div><div class="department-progress-box"><small>نسبة الحملة</small><strong data-campaign-percent>${Math.round(p / Math.max((task.departmentTasks||[]).length,1))}%</strong></div></div>
      <div class="mini-progress"><span data-task-bar style="width:${p}%"></span></div>
      <div class="task-card-actions"><button class="details-btn" type="button" data-open-task-details data-dept-key="${esc(dkey)}" data-dept="${esc(deptTask.departmentName || 'قسم')}" data-task-title="${esc(taskTitle(task))}" data-required="${esc(deptTask.requiredText || 'لا يوجد مطلوب مكتوب')}" data-steps="${esc(steps)}">تفاصيل</button></div>
    </article>`;
  }

  window.renderDashboardTasks = function renderDashboardTasks(){
    if (!document.getElementById('adminRequiredTasks') && !document.getElementById('userShootingTasks')) return;
    const tasks = readTasks().map(autoStage);
    writeTasks(tasks);
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
        appendCard(required, requiredCard(task));
        appendCard(readiness, readinessCard(task));
      }
      (task.departmentTasks || []).forEach(dept => {
        const visible = userIsAdmin() || !current || !dept.userName || [dept.userName, dept.userEmail, dept.email].filter(Boolean).some(v => String(v).toLowerCase() === String(current.name || current.email).toLowerCase());
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
      writeTasks(tasks.map(autoStage));
      window.renderDashboardTasks();
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
      writeTasks(tasks.map(autoStage));
      window.renderDashboardTasks();
    }, 0);
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

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(window.renderDashboardTasks, 120);
    setTimeout(refreshWorkspaceTasksFromFirestore, 250);
  });
})();
