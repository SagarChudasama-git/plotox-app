function initApp() {

  // --- App State ---
  const state = {
    dataset: null,
    chartConfig: {
      chartType: 'line',
      xAxis: '',
      yAxes: [],
      title: '',
      xAxisLabel: '',
      yAxisLabel: '',
      showGrid: true,
      showLegend: true,
      lineSmooth: false,
      barmode: 'group',
      pieStyle: 'pie',
      histogramBins: 'auto',
      scatterSize: '12',
      height: 450,
      colorPalette: 'classic',
      xAxisLabelRotate: 0,
      legendPosition: 'bottom',
      showTooltip: true,
      showXGrid: true,
      showYGrid: true,
      publicationMode: false,
      logY: false,
      showPoints: false,
      showMinMax: false,
      lineWidth: '2.5',
      lineType: 'solid',
      gridType: 'dashed',
      seriesColors: {},
      titleWeight: '600',
      titleStyle: 'normal',
      titleSize: '16px',
      titleSpacing: '0',
      titleTransform: 'none',
      titleAlign: 'center',
      titleColor: 'var(--color-primary)'
    }
  };

  let activeFilename = '';
  let activeCSVText = '';

  // --- Chart type → label mapping ---
  const chartTypeLabels = {
    line: 'CSV to Line Chart',
    bar: 'CSV to Bar Chart',
    scatter: 'CSV to Scatter Plot',
    area: 'CSV to Area Chart',
    pie: 'CSV to Pie Chart',
    histogram: 'CSV to Histogram'
  };

  // --- DOM Elements ---
  const fileInput = document.getElementById('file-input');
  const delimiterSelect = document.getElementById('delimiter-select');
  const pasteText = document.getElementById('paste-text');
  const dropZone = document.getElementById('drop-zone');

  const chartTypeButtons = document.querySelectorAll('.type-grid-btn');
  const sampleButtons = document.querySelectorAll('.sidebar-sample-btn');
  const sampleTrigger = document.getElementById('sidebar-sample-trigger');
  const sampleDropdown = document.getElementById('sidebar-sample-dropdown');
  const loadSampleBtn = document.getElementById('load-sample-btn');
  const generateBtn = document.getElementById('generate-btn');

  const configSection = document.getElementById('config-section');
  const chartSection = document.getElementById('chart-section');

  const previewTab = document.getElementById('btn-preview-tab');
  const columnsTab = document.getElementById('btn-columns-tab');
  const workspaceGridContainer = document.getElementById('workspace-grid-container');

  const xAxisSelect = document.getElementById('x-axis-select');
  const xAxisPills = document.getElementById('x-axis-pills');
  const yAxisChecklist = document.getElementById('y-axis-checklist');
  const barModeGroup = document.getElementById('bar-mode-group');
  const barModeSelect = document.getElementById('bar-mode-select');
  const pieOptionsGroup = document.getElementById('pie-options-group');
  const pieStyleSelect = document.getElementById('pie-style-select');
  const histogramOptionsGroup = document.getElementById('histogram-options-group');
  const histogramBinsSelect = document.getElementById('histogram-bins-select');
  const scatterOptionsGroup = document.getElementById('scatter-options-group');
  const scatterSizeSelect = document.getElementById('scatter-size-select');
  const showGridCheck = document.getElementById('show-grid-check');
  const showLegendCheck = document.getElementById('show-legend-check');
  const lineSmoothGroup = document.getElementById('line-smooth-group');
  const lineSmoothCheck = document.getElementById('line-smooth-check');

  // New Advanced DOM Elements
  const configChartTitle = document.getElementById('config-chart-title');
  const configXLabel = document.getElementById('config-x-label');
  const configYLabel = document.getElementById('config-y-label');
  const configColorPalette = document.getElementById('config-color-palette');
  const configXRotation = document.getElementById('config-x-rotation');
  const configLegendPosition = document.getElementById('config-legend-position');
  const showXGridCheck = document.getElementById('show-x-grid-check');
  const showYGridCheck = document.getElementById('show-y-grid-check');
  const showTooltipCheck = document.getElementById('show-tooltip-check');

  const chartTitleInput = document.getElementById('chart-title-input');
  const editDataBar = document.getElementById('edit-data-bar');
  const editDataBtn = document.getElementById('edit-data-btn');
  const dataMetaBadge = document.getElementById('data-meta-badge');

  // --- Chart Canvas Editable Title Elements ---
  const canvasTitleDisplay = document.getElementById('chart-canvas-title-display');
  const canvasTitleEdit = document.getElementById('chart-canvas-title-edit');
  const canvasTitleInput = document.getElementById('chart-canvas-title-input');

  // --- Chart canvas toolbar controls ---
  const checkPublication = document.getElementById('check-publication');
  const checkLogy = document.getElementById('check-logy');
  const checkPoints = document.getElementById('check-points');
  const checkMinmax = document.getElementById('check-minmax');

  // --- Config section pill buttons ---
  const pillXGrid = document.getElementById('pill-x-grid');
  const pillYGrid = document.getElementById('pill-y-grid');
  const pillTooltip = document.getElementById('pill-tooltip');
  const pillSmooth = document.getElementById('pill-smooth');

  // --- Legend Color Picker Elements ---
  const legendColorPopover = document.getElementById('legend-color-popover');
  const legendColorSeriesName = document.getElementById('legend-color-series-name');
  const legendColorGrid = document.getElementById('legend-color-grid');
  const legendColorCustom = document.getElementById('legend-color-custom');
  const legendColorClose = document.getElementById('legend-color-close');
  let activeLegendSeries = null;
  let justOpenedLegendColorPicker = false;
  let isLegendReentry = false;

  const floatingDownloadBtn = document.getElementById('floating-download-btn');

  const exportDownloadBtn = document.getElementById('export-download-btn');
  const exportFormatSelect = document.getElementById('export-format-select');

  // --- Google-style elements ---
  const newActionBtn = document.getElementById('new-action-btn');
  const newChartOverlay = document.getElementById('new-chart-overlay');
  const ncmCloseBtn = document.getElementById('ncm-close-btn');
  const ncmCards = document.querySelectorAll('.ncm-card');

  // --- Safe StorageManager access ---
  function safeStorage() {
    return typeof StorageManager !== 'undefined' ? StorageManager : null;
  }

  // --- User Error Display (Toast Style) ---
  function showUserError(message, title = 'Error') {
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

  // --- Ingest and Unlock Workflow ---
  function enableWorkflow() {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.classList.remove('disabled');
    }
  }

  // Clear workspace
  function resetWorkflow() {
    state.dataset = null;
    activeFilename = '';
    activeCSVText = '';
    pasteText.value = '';

    disableWorkflow();
    updateHeaderStrip();
  }

  function disableWorkflow() {
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.classList.add('disabled');
    }
    if (editDataBar) {
      editDataBar.style.display = 'none';
    }
    // Hide sections
    if (configSection) {
      configSection.classList.remove('revealed-section');
      configSection.classList.add('hidden-section');
    }
    if (chartSection) {
      chartSection.classList.remove('revealed-section');
      chartSection.classList.add('hidden-section');
    }
    // Show right column empty state
    const rightColEmpty = document.getElementById('right-col-empty');
    if (rightColEmpty) rightColEmpty.style.display = '';

    // Re-render spreadsheet empty state if Grid tab is active
    if (columnsTab && columnsTab.classList.contains('active')) {
      renderWorkspaceExcelGrid();
    }
  }

  // --- Initialization ---
  function init() {
    setupEventListeners();
    loadHistoryList();
    disableWorkflow(); // Lock initially

    // Check URL parameters for chart type overrides (SEO redirects)
    const urlParams = new URLSearchParams(window.location.search);
    const hashType = window.location.hash ? window.location.hash.substring(1) : null;
    const urlType = urlParams.get('type') || hashType;
    let typeOverride = null;
    if (urlType && chartTypeLabels[urlType]) {
      typeOverride = urlType;
    }

    // Check for saved session
    const sm = safeStorage();
    const savedSession = sm ? sm.getActiveSession() : null;

    if (savedSession) {
      const sizeGuard = FileSizeGuard.validateText(savedSession.rawText, savedSession.filename || 'Saved session');
      if (!sizeGuard.valid) {
        showUserError(`Saved session validation failed: ${sizeGuard.errorMessage}`, sizeGuard.title);
        if (sm) sm.clearActiveSession();
      } else {
        try {
          const isSampleSession = savedSession.filename.includes('mobile_app_downloads') ||
            savedSession.filename.includes('mobile_os_platforms') ||
            savedSession.filename.includes('ecommerce_orders') ||
            savedSession.filename.includes('global_temperatures') ||
            savedSession.filename.includes('novatech_saas_2024');
          if (isSampleSession) {
            if (sm) sm.clearActiveSession();
          } else {
            activeFilename = savedSession.filename;
            activeCSVText = savedSession.rawText;
            state.chartConfig = Object.assign({}, state.chartConfig, savedSession.config);

            if (typeOverride) {
              state.chartConfig.chartType = typeOverride;
            }

            // Restore UI values
            chartTitleInput.value = state.chartConfig.title || '';
            if (configChartTitle) configChartTitle.value = state.chartConfig.title || '';
            syncCanvasTitle();

            // Restore Style Popover inputs
            if (styleTitleText) styleTitleText.value = state.chartConfig.title || '';
            if (styleTitleWeight) styleTitleWeight.value = state.chartConfig.titleWeight || '600';
            if (styleTitleStyle) styleTitleStyle.value = state.chartConfig.titleStyle || 'normal';
            if (styleTitleSize) styleTitleSize.value = state.chartConfig.titleSize || '16px';
            if (styleTitleColorCustom) {
              const tc = state.chartConfig.titleColor || 'var(--color-primary)';
              if (tc.startsWith('#')) {
                styleTitleColorCustom.value = tc;
              }
            }
            if (styleColorPresets) {
              styleColorPresets.forEach(p => {
                const active = p.getAttribute('data-color') === (state.chartConfig.titleColor || 'var(--color-primary)');
                p.classList.toggle('active', active);
              });
            }
            applyHeaderStyles();

            if (configXLabel) configXLabel.value = state.chartConfig.xAxisLabel || '';
            if (configYLabel) configYLabel.value = state.chartConfig.yAxisLabel || '';
            if (configColorPalette) configColorPalette.value = state.chartConfig.colorPalette || 'classic';
            if (configXRotation) configXRotation.value = String(state.chartConfig.xAxisLabelRotate || 0);
            if (configLegendPosition) configLegendPosition.value = state.chartConfig.legendPosition || 'bottom';
            if (showXGridCheck) showXGridCheck.checked = state.chartConfig.showXGrid !== false;
            if (showYGridCheck) showYGridCheck.checked = state.chartConfig.showYGrid !== false;
            if (showTooltipCheck) showTooltipCheck.checked = state.chartConfig.showTooltip !== false;
            showGridCheck.checked = state.chartConfig.showGrid !== false;
            showLegendCheck.checked = state.chartConfig.showLegend !== false;
            lineSmoothCheck.checked = !!state.chartConfig.lineSmooth;
            barModeSelect.value = state.chartConfig.barmode || 'group';
            pieStyleSelect.value = state.chartConfig.pieStyle || 'pie';
            histogramBinsSelect.value = state.chartConfig.histogramBins || 'auto';
            scatterSizeSelect.value = state.chartConfig.scatterSize || '12';

            if (checkPublication) checkPublication.checked = !!state.chartConfig.publicationMode;
            if (checkLogy) checkLogy.checked = !!state.chartConfig.logY;
            if (checkPoints) checkPoints.checked = state.chartConfig.showPoints !== false;
            if (checkMinmax) checkMinmax.checked = !!state.chartConfig.showMinMax;
            // Sync config pill button states
            if (pillXGrid) pillXGrid.classList.toggle('active', state.chartConfig.showXGrid !== false);
            if (pillYGrid) pillYGrid.classList.toggle('active', state.chartConfig.showYGrid !== false);
            if (pillTooltip) pillTooltip.classList.toggle('active', state.chartConfig.showTooltip !== false);
            if (pillSmooth) pillSmooth.classList.toggle('active', !!state.chartConfig.lineSmooth);

            // Sync toolbar toggle pill states
            const togglePublication = document.getElementById('toggle-publication');
            const toggleLogy = document.getElementById('toggle-logy');
            const togglePoints = document.getElementById('toggle-points');
            const toggleMinmax = document.getElementById('toggle-minmax');
            if (togglePublication) togglePublication.classList.toggle('active', !!state.chartConfig.publicationMode);
            if (toggleLogy) toggleLogy.classList.toggle('active', !!state.chartConfig.logY);
            if (togglePoints) togglePoints.classList.toggle('active', state.chartConfig.showPoints !== false);
            if (toggleMinmax) toggleMinmax.classList.toggle('active', !!state.chartConfig.showMinMax);

            const toggleGridlines = document.getElementById('toggle-gridlines-toolbar');
            const checkGridlines = document.getElementById('check-gridlines-toolbar');
            const toggleSmooth = document.getElementById('toggle-smooth-toolbar');
            const checkSmooth = document.getElementById('check-smooth-toolbar');

            const isGridOn = state.chartConfig.showXGrid !== false || state.chartConfig.showYGrid !== false;
            if (toggleGridlines) toggleGridlines.classList.toggle('active', isGridOn);
            if (checkGridlines) checkGridlines.checked = isGridOn;

            const isSmoothOn = !!state.chartConfig.lineSmooth;
            if (toggleSmooth) toggleSmooth.classList.toggle('active', isSmoothOn);
            if (checkSmooth) checkSmooth.checked = isSmoothOn;

            // Sync quick switcher labels
            const typeLabels = {
              line: 'Line Chart',
              bar: 'Bar Chart',
              area: 'Area Chart',
              scatter: 'Scatter Plot',
              pie: 'Pie Chart',
              histogram: 'Histogram'
            };
            const toolbarChartTypeLabel = document.getElementById('toolbar-chart-type-label');
            if (toolbarChartTypeLabel) {
              toolbarChartTypeLabel.textContent = typeLabels[state.chartConfig.chartType] || 'Line Chart';
            }

            const toolbarPaletteLabel = document.getElementById('toolbar-palette-label');
            if (toolbarPaletteLabel) {
              const paletteText = (state.chartConfig.colorPalette || 'classic');
              toolbarPaletteLabel.textContent = paletteText.charAt(0).toUpperCase() + paletteText.slice(1);
            }

            // Highlight active chart type in grid
            chartTypeButtons.forEach(btn => {
              if (btn.getAttribute('data-type') === state.chartConfig.chartType) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
            updateUIForChartType(state.chartConfig.chartType);

            // Populate delimiter select if detected
            if (state.chartConfig.delimiter) {
              delimiterSelect.value = state.chartConfig.delimiter;
            }

            // Parse and restore dataset
            const parsed = DataParser.parse(activeCSVText, delimiterSelect.value);
            state.dataset = parsed;

            // Restore CSV text in paste area
            pasteText.value = activeCSVText;

            // Populate axes selects
            populateSelectors();
            xAxisSelect.value = state.chartConfig.xAxis;
            updateActiveXPill();
            populateYChecklist(true);

            // Show edit-data bar and unlock generate button
            editDataBar.style.display = 'flex';
            dataMetaBadge.textContent = `${parsed.headers.length} columns · ${parsed.rows.length} rows`;
            enableWorkflow();

            // Auto-reveal and plot on restored session
            revealSections(false); // Immediate without scrolling animation on load

            // Highlight active sample
            sampleButtons.forEach(btn => {
              if (activeFilename.includes(btn.getAttribute('data-sample'))) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });

            if (urlType === 'cleaner') {
              switchView('cleaner');
            }
            return;
          }
        } catch (e) {
          console.error("Error loading saved session:", e);
          if (sm) sm.clearActiveSession();
        }
      }
    }

    if (typeOverride) {
      state.chartConfig.chartType = typeOverride;
    }

    // Set default UI values for new types
    pieStyleSelect.value = state.chartConfig.pieStyle || 'pie';
    histogramBinsSelect.value = state.chartConfig.histogramBins || 'auto';
    scatterSizeSelect.value = state.chartConfig.scatterSize || '12';

    if (checkPublication) checkPublication.checked = false;
    if (checkLogy) checkLogy.checked = false;
    if (checkPoints) checkPoints.checked = false;
    if (checkMinmax) checkMinmax.checked = false;

    const checkGridlines = document.getElementById('check-gridlines-toolbar');
    const toggleGridlines = document.getElementById('toggle-gridlines-toolbar');
    if (checkGridlines) checkGridlines.checked = true;
    if (toggleGridlines) toggleGridlines.classList.add('active');

    const checkSmooth = document.getElementById('check-smooth-toolbar');
    const toggleSmooth = document.getElementById('toggle-smooth-toolbar');
    if (checkSmooth) checkSmooth.checked = false;
    if (toggleSmooth) toggleSmooth.classList.remove('active');


    // Mark active chart type
    chartTypeButtons.forEach(btn => {
      if (btn.getAttribute('data-type') === state.chartConfig.chartType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    updateUIForChartType(state.chartConfig.chartType);

    // Load default sample dataset (disabled to start as empty app)
    // loadSampleDataset('mobile_os_platforms');

    // If query parameter is present (redirecting from SEO page), automatically load sample
    if (typeOverride) {
      setTimeout(() => {
        revealSections(false);
      }, 400);
    }

    if (urlType === 'cleaner') {
      switchView('cleaner');
    }
  }

  // --- Reveal Sections and Redraw ---
  function revealSections(shouldScroll = true) {
    if (!state.dataset) return;

    configSection.classList.add('revealed-section');
    configSection.classList.remove('hidden-section');
    chartSection.classList.add('revealed-section');
    chartSection.classList.remove('hidden-section');

    // Hide right column empty state
    const rightColEmpty = document.getElementById('right-col-empty');
    if (rightColEmpty) rightColEmpty.style.display = 'none';

    triggerChartRender();

    if (shouldScroll) {
      setTimeout(() => {
        const scrollContainer = document.querySelector('.app-main');
        if (!scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const configRect = configSection.getBoundingClientRect();

        // Calculate the position of the chart configuration section relative to the custom scrollContainer
        const configTop = configRect.top - containerRect.top + scrollContainer.scrollTop;

        // Scroll smoothly to stop exactly at the beginning of the chart configuration section (with a clean 10px spacing)
        const targetScrollY = configTop - 10;

        scrollContainer.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });
      }, 150);
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {

    // Mobile Navigation Drawer Toggle and Bindings
    const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    const sidebarNav = document.querySelector('.app-sidebar-nav');
    const sidebarOverlay = document.getElementById('sidebar-drawer-overlay');

    function closeSidebarDrawer() {
      if (sidebarNav && sidebarOverlay) {
        sidebarNav.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        if (btnSidebarToggle) {
          const icon = btnSidebarToggle.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = 'menu';
        }
      }
    }

    if (btnSidebarToggle && sidebarNav && sidebarOverlay) {
      btnSidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sidebarNav.classList.toggle('active');
        sidebarOverlay.classList.toggle('active', isOpen);

        // Toggle hamburger icon between menu and close
        const icon = btnSidebarToggle.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = isOpen ? 'close' : 'menu';
        }
      });

      // Close drawer on overlay click
      sidebarOverlay.addEventListener('click', () => {
        closeSidebarDrawer();
      });

      // Close drawer when any sidebar navigation button is clicked on mobile
      const sidebarItems = sidebarNav.querySelectorAll('.sidebar-menu-item');
      sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            // Do not close the drawer if clicking the dropdown header button
            if (item.id === 'nav-charts-btn') return;
            closeSidebarDrawer();
          }
        });
      });

      // Window resize protection — auto-close drawer when returning to desktop screen widths
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          closeSidebarDrawer();
        }
      });
    }

    // Tabs for Preview and Grid View inside Ingestion Card
    if (previewTab && columnsTab && dropZone && workspaceGridContainer) {
      previewTab.addEventListener('click', () => {
        previewTab.classList.add('active');
        columnsTab.classList.remove('active');
        dropZone.style.display = 'block';
        workspaceGridContainer.style.display = 'none';
      });

      columnsTab.addEventListener('click', () => {
        columnsTab.classList.add('active');
        previewTab.classList.remove('active');
        dropZone.style.display = 'none';
        workspaceGridContainer.style.display = 'block';
        renderWorkspaceExcelGrid();
      });
    }

    // Signature + New Chart Button triggers chart choice pop-up modal
    if (newActionBtn && newChartOverlay) {
      newActionBtn.addEventListener('click', () => {
        newChartOverlay.classList.add('open');
      });
    }

    if (ncmCloseBtn && newChartOverlay) {
      ncmCloseBtn.addEventListener('click', () => {
        newChartOverlay.classList.remove('open');
        sessionStorage.removeItem('plotox-cleaner-pending'); // Clear pending cleaner redirect flag
      });
      newChartOverlay.addEventListener('click', (e) => {
        if (e.target === newChartOverlay) {
          newChartOverlay.classList.remove('open');
          sessionStorage.removeItem('plotox-cleaner-pending'); // Clear pending cleaner redirect flag
        }
      });
    }

    if (ncmCards && newChartOverlay) {
      ncmCards.forEach(card => {
        card.addEventListener('click', () => {
          const chosenType = card.getAttribute('data-chart');
          newChartOverlay.classList.remove('open');

          // Check if triggered from the Data Cleaner generate flow
          if (sessionStorage.getItem('plotox-cleaner-pending') === 'true') {
            sessionStorage.removeItem('plotox-cleaner-pending');

            // Update active chart type configuration
            state.chartConfig.chartType = chosenType;
            updateUIForChartType(chosenType);

            // Synchronize active sidebar navigation buttons
            chartTypeButtons.forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-type') === chosenType);
            });

            // Redirect workspace view to dynamic chart dashboard
            switchView('workspace');

            // Trigger loading cleaned dataset from sessionStorage
            setTimeout(() => {
              if (typeof window.plotoxLoadCleanerData === 'function') {
                window.plotoxLoadCleanerData();
              }
            }, 100);
            return;
          }

          // Clear current dataset and reset work space for fresh data ingestion
          resetWorkflow();

          const activeSampleIndicator = document.getElementById('active-sample-indicator');
          const loadSampleBtnElement = document.getElementById('load-sample-btn');
          if (activeSampleIndicator) activeSampleIndicator.style.display = 'none';
          if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'inline-flex';

          // Update active sidebar button styles to chosen type
          chartTypeButtons.forEach(b => {
            if (b.getAttribute('data-type') === chosenType) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });

          // Update visual active state
          state.chartConfig.chartType = chosenType;
          updateUIForChartType(chosenType);
          saveSession();

          // Redirect page to active workspace properly
          switchView('workspace');

          // Automatically trigger the file picker dialog for the new chart type!
          setTimeout(() => {
            fileInput.value = '';
            fileInput.click();
          }, 150);
        });
      });
    }

    // Edit Data button opens modal
    if (editDataBtn) {
      editDataBtn.addEventListener('click', () => {
        if (state.dataset) openEditDataModal();
      });
    }

    // Hidden upload file input
    fileInput.addEventListener('change', handleFileSelect);

    // Delimiter select listener
    delimiterSelect.addEventListener('change', () => {
      const text = pasteText.value.trim();
      if (text) {
        try {
          parseAndLoadData(text, activeFilename || 'pasted_data.csv', delimiterSelect.value);
        } catch (err) {
          showUserError(`Delimiter changed, parsing error: ${err.message}`);
        }
      }
    });

    // Paste area live parsing and dynamic workflow unlocking
    pasteText.addEventListener('input', debounce((e) => {
      const text = e.target.value.trim();
      if (text) {
        const sizeGuard = FileSizeGuard.validateText(text, 'Pasted text');
        if (!sizeGuard.valid) {
          showUserError(sizeGuard.errorMessage, sizeGuard.title);
          pasteText.value = '';
          disableWorkflow();
          return;
        }
        try {
          parseAndLoadData(text, activeFilename || 'pasted_data.csv', delimiterSelect.value);
        } catch (err) {
          console.warn('Parsing input text:', err.message);
        }
      } else {
        disableWorkflow();
      }
    }, 500));

    // Drop zone drag and drop
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      });
    }

    // Generate Button Click reveals panels and triggers charts
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (generateBtn.classList.contains('disabled')) return;
        if (!state.dataset) {
          showUserError('Please upload or paste CSV data first.');
          return;
        }
        if (state.chartConfig.yAxes.length === 0) {
          showUserError('Please select at least one Y-Axis column to plot.');
          return;
        }
        revealSections(true);

        // Save session to History in localStorage
        if (typeof HistoryStorage !== 'undefined') {
          HistoryStorage.addEntry(
            activeFilename || 'unnamed_data.csv',
            state.chartConfig.chartType,
            state.chartConfig,
            activeCSVText
          );
          loadHistoryList();
          updateHeaderStrip();
        }
      });
    }

    // Load Sample Button
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        loadSampleDataset('mobile_app_downloads');
      });
    }

    // Clear Sample Button
    const clearSampleBtn = document.getElementById('clear-sample-btn');
    if (clearSampleBtn) {
      clearSampleBtn.addEventListener('click', () => {
        resetWorkflow();
        const activeSampleIndicator = document.getElementById('active-sample-indicator');
        const loadSampleBtnElement = document.getElementById('load-sample-btn');
        if (activeSampleIndicator) activeSampleIndicator.style.display = 'none';
        if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'inline-flex';
      });
    }

    // Clear Data Button
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        resetWorkflow();
        const activeSampleIndicator = document.getElementById('active-sample-indicator');
        const loadSampleBtnElement = document.getElementById('load-sample-btn');
        if (activeSampleIndicator) activeSampleIndicator.style.display = 'none';
        if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'inline-flex';
      });
    }

    // Sidebar Sample Collapsible Dropdown
    if (sampleTrigger) {
      sampleTrigger.addEventListener('click', () => {
        sampleTrigger.classList.toggle('open');
        sampleDropdown.classList.toggle('open');
      });
    }

    // Sidebar Charts trigger
    const chartsBtn = document.getElementById('nav-charts-btn');
    const chartsChevron = document.getElementById('nav-charts-chevron');
    const chartsDropdown = document.getElementById('nav-charts-dropdown');

    if (chartsBtn && chartsDropdown) {
      chartsBtn.addEventListener('click', (e) => {
        const isCurrentlyCharts = document.getElementById('workspace-view-panel').style.display !== 'none';

        // If clicking the chevron, always toggle the dropdown
        if (e.target === chartsChevron || chartsChevron?.contains(e.target)) {
          e.stopPropagation();
          const isOpen = chartsDropdown.classList.toggle('open');
          chartsDropdown.style.display = isOpen ? 'flex' : 'none';
          if (chartsChevron) chartsChevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
          return;
        }

        if (isCurrentlyCharts) {
          // Toggle dropdown
          const isOpen = chartsDropdown.classList.toggle('open');
          chartsDropdown.style.display = isOpen ? 'flex' : 'none';
          if (chartsChevron) chartsChevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        } else {
          // Switch view
          switchView('charts');
          // Ensure open
          chartsDropdown.classList.add('open');
          chartsDropdown.style.display = 'flex';
          if (chartsChevron) chartsChevron.style.transform = 'rotate(180deg)';
        }
      });
    }


    // Sidebar Data Cleaner trigger
    const dataCleanerBtn = document.getElementById('nav-data-cleaner-btn');
    if (dataCleanerBtn) {
      dataCleanerBtn.addEventListener('click', () => {
        switchView('cleaner');
      });
    }

    // Sidebar Projects trigger (shows History)
    const projectsBtn = document.getElementById('nav-projects-btn');
    if (projectsBtn) {
      projectsBtn.addEventListener('click', () => {
        switchView('projects');
      });
    }

    // Sidebar Settings trigger
    const settingsBtn = document.getElementById('nav-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        switchView('settings');
      });
    }

    // Clear history button inside dashboard (Triggers custom confirmation modal)
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        if (typeof window.plotoxConfirm === 'function') {
          window.plotoxConfirm({
            title: 'Clear History',
            text: 'Are you sure you want to clear all your saved sessions? This action is permanent and cannot be undone.',
            confirmText: 'Clear All',
            onConfirm: () => {
              if (typeof HistoryStorage !== 'undefined') {
                HistoryStorage.clearHistory();
                loadHistoryList();
                drawHistoryDashboard();
                updateHeaderStrip();
              }
            }
          });
        }
      });
    }

    // Sample buttons select action
    sampleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sampleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadSampleDataset(btn.getAttribute('data-sample'));
      });
    });

    // Chart type selection grid
    chartTypeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Clear workspace for fresh data
        resetWorkflow();
        const activeSampleIndicator = document.getElementById('active-sample-indicator');
        const loadSampleBtnElement = document.getElementById('load-sample-btn');
        if (activeSampleIndicator) activeSampleIndicator.style.display = 'none';
        if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'inline-flex';

        chartTypeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const type = btn.getAttribute('data-type');
        state.chartConfig.chartType = type;
        updateUIForChartType(type);
        saveSession();

        // Auto-switch to workspace panel when chart type is selected
        switchView('workspace');
      });
    });


    // Axis mapping elements listeners (Auto redraw on change)
    xAxisSelect.addEventListener('change', (e) => {
      state.chartConfig.xAxis = e.target.value;
      updateActiveXPill();
      populateYChecklist(false);
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    // Dynamic Select dropdowns update triggers
    barModeSelect.addEventListener('change', (e) => {
      state.chartConfig.barmode = e.target.value;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    pieStyleSelect.addEventListener('change', (e) => {
      state.chartConfig.pieStyle = e.target.value;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    histogramBinsSelect.addEventListener('change', (e) => {
      state.chartConfig.histogramBins = e.target.value;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    scatterSizeSelect.addEventListener('change', (e) => {
      state.chartConfig.scatterSize = e.target.value;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    // Visual Style Toggles redraw
    showGridCheck.addEventListener('change', (e) => {
      state.chartConfig.showGrid = e.target.checked;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    showLegendCheck.addEventListener('change', (e) => {
      state.chartConfig.showLegend = e.target.checked;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    lineSmoothCheck.addEventListener('change', (e) => {
      state.chartConfig.lineSmooth = e.target.checked;
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    // Chart title text input change with debounce
    chartTitleInput.addEventListener('input', debounce((e) => {
      state.chartConfig.title = e.target.value;
      if (configChartTitle) configChartTitle.value = e.target.value;
      syncCanvasTitle();
      saveSession();
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    }, 300));

    // New configuration fields change listeners
    if (configChartTitle) {
      configChartTitle.addEventListener('input', debounce((e) => {
        state.chartConfig.title = e.target.value;
        chartTitleInput.value = e.target.value;
        syncCanvasTitle();
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      }, 300));
    }

    // --- Canvas Title Click-to-Edit ---
    if (canvasTitleDisplay) {
      canvasTitleDisplay.addEventListener('click', () => {
        enterCanvasTitleEdit();
      });
    }

    if (canvasTitleInput) {
      canvasTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          exitCanvasTitleEdit(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          exitCanvasTitleEdit(false);
        }
      });

      canvasTitleInput.addEventListener('blur', () => {
        exitCanvasTitleEdit(true);
      });
    }

    if (configXLabel) {
      configXLabel.addEventListener('input', debounce((e) => {
        state.chartConfig.xAxisLabel = e.target.value;
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      }, 300));
    }

    if (configYLabel) {
      configYLabel.addEventListener('input', debounce((e) => {
        state.chartConfig.yAxisLabel = e.target.value;
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      }, 300));
    }

    if (configColorPalette) {
      configColorPalette.addEventListener('change', (e) => {
        state.chartConfig.colorPalette = e.target.value;
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      });
    }

    if (configXRotation) {
      configXRotation.addEventListener('change', (e) => {
        state.chartConfig.xAxisLabelRotate = Number(e.target.value);
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      });
    }

    if (configLegendPosition) {
      configLegendPosition.addEventListener('change', (e) => {
        state.chartConfig.legendPosition = e.target.value;
        saveSession();
        if (configSection.classList.contains('revealed-section')) {
          triggerChartRender();
        }
      });
    }

    // Config section pill buttons
    if (pillXGrid) {
      pillXGrid.addEventListener('click', () => {
        pillXGrid.classList.toggle('active');
        const isActive = pillXGrid.classList.contains('active');
        state.chartConfig.showXGrid = isActive;
        if (showXGridCheck) showXGridCheck.checked = isActive;
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    if (pillYGrid) {
      pillYGrid.addEventListener('click', () => {
        pillYGrid.classList.toggle('active');
        const isActive = pillYGrid.classList.contains('active');
        state.chartConfig.showYGrid = isActive;
        if (showYGridCheck) showYGridCheck.checked = isActive;
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    if (pillTooltip) {
      pillTooltip.addEventListener('click', () => {
        pillTooltip.classList.toggle('active');
        const isActive = pillTooltip.classList.contains('active');
        state.chartConfig.showTooltip = isActive;
        if (showTooltipCheck) showTooltipCheck.checked = isActive;
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    if (pillSmooth) {
      pillSmooth.addEventListener('click', () => {
        pillSmooth.classList.toggle('active');
        const isActive = pillSmooth.classList.contains('active');
        state.chartConfig.lineSmooth = isActive;
        if (lineSmoothCheck) lineSmoothCheck.checked = isActive;
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    // Keep hidden checkbox listeners for compatibility
    if (showXGridCheck) {
      showXGridCheck.addEventListener('change', (e) => {
        state.chartConfig.showXGrid = e.target.checked;
        if (pillXGrid) pillXGrid.classList.toggle('active', e.target.checked);
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    if (showYGridCheck) {
      showYGridCheck.addEventListener('change', (e) => {
        state.chartConfig.showYGrid = e.target.checked;
        if (pillYGrid) pillYGrid.classList.toggle('active', e.target.checked);
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    if (showTooltipCheck) {
      showTooltipCheck.addEventListener('change', (e) => {
        state.chartConfig.showTooltip = e.target.checked;
        if (pillTooltip) pillTooltip.classList.toggle('active', e.target.checked);
        saveSession();
        if (configSection.classList.contains('revealed-section')) triggerChartRender();
      });
    }

    // Toolbar toggle pill buttons (Publication, Log Y, Points, Min/Max)
    const toolbarTogglePills = document.querySelectorAll('.chart-canvas-toolbar .toolbar-toggle-pill');
    toolbarTogglePills.forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('active');
        const checkId = pill.getAttribute('data-check');
        const checkbox = checkId ? document.getElementById(checkId) : null;
        const isActive = pill.classList.contains('active');
        if (checkbox) {
          checkbox.checked = isActive;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });

    // Keep hidden toolbar checkbox listeners
    if (checkPublication) {
      checkPublication.addEventListener('change', (e) => {
        state.chartConfig.publicationMode = e.target.checked;
        saveSession();
        triggerChartRender();
      });
    }

    if (checkLogy) {
      checkLogy.addEventListener('change', (e) => {
        state.chartConfig.logY = e.target.checked;
        saveSession();
        triggerChartRender();
      });
    }

    if (checkPoints) {
      checkPoints.addEventListener('change', (e) => {
        state.chartConfig.showPoints = e.target.checked;
        saveSession();
        triggerChartRender();
      });
    }

    if (checkMinmax) {
      checkMinmax.addEventListener('change', (e) => {
        state.chartConfig.showMinMax = e.target.checked;
        saveSession();
        triggerChartRender();
      });
    }

    // Floating Download Button
    if (floatingDownloadBtn) {
      floatingDownloadBtn.addEventListener('click', () => {
        if (exportDownloadBtn) {
          exportDownloadBtn.click();
        }
      });
    }

    // Export files downloading
    if (exportDownloadBtn && exportFormatSelect) {
      exportDownloadBtn.addEventListener('click', () => {
        const format = exportFormatSelect.value;
        const filename = cleanFilename(state.chartConfig.title) || 'plotox_chart';

        if (format === 'png') {
          ExportManager.exportPNG('chart-container', filename);
        } else if (format === 'jpg' || format === 'jpeg') {
          ExportManager.exportJPG('chart-container', filename);
        } else if (format === 'svg') {
          ExportManager.exportSVG('chart-container', filename);
        } else if (format === 'html') {
          ExportManager.exportHTML('chart-container', filename);
        } else if (format === 'json') {
          ExportManager.exportJSON('chart-container', filename);
        } else if (format === 'pdf') {
          ExportManager.exportPDF('chart-container', filename);
        }

        // Track export event
        if (window.PlotoxAnalytics) {
          window.PlotoxAnalytics.trackEvent('chart_exported', {
            format: format,
            chart_type: state.chartConfig.chartType
          });
        }
      });
    }

    // ECharts layout auto re-render on dark/light theme switch
    window.addEventListener('themeChanged', () => {
      if (configSection.classList.contains('revealed-section')) {
        triggerChartRender();
      }
    });

    // --- Legend Color Picker ---
    if (legendColorClose) {
      legendColorClose.addEventListener('click', () => {
        closeLegendColorPicker();
      });
    }

    if (legendColorCustom) {
      legendColorCustom.addEventListener('input', (e) => {
        if (activeLegendSeries) {
          applyLegendColor(activeLegendSeries, e.target.value);
        }
      });
    }

    // Close legend popover on outside click
    document.addEventListener('click', (e) => {
      if (justOpenedLegendColorPicker) return;
      if (legendColorPopover && legendColorPopover.style.display !== 'none') {
        if (!legendColorPopover.contains(e.target)) {
          closeLegendColorPicker();
        }
      }
    });

    // --- Chart Title Style Editor ---
    const btnChartStyle = document.getElementById('btn-chart-style');
    const chartStylePopover = document.getElementById('chart-style-popover');
    const chartStyleClose = document.getElementById('chart-style-close');

    const styleTitleText = document.getElementById('style-title-text');
    const styleTitleWeight = document.getElementById('style-title-weight');
    const styleTitleStyle = document.getElementById('style-title-style');
    const styleTitleSize = document.getElementById('style-title-size');
    const styleTitleColorCustom = document.getElementById('style-title-color-custom');
    const styleColorPresets = document.querySelectorAll('.style-color-preset');

    // Popover Toggling
    if (btnChartStyle && chartStylePopover) {
      btnChartStyle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = chartStylePopover.style.display === 'none';
        chartStylePopover.style.display = isHidden ? 'flex' : 'none';
        btnChartStyle.classList.toggle('active', isHidden);

        // Hide color picker if open
        if (legendColorPopover) legendColorPopover.style.display = 'none';
      });
    }

    if (chartStyleClose && chartStylePopover) {
      chartStyleClose.addEventListener('click', () => {
        chartStylePopover.style.display = 'none';
        if (btnChartStyle) btnChartStyle.classList.remove('active');
      });
    }

    // Outside Click Closing
    document.addEventListener('click', (e) => {
      if (chartStylePopover && chartStylePopover.style.display !== 'none') {
        if (!chartStylePopover.contains(e.target) && (!btnChartStyle || !btnChartStyle.contains(e.target))) {
          chartStylePopover.style.display = 'none';
          if (btnChartStyle) btnChartStyle.classList.remove('active');
        }
      }
    });

    // Real-time Text Input
    if (styleTitleText) {
      styleTitleText.addEventListener('input', (e) => {
        state.chartConfig.title = e.target.value;
        chartTitleInput.value = e.target.value;
        if (configChartTitle) configChartTitle.value = e.target.value;
        syncCanvasTitle();
        saveSession();
        triggerChartRender();
      });
    }

    // Weight select change
    if (styleTitleWeight) {
      styleTitleWeight.addEventListener('change', (e) => {
        state.chartConfig.titleWeight = e.target.value;
        applyHeaderStyles();
        saveSession();
        triggerChartRender();
      });
    }

    // Italic Style select change
    if (styleTitleStyle) {
      styleTitleStyle.addEventListener('change', (e) => {
        state.chartConfig.titleStyle = e.target.value;
        applyHeaderStyles();
        saveSession();
        triggerChartRender();
      });
    }

    // Size select change
    if (styleTitleSize) {
      styleTitleSize.addEventListener('change', (e) => {
        state.chartConfig.titleSize = e.target.value;
        applyHeaderStyles();
        saveSession();
        triggerChartRender();
      });
    }



    // Preset color pickers
    styleColorPresets.forEach(preset => {
      preset.addEventListener('click', () => {
        styleColorPresets.forEach(p => p.classList.remove('active'));
        preset.classList.add('active');
        const color = preset.getAttribute('data-color');
        state.chartConfig.titleColor = color;

        if (styleTitleColorCustom) {
          // Sync custom color input with hex color if it's hex, otherwise default
          if (color.startsWith('#')) {
            styleTitleColorCustom.value = color;
          }
        }

        applyHeaderStyles();
        saveSession();
        triggerChartRender();
      });
    });

    // Custom color input picker
    if (styleTitleColorCustom) {
      styleTitleColorCustom.addEventListener('input', (e) => {
        styleColorPresets.forEach(p => p.classList.remove('active'));
        const color = e.target.value;
        state.chartConfig.titleColor = color;
        applyHeaderStyles();
        saveSession();
        triggerChartRender();
      });
    }

    // Custom toolbar toggles & bindings
    const checkGridlinesToolbar = document.getElementById('check-gridlines-toolbar');
    const checkSmoothToolbar = document.getElementById('check-smooth-toolbar');

    if (checkGridlinesToolbar) {
      checkGridlinesToolbar.addEventListener('change', (e) => {
        const checked = e.target.checked;
        state.chartConfig.showXGrid = checked;
        state.chartConfig.showYGrid = checked;
        state.chartConfig.gridType = checked ? 'dashed' : 'none';

        if (pillXGrid) pillXGrid.classList.toggle('active', checked);
        if (pillYGrid) pillYGrid.classList.toggle('active', checked);

        saveSession();
        triggerChartRender();
      });
    }

    if (checkSmoothToolbar) {
      checkSmoothToolbar.addEventListener('change', (e) => {
        const checked = e.target.checked;
        state.chartConfig.lineSmooth = checked;

        if (pillSmooth) pillSmooth.classList.toggle('active', checked);

        saveSession();
        triggerChartRender();
      });
    }

    // Quick Chart Type Switcher
    const btnChartType = document.getElementById('btn-chart-type');
    const dropdownChartType = document.getElementById('dropdown-chart-type');
    const toolbarChartTypeLabel = document.getElementById('toolbar-chart-type-label');

    if (btnChartType && dropdownChartType) {
      btnChartType.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownChartType.style.display === 'flex';
        dropdownChartType.style.display = isOpen ? 'none' : 'flex';
        btnChartType.classList.toggle('active', !isOpen);

        if (dropdownPalette) {
          dropdownPalette.style.display = 'none';
          const btnPalette = document.getElementById('btn-palette');
          if (btnPalette) btnPalette.classList.remove('active');
        }
      });

      dropdownChartType.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = item.getAttribute('data-type');

          state.chartConfig.chartType = type;

          chartTypeButtons.forEach(btn => {
            if (btn.getAttribute('data-type') === type) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });

          const labelText = item.querySelector('span:last-child').textContent;
          if (toolbarChartTypeLabel) toolbarChartTypeLabel.textContent = labelText;

          dropdownChartType.style.display = 'none';
          btnChartType.classList.remove('active');

          updateUIForChartType(type);
          saveSession();
          triggerChartRender();
        });
      });
    }

    // Quick Color Palette Selector
    const btnPalette = document.getElementById('btn-palette');
    const dropdownPalette = document.getElementById('dropdown-palette');
    const toolbarPaletteLabel = document.getElementById('toolbar-palette-label');

    if (btnPalette && dropdownPalette) {
      btnPalette.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownPalette.style.display === 'flex';
        dropdownPalette.style.display = isOpen ? 'none' : 'flex';
        btnPalette.classList.toggle('active', !isOpen);

        if (dropdownChartType) {
          dropdownChartType.style.display = 'none';
          if (btnChartType) btnChartType.classList.remove('active');
        }
      });

      dropdownPalette.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const palette = item.getAttribute('data-palette');

          state.chartConfig.colorPalette = palette;
          if (configColorPalette) configColorPalette.value = palette;

          const labelText = item.textContent.trim();
          if (toolbarPaletteLabel) toolbarPaletteLabel.textContent = labelText;

          dropdownPalette.style.display = 'none';
          btnPalette.classList.remove('active');

          saveSession();
          triggerChartRender();
        });
      });
    }

    // Global Click Outside Dropdowns Handler
    document.addEventListener('click', (e) => {
      if (dropdownChartType && !dropdownChartType.contains(e.target) && (!btnChartType || !btnChartType.contains(e.target))) {
        dropdownChartType.style.display = 'none';
        if (btnChartType) btnChartType.classList.remove('active');
      }
      if (dropdownPalette && !dropdownPalette.contains(e.target) && (!btnPalette || !btnPalette.contains(e.target))) {
        dropdownPalette.style.display = 'none';
        if (btnPalette) btnPalette.classList.remove('active');
      }
    });

    // ECharts Zoom Buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        const container = document.getElementById('chart-container');
        if (!container) return;
        const chart = echarts.getInstanceByDom(container);
        if (!chart) return;
        const option = chart.getOption();
        let start = 0;
        let end = 100;
        if (option.dataZoom && option.dataZoom[0]) {
          start = option.dataZoom[0].start;
          end = option.dataZoom[0].end;
        }
        const range = end - start;
        chart.dispatchAction({
          type: 'dataZoom',
          start: start + range * 0.15,
          end: end - range * 0.15
        });
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        const container = document.getElementById('chart-container');
        if (!container) return;
        const chart = echarts.getInstanceByDom(container);
        if (!chart) return;
        const option = chart.getOption();
        let start = 0;
        let end = 100;
        if (option.dataZoom && option.dataZoom[0]) {
          start = option.dataZoom[0].start;
          end = option.dataZoom[0].end;
        }
        const range = end - start;
        chart.dispatchAction({
          type: 'dataZoom',
          start: Math.max(0, start - range * 0.15),
          end: Math.min(100, end + range * 0.15)
        });
      });
    }

    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        const container = document.getElementById('chart-container');
        if (!container) return;
        const chart = echarts.getInstanceByDom(container);
        if (!chart) return;
        chart.dispatchAction({
          type: 'dataZoom',
          start: 0,
          end: 100
        });
      });
    }
  }

  // --- Handlers ---
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
  }

  function handleFile(file) {
    const sizeGuard = FileSizeGuard.validateFile(file);
    if (!sizeGuard.valid) {
      showUserError(sizeGuard.errorMessage, sizeGuard.title);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        pasteText.value = text;
        parseAndLoadData(text, file.name, delimiterSelect.value);
      } catch (err) {
        showUserError(`Error parsing file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      showUserError('Could not read the file. Please try again.');
    };
    reader.readAsText(file);
  }

  function loadSampleDataset(name, autoReveal = false) {
    fetch(`assets/data/${name}.csv`)
      .then(response => {
        if (!response.ok) throw new Error('Sample data not found');
        return response.text();
      })
      .then(text => {
        pasteText.value = text;
        parseAndLoadData(text, `${name}.csv`, delimiterSelect.value);
        showSampleLoadedIndicator(name);
        if (autoReveal) {
          setTimeout(() => revealSections(false), 200);
        }
      })
      .catch(err => {
        console.error('Error fetching sample from server, falling back to local dataset', err);
        loadInlineSampleData(name, autoReveal);
      });
  }

  // Inline static datasets for full file:// support
  function loadInlineSampleData(name, autoReveal = false) {
    const samples = {
      mobile_app_downloads: `Month,Android,iOS,Windows,MacOS
Jan,25000,15000,3000,2000
Feb,27000,16000,3200,2200
Mar,30000,17500,3500,2400
Apr,34000,19000,3800,2600
May,38000,21000,4200,2800
Jun,42000,23000,4500,3000
Jul,47000,26000,5000,3400
Aug,50000,28000,5200,3600
Sep,49000,27500,5100,3500
Oct,54000,30000,5600,3900
Nov,60000,34000,6200,4300
Dec,70000,40000,7000,5000`
    };

    const targetName = samples[name] ? name : 'mobile_app_downloads';
    const csvContent = samples[targetName];

    pasteText.value = csvContent;
    parseAndLoadData(csvContent, `${targetName}.csv`, delimiterSelect.value);
    showSampleLoadedIndicator(targetName);
    if (autoReveal) {
      setTimeout(() => revealSections(false), 200);
    }
  }

  function showSampleLoadedIndicator(name) {
    const activeSampleIndicator = document.getElementById('active-sample-indicator');
    const activeSampleName = document.getElementById('active-sample-name');
    const loadSampleBtnElement = document.getElementById('load-sample-btn');

    if (!activeSampleIndicator || !activeSampleName) return;

    const sampleDisplayNames = {
      mobile_app_downloads: 'Mobile App Downloads'
    };

    const displayName = sampleDisplayNames[name] || name.replace(/_/g, ' ');

    activeSampleName.textContent = `Sample: ${displayName}`;
    activeSampleIndicator.style.display = 'inline-flex';
    if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'none';
  }

  // --- Parsing & Processing Dataset ---
  function parseAndLoadData(text, filename, delimiter = null) {
    const sizeGuard = FileSizeGuard.validateText(text, filename || 'Dataset');
    if (!sizeGuard.valid) {
      showUserError(sizeGuard.errorMessage, sizeGuard.title);
      disableWorkflow();
      return;
    }
    let parsed;
    try {
      parsed = DataParser.parse(text, delimiter);
    } catch (err) {
      showUserError(`Data parsing failed: ${err.message}`);
      disableWorkflow();
      return;
    }

    if (!parsed || !parsed.headers || parsed.headers.length === 0) {
      showUserError('No valid columns could be detected in the data.');
      disableWorkflow();
      return;
    }

    if (!parsed.rows || parsed.rows.length === 0) {
      showUserError('No data rows found below the header row.');
      disableWorkflow();
      return;
    }

    activeFilename = filename;
    activeCSVText = text;
    state.dataset = parsed;
    state.chartConfig.delimiter = delimiter || parsed.delimiter;

    // Autofill pretty title for output chart
    const prettyName = filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    const defaultTitle = prettyName.charAt(0).toUpperCase() + prettyName.slice(1) + ' Chart';
    chartTitleInput.value = defaultTitle;
    if (configChartTitle) configChartTitle.value = defaultTitle;
    state.chartConfig.title = defaultTitle;
    syncCanvasTitle();

    // Populate selectors axis
    populateSelectors();

    // Show edit-data bar with metadata
    editDataBar.style.display = 'flex';
    dataMetaBadge.textContent = `${parsed.headers.length} columns · ${parsed.rows.length} rows`;

    // Unlock "Generate Interactive Graph" button
    enableWorkflow();
    switchView('workspace');

    // Track Analytics data import
    if (window.PlotoxAnalytics) {
      window.PlotoxAnalytics.trackEvent('data_imported', {
        file_name: filename,
        columns_count: parsed.headers.length,
        rows_count: parsed.rows.length
      });
    }

    // If Grid View is active, re-render spreadsheet grid
    if (columnsTab && columnsTab.classList.contains('active')) {
      renderWorkspaceExcelGrid();
    }

    // If config panel is already shown, update both sections in real-time
    if (configSection.classList.contains('revealed-section')) {
      triggerChartRender();
    }

    // If the loaded file is NOT one of our samples, restore standard toolbar
    if (!filename.includes('mobile_app_downloads')) {
      const activeSampleIndicator = document.getElementById('active-sample-indicator');
      const loadSampleBtnElement = document.getElementById('load-sample-btn');
      if (activeSampleIndicator) activeSampleIndicator.style.display = 'none';
      if (loadSampleBtnElement) loadSampleBtnElement.style.display = 'inline-flex';
    }

    saveSession();
    updateHeaderStrip();
  }

  // --- Dynamic Option Selectors Mappings ---
  function populateSelectors() {
    if (!state.dataset) return;

    xAxisSelect.innerHTML = '';
    state.dataset.headers.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      xAxisSelect.appendChild(opt);
    });

    // Auto-detect the best default Column for the X Axis
    let bestX = state.dataset.headers[0];
    for (let col of state.dataset.headers) {
      const type = state.dataset.types[col];
      if (type === 'datetime' || type === 'categorical') {
        bestX = col;
        break;
      }
    }
    xAxisSelect.value = bestX;
    state.chartConfig.xAxis = bestX;
    populateXPills();
    populateYChecklist(false);
  }

  function populateXPills() {
    if (!xAxisPills || !state.dataset) return;
    xAxisPills.innerHTML = '';
    state.dataset.headers.forEach(col => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'x-pill-btn';
      pill.setAttribute('data-value', col);
      if (state.chartConfig.xAxis === col) {
        pill.classList.add('active');
      }
      pill.textContent = col;
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        xAxisSelect.value = col;
        state.chartConfig.xAxis = col;
        updateActiveXPill();
        xAxisSelect.dispatchEvent(new Event('change'));
      });
      xAxisPills.appendChild(pill);
    });
  }

  function updateActiveXPill() {
    if (!xAxisPills) return;
    const currentVal = xAxisSelect.value;
    xAxisPills.querySelectorAll('.x-pill-btn').forEach(btn => {
      if (btn.getAttribute('data-value') === currentVal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function populateYChecklist(preserveChecked = false) {
    if (!state.dataset) return;

    const previousChecked = Array.isArray(state.chartConfig.yAxes) ? [...state.chartConfig.yAxes] : [];
    yAxisChecklist.innerHTML = '';
    const xCol = state.chartConfig.xAxis;

    const yCandidates = state.dataset.headers.filter(col => col !== xCol);
    let checkedCount = 0;

    yCandidates.forEach((col) => {
      const isNumeric = state.dataset.types[col] === 'numeric';

      const item = document.createElement('label');
      item.className = 'y-checklist-item';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'checkbox-control';
      check.value = col;

      if (preserveChecked) {
        if (previousChecked.includes(col)) {
          check.checked = true;
          checkedCount++;
        }
      } else {
        if (isNumeric && checkedCount < 5) {
          check.checked = true;
          checkedCount++;
        }
      }

      check.addEventListener('change', handleYChecklistChange);

      const labelText = document.createTextNode(` ${col}`);

      item.appendChild(check);
      item.appendChild(labelText);
      yAxisChecklist.appendChild(item);
    });

    manageYChecklistLimits();
    updateSelectedYAxes();
  }

  function manageYChecklistLimits() {
    const checkedCheckboxes = yAxisChecklist.querySelectorAll('input:checked');
    const checkboxes = yAxisChecklist.querySelectorAll('input[type="checkbox"]');

    if (checkedCheckboxes.length >= 5) {
      checkboxes.forEach(cb => {
        if (!cb.checked) {
          cb.disabled = true;
          cb.parentElement.classList.add('disabled-pill');
        } else {
          cb.disabled = false;
          cb.parentElement.classList.remove('disabled-pill');
        }
      });
    } else {
      checkboxes.forEach(cb => {
        cb.disabled = false;
        cb.parentElement.classList.remove('disabled-pill');
      });
    }
  }

  function handleYChecklistChange(e) {
    const checkedCheckboxes = yAxisChecklist.querySelectorAll('input:checked');
    if (checkedCheckboxes.length > 5) {
      e.target.checked = false;
      alert('Maximum 5 Y-Axis columns (legend items) are allowed.');
      return;
    }

    manageYChecklistLimits();
    updateSelectedYAxes();
    saveSession();
    if (configSection.classList.contains('revealed-section')) {
      triggerChartRender();
    }
  }

  function updateSelectedYAxes() {
    const checked = [];
    yAxisChecklist.querySelectorAll('input:checked').forEach(input => {
      checked.push(input.value);
    });
    state.chartConfig.yAxes = checked;
  }

  // --- UI Controls Display Updates ---
  function updateUIForChartType(type) {
    if (pillSmooth) pillSmooth.style.display = (type === 'line' || type === 'area') ? '' : 'none';
    if (lineSmoothGroup) lineSmoothGroup.style.display = 'none'; // legacy span - always hidden
    barModeGroup.style.display = (type === 'bar') ? '' : 'none';
    pieOptionsGroup.style.display = (type === 'pie') ? '' : 'none';
    histogramOptionsGroup.style.display = (type === 'histogram') ? '' : 'none';
    scatterOptionsGroup.style.display = (type === 'scatter') ? '' : 'none';

    // Dynamically update the centered page title and description
    const pageTitleEl = document.getElementById('page-title');
    const pageDescEl = document.getElementById('page-desc');
    if (pageTitleEl && chartTypeLabels[type]) {
      pageTitleEl.textContent = chartTypeLabels[type];
    }

    if (pageDescEl) {
      if (type === 'scatter') {
        pageDescEl.textContent = "Upload a CSV with numeric X and Y columns and plotox renders a scatter plot with optional regression overlay. Every point stays visible — nothing aggregated.";
      } else if (type === 'line') {
        pageDescEl.textContent = "Simply upload your CSV dataset, configure your X and Y parameters, and allow plotox to automatically generate a dynamic line chart, export it on excellent quality.";
      } else if (type === 'bar') {
        pageDescEl.textContent = "Upload a CSV with numeric values and plotox renders a bar chart with grouped or stacked layout options, interactive tooltips, and image downloads.";
      } else if (type === 'area') {
        pageDescEl.textContent = "Upload a CSV with numeric values and plotox renders an area chart with smooth lines, high-fidelity vector exports, and interactive tooltips.";
      } else if (type === 'pie') {
        pageDescEl.textContent = "Upload a CSV and plotox renders a pie or donut chart. Instantly calculate proportions and export high-resolution presentation slides.";
      } else if (type === 'histogram') {
        pageDescEl.textContent = "Upload a CSV with a single numeric variable and plotox renders a distribution histogram with auto or custom bin sizes.";
      }
    }
    updateHeaderStrip();
    updateToolbarForChartType(type);
  }

  function updateToolbarForChartType(type) {
    const mountPoint = document.getElementById('dynamic-toolbar-controls');
    if (!mountPoint) return;

    mountPoint.innerHTML = '';

    // Helper to create a toggle button
    function createToggleButton(id, label, iconHtml, activeStateGetter, toggleAction) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-toggle-pill';
      btn.id = id;

      const isActive = activeStateGetter();
      btn.classList.toggle('active', isActive);

      btn.innerHTML = `
        <span class="custom-checkbox"></span>
        ${iconHtml ? `<span class="material-symbols-outlined" style="font-size: 14px;">${iconHtml}</span>` : ''}
        <span>${label}</span>
      `;

      btn.addEventListener('click', () => {
        const nextState = !btn.classList.contains('active');
        btn.classList.toggle('active', nextState);
        toggleAction(nextState);
        saveSession();
        triggerChartRender();
      });

      mountPoint.appendChild(btn);
    }

    // Helper to create a select dropdown button or a cycling pill
    function createCycleButton(id, label, options, currentValueGetter, selectAction) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-toggle-pill';
      btn.id = id;

      const currentVal = currentValueGetter();
      btn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 14px;">expand_more</span>
        <span>${label}: <strong>${currentVal}</strong></span>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentIdx = options.indexOf(String(currentVal));
        const nextIdx = (currentIdx + 1) % options.length;
        const nextVal = options[nextIdx];
        selectAction(nextVal);
        saveSession();
        triggerChartRender();
        updateToolbarForChartType(type); // Re-render toolbar to update text
      });

      mountPoint.appendChild(btn);
    }

    // Shared: Gridlines Toggle
    const isGridOn = () => state.chartConfig.showXGrid !== false || state.chartConfig.showYGrid !== false;
    const toggleGrid = (active) => {
      state.chartConfig.showXGrid = active;
      state.chartConfig.showYGrid = active;
      state.chartConfig.gridType = active ? 'dashed' : 'none';

      // Sync legacy config checkboxes/pills if they exist
      const checkGridlines = document.getElementById('check-gridlines-toolbar');
      if (checkGridlines) checkGridlines.checked = active;
      const toggleGridlines = document.getElementById('toggle-gridlines-toolbar');
      if (toggleGridlines) toggleGridlines.classList.toggle('active', active);
      if (pillXGrid) pillXGrid.classList.toggle('active', active);
      if (pillYGrid) pillYGrid.classList.toggle('active', active);
    };

    // Shared: Publication Mode Toggle
    const isPubOn = () => !!state.chartConfig.publicationMode;
    const togglePub = (active) => {
      state.chartConfig.publicationMode = active;
      if (checkPublication) checkPublication.checked = active;
      const togglePublication = document.getElementById('toggle-publication');
      if (togglePublication) togglePublication.classList.toggle('active', active);
    };

    if (type === 'line' || type === 'area') {
      createToggleButton('tb-gridlines', 'Gridlines', 'grid_on', isGridOn, toggleGrid);

      createToggleButton('tb-smooth', 'Smooth Line', 'gesture',
        () => !!state.chartConfig.lineSmooth,
        (active) => {
          state.chartConfig.lineSmooth = active;
          if (lineSmoothCheck) lineSmoothCheck.checked = active;
          if (pillSmooth) pillSmooth.classList.toggle('active', active);
          const toggleSmooth = document.getElementById('toggle-smooth-toolbar');
          if (toggleSmooth) toggleSmooth.classList.toggle('active', active);
          const checkSmooth = document.getElementById('check-smooth-toolbar');
          if (checkSmooth) checkSmooth.checked = active;
        }
      );

      createToggleButton('tb-points', 'Show Points', 'lens',
        () => state.chartConfig.showPoints !== false,
        (active) => {
          state.chartConfig.showPoints = active;
          if (checkPoints) checkPoints.checked = active;
          const togglePoints = document.getElementById('toggle-points');
          if (togglePoints) togglePoints.classList.toggle('active', active);
        }
      );

      createToggleButton('tb-minmax', 'Min / Max', 'vertical_align_center',
        () => !!state.chartConfig.showMinMax,
        (active) => {
          state.chartConfig.showMinMax = active;
          if (checkMinmax) checkMinmax.checked = active;
          const toggleMinmax = document.getElementById('toggle-minmax');
          if (toggleMinmax) toggleMinmax.classList.toggle('active', active);
        }
      );

      createToggleButton('tb-logy', 'Log scale (Y)', 'show_chart',
        () => !!state.chartConfig.logY,
        (active) => {
          state.chartConfig.logY = active;
          if (checkLogy) checkLogy.checked = active;
          const toggleLogy = document.getElementById('toggle-logy');
          if (toggleLogy) toggleLogy.classList.toggle('active', active);
        }
      );

      createToggleButton('tb-publication', 'Publication Style', 'menu_book', isPubOn, togglePub);

    } else if (type === 'bar') {
      createToggleButton('tb-gridlines', 'Gridlines', 'grid_on', isGridOn, toggleGrid);

      createToggleButton('tb-barmode', 'Stacked Bar Layout', 'bar_chart',
        () => state.chartConfig.barmode === 'stack',
        (active) => {
          state.chartConfig.barmode = active ? 'stack' : 'group';
          if (barModeSelect) barModeSelect.value = state.chartConfig.barmode;
        }
      );

      createToggleButton('tb-barlabels', 'Value Labels', 'label',
        () => !!state.chartConfig.showBarLabels,
        (active) => {
          state.chartConfig.showBarLabels = active;
        }
      );

      createToggleButton('tb-publication', 'Publication Style', 'menu_book', isPubOn, togglePub);

    } else if (type === 'scatter') {
      createToggleButton('tb-gridlines', 'Gridlines', 'grid_on', isGridOn, toggleGrid);

      createToggleButton('tb-trendline', 'Trendline Fit', 'trending_up',
        () => !!state.chartConfig.showTrendline,
        (active) => {
          state.chartConfig.showTrendline = active;
        }
      );

      createCycleButton('tb-pointsize', 'Point Size', ['8', '12', '16', '20'],
        () => state.chartConfig.scatterSize || '12',
        (val) => {
          state.chartConfig.scatterSize = val;
          if (scatterSizeSelect) scatterSizeSelect.value = val;
        }
      );

      createToggleButton('tb-logy', 'Log scale (Y)', 'show_chart',
        () => !!state.chartConfig.logY,
        (active) => {
          state.chartConfig.logY = active;
          if (checkLogy) checkLogy.checked = active;
          const toggleLogy = document.getElementById('toggle-logy');
          if (toggleLogy) toggleLogy.classList.toggle('active', active);
        }
      );

      createToggleButton('tb-publication', 'Publication Style', 'menu_book', isPubOn, togglePub);

    } else if (type === 'pie') {
      createToggleButton('tb-donut', 'Donut Style', 'donut_large',
        () => state.chartConfig.pieStyle === 'donut',
        (active) => {
          state.chartConfig.pieStyle = active ? 'donut' : 'pie';
          if (pieStyleSelect) pieStyleSelect.value = state.chartConfig.pieStyle;
        }
      );

      createToggleButton('tb-rosetype', 'Nightingale Rose Mode', 'bubble_chart',
        () => !!state.chartConfig.roseType,
        (active) => {
          state.chartConfig.roseType = active;
        }
      );

      createToggleButton('tb-percentage', 'Show Percentages', 'percent',
        () => !!state.chartConfig.showPiePercentages,
        (active) => {
          state.chartConfig.showPiePercentages = active;
        }
      );

      createToggleButton('tb-publication', 'Publication Style', 'menu_book', isPubOn, togglePub);

    } else if (type === 'histogram') {
      createToggleButton('tb-gridlines', 'Gridlines', 'grid_on', isGridOn, toggleGrid);

      createCycleButton('tb-bins', 'Bin Count', ['auto', '5', '10', '15', '20'],
        () => state.chartConfig.histogramBins || 'auto',
        (val) => {
          state.chartConfig.histogramBins = val;
          if (histogramBinsSelect) histogramBinsSelect.value = val;
        }
      );

      createToggleButton('tb-bellcurve', 'Bell Curve Overlay', 'insights',
        () => !!state.chartConfig.showBellCurve,
        (active) => {
          state.chartConfig.showBellCurve = active;
        }
      );

      createToggleButton('tb-publication', 'Publication Style', 'menu_book', isPubOn, togglePub);
    }
  }

  // --- ECharts Visual Rendering ---
  function triggerChartRender() {
    if (!state.dataset || !state.chartConfig.yAxes || state.chartConfig.yAxes.length === 0) {
      ChartEngine.render('chart-container', state.dataset, state.chartConfig, false);
      updateCustomLegend();
      return;
    }

    try {
      state.chartConfig.title = chartTitleInput.value || state.chartConfig.title;
      const isDark = document.documentElement.classList.contains('dark');
      ChartEngine.render('chart-container', state.dataset, state.chartConfig, isDark);

      // Track successful chart rendering
      if (window.PlotoxAnalytics) {
        window.PlotoxAnalytics.trackEvent('chart_rendered', {
          chart_type: state.chartConfig.chartType,
          y_axes_count: state.chartConfig.yAxes ? state.chartConfig.yAxes.length : 0,
          theme: isDark ? 'dark' : 'light'
        });
      }

      // Update custom HTML legend in header
      updateCustomLegend();

      // Sync the editable canvas title display
      syncCanvasTitle();

      // Attach legend click handler for color picking
      setupLegendClickHandler();
    } catch (err) {
      console.error('Chart rendering failed:', err);
    }
  }

  // --- Legend Click → Color Picker ---
  function setupLegendClickHandler() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    chart.off('legendselectchanged');
    chart.on('legendselectchanged', (params) => {
      if (isLegendReentry) return;

      isLegendReentry = true;
      // Immediately toggle the series visibility back to active to prevent it from disappearing
      chart.dispatchAction({
        type: 'legendSelect',
        name: params.name
      });
      isLegendReentry = false;

      // Open color picker for this series
      openLegendColorPicker(params.name, params.event);
    });
  }

  function openLegendColorPicker(seriesName, event) {
    if (!legendColorPopover || !legendColorSeriesName || !legendColorGrid) return;

    activeLegendSeries = seriesName;
    legendColorSeriesName.textContent = seriesName;

    // Populate color grid with swatches
    const colors = [
      '#6366f1', '#10b981', '#ea580c', '#3b82f6', '#ec4899', '#8b5cf6',
      '#f59e0b', '#14b8a6', '#ef4444', '#22c55e', '#06b6d4', '#a855f7',
      '#f97316', '#0ea5e9', '#d946ef', '#84cc16', '#e11d48', '#0891b2',
      '#7c3aed', '#059669', '#dc2626', '#2563eb', '#c026d3', '#65a30d'
    ];

    const currentColor = (state.chartConfig.seriesColors && state.chartConfig.seriesColors[seriesName]) || '';

    legendColorGrid.innerHTML = '';
    colors.forEach(color => {
      const swatch = document.createElement('button');
      swatch.className = 'legend-color-swatch' + (color === currentColor ? ' selected' : '');
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        applyLegendColor(seriesName, color);
        // Update swatch selection
        legendColorGrid.querySelectorAll('.legend-color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
      });
      legendColorGrid.appendChild(swatch);
    });

    // Set custom color input value
    if (legendColorCustom) {
      legendColorCustom.value = currentColor || '#6366f1';
    }

    // Position the popover dynamically beside the clicked legend item
    let pageX = 0;
    let pageY = 0;
    const nativeEvent = event && (event.event || event);
    if (nativeEvent) {
      if (nativeEvent.touches && nativeEvent.touches.length > 0) {
        pageX = nativeEvent.touches[0].clientX;
        pageY = nativeEvent.touches[0].clientY;
      } else if (nativeEvent.changedTouches && nativeEvent.changedTouches.length > 0) {
        pageX = nativeEvent.changedTouches[0].clientX;
        pageY = nativeEvent.changedTouches[0].clientY;
      } else {
        pageX = nativeEvent.clientX;
        pageY = nativeEvent.clientY;
      }
    }

    const chartWrapper = document.querySelector('.chart-canvas-wrapper');
    if (chartWrapper) {
      if (pageX && pageY) {
        const rect = chartWrapper.getBoundingClientRect();
        const relativeX = pageX - rect.left;
        const relativeY = pageY - rect.top;

        // Approximate popover dimensions to prevent boundary overflow
        const popoverWidth = 210;
        const popoverHeight = 170;

        let leftPos = relativeX + 15;
        let topPos = relativeY + 15;

        // Overflow checks
        if (leftPos + popoverWidth > rect.width) {
          leftPos = relativeX - popoverWidth - 15;
        }
        if (leftPos < 0) leftPos = 10;

        if (topPos + popoverHeight > rect.height) {
          topPos = relativeY - popoverHeight - 15;
        }
        if (topPos < 0) topPos = 10;

        legendColorPopover.style.left = `${leftPos}px`;
        legendColorPopover.style.top = `${topPos}px`;
      } else {
        // Fallback to top-left area of the chart canvas
        legendColorPopover.style.top = '50px';
        legendColorPopover.style.left = '20px';
      }
    }

    legendColorPopover.style.display = 'flex';
    justOpenedLegendColorPicker = true;
    setTimeout(() => {
      justOpenedLegendColorPicker = false;
    }, 50);
  }

  function closeLegendColorPicker() {
    if (legendColorPopover) {
      legendColorPopover.style.display = 'none';
    }
    activeLegendSeries = null;
    justOpenedLegendColorPicker = false;
  }

  function applyLegendColor(seriesName, color) {
    if (!state.chartConfig.seriesColors) {
      state.chartConfig.seriesColors = {};
    }
    state.chartConfig.seriesColors[seriesName] = color;
    saveSession();

    // Update custom HTML legend colors
    updateCustomLegend();

    // Trigger full themed render to ensure both series lines and min/max label colors update together in real-time
    triggerChartRender();
  }

  // --- Canvas Title Sync ---
  function applyHeaderStyles() {
    const display = document.getElementById('chart-canvas-title-display');
    const titleCenter = document.querySelector('.chart-canvas-title-center');
    if (!display) return;

    const conf = state.chartConfig;

    // Apply styles to HTML display element
    display.style.fontWeight = conf.titleWeight || '600';
    display.style.fontStyle = conf.titleStyle || 'normal';
    display.style.fontSize = conf.titleSize || '16px';
    display.style.letterSpacing = '0';
    display.style.textTransform = 'none';
    display.style.color = conf.titleColor || 'var(--color-primary)';

    if (titleCenter) {
      titleCenter.style.justifyContent = 'center';
      display.style.textAlign = 'center';
    }
  }

  function syncCanvasTitle() {
    const titleText = state.chartConfig.title || 'Interactive Chart';
    if (canvasTitleDisplay) {
      canvasTitleDisplay.textContent = titleText;
    }
    applyHeaderStyles();
  }

  // --- Custom HTML Legend Updates ---
  function updateCustomLegend() {
    const legendLeft = document.getElementById('chart-canvas-legend-left');
    if (!legendLeft) return;
    legendLeft.innerHTML = '';

    if (state.chartConfig.legendPosition === 'hidden') return;
    if (state.chartConfig.chartType === 'histogram' || state.chartConfig.chartType === 'pie' || state.chartConfig.chartType === 'donut') {
      return;
    }

    if (!state.chartConfig.yAxes || state.chartConfig.yAxes.length === 0) return;

    // Apply selected styling preferences to HTML legend text
    const conf = state.chartConfig;
    legendLeft.style.fontWeight = conf.titleWeight || '500';
    legendLeft.style.fontStyle = conf.titleStyle || 'normal';

    if (conf.titleSize) {
      const sizeVal = parseInt(conf.titleSize);
      if (sizeVal <= 12) legendLeft.style.fontSize = '11px';
      else if (sizeVal <= 16) legendLeft.style.fontSize = '13px';
      else if (sizeVal <= 20) legendLeft.style.fontSize = '15px';
      else legendLeft.style.fontSize = '17px';
    }

    if (conf.titleColor && !conf.titleColor.startsWith('var(')) {
      legendLeft.style.color = conf.titleColor;
    } else {
      legendLeft.style.color = '';
    }

    const palettes = {
      classic: ['#6366f1', '#10b981', '#ea580c', '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#14b8a6'],
      vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676', '#ff007f', '#3a0ca3'],
      orange: ['#ff6b35', '#f7c59f', '#efefd0', '#004e64', '#25a18e', '#ff8f5a', '#e76f51', '#f4a261'],
      forest: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#d8f3dc', '#1b4332', '#081c15'],
      ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4', '#caf0f8'],
      monochrome: ['#212529', '#343a40', '#495057', '#6c757d', '#adb5bd', '#dee2e6', '#e9ecef', '#f8f9fa']
    };
    const activePalette = palettes[state.chartConfig.colorPalette] || palettes.classic;

    state.chartConfig.yAxes.forEach((yCol, idx) => {
      const color = (state.chartConfig.seriesColors && state.chartConfig.seriesColors[yCol]) || activePalette[idx % activePalette.length];

      const item = document.createElement('div');
      item.className = 'legend-item-custom';
      item.title = `Click to change color for ${yCol}`;

      const line = document.createElement('span');
      line.className = 'legend-line-custom';
      line.style.backgroundColor = color;

      const label = document.createElement('span');
      label.textContent = yCol;

      item.appendChild(line);
      item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openLegendColorPicker(yCol, e);
      });

      legendLeft.appendChild(item);
    });
  }



  // --- Canvas Title Edit Mode ---
  function enterCanvasTitleEdit() {
    if (!canvasTitleDisplay || !canvasTitleEdit || !canvasTitleInput) return;
    canvasTitleDisplay.style.display = 'none';
    canvasTitleEdit.style.display = 'flex';
    canvasTitleInput.value = state.chartConfig.title || '';
    canvasTitleInput.focus();
    canvasTitleInput.select();
  }

  function exitCanvasTitleEdit(save) {
    if (!canvasTitleDisplay || !canvasTitleEdit || !canvasTitleInput) return;
    if (save) {
      const newTitle = canvasTitleInput.value.trim();
      state.chartConfig.title = newTitle;
      chartTitleInput.value = newTitle;
      if (configChartTitle) configChartTitle.value = newTitle;
      saveSession();
      triggerChartRender();
    }
    canvasTitleEdit.style.display = 'none';
    canvasTitleDisplay.style.display = 'inline-flex';
    syncCanvasTitle();
  }

  // Stats row sync functionality removed to purge stats summary widgets

  // ═══════════════════════════════════════════
  // EDIT DATA MODAL CONTROLLER
  // ═══════════════════════════════════════════
  let edmHeaders = [];
  let edmRows = [];

  function openEditDataModal() {
    if (!state.dataset) return;
    // Deep-clone current dataset into modal working copies
    edmHeaders = [...state.dataset.headers];
    edmRows = state.dataset.rows.map(r => [...r]);
    renderEdmGrid();
    document.getElementById('edit-data-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeEditDataModal() {
    document.getElementById('edit-data-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderEdmGrid() {
    const thead = document.getElementById('edm-thead');
    const tbody = document.getElementById('edm-tbody');
    const badge = document.getElementById('edm-badge');
    badge.textContent = `${edmRows.length} rows × ${edmHeaders.length} cols`;

    // Header row
    thead.innerHTML = '';
    const hRow = document.createElement('tr');
    const numTh = document.createElement('th');
    numTh.className = 'edm-row-num-header';
    numTh.textContent = '#';
    hRow.appendChild(numTh);

    edmHeaders.forEach((h, colIdx) => {
      const th = document.createElement('th');
      const type = (state.dataset && state.dataset.types[h]) ? state.dataset.types[h] : 'text';
      th.innerHTML = `
        <div class="edm-th-inner" data-col="${colIdx}">
          <span class="edm-th-label">${escapeHTML(h)}</span>
          <span class="edm-th-type">${type.slice(0, 3)}</span>
          <button class="edm-th-delete" data-col="${colIdx}" title="Delete column">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      `;
      // Double-click to rename
      th.querySelector('.edm-th-inner').addEventListener('dblclick', () => edmRenameHeader(colIdx, th));
      // Delete column button
      th.querySelector('.edm-th-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        edmDeleteColumn(colIdx);
      });
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);

    // Body rows
    tbody.innerHTML = '';
    edmRows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      // Row number cell with delete on hover
      const numTd = document.createElement('td');
      numTd.className = 'edm-row-delete';
      numTd.title = 'Click to delete row';
      numTd.innerHTML = `
        <span class="edm-row-num-text">${rowIdx + 1}</span>
        <span class="material-symbols-outlined edm-row-del-icon">delete</span>
      `;
      numTd.addEventListener('click', () => edmDeleteRow(rowIdx));
      tr.appendChild(numTd);

      row.forEach((cell, colIdx) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edm-cell-input';
        input.value = cell != null ? String(cell) : '';
        input.addEventListener('change', (e) => {
          edmRows[rowIdx][colIdx] = e.target.value;
        });
        td.appendChild(input);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function edmRenameHeader(colIdx, thEl) {
    const inner = thEl.querySelector('.edm-th-inner');
    const oldName = edmHeaders[colIdx];
    inner.innerHTML = `<input type="text" class="edm-th-edit-input" value="${escapeHTML(oldName)}">`;
    const inp = inner.querySelector('.edm-th-edit-input');
    inp.focus();
    inp.select();

    function commit() {
      const newName = inp.value.trim();
      if (newName && newName !== oldName) {
        if (edmHeaders.includes(newName)) {
          showUserError('Duplicate column name.');
        } else {
          edmHeaders[colIdx] = newName;
        }
      }
      renderEdmGrid();
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { renderEdmGrid(); }
    });
  }

  function edmDeleteColumn(colIdx) {
    if (edmHeaders.length <= 1) {
      showUserError('Cannot delete the last column.');
      return;
    }
    edmHeaders.splice(colIdx, 1);
    edmRows.forEach(r => r.splice(colIdx, 1));
    renderEdmGrid();
  }

  function edmDeleteRow(rowIdx) {
    if (edmRows.length <= 1) {
      showUserError('Cannot delete the last row.');
      return;
    }
    edmRows.splice(rowIdx, 1);
    renderEdmGrid();
  }

  function edmAddRow() {
    edmRows.push(edmHeaders.map(() => ''));
    renderEdmGrid();
    // Scroll to bottom
    const scroll = document.getElementById('edm-grid-scroll');
    if (scroll) setTimeout(() => scroll.scrollTop = scroll.scrollHeight, 50);
  }

  function edmAddColumn() {
    let colName = 'Column_' + (edmHeaders.length + 1);
    let suffix = 1;
    while (edmHeaders.includes(colName)) {
      suffix++;
      colName = 'Column_' + (edmHeaders.length + suffix);
    }
    edmHeaders.push(colName);
    edmRows.forEach(r => r.push(''));
    renderEdmGrid();
    // Scroll to right
    const scroll = document.getElementById('edm-grid-scroll');
    if (scroll) setTimeout(() => scroll.scrollLeft = scroll.scrollWidth, 50);
  }

  function edmSwapRowsCols() {
    const newHeaders = ['label', ...edmRows.map((_, i) => 'Row_' + (i + 1))];
    const newRows = edmHeaders.map((h, colIdx) => {
      return [h, ...edmRows.map(r => r[colIdx] != null ? String(r[colIdx]) : '')];
    });
    edmHeaders = newHeaders;
    edmRows = newRows;
    renderEdmGrid();
  }

  function edmClearTable() {
    edmRows = edmRows.map(r => r.map(() => ''));
    renderEdmGrid();
  }

  function edmApplyChanges() {
    // Rebuild CSV text from modal state
    const delimiter = delimiterSelect.value || ',';
    const csvLines = [edmHeaders.join(delimiter)];
    edmRows.forEach(row => {
      csvLines.push(row.map(cell => {
        const s = String(cell);
        if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(delimiter));
    });
    const newCSV = csvLines.join('\n');
    pasteText.value = newCSV;
    parseAndLoadData(newCSV, activeFilename || 'edited_data.csv', delimiterSelect.value);
    closeEditDataModal();
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderWorkspaceExcelGrid() {
    if (!workspaceGridContainer) return;

    if (!state.dataset || !state.dataset.headers || state.dataset.headers.length === 0) {
      workspaceGridContainer.innerHTML = `
        <div class="workspace-grid-empty">
          <span class="material-symbols-outlined">table_view</span>
          <p>No data loaded. Please upload a file or paste data in the Preview tab.</p>
        </div>
      `;
      return;
    }

    const { headers, rows, types } = state.dataset;

    // Create table elements
    let html = `<table class="workspace-excel-table">`;

    // Header Row
    html += `<thead><tr>`;
    // Line number header
    html += `<th class="excel-row-num-header">#</th>`;
    headers.forEach(header => {
      const type = types[header] || 'text';
      html += `
        <th>
          <div class="excel-th-inner">
            <span class="excel-th-label">${escapeHTML(header)}</span>
            <span class="excel-th-type">${type.slice(0, 3)}</span>
          </div>
        </th>
      `;
    });
    html += `</tr></thead>`;

    // Body Rows
    html += `<tbody>`;
    rows.forEach((row, rowIdx) => {
      html += `<tr>`;
      html += `<td class="excel-row-num">${rowIdx + 1}</td>`;
      row.forEach(cell => {
        html += `<td><span class="excel-cell-val">${escapeHTML(cell != null ? String(cell) : '')}</span></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    workspaceGridContainer.innerHTML = html;
  }

  // --- Wire up modal buttons ---
  (function initEditDataModal() {
    const overlay = document.getElementById('edit-data-overlay');
    const collapseBtn = document.getElementById('edm-collapse-btn');
    const cancelBtn = document.getElementById('edm-cancel-btn');
    const applyBtn = document.getElementById('edm-apply-btn');
    const addRowBtn = document.getElementById('edm-add-row-btn');
    const addColBtn = document.getElementById('edm-add-col-btn');
    const swapBtn = document.getElementById('edm-swap-btn');
    const clearBtn = document.getElementById('edm-clear-btn');

    if (collapseBtn) collapseBtn.addEventListener('click', closeEditDataModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditDataModal);
    if (applyBtn) applyBtn.addEventListener('click', edmApplyChanges);
    if (addRowBtn) addRowBtn.addEventListener('click', edmAddRow);
    if (addColBtn) addColBtn.addEventListener('click', edmAddColumn);
    if (swapBtn) swapBtn.addEventListener('click', edmSwapRowsCols);
    if (clearBtn) clearBtn.addEventListener('click', edmClearTable);

    // Click overlay backdrop to close
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeEditDataModal();
      });
    }
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
        closeEditDataModal();
      }
    });
  })();

  // --- History and Restoration Management ---
  function loadHistoryList() {
    const historyDropdown = document.getElementById('sidebar-history-dropdown');
    if (!historyDropdown) return;

    if (typeof HistoryStorage === 'undefined') return;

    const history = HistoryStorage.getHistory();
    historyDropdown.innerHTML = '';

    if (history.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '8px 10px';
      emptyMsg.style.fontSize = '11px';
      emptyMsg.style.color = 'var(--color-outline)';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.textContent = 'No history yet';
      historyDropdown.appendChild(emptyMsg);
      return;
    }

    history.forEach(entry => {
      const btn = document.createElement('button');
      btn.className = 'sidebar-history-btn';
      btn.setAttribute('data-id', entry.id);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'history-title';
      titleSpan.textContent = entry.filename;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'history-meta';

      let dateStr = '';
      try {
        const d = new Date(entry.date);
        dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (err) {
        dateStr = entry.date;
      }

      const typeLabel = entry.chartType ? (entry.chartType.charAt(0).toUpperCase() + entry.chartType.slice(1)) : 'Chart';
      metaSpan.textContent = `${typeLabel} · ${dateStr}`;

      btn.appendChild(titleSpan);
      btn.appendChild(metaSpan);

      btn.addEventListener('click', () => {
        restoreSession(entry);
        switchView('workspace');
      });

      historyDropdown.appendChild(btn);
    });
  }

  function restoreSession(session) {
    if (!session) return;
    const sizeGuard = FileSizeGuard.validateText(session.rawText, session.filename || 'Session data');
    if (!sizeGuard.valid) {
      showUserError(sizeGuard.errorMessage, sizeGuard.title);
      return;
    }
    try {
      activeFilename = session.filename;
      activeCSVText = session.rawText;
      state.chartConfig = Object.assign({}, state.chartConfig, session.config);

      // Restore UI values
      chartTitleInput.value = state.chartConfig.title || '';
      if (configChartTitle) configChartTitle.value = state.chartConfig.title || '';
      syncCanvasTitle();
      if (configXLabel) configXLabel.value = state.chartConfig.xAxisLabel || '';
      if (configYLabel) configYLabel.value = state.chartConfig.yAxisLabel || '';
      if (configColorPalette) configColorPalette.value = state.chartConfig.colorPalette || 'classic';
      if (configXRotation) configXRotation.value = String(state.chartConfig.xAxisLabelRotate || 0);
      if (configLegendPosition) configLegendPosition.value = state.chartConfig.legendPosition || 'bottom';
      if (showXGridCheck) showXGridCheck.checked = state.chartConfig.showXGrid !== false;
      if (showYGridCheck) showYGridCheck.checked = state.chartConfig.showYGrid !== false;
      if (showTooltipCheck) showTooltipCheck.checked = state.chartConfig.showTooltip !== false;
      showGridCheck.checked = state.chartConfig.showGrid !== false;
      showLegendCheck.checked = state.chartConfig.showLegend !== false;
      lineSmoothCheck.checked = !!state.chartConfig.lineSmooth;

      if (barModeSelect) barModeSelect.value = state.chartConfig.barmode || 'group';
      if (pieStyleSelect) pieStyleSelect.value = state.chartConfig.pieStyle || 'pie';
      if (histogramBinsSelect) histogramBinsSelect.value = state.chartConfig.histogramBins || 'auto';
      if (scatterSizeSelect) scatterSizeSelect.value = state.chartConfig.scatterSize || '12';

      if (checkPublication) checkPublication.checked = !!state.chartConfig.publicationMode;
      if (checkLogy) checkLogy.checked = !!state.chartConfig.logY;
      if (checkPoints) checkPoints.checked = state.chartConfig.showPoints !== false;
      if (checkMinmax) checkMinmax.checked = !!state.chartConfig.showMinMax;

      // Highlight active chart type in grid
      chartTypeButtons.forEach(btn => {
        if (btn.getAttribute('data-type') === state.chartConfig.chartType) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      updateUIForChartType(state.chartConfig.chartType);

      // Populate delimiter select if detected
      if (state.chartConfig.delimiter) {
        delimiterSelect.value = state.chartConfig.delimiter;
      }

      // Parse and restore dataset
      const parsed = DataParser.parse(activeCSVText, delimiterSelect.value);
      state.dataset = parsed;

      // Restore CSV text in paste area
      pasteText.value = activeCSVText;

      // Populate axes selects
      populateSelectors();
      xAxisSelect.value = state.chartConfig.xAxis;
      updateActiveXPill();
      populateYChecklist(true);

      // Show edit-data bar and unlock generate button
      editDataBar.style.display = 'flex';
      dataMetaBadge.textContent = `${parsed.headers.length} columns · ${parsed.rows.length} rows`;
      enableWorkflow();

      // Auto-reveal and plot on restored session
      revealSections(true);

      // Highlight active sample
      sampleButtons.forEach(btn => {
        if (activeFilename.includes(btn.getAttribute('data-sample'))) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Save as active session in sessionStorage
      saveSession();
    } catch (e) {
      console.error("Error restoring session:", e);
      showUserError("Failed to restore history session: " + e.message);
    }
  }

  // --- Local Session Management ---
  function saveSession() {
    const sm = safeStorage();
    if (sm && activeFilename && activeCSVText) {
      try {
        sm.saveActiveSession(activeFilename, activeCSVText, state.chartConfig);
      } catch (e) {
        console.warn('Session saving error:', e);
      }
    }
  }

  // --- File and string cleaning helpers ---
  function cleanFilename(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
  }

  function debounce(func, wait) {
    let timeout;
    return function (e) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(e), wait);
    };
  }

  // --- View Control ---
  function switchView(viewName) {
    const workspacePanel = document.getElementById('workspace-view-panel');
    const historyPanel = document.getElementById('workspace-history-panel');
    const cleanerPanel = document.getElementById('workspace-cleaner-panel');
    const settingsPanel = document.getElementById('workspace-settings-panel');
    const pageHeader = document.querySelector('.page-header');
    const chartsDropdown = document.getElementById('nav-charts-dropdown');
    const chartsChevron = document.getElementById('nav-charts-chevron');

    // All nav buttons
    const chartsBtn = document.getElementById('nav-charts-btn');
    const dataCleanerBtn = document.getElementById('nav-data-cleaner-btn');
    const projectsBtn = document.getElementById('nav-projects-btn');
    const settingsBtn = document.getElementById('nav-settings-btn');

    // Hide all panels
    if (workspacePanel) workspacePanel.style.display = 'none';
    if (historyPanel) historyPanel.style.display = 'none';
    if (cleanerPanel) cleanerPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';

    // Deactivate all nav buttons
    [chartsBtn, dataCleanerBtn, projectsBtn, settingsBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    // Handle 'workspace' as alias for 'charts' (backward compat)
    if (viewName === 'workspace') viewName = 'charts';
    // Handle 'history' as alias for 'projects' (backward compat)
    if (viewName === 'history') viewName = 'projects';

    // Reset Data Cleaner if leaving the cleaner view to free up DOM and memory resources
    if (viewName !== 'cleaner') {
      if (typeof window.plotoxResetCleaner === 'function') {
        window.plotoxResetCleaner();
      }
    }

    switch (viewName) {
      case 'charts':
        if (workspacePanel) workspacePanel.style.display = 'block';
        if (chartsBtn) chartsBtn.classList.add('active');
        if (pageHeader) pageHeader.style.display = '';
        if (chartsDropdown) {
          chartsDropdown.classList.add('open');
          chartsDropdown.style.display = 'flex';
        }
        if (chartsChevron) {
          chartsChevron.style.transform = 'rotate(180deg)';
        }
        break;
      case 'cleaner':
        if (cleanerPanel) cleanerPanel.style.display = 'block';
        if (dataCleanerBtn) dataCleanerBtn.classList.add('active');
        if (pageHeader) pageHeader.style.display = 'none';
        if (chartsDropdown) {
          chartsDropdown.classList.remove('open');
          chartsDropdown.style.display = 'none';
        }
        if (chartsChevron) {
          chartsChevron.style.transform = 'rotate(0deg)';
        }
        break;
      case 'projects':
        if (historyPanel) historyPanel.style.display = 'block';
        if (projectsBtn) projectsBtn.classList.add('active');
        if (pageHeader) pageHeader.style.display = 'none';
        drawHistoryDashboard();
        if (chartsDropdown) {
          chartsDropdown.classList.remove('open');
          chartsDropdown.style.display = 'none';
        }
        if (chartsChevron) {
          chartsChevron.style.transform = 'rotate(0deg)';
        }
        break;
      case 'settings':
        if (settingsPanel) settingsPanel.style.display = 'block';
        if (settingsBtn) settingsBtn.classList.add('active');
        if (pageHeader) pageHeader.style.display = 'none';
        if (chartsDropdown) {
          chartsDropdown.classList.remove('open');
          chartsDropdown.style.display = 'none';
        }
        if (chartsChevron) {
          chartsChevron.style.transform = 'rotate(0deg)';
        }
        break;
    }
    updateHeaderStrip();
  }

  // Expose switchView globally for cross-module communication
  window.plotoxSwitchView = switchView;

  // --- Load cleaned data from Data Cleaner ---
  window.plotoxLoadCleanerData = function () {
    try {
      const csvText = sessionStorage.getItem('plotox-cleaner-csv');
      const filename = sessionStorage.getItem('plotox-cleaner-filename') || 'cleaned_data.csv';
      if (csvText) {
        const sizeGuard = FileSizeGuard.validateText(csvText, filename);
        if (!sizeGuard.valid) {
          showUserError(sizeGuard.errorMessage, sizeGuard.title);
          sessionStorage.removeItem('plotox-cleaner-csv');
          sessionStorage.removeItem('plotox-cleaner-filename');
          return;
        }
        switchView('charts');
        activeFilename = filename;
        activeCSVText = csvText;
        pasteText.value = csvText;
        const parsed = DataParser.parse(csvText);
        state.dataset = parsed;
        populateSelectors();
        enableWorkflow();
        if (editDataBar) editDataBar.style.display = 'flex';
        if (dataMetaBadge) dataMetaBadge.textContent = `${parsed.headers.length} columns · ${parsed.rows.length} rows`;
        saveSession();
        sessionStorage.removeItem('plotox-cleaner-csv');
        sessionStorage.removeItem('plotox-cleaner-filename');
      }
    } catch (e) {
      console.error('Failed to load cleaner data:', e);
    }
  };

  // --- Dynamic Header Strip Update ---
  function updateHeaderStrip() {
    const breadcrumbCurrentView = document.getElementById('breadcrumb-current-view');
    const headerStripActions = document.getElementById('header-strip-actions');
    const pageTitleEl = document.getElementById('page-title');
    const pageDescEl = document.getElementById('page-desc');

    if (!pageTitleEl) return;

    const isHistory = document.getElementById('workspace-history-panel') &&
      document.getElementById('workspace-history-panel').style.display !== 'none';

    if (isHistory) {
      if (breadcrumbCurrentView) breadcrumbCurrentView.textContent = 'History';
      if (pageTitleEl) pageTitleEl.textContent = 'Archive';
      if (pageDescEl) pageDescEl.textContent = 'Your previously parsed datasets and visual configurations. Click any card to restore the workspace instantly.';

      let historyCount = 0;
      if (typeof HistoryStorage !== 'undefined') {
        historyCount = HistoryStorage.getHistory().length;
      }
      if (headerStripActions) {
        headerStripActions.innerHTML = `
          <div class="status-badge">
            <span class="status-dot info"></span>
            <span>${historyCount} session${historyCount !== 1 ? 's' : ''} saved</span>
          </div>
        `;
      }
    } else {
      const type = state.chartConfig.chartType || 'line';
      if (breadcrumbCurrentView) breadcrumbCurrentView.textContent = 'Workspace';

      // Sync workspace title and description
      if (pageTitleEl && chartTypeLabels[type]) {
        pageTitleEl.textContent = chartTypeLabels[type];
      }

      if (pageDescEl) {
        if (type === 'scatter') {
          pageDescEl.textContent = "Upload a CSV with numeric X and Y columns and plotox renders a scatter plot with optional regression overlay. Every point stays visible — nothing aggregated.";
        } else if (type === 'line') {
          pageDescEl.textContent = "Simply upload your CSV dataset, configure your X and Y parameters, and allow plotox to automatically generate a dynamic line chart, export it on excellent quality.";
        } else if (type === 'bar') {
          pageDescEl.textContent = "Upload a CSV with numeric values and plotox renders a bar chart with grouped or stacked layout options, interactive tooltips, and image downloads.";
        } else if (type === 'area') {
          pageDescEl.textContent = "Upload a CSV with numeric values and plotox renders an area chart with smooth lines, high-fidelity vector exports, and interactive tooltips.";
        } else if (type === 'pie') {
          pageDescEl.textContent = "Upload a CSV and plotox renders a pie or donut chart. Instantly calculate proportions and export high-resolution presentation slides.";
        } else if (type === 'histogram') {
          pageDescEl.textContent = "Upload a CSV with a single numeric variable and plotox renders a distribution histogram with auto or custom bin sizes.";
        }
      }

      const hasData = !!state.dataset;
      if (hasData) {
        const rowCount = state.dataset.rows ? state.dataset.rows.length : 0;
        if (headerStripActions) {
          headerStripActions.innerHTML = `
            <div class="status-badge">
              <span class="status-dot active"></span>
              <span>Dataset Active (${rowCount} rows)</span>
            </div>
          `;
        }
      } else {
        if (headerStripActions) {
          headerStripActions.innerHTML = `
            <div class="status-badge">
              <span class="status-dot waiting"></span>
              <span>Waiting for CSV Data</span>
            </div>
          `;
        }
      }
    }
  }

  function drawHistoryDashboard() {
    const panel = document.getElementById('history-grid-container');
    if (!panel) return;

    if (typeof HistoryStorage === 'undefined') {
      panel.innerHTML = '<div class="history-empty-state"><p>History storage not available.</p></div>';
      return;
    }

    const history = HistoryStorage.getHistory();
    const descEl = document.querySelector('.history-archive-desc');
    const clearBtn = document.getElementById('clear-history-btn');

    if (history.length === 0) {
      if (descEl) {
        descEl.textContent = 'No saved CSVs yet – paste or upload data in any tool and it will show up here.';
      }
      if (clearBtn) {
        clearBtn.style.display = 'none';
      }
      panel.innerHTML = `
        <div class="history-empty-container-mockup">
          <div class="history-empty-icon-circle">
            <span class="material-symbols-outlined">history</span>
          </div>
          <h3 class="history-empty-title-mockup">No Charts Data</h3>
          <p class="history-empty-desc-mockup">Paste or upload a CSV in any tool and it will appear here so you can reopen it with one click.</p>
        </div>
      `;
      return;
    } else {
      if (descEl) {
        descEl.textContent = 'Your recent Projects – click Import to load one back with a pre-filled dataset.';
      }
      if (clearBtn) {
        clearBtn.style.display = 'inline-flex';
      }
    }

    function getRelativeTimeString(date) {
      const now = new Date();
      const diffMs = now - new Date(date);
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHr / 24);

      if (diffDays > 0) {
        return `${diffDays}d ago`;
      } else if (diffHr > 0) {
        return `${diffHr}h ago`;
      } else if (diffMin > 0) {
        return `${diffMin}m ago`;
      } else {
        return 'Just now';
      }
    }

    const chartTypeMockupLabels = {
      line: 'LINE CHART',
      bar: 'BAR CHART',
      scatter: 'SCATTER PLOT',
      area: 'AREA CHART',
      pie: 'PIE CHART',
      histogram: 'HISTOGRAM'
    };

    let html = `
      <div class="history-list-wrapper">
        <table class="history-list-table">
          <thead>
            <tr>
              <th class="col-file">FILE</th>
              <th class="col-type">TYPE</th>
              <th class="col-size">SIZE</th>
              <th class="col-when">WHEN</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
    `;

    history.forEach(entry => {
      const dateStr = getRelativeTimeString(entry.date);
      const type = entry.chartType || 'line';
      const typeMockupText = chartTypeMockupLabels[type] || (type + ' CHART').toUpperCase();

      const rowsCount = entry.config && entry.config.rowsCount || 0;
      const colsCount = entry.config && entry.config.colsCount || 0;

      let finalRows = rowsCount;
      let finalCols = colsCount;
      if (!finalRows && entry.rawText) {
        try {
          const lines = entry.rawText.split('\n').filter(l => l.trim() !== '');
          finalRows = Math.max(0, lines.length - 1);
          if (lines.length > 0) {
            finalCols = lines[0].split(entry.config.delimiter || ',').length;
          }
        } catch (e) { }
      }

      html += `
        <tr class="history-list-row" data-id="${entry.id}">
          <td class="col-file">
            <span class="history-filename-monospace" title="${escapeHTML(entry.filename)}">${escapeHTML(entry.filename)}</span>
          </td>
          <td class="col-type">
            <span class="history-badge-pill chart-${type}">${typeMockupText}</span>
          </td>
          <td class="col-size">
            <span class="history-size-text">${finalRows} &times; ${finalCols}</span>
          </td>
          <td class="col-when">
            <span class="history-when-text">${dateStr}</span>
          </td>
          <td class="col-actions">
            <div class="action-buttons-cell-mockup">
              <button class="history-import-link history-btn-restore" data-id="${entry.id}">
                <span>Import</span>
              </button>
              <button class="history-action-square-btn history-btn-copy" data-id="${entry.id}" title="Copy CSV to clipboard">
                <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
              </button>
              <button class="history-action-square-btn history-btn-delete" data-id="${entry.id}" title="Delete session">
                <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    panel.innerHTML = html;

    // Attach event listeners
    panel.querySelectorAll('.history-btn-restore').forEach(btn => {
      btn.addEventListener('click', () => {
        const entryId = btn.getAttribute('data-id');
        const entry = history.find(e => e.id === entryId);
        if (entry) {
          restoreSession(entry);
          switchView('workspace');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    panel.querySelectorAll('.history-btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entryId = btn.getAttribute('data-id');
        const entry = history.find(e => e.id === entryId);
        if (entry && entry.rawText) {
          navigator.clipboard.writeText(entry.rawText)
            .then(() => {
              const existing = document.querySelector('.toast-notification');
              if (existing) existing.remove();
              const toast = document.createElement('div');
              toast.className = 'toast-notification success';
              toast.innerHTML = `
                <span class="material-symbols-outlined">check_circle</span>
                <span>CSV data copied to clipboard!</span>
              `;
              document.body.appendChild(toast);
              setTimeout(() => {
                toast.style.animation = 'slideUpFade 0.3s ease-in reverse';
                setTimeout(() => toast.remove(), 300);
              }, 3000);
            })
            .catch(() => {
              showUserError('Failed to copy CSV data to clipboard');
            });
        }
      });
    });

    panel.querySelectorAll('.history-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const entryId = btn.getAttribute('data-id');
        deleteHistoryEntry(entryId);
      });
    });
  }

  function deleteHistoryEntry(id) {
    if (typeof HistoryStorage === 'undefined') return;
    const history = HistoryStorage.getHistory();
    const filtered = history.filter(item => item.id !== id);
    HistoryStorage.saveHistory(filtered);
    loadHistoryList();
    drawHistoryDashboard();
    updateHeaderStrip();
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- How to use modal wire-up ---
  (function initHowToUseModal() {
    const overlay = document.getElementById('how-to-use-overlay');
    const btn = document.getElementById('how-to-use-btn');
    const closeBtn = document.getElementById('htu-close-btn');
    const okBtn = document.getElementById('htu-ok-btn');

    if (!overlay) return;

    const openModal = () => {
      overlay.classList.add('open');
    };

    const closeModal = () => {
      overlay.classList.remove('open');
    };

    if (btn) btn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (okBtn) okBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        closeModal();
      }
    });
  })();

  // --- Initialize App ---
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
