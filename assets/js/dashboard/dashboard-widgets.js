/**
 * DashboardWidgets — Widget rendering system for Plotox Auto-Generated Dashboard.
 * Handles ChartWidget, KPIWidget, TableWidget, and TextWidget rendering.
 */
class DashboardWidgets {
  constructor() {
    this.renderedWidgets = {};
    this.chartInstances = {};
    this._setupWindowResize();
  }

  /**
   * Resize all chart instances on window resize.
   */
  _setupWindowResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        Object.values(this.chartInstances).forEach(chart => {
          try { chart.resize(); } catch (e) { /* disposed */ }
        });
      }, 150);
    });
  }

  /**
   * Resize all tracked chart instances immediately.
   */
  resizeAll() {
    Object.values(this.chartInstances).forEach(chart => {
      try { chart.resize(); } catch (e) { /* disposed */ }
    });
  }

  /**
   * Generate a unique widget ID.
   */
  static generateId() {
    return 'w-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * Render a widget's content into its body container.
   * @param {Object} widget - { id, type, config }
   * @param {Object} dataset - { headers, rows, types }
   */
  renderWidget(widget, dataset) {
    const body = document.getElementById(`db-widget-body-${widget.id}`);
    if (!body) return;

    try {
      switch (widget.type) {
        case 'chart':
          this._renderChart(body, widget, dataset);
          break;
        case 'kpi':
          this._renderKPI(body, widget, dataset);
          break;
        case 'table':
          this._renderTable(body, widget, dataset);
          break;
        case 'text':
          this._renderText(body, widget);
          break;
        default:
          body.innerHTML = '<div class="db-widget-empty">Unknown widget type</div>';
      }
      this.renderedWidgets[widget.id] = true;
    } catch (err) {
      console.error(`DashboardWidgets: Failed to render widget ${widget.id}`, err);
      body.innerHTML = `<div class="db-widget-error">
        <span class="material-symbols-outlined">error</span>
        <span>Failed to render widget</span>
      </div>`;
    }
  }

  /**
   * Update widget title in the DOM.
   */
  updateTitle(widgetId, title) {
    const el = document.querySelector(`[data-widget-id="${widgetId}"] .db-widget-title`);
    if (el) el.textContent = title;
  }

  /**
   * Destroy a widget's rendered content.
   */
  destroyWidget(widgetId) {
    if (this.chartInstances[widgetId]) {
      try { this.chartInstances[widgetId].dispose(); } catch (e) {}
      delete this.chartInstances[widgetId];
    }
    delete this.renderedWidgets[widgetId];
  }

  /**
   * Destroy all widget instances.
   */
  destroyAll() {
    Object.keys(this.chartInstances).forEach(id => {
      try { this.chartInstances[id].dispose(); } catch (e) {}
    });
    this.chartInstances = {};
    this.renderedWidgets = {};
  }

  /**
   * Re-render all widgets.
   */
  renderAll(widgets, dataset) {
    widgets.forEach(w => this.renderWidget(w, dataset));
  }

  // ─── Chart Widget ──────────────────────────────

  _renderChart(body, widget, dataset) {
    if (!dataset || !dataset.headers || !dataset.rows.length) {
      body.innerHTML = `<div class="db-widget-empty">
        <span class="material-symbols-outlined">bar_chart</span>
        <span>No data available</span>
      </div>`;
      return;
    }

    const isDarkMode = document.documentElement.classList.contains('dark');
    const config = widget.config || {};
    const chartType = config.chartType || 'line';

    // Ensure container is ready
    body.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.style.width = '100%';
    chartDiv.style.height = '100%';
    body.appendChild(chartDiv);

    // Dispose existing instance
    if (this.chartInstances[widget.id]) {
      try { this.chartInstances[widget.id].dispose(); } catch (e) {}
    }

    const chart = echarts.init(chartDiv);
    this.chartInstances[widget.id] = chart;

    // Route to correct chart renderer
    if (chartType === 'pie' || chartType === 'donut') {
      this._renderPieChart(chart, dataset, config, isDarkMode);
    } else if (chartType === 'histogram') {
      this._renderHistogramChart(chart, dataset, config, isDarkMode);
    } else {
      this._renderCartesianChart(chart, dataset, config, isDarkMode);
    }

    // Resize after render
    setTimeout(() => chart.resize(), 100);
  }

  _renderCartesianChart(chart, dataset, config, isDarkMode) {
    const xIdx = dataset.headers.indexOf(config.xAxis);
    const xValues = xIdx !== -1 ? dataset.rows.map(r => r[xIdx]) : dataset.rows.map((_, i) => i + 1);

    const palettes = {
      classic: isDarkMode
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
          const n = Number(String(v).replace(/[$,%]/g, ''));
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

    const bgColor = isDarkMode ? '#1a1a1a' : '#FEFCF8';
    const textColor = isDarkMode ? '#9A9895' : '#6B6B6B';
    const gridColor = isDarkMode ? '#2A2926' : '#E7E7E4';

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
            html += `<strong style="display:block;margin-bottom:4px;">${params[0].axisValueLabel}</strong>`;
          }
          params.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
              const compact = NumberFormatter.format(val);
              const exact = NumberFormatter.formatFull(val);
              const marker = item.marker || '';
              html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                <span>${marker}${item.seriesName}</span>
                <strong>${compact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(${exact})</span></strong>
              </div>`;
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
      series,
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut'
    });
  }

  _renderPieChart(chart, dataset, config, isDarkMode) {
    const catIdx = dataset.headers.indexOf(config.xAxis || config.categoryColumn);
    const valIdx = dataset.headers.indexOf((config.yAxes && config.yAxes[0]) || config.valueColumn);

    if (catIdx === -1 || valIdx === -1) {
      chart.setOption({ title: { text: 'Invalid columns', left: 'center', top: 'center' } });
      return;
    }

    const palettes = {
      classic: isDarkMode
        ? ['#60a5fa', '#34d399', '#fb923c', '#22d3ee', '#a78bfa', '#f472b6', '#22c55e', '#0ea5e9']
        : ['#2563eb', '#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#0284c7'],
      vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676', '#ff6b6b', '#4ecdc4'],
      ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef', '#023e8a', '#caf0f8'],
      sunset: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#e74c3c', '#f39c12'],
      mono: ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8c8c8c', '#adadad', '#cecece', '#363636', '#b0b0b0']
    };
    const colors = palettes[config.colorPalette] || palettes.classic;

    // Aggregate data by category
    const aggregated = {};
    dataset.rows.forEach(row => {
      const cat = String(row[catIdx]);
      const val = Number(String(row[valIdx]).replace(/[$,%]/g, ''));
      if (isFinite(val)) {
        aggregated[cat] = (aggregated[cat] || 0) + val;
      }
    });

    const data = Object.entries(aggregated)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);  // Max 12 slices

    const isDonut = config.chartType === 'donut';
    const textColor = isDarkMode ? '#9A9895' : '#6B6B6B';

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
          return `${params.marker}<strong>${params.name}</strong><br/>
            Value: <strong>${compact} (${exact})</strong><br/>
            Percentage: <strong>${params.percent}%</strong>`;
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
          position: 'outside',
          formatter: '{b}: {d}%',
          color: textColor,
          fontSize: 10
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 11,
            fontWeight: 'bold',
            color: textColor
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        itemStyle: {
          borderRadius: isDonut ? 6 : 4,
          borderColor: isDarkMode ? '#121212' : '#FCFCFB',
          borderWidth: 2
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: (idx) => idx * 50
      }],
      animation: true,
      animationDuration: 1000
    });
  }

  // ─── KPI Widget ────────────────────────────────

  _renderKPI(body, widget, dataset) {
    const config = widget.config || {};
    const kpiType = config.kpiType || 'total';
    const column = config.column;
    const label = config.title || config.label || 'Metric';

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
            const n = Number(String(v).replace(/[$,%]/g, ''));
            return isFinite(n) ? n : null;
          })
          .filter(v => v !== null);

        if (values.length > 0) {
          switch (kpiType) {
            case 'total':
            case 'revenue':
            case 'sales':
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
            default:
              value = values.reduce((a, b) => a + b, 0);
          }

          // Calculate trend
          if (values.length >= 2) {
            const mid = Math.floor(values.length / 2);
            const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
            const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
            trend = secondHalf >= firstHalf ? 'up' : 'down';
            const trendPct = firstHalf !== 0
              ? Math.abs(((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1)
              : '0.0';
            prevValue = trendPct;
          }
        }
      }
    }

    const formattedValue = this._formatKPIValue(value, kpiType);
    const { icon, colorClass } = this._getKPIStyle(kpiType);
    const trendIcon = trend === 'up' ? 'trending_up' : 'trending_down';
    const trendColor = trend === 'up' ? 'db-kpi-trend-up' : 'db-kpi-trend-down';

    body.innerHTML = `
      <div class="db-kpi-card ${colorClass}">
        <div class="db-kpi-icon-wrapper">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <div class="db-kpi-content">
          <div class="db-kpi-label">${label}</div>
          <div class="db-kpi-value" data-target="${value}">${prefix}${formattedValue}${suffix}</div>
          ${trend ? `
            <div class="db-kpi-trend ${trendColor}">
              <span class="material-symbols-outlined">${trendIcon}</span>
              <span>${prevValue}% vs prior period</span>
            </div>
          ` : '<div class="db-kpi-trend db-kpi-trend-neutral"><span>No trend data</span></div>'}
        </div>
      </div>
    `;

    // Animate counter
    this._animateKPICounter(body.querySelector('.db-kpi-value'), value, prefix, suffix, kpiType);
  }

  _formatKPIValue(value, type) {
    return NumberFormatter.format(value, type);
  }

  _getKPIStyle(type) {
    const styles = {
      total: { icon: 'functions', colorClass: 'db-kpi-indigo' },
      revenue: { icon: 'payments', colorClass: 'db-kpi-emerald' },
      sales: { icon: 'shopping_cart', colorClass: 'db-kpi-blue' },
      average: { icon: 'avg_pace', colorClass: 'db-kpi-purple' },
      count: { icon: 'tag', colorClass: 'db-kpi-orange' },
      growth: { icon: 'trending_up', colorClass: 'db-kpi-emerald' },
      max: { icon: 'arrow_upward', colorClass: 'db-kpi-pink' },
      min: { icon: 'arrow_downward', colorClass: 'db-kpi-blue' },
      latest: { icon: 'schedule', colorClass: 'db-kpi-indigo' }
    };
    return styles[type] || styles.total;
  }

  _animateKPICounter(el, target, prefix, suffix, type) {
    if (!el) return;
    const duration = 1200;
    const start = performance.now();
    const format = (v) => prefix + this._formatKPIValue(v, type) + suffix;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = format(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        el.textContent = format(target);
      }
    };
    requestAnimationFrame(animate);
  }

  // ─── Table Widget (Virtual Scrolling) ──────────

  _renderTable(body, widget, dataset) {
    if (!dataset || !dataset.headers || !dataset.rows.length) {
      body.innerHTML = `<div class="db-widget-empty">
        <span class="material-symbols-outlined">table_chart</span>
        <span>No data available</span>
      </div>`;
      return;
    }

    const config = widget.config || {};
    const columns = config.columns || dataset.headers;
    const ROW_HEIGHT = 32;
    const HEADER_HEIGHT = 38;

    body.innerHTML = '';
    body.style.overflow = 'hidden';

    const tableContainer = document.createElement('div');
    tableContainer.className = 'db-table-container';

    // Header
    const headerRow = document.createElement('div');
    headerRow.className = 'db-table-header';
    
    // Index column header
    const indexHeader = document.createElement('div');
    indexHeader.className = 'db-table-header-cell db-table-index-cell';
    indexHeader.textContent = '#';
    headerRow.appendChild(indexHeader);

    columns.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'db-table-header-cell';
      cell.textContent = col;
      headerRow.appendChild(cell);
    });
    tableContainer.appendChild(headerRow);

    // Virtual scroll body
    const scrollBody = document.createElement('div');
    scrollBody.className = 'db-table-scroll-body';
    scrollBody.style.height = `calc(100% - ${HEADER_HEIGHT + 32}px)`;
    scrollBody.style.overflowY = 'auto';

    const innerContainer = document.createElement('div');
    innerContainer.style.height = `${dataset.rows.length * ROW_HEIGHT}px`;
    innerContainer.style.position = 'relative';

    const renderVisibleRows = () => {
      const scrollTop = scrollBody.scrollTop;
      const containerHeight = scrollBody.clientHeight;
      const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
      const endIdx = Math.min(dataset.rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);

      const existing = innerContainer.querySelectorAll('.db-table-row');
      existing.forEach(row => {
        const idx = parseInt(row.getAttribute('data-row-idx'));
        if (idx < startIdx || idx >= endIdx) row.remove();
      });

      const headerWidth = headerRow.scrollWidth;
      const colIndices = columns.map(c => dataset.headers.indexOf(c));
      for (let i = startIdx; i < endIdx; i++) {
        if (innerContainer.querySelector(`[data-row-idx="${i}"]`)) continue;

        const row = document.createElement('div');
        row.className = 'db-table-row' + (i % 2 === 0 ? '' : ' db-table-row-alt');
        row.setAttribute('data-row-idx', i);
        row.style.position = 'absolute';
        row.style.top = `${i * ROW_HEIGHT}px`;
        row.style.height = `${ROW_HEIGHT}px`;
        row.style.width = `${headerWidth}px`;

        // Index row cell
        const indexCell = document.createElement('div');
        indexCell.className = 'db-table-cell db-table-index-cell';
        indexCell.textContent = i + 1;
        row.appendChild(indexCell);

        colIndices.forEach((colIdx, cIdx) => {
          const cell = document.createElement('div');
          cell.className = 'db-table-cell';
          const colName = columns[cIdx];
          const isNumeric = dataset.types?.[colName] === 'numeric';
          let val = colIdx !== -1 ? (dataset.rows[i][colIdx] ?? '') : '';
          if (isNumeric && val !== '' && val !== null && val !== undefined) {
            val = NumberFormatter.format(Number(val));
          }
          cell.textContent = val;
          row.appendChild(cell);
        });
        innerContainer.appendChild(row);
      }
    };

    scrollBody.appendChild(innerContainer);
    tableContainer.appendChild(scrollBody);
    body.appendChild(tableContainer);

    renderVisibleRows();
    
    // Sync horizontal scroll between body and header
    scrollBody.addEventListener('scroll', () => {
      requestAnimationFrame(renderVisibleRows);
      headerRow.scrollLeft = scrollBody.scrollLeft;
    });

    // Resize observer to sync widths on container/window resize
    const resizeObserver = new ResizeObserver(() => {
      const headerWidth = headerRow.scrollWidth;
      innerContainer.style.width = `${headerWidth}px`;
      const rows = innerContainer.querySelectorAll('.db-table-row');
      rows.forEach(r => r.style.width = `${headerWidth}px`);
    });
    resizeObserver.observe(tableContainer);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'db-table-footer';
    footer.innerHTML = `<span>${dataset.rows.length.toLocaleString()} rows · ${columns.length} columns</span>`;
    body.appendChild(footer);
  }

  // ─── Text Widget ───────────────────────────────

  _renderText(body, widget) {
    const config = widget.config || {};
    const content = config.content || '';
    const placeholder = 'Click to add notes...';

    body.innerHTML = `
      <div class="db-text-widget">
        <div class="db-text-content" contenteditable="true" 
             data-placeholder="${placeholder}"
             spellcheck="false">${content || ''}</div>
      </div>
    `;

    const textEl = body.querySelector('.db-text-content');
    if (textEl) {
      textEl.addEventListener('blur', () => {
        if (widget.config) {
          widget.config.content = textEl.innerHTML;
          window.dispatchEvent(new CustomEvent('dashboardWidgetUpdated', {
            detail: { id: widget.id, config: widget.config }
          }));
        }
      });

      if (!content) textEl.classList.add('db-text-empty');
      textEl.addEventListener('focus', () => textEl.classList.remove('db-text-empty'));
      textEl.addEventListener('blur', () => {
        if (!textEl.textContent.trim()) textEl.classList.add('db-text-empty');
      });
    }
  }

  _calculateHistogram(values, binCount = 10) {
    const numericValues = values
      .map(v => Number(String(v).replace(/[$,%]/g, '')))
      .filter(v => isFinite(v) && v !== null);

    if (numericValues.length === 0) {
      return { bins: [], counts: [] };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    
    if (min === max) {
      return {
        bins: [min.toFixed(1)],
        counts: [numericValues.length]
      };
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
      if (binIdx >= binCount) {
        binIdx = binCount - 1;
      }
      if (binIdx < 0) {
        binIdx = 0;
      }
      counts[binIdx]++;
    });

    return { bins, counts };
  }

  _renderHistogramChart(chart, dataset, config, isDarkMode) {
    const palettes = {
      classic: isDarkMode
        ? ['#60a5fa', '#34d399', '#fb923c', '#22d3ee', '#a78bfa', '#f472b6']
        : ['#2563eb', '#10b981', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899'],
      vibrant: ['#ff3e00', '#00f0ff', '#ff00f0', '#ffd700', '#7b2cbf', '#00e676'],
      ocean: ['#0077b6', '#0096c7', '#03045e', '#00b4d8', '#48cae4', '#90e0ef'],
      sunset: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'],
      mono: ['#2d2d2d', '#4a4a4a', '#6b6b6b', '#8c8c8c', '#adadad', '#cecece']
    };
    const colors = palettes[config.colorPalette] || palettes.classic;

    const column = (config.yAxes && config.yAxes[0]) || dataset.headers[0];
    const colIdx = dataset.headers.indexOf(column);

    if (colIdx === -1) {
      chart.setOption({ title: { text: 'Invalid column', left: 'center', top: 'center' } });
      return;
    }

    const rawValues = dataset.rows.map(r => r[colIdx]);
    const { bins, counts } = this._calculateHistogram(rawValues, 10);

    const textColor = isDarkMode ? '#9A9895' : '#6B6B6B';
    const gridColor = isDarkMode ? '#2A2926' : '#E7E7E4';

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
          return `${item.name}<br/>Count: <strong>${compact} (${exact})</strong>`;
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
        axisLabel: { color: textColor, fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
      },
      series: [{
        name: column,
        type: 'bar',
        barWidth: '90%',
        data: counts,
        itemStyle: { color: colors[0] }
      }],
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut'
    });
  }

  // ─── Widget Configuration Templates ────────────

  /**
   * Get default config for a widget type.
   */
  static getDefaultConfig(type, dataset) {
    switch (type) {
      case 'chart':
        return {
          title: 'Chart',
          chartType: 'line',
          xAxis: dataset?.headers?.[0] || '',
          yAxes: dataset?.headers?.slice(1, 2) || [],
          colorPalette: 'classic',
          lineSmooth: false
        };
      case 'kpi':
        return {
          title: 'Total',
          kpiType: 'total',
          column: dataset?.headers?.[1] || '',
          prefix: '',
          suffix: ''
        };
      case 'table':
        return {
          title: 'Data Table',
          columns: dataset?.headers || [],
          pageSize: 50
        };
      case 'text':
        return {
          title: 'Notes',
          content: ''
        };
      default:
        return { title: 'Widget' };
    }
  }
}

window.DashboardWidgets = DashboardWidgets;
