const formatKValue = (value) => {
  return typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(value) : value;
};

class ChartEngine {
  /**
   * Render an interactive ECharts chart inside a container.
   * Reuses existing chart instances to avoid flicker and preserve zoom.
   * Wraps everything in a try-catch so the UI never silently breaks.
   */
  static render(containerId, dataset, config, isDarkMode = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Guard: dataset must exist with headers and rows
    if (!dataset || !dataset.headers || !dataset.rows || dataset.rows.length === 0) {
      ChartEngine._showError(container, 'No data available', 'Upload or paste CSV data to generate a chart.');
      return;
    }

    // Guard: must have at least one Y-axis column selected
    if (!config.yAxes || config.yAxes.length === 0) {
      ChartEngine._showError(container, 'Select at least one Y-Axis column', 'Go to the Columns tab to configure axes.');
      return;
    }

    try {
      // Reuse existing chart instance (avoids flicker and preserves DOM)
      let chart = echarts.getInstanceByDom(container);
      if (!chart) {
        chart = echarts.init(container);
        container.addEventListener('contextmenu', e => e.preventDefault());
      }

      // 1. Prepare Columns & Values
      const xIdx = dataset.headers.indexOf(config.xAxis);
      if (xIdx === -1) {
        ChartEngine._showError(container, 'Invalid X-Axis column', `Column "${config.xAxis}" was not found in the dataset.`);
        return;
      }

      const yIndices = config.yAxes
        .map(y => dataset.headers.indexOf(y))
        .filter(idx => idx !== -1);

      if (yIndices.length === 0) {
        ChartEngine._showError(container, 'No valid Y-Axis columns', 'The selected columns were not found in the dataset.');
        return;
      }

      const parseValue = (val, type) => {
        if (val === undefined || val === null || val === '') return null;
        if (type === 'numeric') {
          const clean = String(val).replace(/[\$,%]/g, '').trim();
          if (clean === '') return null;
          const num = Number(clean);
          return isFinite(num) ? num : null;
        }
        return val;
      };

      const xValues = dataset.rows.map(row => parseValue(row[xIdx], dataset.types[config.xAxis]));

      // 2. Accent Palette matching Design System based on config.colorPalette
      const palettes = {
        classic: [
          '#6366f1', // Indigo
          '#10b981', // Emerald
          '#ea580c', // Orange
          '#3b82f6', // Blue
          '#ec4899', // Pink
          '#8b5cf6', // Purple
          '#f59e0b', // Amber
          '#14b8a6'  // Teal
        ],
        vibrant: [
          '#ff3e00', // Neon Orange-Red
          '#00f0ff', // Cyan
          '#ff00f0', // Magenta
          '#ffd700', // Gold
          '#7b2cbf', // Royal Purple
          '#00e676', // Bright Green
          '#ff007f', // Rose
          '#3a0ca3'  // Dark Violet
        ],
        orange: [
          '#ff6b35', // Premium Peach
          '#f7c59f', // Light Apricot
          '#efefd0', // Pastel Cream
          '#004e64', // Deep Sea Blue
          '#25a18e', // Bright Teal
          '#ff8f5a', // Light Coral
          '#e76f51', // Burnt Sienna
          '#f4a261'  // Sandy Orange
        ],
        forest: [
          '#2d6a4f', // Deep Green
          '#40916c', // Medium Green
          '#52b788', // Light Green
          '#74c69d', // Minty Green
          '#95d5b2', // Pastel Green
          '#d8f3dc', // Sage
          '#1b4332', // Darkest Forest
          '#081c15'  // Near Black Green
        ],
        ocean: [
          '#0077b6', // Strong Ocean Blue
          '#0096c7', // Bright Teal Blue
          '#03045e', // Midnight Blue
          '#00b4d8', // Sky Blue
          '#48cae4', // Ice Blue
          '#90e0ef', // Pale Blue
          '#ade8f4', // Soft Turquoise
          '#caf0f8'  // Foam White-Blue
        ],
        monochrome: [
          '#212529', // Charcoal
          '#343a40', // Slate Grey
          '#495057', // Medium Slate
          '#6c757d', // Grey
          '#adb5bd', // Light Slate Grey
          '#dee2e6', // Very Light Grey
          '#e9ecef', // Light Grey White
          '#f8f9fa'  // Off-white
        ]
      };
      const colorPalette = palettes[config.colorPalette] || palettes.classic;

      // Styling Variables based on Light/Dark Mode
      const defaultTextCol = isDarkMode ? '#9A9895' : '#6B6B6B';
      const fontColor = (function () {
        if (config.titleColor) {
          if (config.titleColor.startsWith('var(')) {
            return defaultTextCol;
          }
          return config.titleColor; // Apply the selected custom color to ALL chart text!
        }
        return defaultTextCol;
      })();

      const titleColor = isDarkMode ? '#FFFFFF' : '#000000';
      const gridColor = isDarkMode ? '#2A2926' : '#E7E7E4';
      const axisLineColor = isDarkMode ? '#888888' : '#333333';
      const paperBg = isDarkMode ? '#181816' : '#FEFCF8';
      const plotBg = isDarkMode ? '#1C1C19' : '#FFFFFF';

      // Dynamic Publication/Style Overrides
      const isPublication = config.publicationMode === true;
      const isScatter = config.chartType === 'scatter';
      const fontStyle = isPublication ? 'Georgia, "Times New Roman", serif' : 'Inter, sans-serif';
      const animationEnabled = !isPublication;

      const lineThickness = isPublication ? 3 : (config.lineWidth !== undefined ? Number(config.lineWidth) : 2.5);
      const lineType = isPublication ? 'solid' : (config.lineType || 'solid');

      // Gridlines visibility
      const gridType = config.gridType || 'dashed';
      const showXGridlines = (gridType !== 'none') && (isPublication ? false : (config.showXGrid !== false));
      const showYGridlines = (gridType !== 'none') && (isPublication ? false : (config.showYGrid !== false));

      // Helper: Hex color to RGBA string
      const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      // Proportional global chart text font size scaling
      const globalFontSize = (function () {
        const titleSizeStr = config.titleSize || '16px';
        const titleSize = parseInt(titleSizeStr) || 16;
        if (titleSize <= 12) return 10;
        if (titleSize <= 16) return 12;
        if (titleSize <= 20) return 14;
        return 16;
      })();

      // Check if dataZoom should be enabled (more than 100 rows, and not pie/donut chart)
      const enableZoom = dataset.rows.length > 100 && config.chartType !== 'pie' && config.chartType !== 'donut';

      // Initialize ECharts option object
      let option = {
        backgroundColor: paperBg,
        color: colorPalette,
        textStyle: {
          fontFamily: fontStyle,
          color: fontColor,
          fontSize: globalFontSize,
          fontWeight: config.titleWeight || '500',
          fontStyle: config.titleStyle || 'normal'
        },
        title: {
          show: false,
          text: config.title || 'Interactive Chart',
          textStyle: {
            fontFamily: isPublication ? 'Georgia, "Times New Roman", serif' : 'Space Grotesk, sans-serif',
            fontSize: config.titleSize ? parseInt(config.titleSize) : 16,
            fontWeight: config.titleWeight || '600',
            fontStyle: config.titleStyle || 'normal',
            color: (function () {
              if (config.titleColor) {
                if (config.titleColor.startsWith('var(')) {
                  // Resolve system default primary color based on theme
                  return isDarkMode ? '#FFFFFF' : '#000000';
                }
                return config.titleColor;
              }
              return titleColor;
            })()
          },
          left: 'center',
          top: 8
        },
        tooltip: {
          show: config.showTooltip !== false,
          trigger: isScatter ? 'item' : 'axis',
          backgroundColor: isDarkMode ? '#1e1c19' : '#ffffff',
          borderColor: gridColor,
          textStyle: {
            color: isDarkMode ? '#ffffff' : '#000000'
          },
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
          }
        },
        grid: (function () {
          let leftVal = '8%';
          let rightVal = '8%';
          let bottomVal = enableZoom ? '75px' : '10%';
          let topVal = enableZoom ? '55px' : '10%';

          if (config.legendPosition === 'left') {
            leftVal = '18%';
            rightVal = '6%';
          } else if (config.legendPosition === 'right') {
            leftVal = '6%';
            rightVal = '18%';
          } else if (config.legendPosition === 'bottom') {
            bottomVal = enableZoom ? '85px' : '16%';
            topVal = enableZoom ? '45px' : '8%';
          } else if (config.legendPosition === 'top') {
            topVal = enableZoom ? '65px' : '16%';
            bottomVal = enableZoom ? '65px' : '8%';
          }

          return {
            left: leftVal,
            right: rightVal,
            bottom: bottomVal,
            top: topVal,
            containLabel: true,
            backgroundColor: plotBg,
            show: true,
            borderColor: 'transparent'
          };
        })(),
        legend: {
          show: false
        },
        animation: animationEnabled,
        animationDuration: 600,
        animationEasing: 'cubicOut',
        xAxis: {},
        yAxis: {},
        series: []
      };

      // 3. Populate Options based on Chart Type
      if (config.chartType === 'pie' || config.chartType === 'donut') {
        const yCol = config.yAxes[0];
        const yIdx = dataset.headers.indexOf(yCol);

        if (yIdx === -1) {
          ChartEngine._showError(container, 'Invalid Y-Axis for Pie Chart', `Column "${yCol}" was not found.`);
          return;
        }

        const yValues = dataset.rows.map(row => parseValue(row[yIdx], 'numeric'));

        const pieData = xValues
          .map((xVal, idx) => ({
            name: String(xVal != null ? xVal : `Item ${idx + 1}`),
            value: yValues[idx]
          }))
          .filter(item => item.value !== null && isFinite(item.value));

        if (pieData.length === 0) {
          ChartEngine._showError(container, 'No numeric data for Pie Chart', 'Select a column that contains numeric values for the Y-Axis.');
          return;
        }

        option.tooltip.trigger = 'item';
        option.tooltip.formatter = (params) => {
          const val = Number(params.value);
          const compact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : val;
          const exact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(val) : val;
          return `${params.marker}<strong>${params.name}</strong><br/>
            Value: <strong>${compact} (${exact})</strong><br/>
            Percentage: <strong>${params.percent}%</strong>`;
        };
        option.grid = {};
        option.xAxis = { show: false };
        option.yAxis = { show: false };

        const isDonut = config.chartType === 'donut' || config.pieStyle === 'donut';
        const pieCenter = ['50%', '50%'];

        option.series.push({
          name: yCol,
          type: 'pie',
          radius: isDonut ? ['45%', '70%'] : '70%',
          roseType: config.roseType ? 'radius' : false,
          center: pieCenter,
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            show: true,
            formatter: config.showPiePercentages ? '{b}: {d}%' : '{b}: {c}',
            color: fontColor,
            fontSize: globalFontSize,
            fontWeight: config.titleWeight || '500',
            fontStyle: config.titleStyle || 'normal',
            fontFamily: fontStyle
          }
        });

      } else if (config.chartType === 'histogram') {
        const col = config.yAxes[0] || config.xAxis;
        const colIdx = dataset.headers.indexOf(col);

        if (colIdx === -1) {
          ChartEngine._showError(container, 'Invalid column for Histogram', `Column "${col}" was not found.`);
          return;
        }

        const values = dataset.rows.map(row => parseValue(row[colIdx], dataset.types[col]));
        const numericValues = values.filter(v => v !== null && isFinite(v));

        if (numericValues.length === 0) {
          ChartEngine._showError(container, 'No numeric data for Histogram', 'Select a column that contains numeric values.');
          return;
        }

        let min = Math.min(...numericValues);
        let max = Math.max(...numericValues);

        if (min === max) {
          min = min - Math.max(1, Math.abs(min) * 0.1);
          max = max + Math.max(1, Math.abs(max) * 0.1);
        }

        const binCount = (config.histogramBins && config.histogramBins !== 'auto')
          ? Number(config.histogramBins)
          : Math.min(Math.max(5, Math.ceil(Math.sqrt(numericValues.length))), 20);

        const binWidth = (max - min) / binCount;
        const binFrequencies = Array(binCount).fill(0);
        const binLabels = [];

        for (let i = 0; i < binCount; i++) {
          const start = min + i * binWidth;
          const end = start + binWidth;
          const startStr = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(start) : start.toFixed(1);
          const endStr = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(end) : end.toFixed(1);
          binLabels.push(`${startStr}–${endStr}`);
        }

        numericValues.forEach(val => {
          let binIdx = Math.floor((val - min) / binWidth);
          if (binIdx >= binCount) binIdx = binCount - 1;
          if (binIdx < 0) binIdx = 0;
          binFrequencies[binIdx]++;
        });

        option.tooltip.trigger = 'axis';
        option.tooltip.axisPointer = { type: 'shadow' };
        option.tooltip.formatter = (params) => {
          const item = params[0];
          const val = Number(item.value);
          const compact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : val;
          const exact = typeof NumberFormatter !== 'undefined' ? NumberFormatter.formatFull(val) : val;
          return `${item.name}<br/>Count: <strong>${compact} (${exact})</strong>`;
        };

        option.xAxis = {
          type: 'category',
          data: binLabels,
          name: config.xAxisLabel !== undefined ? config.xAxisLabel : (col || ''),
          nameLocation: 'center',
          nameGap: 30,
          nameTextStyle: {
            color: fontColor,
            fontFamily: fontStyle,
            fontSize: globalFontSize + 1,
            fontWeight: config.titleWeight || '600',
            fontStyle: config.titleStyle || 'normal'
          },
          axisLabel: {
            color: fontColor,
            rotate: config.xAxisLabelRotate !== undefined ? Number(config.xAxisLabelRotate) : 15,
            formatter: formatKValue,
            fontFamily: fontStyle,
            fontSize: globalFontSize,
            fontWeight: config.titleWeight || '500',
            fontStyle: config.titleStyle || 'normal'
          },
          axisLine: { show: true, lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: true, lineStyle: { color: axisLineColor } }
        };

        option.yAxis = {
          type: 'value',
          name: 'Frequency',
          nameLocation: 'middle',
          nameGap: 50,
          nameRotate: 90,
          nameTextStyle: {
            color: fontColor,
            fontFamily: fontStyle,
            fontSize: globalFontSize + 1,
            fontWeight: config.titleWeight || '600',
            fontStyle: config.titleStyle || 'normal'
          },
          boundaryGap: ['0%', '10%'],
          axisLabel: {
            color: fontColor,
            formatter: formatKValue,
            fontFamily: fontStyle,
            fontSize: globalFontSize,
            fontWeight: config.titleWeight || '500',
            fontStyle: config.titleStyle || 'normal'
          },
          splitLine: { show: showYGridlines, lineStyle: { color: gridColor, type: gridType } },
          axisLine: { show: true, lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: true, lineStyle: { color: axisLineColor } }
        };

        const defaultColor = colorPalette[0];
        const seriesColor = (config.seriesColors && config.seriesColors[col]) || defaultColor;

        option.series.push({
          name: col,
          type: 'bar',
          barCategoryGap: '0%',
          data: binFrequencies,
          itemStyle: {
            color: seriesColor,
            borderColor: isDarkMode ? '#181816' : '#ffffff',
            borderWidth: 1,
            borderRadius: [2, 2, 0, 0]
          }
        });

        // Overlay Normal Distribution Bell Curve
        if (config.showBellCurve && numericValues.length > 1) {
          const N = numericValues.length;
          const mean = numericValues.reduce((sum, v) => sum + v, 0) / N;
          const variance = numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / N;
          const stdDev = Math.sqrt(variance);

          if (stdDev > 0) {
            const bellCurveData = [];
            for (let i = 0; i < binCount; i++) {
              const xVal = min + (i + 0.5) * binWidth;
              const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(xVal - mean, 2) / (2 * Math.pow(stdDev, 2)));
              const frequencyVal = N * binWidth * pdf;
              bellCurveData.push(Number(frequencyVal.toFixed(2)));
            }

            option.series.push({
              name: 'Normal Fit',
              type: 'line',
              smooth: true,
              showSymbol: false,
              data: bellCurveData,
              lineStyle: {
                color: isDarkMode ? '#ff9f43' : '#e67e22',
                width: 3,
                type: 'dashed'
              },
              z: 5
            });
          }
        }

      } else {
        const isScatter = config.chartType === 'scatter';
        let effectiveXValues = xValues;
        let xIsNumeric = true;

        if (isScatter) {
          const xType = dataset.types[config.xAxis];
          if (xType !== 'numeric') {
            xIsNumeric = false;
            effectiveXValues = dataset.rows.map((_, i) => i);
          } else {
            effectiveXValues = xValues.map(v => {
              if (v === null || !isFinite(Number(v))) return null;
              return Number(v);
            });
          }
        }

        option.xAxis = {
          type: isScatter ? 'value' : 'category',
          name: config.xAxisLabel !== undefined ? config.xAxisLabel : (config.xAxis || ''),
          nameLocation: 'center',
          nameGap: 30,
          nameTextStyle: {
            color: fontColor,
            fontFamily: fontStyle,
            fontSize: globalFontSize + 1,
            fontWeight: config.titleWeight || '600',
            fontStyle: config.titleStyle || 'normal'
          },
          data: isScatter ? undefined : xValues,
          boundaryGap: (config.chartType === 'line' || config.chartType === 'area') ? false : true,
          axisLabel: {
            color: fontColor,
            rotate: config.xAxisLabelRotate !== undefined ? Number(config.xAxisLabelRotate) : 0,
            formatter: formatKValue,
            fontFamily: fontStyle,
            fontSize: globalFontSize,
            fontWeight: config.titleWeight || '500',
            fontStyle: config.titleStyle || 'normal'
          },
          axisLine: { show: true, lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: true, lineStyle: { color: axisLineColor } },
          splitLine: { show: showXGridlines, lineStyle: { color: gridColor, type: gridType } }
        };

        option.yAxis = {
          type: config.logY ? 'log' : 'value',
          name: config.yAxisLabel !== undefined ? config.yAxisLabel : (config.yAxes && config.yAxes.length === 1 ? config.yAxes[0] : ''),
          nameLocation: 'middle',
          nameGap: 50,
          nameRotate: 90,
          nameTextStyle: {
            color: fontColor,
            fontFamily: fontStyle,
            fontSize: globalFontSize + 1,
            fontWeight: config.titleWeight || '600',
            fontStyle: config.titleStyle || 'normal'
          },
          boundaryGap: ['0%', '10%'],
          axisLabel: {
            color: fontColor,
            formatter: formatKValue,
            fontFamily: fontStyle,
            fontSize: globalFontSize,
            fontWeight: config.titleWeight || '500',
            fontStyle: config.titleStyle || 'normal'
          },
          splitLine: { show: showYGridlines, lineStyle: { color: gridColor, type: gridType } },
          axisLine: { show: true, lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: true, lineStyle: { color: axisLineColor } }
        };

        yIndices.forEach((yIdx, idx) => {
          const yCol = config.yAxes[idx];
          const yValues = dataset.rows.map(row => parseValue(row[yIdx], 'numeric'));

          let seriesData = [];
          if (isScatter) {
            seriesData = effectiveXValues
              .map((xVal, sIdx) => [xVal, yValues[sIdx]])
              .filter(pair => pair[0] !== null && pair[1] !== null && isFinite(pair[0]) && isFinite(pair[1]));
            if (config.logY) {
              seriesData = seriesData.filter(pair => pair[1] > 0);
            }
          } else {
            seriesData = yValues;
            if (config.logY) {
              seriesData = seriesData.map(val => (val !== null && val > 0) ? val : null);
            }
          }

          const defaultColor = colorPalette[idx % colorPalette.length];
          const seriesColor = (config.seriesColors && config.seriesColors[yCol]) || defaultColor;

          const seriesOption = {
            name: yCol,
            type: config.chartType === 'bar' ? 'bar' : (isScatter ? 'scatter' : 'line'),
            data: seriesData,
            symbolSize: isScatter ? (config.scatterSize ? Number(config.scatterSize) : 12) : 6,
            showSymbol: (config.showPoints !== false) || !!config.showMinMax,
            smooth: config.lineSmooth ? 0.3 : false,
            itemStyle: {
              color: seriesColor
            }
          };

          if (config.chartType === 'bar' && config.showBarLabels) {
            seriesOption.label = {
              show: true,
              position: config.barmode === 'stack' ? 'inside' : 'top',
              formatter: (params) => formatKValue(params.value),
              color: isDarkMode ? '#FFFFFF' : '#000000',
              fontSize: globalFontSize - 1,
              fontWeight: '600',
              fontFamily: fontStyle
            };
          }

          if (config.chartType === 'line' || config.chartType === 'area') {
            seriesOption.lineStyle = {
              color: seriesColor,
              width: lineThickness,
              type: lineType
            };
          }

          if (config.showMinMax) {
            // Find min and max values and their indices to only label those points
            let minVal = Infinity;
            let maxVal = -Infinity;
            let minIndices = [];
            let maxIndices = [];

            seriesData.forEach((item, sIdx) => {
              const val = isScatter ? (item ? item[1] : null) : item;
              if (val !== null && val !== undefined && isFinite(val)) {
                if (val < minVal) {
                  minVal = val;
                  minIndices = [sIdx];
                } else if (val === minVal) {
                  minIndices.push(sIdx);
                }
                if (val > maxVal) {
                  maxVal = val;
                  maxIndices = [sIdx];
                } else if (val === maxVal) {
                  maxIndices.push(sIdx);
                }
              }
            });

            // Base label config: hide by default for the series
            seriesOption.label = {
              show: false
            };

            const len = seriesData.length;
            seriesOption.data = seriesData.map((item, sIdx) => {
              const isMin = minIndices.includes(sIdx);
              const isMax = maxIndices.includes(sIdx);

              if (!isMin && !isMax) {
                if (config.showPoints === false) {
                  return {
                    value: item,
                    symbol: 'none',
                    symbolSize: 0
                  };
                }
                return item;
              }

              // Determine alignment
              let align = 'center';
              if (sIdx === 0) {
                align = 'left';
              } else if (sIdx === len - 1) {
                align = 'right';
              }

              const val = isScatter ? item[1] : item;
              const labelText = typeof val === 'number'
                ? (typeof NumberFormatter !== 'undefined' ? NumberFormatter.format(val) : formatKValue(val))
                : (val !== null && val !== undefined ? String(val) : '');

              return {
                value: item,
                symbol: 'circle',
                symbolSize: isScatter ? (config.scatterSize ? Number(config.scatterSize) : 12) : 6,
                label: {
                  show: true,
                  position: 'top',
                  distance: 8,
                  align: align,
                  formatter: () => labelText,
                  fontSize: globalFontSize - 1,
                  fontWeight: config.titleWeight || '600',
                  fontStyle: config.titleStyle || 'normal',
                  fontFamily: fontStyle,
                  color: seriesColor
                }
              };
            });
          }

          if (config.chartType === 'area') {
            seriesOption.areaStyle = {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: hexToRgba(seriesColor, 0.3) },
                { offset: 1, color: hexToRgba(seriesColor, 0.02) }
              ])
            };
          }

          if (config.chartType === 'bar' && config.barmode === 'stack') {
            seriesOption.stack = 'total';
          }

          option.series.push(seriesOption);

          // Add Scatter Trendline if configured
          if (isScatter && config.showTrendline && seriesData.length > 1) {
            const n = seriesData.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            let validPoints = 0;
            seriesData.forEach(pt => {
              const x = pt[0];
              const y = pt[1];
              if (x !== null && y !== null && isFinite(x) && isFinite(y)) {
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
                validPoints++;
              }
            });

            if (validPoints > 1) {
              const denominator = (validPoints * sumXX - sumX * sumX);
              if (denominator !== 0) {
                const slope = (validPoints * sumXY - sumX * sumY) / denominator;
                const intercept = (sumY - slope * sumX) / validPoints;

                const xValsOnly = seriesData.map(pt => pt[0]).filter(x => x !== null && isFinite(x));
                const minX = Math.min(...xValsOnly);
                const maxX = Math.max(...xValsOnly);

                option.series.push({
                  name: `${yCol} Trend`,
                  type: 'line',
                  data: [
                    [minX, slope * minX + intercept],
                    [maxX, slope * maxX + intercept]
                  ],
                  showSymbol: false,
                  lineStyle: {
                    color: seriesColor,
                    width: 2,
                    type: 'dashed'
                  },
                  z: 4
                });
              }
            }
          }
        });
      }

      if (enableZoom) {
        option.dataZoom = [
          {
            type: 'inside',
            xAxisIndex: [0]
          },
          {
            type: 'slider',
            show: true,
            xAxisIndex: [0],
            bottom: 15,
            height: 20,
            borderColor: isDarkMode ? '#2A2926' : '#E7E7E4',
            fillerColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
            backgroundColor: isDarkMode ? '#1C1C19' : '#FFFFFF',
            handleIcon: 'path://M-1.5,0.5h3v9h-3V0.5z M-0.5,1.5h1v7h-1V1.5z',
            handleSize: '120%',
            handleStyle: {
              color: isDarkMode ? '#4f46e5' : '#6366f1',
              borderColor: isDarkMode ? '#6366f1' : '#4f46e5',
              borderWidth: 1,
              shadowBlur: 3,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
              shadowOffsetX: 1,
              shadowOffsetY: 1
            },
            moveHandleSize: 7,
            moveHandleStyle: {
              color: isDarkMode ? '#3A3936' : '#D7D7D4'
            },
            selectedDataBackground: {
              lineStyle: {
                color: isDarkMode ? '#6366f1' : '#4f46e5'
              },
              areaStyle: {
                color: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'
              }
            },
            textStyle: {
              color: fontColor,
              fontFamily: fontStyle,
              fontSize: 10
            }
          }
        ];

        option.toolbox = {
          show: true,
          right: '5%',
          top: 15,
          itemSize: 15,
          iconStyle: {
            borderColor: fontColor
          },
          emphasis: {
            iconStyle: {
              borderColor: isDarkMode ? '#FFFFFF' : '#000000'
            }
          },
          feature: {
            dataZoom: {
              yAxisIndex: 'none',
              title: {
                zoom: 'Area Zoom',
                back: 'Reset View'
              }
            },
            restore: {
              title: 'Reset'
            }
          }
        };
      }

      chart.setOption(option, { notMerge: true, lazyUpdate: false });

      if (!container.__resizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
          chart.resize();
        });
        resizeObserver.observe(container);
        container.__resizeObserver = resizeObserver;
      }

    } catch (err) {
      console.error('ChartEngine.render error:', err);
      ChartEngine._showError(container, 'Chart rendering error', err.message || 'An unexpected error occurred while generating the chart.');
    }
  }

  static _showError(container, title, detail) {
    const existing = echarts.getInstanceByDom(container);
    if (existing) {
      existing.dispose();
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;gap:12px;color:var(--color-secondary-text);text-align:center;height:100%;">
        <span class="material-symbols-outlined" style="font-size:40px;opacity:0.4;">bar_chart</span>
        <span style="font-size:14px;font-weight:600;color:var(--color-primary);">${title}</span>
        <span style="font-size:12px;">${detail}</span>
      </div>
    `;
  }
}

window.ChartEngine = ChartEngine;
