/**
 * DashboardManager — Dashboard listing, CRUD, and export UI.
 * Manages the dashboard browser. "New Dashboard" triggers the upload popup.
 */
class DashboardManager {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.onOpen = options.onOpen || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onCreate = options.onCreate || (() => {});
  }

  /**
   * Render the dashboard listing view.
   */
  async render() {
    if (!this.container) return;

    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'db-manager-header';
    header.innerHTML = `
      <div class="db-manager-title-row">
        <div>
          <h2 class="db-manager-title">Dashboard Builder</h2>
          <p class="db-manager-desc">Upload your data and get a professional analytics dashboard instantly</p>
        </div>
        <div class="db-manager-actions">
          <button class="db-manager-btn db-manager-btn-outline" id="db-import-btn">
            <span class="material-symbols-outlined">upload</span>
            <span>Import</span>
          </button>
          <button class="db-manager-btn db-manager-btn-primary" id="db-create-btn">
            <span class="material-symbols-outlined">add</span>
            <span>New Dashboard</span>
          </button>
        </div>
      </div>
    `;
    this.container.appendChild(header);

    // Loading state
    const grid = document.createElement('div');
    grid.className = 'db-manager-grid';
    grid.id = 'db-manager-grid';
    grid.innerHTML = `
      <div class="db-manager-loading">
        <div class="db-manager-spinner"></div>
        <span>Loading dashboards...</span>
      </div>
    `;
    this.container.appendChild(grid);

    // Load dashboards
    try {
      const dashboards = await DashboardDB.listDashboards();
      this._renderGrid(grid, dashboards);
    } catch (err) {
      console.error('DashboardManager: Failed to load dashboards', err);
      grid.innerHTML = `
        <div class="db-manager-error">
          <span class="material-symbols-outlined">error</span>
          <span>Failed to load dashboards</span>
        </div>
      `;
    }

    // Event listeners — New Dashboard triggers upload popup
    document.getElementById('db-create-btn')?.addEventListener('click', () => {
      if (window.dashboardApp) {
        window.dashboardApp.showUploadPopup();
      }
    });
    document.getElementById('db-import-btn')?.addEventListener('click', () => this._importDashboard());
  }

  _renderGrid(grid, dashboards) {
    grid.innerHTML = '';

    if (dashboards.length === 0) {
      grid.innerHTML = `
        <div class="db-manager-empty">
          <div class="db-manager-empty-icon">
            <span class="material-symbols-outlined">dashboard_customize</span>
          </div>
          <h3 class="db-manager-empty-title">No dashboards yet</h3>
          <p class="db-manager-empty-desc">Upload a CSV or Excel file to instantly generate a professional analytics dashboard with charts, KPIs, and data tables.</p>
          <button class="db-manager-btn db-manager-btn-primary db-manager-empty-btn" id="db-empty-create-btn">
            <span class="material-symbols-outlined">add</span>
            <span>Create Dashboard</span>
          </button>
        </div>
      `;
      document.getElementById('db-empty-create-btn')?.addEventListener('click', () => {
        if (window.dashboardApp) {
          window.dashboardApp.showUploadPopup();
        }
      });
      return;
    }

    dashboards.forEach(db => {
      const card = this._createDashboardCard(db);
      grid.appendChild(card);
    });
  }

  _createDashboardCard(dashboard) {
    const card = document.createElement('div');
    card.className = 'db-manager-card';
    card.setAttribute('data-dashboard-id', dashboard.id);

    const widgetCount = (dashboard.widgets || []).length;
    const updatedDate = new Date(dashboard.updatedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const updatedTime = new Date(dashboard.updatedAt).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });

    const chartCount = dashboard.widgets?.filter(w => w.type === 'chart').length || 0;
    const kpiCount = dashboard.widgets?.filter(w => w.type === 'kpi').length || 0;
    const tableCount = dashboard.widgets?.filter(w => w.type === 'table').length || 0;

    card.innerHTML = `
      <div class="db-manager-card-preview">
        <div class="db-manager-card-grid-preview">
          ${this._renderMiniPreview(dashboard.widgets || [])}
        </div>
        <div class="db-manager-card-overlay">
          <button class="db-manager-card-open-btn" data-action="open" data-id="${dashboard.id}">
            <span class="material-symbols-outlined">open_in_new</span>
            <span>Open</span>
          </button>
        </div>
      </div>
      <div class="db-manager-card-body">
        <div class="db-manager-card-title-row">
          <h3 class="db-manager-card-title" data-id="${dashboard.id}">${dashboard.name}</h3>
          <div class="db-manager-card-menu">
            <button class="db-manager-card-menu-btn" data-action="menu" data-id="${dashboard.id}" title="More options">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </div>
        <div class="db-manager-card-meta">
          <span class="db-manager-card-meta-item">
            <span class="material-symbols-outlined">schedule</span>
            ${updatedDate} · ${updatedTime}
          </span>
          <span class="db-manager-card-meta-item">
            <span class="material-symbols-outlined">widgets</span>
            ${widgetCount} widget${widgetCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div class="db-manager-card-badges">
          ${chartCount ? `<span class="db-manager-badge db-badge-chart">${chartCount} chart${chartCount !== 1 ? 's' : ''}</span>` : ''}
          ${kpiCount ? `<span class="db-manager-badge db-badge-kpi">${kpiCount} KPI${kpiCount !== 1 ? 's' : ''}</span>` : ''}
          ${tableCount ? `<span class="db-manager-badge db-badge-table">${tableCount} table${tableCount !== 1 ? 's' : ''}</span>` : ''}
          ${widgetCount === 0 ? '<span class="db-manager-badge db-badge-empty">Empty</span>' : ''}
        </div>
      </div>
    `;

    card.querySelector('[data-action="open"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpen(dashboard.id);
    });

    card.addEventListener('dblclick', () => this.onOpen(dashboard.id));

    const titleEl = card.querySelector('.db-manager-card-title');
    if (titleEl) {
      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this._startInlineRename(titleEl, dashboard);
      });
    }

    card.querySelector('[data-action="menu"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showCardMenu(e.target.closest('button'), dashboard);
    });

    return card;
  }

  _renderMiniPreview(widgets) {
    if (!widgets.length) {
      return '<div class="db-mini-empty"><span class="material-symbols-outlined">dashboard</span></div>';
    }

    // Simple colored blocks representing widget types
    const typeColors = {
      chart: document.documentElement.classList.contains('dark') ? '#ffffff' : '#121212',
      kpi: '#10b981',
      table: '#3b82f6',
      text: '#8b5cf6'
    };

    return widgets.slice(0, 8).map((w, i) => {
      const color = typeColors[w.type] || '#6B6B6B';
      // Auto-layout mini preview blocks
      const cols = Math.min(4, widgets.length);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const left = (col / cols) * 100;
      const width = (1 / cols) * 100;
      const top = row * 32 + 8;
      const height = 28;

      return `<div class="db-mini-widget" style="
        left:${left}%; top:${top}px; width:${width - 2}%; height:${height}px;
        background:${color}22; border:1px solid ${color}44; border-radius:3px;
        position:absolute; margin-left:1%;
      "></div>`;
    }).join('');
  }

  _startInlineRename(el, dashboard) {
    const input = document.createElement('input');
    input.className = 'db-manager-rename-input';
    input.value = dashboard.name;
    input.type = 'text';
    input.spellcheck = false;

    el.style.display = 'none';
    el.parentNode.insertBefore(input, el);
    input.focus();
    input.select();

    const finish = async () => {
      const newName = input.value.trim() || dashboard.name;
      dashboard.name = newName;
      el.textContent = newName;
      el.style.display = '';
      input.remove();
      try {
        await DashboardDB.saveDashboard(dashboard);
      } catch (err) {
        console.error('Rename failed:', err);
      }
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = dashboard.name;
        input.blur();
      }
    });
  }

  _showCardMenu(anchor, dashboard) {
    document.querySelectorAll('.db-card-context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'db-card-context-menu';
    menu.innerHTML = `
      <button class="db-context-item" data-ctx="open"><span class="material-symbols-outlined">open_in_new</span>Open</button>
      <button class="db-context-item" data-ctx="rename"><span class="material-symbols-outlined">edit</span>Rename</button>
      <button class="db-context-item" data-ctx="duplicate"><span class="material-symbols-outlined">content_copy</span>Duplicate</button>
      <div class="db-context-divider"></div>
      <button class="db-context-item" data-ctx="export-html"><span class="material-symbols-outlined">html</span>Export HTML</button>
      <button class="db-context-item" data-ctx="export-json"><span class="material-symbols-outlined">download</span>Export JSON</button>
      <div class="db-context-divider"></div>
      <button class="db-context-item db-context-danger" data-ctx="delete"><span class="material-symbols-outlined">delete</span>Delete</button>
    `;

    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left - 160}px`;
    menu.style.zIndex = '10001';
    document.body.appendChild(menu);

    menu.querySelectorAll('[data-ctx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-ctx');
        menu.remove();

        switch (action) {
          case 'open': this.onOpen(dashboard.id); break;
          case 'rename':
            const titleEl = document.querySelector(`.db-manager-card-title[data-id="${dashboard.id}"]`);
            if (titleEl) this._startInlineRename(titleEl, dashboard);
            break;
          case 'duplicate':
            try {
              await DashboardDB.duplicateDashboard(dashboard.id);
              this.render();
            } catch (err) {
              console.error('Duplicate failed:', err);
            }
            break;
          case 'export-html': this._exportHTML(dashboard.id); break;
          case 'export-json': this._exportJSON(dashboard.id); break;
          case 'delete': this._confirmDelete(dashboard); break;
        }
      });
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 10);
  }

  _confirmDelete(dashboard) {
    const overlay = document.createElement('div');
    overlay.className = 'db-confirm-overlay';
    overlay.innerHTML = `
      <div class="db-confirm-modal">
        <div class="db-confirm-header">
          <span class="material-symbols-outlined db-confirm-icon">warning</span>
          <h3>Delete Dashboard</h3>
        </div>
        <p class="db-confirm-body">Are you sure you want to delete "<strong>${dashboard.name}</strong>"? This action cannot be undone.</p>
        <div class="db-confirm-footer">
          <button class="db-confirm-btn db-confirm-cancel">Cancel</button>
          <button class="db-confirm-btn db-confirm-danger">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.db-confirm-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('.db-confirm-danger')?.addEventListener('click', async () => {
      try {
        await DashboardDB.deleteDashboard(dashboard.id);
        overlay.remove();
        this.onDelete(dashboard.id);
        this.render();
      } catch (err) {
        console.error('Delete failed:', err);
        overlay.remove();
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  async _exportHTML(dashboardId) {
    try {
      const db = await DashboardDB.getDashboard(dashboardId);
      if (db && window.dashboardApp) {
        window.dashboardApp.exportDashboardHTML(db);
      }
    } catch (err) {
      console.error('Export HTML failed:', err);
    }
  }

  async _exportJSON(dashboardId) {
    try {
      const json = await DashboardDB.exportDashboard(dashboardId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${dashboardId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export JSON failed:', err);
    }
  }

  async _importDashboard() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        await DashboardDB.importDashboard(text);
        this.render();
      } catch (err) {
        console.error('Import failed:', err);
      }
    });
    input.click();
  }
}

window.DashboardManager = DashboardManager;
