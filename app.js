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
  return localStorage.getItem('mzj_user_role') || document.body.dataset.userRole || 'user';
}

function isAdminUser() {
  return getCurrentUserRole() === 'admin';
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
