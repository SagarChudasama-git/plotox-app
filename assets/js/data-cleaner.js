/**
 * Plotox Data Cleaner — Core Application Logic
 * Manages dataset tabs, spreadsheet grid, cleaning operations, transforms,
 * validation, export, undo/redo, and chart integration.
 */
function initDataCleaner() {

  // ── State ──────────────────────────────────
  const storedPerPage = localStorage.getItem('plotox-settings-per-page');
  const cleanerState = {
    datasets: [],       // Array of { id, name, headers, rows, types, stats, rawText, lastModified }
    activeDatasetId: null,
    currentPage: 1,
    perPage: storedPerPage ? (storedPerPage === 'all' ? 'all' : parseInt(storedPerPage)) : 50,
    searchQuery: '',
    sortCol: null,
    sortDir: 'none',    // 'asc' | 'desc' | 'none'
    undoStack: [],
    redoStack: [],
    activeTransform: null,
    activeCleanOp: null
  };

  // ── DOM References ─────────────────────────
  const fileInput = document.getElementById('cleaner-file-input');
  const pasteBtn = document.getElementById('cleaner-paste-btn');
  const sampleBtn = document.getElementById('cleaner-sample-btn');
  const tabsBar = document.getElementById('dataset-tabs-bar');
  const tabAddBtn = document.getElementById('dataset-tab-add');
  const gridWrapper = document.getElementById('cleaner-grid-wrapper');
  const emptyState = document.getElementById('cleaner-empty-state');
  const searchInput = document.getElementById('cleaner-search');
  const gridMeta = document.getElementById('cleaner-grid-meta');
  const pagination = document.getElementById('cleaner-pagination');
  const pageBtns = document.getElementById('cleaner-page-btns');
  const perPageSelect = document.getElementById('cleaner-per-page');
  const customPerPageInput = document.getElementById('cleaner-custom-per-page');

  // Toolbar
  const tbUndo = document.getElementById('cleaner-tb-undo');
  const tbRedo = document.getElementById('cleaner-tb-redo');
  const tbSave = document.getElementById('cleaner-tb-save');
  const tbExport = document.getElementById('cleaner-tb-export');
  const tbRefresh = document.getElementById('cleaner-tb-refresh');
  const tbGenChart = document.getElementById('cleaner-tb-gen-chart');

  // Internal Tabs
  const internalTabs = document.querySelectorAll('.cleaner-internal-tab');
  const tabContents = {
    raw: document.getElementById('cleaner-tab-raw'),
    clean: document.getElementById('cleaner-tab-clean'),
    transform: document.getElementById('cleaner-tab-transform'),
    validation: document.getElementById('cleaner-tab-validation')
  };

  // Properties Panel
  const propFilename = document.getElementById('prop-filename');
  const propSize = document.getElementById('prop-size');
  const propCols = document.getElementById('prop-cols');
  const propRows = document.getElementById('prop-rows');
  const propModified = document.getElementById('prop-modified');
  const propTypesList = document.getElementById('prop-types-list');

  // Clean tab elements
  const opButtons = document.querySelectorAll('[data-op]');
  const cleanGrid = document.getElementById('cleaner-clean-grid');
  const changeBadge = document.getElementById('cleaner-change-badge');

  // Transform tab elements
  const transformButtons = document.querySelectorAll('[data-transform]');
  const transformForm = document.getElementById('cleaner-transform-form');

  // Validation tab
  const validationContainer = document.getElementById('cleaner-validation-container');

  if (!fileInput || !tabsBar) return; // Guard for pages without cleaner

  // ── Helpers ────────────────────────────────
  function genId() {
    return 'ds-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function showToast(msg, type = 'success', title = '') {
    const existing = document.querySelector('.cleaner-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'cleaner-toast ' + type;

    const displayTitle = title || (type === 'error' ? 'Error' : type === 'info' ? 'Information' : 'Success');
    const icon = type === 'error' ? 'error' : type === 'info' ? 'info' : 'check_circle';

    t.innerHTML = `
      <div class="toast-icon-container">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="toast-body">
        <div class="toast-title">${displayTitle}</div>
        <div class="toast-description">${msg}</div>
      </div>
      <button class="toast-close-btn">
        <span class="material-symbols-outlined" style="font-size: 16px !important;">close</span>
      </button>
    `;
    document.body.appendChild(t);

    const timeoutId = setTimeout(() => {
      t.style.animation = 'slideUpFade 0.3s ease reverse';
      setTimeout(() => t.remove(), 300);
    }, 5000);

    t.querySelector('.toast-close-btn').addEventListener('click', () => {
      clearTimeout(timeoutId);
      t.style.animation = 'slideUpFade 0.3s ease reverse';
      setTimeout(() => t.remove(), 300);
    });
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── Active Dataset Accessor ────────────────
  function getActiveDataset() {
    return cleanerState.datasets.find(d => d.id === cleanerState.activeDatasetId) || null;
  }

  // ── Push Undo State ────────────────────────
  function pushUndo() {
    const ds = getActiveDataset();
    if (!ds) return;
    cleanerState.undoStack.push({
      datasetId: ds.id,
      headers: [...ds.headers],
      rows: ds.rows.map(r => [...r]),
      types: { ...ds.types },
      stats: JSON.parse(JSON.stringify(ds.stats))
    });
    if (cleanerState.undoStack.length > 50) cleanerState.undoStack.shift();
    cleanerState.redoStack = [];
  }

  function undo() {
    if (cleanerState.undoStack.length === 0) return;
    const snap = cleanerState.undoStack.pop();
    const ds = cleanerState.datasets.find(d => d.id === snap.datasetId);
    if (!ds) return;
    // Push current to redo
    cleanerState.redoStack.push({
      datasetId: ds.id,
      headers: [...ds.headers],
      rows: ds.rows.map(r => [...r]),
      types: { ...ds.types },
      stats: JSON.parse(JSON.stringify(ds.stats))
    });
    ds.headers = snap.headers;
    ds.rows = snap.rows;
    ds.types = snap.types;
    ds.stats = snap.stats;
    ds.lastModified = new Date().toISOString();
    renderAll();
    showToast('Undo applied', 'info');
  }

  function redo() {
    if (cleanerState.redoStack.length === 0) return;
    const snap = cleanerState.redoStack.pop();
    const ds = cleanerState.datasets.find(d => d.id === snap.datasetId);
    if (!ds) return;
    cleanerState.undoStack.push({
      datasetId: ds.id,
      headers: [...ds.headers],
      rows: ds.rows.map(r => [...r]),
      types: { ...ds.types },
      stats: JSON.parse(JSON.stringify(ds.stats))
    });
    ds.headers = snap.headers;
    ds.rows = snap.rows;
    ds.types = snap.types;
    ds.stats = snap.stats;
    ds.lastModified = new Date().toISOString();
    renderAll();
    showToast('Redo applied', 'info');
  }

  // ── File Handling ──────────────────────────
  function handleFileUpload(file) {
    if (!file) return;
    const sizeGuard = FileSizeGuard.validateFile(file);
    if (!sizeGuard.valid) {
      showToast(sizeGuard.errorMessage, 'error', sizeGuard.title);
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      handleExcelFile(file);
    } else {
      handleTextFile(file);
    }
  }

  function handleTextFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = DataParser.parse(text);
        addDataset(file.name, parsed.headers, parsed.rows, parsed.types, parsed.stats, text, true);
        showToast(`Loaded "${file.name}" — ${parsed.rows.length} rows`);
      } catch (err) {
        showToast('Error parsing file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          showToast('Excel support not loaded. Please try CSV format.', 'error');
          return;
        }
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(sheet);
        const parsed = DataParser.parse(csvText);
        addDataset(file.name, parsed.headers, parsed.rows, parsed.types, parsed.stats, csvText, true);
        showToast(`Loaded "${file.name}" — ${parsed.rows.length} rows`);
      } catch (err) {
        showToast('Error parsing Excel file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function loadSampleData() {
    const sampleCSV = `Name,Age,City,Salary,Department,Start Date
John Smith,32,New York,85000,Engineering,2020-03-15
Jane Doe,28,San Francisco,92000,Marketing,2021-06-01
Bob Johnson,45,Chicago,78000,Sales,2018-11-20
Alice Williams,35,,95000,Engineering,2019-07-10
Charlie Brown,29,Boston,88000,Marketing,2022-01-05
  Diana Prince,41,New York,110000,Engineering,2017-09-12
Eve Adams,33,San Francisco,,Design,2020-12-01
Frank Castle,38,Chicago,72000,Sales,2019-04-18
Grace Hopper,55,Boston,125000,Engineering,2015-02-28
John Smith,32,New York,85000,Engineering,2020-03-15
Hannah Montana,26,Los Angeles,67000,Marketing,2023-03-01
,,,,, 
Ivan Drago,44,Miami,91000,Sales,2018-08-15
Julia Roberts,37,New York,98000,Design,2019-11-30
Kevin Hart,31,Los Angeles,76000,Marketing,2021-09-22`;

    try {
      const parsed = DataParser.parse(sampleCSV);
      addDataset('sample_employees.csv', parsed.headers, parsed.rows, parsed.types, parsed.stats, sampleCSV, true);
      showToast('Sample dataset loaded');
    } catch (err) {
      showToast('Error loading sample: ' + err.message, 'error');
    }
  }

  // ── Dataset Management ─────────────────────
  function addDataset(name, headers, rows, types, stats, rawText, shouldScroll = false) {
    const ds = {
      id: genId(),
      name: name,
      headers: headers,
      rows: rows.map(r => [...r]),
      types: types || {},
      stats: stats || {},
      rawText: rawText || '',
      rawSize: rawText ? rawText.length : 0,
      lastModified: new Date().toISOString()
    };
    cleanerState.datasets.push(ds);
    cleanerState.activeDatasetId = ds.id;
    cleanerState.currentPage = 1;
    cleanerState.searchQuery = '';
    cleanerState.sortCol = null;
    cleanerState.sortDir = 'none';
    cleanerState.undoStack = [];
    cleanerState.redoStack = [];
    if (searchInput) searchInput.value = '';
    renderAll();
    saveToStorage();

    if (shouldScroll) {
      setTimeout(() => {
        const workspaceLayout = document.querySelector('.cleaner-main-layout');
        const scrollContainer = document.querySelector('.app-main');
        if (workspaceLayout) {
          if (scrollContainer) {
            const targetScrollTop = scrollContainer.scrollTop + workspaceLayout.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
            scrollContainer.scrollTo({
              top: targetScrollTop - 20, // 20px premium breathing room gap below sticky topbar
              behavior: 'smooth'
            });
          } else {
            workspaceLayout.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 150); // 150ms delay to guarantee full render stabilization
    }
  }

  function removeDataset(id) {
    cleanerState.datasets = cleanerState.datasets.filter(d => d.id !== id);
    if (cleanerState.activeDatasetId === id) {
      cleanerState.activeDatasetId = cleanerState.datasets.length > 0 ? cleanerState.datasets[0].id : null;
    }
    cleanerState.currentPage = 1;
    renderAll();
    saveToStorage();
  }

  function switchDataset(id) {
    cleanerState.activeDatasetId = id;
    cleanerState.currentPage = 1;
    cleanerState.searchQuery = '';
    cleanerState.sortCol = null;
    cleanerState.sortDir = 'none';
    cleanerState.undoStack = [];
    cleanerState.redoStack = [];
    if (searchInput) searchInput.value = '';
    renderAll();
  }

  // ── Storage ────────────────────────────────
  function saveToStorage() {
    try {
      const saveData = cleanerState.datasets.map(d => ({
        id: d.id,
        name: d.name,
        headers: d.headers,
        rows: d.rows,
        types: d.types,
        rawSize: d.rawSize,
        lastModified: d.lastModified
      }));
      localStorage.setItem('plotox-cleaner-datasets', JSON.stringify(saveData));
      localStorage.setItem('plotox-cleaner-active', cleanerState.activeDatasetId || '');
    } catch (e) {
      console.warn('Cleaner: Storage quota exceeded or blocked', e);
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('plotox-cleaner-datasets');
      const activeId = localStorage.getItem('plotox-cleaner-active');
      if (saved) {
        let datasets = JSON.parse(saved);
        if (Array.isArray(datasets)) {
          const originalCount = datasets.length;
          datasets = datasets.filter(d => {
            const size = d.rawSize || 0;
            return size <= FileSizeGuard.MAX_SIZE;
          });
          if (datasets.length < originalCount) {
            showToast('Some saved datasets exceeded the 1 MB limit and were not loaded.', 'error');
          }
          cleanerState.datasets = datasets;
          cleanerState.activeDatasetId = activeId || (cleanerState.datasets.length > 0 ? cleanerState.datasets[0].id : null);
          if (cleanerState.activeDatasetId && !cleanerState.datasets.some(d => d.id === cleanerState.activeDatasetId)) {
            cleanerState.activeDatasetId = cleanerState.datasets.length > 0 ? cleanerState.datasets[0].id : null;
          }
        }
        renderAll();
      }
    } catch (e) {
      console.warn('Cleaner: Failed to load from storage', e);
    }
  }

  // ── Render All ─────────────────────────────
  function renderAll() {
    const ds = getActiveDataset();
    renderTabs();
    renderGrid();
    renderProperties();
    updateCleanCounts();
    renderCleanableSummaryBanner();
    renderCleanPreview(ds);
    renderTransform();
    renderValidation();
  }

  // ── Render Dataset Tabs ────────────────────
  function renderTabs() {
    // Remove existing tabs (except add button)
    const existing = tabsBar.querySelectorAll('.dataset-tab');
    existing.forEach(t => t.remove());

    cleanerState.datasets.forEach(ds => {
      const tab = document.createElement('button');
      tab.className = 'dataset-tab' + (ds.id === cleanerState.activeDatasetId ? ' active' : '');
      tab.dataset.dsId = ds.id;
      tab.innerHTML = `
        <span class="dataset-tab-name" title="${escapeHTML(ds.name)}">${escapeHTML(ds.name)}</span>
        <span class="dataset-tab-close" title="Close">×</span>
      `;
      tabsBar.insertBefore(tab, tabAddBtn);

      // Click to switch
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('dataset-tab-close')) return;
        switchDataset(ds.id);
      });

      // Close button
      tab.querySelector('.dataset-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeDataset(ds.id);
      });

      // Double-click to rename
      const nameEl = tab.querySelector('.dataset-tab-name');
      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        nameEl.contentEditable = 'true';
        nameEl.focus();
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });

      nameEl.addEventListener('blur', () => {
        nameEl.contentEditable = 'false';
        const newName = nameEl.textContent.trim();
        if (newName) {
          ds.name = newName;
          saveToStorage();
        } else {
          nameEl.textContent = ds.name;
        }
      });

      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameEl.blur();
        }
      });
    });
  }

  // ── Render Spreadsheet Grid ────────────────
  function renderGrid() {
    const ds = getActiveDataset();
    if (!ds || !ds.rows || ds.rows.length === 0) {
      gridWrapper.innerHTML = '';
      gridWrapper.appendChild(createEmptyState('table_chart', 'No Dataset Loaded', 'Upload a CSV or Excel file, or paste raw data to start cleaning and transforming your dataset.'));
      if (pagination) pagination.style.display = 'none';
      if (gridMeta) gridMeta.textContent = 'No data loaded';
      return;
    }

    // Filter rows by search
    let filteredRows = ds.rows;
    let filteredIndices = ds.rows.map((_, i) => i);
    if (cleanerState.searchQuery) {
      const q = cleanerState.searchQuery.toLowerCase();
      const matches = [];
      const matchIdx = [];
      ds.rows.forEach((row, idx) => {
        if (row.some(cell => String(cell).toLowerCase().includes(q))) {
          matches.push(row);
          matchIdx.push(idx);
        }
      });
      filteredRows = matches;
      filteredIndices = matchIdx;
    }

    // Sort
    if (cleanerState.sortCol !== null && cleanerState.sortDir !== 'none') {
      const colIdx = cleanerState.sortCol;
      const dir = cleanerState.sortDir === 'asc' ? 1 : -1;
      const isNumeric = ds.types[ds.headers[colIdx]] === 'numeric';
      const combined = filteredRows.map((row, i) => ({ row, origIdx: filteredIndices[i] }));
      combined.sort((a, b) => {
        let va = a.row[colIdx] || '';
        let vb = b.row[colIdx] || '';
        if (isNumeric) {
          va = parseFloat(String(va).replace(/[$,%]/g, '')) || 0;
          vb = parseFloat(String(vb).replace(/[$,%]/g, '')) || 0;
          return (va - vb) * dir;
        }
        return String(va).localeCompare(String(vb)) * dir;
      });
      filteredRows = combined.map(c => c.row);
      filteredIndices = combined.map(c => c.origIdx);
    }

    // Pagination
    const totalRows = filteredRows.length;
    const perPage = cleanerState.perPage === 'all' ? totalRows : parseInt(cleanerState.perPage);
    const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
    if (cleanerState.currentPage > totalPages) cleanerState.currentPage = totalPages;
    const startIdx = (cleanerState.currentPage - 1) * perPage;
    const pageRows = filteredRows.slice(startIdx, startIdx + perPage);
    const pageIndices = filteredIndices.slice(startIdx, startIdx + perPage);

    // Build table
    let html = '<table class="cleaner-table"><thead><tr>';
    html += '<th class="row-num-col">#</th>';
    ds.headers.forEach((h, ci) => {
      const isSorted = cleanerState.sortCol === ci;
      const sortIcon = isSorted ? (cleanerState.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
      html += `<th data-col="${ci}" class="${isSorted ? 'sorted' : ''}">
        ${escapeHTML(h)}
        <span class="material-symbols-outlined th-sort-icon">${sortIcon}</span>
        <div class="th-resize-handle"></div>
      </th>`;
    });
    html += '</tr></thead><tbody>';

    const q = cleanerState.searchQuery ? cleanerState.searchQuery.toLowerCase() : '';
    pageRows.forEach((row, ri) => {
      const origIdx = pageIndices[ri];
      html += '<tr>';
      html += `<td class="row-num-cell">${origIdx + 1}</td>`;
      row.forEach((cell, ci) => {
        const cellStr = cell !== undefined && cell !== null ? String(cell) : '';
        const isEmpty = cellStr.trim() === '';
        const isMatch = q && cellStr.toLowerCase().includes(q);
        let classes = '';
        if (isEmpty) classes += ' empty-cell';
        if (isMatch) classes += ' highlight-match';
        html += `<td class="${classes}" data-row="${origIdx}" data-col="${ci}" title="${escapeHTML(cellStr)}">${escapeHTML(cellStr)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    gridWrapper.innerHTML = html;

    // Column sorting clicks
    gridWrapper.querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', (e) => {
        if (e.target.classList.contains('th-resize-handle')) return;
        const col = parseInt(th.dataset.col);
        if (cleanerState.sortCol === col) {
          if (cleanerState.sortDir === 'asc') cleanerState.sortDir = 'desc';
          else if (cleanerState.sortDir === 'desc') { cleanerState.sortDir = 'none'; cleanerState.sortCol = null; }
          else cleanerState.sortDir = 'asc';
        } else {
          cleanerState.sortCol = col;
          cleanerState.sortDir = 'asc';
        }
        renderGrid();
      });
    });

    // Cell editing
    gridWrapper.querySelectorAll('td[data-row]').forEach(td => {
      td.addEventListener('dblclick', () => {
        td.contentEditable = 'true';
        td.focus();
        const range = document.createRange();
        range.selectNodeContents(td);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
      td.addEventListener('blur', () => {
        td.contentEditable = 'false';
        const rowIdx = parseInt(td.dataset.row);
        const colIdx = parseInt(td.dataset.col);
        const newVal = td.textContent.trim();
        if (ds.rows[rowIdx] && ds.rows[rowIdx][colIdx] !== newVal) {
          pushUndo();
          ds.rows[rowIdx][colIdx] = newVal;
          ds.lastModified = new Date().toISOString();
          saveToStorage();
          renderProperties();
          updateCleanCounts();
        }
      });
      td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); td.blur(); }
        if (e.key === 'Escape') { td.textContent = ds.rows[parseInt(td.dataset.row)][parseInt(td.dataset.col)] || ''; td.blur(); }
      });
    });

    // Column resize
    gridWrapper.querySelectorAll('.th-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const th = handle.parentElement;
        const startX = e.clientX;
        const startW = th.offsetWidth;
        handle.classList.add('resizing');

        const onMove = (me) => {
          const diff = me.clientX - startX;
          th.style.width = Math.max(60, startW + diff) + 'px';
          th.style.minWidth = Math.max(60, startW + diff) + 'px';
        };
        const onUp = () => {
          handle.classList.remove('resizing');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    // Meta
    if (gridMeta) {
      gridMeta.textContent = `${ds.headers.length} columns · ${totalRows} rows` + (cleanerState.searchQuery ? ` (filtered from ${ds.rows.length})` : '');
    }

    // Pagination
    if (pagination) {
      pagination.style.display = 'flex';
      renderPagination(totalPages, totalRows, startIdx, pageRows.length);
    }
  }

  function renderPagination(totalPages, totalRows, startIdx, showingCount) {
    if (!pageBtns) return;
    let html = '';
    // Prev
    html += `<button class="cleaner-page-btn" data-page="prev" ${cleanerState.currentPage <= 1 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_left</span></button>`;
    // Page numbers
    const maxVisible = 5;
    let startP = Math.max(1, cleanerState.currentPage - 2);
    let endP = Math.min(totalPages, startP + maxVisible - 1);
    if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);
    for (let p = startP; p <= endP; p++) {
      html += `<button class="cleaner-page-btn ${p === cleanerState.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    // Next
    html += `<button class="cleaner-page-btn" data-page="next" ${cleanerState.currentPage >= totalPages ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_right</span></button>`;

    pageBtns.innerHTML = html;

    pageBtns.querySelectorAll('.cleaner-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.page;
        if (p === 'prev') cleanerState.currentPage = Math.max(1, cleanerState.currentPage - 1);
        else if (p === 'next') cleanerState.currentPage++;
        else cleanerState.currentPage = parseInt(p);
        renderGrid();
      });
    });
  }

  // ── Render Properties Panel ────────────────
  function renderProperties() {
    const ds = getActiveDataset();
    if (!ds) {
      if (propFilename) propFilename.textContent = '—';
      if (propSize) propSize.textContent = '—';
      if (propCols) propCols.textContent = '—';
      if (propRows) propRows.textContent = '—';
      if (propModified) propModified.textContent = '—';
      if (propTypesList) propTypesList.innerHTML = '—';
      return;
    }
    if (propFilename) propFilename.textContent = ds.name;
    if (propSize) propSize.textContent = formatBytes(ds.rawSize || 0);
    if (propCols) propCols.textContent = ds.headers.length;
    if (propRows) propRows.textContent = ds.rows.length;
    if (propModified) {
      const d = new Date(ds.lastModified);
      propModified.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (propTypesList && ds.types) {
      let html = '';
      ds.headers.forEach(h => {
        const type = ds.types[h] || 'text';
        html += `<div class="cleaner-prop-type-row"><span class="cleaner-prop-type-name" title="${escapeHTML(h)}">${escapeHTML(h)}</span><span class="cleaner-prop-type-badge">${type}</span></div>`;
      });
      propTypesList.innerHTML = html || '—';
    }
  }

  // ── Empty State Creator ────────────────────
  function createEmptyState(icon, title, desc) {
    const div = document.createElement('div');
    div.className = 'cleaner-empty-state';
    div.innerHTML = `<span class="material-symbols-outlined cleaner-empty-icon">${icon}</span><div class="cleaner-empty-title">${title}</div><div class="cleaner-empty-desc">${desc}</div>`;
    return div;
  }

  // ═══════════════════════════════════════════
  //  CLEAN DATA OPERATIONS
  // ═══════════════════════════════════════════
  function updateCleanCounts() {
    const ds = getActiveDataset();
    if (!ds) {
      const emptyRowEl = document.getElementById('op-count-empty-rows');
      if (emptyRowEl) emptyRowEl.textContent = '0';
      const dupEl = document.getElementById('op-count-duplicates');
      if (dupEl) dupEl.textContent = '0';
      const invalidRowEl = document.getElementById('op-count-invalid-rows');
      if (invalidRowEl) invalidRowEl.textContent = '0';
      const emptyColEl = document.getElementById('op-count-empty-cols');
      if (emptyColEl) emptyColEl.textContent = '0';
      return;
    }

    // Empty rows
    const emptyRowCount = ds.rows.filter(r => r.every(c => String(c).trim() === '')).length;
    const emptyRowEl = document.getElementById('op-count-empty-rows');
    if (emptyRowEl) emptyRowEl.textContent = emptyRowCount;

    // Duplicates
    const seen = new Set();
    let dupCount = 0;
    ds.rows.forEach(r => {
      const key = r.join('|||');
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    });
    const dupEl = document.getElementById('op-count-duplicates');
    if (dupEl) dupEl.textContent = dupCount;

    // Rows with empty cells (invalid rows)
    const invalidRowCount = ds.rows.filter(r => r.some(c => String(c).trim() === '')).length;
    const invalidRowEl = document.getElementById('op-count-invalid-rows');
    if (invalidRowEl) invalidRowEl.textContent = invalidRowCount;

    // Empty columns
    let emptyColCount = 0;
    ds.headers.forEach((_, ci) => {
      if (ds.rows.every(r => String(r[ci] || '').trim() === '')) emptyColCount++;
    });
    const emptyColEl = document.getElementById('op-count-empty-cols');
    if (emptyColEl) emptyColEl.textContent = emptyColCount;
  }

  function scanCleanableIssues() {
    const ds = getActiveDataset();
    if (!ds || ds.rows.length === 0) return null;

    let emptyCount = 0;
    let untrimmedCount = 0;
    ds.rows.forEach(r => {
      r.forEach(c => {
        const s = String(c);
        if (s.trim() === '') {
          emptyCount++;
        } else if (s !== s.trim()) {
          untrimmedCount++;
        }
      });
    });

    const seen = new Set();
    let dupCount = 0;
    ds.rows.forEach(r => {
      const key = r.join('|||');
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    });

    let emptyColCount = 0;
    ds.headers.forEach((_, ci) => {
      if (ds.rows.every(r => String(r[ci] || '').trim() === '')) emptyColCount++;
    });

    const totalIssues = emptyCount + dupCount + emptyColCount + untrimmedCount;
    return {
      emptyCount,
      untrimmedCount,
      dupCount,
      emptyColCount,
      totalIssues
    };
  }

  function renderCleanableSummaryBanner() {
    const bannerContainer = document.getElementById('cleaner-issues-banner');
    if (!bannerContainer) return;

    const ds = getActiveDataset();
    if (!ds || ds.rows.length === 0) {
      bannerContainer.style.display = 'none';
      return;
    }

    const scan = scanCleanableIssues();
    if (!scan || scan.totalIssues === 0) {
      bannerContainer.className = 'cleaner-issues-banner success';
      bannerContainer.style.display = 'block';
      bannerContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); color: #10b981; font-size: 12px; font-weight: 500;">
          <span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span>
          <span>Your dataset is perfectly clean! No empty values, duplicate rows, or formatting issues detected.</span>
        </div>
      `;
      return;
    }

    bannerContainer.className = 'cleaner-issues-banner warning';
    bannerContainer.style.display = 'block';

    let details = [];
    if (scan.emptyCount > 0) details.push(`<strong>${scan.emptyCount}</strong> empty cell${scan.emptyCount !== 1 ? 's' : ''}`);
    if (scan.dupCount > 0) details.push(`<strong>${scan.dupCount}</strong> duplicate row${scan.dupCount !== 1 ? 's' : ''}`);
    if (scan.emptyColCount > 0) details.push(`<strong>${scan.emptyColCount}</strong> empty column${scan.emptyColCount !== 1 ? 's' : ''}`);
    if (scan.untrimmedCount > 0) details.push(`<strong>${scan.untrimmedCount}</strong> untrimmed value${scan.untrimmedCount !== 1 ? 's' : ''}`);

    bannerContainer.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; background: rgba(234, 88, 12, 0.08); border: 1px solid rgba(234, 88, 12, 0.2); border-radius: var(--radius-md); color: #ea580c; font-size: 12px; line-height: 1.5;">
        <span class="material-symbols-outlined" style="font-size: 18px; margin-top: 1px; flex-shrink: 0;">report</span>
        <div style="flex: 1;">
          <span style="font-weight: 600; font-size: 13px;">Plotox Scanner found ${scan.totalIssues} cleanable issues!</span>
          <div style="margin-top: 4px; color: var(--color-secondary-text); font-size: 11px;">
            We detected: ${details.join(', ')}. Use the cleaning operations on the left sidebar to resolve them automatically.
          </div>
        </div>
      </div>
    `;
  }

  function showAdvancedCleanModal(op) {
    const ds = getActiveDataset();
    if (!ds) { showToast('No dataset loaded', 'error'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'cleaner-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '25000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.55)';
    overlay.style.backdropFilter = 'blur(8px)';

    const card = document.createElement('div');
    card.className = 'cleaner-modal-card';
    card.style.background = 'var(--color-surface)';
    card.style.border = '1px solid var(--color-border)';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.3)';
    card.style.padding = '24px';
    card.style.width = '90%';
    card.style.maxWidth = '460px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '16px';
    card.style.color = 'var(--color-primary)';
    card.style.fontFamily = 'var(--font-main)';

    let title = '';
    let bodyHtml = '';
    let applyAction = () => { };

    const colOptions = ds.headers.map(h => `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`).join('');

    switch (op) {
      case 'smart-fill-empty': {
        title = 'Smart Empty Cells Wizard';
        card.style.maxWidth = '550px'; // Make it slightly wider for the checklist grid

        // Find all columns with empty cells
        const emptyColsData = [];
        ds.headers.forEach((h, ci) => {
          let emptyCount = 0;
          ds.rows.forEach(r => {
            if (String(r[ci]).trim() === '') emptyCount++;
          });

          if (emptyCount > 0) {
            const colType = ds.types[h] || 'categorical';

            // Calculate statistical defaults
            let meanStr = '0.00';
            let medianStr = '0.00';
            let modeStr = '';

            // Calculate numeric stats if numeric
            const numericVals = ds.rows
              .map(r => parseFloat(String(r[ci]).replace(/[$,%]/g, '')))
              .filter(v => !isNaN(v));

            if (numericVals.length > 0) {
              const sum = numericVals.reduce((a, b) => a + b, 0);
              meanStr = (sum / numericVals.length).toFixed(2);

              numericVals.sort((a, b) => a - b);
              const mid = Math.floor(numericVals.length / 2);
              medianStr = numericVals.length % 2 !== 0 ? String(numericVals[mid]) : ((numericVals[mid - 1] + numericVals[mid]) / 2).toFixed(2);
            }

            // Calculate Mode
            const freqs = {};
            let maxFreq = 0;
            ds.rows.forEach(r => {
              const s = String(r[ci]).trim();
              if (s !== '') {
                freqs[s] = (freqs[s] || 0) + 1;
                if (freqs[s] > maxFreq) {
                  maxFreq = freqs[s];
                  modeStr = s;
                }
              }
            });

            emptyColsData.push({
              header: h,
              index: ci,
              count: emptyCount,
              type: colType,
              mean: meanStr,
              median: medianStr,
              mode: modeStr || 'N/A'
            });
          }
        });

        if (emptyColsData.length === 0) {
          bodyHtml = `
            <div style="text-align: center; padding: 20px 10px;">
              <span class="material-symbols-outlined" style="font-size: 48px; color: #10b981; margin-bottom: 12px;">check_circle</span>
              <p style="font-size: 13px; font-weight: 500;">No empty cells detected in this dataset!</p>
            </div>
          `;
          applyAction = () => { };
          break;
        }

        bodyHtml = `
          <div style="font-size:12px; color: var(--color-secondary-text); margin-bottom: 12px;">
            Plotox scanned your columns and detected missing values in the following columns. Customize the fill strategy for each column below:
          </div>
          <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 4px; display:flex; flex-direction:column; gap:8px; background: var(--color-surface-low);">
        `;

        emptyColsData.forEach((col, idx) => {
          let selectOptions = '';
          if (col.type === 'numeric') {
            selectOptions = `
              <option value="mean" data-val="${col.mean}">Mean (Avg: ${col.mean})</option>
              <option value="median" data-val="${col.median}">Median (${col.median})</option>
              <option value="zero" data-val="0">Zero (0)</option>
              <option value="custom">Custom...</option>
            `;
          } else if (col.type === 'datetime') {
            const todayStr = new Date().toISOString().split('T')[0];
            selectOptions = `
              <option value="today" data-val="${todayStr}">Today's Date (${todayStr})</option>
              <option value="custom">Custom Date...</option>
            `;
          } else {
            selectOptions = `
              <option value="mode" data-val="${col.mode}">Mode (Most common: "${col.mode}")</option>
              <option value="unknown" data-val="Unknown">"Unknown"</option>
              <option value="custom">Custom...</option>
            `;
          }

          bodyHtml += `
            <div class="smart-fill-row" data-col-index="${col.index}" data-col-type="${col.type}" style="display: grid; grid-template-columns: 24px 140px 100px 1fr; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--color-border); font-size:11px;">
              <input type="checkbox" checked class="smart-fill-checkbox" style="width: auto; cursor:pointer;">
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(col.header)}">${escapeHTML(col.header)} <span style="font-weight:normal; color: var(--color-outline);">(${col.count} blank)</span></div>
              <div style="text-transform: capitalize; color: var(--color-outline); font-size:10px;">${col.type}</div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <select class="cleaner-form-select smart-fill-select" style="padding: 4px 8px; font-size: 11px; height: auto;">
                  ${selectOptions}
                </select>
                <input type="text" class="cleaner-form-input smart-fill-input" placeholder="Value..." style="display:none; padding: 4px 8px; font-size: 11px; margin-top:2px;">
              </div>
            </div>
          `;
        });

        bodyHtml += `</div>`;

        applyAction = (modal) => {
          pushUndo();
          let changes = 0;

          const rows = modal.querySelectorAll('.smart-fill-row');
          rows.forEach(row => {
            const checked = row.querySelector('.smart-fill-checkbox').checked;
            if (!checked) return;

            const ci = parseInt(row.dataset.colIndex);
            const selectEl = row.querySelector('.smart-fill-select');
            const strategy = selectEl.value;
            const inputEl = row.querySelector('.smart-fill-input');

            let fillVal = '';

            if (strategy === 'custom') {
              fillVal = inputEl.value.trim();
            } else {
              const selectedOption = selectEl.options[selectEl.selectedIndex];
              fillVal = selectedOption.dataset.val || '';
            }

            ds.rows.forEach(r => {
              if (String(r[ci]).trim() === '') {
                r[ci] = fillVal;
                changes++;
              }
            });
          });

          finalizeCleanOp(changes, `Smart filled missing cells across columns`);
        };
        break;
      }
      case 'impute-missing':
        title = 'Fill Missing Values';
        bodyHtml = `
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Select Column</label>
            <select class="cleaner-form-select" id="adv-impute-col" style="width:100%; margin-bottom: 12px;">${colOptions}</select>
          </div>
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Imputation Strategy</label>
            <select class="cleaner-form-select" id="adv-impute-strategy" style="width:100%; margin-bottom: 12px;">
              <option value="mean">Mean (Average) - Numeric only</option>
              <option value="median">Median - Numeric only</option>
              <option value="mode">Mode (Most frequent value)</option>
              <option value="custom">Custom Text / Value</option>
            </select>
          </div>
          <div class="cleaner-form-group" id="adv-impute-custom-group" style="display:none;">
            <label class="cleaner-form-label">Custom Replacement Value</label>
            <input type="text" class="cleaner-form-input" id="adv-impute-custom-val" placeholder="Type value..." style="width:100%;">
          </div>
        `;
        applyAction = (modal) => {
          const col = modal.querySelector('#adv-impute-col').value;
          const strategy = modal.querySelector('#adv-impute-strategy').value;
          const customVal = modal.querySelector('#adv-impute-custom-val').value.trim();
          const ci = ds.headers.indexOf(col);
          if (ci === -1) return;

          pushUndo();
          let changes = 0;

          if (strategy === 'custom') {
            ds.rows.forEach(r => {
              if (String(r[ci]).trim() === '') {
                r[ci] = customVal;
                changes++;
              }
            });
          } else {
            // Calculate statistical strategy
            const numericVals = ds.rows
              .map(r => parseFloat(String(r[ci]).replace(/[$,%]/g, '')))
              .filter(v => !isNaN(v));

            if (strategy === 'mean' || strategy === 'median') {
              if (numericVals.length === 0) {
                showToast('No numeric values in this column for Mean/Median', 'error');
                return;
              }
              let fillVal;
              if (strategy === 'mean') {
                fillVal = (numericVals.reduce((a, b) => a + b, 0) / numericVals.length).toFixed(2);
              } else {
                numericVals.sort((a, b) => a - b);
                const mid = Math.floor(numericVals.length / 2);
                fillVal = numericVals.length % 2 !== 0 ? numericVals[mid] : ((numericVals[mid - 1] + numericVals[mid]) / 2).toFixed(2);
              }
              ds.rows.forEach(r => {
                if (String(r[ci]).trim() === '') {
                  r[ci] = String(fillVal);
                  changes++;
                }
              });
            } else if (strategy === 'mode') {
              const freqs = {};
              let modeVal = '';
              let maxFreq = 0;
              ds.rows.forEach(r => {
                const s = String(r[ci]).trim();
                if (s !== '') {
                  freqs[s] = (freqs[s] || 0) + 1;
                  if (freqs[s] > maxFreq) {
                    maxFreq = freqs[s];
                    modeVal = s;
                  }
                }
              });
              if (maxFreq > 0) {
                ds.rows.forEach(r => {
                  if (String(r[ci]).trim() === '') {
                    r[ci] = modeVal;
                    changes++;
                  }
                });
              }
            }
          }

          finalizeCleanOp(changes, `Filled missing values in "${col}"`);
        };
        break;

      case 'find-replace':
        title = 'Find & Replace';
        bodyHtml = `
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Target Column</label>
            <select class="cleaner-form-select" id="adv-replace-col" style="width:100%; margin-bottom: 12px;">
              <option value="_all_">All Columns</option>
              ${colOptions}
            </select>
          </div>
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Find Value</label>
            <input type="text" class="cleaner-form-input" id="adv-replace-find" placeholder="Text to search..." style="width:100%; margin-bottom: 12px;">
          </div>
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Replace With</label>
            <input type="text" class="cleaner-form-input" id="adv-replace-with" placeholder="Replacement text..." style="width:100%; margin-bottom: 12px;">
          </div>
          <div class="cleaner-form-group" style="display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="adv-replace-exact" style="width:auto;">
            <label class="cleaner-form-label" for="adv-replace-exact" style="margin: 0; text-transform:none; letter-spacing:normal;">Match exact cell value</label>
          </div>
        `;
        applyAction = (modal) => {
          const col = modal.querySelector('#adv-replace-col').value;
          const findVal = modal.querySelector('#adv-replace-find').value;
          const replaceWith = modal.querySelector('#adv-replace-with').value;
          const exact = modal.querySelector('#adv-replace-exact').checked;

          pushUndo();
          let changes = 0;

          ds.rows.forEach(r => {
            r.forEach((c, ci) => {
              if (col !== '_all_' && ds.headers[ci] !== col) return;
              const s = String(c);
              if (exact) {
                if (s === findVal) {
                  r[ci] = replaceWith;
                  changes++;
                }
              } else {
                if (s.includes(findVal)) {
                  r[ci] = s.split(findVal).join(replaceWith);
                  changes++;
                }
              }
            });
          });

          finalizeCleanOp(changes, `Replaced instances of "${findVal}" with "${replaceWith}"`);
        };
        break;

      case 'remove-outliers':
        title = 'Remove Outliers (IQR)';
        bodyHtml = `
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Numeric Column</label>
            <select class="cleaner-form-select" id="adv-outliers-col" style="width:100%; margin-bottom: 12px;">${colOptions}</select>
          </div>
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Outlier Factor (IQR Coefficient)</label>
            <select class="cleaner-form-select" id="adv-outliers-coef" style="width:100%;">
              <option value="1.5">1.5 × IQR (Standard outlier threshold)</option>
              <option value="3.0">3.0 × IQR (Extreme outlier threshold)</option>
            </select>
          </div>
        `;
        applyAction = (modal) => {
          const col = modal.querySelector('#adv-outliers-col').value;
          const coef = parseFloat(modal.querySelector('#adv-outliers-coef').value) || 1.5;
          const ci = ds.headers.indexOf(col);
          if (ci === -1) return;

          const numericVals = ds.rows
            .map(r => parseFloat(String(r[ci]).replace(/[$,%]/g, '')))
            .filter(v => !isNaN(v));

          if (numericVals.length < 4) {
            showToast('Not enough numeric data for IQR outlier calculation', 'error');
            return;
          }

          numericVals.sort((a, b) => a - b);
          const q1Idx = Math.floor(numericVals.length * 0.25);
          const q3Idx = Math.floor(numericVals.length * 0.75);
          const q1 = numericVals[q1Idx];
          const q3 = numericVals[q3Idx];
          const iqr = q3 - q1;
          const lowerBound = q1 - coef * iqr;
          const upperBound = q3 + coef * iqr;

          pushUndo();
          const before = ds.rows.length;
          ds.rows = ds.rows.filter(r => {
            const v = parseFloat(String(r[ci]).replace(/[$,%]/g, ''));
            if (isNaN(v)) return true;
            return v >= lowerBound && v <= upperBound;
          });

          const changes = before - ds.rows.length;
          finalizeCleanOp(changes, `Removed ${changes} outlier rows in "${col}"`);
        };
        break;

      case 'convert-types':
        title = 'Convert Column Data Types';
        bodyHtml = `
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Column to Convert</label>
            <select class="cleaner-form-select" id="adv-cast-col" style="width:100%; margin-bottom: 12px;">${colOptions}</select>
          </div>
          <div class="cleaner-form-group">
            <label class="cleaner-form-label">Target Data Type</label>
            <select class="cleaner-form-select" id="adv-cast-type" style="width:100%;">
              <option value="numeric">Numeric (Standardize numbers/currencies)</option>
              <option value="categorical">Categorical / Text</option>
              <option value="datetime">DateTime (Format as ISO dates)</option>
            </select>
          </div>
        `;
        applyAction = (modal) => {
          const col = modal.querySelector('#adv-cast-col').value;
          const targetType = modal.querySelector('#adv-cast-type').value;
          const ci = ds.headers.indexOf(col);
          if (ci === -1) return;

          pushUndo();
          let changes = 0;

          ds.types[col] = targetType;

          if (targetType === 'numeric') {
            ds.rows.forEach(r => {
              const val = String(r[ci]).trim();
              if (val) {
                const numeric = parseFloat(val.replace(/[^\d.-]/g, ''));
                if (!isNaN(numeric)) {
                  const s = String(numeric);
                  if (s !== val) {
                    r[ci] = s;
                    changes++;
                  }
                }
              }
            });
          } else if (targetType === 'datetime') {
            ds.rows.forEach(r => {
              const val = String(r[ci]).trim();
              if (val) {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                  const iso = d.toISOString().split('T')[0];
                  if (iso !== val) {
                    r[ci] = iso;
                    changes++;
                  }
                }
              }
            });
          } else {
            showToast(`Column "${col}" casted to categorical text`, 'info');
          }

          finalizeCleanOp(changes, `Converted "${col}" to ${targetType}`);
        };
        break;
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
        <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 700;">${title}</span>
        <button id="adv-modal-close" style="background:none; border:none; color:var(--color-outline); cursor:pointer; font-size: 20px;">&times;</button>
      </div>
      <div style="flex: 1; display:flex; flex-direction:column; gap:12px; margin: 10px 0;">
        ${bodyHtml}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; border-top: 1px solid var(--color-border); padding-top: 12px;">
        <button id="adv-modal-cancel" style="background:var(--color-surface-low); color:var(--color-primary); border:1px solid var(--color-border); border-radius:50px; padding: 6px 16px; font-size:12px; font-weight:600; cursor:pointer;">Cancel</button>
        <button id="adv-modal-apply" style="background:var(--color-primary); color:var(--color-on-primary); border:none; border-radius:50px; padding: 6px 16px; font-size:12px; font-weight:600; cursor:pointer;">Apply Changes</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const closeBtn = card.querySelector('#adv-modal-close');
    const cancelBtn = card.querySelector('#adv-modal-cancel');
    const applyBtn = card.querySelector('#adv-modal-apply');

    const closeModal = () => { overlay.style.animation = 'cleanerFadeIn 0.2s ease reverse forwards'; setTimeout(() => overlay.remove(), 200); };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    applyBtn.addEventListener('click', () => {
      applyAction(card);
      closeModal();
    });

    const strategySelect = card.querySelector('#adv-impute-strategy');
    const customGroup = card.querySelector('#adv-impute-custom-group');
    if (strategySelect && customGroup) {
      strategySelect.addEventListener('change', () => {
        customGroup.style.display = strategySelect.value === 'custom' ? 'block' : 'none';
      });
    }

    const smartFillRows = card.querySelectorAll('.smart-fill-row');
    smartFillRows.forEach(row => {
      const select = row.querySelector('.smart-fill-select');
      const input = row.querySelector('.smart-fill-input');
      if (select && input) {
        select.addEventListener('change', () => {
          input.style.display = select.value === 'custom' ? 'block' : 'none';
        });
      }
    });
  }

  function finalizeCleanOp(changes, msg) {
    const ds = getActiveDataset();
    if (!ds) return;
    ds.lastModified = new Date().toISOString();
    renderAll();
    saveToStorage();
    showToast(`${changes} change${changes !== 1 ? 's' : ''} applied: ${msg}`);

    const changeBadge = document.getElementById('cleaner-change-badge');
    if (changeBadge) {
      changeBadge.textContent = `${changes} changes`;
      changeBadge.style.display = changes > 0 ? 'inline-flex' : 'none';
    }
    renderCleanPreview(ds);
  }

  function applyCleanOp(op) {
    const ds = getActiveDataset();
    if (!ds) { showToast('No dataset loaded', 'error'); return; }

    pushUndo();
    let changes = 0;

    switch (op) {
      case 'remove-empty-rows': {
        const before = ds.rows.length;
        ds.rows = ds.rows.filter(r => !r.every(c => String(c).trim() === ''));
        changes = before - ds.rows.length;
        break;
      }
      case 'remove-duplicates': {
        const seen = new Set();
        const unique = [];
        ds.rows.forEach(r => {
          const key = r.join('|||');
          if (!seen.has(key)) { seen.add(key); unique.push(r); }
        });
        changes = ds.rows.length - unique.length;
        ds.rows = unique;
        break;
      }
      case 'remove-empty-cols': {
        const emptyCols = [];
        ds.headers.forEach((_, ci) => {
          if (ds.rows.every(r => String(r[ci] || '').trim() === '')) emptyCols.push(ci);
        });
        changes = emptyCols.length;
        if (emptyCols.length > 0) {
          const keep = ds.headers.map((_, i) => i).filter(i => !emptyCols.includes(i));
          ds.headers = keep.map(i => ds.headers[i]);
          ds.rows = ds.rows.map(r => keep.map(i => r[i]));
          // Rebuild types
          const newTypes = {};
          ds.headers.forEach(h => { if (ds.types[h]) newTypes[h] = ds.types[h]; });
          ds.types = newTypes;
        }
        break;
      }
      case 'trim-spaces': {
        ds.rows.forEach(r => {
          r.forEach((c, ci) => {
            const trimmed = String(c).trim();
            if (trimmed !== String(c)) { r[ci] = trimmed; changes++; }
          });
        });
        // Also trim headers
        ds.headers = ds.headers.map(h => {
          const trimmed = h.trim();
          if (trimmed !== h) changes++;
          return trimmed;
        });
        break;
      }
      case 'normalize-text': {
        ds.rows.forEach(r => {
          r.forEach((c, ci) => {
            const normalized = String(c).replace(/\s+/g, ' ').trim();
            if (normalized !== String(c)) { r[ci] = normalized; changes++; }
          });
        });
        break;
      }
      case 'fix-formatting': {
        // Title case for text columns
        ds.headers.forEach((h, ci) => {
          if (ds.types[h] === 'categorical') {
            ds.rows.forEach(r => {
              const val = String(r[ci]).trim();
              if (val) {
                const fixed = val.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
                if (fixed !== val) { r[ci] = fixed; changes++; }
              }
            });
          }
        });
        break;
      }
      case 'standardize-dates': {
        ds.headers.forEach((h, ci) => {
          if (ds.types[h] === 'datetime') {
            ds.rows.forEach(r => {
              const val = String(r[ci]).trim();
              if (val) {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                  const iso = d.toISOString().split('T')[0];
                  if (iso !== val) { r[ci] = iso; changes++; }
                }
              }
            });
          }
        });
        break;
      }
      case 'remove-rows-with-empty': {
        const before = ds.rows.length;
        ds.rows = ds.rows.filter(r => !r.some(c => String(c).trim() === ''));
        changes = before - ds.rows.length;
        break;
      }
      case 'fill-empty-na': {
        ds.rows.forEach(r => {
          r.forEach((c, ci) => {
            if (String(c).trim() === '') {
              r[ci] = 'N/A';
              changes++;
            }
          });
        });
        break;
      }
    }

    ds.lastModified = new Date().toISOString();
    renderAll();
    saveToStorage();
    showToast(`${changes} change${changes !== 1 ? 's' : ''} applied`);

    // Show badge
    if (changeBadge) {
      changeBadge.textContent = `${changes} changes`;
      changeBadge.style.display = changes > 0 ? 'inline-flex' : 'none';
    }

    // Update clean grid preview
    renderCleanPreview(ds);
  }

  function renderCleanPreview(ds) {
    if (!cleanGrid) return;
    if (!ds || ds.rows.length === 0) {
      cleanGrid.innerHTML = '';
      cleanGrid.appendChild(createEmptyState('cleaning_services', 'No Data', 'Load a dataset first.'));
      const changeBadge = document.getElementById('cleaner-change-badge');
      if (changeBadge) changeBadge.style.display = 'none';
      return;
    }
    // Show first 20 rows as preview
    let html = '<table class="cleaner-table"><thead><tr>';
    html += '<th class="row-num-col">#</th>';
    ds.headers.forEach(h => { html += `<th>${escapeHTML(h)}</th>`; });
    html += '</tr></thead><tbody>';
    const previewRows = ds.rows.slice(0, 20);
    previewRows.forEach((row, ri) => {
      html += '<tr>';
      html += `<td class="row-num-cell">${ri + 1}</td>`;
      row.forEach(cell => {
        html += `<td>${escapeHTML(String(cell))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    cleanGrid.innerHTML = html;
  }

  // ═══════════════════════════════════════════
  //  TRANSFORM OPERATIONS
  // ═══════════════════════════════════════════
  function showTransformForm(type) {
    const ds = getActiveDataset();
    if (!ds) { showToast('No dataset loaded', 'error'); return; }
    cleanerState.activeTransform = type;

    let html = '';
    const options = ds.headers.map(h => `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`).join('');

    switch (type) {
      case 'rename':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Rename Columns</h3>`;
        ds.headers.forEach((h, i) => {
          html += `<div class="cleaner-form-group"><label class="cleaner-form-label">${escapeHTML(h)}</label><input class="cleaner-form-input" data-rename-idx="${i}" value="${escapeHTML(h)}" placeholder="New name..."></div>`;
        });
        html += `<button class="cleaner-form-apply-btn" id="apply-rename"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Rename</button>`;
        break;
      case 'merge':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Merge Columns</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">First Column</label><select class="cleaner-form-select" id="merge-col1">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Second Column</label><select class="cleaner-form-select" id="merge-col2">${ds.headers.length > 1 ? ds.headers.slice(1).map(h => `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`).join('') : options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Separator</label><input class="cleaner-form-input" id="merge-sep" value=" " placeholder="e.g. space, comma..."></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">New Column Name</label><input class="cleaner-form-input" id="merge-name" value="Merged" placeholder="Name for merged column..."></div>
          <button class="cleaner-form-apply-btn" id="apply-merge"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Merge</button>`;
        break;
      case 'split':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Split Column</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Column to Split</label><select class="cleaner-form-select" id="split-col">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Delimiter</label><input class="cleaner-form-input" id="split-delim" value="," placeholder="e.g. comma, space, dash..."></div>
          <button class="cleaner-form-apply-btn" id="apply-split"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Split</button>`;
        break;
      case 'sort':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Sort Dataset</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Sort By Column</label><select class="cleaner-form-select" id="sort-col">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Direction</label><select class="cleaner-form-select" id="sort-dir"><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
          <button class="cleaner-form-apply-btn" id="apply-sort"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Sort</button>`;
        break;
      case 'filter':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Filter Rows</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Filter Column</label><select class="cleaner-form-select" id="filter-col">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Condition</label><select class="cleaner-form-select" id="filter-cond"><option value="contains">Contains</option><option value="equals">Equals</option><option value="not-empty">Not Empty</option><option value="gt">Greater Than</option><option value="lt">Less Than</option></select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Value</label><input class="cleaner-form-input" id="filter-val" placeholder="Filter value..."></div>
          <button class="cleaner-form-apply-btn" id="apply-filter"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Filter</button>`;
        break;
      case 'group':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Group By</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Group By Column</label><select class="cleaner-form-select" id="group-col">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Aggregate Column</label><select class="cleaner-form-select" id="group-agg-col">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Aggregate Function</label><select class="cleaner-form-select" id="group-fn"><option value="count">Count</option><option value="sum">Sum</option><option value="avg">Average</option><option value="min">Min</option><option value="max">Max</option></select></div>
          <button class="cleaner-form-apply-btn" id="apply-group"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply Group By</button>`;
        break;
      case 'calculated':
        html = `<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; margin-bottom: 16px;">Calculated Field</h3>
          <div class="cleaner-form-group"><label class="cleaner-form-label">New Column Name</label><input class="cleaner-form-input" id="calc-name" placeholder="e.g. Total, Ratio..." value="Calculated"></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Column A</label><select class="cleaner-form-select" id="calc-col-a">${options}</select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Operation</label><select class="cleaner-form-select" id="calc-op"><option value="+">Add (+)</option><option value="-">Subtract (−)</option><option value="*">Multiply (×)</option><option value="/">Divide (÷)</option></select></div>
          <div class="cleaner-form-group"><label class="cleaner-form-label">Column B</label><select class="cleaner-form-select" id="calc-col-b">${ds.headers.length > 1 ? ds.headers.slice(1).map(h => `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`).join('') : options}</select></div>
          <button class="cleaner-form-apply-btn" id="apply-calculated"><span class="material-symbols-outlined" style="font-size:14px;">check</span> Apply</button>`;
        break;
    }

    transformForm.innerHTML = html;

    // Wire up apply buttons
    const applyRename = document.getElementById('apply-rename');
    if (applyRename) applyRename.addEventListener('click', () => applyTransform('rename'));
    const applyMerge = document.getElementById('apply-merge');
    if (applyMerge) applyMerge.addEventListener('click', () => applyTransform('merge'));
    const applySplit = document.getElementById('apply-split');
    if (applySplit) applySplit.addEventListener('click', () => applyTransform('split'));
    const applySort = document.getElementById('apply-sort');
    if (applySort) applySort.addEventListener('click', () => applyTransform('sort'));
    const applyFilter = document.getElementById('apply-filter');
    if (applyFilter) applyFilter.addEventListener('click', () => applyTransform('filter'));
    const applyGroup = document.getElementById('apply-group');
    if (applyGroup) applyGroup.addEventListener('click', () => applyTransform('group'));
    const applyCalc = document.getElementById('apply-calculated');
    if (applyCalc) applyCalc.addEventListener('click', () => applyTransform('calculated'));
  }

  function applyTransform(type) {
    const ds = getActiveDataset();
    if (!ds) return;
    pushUndo();

    switch (type) {
      case 'rename': {
        const inputs = transformForm.querySelectorAll('[data-rename-idx]');
        inputs.forEach(inp => {
          const idx = parseInt(inp.dataset.renameIdx);
          const newName = inp.value.trim();
          if (newName && newName !== ds.headers[idx]) {
            const oldName = ds.headers[idx];
            ds.headers[idx] = newName;
            if (ds.types[oldName]) { ds.types[newName] = ds.types[oldName]; delete ds.types[oldName]; }
          }
        });
        showToast('Columns renamed');
        break;
      }
      case 'merge': {
        const col1 = document.getElementById('merge-col1').value;
        const col2 = document.getElementById('merge-col2').value;
        const sep = document.getElementById('merge-sep').value;
        const name = document.getElementById('merge-name').value.trim() || 'Merged';
        const i1 = ds.headers.indexOf(col1);
        const i2 = ds.headers.indexOf(col2);
        if (i1 === -1 || i2 === -1) { showToast('Invalid columns', 'error'); return; }
        ds.headers.push(name);
        ds.types[name] = 'categorical';
        ds.rows.forEach(r => {
          r.push(String(r[i1] || '') + sep + String(r[i2] || ''));
        });
        showToast(`Merged "${col1}" + "${col2}" → "${name}"`);
        break;
      }
      case 'split': {
        const col = document.getElementById('split-col').value;
        const delim = document.getElementById('split-delim').value || ',';
        const ci = ds.headers.indexOf(col);
        if (ci === -1) { showToast('Invalid column', 'error'); return; }
        // Find max splits
        let maxParts = 0;
        ds.rows.forEach(r => {
          const parts = String(r[ci] || '').split(delim);
          maxParts = Math.max(maxParts, parts.length);
        });
        if (maxParts <= 1) { showToast('No splits found with that delimiter', 'info'); return; }
        // Add new columns
        for (let p = 0; p < maxParts; p++) {
          ds.headers.push(`${col}_${p + 1}`);
          ds.types[`${col}_${p + 1}`] = 'categorical';
        }
        ds.rows.forEach(r => {
          const parts = String(r[ci] || '').split(delim);
          for (let p = 0; p < maxParts; p++) {
            r.push((parts[p] || '').trim());
          }
        });
        showToast(`Split "${col}" into ${maxParts} columns`);
        break;
      }
      case 'sort': {
        const col = document.getElementById('sort-col').value;
        const dir = document.getElementById('sort-dir').value;
        const ci = ds.headers.indexOf(col);
        if (ci === -1) return;
        const isNum = ds.types[col] === 'numeric';
        const mult = dir === 'asc' ? 1 : -1;
        ds.rows.sort((a, b) => {
          let va = a[ci] || '';
          let vb = b[ci] || '';
          if (isNum) {
            va = parseFloat(String(va).replace(/[$,%]/g, '')) || 0;
            vb = parseFloat(String(vb).replace(/[$,%]/g, '')) || 0;
            return (va - vb) * mult;
          }
          return String(va).localeCompare(String(vb)) * mult;
        });
        showToast(`Sorted by "${col}" ${dir}`);
        break;
      }
      case 'filter': {
        const col = document.getElementById('filter-col').value;
        const cond = document.getElementById('filter-cond').value;
        const val = document.getElementById('filter-val').value;
        const ci = ds.headers.indexOf(col);
        if (ci === -1) return;
        const before = ds.rows.length;
        ds.rows = ds.rows.filter(r => {
          const cv = String(r[ci] || '');
          switch (cond) {
            case 'contains': return cv.toLowerCase().includes(val.toLowerCase());
            case 'equals': return cv === val;
            case 'not-empty': return cv.trim() !== '';
            case 'gt': return parseFloat(cv.replace(/[$,%]/g, '')) > parseFloat(val);
            case 'lt': return parseFloat(cv.replace(/[$,%]/g, '')) < parseFloat(val);
            default: return true;
          }
        });
        showToast(`Filtered: ${before - ds.rows.length} rows removed`);
        break;
      }
      case 'group': {
        const groupCol = document.getElementById('group-col').value;
        const aggCol = document.getElementById('group-agg-col').value;
        const fn = document.getElementById('group-fn').value;
        const gci = ds.headers.indexOf(groupCol);
        const aci = ds.headers.indexOf(aggCol);
        if (gci === -1 || aci === -1) return;

        const groups = {};
        ds.rows.forEach(r => {
          const key = String(r[gci] || '').trim();
          if (!groups[key]) groups[key] = [];
          groups[key].push(r[aci]);
        });

        const newHeaders = [groupCol, `${fn}(${aggCol})`];
        const newRows = [];
        for (const key in groups) {
          const vals = groups[key].map(v => parseFloat(String(v).replace(/[$,%]/g, '')) || 0);
          let result;
          switch (fn) {
            case 'count': result = groups[key].length; break;
            case 'sum': result = vals.reduce((a, b) => a + b, 0); break;
            case 'avg': result = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2); break;
            case 'min': result = Math.min(...vals); break;
            case 'max': result = Math.max(...vals); break;
          }
          newRows.push([key, String(result)]);
        }
        ds.headers = newHeaders;
        ds.rows = newRows;
        ds.types = {};
        ds.types[newHeaders[0]] = 'categorical';
        ds.types[newHeaders[1]] = 'numeric';
        showToast(`Grouped by "${groupCol}" with ${fn}(${aggCol})`);
        break;
      }
      case 'calculated': {
        const name = document.getElementById('calc-name').value.trim() || 'Calculated';
        const colA = document.getElementById('calc-col-a').value;
        const colB = document.getElementById('calc-col-b').value;
        const op = document.getElementById('calc-op').value;
        const ai = ds.headers.indexOf(colA);
        const bi = ds.headers.indexOf(colB);
        if (ai === -1 || bi === -1) return;
        ds.headers.push(name);
        ds.types[name] = 'numeric';
        ds.rows.forEach(r => {
          const va = parseFloat(String(r[ai] || '0').replace(/[$,%]/g, '')) || 0;
          const vb = parseFloat(String(r[bi] || '0').replace(/[$,%]/g, '')) || 0;
          let result;
          switch (op) {
            case '+': result = va + vb; break;
            case '-': result = va - vb; break;
            case '*': result = va * vb; break;
            case '/': result = vb !== 0 ? (va / vb).toFixed(4) : 'N/A'; break;
          }
          r.push(String(result));
        });
        showToast(`Added calculated field "${name}"`);
        break;
      }
    }

    ds.lastModified = new Date().toISOString();
    renderAll();
    saveToStorage();
  }

  function renderTransform() {
    if (!transformForm) return;
    const ds = getActiveDataset();
    if (!ds) {
      transformForm.innerHTML = '';
      transformForm.appendChild(createEmptyState('transform', 'Select a Transform', 'Choose a transformation from the left panel to modify your dataset structure.'));
      cleanerState.activeTransform = null;
    }
  }

  // ═══════════════════════════════════════════
  //  VALIDATION TAB
  // ═══════════════════════════════════════════
  function renderValidation() {
    const ds = getActiveDataset();
    if (!validationContainer) return;
    if (!ds) {
      validationContainer.innerHTML = '';
      validationContainer.appendChild(createEmptyState('verified', 'No Data to Validate', 'Upload a dataset to see data quality metrics.'));
      return;
    }
    if (ds.rows.length === 0) {
      validationContainer.innerHTML = '';
      validationContainer.appendChild(createEmptyState('verified', 'No Data to Validate', 'Upload a dataset to see data quality metrics.'));
      return;
    }

    const totalRows = ds.rows.length;
    const totalCols = ds.headers.length;
    const totalCells = totalRows * totalCols;

    // Empty values
    let emptyCount = 0;
    ds.rows.forEach(r => r.forEach(c => { if (String(c).trim() === '') emptyCount++; }));

    // Duplicate rows
    const seen = new Set();
    let dupCount = 0;
    ds.rows.forEach(r => {
      const key = r.join('|||');
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    });

    // Invalid records (rows with any empty)
    let invalidCount = 0;
    ds.rows.forEach(r => { if (r.some(c => String(c).trim() === '')) invalidCount++; });

    // Health Score (100 - penalties)
    const emptyPenalty = totalCells > 0 ? (emptyCount / totalCells) * 40 : 0;
    const dupPenalty = totalRows > 0 ? (dupCount / totalRows) * 30 : 0;
    const invalidPenalty = totalRows > 0 ? (invalidCount / totalRows) * 30 : 0;
    const score = Math.max(0, Math.round(100 - emptyPenalty - dupPenalty - invalidPenalty));

    // Gauge color
    let gaugeColor = '#10b981'; // green
    if (score < 50) gaugeColor = '#dc2626'; // red
    else if (score < 75) gaugeColor = '#ea580c'; // orange

    const circumference = 2 * Math.PI * 72;
    const dashOffset = circumference - (score / 100) * circumference;

    const feedbackText = score >= 90 ? 'Excellent dataset health! Fully optimized and ready for perfect visualization.' : score >= 75 ? 'Good dataset health with minor issues. We recommend cleaning empty values or duplicates for the best chart results.' : 'Low dataset health score! We strongly recommend applying rows, text, or date cleaning operations.';

    validationContainer.innerHTML = `
      <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 600; margin-bottom: 20px; color: var(--color-primary);">Data Quality & Health Report</h3>
      <div class="cleaner-validation-layout">
        <div class="cleaner-health-card">
          <div class="cleaner-health-title" style="font-size: 13px; font-weight: 600; color: var(--color-outline); text-transform: uppercase; letter-spacing: 0.05em;">Quality Score</div>
          <div class="cleaner-health-gauge">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle class="gauge-bg" cx="90" cy="90" r="72"/>
              <circle class="gauge-fill" cx="90" cy="90" r="72" stroke="${gaugeColor}" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"/>
            </svg>
            <div class="gauge-text">
              <div class="cleaner-health-score-value" style="color: ${gaugeColor};">${score}</div>
              <div class="cleaner-health-score-label">/ 100</div>
            </div>
          </div>
          <div class="cleaner-health-feedback" style="font-size: 12px; text-align: center; color: var(--color-secondary-text); font-weight: 500; line-height: 1.5; padding: 0 8px;">
            ${feedbackText}
          </div>
        </div>

        <div class="cleaner-validation-grid">
          <div class="cleaner-metric-card">
            <span class="cleaner-metric-label">Total Rows</span>
            <span class="cleaner-metric-value">${totalRows.toLocaleString()}</span>
            <span class="cleaner-metric-sub">Total records parsed</span>
          </div>
          <div class="cleaner-metric-card">
            <span class="cleaner-metric-label">Total Columns</span>
            <span class="cleaner-metric-value">${totalCols}</span>
            <span class="cleaner-metric-sub">Data parameters</span>
          </div>
          <div class="cleaner-metric-card">
            <span class="cleaner-metric-label">Empty Values</span>
            <span class="cleaner-metric-value" style="${emptyCount > 0 ? 'color: var(--color-error);' : ''}">${emptyCount.toLocaleString()}</span>
            <span class="cleaner-metric-sub">${totalCells > 0 ? ((emptyCount / totalCells) * 100).toFixed(1) : 0}% of all cells</span>
          </div>
          <div class="cleaner-metric-card">
            <span class="cleaner-metric-label">Duplicate Rows</span>
            <span class="cleaner-metric-value" style="${dupCount > 0 ? 'color: var(--color-orange);' : ''}">${dupCount}</span>
            <span class="cleaner-metric-sub">${totalRows > 0 ? ((dupCount / totalRows) * 100).toFixed(1) : 0}% of rows</span>
          </div>
          <div class="cleaner-metric-card">
            <span class="cleaner-metric-label">Invalid Records</span>
            <span class="cleaner-metric-value" style="${invalidCount > 0 ? 'color: var(--color-error);' : ''}">${invalidCount}</span>
            <span class="cleaner-metric-sub">Rows with empty fields</span>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════
  function exportDataset(format) {
    const ds = getActiveDataset();
    if (!ds) { showToast('No dataset to export', 'error'); return; }

    let blob, filename;

    switch (format) {
      case 'csv': {
        const lines = [ds.headers.join(',')];
        ds.rows.forEach(r => {
          lines.push(r.map(c => {
            const s = String(c);
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(','));
        });
        blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        filename = ds.name.replace(/\.\w+$/, '') + '_cleaned.csv';
        break;
      }
      case 'json': {
        const jsonData = ds.rows.map(r => {
          const obj = {};
          ds.headers.forEach((h, i) => { obj[h] = r[i]; });
          return obj;
        });
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        filename = ds.name.replace(/\.\w+$/, '') + '_cleaned.json';
        break;
      }
      case 'xlsx': {
        if (typeof XLSX === 'undefined') { showToast('Excel export requires SheetJS', 'error'); return; }
        const wsData = [ds.headers, ...ds.rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cleaned Data');
        XLSX.writeFile(wb, ds.name.replace(/\.\w+$/, '') + '_cleaned.xlsx');
        showToast('XLSX exported');
        return;
      }
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported as ${format.toUpperCase()}`);
    }
  }

  // ═══════════════════════════════════════════
  //  GENERATE CHART INTEGRATION
  // ═══════════════════════════════════════════
  function generateChartFromCleaner() {
    const ds = getActiveDataset();
    if (!ds) { showToast('No dataset loaded', 'error'); return; }

    // Build CSV text from current state
    const lines = [ds.headers.join(',')];
    ds.rows.forEach(r => {
      lines.push(r.map(c => {
        const s = String(c);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    });
    const csvText = lines.join('\n');

    // Store to sessionStorage for chart workspace pickup
    try {
      sessionStorage.setItem('plotox-cleaner-csv', csvText);
      sessionStorage.setItem('plotox-cleaner-filename', ds.name);
      sessionStorage.setItem('plotox-cleaner-pending', 'true'); // Set pending flag for chart selection modal
    } catch (e) {
      showToast('Failed to pass data to chart workspace', 'error');
      return;
    }

    // Open existing chart type selection modal overlay
    const newChartOverlay = document.getElementById('new-chart-overlay');
    if (newChartOverlay) {
      newChartOverlay.classList.add('open');
    } else {
      // Fallback: direct load if modal is missing in DOM
      if (typeof window.plotoxSwitchView === 'function') {
        window.plotoxSwitchView('charts');
      }
      setTimeout(() => {
        if (typeof window.plotoxLoadCleanerData === 'function') {
          window.plotoxLoadCleanerData();
        }
      }, 100);
    }
  }

  // ═══════════════════════════════════════════
  //  PASTE DATA MODAL (simple prompt)
  // ═══════════════════════════════════════════
  function promptPasteData() {
    const pasteModal = document.getElementById('cleaner-paste-modal');
    const pasteNameInput = document.getElementById('cleaner-paste-name');
    const pasteTextArea = document.getElementById('cleaner-paste-textarea');
    if (!pasteModal) return;
    if (pasteNameInput) pasteNameInput.value = 'pasted_data.csv';
    if (pasteTextArea) pasteTextArea.value = '';
    pasteModal.style.display = 'flex';
  }

  // ═══════════════════════════════════════════
  //  SETTINGS WIRING
  // ═══════════════════════════════════════════
  function initSettings() {
    const darkToggle = document.getElementById('settings-dark-mode');
    if (darkToggle) {
      darkToggle.checked = document.documentElement.classList.contains('dark');
      darkToggle.addEventListener('change', () => {
        if (typeof window.toggleTheme === 'function') window.toggleTheme();
      });
      window.addEventListener('themeChanged', () => {
        darkToggle.checked = document.documentElement.classList.contains('dark');
      });
    }

    const clearHistory = document.getElementById('settings-clear-history');
    if (clearHistory) {
      clearHistory.addEventListener('click', () => {
        if (typeof window.plotoxConfirm === 'function') {
          window.plotoxConfirm({
            title: 'Clear History',
            text: 'Are you sure you want to clear all your saved sessions and history? This action is permanent and cannot be undone.',
            confirmText: 'Clear History',
            onConfirm: () => {
              if (typeof HistoryStorage !== 'undefined') {
                HistoryStorage.clearHistory();
                showToast('History cleared');
              }
            }
          });
        }
      });
    }

    const clearDatasets = document.getElementById('settings-clear-datasets');
    if (clearDatasets) {
      clearDatasets.addEventListener('click', () => {
        if (typeof window.plotoxConfirm === 'function') {
          window.plotoxConfirm({
            title: 'Clear Datasets',
            text: 'Are you sure you want to delete all saved datasets from your browser storage? This action cannot be undone.',
            confirmText: 'Clear Datasets',
            onConfirm: () => {
              localStorage.removeItem('plotox-cleaner-datasets');
              localStorage.removeItem('plotox-cleaner-active');
              cleanerState.datasets = [];
              cleanerState.activeDatasetId = null;
              renderAll();
              showToast('Datasets cleared');
            }
          });
        }
      });
    }

    const resetAll = document.getElementById('settings-reset-all');
    if (resetAll) {
      resetAll.addEventListener('click', () => {
        if (typeof window.plotoxConfirm === 'function') {
          window.plotoxConfirm({
            title: 'Reset Settings',
            text: 'Are you sure you want to restore all settings to their default values?',
            confirmText: 'Reset All',
            onConfirm: () => {
              localStorage.removeItem('plotox-settings');
              showToast('Settings reset to defaults');
            }
          });
        }
      });
    }

    // Sync settings-rows-per-page select and custom rows input
    const settingsRowsSelect = document.getElementById('settings-rows-per-page');
    const settingsCustomRowsInput = document.getElementById('settings-custom-rows-per-page');
    if (settingsRowsSelect) {
      // Set initial value based on active cleanerState.perPage
      const currentVal = cleanerState.perPage;
      if (['25', '50', '100', '500', '1000'].includes(String(currentVal))) {
        settingsRowsSelect.value = String(currentVal);
      } else {
        settingsRowsSelect.value = 'custom';
        if (settingsCustomRowsInput) {
          settingsCustomRowsInput.style.display = 'inline-block';
          settingsCustomRowsInput.value = currentVal === 'all' ? '' : currentVal;
        }
      }

      // Dropdown change
      settingsRowsSelect.addEventListener('change', () => {
        if (settingsRowsSelect.value === 'custom') {
          if (settingsCustomRowsInput) {
            settingsCustomRowsInput.style.display = 'inline-block';
            settingsCustomRowsInput.focus();
            const val = parseInt(settingsCustomRowsInput.value) || 50;
            cleanerState.perPage = val;
            localStorage.setItem('plotox-settings-per-page', val);
          }
        } else {
          if (settingsCustomRowsInput) settingsCustomRowsInput.style.display = 'none';
          const val = parseInt(settingsRowsSelect.value);
          cleanerState.perPage = val;
          localStorage.setItem('plotox-settings-per-page', val);
        }
        cleanerState.currentPage = 1;

        // Sync with the pagination per-page select if it exists
        if (perPageSelect) {
          if (['25', '50', '100', '500', '1000'].includes(settingsRowsSelect.value)) {
            perPageSelect.value = settingsRowsSelect.value;
            if (customPerPageInput) customPerPageInput.style.display = 'none';
          } else {
            perPageSelect.value = 'custom';
            if (customPerPageInput) {
              customPerPageInput.style.display = 'inline-block';
              customPerPageInput.value = cleanerState.perPage;
            }
          }
        }
        renderGrid();
      });

      // Custom input edit
      if (settingsCustomRowsInput) {
        settingsCustomRowsInput.addEventListener('input', () => {
          const val = Math.max(1, parseInt(settingsCustomRowsInput.value) || 1);
          cleanerState.perPage = val;
          localStorage.setItem('plotox-settings-per-page', val);
          cleanerState.currentPage = 1;

          if (perPageSelect) {
            perPageSelect.value = 'custom';
            if (customPerPageInput) {
              customPerPageInput.style.display = 'inline-block';
              customPerPageInput.value = val;
            }
          }
          renderGrid();
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  //  EVENT LISTENERS
  // ═══════════════════════════════════════════
  function setupEvents() {
    // File upload
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file);
        fileInput.value = '';
      });
    }

    // Paste button
    if (pasteBtn) pasteBtn.addEventListener('click', promptPasteData);

    // Paste modal wiring
    const pasteModal = document.getElementById('cleaner-paste-modal');
    const pasteModalClose = document.getElementById('cleaner-paste-modal-close');
    const pasteModalCancel = document.getElementById('cleaner-paste-modal-cancel');
    const pasteModalSubmit = document.getElementById('cleaner-paste-modal-submit');
    const pasteNameInput = document.getElementById('cleaner-paste-name');
    const pasteTextArea = document.getElementById('cleaner-paste-textarea');

    if (pasteModalClose && pasteModal) pasteModalClose.addEventListener('click', () => { pasteModal.style.display = 'none'; });
    if (pasteModalCancel && pasteModal) pasteModalCancel.addEventListener('click', () => { pasteModal.style.display = 'none'; });
    if (pasteModalSubmit && pasteModal) {
      pasteModalSubmit.addEventListener('click', () => {
        const text = pasteTextArea ? pasteTextArea.value.trim() : '';
        const name = pasteNameInput ? pasteNameInput.value.trim() || 'pasted_data.csv' : 'pasted_data.csv';
        if (text) {
          const sizeGuard = FileSizeGuard.validateText(text, name);
          if (!sizeGuard.valid) {
            showToast(sizeGuard.errorMessage, 'error', sizeGuard.title);
            return;
          }
          try {
            const parsed = DataParser.parse(text);
            addDataset(name, parsed.headers, parsed.rows, parsed.types, parsed.stats, text, true);
            showToast(`Pasted data "${name}" loaded`);
            pasteModal.style.display = 'none';
          } catch (err) {
            showToast('Error parsing pasted data: ' + err.message, 'error');
          }
        } else {
          showToast('Please paste some data first', 'error');
        }
      });
    }

    // Sample button
    if (sampleBtn) sampleBtn.addEventListener('click', loadSampleData);

    // Tab add button
    if (tabAddBtn) {
      tabAddBtn.addEventListener('click', () => {
        fileInput.click();
      });
    }

    // Drag & drop on workspace card
    const workspaceCard = document.getElementById('cleaner-workspace-card');
    if (workspaceCard) {
      workspaceCard.addEventListener('dragover', (e) => { e.preventDefault(); });
      workspaceCard.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
      });
    }

    // Internal tabs
    internalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.cleanerTab;
        internalTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.keys(tabContents).forEach(k => {
          if (tabContents[k]) {
            tabContents[k].classList.toggle('active', k === target);
          }
        });
        if (target === 'clean') {
          const ds = getActiveDataset();
          if (ds) renderCleanPreview(ds);
        }
        if (target === 'validation') renderValidation();
      });
    });

    // Search
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        cleanerState.searchQuery = searchInput.value.trim();
        cleanerState.currentPage = 1;
        renderGrid();
      }, 300));
    }

    // Per page
    if (perPageSelect) {
      const settingsRowsSelect = document.getElementById('settings-rows-per-page');
      const settingsCustomRowsInput = document.getElementById('settings-custom-rows-per-page');

      // Set initial selection
      const currentVal = cleanerState.perPage;
      if (['25', '50', '100', '500', '1000', 'all'].includes(String(currentVal))) {
        perPageSelect.value = String(currentVal);
      } else {
        perPageSelect.value = 'custom';
        if (customPerPageInput) {
          customPerPageInput.style.display = 'inline-block';
          customPerPageInput.value = currentVal;
        }
      }

      perPageSelect.addEventListener('change', () => {
        if (perPageSelect.value === 'custom') {
          if (customPerPageInput) {
            customPerPageInput.style.display = 'inline-block';
            customPerPageInput.focus();
            const val = parseInt(customPerPageInput.value) || 50;
            cleanerState.perPage = val;
            localStorage.setItem('plotox-settings-per-page', val);
          }
        } else {
          if (customPerPageInput) customPerPageInput.style.display = 'none';
          cleanerState.perPage = perPageSelect.value === 'all' ? 'all' : parseInt(perPageSelect.value);
          localStorage.setItem('plotox-settings-per-page', cleanerState.perPage);
        }
        cleanerState.currentPage = 1;

        // Sync back to settings panel rows-per-page select
        if (settingsRowsSelect) {
          if (['25', '50', '100', '500', '1000'].includes(perPageSelect.value)) {
            settingsRowsSelect.value = perPageSelect.value;
            if (settingsCustomRowsInput) settingsCustomRowsInput.style.display = 'none';
          } else {
            settingsRowsSelect.value = 'custom';
            if (settingsCustomRowsInput) {
              settingsCustomRowsInput.style.display = 'inline-block';
              settingsCustomRowsInput.value = cleanerState.perPage === 'all' ? '' : cleanerState.perPage;
            }
          }
        }

        renderGrid();
      });

      if (customPerPageInput) {
        customPerPageInput.addEventListener('input', () => {
          const val = Math.max(1, parseInt(customPerPageInput.value) || 1);
          cleanerState.perPage = val;
          localStorage.setItem('plotox-settings-per-page', val);
          cleanerState.currentPage = 1;

          // Sync to settings custom input
          if (settingsCustomRowsInput) {
            settingsCustomRowsInput.value = val;
          }
          if (settingsRowsSelect) {
            settingsRowsSelect.value = 'custom';
            if (settingsCustomRowsInput) settingsCustomRowsInput.style.display = 'inline-block';
          }

          renderGrid();
        });
      }
    }

    // Toolbar buttons
    if (tbUndo) tbUndo.addEventListener('click', undo);
    if (tbRedo) tbRedo.addEventListener('click', redo);
    if (tbSave) tbSave.addEventListener('click', () => { saveToStorage(); showToast('Dataset saved'); });
    if (tbExport) tbExport.addEventListener('click', () => {
      // Quick export as CSV (default)
      const fmt = (document.getElementById('settings-dataset-format') || {}).value || 'csv';
      exportDataset(fmt);
    });
    if (tbRefresh) tbRefresh.addEventListener('click', () => { renderAll(); showToast('Refreshed', 'info'); });
    if (tbGenChart) tbGenChart.addEventListener('click', generateChartFromCleaner);

    // Clean operation buttons
    opButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const op = btn.dataset.op;
        if (['impute-missing', 'find-replace', 'remove-outliers', 'convert-types', 'smart-fill-empty'].includes(op)) {
          showAdvancedCleanModal(op);
        } else {
          applyCleanOp(op);
        }
      });
    });

    // Transform buttons
    transformButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.transform;
        transformButtons.forEach(b => b.style.borderColor = '');
        btn.style.borderColor = 'var(--color-primary)';
        showTransformForm(type);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only when cleaner panel is visible
      const cleanerPanel = document.getElementById('workspace-cleaner-panel');
      if (!cleanerPanel || cleanerPanel.style.display === 'none') return;

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    });

    // Settings
    initSettings();
  }

  // ═══════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════
  setupEvents();
  loadFromStorage();

  // Expose for chart integration
  window.plotoxCleanerState = cleanerState;

  // Reset function to clear datasets, stacks, textareas, and release DOM resources
  window.plotoxResetCleaner = function () {
    cleanerState.datasets = [];
    cleanerState.activeDatasetId = null;
    cleanerState.currentPage = 1;
    cleanerState.searchQuery = '';
    cleanerState.sortCol = null;
    cleanerState.sortDir = 'none';
    cleanerState.undoStack = [];
    cleanerState.redoStack = [];

    if (searchInput) searchInput.value = '';
    if (fileInput) fileInput.value = '';

    const pasteTextarea = document.getElementById('cleaner-paste-textarea');
    if (pasteTextarea) pasteTextarea.value = '';

    const pasteNameInput = document.getElementById('cleaner-paste-name');
    if (pasteNameInput) pasteNameInput.value = 'pasted_data.csv';

    renderAll();
    saveToStorage();
  };
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDataCleaner);
} else {
  initDataCleaner();
}
