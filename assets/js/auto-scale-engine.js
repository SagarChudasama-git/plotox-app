/**
 * AutoScaleEngine — Professional Automatic Chart Scaling System for Plotox.
 *
 * Analyzes datasets before rendering and automatically configures chart axes,
 * labels, spacing, zoom behavior, and performance settings for Apache ECharts.
 *
 * Works automatically for every supported chart type without manual user config.
 *
 * Usage:
 *   AutoScaleEngine.applyScaling(option, dataset, config, containerEl);
 *   chart.setOption(option);
 *
 * @version 1.0.0
 */
class AutoScaleEngine {

  // ─── Cache ───────────────────────────────────────────────────────────
  // WeakMap keyed by dataset object for caching computed analysis results.
  static _cache = new WeakMap();

  // Shared off-screen canvas for text measurement (created lazily).
  static _measureCanvas = null;

  // ════════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply all automatic scaling to an ECharts option object.
   *
   * @param {Object} option   - ECharts option object (mutated in place).
   * @param {Object} dataset  - Parsed dataset {headers, rows, types, stats}.
   * @param {Object} config   - Chart configuration {chartType, xAxis, yAxes, …}.
   * @param {HTMLElement} containerEl - The chart container DOM element.
   */
  static applyScaling(option, dataset, config, containerEl) {
    if (!option || !dataset || !config) return;

    const chartType = config.chartType || 'line';

    // Pie / Donut charts don't use axes — only apply performance settings
    if (chartType === 'pie' || chartType === 'donut') {
      const rowCount = dataset.rows ? dataset.rows.length : 0;
      this.optimizeAnimation(option, rowCount);
      return;
    }

    const rowCount = dataset.rows ? dataset.rows.length : 0;
    const containerWidth = containerEl ? containerEl.clientWidth : 800;
    const containerHeight = containerEl ? containerEl.clientHeight : 450;

    // 1. Detect axis type from dataset metadata
    const xAxisType = this.detectAxisType(dataset, config.xAxis);

    // 2. Apply Y-axis nice scaling for value axes
    if (option.yAxis && option.yAxis.type !== 'log') {
      this._applyYAxisScaling(option, dataset, config, containerHeight);
    }

    // 3. Apply X-axis scaling based on detected type
    if (xAxisType === 'datetime' && chartType !== 'histogram') {
      this._applyDateAxisScaling(option, dataset, config);
    } else if (xAxisType === 'category' || (option.xAxis && option.xAxis.type === 'category')) {
      this._applyCategoryAxisScaling(option, dataset, config, containerWidth);
    } else if (option.xAxis && option.xAxis.type === 'value') {
      this._applyNumericXAxisScaling(option, dataset, config, containerWidth);
    }

    // 4. Auto grid margins
    this.configureGrid(option, dataset, config, containerEl);

    // 5. Data zoom (overrides the basic zoom already set by ChartEngine)
    this.configureDataZoom(option, rowCount, chartType, containerEl);

    // 6. Progressive rendering for large datasets
    this.configureProgressiveRendering(option, rowCount, chartType);

    // 7. Animation control
    this.optimizeAnimation(option, rowCount);

    // 8. Downsampling for very dense line/area charts
    if ((chartType === 'line' || chartType === 'area') && rowCount > 5000) {
      this._applyDownsampling(option, rowCount);
    }

    // 9. Chart-type-specific tuning
    this.applyChartTypeScaling(option, chartType, dataset, config);
  }

  /**
   * Lightweight responsive re-scaling (called on resize events).
   * Only adjusts tick counts, label rotation, and margins — not data.
   *
   * @param {Object} option       - Current ECharts option.
   * @param {HTMLElement} containerEl - Chart container.
   * @param {Object} dataset      - Parsed dataset.
   * @param {Object} config       - Chart configuration.
   */
  static applyResponsiveScaling(option, containerEl, dataset, config) {
    if (!option || !containerEl) return;

    const chartType = config ? config.chartType : 'line';
    if (chartType === 'pie' || chartType === 'donut') return;

    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;

    // Re-calculate dynamic tick count for Y-axis
    if (option.yAxis && option.yAxis.type === 'value') {
      const targetTicks = this._dynamicTickCount(containerHeight);
      if (option.yAxis.min !== undefined && option.yAxis.max !== undefined) {
        const range = option.yAxis.max - option.yAxis.min;
        if (range > 0) {
          const interval = this.calculateTickInterval(option.yAxis.min, option.yAxis.max, range, targetTicks);
          option.yAxis.interval = interval;
        }
      }
    }

    // Re-calculate category label optimization
    if (option.xAxis && option.xAxis.type === 'category' && option.xAxis.data) {
      const labelConfig = this.optimizeLabels(option.xAxis.data, containerWidth);
      // Only apply auto-rotation if user hasn't set a custom rotation
      if (config && (config.xAxisLabelRotate === undefined || config.xAxisLabelRotate === 0)) {
        if (option.xAxis.axisLabel) {
          option.xAxis.axisLabel.rotate = labelConfig.rotate;
          option.xAxis.axisLabel.interval = labelConfig.interval;
        }
      }
    }

    // Re-calculate grid margins
    if (dataset && config) {
      this.configureGrid(option, dataset, config, containerEl);
    }
  }


  // ════════════════════════════════════════════════════════════════════
  //  AXIS TYPE DETECTION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Detect whether a column should be treated as numeric, datetime, or category.
   * Uses DataParser's type inference as primary signal.
   *
   * @param {Object} dataset    - Parsed dataset.
   * @param {string} columnName - Column header name.
   * @returns {string} 'numeric' | 'datetime' | 'category'
   */
  static detectAxisType(dataset, columnName) {
    if (!dataset || !dataset.types || !columnName) return 'category';
    const type = dataset.types[columnName];
    if (type === 'numeric') return 'numeric';
    if (type === 'datetime') return 'datetime';
    return 'category';
  }


  // ════════════════════════════════════════════════════════════════════
  //  NICE NUMBER ALGORITHM
  // ════════════════════════════════════════════════════════════════════

  /**
   * Compute a "nice" number — used for axis range and tick interval calculation.
   * Based on Paul Heckbert's algorithm from "Graphics Gems" (1990).
   *
   * @param {number} value - The input value to "nice-ify".
   * @param {boolean} round - If true, round to nearest nice number; if false, ceiling.
   * @returns {number} A nice round number.
   */
  static _niceNum(value, round) {
    if (value === 0) return 0;
    const negative = value < 0;
    const absVal = Math.abs(value);
    const exponent = Math.floor(Math.log10(absVal));
    const fraction = absVal / Math.pow(10, exponent);
    let niceFraction;

    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }

    const result = niceFraction * Math.pow(10, exponent);
    return negative ? -result : result;
  }

  /**
   * Calculate nice axis range with intelligent padding.
   *
   * @param {number} dataMin     - Minimum data value.
   * @param {number} dataMax     - Maximum data value.
   * @param {number} targetTicks - Desired number of ticks (default 7).
   * @returns {{min: number, max: number, tickInterval: number, tickCount: number}}
   */
  static calculateNiceRange(dataMin, dataMax, targetTicks = 7) {
    // Handle edge cases
    if (!isFinite(dataMin) || !isFinite(dataMax)) {
      return { min: 0, max: 100, tickInterval: 20, tickCount: 6 };
    }

    // All values are the same
    if (dataMin === dataMax) {
      if (dataMin === 0) {
        return { min: 0, max: 10, tickInterval: 2, tickCount: 6 };
      }
      const padding = Math.abs(dataMin) * 0.1 || 1;
      const paddedMin = dataMin - padding;
      const paddedMax = dataMax + padding;
      return this.calculateNiceRange(paddedMin, paddedMax, targetTicks);
    }

    const range = this._niceNum(dataMax - dataMin, false);
    const tickSpacing = this._niceNum(range / (targetTicks - 1), true);

    if (tickSpacing === 0) {
      return { min: dataMin, max: dataMax, tickInterval: 1, tickCount: targetTicks };
    }

    const niceMin = Math.floor(dataMin / tickSpacing) * tickSpacing;
    const niceMax = Math.ceil(dataMax / tickSpacing) * tickSpacing;

    // Calculate actual tick count
    const tickCount = Math.round((niceMax - niceMin) / tickSpacing) + 1;

    return {
      min: niceMin,
      max: niceMax,
      tickInterval: tickSpacing,
      tickCount: tickCount
    };
  }

  /**
   * Calculate a clean tick interval for a given range.
   *
   * @param {number} min         - Axis minimum.
   * @param {number} max         - Axis maximum.
   * @param {number} range       - Axis range (max - min).
   * @param {number} targetTicks - Desired tick count.
   * @returns {number} Clean tick interval.
   */
  static calculateTickInterval(min, max, range, targetTicks) {
    if (range <= 0 || targetTicks <= 1) return range || 1;
    return this._niceNum(range / (targetTicks - 1), true);
  }


  // ════════════════════════════════════════════════════════════════════
  //  DYNAMIC TICK COUNT
  // ════════════════════════════════════════════════════════════════════

  /**
   * Calculate optimal tick count based on available pixel space.
   *
   * @param {number} containerSize - Container height (for Y) or width (for X) in pixels.
   * @returns {number} Target tick count.
   */
  static _dynamicTickCount(containerSize) {
    if (containerSize < 250) return 4;
    if (containerSize < 400) return 5;
    if (containerSize < 550) return 7;
    if (containerSize < 800) return 8;
    return 10;
  }


  // ════════════════════════════════════════════════════════════════════
  //  NUMBER FORMATTING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Format a number for axis labels using K/M/B/T suffixes.
   * Falls back to scientific notation for extreme values.
   * Automatically determines decimal precision.
   *
   * @param {number} value - The numeric value.
   * @returns {string} Formatted label string.
   */
  static formatAxisLabel(value) {
    if (value === null || value === undefined || !isFinite(value)) return '';
    if (value === 0) return '0';

    const absVal = Math.abs(value);

    // Scientific notation for extremely small values
    if (absVal > 0 && absVal < 0.001) {
      return this.formatScientific(value);
    }

    // Scientific notation for extremely large values (> 999T)
    if (absVal >= 1e15) {
      return this.formatScientific(value);
    }

    // K/M/B/T formatting
    if (absVal >= 1e12) {
      return this.autoDecimalPrecision(value / 1e12) + 'T';
    }
    if (absVal >= 1e9) {
      return this.autoDecimalPrecision(value / 1e9) + 'B';
    }
    if (absVal >= 1e6) {
      return this.autoDecimalPrecision(value / 1e6) + 'M';
    }
    if (absVal >= 1e3) {
      return this.autoDecimalPrecision(value / 1e3) + 'K';
    }

    // Regular numbers
    return this.autoDecimalPrecision(value);
  }

  /**
   * Format a number in scientific notation (e.g. 4e-9, 2.5e+6).
   *
   * @param {number} value - The numeric value.
   * @returns {string} Scientific notation string.
   */
  static formatScientific(value) {
    if (value === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / Math.pow(10, exp);
    const mantissaStr = Math.abs(mantissa - Math.round(mantissa)) < 0.01
      ? Math.round(mantissa).toString()
      : mantissa.toFixed(1);
    return `${mantissaStr}e${exp >= 0 ? '+' : ''}${exp}`;
  }

  /**
   * Automatically determine appropriate decimal precision.
   * Strips unnecessary trailing zeros.
   *
   * Examples:
   *   12.000000 → "12"
   *   15.238472 → "15.24"
   *   0.00045218 → "0.00045"
   *   2.5 → "2.5"
   *
   * @param {number} value - The numeric value.
   * @returns {string} Formatted number string.
   */
  static autoDecimalPrecision(value) {
    if (!isFinite(value)) return String(value);
    if (Number.isInteger(value)) return String(value);

    const absVal = Math.abs(value);

    // Very small decimals — show significant digits
    if (absVal > 0 && absVal < 0.01) {
      // Find first significant digit position
      const str = absVal.toExponential();
      const match = str.match(/^(\d+\.?\d*)e([+-]\d+)$/);
      if (match) {
        const exp = parseInt(match[2]);
        const result = value.toFixed(Math.abs(exp) + 1);
        // Remove trailing zeros but keep at least one significant digit
        return result.replace(/0+$/, '').replace(/\.$/, '');
      }
    }

    // For values >= 100, no decimals needed
    if (absVal >= 100) {
      return Math.round(value).toString();
    }

    // For values >= 1, at most 2 decimal places
    if (absVal >= 1) {
      const str = value.toFixed(2);
      return str.replace(/0+$/, '').replace(/\.$/, '');
    }

    // For values 0.01 to 1, show 2 significant decimals
    const str = value.toFixed(4);
    return str.replace(/0+$/, '').replace(/\.$/, '');
  }


  // ════════════════════════════════════════════════════════════════════
  //  DATE AXIS SCALING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Detect the appropriate date scale granularity from an array of date strings.
   *
   * @param {string[]} values - Array of date string values.
   * @returns {{scale: string, intervals: number[]}} Scale name and sorted timestamps.
   */
  static detectDateScale(values) {
    if (!values || values.length < 2) {
      return { scale: 'daily', intervals: [] };
    }

    // Parse dates and sort
    const timestamps = values
      .map(v => {
        if (v === null || v === undefined || v === '') return null;
        const ts = Date.parse(String(v));
        return isFinite(ts) ? ts : null;
      })
      .filter(ts => ts !== null)
      .sort((a, b) => a - b);

    if (timestamps.length < 2) {
      return { scale: 'daily', intervals: timestamps };
    }

    // Calculate median interval between consecutive dates
    const diffs = [];
    for (let i = 1; i < timestamps.length; i++) {
      diffs.push(timestamps[i] - timestamps[i - 1]);
    }
    diffs.sort((a, b) => a - b);
    const medianDiff = diffs[Math.floor(diffs.length / 2)];

    // Also compute the total span
    const totalSpan = timestamps[timestamps.length - 1] - timestamps[0];

    const HOUR = 3600000;
    const DAY = 86400000;

    let scale;
    if (medianDiff < 4 * HOUR) {
      scale = 'hourly';
    } else if (medianDiff < 3 * DAY) {
      scale = 'daily';
    } else if (medianDiff < 14 * DAY) {
      scale = 'weekly';
    } else if (medianDiff < 90 * DAY) {
      scale = 'monthly';
    } else if (medianDiff < 270 * DAY) {
      scale = 'quarterly';
    } else {
      scale = 'yearly';
    }

    // Override: if total span is very large, bump up the scale
    if (totalSpan > 365 * 5 * DAY && scale === 'monthly') {
      scale = 'yearly';
    } else if (totalSpan > 365 * 2 * DAY && scale === 'daily') {
      scale = 'monthly';
    }

    return { scale, intervals: timestamps };
  }

  /**
   * Format a date value according to the detected scale.
   *
   * @param {number|string|Date} value - Date value.
   * @param {string} scale - Scale granularity.
   * @returns {string} Formatted date string.
   */
  static formatDateLabel(value, scale) {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = n => String(n).padStart(2, '0');

    switch (scale) {
      case 'hourly':
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      case 'daily':
        return `${months[date.getMonth()]} ${date.getDate()}`;
      case 'weekly':
        return `${months[date.getMonth()]} ${date.getDate()}`;
      case 'monthly':
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
      case 'quarterly': {
        const q = Math.floor(date.getMonth() / 3) + 1;
        return `Q${q} ${date.getFullYear()}`;
      }
      case 'yearly':
        return `${date.getFullYear()}`;
      default:
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
  }


  // ════════════════════════════════════════════════════════════════════
  //  CATEGORY LABEL OPTIMIZATION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Calculate optimal label display settings for category axes.
   *
   * @param {string[]} categories     - Array of category labels.
   * @param {number} containerWidth   - Available width in pixels.
   * @returns {{rotate: number, interval: number|string, maxWidth: number}}
   */
  static optimizeLabels(categories, containerWidth) {
    if (!categories || categories.length === 0) {
      return { rotate: 0, interval: 'auto', maxWidth: 100 };
    }

    const count = categories.length;
    const maxLabelLen = Math.max(...categories.map(c => String(c || '').length));

    // Estimate pixel width per label character (approximate)
    const charWidth = 7; // ~7px per character at 12px font
    const estLabelWidth = maxLabelLen * charWidth;
    const availablePerLabel = containerWidth / count;

    let rotate = 0;
    let interval = 'auto';
    let maxWidth = undefined;

    // Determine rotation
    if (availablePerLabel < estLabelWidth * 0.8) {
      // Labels will overlap — try rotation first
      if (availablePerLabel >= estLabelWidth * 0.5) {
        rotate = 30;
      } else if (availablePerLabel >= estLabelWidth * 0.3) {
        rotate = 45;
      } else {
        rotate = 60;
      }
    }

    // If still too many labels even with rotation, skip some
    const rotatedWidth = rotate > 0
      ? estLabelWidth * Math.cos(rotate * Math.PI / 180) + 12 * Math.sin(rotate * Math.PI / 180)
      : estLabelWidth;

    if (count > 0 && containerWidth / count < rotatedWidth + 4) {
      // Calculate how many labels we can show
      const fitCount = Math.max(1, Math.floor(containerWidth / (rotatedWidth + 8)));
      interval = Math.max(0, Math.ceil(count / fitCount) - 1);

      // If we still can't fit, increase rotation to 90° and recalculate
      if (interval > 5 && rotate < 90) {
        rotate = 90;
        const vertWidth = 14; // ~14px width when vertical (font height)
        const fitCountVert = Math.max(1, Math.floor(containerWidth / (vertWidth + 4)));
        interval = Math.max(0, Math.ceil(count / fitCountVert) - 1);
      }
    }

    // Truncation threshold — labels longer than 20 chars get truncated
    if (maxLabelLen > 20) {
      maxWidth = 140;
    }

    return { rotate, interval, maxWidth };
  }


  // ════════════════════════════════════════════════════════════════════
  //  AUTO GRID MARGINS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Calculate and apply dynamic grid margins based on content.
   *
   * @param {Object} option      - ECharts option (mutated).
   * @param {Object} dataset     - Parsed dataset.
   * @param {Object} config      - Chart configuration.
   * @param {HTMLElement} containerEl - Container element.
   */
  static configureGrid(option, dataset, config, containerEl) {
    if (!option.grid || typeof option.grid !== 'object') return;

    const containerWidth = containerEl ? containerEl.clientWidth : 800;
    const chartType = config.chartType || 'line';

    // Skip for chart types that don't use standard grids
    if (chartType === 'pie' || chartType === 'donut') return;

    // Estimate the longest Y-axis label length
    let maxYLabelLen = 4; // Minimum "1000"
    if (option.yAxis && option.yAxis.max !== undefined) {
      const formattedMax = this.formatAxisLabel(option.yAxis.max);
      const formattedMin = this.formatAxisLabel(option.yAxis.min || 0);
      maxYLabelLen = Math.max(formattedMax.length, formattedMin.length, maxYLabelLen);
    } else if (dataset.stats) {
      // Use stats to estimate
      for (const col of (config.yAxes || [])) {
        if (dataset.stats[col]) {
          const fMax = this.formatAxisLabel(dataset.stats[col].max || 0);
          const fMin = this.formatAxisLabel(dataset.stats[col].min || 0);
          maxYLabelLen = Math.max(fMax.length, fMin.length, maxYLabelLen);
        }
      }
    }

    // Calculate left margin based on Y-axis label width
    const yLabelPixelWidth = maxYLabelLen * 8 + 15; // chars * approx char width + padding
    const yAxisNameGap = (option.yAxis && option.yAxis.name) ? 20 : 0;
    let leftMargin = Math.max(45, yLabelPixelWidth + yAxisNameGap);

    // Calculate bottom margin based on X-axis labels
    let bottomMargin = 40;
    const hasZoom = option.dataZoom && option.dataZoom.length > 0;

    if (option.xAxis && option.xAxis.axisLabel) {
      const rotation = option.xAxis.axisLabel.rotate || 0;
      if (rotation > 0) {
        // Rotated labels need more bottom space
        const maxXLabelLen = option.xAxis.data
          ? Math.max(...option.xAxis.data.slice(0, 50).map(v => String(v || '').length))
          : 8;
        const labelHeight = maxXLabelLen * 7 * Math.sin(rotation * Math.PI / 180);
        bottomMargin = Math.max(40, Math.min(120, labelHeight + 25));
      }
    }

    if (hasZoom) {
      bottomMargin += 40; // Extra space for zoom slider
    }

    // X-axis name adds bottom space
    if (option.xAxis && option.xAxis.name) {
      bottomMargin += 15;
    }

    // Top margin — title and legend
    let topMargin = 35;
    if (config.legendPosition === 'top') {
      topMargin = 55;
    }
    if (hasZoom) {
      topMargin = Math.max(topMargin, 45);
    }

    // Right margin
    let rightMargin = 30;
    if (config.legendPosition === 'right') {
      rightMargin = Math.max(rightMargin, containerWidth * 0.15);
    }

    // Apply margins — but use percentage if the container is small
    // to avoid eating too much space
    if (containerWidth < 400) {
      leftMargin = Math.min(leftMargin, containerWidth * 0.15);
      rightMargin = Math.min(rightMargin, containerWidth * 0.1);
    }

    // Respect legend position overrides from ChartEngine
    if (config.legendPosition === 'left') {
      leftMargin = Math.max(leftMargin, containerWidth * 0.15);
    }

    option.grid.left = leftMargin;
    option.grid.right = rightMargin;
    option.grid.bottom = bottomMargin;
    option.grid.top = topMargin;
    option.grid.containLabel = true;
  }


  // ════════════════════════════════════════════════════════════════════
  //  DATA ZOOM CONFIGURATION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Configure DataZoom with tiered behavior based on data size.
   *
   * @param {Object} option      - ECharts option (mutated).
   * @param {number} rowCount    - Number of data rows.
   * @param {string} chartType   - Chart type identifier.
   * @param {HTMLElement} containerEl - Container element.
   */
  static configureDataZoom(option, rowCount, chartType, containerEl) {
    // Don't apply zoom to pie/donut/radar
    if (['pie', 'donut', 'radar', 'treemap', 'sankey', 'funnel'].includes(chartType)) {
      return;
    }

    // Tier 1: < 100 points — no zoom
    if (rowCount < 100) {
      // Remove any existing dataZoom
      if (option.dataZoom) {
        delete option.dataZoom;
      }
      return;
    }

    // Read dark mode from existing option
    const isDarkMode = option.backgroundColor &&
      (option.backgroundColor === '#181816' || option.backgroundColor.includes('18'));

    const fontColor = isDarkMode ? '#9A9895' : '#6B6B6B';
    const borderCol = isDarkMode ? '#2A2926' : '#E7E7E4';
    const fillCol = isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)';
    const bgCol = isDarkMode ? '#1C1C19' : '#FFFFFF';
    const handleCol = isDarkMode ? '#4f46e5' : '#6366f1';
    const handleBorderCol = isDarkMode ? '#6366f1' : '#4f46e5';

    const sliderZoom = {
      type: 'slider',
      show: true,
      xAxisIndex: [0],
      bottom: 15,
      height: 22,
      borderColor: borderCol,
      fillerColor: fillCol,
      backgroundColor: bgCol,
      handleIcon: 'path://M-1.5,0.5h3v9h-3V0.5z M-0.5,1.5h1v7h-1V1.5z',
      handleSize: '120%',
      handleStyle: {
        color: handleCol,
        borderColor: handleBorderCol,
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
        lineStyle: { color: isDarkMode ? '#6366f1' : '#4f46e5' },
        areaStyle: { color: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }
      },
      textStyle: {
        color: fontColor,
        fontSize: 10
      }
    };

    const insideZoom = {
      type: 'inside',
      xAxisIndex: [0],
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
      preventDefaultMouseMove: false
    };

    // Tier 2: 100–500 — slider + inside
    if (rowCount <= 500) {
      option.dataZoom = [insideZoom, sliderZoom];
    }
    // Tier 3: 500+ — slider + inside zoom with initial window
    else {
      // Calculate initial zoom window to show a reasonable number of points
      const visiblePoints = Math.min(200, Math.floor(rowCount * 0.3));
      const endPercent = Math.min(100, (visiblePoints / rowCount) * 100);

      insideZoom.zoomOnMouseWheel = true;

      sliderZoom.start = 0;
      sliderZoom.end = endPercent;

      option.dataZoom = [insideZoom, sliderZoom];
    }

    // Toolbox for zoom reset
    if (!option.toolbox) {
      option.toolbox = {
        show: true,
        right: '5%',
        top: 15,
        itemSize: 15,
        iconStyle: { borderColor: fontColor },
        emphasis: {
          iconStyle: { borderColor: isDarkMode ? '#FFFFFF' : '#000000' }
        },
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: { zoom: 'Area Zoom', back: 'Reset View' }
          },
          restore: { title: 'Reset' }
        }
      };
    }
  }


  // ════════════════════════════════════════════════════════════════════
  //  PROGRESSIVE RENDERING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Configure ECharts progressive rendering for large datasets.
   *
   * @param {Object} option   - ECharts option (mutated).
   * @param {number} rowCount - Number of data rows.
   * @param {string} chartType - Chart type.
   */
  static configureProgressiveRendering(option, rowCount, chartType) {
    // Only meaningful for series-heavy charts with lots of data
    if (rowCount < 2000) return;

    // Chart types that support progressive rendering
    const progressiveTypes = ['line', 'scatter', 'bar', 'area'];
    if (!progressiveTypes.includes(chartType)) return;

    // Apply progressive settings to each series
    if (option.series && Array.isArray(option.series)) {
      option.series.forEach(series => {
        if (rowCount >= 10000) {
          series.progressive = 500;
          series.progressiveThreshold = 5000;

          // Enable large mode for scatter
          if (series.type === 'scatter') {
            series.large = true;
            series.largeThreshold = 5000;
          }
        } else if (rowCount >= 5000) {
          series.progressive = 1000;
          series.progressiveThreshold = 3000;
        } else {
          series.progressive = 2000;
          series.progressiveThreshold = 2000;
        }
      });
    }
  }


  // ════════════════════════════════════════════════════════════════════
  //  DOWNSAMPLING (LTTB)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Largest Triangle Three Buckets (LTTB) downsampling algorithm.
   * Preserves visual shape while dramatically reducing point count.
   * O(n) time complexity.
   *
   * @param {Array} data         - Array of values or [x, y] pairs.
   * @param {number} targetPoints - Desired output point count.
   * @returns {Array} Downsampled data array.
   */
  static downsampleLTTB(data, targetPoints) {
    if (!data || data.length <= targetPoints || targetPoints < 3) {
      return data;
    }

    const dataLength = data.length;
    const sampled = [];

    // Helper to get x,y from data item
    const getXY = (item, index) => {
      if (Array.isArray(item)) {
        return { x: item[0] !== null && item[0] !== undefined ? Number(item[0]) : index, y: Number(item[1]) || 0 };
      }
      if (item !== null && item !== undefined && typeof item === 'object' && 'value' in item) {
        const v = item.value;
        if (Array.isArray(v)) return { x: Number(v[0]) || index, y: Number(v[1]) || 0 };
        return { x: index, y: Number(v) || 0 };
      }
      return { x: index, y: Number(item) || 0 };
    };

    // Always keep the first point
    sampled.push(data[0]);

    const bucketSize = (dataLength - 2) / (targetPoints - 2);

    let prevSelectedIndex = 0;

    for (let i = 1; i < targetPoints - 1; i++) {
      // Calculate bucket boundaries
      const bucketStart = Math.floor((i - 1) * bucketSize) + 1;
      const bucketEnd = Math.min(Math.floor(i * bucketSize) + 1, dataLength - 1);
      const nextBucketStart = Math.floor(i * bucketSize) + 1;
      const nextBucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, dataLength - 1);

      // Calculate the average point of the next bucket
      let avgX = 0, avgY = 0;
      let nextBucketCount = 0;
      for (let j = nextBucketStart; j < nextBucketEnd; j++) {
        const pt = getXY(data[j], j);
        avgX += pt.x;
        avgY += pt.y;
        nextBucketCount++;
      }
      if (nextBucketCount > 0) {
        avgX /= nextBucketCount;
        avgY /= nextBucketCount;
      }

      // Get the point from the previous selected bucket
      const prevPt = getXY(data[prevSelectedIndex], prevSelectedIndex);

      // Find the point in the current bucket with the largest triangle area
      let maxArea = -1;
      let selectedIndex = bucketStart;

      for (let j = bucketStart; j < bucketEnd; j++) {
        const pt = getXY(data[j], j);
        // Triangle area (simplified — sign doesn't matter)
        const area = Math.abs(
          (prevPt.x - avgX) * (pt.y - prevPt.y) -
          (prevPt.x - pt.x) * (avgY - prevPt.y)
        );
        if (area > maxArea) {
          maxArea = area;
          selectedIndex = j;
        }
      }

      sampled.push(data[selectedIndex]);
      prevSelectedIndex = selectedIndex;
    }

    // Always keep the last point
    sampled.push(data[dataLength - 1]);

    return sampled;
  }

  /**
   * Min-Max downsampling — keeps extremes in each bucket.
   * Better for scatter plots where shape preservation is less critical.
   *
   * @param {Array} data         - Array of values.
   * @param {number} targetPoints - Desired output count.
   * @returns {Array} Downsampled data.
   */
  static downsampleMinMax(data, targetPoints) {
    if (!data || data.length <= targetPoints) return data;

    const bucketSize = data.length / (targetPoints / 2);
    const sampled = [];

    for (let i = 0; i < targetPoints / 2; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.min(Math.floor((i + 1) * bucketSize), data.length);

      let minVal = Infinity, maxVal = -Infinity;
      let minItem = data[start], maxItem = data[start];

      for (let j = start; j < end; j++) {
        const val = Array.isArray(data[j]) ? data[j][1] : (typeof data[j] === 'object' ? (data[j].value || 0) : data[j]);
        const num = Number(val) || 0;
        if (num < minVal) { minVal = num; minItem = data[j]; }
        if (num > maxVal) { maxVal = num; maxItem = data[j]; }
      }

      sampled.push(minItem);
      if (minItem !== maxItem) sampled.push(maxItem);
    }

    return sampled;
  }


  // ════════════════════════════════════════════════════════════════════
  //  ANIMATION CONTROL
  // ════════════════════════════════════════════════════════════════════

  /**
   * Optimize animation settings based on dataset size.
   *
   * @param {Object} option   - ECharts option (mutated).
   * @param {number} rowCount - Number of data rows.
   */
  static optimizeAnimation(option, rowCount) {
    if (rowCount < 1000) {
      // Full animation for small datasets
      option.animationDuration = option.animationDuration || 600;
      option.animationEasing = option.animationEasing || 'cubicOut';
      // Keep animation as-is (may be disabled by publication mode)
    } else if (rowCount < 5000) {
      // Reduced animation
      option.animationDuration = 300;
      option.animationEasing = 'linear';
    } else if (rowCount < 20000) {
      // Minimal animation
      option.animationDuration = 150;
      option.animationEasing = 'linear';
      option.animationThreshold = 5000;
    } else {
      // Disable animation entirely
      option.animation = false;
      option.animationDuration = 0;
    }
  }


  // ════════════════════════════════════════════════════════════════════
  //  CHART-TYPE-SPECIFIC SCALING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply chart-type-specific optimizations.
   *
   * @param {Object} option    - ECharts option (mutated).
   * @param {string} chartType - Chart type.
   * @param {Object} dataset   - Parsed dataset.
   * @param {Object} config    - Chart configuration.
   */
  static applyChartTypeScaling(option, chartType, dataset, config) {
    switch (chartType) {
      case 'scatter':
        this._optimizeScatter(option, dataset);
        break;
      case 'bar':
        this._optimizeBar(option, dataset);
        break;
      case 'line':
      case 'area':
        this._optimizeLine(option, dataset);
        break;
      case 'histogram':
        this._optimizeHistogram(option, dataset);
        break;
      case 'heatmap':
        this._optimizeHeatmap(option, dataset);
        break;
      case 'candlestick':
        this._optimizeCandlestick(option, dataset);
        break;
      case 'boxplot':
        this._optimizeBoxPlot(option, dataset);
        break;
      default:
        break;
    }
  }

  /** Scatter: ensure scale:true and nice axis bounds for both axes */
  static _optimizeScatter(option, dataset) {
    if (option.xAxis) {
      option.xAxis.scale = true;
    }
    if (option.yAxis) {
      option.yAxis.scale = true;
    }
    // For scatter, reduce symbol size for very large datasets
    const rowCount = dataset.rows ? dataset.rows.length : 0;
    if (rowCount > 5000 && option.series) {
      option.series.forEach(s => {
        if (s.type === 'scatter') {
          s.symbolSize = Math.max(2, Math.min(6, 12 - Math.log10(rowCount) * 2));
          s.large = true;
          s.largeThreshold = 2000;
        }
      });
    }
  }

  /** Bar: ensure proper boundaryGap and nice Y range */
  static _optimizeBar(option) {
    if (option.xAxis && option.xAxis.type === 'category') {
      option.xAxis.boundaryGap = true;
    }
    // Ensure Y-axis starts at 0 for bars (unless data has negatives)
    if (option.yAxis && option.yAxis.min !== undefined && option.yAxis.min > 0) {
      option.yAxis.min = 0;
    }
  }

  /** Line/Area: optimize point visibility */
  static _optimizeLine(option, dataset) {
    const rowCount = dataset.rows ? dataset.rows.length : 0;
    if (rowCount > 200 && option.series) {
      option.series.forEach(s => {
        if (s.type === 'line') {
          // Hide individual data point symbols for dense lines
          if (rowCount > 500) {
            s.showSymbol = false;
          } else if (rowCount > 200) {
            s.symbolSize = 3;
          }
        }
      });
    }
  }

  /** Histogram: ensure Y starts at 0 */
  static _optimizeHistogram(option) {
    if (option.yAxis) {
      option.yAxis.min = 0;
    }
  }

  /** Heatmap: apply visual map scaling */
  static _optimizeHeatmap(option, dataset) {
    // Heatmap-specific scaling — future extension point
  }

  /** Candlestick: scale Y to OHLC range */
  static _optimizeCandlestick(option, dataset) {
    // Candlestick-specific scaling — future extension point
  }

  /** Box Plot: scale Y to include whiskers */
  static _optimizeBoxPlot(option, dataset) {
    // Box plot scaling — future extension point
  }


  // ════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS — AXIS SCALING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply nice scaling to the Y-axis.
   */
  static _applyYAxisScaling(option, dataset, config, containerHeight) {
    if (!option.yAxis || option.yAxis.type === 'log') return;

    // Collect all numeric Y values across all series
    let globalMin = Infinity;
    let globalMax = -Infinity;

    if (config.yAxes && dataset.stats) {
      for (const col of config.yAxes) {
        const colStats = dataset.stats[col];
        if (colStats && colStats.min !== undefined) {
          globalMin = Math.min(globalMin, colStats.min);
          globalMax = Math.max(globalMax, colStats.max);
        }
      }
    }

    // Fallback: scan series data
    if (!isFinite(globalMin) || !isFinite(globalMax)) {
      if (option.series) {
        option.series.forEach(s => {
          if (s.data) {
            s.data.forEach(item => {
              let val;
              if (Array.isArray(item)) val = item[1];
              else if (item !== null && typeof item === 'object' && 'value' in item) {
                val = Array.isArray(item.value) ? item.value[1] : item.value;
              }
              else val = item;
              const num = Number(val);
              if (isFinite(num)) {
                globalMin = Math.min(globalMin, num);
                globalMax = Math.max(globalMax, num);
              }
            });
          }
        });
      }
    }

    if (!isFinite(globalMin) || !isFinite(globalMax)) return;

    // Calculate nice range
    const targetTicks = this._dynamicTickCount(containerHeight);
    const nice = this.calculateNiceRange(globalMin, globalMax, targetTicks);

    // Apply to Y-axis
    option.yAxis.min = nice.min;
    option.yAxis.max = nice.max;
    option.yAxis.interval = nice.tickInterval;

    // Apply intelligent axis label formatter
    const self = this;
    option.yAxis.axisLabel = option.yAxis.axisLabel || {};

    // Store original formatter reference if exists
    const existingProps = { ...option.yAxis.axisLabel };
    option.yAxis.axisLabel = {
      ...existingProps,
      formatter: function(value) {
        return self.formatAxisLabel(value);
      }
    };
  }

  /**
   * Apply date-based X-axis scaling.
   */
  static _applyDateAxisScaling(option, dataset, config) {
    if (!option.xAxis) return;

    const xIdx = dataset.headers.indexOf(config.xAxis);
    if (xIdx === -1) return;

    const dateValues = dataset.rows.map(row => row[xIdx]).filter(v => v != null && v !== '');
    const { scale } = this.detectDateScale(dateValues);

    // Format the category labels as dates
    if (option.xAxis.data) {
      const self = this;
      option.xAxis.axisLabel = option.xAxis.axisLabel || {};
      const existingProps = { ...option.xAxis.axisLabel };

      // Calculate how many labels to show based on scale
      const count = option.xAxis.data.length;
      let interval = 0;

      switch (scale) {
        case 'hourly':
          interval = Math.max(0, Math.floor(count / 24) - 1);
          break;
        case 'daily':
          if (count > 90) interval = Math.floor(count / 30) - 1;
          else if (count > 30) interval = Math.floor(count / 15) - 1;
          break;
        case 'weekly':
          if (count > 52) interval = Math.floor(count / 26) - 1;
          break;
        case 'monthly':
          if (count > 24) interval = Math.floor(count / 12) - 1;
          break;
        case 'quarterly':
          if (count > 20) interval = Math.floor(count / 8) - 1;
          break;
        case 'yearly':
          if (count > 20) interval = Math.floor(count / 10) - 1;
          break;
      }

      option.xAxis.axisLabel = {
        ...existingProps,
        interval: Math.max(0, interval),
        formatter: function(value) {
          return self.formatDateLabel(value, scale);
        }
      };

      // Adjust rotation for date labels
      if (scale === 'daily' && count > 30) {
        option.xAxis.axisLabel.rotate = 30;
      } else if (scale === 'hourly' && count > 48) {
        option.xAxis.axisLabel.rotate = 45;
      }
    }
  }

  /**
   * Apply category axis label scaling.
   */
  static _applyCategoryAxisScaling(option, dataset, config, containerWidth) {
    if (!option.xAxis || !option.xAxis.data) return;

    const categories = option.xAxis.data;
    const labelConfig = this.optimizeLabels(categories, containerWidth);

    option.xAxis.axisLabel = option.xAxis.axisLabel || {};

    // Only auto-rotate if user hasn't explicitly set a rotation
    const userSetRotation = config.xAxisLabelRotate !== undefined && config.xAxisLabelRotate !== 0;
    if (!userSetRotation) {
      option.xAxis.axisLabel.rotate = labelConfig.rotate;
    }

    // Apply interval skipping
    if (labelConfig.interval !== 'auto') {
      option.xAxis.axisLabel.interval = labelConfig.interval;
    }

    // Apply label truncation for very long labels
    if (labelConfig.maxWidth) {
      option.xAxis.axisLabel.width = labelConfig.maxWidth;
      option.xAxis.axisLabel.overflow = 'truncate';
      option.xAxis.axisLabel.ellipsis = '…';
    }
  }

  /**
   * Apply nice scaling to a numeric X-axis (e.g. scatter plots).
   */
  static _applyNumericXAxisScaling(option, dataset, config, containerWidth) {
    if (!option.xAxis || option.xAxis.type !== 'value') return;

    // For scatter with scale:true, ECharts handles bounds reasonably.
    // We just apply the formatter.
    const self = this;

    option.xAxis.axisLabel = option.xAxis.axisLabel || {};
    const existingProps = { ...option.xAxis.axisLabel };
    option.xAxis.axisLabel = {
      ...existingProps,
      formatter: function(value) {
        return self.formatAxisLabel(value);
      }
    };
  }

  /**
   * Apply LTTB downsampling to line/area series.
   */
  static _applyDownsampling(option, rowCount) {
    if (!option.series) return;

    // Target: show ~2000 points maximum in initial view
    const targetPoints = Math.min(2000, Math.max(500, Math.floor(rowCount * 0.1)));

    option.series.forEach(series => {
      if ((series.type === 'line' || !series.type) && series.data && series.data.length > targetPoints) {
        // Only downsample simple value arrays (not objects with label configs)
        const firstItem = series.data[0];
        const isSimple = typeof firstItem === 'number' ||
                         firstItem === null ||
                         (Array.isArray(firstItem) && firstItem.length === 2);

        if (isSimple) {
          series.data = this.downsampleLTTB(series.data, targetPoints);
        }
      }
    });
  }


  // ════════════════════════════════════════════════════════════════════
  //  TEXT MEASUREMENT UTILITY
  // ════════════════════════════════════════════════════════════════════

  /**
   * Measure text width using an offscreen canvas (fast, no DOM reflow).
   *
   * @param {string} text     - Text to measure.
   * @param {string} font     - CSS font string (e.g. "12px Inter").
   * @returns {number} Width in pixels.
   */
  static measureText(text, font = '12px Inter, sans-serif') {
    if (!this._measureCanvas) {
      this._measureCanvas = document.createElement('canvas');
    }
    const ctx = this._measureCanvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
  }
}

// Make globally available
window.AutoScaleEngine = AutoScaleEngine;
