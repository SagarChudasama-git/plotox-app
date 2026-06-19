class ExportManager {

  /**
   * Helper: Generates a modified ECharts option for export where the chart name (title)
   * is shown, positioned high, and the grid is pushed down to make room.
   */
  /**
   * Helper: Recursively applies Space Grotesk / Georgia font stack and bold weighting to all text style configurations in ECharts.
   */
  static _applyExportFonts(obj, isPub) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => this._applyExportFonts(item, isPub));
      return;
    }

    // Traverse all keys
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
        this._applyExportFonts(obj[key], isPub);
      }
    }

    // Check specific fields that look like font style configuration containers
    if (obj.fontFamily !== undefined || obj.fontSize !== undefined || obj.fontWeight !== undefined || obj.color !== undefined) {
      obj.fontFamily = isPub ? 'Georgia, "Times New Roman", serif' : 'Space Grotesk, sans-serif';

      // Force weight to 700 (bold) unless specifically overridden to another bold scale
      if (obj.fontWeight === undefined || obj.fontWeight === 'normal' || obj.fontWeight === '500' || obj.fontWeight === 400 || obj.fontWeight === 500) {
        obj.fontWeight = 700;
      }
    }
  }

  /**
   * Helper: Post-processes generated SVG data URLs to embed self-contained styling
   * and explicit attributes, completely isolating text from application CSS leaks.
   */
  static _postProcessSVG(dataURL, option) {
    try {
      let svgText = '';
      let isBase64 = false;

      if (dataURL.includes('base64,')) {
        const base64Str = dataURL.split('base64,')[1];
        svgText = atob(base64Str);
        isBase64 = true;
      } else {
        const parts = dataURL.split(',');
        svgText = decodeURIComponent(parts[1]);
      }

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      const isPub = option && (option.publicationMode === true || (option.title && option.title[0] && option.title[0].textStyle && option.title[0].textStyle.fontFamily && option.title[0].textStyle.fontFamily.includes('Georgia')));
      const fontStack = isPub ? 'Georgia, "Times New Roman", serif' : 'Space Grotesk, sans-serif';

      // Ensure SVG scales responsively and fills available viewport space
      const currentWidth = svgElement.getAttribute('width');
      const currentHeight = svgElement.getAttribute('height');
      if (currentWidth && currentHeight && !svgElement.getAttribute('viewBox')) {
        svgElement.setAttribute('viewBox', `0 0 ${parseFloat(currentWidth)} ${parseFloat(currentHeight)}`);
      }
      svgElement.setAttribute('width', '100%');
      svgElement.setAttribute('height', '100%');
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Force high-priority bold Space Grotesk/Georgia font stack inside SVG
      const styleNode = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleNode.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');
        svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        svg, text, tspan {
          font-family: ${isPub ? 'Georgia, "Times New Roman", serif' : '"Space Grotesk", sans-serif'} !important;
          font-weight: 700 !important;
        }
      `;
      svgElement.insertBefore(styleNode, svgElement.firstChild);

      // Embed explicit attributes directly into elements for standard renderer compliance
      const textElements = svgElement.getElementsByTagName('text');
      for (let i = 0; i < textElements.length; i++) {
        const el = textElements[i];
        el.setAttribute('font-family', fontStack);
        el.setAttribute('font-weight', '700');

        const tspans = el.getElementsByTagName('tspan');
        for (let j = 0; j < tspans.length; j++) {
          tspans[j].setAttribute('font-family', fontStack);
          tspans[j].setAttribute('font-weight', '700');
        }
      }

      const serializer = new XMLSerializer();
      const modifiedSvgText = serializer.serializeToString(svgDoc);

      if (isBase64) {
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(modifiedSvgText)));
      } else {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(modifiedSvgText);
      }
    } catch (e) {
      console.error('Error post-processing SVG styles:', e);
      return dataURL;
    }
  }

  /**
   * Helper: Generates a modified ECharts option for export where the chart name (title)
   * is shown, positioned high, and the grid is pushed down to make room.
   */
  static _getExportOption(chart) {
    const option = chart.getOption();
    const container = chart.getDom();
    const width = container ? (container.clientWidth || 1000) : 1000;
    const height = container ? (container.clientHeight || 500) : 500;

    const isPub = option.publicationMode === true;
    const fontStack = isPub ? 'Georgia, "Times New Roman", serif' : 'Space Grotesk, sans-serif';

    // Force animation off globally and on series to guarantee instant synchronous layout updates
    option.animation = false;
    if (option.series) {
      const seriesList = Array.isArray(option.series) ? option.series : [option.series];
      seriesList.forEach(s => {
        s.animation = false;
        if (s.markPoint) {
          s.markPoint.label = s.markPoint.label || {};
          s.markPoint.label.show = true;
          s.markPoint.label.fontSize = 11;
          s.markPoint.label.fontWeight = 'bold';
          if (option.textStyle && option.textStyle.color) {
            s.markPoint.label.color = option.textStyle.color;
          }
          // Enable visibility on individual items to preserve dynamic alignments and stacking offsets
          if (s.markPoint.data && Array.isArray(s.markPoint.data)) {
            s.markPoint.data.forEach(item => {
              item.label = item.label || {};
              item.label.show = true;
              item.label.fontSize = 11;
              item.label.fontWeight = 'bold';
              if (option.textStyle && option.textStyle.color) {
                item.label.color = option.textStyle.color;
              }
            });
          }
        }
      });
    }

    // Always show title on export, centered to avoid overlapping with top-left watermark
    if (option.title && option.title[0]) {
      option.title[0].show = true;
      option.title[0].top = 22;
      option.title[0].left = 'center';
    }

    // Add Watermark brand logo at the bottom right corner (plotox with rising o and x)
    const isDarkExport = option.backgroundColor && String(option.backgroundColor).startsWith('#1');
    const watermarkColor = isDarkExport ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';

    option.graphic = option.graphic || [];
    const graphicList = Array.isArray(option.graphic) ? option.graphic : [option.graphic];
    graphicList.push({
      type: 'group',
      right: 20,
      bottom: 20,
      z: 1000,
      children: [
        {
          type: 'text',
          z: 1000,
          style: {
            text: 'plot',
            font: `bold 15px ${fontStack}`,
            fill: watermarkColor
          }
        },
        {
          type: 'text',
          z: 1000,
          x: 30,  // Spacing for rising 'o'
          y: -3,  // Slightly raised
          style: {
            text: 'o',
            font: `bold 15px ${fontStack}`,
            fill: watermarkColor
          }
        },
        {
          type: 'text',
          z: 1000,
          x: 39,  // Spacing for rising 'x'
          y: -6,  // Raised higher
          style: {
            text: 'x',
            font: `bold 15px ${fontStack}`,
            fill: watermarkColor
          }
        }
      ]
    });
    option.graphic = graphicList;

    // Always show legend on export with clean bottom positioning
    const legendTextColor = isDarkExport ? '#9A9895' : '#6B6B6B';
    option.legend = [{
      show: true,
      type: 'scroll',
      bottom: 8,
      left: 'center',
      orient: 'horizontal',
      textStyle: {
        fontSize: 12,
        color: legendTextColor,
        fontFamily: fontStack,
        fontWeight: 700
      },
      icon: 'roundRect',
      itemWidth: 16,
      itemHeight: 4,
      itemGap: 16
    }];

    if (option.grid && option.grid[0]) {
      const grid = option.grid[0];

      // Convert absolute pixels back to percentages with a safe minimum (12% left/right, 14% bottom)
      const toPercent = (val, size, minPercent) => {
        if (typeof val === 'number') {
          const pct = (val / size) * 100;
          return Math.max(minPercent, pct) + '%';
        }
        if (typeof val === 'string' && val.endsWith('%')) {
          const pct = parseFloat(val);
          return Math.max(minPercent, pct) + '%';
        }
        return val;
      };

      grid.left = toPercent(grid.left, width, 12);
      grid.right = toPercent(grid.right, width, 12);
      // Push bottom up to make room for the legend
      grid.bottom = '18%';

      // Push the grid top down to make room for the title
      if (typeof grid.top === 'number') {
        grid.top = (((grid.top + 35) / height) * 100) + '%';
      } else if (typeof grid.top === 'string' && grid.top.endsWith('%')) {
        grid.top = (parseFloat(grid.top) + 8) + '%';
      } else {
        grid.top = '18%';
      }
      grid.containLabel = true;
    }

    // Set global styles for export
    option.textStyle = option.textStyle || {};
    option.textStyle.fontFamily = fontStack;
    option.textStyle.fontWeight = 700;

    // Apply recursive fonts and bold to ensure title, axes labels, series labels, etc. match
    this._applyExportFonts(option, isPub);

    return option;
  }

  /**
   * Helper: Re-attaches formatter functions to the export option.
   * ECharts getOption() may lose function references during serialization,
   * and JSON.stringify always drops them. This method ensures all axis labels,
   * tooltips, and series labels have proper large-value formatting.
   */
  static _reattachFormatters(option) {
    // NumberFormatter-aware axis label formatter
    const formatKValue = (value) => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof NumberFormatter !== 'undefined') return NumberFormatter.format(value);
      return value;
    };

    // Re-attach xAxis label formatters
    if (option.xAxis) {
      const xAxes = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis];
      xAxes.forEach(axis => {
        if (axis && axis.axisLabel) {
          axis.axisLabel.formatter = formatKValue;
        }
      });
    }

    // Re-attach yAxis label formatters
    if (option.yAxis) {
      const yAxes = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis];
      yAxes.forEach(axis => {
        if (axis && axis.axisLabel) {
          axis.axisLabel.formatter = formatKValue;
        }
      });
    }

    // Detect if scatter chart (xAxis type is 'value' with series type 'scatter')
    let isScatterChart = false;
    if (option.series) {
      const seriesList = Array.isArray(option.series) ? option.series : [option.series];
      isScatterChart = seriesList.some(s => s && s.type === 'scatter');
    }

    // Re-attach tooltip formatter with large value handling
    if (option.tooltip) {
      const tooltips = Array.isArray(option.tooltip) ? option.tooltip : [option.tooltip];
      tooltips.forEach(tooltip => {
        if (!tooltip) return;
        if (isScatterChart) {
          tooltip.formatter = (params) => {
            if (!Array.isArray(params)) params = [params];
            let html = '';
            if (params[0] && Array.isArray(params[0].value) && params[0].value.length >= 2) {
              const xVal = Number(params[0].value[0]);
              const yVal = Number(params[0].value[1]);
              const xCompact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(xVal) : xVal;
              const xExact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(xVal) : xVal;
              const yCompact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(yVal) : yVal;
              const yExact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(yVal) : yVal;
              const marker = params[0].marker || '';
              html += `<strong style="display:block;margin-bottom:4px;">${marker}${params[0].seriesName}</strong>`;
              html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                <span>X</span>
                <strong>${xCompact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(${xExact})</span></strong>
              </div>`;
              html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                <span>Y</span>
                <strong>${yCompact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(${yExact})</span></strong>
              </div>`;
              return html;
            }
            if (params[0] && params[0].axisValueLabel) {
              html += `<strong style="display:block;margin-bottom:4px;">${params[0].axisValueLabel}</strong>`;
            }
            params.forEach(item => {
              if (item.value !== null && item.value !== undefined) {
                const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
                const compact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : val;
                const exact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(val) : val;
                const marker = item.marker || '';
                html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                  <span>${marker}${item.seriesName}</span>
                  <strong>${compact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(${exact})</span></strong>
                </div>`;
              }
            });
            return html;
          };
        } else if (tooltip.trigger === 'item') {
          // Pie/donut chart tooltip
          tooltip.formatter = (params) => {
            const val = Number(params.value);
            const compact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : val;
            const exact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(val) : val;
            return `${params.marker}<strong>${params.name}</strong><br/>
              Value: <strong>${compact} (${exact})</strong><br/>
              Percentage: <strong>${params.percent}%</strong>`;
          };
        } else {
          // Axis-triggered tooltip (line, bar, area, histogram)
          tooltip.formatter = (params) => {
            if (!Array.isArray(params)) params = [params];
            let html = '';
            if (params[0] && params[0].axisValueLabel) {
              html += `<strong style="display:block;margin-bottom:4px;">${params[0].axisValueLabel}</strong>`;
            }
            params.forEach(item => {
              if (item.value !== null && item.value !== undefined) {
                const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
                const compact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : val;
                const exact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(val) : val;
                const marker = item.marker || '';
                html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                  <span>${marker}${item.seriesName}</span>
                  <strong>${compact} <span style="font-size:10px;font-weight:normal;opacity:0.8;">(${exact})</span></strong>
                </div>`;
              }
            });
            return html;
          };
        }
      });
    }

    // Re-attach series label formatters (for bar labels, min/max labels)
    if (option.series) {
      const seriesList = Array.isArray(option.series) ? option.series : [option.series];
      seriesList.forEach(s => {
        if (!s) return;
        // Bar chart data labels
        if (s.type === 'bar' && s.label && s.label.show) {
          s.label.formatter = (params) => formatKValue(params.value);
        }
        // Min/max annotated data points
        if (s.data && Array.isArray(s.data)) {
          s.data.forEach(item => {
            if (item && typeof item === 'object' && item.label && item.label.show) {
              const origFormatter = item.label.formatter;
              // Only re-attach if it was lost (became null/undefined from serialization)
              if (typeof origFormatter !== 'function') {
                item.label.formatter = (params) => {
                  const val = Array.isArray(params.value) ? params.value[1] : params.value;
                  return typeof val === 'number' ? formatKValue(val) : (val != null ? String(val) : '');
                };
              }
            }
          });
        }
      });
    }

    return option;
  }

  /**
   * Helper: Temporarily show the ECharts title and adjust the grid for export, run callback, then restore.
   */
  static _withTitleShown(chart, callback) {
    const currentOption = chart.getOption();
    const exportOption = this._getExportOption(chart);

    // Re-attach formatters that may have been lost during getOption() serialization
    this._reattachFormatters(exportOption);

    // Set modified option with lazyUpdate=false to force instant synchronous redraw
    chart.setOption(exportOption, { notMerge: true, lazyUpdate: false });

    try {
      return callback();
    } finally {
      // Restore original option with formatters re-attached
      this._reattachFormatters(currentOption);
      chart.setOption(currentOption, { notMerge: true, lazyUpdate: false });
    }
  }

  /**
   * Export the chart to PNG image in high-quality 5K resolution.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportPNG(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    this._withTitleShown(chart, () => {
      // Calculate pixelRatio to achieve exactly 5K horizontal quality (5120px)
      const width = container.clientWidth || 1000;
      const pixelRatio = 5120 / width;

      const dataURL = chart.getDataURL({
        type: 'png',
        pixelRatio: pixelRatio,
        excludeComponents: ['toolbox', 'dataZoom']
      });
      this._triggerDownload(dataURL, `${filename}.png`);
    });
  }

  /**
   * Export the chart to JPG image in high-quality 5K resolution.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportJPG(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    this._withTitleShown(chart, () => {
      // Calculate pixelRatio to achieve exactly 5K horizontal quality (5120px)
      const width = container.clientWidth || 1000;
      const pixelRatio = 5120 / width;

      const dataURL = chart.getDataURL({
        type: 'jpeg',
        pixelRatio: pixelRatio,
        backgroundColor: '#FFFFFF',
        excludeComponents: ['toolbox', 'dataZoom']
      });
      this._triggerDownload(dataURL, `${filename}.jpg`);
    });
  }

  /**
   * Export the chart to vector SVG format.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportSVG(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    try {
      const option = this._getExportOption(chart);

      // Re-attach formatters that are lost during getOption() serialization
      this._reattachFormatters(option);

      const tempDiv = document.createElement('div');
      tempDiv.style.width = (container.clientWidth || 800) + 'px';
      tempDiv.style.height = (container.clientHeight || 500) + 'px';
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      const tempChart = echarts.init(tempDiv, null, { renderer: 'svg' });
      tempChart.setOption(option);

      const dataURL = tempChart.getDataURL({
        type: 'svg',
        excludeComponents: ['toolbox', 'dataZoom']
      });

      tempChart.dispose();
      document.body.removeChild(tempDiv);

      // Post-process SVG XML to isolate text font styling and weighting
      const processedURL = this._postProcessSVG(dataURL, option);

      this._triggerDownload(processedURL, `${filename}.svg`);
    } catch (e) {
      console.error('SVG Export failed, falling back to PNG', e);
      this.exportPNG(containerId, filename);
    }
  }

  /**
   * Export the chart as a self-contained interactive HTML page.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportHTML(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    const option = this._getExportOption(chart);

    // Detect chart type for formatter generation
    let isScatterChart = false;
    let isPieChart = false;
    let hasBarLabels = false;
    if (option.series) {
      const seriesList = Array.isArray(option.series) ? option.series : [option.series];
      isScatterChart = seriesList.some(s => s && s.type === 'scatter');
      isPieChart = seriesList.some(s => s && s.type === 'pie');
      hasBarLabels = seriesList.some(s => s && s.type === 'bar' && s.label && s.label.show);
    }

    // Detect number system from current localStorage
    const numberSystem = (typeof NumberFormatter !== 'undefined') ?
      NumberFormatter.getSystem() : 'international';

    const optionJSON = JSON.stringify(option, null, 2);

    const bgColor = (option.backgroundColor && option.backgroundColor[0]) || option.backgroundColor || '#FEFCF8';
    const isPub = option.publicationMode === true;
    const fontStack = isPub ? 'Georgia, "Times New Roman", serif' : '"Space Grotesk", sans-serif';

    // Determine if the background is dark to style the control buttons appropriately
    const isDark = bgColor.startsWith('#1') || bgColor === '#000000' || bgColor === 'black';

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plotox — Interactive Chart</title>
  <!-- Load Space Grotesk Google Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
  <!-- Load Apache ECharts from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"><\\/script>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: ${bgColor};
      font-family: ${fontStack} !important;
      font-weight: 700 !important;
    }
    #chart {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
    }
    /* Enforce explicit bold Space Grotesk/Georgia font stacks for entire interactive chart frame */
    #chart, text, tspan {
      font-family: ${fontStack} !important;
      font-weight: 700 !important;
    }
    
    /* Immersive Premium Fullscreen Button */
    #fullscreen-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'};
      background: ${isDark ? 'rgba(26, 26, 26, 0.6)' : 'rgba(254, 252, 248, 0.6)'};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${isDark ? '#FEFCF8' : '#1A1A1A'};
      box-shadow: 0 8px 24px rgba(0, 0, 0, ${isDark ? '0.2' : '0.06'});
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.5;
    }
    #fullscreen-btn:hover {
      transform: scale(1.1);
      opacity: 1;
      background: ${isDark ? 'rgba(26, 26, 26, 0.85)' : 'rgba(254, 252, 248, 0.85)'};
    }
    #fullscreen-btn:active {
      transform: scale(0.95);
    }
  </style>
</head>
<body>
  <button id="fullscreen-btn" title="Toggle Immersive Presentation Mode">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    </svg>
  </button>

  <div id="chart"></div>
  <script>
    // ── Embedded NumberFormatter for large value handling ──
    const NumberFormatter = {
      _system: '${numberSystem}',
      getSystem() { return this._system; },
      format(value, type) {
        if (value === null || value === undefined || value === '') return '';
        let num = Number(value);
        if (isNaN(num)) {
          const cleaned = String(value).replace(/[\\$,%\\s]/g, '');
          const parsed = Number(cleaned);
          if (!isNaN(parsed) && cleaned !== '') { num = parsed; } else { return value; }
        }
        if (type === 'growth') return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
        const sys = this.getSystem();
        const absVal = Math.abs(num);
        if (sys === 'full') return this.formatFull(num);
        if (sys === 'indian') {
          if (absVal >= 10000000) return (num / 10000000).toFixed(1).replace(/\\.0$/, '') + ' Cr';
          if (absVal >= 100000) return (num / 100000).toFixed(1).replace(/\\.0$/, '') + ' L';
          if (absVal >= 1000) return (num / 1000).toFixed(1).replace(/\\.0$/, '') + ' K';
        } else {
          if (absVal >= 1e12) return (num / 1e12).toFixed(1).replace(/\\.0$/, '') + 'T';
          if (absVal >= 1e9) return (num / 1e9).toFixed(1).replace(/\\.0$/, '') + 'B';
          if (absVal >= 1e6) return (num / 1e6).toFixed(1).replace(/\\.0$/, '') + 'M';
          if (absVal >= 1e3) return (num / 1e3).toFixed(1).replace(/\\.0$/, '') + 'K';
        }
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      formatFull(value) {
        if (value === null || value === undefined || value === '') return '';
        let num = Number(value);
        if (isNaN(num)) {
          const cleaned = String(value).replace(/[\\$,%\\s]/g, '');
          const parsed = Number(cleaned);
          if (!isNaN(parsed) && cleaned !== '') { num = parsed; } else { return value; }
        }
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    };

    const formatKValue = (value) => {
      if (value === null || value === undefined || value === '') return '';
      return NumberFormatter.format(value);
    };

    const option = ${optionJSON};

    // ── Re-attach formatter functions lost during JSON serialization ──
    // Axis label formatters
    if (option.xAxis) {
      const xAxes = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis];
      xAxes.forEach(axis => { if (axis && axis.axisLabel) axis.axisLabel.formatter = formatKValue; });
    }
    if (option.yAxis) {
      const yAxes = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis];
      yAxes.forEach(axis => { if (axis && axis.axisLabel) axis.axisLabel.formatter = formatKValue; });
    }

    // Tooltip formatter
    if (option.tooltip) {
      const tooltips = Array.isArray(option.tooltip) ? option.tooltip : [option.tooltip];
      tooltips.forEach(tooltip => {
        if (!tooltip) return;
        ${isScatterChart ? `
        tooltip.formatter = (params) => {
          if (!Array.isArray(params)) params = [params];
          let html = '';
          if (params[0] && Array.isArray(params[0].value) && params[0].value.length >= 2) {
            const xVal = Number(params[0].value[0]);
            const yVal = Number(params[0].value[1]);
            const xC = NumberFormatter.format(xVal), xE = NumberFormatter.formatFull(xVal);
            const yC = NumberFormatter.format(yVal), yE = NumberFormatter.formatFull(yVal);
            const m = params[0].marker || '';
            html += '<strong style="display:block;margin-bottom:4px;">' + m + params[0].seriesName + '</strong>';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;"><span>X</span><strong>' + xC + ' <span style="font-size:10px;font-weight:normal;opacity:0.8;">(' + xE + ')</span></strong></div>';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;"><span>Y</span><strong>' + yC + ' <span style="font-size:10px;font-weight:normal;opacity:0.8;">(' + yE + ')</span></strong></div>';
            return html;
          }
          if (params[0] && params[0].axisValueLabel) html += '<strong style="display:block;margin-bottom:4px;">' + params[0].axisValueLabel + '</strong>';
          params.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
              const c = NumberFormatter.format(val), e = NumberFormatter.formatFull(val);
              html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;"><span>' + (item.marker||'') + item.seriesName + '</span><strong>' + c + ' <span style="font-size:10px;font-weight:normal;opacity:0.8;">(' + e + ')</span></strong></div>';
            }
          });
          return html;
        };` : isPieChart ? `
        tooltip.formatter = (params) => {
          const val = Number(params.value);
          const c = NumberFormatter.format(val), e = NumberFormatter.formatFull(val);
          return params.marker + '<strong>' + params.name + '</strong><br/>Value: <strong>' + c + ' (' + e + ')</strong><br/>Percentage: <strong>' + params.percent + '%</strong>';
        };` : `
        tooltip.formatter = (params) => {
          if (!Array.isArray(params)) params = [params];
          let html = '';
          if (params[0] && params[0].axisValueLabel) html += '<strong style="display:block;margin-bottom:4px;">' + params[0].axisValueLabel + '</strong>';
          params.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              const val = Array.isArray(item.value) ? Number(item.value[1]) : Number(item.value);
              const c = NumberFormatter.format(val), e = NumberFormatter.formatFull(val);
              html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;"><span>' + (item.marker||'') + item.seriesName + '</span><strong>' + c + ' <span style="font-size:10px;font-weight:normal;opacity:0.8;">(' + e + ')</span></strong></div>';
            }
          });
          return html;
        };`}
      });
    }

    // Series label formatters (bar labels, min/max labels)
    if (option.series) {
      const seriesList = Array.isArray(option.series) ? option.series : [option.series];
      seriesList.forEach(s => {
        if (!s) return;
        if (s.type === 'bar' && s.label && s.label.show) {
          s.label.formatter = (params) => formatKValue(params.value);
        }
        if (s.data && Array.isArray(s.data)) {
          s.data.forEach(item => {
            if (item && typeof item === 'object' && item.label && item.label.show) {
              item.label.formatter = (params) => {
                const val = Array.isArray(params.value) ? params.value[1] : params.value;
                return typeof val === 'number' ? formatKValue(val) : (val != null ? String(val) : '');
              };
            }
          });
        }
      });
    }
    
    // Initialize chart
    const container = document.getElementById('chart');
    container.addEventListener('contextmenu', e => e.preventDefault());
    const chart = echarts.init(container);
    chart.setOption(option);
    chart.resize();
    
    // Handle responsiveness
    window.addEventListener('resize', () => {
      chart.resize();
    });

    // Immersive presentation full-screen controller
    const btn = document.getElementById('fullscreen-btn');
    
    // Automatically attempt fullscreen on first user click/touch anywhere on the page
    const enterFullscreenOnce = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log("Fullscreen request deferred or blocked by browser security.");
        });
      }
      document.removeEventListener('click', enterFullscreenOnce);
      document.removeEventListener('touchstart', enterFullscreenOnce);
    };
    
    document.addEventListener('click', enterFullscreenOnce);
    document.addEventListener('touchstart', enterFullscreenOnce);

    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering document-wide enterFullscreenOnce
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error("Fullscreen error:", err);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        // Minimize icon
        btn.innerHTML = \`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/>
        </svg>\`;
      } else {
        // Maximize icon
        btn.innerHTML = \`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>\`;
      }
    });
  <\\/script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    this._triggerDownload(url, `${filename}.html`);
  }

  /**
   * Export the chart to PDF format using jsPDF, containing high-resolution 5K image data.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportPDF(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    this._withTitleShown(chart, () => {
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 450;
      const pixelRatio = 5120 / width;

      const imgData = chart.getDataURL({
        type: 'png',
        pixelRatio: pixelRatio,
        excludeComponents: ['toolbox', 'dataZoom']
      });

      try {
        const { jsPDF } = window.jspdf;
        const orientation = width > height ? 'l' : 'p';

        const pdf = new jsPDF(orientation, 'px', [width, height]);
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${filename}.pdf`);
      } catch (e) {
        console.error('PDF Export failed via jsPDF:', e);
        alert('PDF export failed. Ensure that jsPDF script CDN is loaded correctly.');
      }
    });
  }

  /**
   * Export raw chart JSON config.
   * @param {string} containerId - ID of the chart element.
   * @param {string} filename - Base name of the downloaded file.
   */
  static exportJSON(containerId, filename = 'plotox_chart') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = echarts.getInstanceByDom(container);
    if (!chart) return;

    const option = this._getExportOption(chart);
    const optionStr = JSON.stringify(option, null, 2);
    const blob = new Blob([optionStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    this._triggerDownload(url, `${filename}.json`);
  }

  /**
   * Helper: Triggers local browser download.
   */
  static _triggerDownload(urlOrContent, fullFilename) {
    let url = urlOrContent;
    let isCreatedUrl = false;

    // Check if it's a raw content string rather than a URL
    if (!urlOrContent.startsWith('data:') && !urlOrContent.startsWith('blob:')) {
      const blob = new Blob([urlOrContent], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
      isCreatedUrl = true;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      if (isCreatedUrl) {
        URL.revokeObjectURL(url);
      }
    }, 100);
  }
}

// Make globally available
window.ExportManager = ExportManager;
