/**
 * DashboardApp — Main orchestrator for Plotox Auto-Generated Dashboard.
 * Upload → Analyze → Auto-Generate → View → Edit flow.
 */
class DashboardApp {
  constructor() {
    this.manager = null;
    this.widgets = null;
    this.activeDashboard = null;
    this.dataset = null;
    this.currentView = 'manager'; // 'manager' | 'editor'
    this._initialized = false;
    this._autoSaveEnabled = true;
  }

  _showError(message, title = 'Error') {
    if (typeof window.showUserError === 'function') {
      window.showUserError(message, title);
      return;
    }
    console.error('plotox:', message);
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification error';

    let displayTitle = title;
    let displayMessage = message;
    if (message.includes('exceeds 1 MB') && title === 'Error') {
      displayTitle = 'File is too large';
      displayMessage = 'The file exceeds 1 MB. Please import a smaller dataset.';
    }

    toast.innerHTML = `
      <div class="toast-icon-container">
        <span class="material-symbols-outlined">error</span>
      </div>
      <div class="toast-body">
        <div class="toast-title">${displayTitle}</div>
        <div class="toast-description">${displayMessage}</div>
      </div>
      <button class="toast-close-btn">
        <span class="material-symbols-outlined" style="font-size: 16px !important;">close</span>
      </button>
    `;
    document.body.appendChild(toast);

    const timeoutId = setTimeout(() => {
      toast.style.animation = 'slideUpFade 0.3s ease-in reverse';
      setTimeout(() => toast.remove(), 300);
    }, 5000);

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
      clearTimeout(timeoutId);
      toast.style.animation = 'slideUpFade 0.3s ease-in reverse';
      setTimeout(() => toast.remove(), 300);
    });
  }

  // ═══════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════

  async init() {
    if (this._initialized) return;

    this.widgets = new DashboardWidgets();

    this.manager = new DashboardManager('db-manager-view', {
      onOpen: (id) => this.openDashboard(id),
      onDelete: (id) => {
        if (this.activeDashboard && this.activeDashboard.id === id) {
          this.showManagerView();
        }
      },
      onCreate: () => {}
    });

    // Re-render charts on theme change
    window.addEventListener('themeChanged', () => {
      if (this.activeDashboard && this.dataset) {
        this._rerenderAllWidgets();
      }
    });

    // Re-render charts/KPIs/tables on number formatting change
    window.addEventListener('numberSystemChanged', () => {
      if (this.activeDashboard && this.dataset) {
        this._rerenderAllWidgets();
      }
    });

    // Widget config updates (from text edits, etc.)
    window.addEventListener('dashboardWidgetUpdated', (e) => {
      if (this.activeDashboard) {
        const { id, config } = e.detail;
        const widget = this.activeDashboard.widgets.find(w => w.id === id);
        if (widget) {
          widget.config = config;
          this._triggerAutoSave();
        }
      }
    });

    this._initialized = true;
  }

  // ═══════════════════════════════════════════════════
  // VIEW SWITCHING
  // ═══════════════════════════════════════════════════

  showManagerView() {
    this.currentView = 'manager';
    const managerView = document.getElementById('db-manager-view');
    const editorView = document.getElementById('db-editor-view');

    if (managerView) managerView.style.display = '';
    if (editorView) {
      editorView.style.display = 'none';
      editorView.innerHTML = '';
    }

    if (this.widgets) this.widgets.destroyAll();
    this.activeDashboard = null;
    this.dataset = null;

    this.manager.render();
  }

  async openDashboard(id) {
    try {
      const dashboard = await DashboardDB.getDashboard(id);
      if (!dashboard) {
        console.error('Dashboard not found:', id);
        return;
      }

      this.activeDashboard = dashboard;
      this.dataset = dashboard.dataset;
      this.currentView = 'editor';

      const managerView = document.getElementById('db-manager-view');
      const editorView = document.getElementById('db-editor-view');

      if (managerView) managerView.style.display = 'none';
      if (editorView) editorView.style.display = 'flex';

      this._renderDashboard();
    } catch (err) {
      console.error('Failed to open dashboard:', err);
    }
  }

  // ═══════════════════════════════════════════════════
  // UPLOAD POPUP
  // ═══════════════════════════════════════════════════

  showUploadPopup() {
    // Remove existing
    document.querySelectorAll('.db-upload-overlay').forEach(o => o.remove());

    const overlay = document.createElement('div');
    overlay.className = 'db-upload-overlay';
    overlay.innerHTML = `
      <div class="db-upload-modal">
        <div class="db-upload-header">
          <div class="db-upload-header-left">
            <span class="material-symbols-outlined">cloud_upload</span>
            <h3>Create Dashboard</h3>
          </div>
          <button class="db-upload-close" id="db-upload-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="db-upload-body">
          <div class="db-upload-dropzone" id="db-upload-dropzone">
            <div class="db-upload-dropzone-icon">
              <span class="material-symbols-outlined">upload_file</span>
            </div>
            <div class="db-upload-dropzone-title">Drop your file here or click to browse</div>
            <div class="db-upload-dropzone-desc">Upload a data file and we'll generate a complete analytics dashboard for you</div>
            <div class="db-upload-dropzone-formats">
              <span class="db-upload-format-badge">CSV</span>
              <span class="db-upload-format-badge">Excel</span>
              <span class="db-upload-format-badge">TSV</span>
              <span class="db-upload-format-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">Max 1 MB</span>
            </div>
            <input type="file" id="db-upload-file-input" accept=".csv,.tsv,.xlsx,.xls" style="display:none" />
          </div>
        </div>
        <div class="db-upload-footer">
          <span class="material-symbols-outlined">lock</span>
          <span>All processing happens locally in your browser. No data is uploaded to any server.</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Events
    const dropzone = document.getElementById('db-upload-dropzone');
    const fileInput = document.getElementById('db-upload-file-input');

    // Close
    document.getElementById('db-upload-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Click to browse
    dropzone?.addEventListener('click', () => fileInput?.click());

    // File selected
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const sizeGuard = FileSizeGuard.validateFile(file);
        if (!sizeGuard.valid) {
          this._showError(sizeGuard.errorMessage, sizeGuard.title);
          e.target.value = '';
          overlay.remove();
          return;
        }
        overlay.remove();
        this._handleFileUpload(file);
      }
    });

    // Drag and drop
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('db-dropzone-active');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('db-dropzone-active');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('db-dropzone-active');
      const file = e.dataTransfer.files[0];
      if (file) {
        const sizeGuard = FileSizeGuard.validateFile(file);
        if (!sizeGuard.valid) {
          this._showError(sizeGuard.errorMessage, sizeGuard.title);
          overlay.remove();
          return;
        }
        overlay.remove();
        this._handleFileUpload(file);
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // LOADING SCREEN
  // ═══════════════════════════════════════════════════

  _showLoadingScreen() {
    document.querySelectorAll('.db-loading-overlay').forEach(o => o.remove());

    const overlay = document.createElement('div');
    overlay.className = 'db-loading-overlay';
    overlay.id = 'db-loading-screen';
    overlay.innerHTML = `
      <div class="db-loading-brand">
        <div class="db-loading-brand-text">
          <span class="db-loading-letter">p</span>
          <span class="db-loading-letter">l</span>
          <span class="db-loading-letter">o</span>
          <span class="db-loading-letter">t</span>
          <span class="db-loading-letter db-loading-letter-rise-o">o</span>
          <span class="db-loading-letter db-loading-letter-rise-x">x</span>
        </div>
        <div class="db-loading-subtitle">Generating your dashboard</div>
      </div>
      <div class="db-loading-progress-section">
        <div class="db-loading-progress-track">
          <div class="db-loading-progress-fill" id="db-loading-progress"></div>
        </div>
        <div class="db-loading-step-text" id="db-loading-step">Preparing...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  _updateLoadingProgress(percent, text) {
    const progressEl = document.getElementById('db-loading-progress');
    const stepEl = document.getElementById('db-loading-step');
    if (progressEl) progressEl.style.width = percent + '%';
    if (stepEl) stepEl.textContent = text;
  }

  _hideLoadingScreen() {
    const overlay = document.getElementById('db-loading-screen');
    if (overlay) {
      overlay.classList.add('db-loading-done');
      setTimeout(() => overlay.remove(), 700);
    }
  }

  // ═══════════════════════════════════════════════════
  // FILE PROCESSING
  // ═══════════════════════════════════════════════════

  async _handleFileUpload(file) {
    if (file) {
      const sizeGuard = FileSizeGuard.validateFile(file);
      if (!sizeGuard.valid) {
        this._showError(sizeGuard.errorMessage, sizeGuard.title);
        return;
      }
    }

    const loadingScreen = this._showLoadingScreen();

    try {
      // Step 1: Read file
      this._updateLoadingProgress(10, 'Reading your file...');
      await this._sleep(400);

      const rawText = await file.text();
      const fileName = file.name.replace(/\.[^.]+$/, '');

      // Step 2: Parse data
      this._updateLoadingProgress(25, 'Parsing your data...');
      await this._sleep(300);

      const dataset = this._parseCSV(rawText, file.name);
      if (!dataset || !dataset.headers.length || !dataset.rows.length) {
        this._hideLoadingScreen();
        this._showError('Could not parse the file. Please check the format.');
        return;
      }

      // Step 3: Analyze columns
      this._updateLoadingProgress(45, 'Detecting column types...');
      await this._sleep(400);

      const analysis = this._analyzeDataset(dataset);

      // Step 4: Generate widgets
      this._updateLoadingProgress(65, 'Generating KPI metrics...');
      await this._sleep(350);

      this._updateLoadingProgress(78, 'Building charts...');
      await this._sleep(350);

      const widgets = this._autoGenerateWidgets(dataset, analysis);

      // Step 5: Create dashboard
      this._updateLoadingProgress(90, 'Assembling your dashboard...');
      await this._sleep(300);

      const dashboard = await DashboardDB.createDashboard(fileName || 'Untitled Dashboard');
      dashboard.dataset = dataset;
      dashboard.analysis = analysis;
      dashboard.widgets = widgets;
      await DashboardDB.saveDashboard(dashboard);

      // Step 6: Open it
      this._updateLoadingProgress(100, 'Done!');
      await this._sleep(500);

      this._hideLoadingScreen();
      await this.openDashboard(dashboard.id);

    } catch (err) {
      console.error('File processing failed:', err);
      this._hideLoadingScreen();
      this._showError('Failed to process file: ' + err.message);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════
  // CSV / TSV PARSER
  // ═══════════════════════════════════════════════════

  _parseCSV(rawText, fileName) {
    const isTSV = fileName?.endsWith('.tsv');
    const delimiter = isTSV ? '\t' : this._detectDelimiter(rawText);

    const lines = rawText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;

    const headers = this._parseCSVLine(lines[0], delimiter);
    const rows = [];
    const types = {};

    for (let i = 1; i < lines.length; i++) {
      const row = this._parseCSVLine(lines[i], delimiter);
      if (row.length === headers.length) {
        rows.push(row);
      }
    }

    // Detect column types from data
    headers.forEach((header, idx) => {
      const sampleValues = rows.slice(0, Math.min(50, rows.length)).map(r => r[idx]);
      types[header] = this._detectColumnType(sampleValues);
    });

    // Convert numeric strings to numbers
    rows.forEach(row => {
      headers.forEach((header, idx) => {
        if (types[header] === 'numeric') {
          const cleaned = String(row[idx]).replace(/[$,%\s]/g, '');
          const num = Number(cleaned);
          if (isFinite(num)) row[idx] = num;
        }
      });
    });

    return { headers, rows, types };
  }

  _detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    if (tabs > commas && tabs > semicolons) return '\t';
    if (semicolons > commas) return ';';
    return ',';
  }

  _parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // ═══════════════════════════════════════════════════
  // SMART DATA ANALYSIS
  // ═══════════════════════════════════════════════════

  _detectColumnType(values) {
    const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonEmpty.length === 0) return 'string';

    let numericCount = 0;
    let dateCount = 0;

    nonEmpty.forEach(v => {
      const str = String(v).trim();
      const cleaned = str.replace(/[$,%\s]/g, '');
      if (cleaned !== '' && isFinite(Number(cleaned))) {
        numericCount++;
      }
      // Date detection: look for date-like patterns
      if (str.match(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/) || // 2024-01-15
          str.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/) || // 01/15/2024
          str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i) || // Jan 2024
          (!isNaN(Date.parse(str)) && str.match(/[-/]/))) {
        dateCount++;
      }
    });

    const threshold = nonEmpty.length * 0.7;
    if (numericCount >= threshold) return 'numeric';
    if (dateCount >= threshold) return 'date';
    return 'string';
  }

  _analyzeDataset(dataset) {
    const { headers, rows, types } = dataset;

    const numericCols = headers.filter(h => types[h] === 'numeric');
    const categoricalCols = headers.filter(h => types[h] === 'string');
    const dateCols = headers.filter(h => types[h] === 'date');

    // For each numeric column, compute stats
    const stats = {};
    numericCols.forEach(col => {
      const idx = headers.indexOf(col);
      const values = rows.map(r => {
        const n = Number(String(r[idx]).replace(/[$,%]/g, ''));
        return isFinite(n) ? n : null;
      }).filter(v => v !== null);

      if (values.length > 0) {
        stats[col] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    });

    // Find best categorical column for x-axis (reasonable cardinality)
    let bestCategoryCol = null;
    let bestDateCol = dateCols[0] || null;

    categoricalCols.forEach(col => {
      const idx = headers.indexOf(col);
      const uniqueCount = new Set(rows.map(r => r[idx])).size;
      if (uniqueCount >= 2 && uniqueCount <= 30) {
        if (!bestCategoryCol) bestCategoryCol = col;
      }
    });

    // Fallback: use first column as x-axis if no good category found
    const xAxisCol = bestDateCol || bestCategoryCol || headers[0];

    return {
      numericCols,
      categoricalCols,
      dateCols,
      stats,
      xAxisCol,
      bestCategoryCol,
      bestDateCol,
      totalRows: rows.length,
      totalCols: headers.length
    };
  }

  // ═══════════════════════════════════════════════════
  // AUTO-GENERATE WIDGETS
  // ═══════════════════════════════════════════════════

  _autoGenerateWidgets(dataset, analysis) {
    const widgets = [];
    const { numericCols, xAxisCol, bestCategoryCol, stats } = analysis;

    // ─── KPI Cards (up to 4) ──────────────────────
    const kpiTypes = ['total', 'average', 'max', 'growth'];
    const kpiCols = numericCols.slice(0, 4);

    kpiCols.forEach((col, i) => {
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'kpi',
        gridClass: 'db-widget-kpi',
        config: {
          title: this._humanizeColumnName(col),
          kpiType: kpiTypes[i % kpiTypes.length],
          column: col,
          prefix: '',
          suffix: ''
        }
      });
    });

    // If fewer than 4 numeric cols, add count KPI
    if (kpiCols.length < 4 && numericCols.length > 0) {
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'kpi',
        gridClass: 'db-widget-kpi',
        config: {
          title: 'Total Records',
          kpiType: 'count',
          column: numericCols[0],
          prefix: '',
          suffix: ''
        }
      });
    }

    // ─── Line/Area Chart ──────────────────────────
    if (numericCols.length >= 1) {
      const yAxes = numericCols.slice(0, 2);
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'chart',
        gridClass: 'db-widget-chart-half',
        config: {
          title: `${this._humanizeColumnName(yAxes[0])} Trend`,
          chartType: analysis.bestDateCol ? 'area' : 'line',
          xAxis: xAxisCol,
          yAxes: yAxes,
          colorPalette: 'classic',
          lineSmooth: true
        }
      });
    }

    // ─── Bar Chart ────────────────────────────────
    if (numericCols.length >= 1) {
      const barY = numericCols.length > 2 ? numericCols.slice(2, 4) : numericCols.slice(0, 2);
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'chart',
        gridClass: 'db-widget-chart-half',
        config: {
          title: `${this._humanizeColumnName(barY[0])} by ${this._humanizeColumnName(xAxisCol)}`,
          chartType: 'bar',
          xAxis: xAxisCol,
          yAxes: barY,
          colorPalette: 'classic'
        }
      });
    }

    // ─── Pie/Donut Chart ──────────────────────────
    if (bestCategoryCol && numericCols.length >= 1) {
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'chart',
        gridClass: 'db-widget-chart-half',
        config: {
          title: `${this._humanizeColumnName(numericCols[0])} Distribution`,
          chartType: 'donut',
          xAxis: bestCategoryCol,
          yAxes: [numericCols[0]],
          colorPalette: 'classic'
        }
      });
    } else if (numericCols.length >= 1) {
      // No good category column, use the x-axis column
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'chart',
        gridClass: 'db-widget-chart-half',
        config: {
          title: `${this._humanizeColumnName(numericCols[0])} Distribution`,
          chartType: 'donut',
          xAxis: xAxisCol,
          yAxes: [numericCols[0]],
          colorPalette: 'classic'
        }
      });
    }

    // ─── 4th Chart: Histogram ──────────────────
    if (numericCols.length >= 1) {
      const histY = numericCols.length >= 2 ? numericCols[1] : numericCols[0];
      widgets.push({
        id: DashboardWidgets.generateId(),
        type: 'chart',
        gridClass: 'db-widget-chart-half',
        config: {
          title: `${this._humanizeColumnName(histY)} Distribution (Histogram)`,
          chartType: 'histogram',
          xAxis: histY,
          yAxes: [histY],
          colorPalette: 'classic'
        }
      });
    }

    // ─── Data Table ───────────────────────────────
    widgets.push({
      id: DashboardWidgets.generateId(),
      type: 'table',
      gridClass: 'db-widget-full',
      config: {
        title: 'Data Summary',
        columns: dataset.headers.slice(0, 8) // Show first 8 columns
      }
    });

    return widgets;
  }

  _humanizeColumnName(name) {
    if (!name) return 'Column';
    return name
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ═══════════════════════════════════════════════════
  // RENDER DASHBOARD (Fixed CSS Grid Layout)
  // ═══════════════════════════════════════════════════

  _renderDashboard() {
    const editorView = document.getElementById('db-editor-view');
    if (!editorView || !this.activeDashboard) return;

    if (this.widgets) this.widgets.destroyAll();
    editorView.innerHTML = '';

    // ─── Toolbar ──────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'db-editor-toolbar';
    toolbar.innerHTML = `
      <div class="db-editor-toolbar-left">
        <button class="db-editor-back-btn" id="db-editor-back" title="Back to dashboards">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="db-editor-title-wrapper">
          <span class="db-editor-title" id="db-editor-title">${this.activeDashboard.name}</span>
        </div>
      </div>
      <div class="db-editor-toolbar-right">
        <div class="db-export-dropdown">
          <button class="db-editor-tool-btn" id="db-export-dropdown-btn" title="Export options">
            <span class="material-symbols-outlined">download</span>
            <span>Export</span>
            <span class="material-symbols-outlined" style="font-size: 16px; margin-left: 2px;">expand_more</span>
          </button>
          <div class="db-export-menu" id="db-export-menu" style="display: none;">
            <button class="db-export-menu-item" id="db-export-html-btn">
              <span class="material-symbols-outlined">html</span>
              <div class="db-export-menu-info">
                <span class="db-export-menu-label">Interactive HTML</span>
                <span class="db-export-menu-desc">Self-contained dashboard page</span>
              </div>
            </button>

            <button class="db-export-menu-item" id="db-export-json-btn">
              <span class="material-symbols-outlined">data_object</span>
              <div class="db-export-menu-info">
                <span class="db-export-menu-label">JSON Data</span>
                <span class="db-export-menu-desc">Export dashboard config</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;
    editorView.appendChild(toolbar);

    // ─── Dashboard Grid Container ─────────────────
    const dashView = document.createElement('div');
    dashView.className = 'db-dashboard-view';
    dashView.id = 'db-dashboard-view';

    const grid = document.createElement('div');
    grid.className = 'db-dashboard-grid';
    grid.id = 'db-dashboard-grid';

    // Render each widget card
    (this.activeDashboard.widgets || []).forEach(widget => {
      const card = this._createWidgetCard(widget);
      grid.appendChild(card);
    });

    dashView.appendChild(grid);
    editorView.appendChild(dashView);

    // ─── Event Listeners ──────────────────────────
    document.getElementById('db-editor-back')?.addEventListener('click', () => this.showManagerView());

    // Title rename
    const titleEl = document.getElementById('db-editor-title');
    if (titleEl) {
      titleEl.addEventListener('dblclick', () => this._startTitleRename(titleEl));
    }

    // Export Dropdown Toggle
    const exportDropdownBtn = toolbar.querySelector('#db-export-dropdown-btn');
    const exportMenu = toolbar.querySelector('#db-export-menu');

    exportDropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = exportMenu.style.display === 'block';
      exportMenu.style.display = visible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      if (exportMenu) exportMenu.style.display = 'none';
    });

    toolbar.querySelector('#db-export-html-btn')?.addEventListener('click', () => {
      this._exportHTML();
    });



    toolbar.querySelector('#db-export-json-btn')?.addEventListener('click', () => {
      this._exportJSON();
    });

    // ─── Render Widget Contents ───────────────────
    setTimeout(() => {
      (this.activeDashboard.widgets || []).forEach(widget => {
        this.widgets.renderWidget(widget, this.dataset);
      });
      // Resize charts after initial render
      setTimeout(() => this.widgets.resizeAll(), 200);
    }, 50);
  }

  _createWidgetCard(widget) {
    const card = document.createElement('div');
    card.className = `db-widget db-widget-${widget.type} ${widget.gridClass || ''}`;
    card.setAttribute('data-widget-id', widget.id);

    const typeIcons = {
      chart: 'bar_chart',
      kpi: 'speed',
      table: 'table_chart',
      text: 'text_fields'
    };

    card.innerHTML = `
      <div class="db-widget-header">
        <div class="db-widget-header-left">
          <span class="material-symbols-outlined db-widget-type-icon">${typeIcons[widget.type] || 'widgets'}</span>
          <span class="db-widget-title">${widget.config?.title || 'Widget'}</span>
        </div>
        <button class="db-widget-edit-btn" data-edit-widget="${widget.id}" title="Edit widget">
          <span class="material-symbols-outlined">edit</span>
        </button>
      </div>
      <div class="db-widget-body" id="db-widget-body-${widget.id}"></div>
    `;

    // Edit button click
    card.querySelector(`[data-edit-widget="${widget.id}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._openEditPanel(widget);
    });

    return card;
  }

  // ═══════════════════════════════════════════════════
  // EDIT PANEL — Slide-in from Right
  // ═══════════════════════════════════════════════════

  _openEditPanel(widget) {
    // Remove existing panel
    this._closeEditPanel();

    const overlay = document.createElement('div');
    overlay.className = 'db-edit-panel-overlay';
    overlay.id = 'db-edit-panel-overlay';
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.className = 'db-edit-panel';
    panel.id = 'db-edit-panel';

    const headerIcon = widget.type === 'chart' ? 'bar_chart' : (widget.type === 'kpi' ? 'speed' : 'table_chart');

    panel.innerHTML = `
      <div class="db-edit-panel-header">
        <div class="db-edit-panel-header-left">
          <span class="material-symbols-outlined">${headerIcon}</span>
          <h3>Edit ${widget.type === 'kpi' ? 'KPI' : (widget.type.charAt(0).toUpperCase() + widget.type.slice(1))}</h3>
        </div>
        <button class="db-edit-panel-close" id="db-edit-panel-close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="db-edit-panel-body" id="db-edit-panel-body"></div>
    `;
    overlay.appendChild(panel);

    // Stop clicks inside the modal panel from bubbling and triggering backdrop overlay click handler
    panel.addEventListener('click', (e) => e.stopPropagation());

    // Render fields based on widget type
    const body = document.getElementById('db-edit-panel-body');
    if (body) {
      switch (widget.type) {
        case 'chart':
          this._renderChartEditFields(body, widget);
          break;
        case 'kpi':
          this._renderKPIEditFields(body, widget);
          break;
        case 'table':
          this._renderTableEditFields(body, widget);
          break;
      }
    }

    // Close events
    document.getElementById('db-edit-panel-close')?.addEventListener('click', () => this._closeEditPanel());
    overlay.addEventListener('click', () => this._closeEditPanel());

    // ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this._closeEditPanel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  _closeEditPanel() {
    const panel = document.getElementById('db-edit-panel');
    const overlay = document.getElementById('db-edit-panel-overlay');

    if (panel) {
      panel.classList.add('db-panel-closing');
    }
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.25s ease';
      setTimeout(() => overlay.remove(), 250);
    } else if (panel) {
      panel.remove();
    }
  }

  // ─── Chart Edit Fields ─────────────────────────

  _renderChartEditFields(container, widget) {
    const config = widget.config || {};
    const headers = this.dataset?.headers || [];

    // Chart Type
    const chartTypes = [
      { value: 'line', label: 'Line' },
      { value: 'bar', label: 'Bar' },
      { value: 'area', label: 'Area' },
      { value: 'scatter', label: 'Scatter' },
      { value: 'pie', label: 'Pie' },
      { value: 'donut', label: 'Donut' },
      { value: 'histogram', label: 'Histogram' }
    ];

    // Color Palettes
    const palettes = [
      { value: 'classic', label: 'Classic' },
      { value: 'vibrant', label: 'Vibrant' },
      { value: 'ocean', label: 'Ocean' },
      { value: 'sunset', label: 'Sunset' },
      { value: 'mono', label: 'Mono' }
    ];

    container.innerHTML = `
      <div class="db-edit-field">
        <label>Title</label>
        <input type="text" id="db-edit-title" value="${config.title || ''}" />
      </div>

      <div class="db-edit-row">
        <div class="db-edit-field">
          <label>Chart Type</label>
          <select id="db-edit-chart-type">
            ${chartTypes.map(t => `<option value="${t.value}" ${config.chartType === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="db-edit-field">
          <label>Color Palette</label>
          <select id="db-edit-palette">
            ${palettes.map(p => `<option value="${p.value}" ${config.colorPalette === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="db-edit-field">
        <label>X-Axis / Category Column</label>
        <select id="db-edit-xaxis">
          ${headers.map(h => `<option value="${h}" ${config.xAxis === h ? 'selected' : ''}>${h}</option>`).join('')}
        </select>
      </div>

      <div class="db-edit-field">
        <label>Y-Axis / Value Columns</label>
        <div class="db-edit-checkbox-group" id="db-edit-yaxes">
          ${headers.map(h => `
            <label class="db-edit-checkbox">
              <input type="checkbox" value="${h}" ${(config.yAxes || []).includes(h) ? 'checked' : ''} />
              ${h}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="db-edit-divider"></div>

      <div class="db-edit-field">
        <label>Smooth Lines</label>
        <select id="db-edit-smooth">
          <option value="true" ${config.lineSmooth ? 'selected' : ''}>Yes</option>
          <option value="false" ${!config.lineSmooth ? 'selected' : ''}>No</option>
        </select>
      </div>
    `;

    // Live update handlers
    const applyChanges = () => {
      widget.config.title = document.getElementById('db-edit-title')?.value || widget.config.title;
      widget.config.chartType = document.getElementById('db-edit-chart-type')?.value || 'line';
      widget.config.colorPalette = document.getElementById('db-edit-palette')?.value || 'classic';
      widget.config.xAxis = document.getElementById('db-edit-xaxis')?.value || '';
      widget.config.lineSmooth = document.getElementById('db-edit-smooth')?.value === 'true';

      const checkboxes = document.querySelectorAll('#db-edit-yaxes input[type="checkbox"]');
      widget.config.yAxes = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

      // Update title in DOM
      this.widgets.updateTitle(widget.id, widget.config.title);

      // Re-render the chart
      this.widgets.renderWidget(widget, this.dataset);
      this._triggerAutoSave();
    };

    // Attach change listeners to all inputs
    container.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', applyChanges);
      if (el.type === 'text') el.addEventListener('input', applyChanges);
    });
  }

  // ─── KPI Edit Fields ───────────────────────────

  _renderKPIEditFields(container, widget) {
    const config = widget.config || {};
    const headers = this.dataset?.headers || [];
    const numericHeaders = headers.filter(h => this.dataset?.types?.[h] === 'numeric');

    const kpiTypes = [
      { value: 'total', label: 'Total (Sum)' },
      { value: 'average', label: 'Average' },
      { value: 'count', label: 'Count' },
      { value: 'max', label: 'Maximum' },
      { value: 'min', label: 'Minimum' },
      { value: 'growth', label: 'Growth %' },
      { value: 'latest', label: 'Latest Value' }
    ];

    container.innerHTML = `
      <div class="db-edit-field">
        <label>Title</label>
        <input type="text" id="db-edit-title" value="${config.title || ''}" />
      </div>

      <div class="db-edit-row">
        <div class="db-edit-field">
          <label>Aggregation</label>
          <select id="db-edit-kpi-type">
            ${kpiTypes.map(t => `<option value="${t.value}" ${config.kpiType === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="db-edit-field">
          <label>Data Column</label>
          <select id="db-edit-kpi-column">
            ${(numericHeaders.length ? numericHeaders : headers).map(h => `<option value="${h}" ${config.column === h ? 'selected' : ''}>${h}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="db-edit-row">
        <div class="db-edit-field">
          <label>Prefix</label>
          <input type="text" id="db-edit-prefix" value="${config.prefix || ''}" placeholder="e.g. $" />
        </div>
        <div class="db-edit-field">
          <label>Suffix</label>
          <input type="text" id="db-edit-suffix" value="${config.suffix || ''}" placeholder="e.g. %" />
        </div>
      </div>
    `;

    const applyChanges = () => {
      widget.config.title = document.getElementById('db-edit-title')?.value || widget.config.title;
      widget.config.kpiType = document.getElementById('db-edit-kpi-type')?.value || 'total';
      widget.config.column = document.getElementById('db-edit-kpi-column')?.value || '';
      widget.config.prefix = document.getElementById('db-edit-prefix')?.value || '';
      widget.config.suffix = document.getElementById('db-edit-suffix')?.value || '';

      this.widgets.updateTitle(widget.id, widget.config.title);
      this.widgets.renderWidget(widget, this.dataset);
      this._triggerAutoSave();
    };

    container.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', applyChanges);
      if (el.type === 'text') el.addEventListener('input', applyChanges);
    });
  }

  // ─── Table Edit Fields ─────────────────────────

  _renderTableEditFields(container, widget) {
    const config = widget.config || {};
    const headers = this.dataset?.headers || [];

    container.innerHTML = `
      <div class="db-edit-field">
        <label>Title</label>
        <input type="text" id="db-edit-title" value="${config.title || ''}" />
      </div>

      <div class="db-edit-field">
        <label>Visible Columns</label>
        <div class="db-edit-checkbox-group" id="db-edit-table-cols">
          ${headers.map(h => `
            <label class="db-edit-checkbox">
              <input type="checkbox" value="${h}" ${(config.columns || []).includes(h) ? 'checked' : ''} />
              ${h}
            </label>
          `).join('')}
        </div>
      </div>
    `;

    const applyChanges = () => {
      widget.config.title = document.getElementById('db-edit-title')?.value || widget.config.title;

      const checkboxes = document.querySelectorAll('#db-edit-table-cols input[type="checkbox"]');
      widget.config.columns = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

      this.widgets.updateTitle(widget.id, widget.config.title);
      this.widgets.renderWidget(widget, this.dataset);
      this._triggerAutoSave();
    };

    container.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', applyChanges);
      if (el.type === 'text') el.addEventListener('input', applyChanges);
    });
  }

  // ═══════════════════════════════════════════════════
  // TOOLBAR ACTIONS
  // ═══════════════════════════════════════════════════

  _startTitleRename(el) {
    const input = document.createElement('input');
    input.className = 'db-editor-title-input';
    input.value = this.activeDashboard.name;
    input.type = 'text';
    input.spellcheck = false;

    el.style.display = 'none';
    el.parentNode.insertBefore(input, el);
    input.focus();
    input.select();

    const finish = async () => {
      const newName = input.value.trim() || this.activeDashboard.name;
      this.activeDashboard.name = newName;
      el.textContent = newName;
      el.style.display = '';
      input.remove();
      this._triggerAutoSave();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = this.activeDashboard.name;
        input.blur();
      }
    });
  }

  async _exportJSON() {
    if (!this.activeDashboard) return;
    try {
      const json = await DashboardDB.exportDashboard(this.activeDashboard.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.activeDashboard.name || 'dashboard'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  _exportHTML() {
    if (!this.activeDashboard) return;
    try {
      const db = this.activeDashboard;
      const dbJSON = JSON.stringify({
        name: db.name,
        widgets: db.widgets,
        dataset: db.dataset
      });

      const htmlContent = `<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${db.name} — Plotox Interactive Dashboard</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
  
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"><\/script>

  <style>
    :root {
      --color-bg: #F7F7F5;
      --color-card: #FCFCFB;
      --color-border: #E7E7E4;
      --color-primary: #000000;
      --color-secondary: #6B6B6B;
      --color-surface-low: #F7F3F2;
      --color-outline: #747878;
      --color-indigo: #121212;
      --color-kpi-indigo: #4f46e5;
      
      --font-main: 'Inter', sans-serif;
      --font-heading: 'Space Grotesk', sans-serif;
    }

    html.dark {
      --color-bg: #121212;
      --color-card: #1C1C19;
      --color-border: rgba(255, 255, 255, 0.12);
      --color-primary: #FFFFFF;
      --color-secondary: #A0A0A0;
      --color-surface-low: #181816;
      --color-outline: #888888;
      --color-indigo: #FFFFFF;
      --color-kpi-indigo: #818cf8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg);
      color: var(--color-primary);
      font-family: var(--font-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    /* Navbar */
    .app-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
      background: var(--color-card);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: 100;
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      font-family: var(--font-heading);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--color-primary);
    }

    .logo-rising-o {
      display: inline-block;
      transform: translateY(-0.12em);
    }

    .logo-rising-x {
      display: inline-block;
      transform: translateY(-0.25em);
    }

    .separator {
      color: var(--color-border);
      font-weight: 300;
      font-size: 18px;
    }

    .dashboard-name {
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .theme-btn {
      background: transparent;
      border: none;
      color: var(--color-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      transition: background-color 0.2s ease;
    }

    .theme-btn:hover {
      background-color: var(--color-surface-low);
    }

    /* Grid Layout */
    .db-dashboard-view {
      flex: 1;
      padding: 28px;
      overflow-y: auto;
    }

    .db-dashboard-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .db-widget-kpi { grid-column: span 3; }
    .db-widget-chart-half { grid-column: span 6; }
    .db-widget-chart-third { grid-column: span 4; }
    .db-widget-table-large { grid-column: span 8; }
    .db-widget-full { grid-column: span 12; }

    /* Cards */
    .db-widget {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .db-widget-header {
      display: flex;
      align-items: center;
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border);
      gap: 8px;
    }

    .db-widget-type-icon {
      font-size: 18px;
      color: var(--color-outline);
    }

    .db-widget-title {
      font-family: var(--font-heading);
      font-size: 13px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .db-widget-body {
      flex: 1;
      position: relative;
      min-height: 0;
      overflow: hidden;
    }

    .db-widget-chart-half .db-widget-body,
    .db-widget-chart-third .db-widget-body {
      min-height: 280px;
    }

    .db-widget-table-large .db-widget-body,
    .db-widget-table .db-widget-body {
      height: 350px;
      max-height: 350px;
      min-height: 250px;
      overflow: hidden;
    }

    /* KPI Styles */
    .db-kpi-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
      height: 100%;
    }

    .db-kpi-icon-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .db-kpi-icon-wrapper .material-symbols-outlined {
      font-size: 20px;
      color: white;
    }

    .db-kpi-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .db-kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-outline);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .db-kpi-value {
      font-family: var(--font-heading);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: -0.02em;
    }

    .db-kpi-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .db-kpi-trend-up { color: #10b981; }
    .db-kpi-trend-down { color: #ef4444; }
    .db-kpi-trend-neutral { color: var(--color-outline); }

    .db-kpi-indigo .db-kpi-icon-wrapper { background: var(--color-kpi-indigo); }
    .db-kpi-emerald .db-kpi-icon-wrapper { background: #10b981; }
    .db-kpi-blue .db-kpi-icon-wrapper { background: #3b82f6; }
    .db-kpi-purple .db-kpi-icon-wrapper { background: #8b5cf6; }
    .db-kpi-orange .db-kpi-icon-wrapper { background: #f59e0b; }
    .db-kpi-pink .db-kpi-icon-wrapper { background: #ec4899; }

    /* Table Styles */
    .db-table-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .db-table-scroll-body {
      flex: 1;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      position: sticky;
      top: 0;
      background: var(--color-surface-low);
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--color-outline);
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid var(--color-border);
    }

    td {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--color-primary);
      border-bottom: 1px solid var(--color-border);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    tr.alt td {
      background: var(--color-surface-low);
    }

    .db-table-index-cell {
      width: 50px;
      min-width: 50px;
      max-width: 50px;
      text-align: center;
      border-right: 1px solid var(--color-border);
      color: var(--color-outline);
      font-weight: 600;
    }

    .db-table-footer {
      padding: 8px 12px;
      border-top: 1px solid var(--color-border);
      font-size: 11px;
      color: var(--color-outline);
      background: var(--color-surface-low);
    }

    /* Text Widget */
    .db-text-widget {
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    /* Responsive */
    @media (max-width: 1199px) {
      .db-dashboard-grid {
        grid-template-columns: repeat(6, 1fr);
        gap: 16px;
      }
      .db-widget-kpi { grid-column: span 3; }
      .db-widget-chart-half { grid-column: span 6; }
      .db-widget-chart-third { grid-column: span 6; }
      .db-widget-table-large { grid-column: span 6; }
      .db-widget-full { grid-column: span 6; }
    }

    @media (max-width: 767px) {
      .db-dashboard-view { padding: 14px; }
      .db-dashboard-grid { grid-template-columns: 1fr; gap: 12px; }
      .db-widget-kpi, .db-widget-chart-half, .db-widget-chart-third, .db-widget-table-large, .db-widget-full {
        grid-column: span 1;
      }
    }
  </style>
</head>
<body>

  <header class="app-topbar">
    <div class="topbar-left">
      <div class="logo">plot<span class="logo-rising-o">o</span><span class="logo-rising-x">x</span></div>
      <div class="separator">/</div>
      <div class="dashboard-name">${db.name}</div>
    </div>
    <div class="topbar-right" style="display: flex; align-items: center; gap: 8px;">
      <select id="number-system-select" class="theme-btn" style="width: auto; padding: 0 12px; border-radius: 20px; font-size: 12px; font-family: inherit; font-weight: 600; border: 1px solid var(--color-border); background: var(--color-card); color: var(--color-primary); cursor: pointer;" title="Number Format">
        <option value="international">Int (K, M, B)</option>
        <option value="indian">Ind (K, L, Cr)</option>
        <option value="full">Exact</option>
      </select>
      <button id="theme-toggle" class="theme-btn" title="Toggle theme">
        <span class="material-symbols-outlined">dark_mode</span>
      </button>
    </div>
  </header>

  <div class="db-dashboard-view">
    <div class="db-dashboard-grid" id="dashboard-grid"></div>
  </div>

  <script>
    const data = ${dbJSON};
    const chartInstances = {};

    class NumberFormatter {
      static getSystem() {
        return localStorage.getItem('plotox-number-system') || 'international';
      }

      static setSystem(system) {
        localStorage.setItem('plotox-number-system', system);
      }

      static format(value, type) {
        if (value === null || value === undefined || value === '') return '';
        
        let num = Number(value);
        if (isNaN(num)) {
          const cleaned = String(value).replace(/[\\$,%\\s]/g, '');
          const parsed = Number(cleaned);
          if (!isNaN(parsed) && cleaned !== '') {
            num = parsed;
          } else {
            return value;
          }
        }

        if (type === 'growth') {
          return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
        }

        const system = this.getSystem();
        const absVal = Math.abs(num);

        if (system === 'full') {
          return this.formatFull(num);
        }

        if (system === 'indian') {
          if (absVal >= 10000000) {
            return (num / 10000000).toFixed(1).replace(/\\.0$/, '') + ' Cr';
          }
          if (absVal >= 100000) {
            return (num / 100000).toFixed(1).replace(/\\.0$/, '') + ' L';
          }
          if (absVal >= 1000) {
            return (num / 1000).toFixed(1).replace(/\\.0$/, '') + ' K';
          }
        } else {
          if (absVal >= 1e12) {
            return (num / 1e12).toFixed(1).replace(/\\.0$/, '') + 'T';
          }
          if (absVal >= 1e9) {
            return (num / 1e9).toFixed(1).replace(/\\.0$/, '') + 'B';
          }
          if (absVal >= 1e6) {
            return (num / 1e6).toFixed(1).replace(/\\.0$/, '') + 'M';
          }
          if (absVal >= 1e3) {
            return (num / 1e3).toFixed(1).replace(/\\.0$/, '') + 'K';
          }
        }

        if (Number.isInteger(num)) {
          return num.toLocaleString();
        }
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      static formatFull(value) {
        if (value === null || value === undefined || value === '') return '';
        let num = Number(value);
        if (isNaN(num)) {
          const cleaned = String(value).replace(/[\\$,%\\s]/g, '');
          const parsed = Number(cleaned);
          if (!isNaN(parsed) && cleaned !== '') {
            num = parsed;
          } else {
            return value;
          }
        }
        if (Number.isInteger(num)) {
          return num.toLocaleString();
        }
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    function init() {
      setupNumberSystem();
      setupTheme();
      window.addEventListener('resize', () => {
        Object.values(chartInstances).forEach(chart => chart.resize());
      });
    }

    function setupNumberSystem() {
      const select = document.getElementById('number-system-select');
      if (!select) return;

      const applySystem = (system) => {
        localStorage.setItem('plotox-number-system', system);
        select.value = system;
        renderWidgets();
      };

      const saved = localStorage.getItem('plotox-number-system') || 'international';
      applySystem(saved);

      select.addEventListener('change', () => {
        applySystem(select.value);
      });
    }

    function renderWidgets() {
      const grid = document.getElementById('dashboard-grid');
      grid.innerHTML = '';

      data.widgets.forEach(widget => {
        const card = document.createElement('div');
        card.className = \`db-widget db-widget-\${widget.type} \${widget.gridClass || ''}\`;
        
        const typeIcons = { chart: 'bar_chart', kpi: 'speed', table: 'table_chart', text: 'text_fields' };
        
        card.innerHTML = \`
          <div class="db-widget-header">
            <span class="material-symbols-outlined db-widget-type-icon">\${typeIcons[widget.type] || 'widgets'}</span>
            <span class="db-widget-title">\${widget.config?.title || 'Widget'}</span>
          </div>
          <div class="db-widget-body" id="body-\${widget.id}"></div>
        \`;
        grid.appendChild(card);

        const body = document.getElementById(\`body-\${widget.id}\`);
        renderWidgetContent(widget, body);
      });
    }

    function renderWidgetContent(widget, body) {
      switch (widget.type) {
        case 'kpi':
          renderKPI(body, widget.config, data.dataset);
          break;
        case 'table':
          renderTable(body, widget.config, data.dataset);
          break;
        case 'text':
          renderText(body, widget.config);
          break;
        case 'chart':
          renderChart(body, widget.id, widget.config, data.dataset);
          break;
      }
    }

    function renderKPI(body, config, dataset) {
      const kpiType = config.kpiType || 'total';
      const column = config.column;
      const label = config.title || 'Metric';

      let value = 0;
      let prevValue = null;
      let trend = null;
      let prefix = config.prefix || '';
      let suffix = config.suffix || '';

      if (dataset && dataset.headers && dataset.rows.length && column) {
        const colIdx = dataset.headers.indexOf(column);
        if (colIdx !== -1) {
          const values = dataset.rows
            .map(r => {
              const v = r[colIdx];
              const n = Number(String(v).replace(/[\\$,%]/g, ''));
              return isFinite(n) ? n : null;
            })
            .filter(v => v !== null);

          if (values.length > 0) {
            switch (kpiType) {
              case 'total':
                value = values.reduce((a, b) => a + b, 0);
                break;
              case 'average':
                value = values.reduce((a, b) => a + b, 0) / values.length;
                break;
              case 'count':
                value = values.length;
                break;
              case 'max':
                value = Math.max(...values);
                break;
              case 'min':
                value = Math.min(...values);
                break;
              case 'growth':
                if (values.length >= 2) {
                  const first = values[0];
                  const last = values[values.length - 1];
                  value = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
                  suffix = '';
                }
                break;
              case 'latest':
                value = values[values.length - 1];
                break;
            }

            if (values.length >= 2) {
              const mid = Math.floor(values.length / 2);
              const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
              const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
              trend = secondHalf >= firstHalf ? 'up' : 'down';
              const trendPct = firstHalf !== 0 ? Math.abs(((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1) : '0.0';
              prevValue = trendPct;
            }
          }
        }
      }

      const formatted = formatKPIValue(value, kpiType);
      const styles = {
        total: { icon: 'functions', colorClass: 'db-kpi-indigo' },
        average: { icon: 'avg_pace', colorClass: 'db-kpi-purple' },
        count: { icon: 'tag', colorClass: 'db-kpi-orange' },
        growth: { icon: 'trending_up', colorClass: 'db-kpi-emerald' },
        max: { icon: 'arrow_upward', colorClass: 'db-kpi-pink' },
        min: { icon: 'arrow_downward', colorClass: 'db-kpi-blue' },
        latest: { icon: 'schedule', colorClass: 'db-kpi-indigo' }
      };
      const style = styles[kpiType] || styles.total;

      body.innerHTML = \`
        <div class="db-kpi-card \${style.colorClass}">
          <div class="db-kpi-icon-wrapper">
            <span class="material-symbols-outlined">\${style.icon}</span>
          </div>
          <div class="db-kpi-content">
            <div class="db-kpi-label">\${label}</div>
            <div class="db-kpi-value">\${prefix}\${formatted}\${suffix}</div>
            \${trend ? \`
              <div class="db-kpi-trend \${trend === 'up' ? 'db-kpi-trend-up' : 'db-kpi-trend-down'}">
                <span class="material-symbols-outlined">\${trend === 'up' ? 'trending_up' : 'trending_down'}</span>
                <span>\${prevValue}% vs prior period</span>
              </div>
            \` : '<div class="db-kpi-trend db-kpi-trend-neutral"><span>No trend data</span></div>'}
          </div>
        </div>
      \`;
    }

    function formatKPIValue(value, type) {
      return NumberFormatter.format(value, type);
    }

    function renderTable(body, config, dataset) {
      const cols = config.columns || dataset.headers;
      let html = '<div class="db-table-container"><div class="db-table-scroll-body"><table><thead><tr>';
      html += '<th class="db-table-index-cell">#</th>';
      cols.forEach(col => { html += \`<th>\${col}</th>\`; });
      html += '</tr></thead><tbody>';
      
      const colIndices = cols.map(c => dataset.headers.indexOf(c));
      dataset.rows.forEach((row, rIdx) => {
        html += \`<tr class="\${rIdx % 2 === 0 ? '' : 'alt'}">\`;
        html += \`<td class="db-table-index-cell">\${rIdx + 1}</td>\`;
        colIndices.forEach((idx, cIdx) => {
          const colName = cols[cIdx];
          const isNumeric = dataset.types?.[colName] === 'numeric';
          let val = idx !== -1 ? (row[idx] ?? '') : '';
          if (isNumeric && val !== '' && val !== null && val !== undefined) {
            val = NumberFormatter.format(Number(val));
          }
          html += \`<td>\${val}</td>\`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      html += \`<div class="db-table-footer">\${dataset.rows.length.toLocaleString()} rows · \${cols.length} columns</div></div>\`;
      body.innerHTML = html;
    }

    function renderText(body, config) {
      body.innerHTML = \`<div class="db-text-widget">\${config.content || ''}</div>\`;
    }

    function renderChart(body, widgetId, config, dataset) {
      const chartDiv = document.createElement('div');
      chartDiv.style.width = '100%';
      chartDiv.style.height = '100%';
      body.appendChild(chartDiv);

      const chart = echarts.init(chartDiv);
      chartInstances[widgetId] = chart;

      const isDark = document.documentElement.classList.contains('dark');
      const chartType = config.chartType || 'line';

      if (chartType === 'pie' || chartType === 'donut') {
        renderPieChart(chart, dataset, config, isDark);
      } else if (chartType === 'histogram') {
        renderHistogramChart(chart, dataset, config, isDark);
      } else {
        renderCartesianChart(chart, dataset, config, isDark);
      }
      setTimeout(() => chart.resize(), 50);
    }

    function renderCartesianChart(chart, dataset, config, isDark) {
      const xIdx = dataset.headers.indexOf(config.xAxis);
      const xValues = xIdx !== -1 ? dataset.rows.map(r => r[xIdx]) : dataset.rows.map((_, i) => i + 1);

      const palettes = {
        classic: isDark
          ? ['#60a5fa', '#34d399', '#fb923c', '#22d3ee', '#a78bfa', '#f472b6']
          : ['#2563eb', '#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899'],
        vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676'],
        ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef'],
        sunset: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'],
        mono: ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8c8c8c', '#adadad', '#cecece']
      };
      const colors = palettes[config.colorPalette] || palettes.classic;
      const chartType = config.chartType || 'line';
      const yAxes = config.yAxes || [];

      const series = yAxes.map((col, idx) => {
        const yIdx = dataset.headers.indexOf(col);
        return {
          name: col,
          type: chartType === 'area' ? 'line' : (chartType === 'scatter' ? 'scatter' : chartType),
          data: dataset.rows.map(r => {
            const v = r[yIdx];
            const n = Number(String(v).replace(/[\\$,%]/g, ''));
            return isFinite(n) ? n : null;
          }),
          smooth: config.lineSmooth || chartType === 'area',
          itemStyle: { color: colors[idx % colors.length] },
          areaStyle: chartType === 'area' ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colors[idx % colors.length] + '44' },
              { offset: 1, color: colors[idx % colors.length] + '05' }
            ])
          } : undefined,
          barWidth: chartType === 'bar' ? '50%' : undefined
        };
      });

      const textColor = isDark ? '#9A9895' : '#6B6B6B';
      const gridColor = isDark ? '#2A2926' : '#E7E7E4';

      chart.setOption({
        backgroundColor: 'transparent',
        color: colors,
        tooltip: {
          trigger: chartType === 'scatter' ? 'item' : 'axis',
          confine: true,
          formatter: (params) => {
            if (!Array.isArray(params)) params = [params];
            let html = '';
            if (params[0].axisValueLabel) {
              html += \`<strong style="display:block;margin-bottom:4px;">\${params[0].axisValueLabel}</strong>\`;
            }
            params.forEach(item => {
              if (item.value !== null && item.value !== undefined) {
                const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
                const compact = NumberFormatter.format(val);
                const exact = NumberFormatter.formatFull(val);
                const marker = item.marker || '';
                html += \`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                  <span>\${marker}\${item.seriesName}</span>
                  <strong>\${compact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(\${exact})</span></strong>
                </div>\`;
              }
            });
            return html;
          }
        },
        legend: {
          show: yAxes.length > 1,
          bottom: 0,
          textStyle: { color: textColor, fontSize: 11 },
          itemWidth: 12,
          itemHeight: 8
        },
        grid: {
          left: '8%', right: '6%',
          bottom: yAxes.length > 1 ? '16%' : '10%',
          top: '8%',
          containLabel: true
        },
        xAxis: {
          type: chartType === 'scatter' ? 'value' : 'category',
          data: chartType === 'scatter' ? undefined : xValues,
          axisLabel: { color: textColor, fontSize: 10, rotate: xValues.length > 10 ? 30 : 0 },
          axisLine: { lineStyle: { color: gridColor } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (value) => NumberFormatter.format(value)
          },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series
      });
    }

    function renderPieChart(chart, dataset, config, isDark) {
      const catIdx = dataset.headers.indexOf(config.xAxis);
      const valIdx = dataset.headers.indexOf(config.yAxes && config.yAxes[0]);

      if (catIdx === -1 || valIdx === -1) return;

      const palettes = {
        classic: isDark
          ? ['#60a5fa', '#34d399', '#fb923c', '#22d3ee', '#a78bfa', '#f472b6', '#22c55e', '#0ea5e9']
          : ['#2563eb', '#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#0284c7'],
        vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676'],
        ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef'],
        sunset: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'],
        mono: ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8c8c8c', '#adadad', '#cecece']
      };
      const colors = palettes[config.colorPalette] || palettes.classic;

      const aggregated = {};
      dataset.rows.forEach(row => {
        const cat = String(row[catIdx]);
        const val = Number(String(row[valIdx]).replace(/[\\$,%]/g, ''));
        if (isFinite(val)) {
          aggregated[cat] = (aggregated[cat] || 0) + val;
        }
      });

      const data = Object.entries(aggregated)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

      const isDonut = config.chartType === 'donut';
      const textColor = isDark ? '#9A9895' : '#6B6B6B';

      chart.setOption({
        backgroundColor: 'transparent',
        color: colors,
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params) => {
            const val = Number(params.value);
            const compact = NumberFormatter.format(val);
            const exact = NumberFormatter.formatFull(val);
            return \`\${params.marker}<strong>\${params.name}</strong><br/>
              Value: <strong>\${compact} (\${exact})</strong><br/>
              Percentage: <strong>\${params.percent}%</strong>\`;
          }
        },
        legend: {
          orient: 'vertical',
          right: '4%',
          top: 'center',
          textStyle: { color: textColor, fontSize: 11 },
          itemWidth: 10,
          itemHeight: 10,
          type: 'scroll'
        },
        series: [{
          type: 'pie',
          radius: isDonut ? ['42%', '70%'] : ['0%', '70%'],
          center: ['40%', '50%'],
          data,
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: textColor,
            fontSize: 10
          },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold', color: textColor }
          },
          itemStyle: {
            borderRadius: isDonut ? 6 : 4,
            borderColor: isDark ? '#1C1C19' : '#FCFCFB',
            borderWidth: 2
          }
        }]
      });
    }

    function calculateHistogram(values, binCount = 10) {
      const numericValues = values
        .map(v => Number(String(v).replace(/[$,%]/g, '')))
        .filter(v => isFinite(v) && v !== null);

      if (numericValues.length === 0) {
        return { bins: [], counts: [] };
      }

      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      
      if (min === max) {
        return { bins: [min.toFixed(1)], counts: [numericValues.length] };
      }

      const binWidth = (max - min) / binCount;
      const bins = [];
      const counts = Array(binCount).fill(0);

      for (let i = 0; i < binCount; i++) {
        const start = min + i * binWidth;
        const end = start + binWidth;
        bins.push(NumberFormatter.format(start) + ' - ' + NumberFormatter.format(end));
      }

      numericValues.forEach(v => {
        let binIdx = Math.floor((v - min) / binWidth);
        if (binIdx >= binCount) binIdx = binCount - 1;
        if (binIdx < 0) binIdx = 0;
        counts[binIdx]++;
      });

      return { bins, counts };
    }

    function renderHistogramChart(chart, dataset, config, isDark) {
      const palettes = {
        classic: isDark
          ? ['#60a5fa', '#34d399', '#fb923c', '#22d3ee', '#a78bfa', '#f472b6', '#22c55e', '#0ea5e9']
          : ['#2563eb', '#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#0284c7'],
        vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676'],
        ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef'],
        sunset: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'],
        mono: ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8c8c8c', '#adadad', '#cecece']
      };
      const colors = palettes[config.colorPalette] || palettes.classic;

      const column = (config.yAxes && config.yAxes[0]) || dataset.headers[0];
      const colIdx = dataset.headers.indexOf(column);

      if (colIdx === -1) return;

      const rawValues = dataset.rows.map(r => r[colIdx]);
      const { bins, counts } = calculateHistogram(rawValues, 10);

      const textColor = isDark ? '#9A9895' : '#6B6B6B';
      const gridColor = isDark ? '#2A2926' : '#E7E7E4';

      chart.setOption({
        backgroundColor: 'transparent',
        color: colors,
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          confine: true,
          formatter: (params) => {
            const item = params[0];
            const val = Number(item.value);
            const compact = NumberFormatter.format(val);
            const exact = NumberFormatter.formatFull(val);
            return \`\${item.name}<br/>Count: <strong>\${compact} (\${exact})</strong>\`;
          }
        },
        grid: {
          left: '8%', right: '6%',
          bottom: '16%', top: '8%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: bins,
          axisLabel: { color: textColor, fontSize: 10, rotate: bins.length > 5 ? 20 : 0 },
          axisLine: { lineStyle: { color: gridColor } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (value) => NumberFormatter.format(value)
          },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [{
          name: column,
          type: 'bar',
          barWidth: '90%',
          data: counts,
          itemStyle: { color: colors[0] }
        }]
      });
    }

    function setupTheme() {
      const toggle = document.getElementById('theme-toggle');
      
      const applyTheme = (theme) => {
        if (theme === 'dark') {
          document.documentElement.className = 'dark';
          toggle.innerHTML = '<span class="material-symbols-outlined">light_mode</span>';
        } else {
          document.documentElement.className = 'light';
          toggle.innerHTML = '<span class="material-symbols-outlined">dark_mode</span>';
        }
        
        // Re-render all charts with new theme colors
        data.widgets.forEach(w => {
          if (w.type === 'chart' && chartInstances[w.id]) {
            const chart = chartInstances[w.id];
            const isDark = theme === 'dark';
            const config = w.config;
            const chartType = config.chartType || 'line';

            if (chartType === 'pie' || chartType === 'donut') {
              renderPieChart(chart, data.dataset, config, isDark);
            } else {
              renderCartesianChart(chart, data.dataset, config, isDark);
            }
          }
        });
      };

      // Set initial theme based on system/browser preference
      const pref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(pref);

      toggle.addEventListener('click', () => {
        const current = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(current);
      });
    }

    window.onload = init;
  <\/script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${db.name || 'dashboard'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export HTML failed:', err);
      this._showError('Failed to export HTML: ' + err.message);
    }
  }



  // ═══════════════════════════════════════════════════
  // AUTO-SAVE
  // ═══════════════════════════════════════════════════

  _triggerAutoSave() {
    if (!this._autoSaveEnabled || !this.activeDashboard) return;

    const statusEl = document.getElementById('db-save-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="material-symbols-outlined db-saving-spin">sync</span> Saving...';
    }

    DashboardDB.autoSave(this.activeDashboard, 1500);

    // Listen for save completion
    const handler = (e) => {
      if (e.detail.id === this.activeDashboard?.id) {
        if (statusEl) {
          statusEl.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Saved';
        }
        window.removeEventListener('dashboardAutoSaved', handler);
      }
    };
    window.addEventListener('dashboardAutoSaved', handler);
  }

  _rerenderAllWidgets() {
    if (!this.activeDashboard || !this.dataset) return;
    (this.activeDashboard.widgets || []).forEach(widget => {
      this.widgets.renderWidget(widget, this.dataset);
    });
    setTimeout(() => this.widgets.resizeAll(), 100);
  }
}

// Create global instance
window.DashboardApp = DashboardApp;
window.dashboardApp = new DashboardApp();
