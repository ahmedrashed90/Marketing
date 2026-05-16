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
