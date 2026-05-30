function initLanding() {

  const formatKValue = (value) => {
    if (typeof value === 'number' && Math.abs(value) >= 1000) {
      const kValue = value / 1000;
      return (kValue % 1 === 0 ? kValue.toFixed(0) : kValue.toFixed(1)) + 'k';
    }
    return value;
  };

  // ── Panel Tab Switching ──────────────────────────────────
  const tabs = document.querySelectorAll('.panel-tab');
  const cards = document.querySelectorAll('.panel-card');

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      if (cards.length > 0) {
        cards.forEach(function (c) { c.classList.remove('active'); });
        if (cards[index]) {
          cards[index].classList.add('active');
        }
      }

      // Render ECharts chart when "Data Visualization" tab (index 2) is clicked
      if (index === 2) {
        renderShowcaseECharts();
      }
    });
  });

  // ── Antigravity-Style Giant Text Scroll Animation ─────────
  // Each letter with data-rise > 0 floats upward at its own rate
  (function initGiantTextAnimation() {
    const section = document.getElementById('giant-text-reveal');
    if (!section) return;

    const letters = section.querySelectorAll('.gt-letter');
    const tagline = section.querySelector('.giant-text-tagline');

    // Build animation data for each rising letter
    const risingLetters = [];
    letters.forEach(function (el) {
      const factor = parseFloat(el.getAttribute('data-rise') || '0');
      if (factor > 0) {
        risingLetters.push({ el: el, factor: factor, current: 0 });
      }
    });

    if (risingLetters.length === 0) return;

    let isVisible = false;
    let rafId = null;

    function getMaxRise() {
      var fontSize = parseFloat(window.getComputedStyle(letters[0]).fontSize);
      return fontSize * 0.4;
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function clamp(v, min, max) {
      return Math.min(Math.max(v, min), max);
    }

    function tick() {
      if (!isVisible) { rafId = null; return; }

      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight;
      var maxRise = getMaxRise();

      // Use a much longer scroll range (2x viewport height) so animation
      // unfolds gradually over extended scrolling, not all at once
      var scrollRange = vh * 2;

      // Progress: 0 when section top first enters viewport bottom
      //           1 after scrolling 2x viewport heights further
      var progress = clamp((vh - rect.top) / scrollRange, 0, 1);

      // Quartic ease-out — very gentle start, natural deceleration
      var eased = 1 - Math.pow(1 - progress, 4);

      // Animate each rising letter with its own factor
      for (var i = 0; i < risingLetters.length; i++) {
        var letter = risingLetters[i];
        var target = eased * maxRise * letter.factor;

        // Very low lerp (0.055) for buttery slow trailing motion
        letter.current = lerp(letter.current, target, 0.055);

        if (Math.abs(letter.current - target) < 0.15) {
          letter.current = target;
        }

        letter.el.style.setProperty('--rise-amount', letter.current);
      }

      // Tagline appears late in the scroll
      if (tagline) {
        if (progress > 0.7) {
          tagline.classList.add('visible');
        } else {
          tagline.classList.remove('visible');
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        isVisible = entry.isIntersecting;
        if (isVisible && !rafId) {
          rafId = requestAnimationFrame(tick);
        }
      });
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });

    observer.observe(section);
  })();

  // ── Render Showcase ECharts Chart with Line Race Animation ──
  function renderShowcaseECharts() {
    const container = document.getElementById('showcase-plotly-chart');
    if (!container || typeof echarts === 'undefined') return;

    // Clear any previous interval to prevent overlapping animations
    if (container.__animationInterval) {
      clearInterval(container.__animationInterval);
      container.__animationInterval = null;
    }

    // Dispose of existing chart instance to start fresh (triggers entry animation)
    let chart = echarts.getInstanceByDom(container);
    if (chart) {
      chart.dispose();
    }

    chart = echarts.init(container);
    container.addEventListener('contextmenu', e => e.preventDefault());

    const isDark = document.documentElement.classList.contains('dark');
    const fontColor = isDark ? '#9A9895' : '#6B6B6B';
    const gridColor = isDark ? '#2A2926' : '#E7E7E4';
    const paperBg = isDark ? '#181816' : '#FCFCFB';
    const plotBg = isDark ? '#1C1C19' : '#FFFFFF';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Declarative dataset structure for ECharts Data Transform Filter
    const rawSource = [
      ['Month', 'Index', 'MRR', 'Signups'],
      ['Jan', 0, 42500, 312],
      ['Feb', 1, 46200, 341],
      ['Mar', 2, 51800, 389],
      ['Apr', 3, 58300, 412],
      ['May', 4, 65100, 438],
      ['Jun', 5, 71400, 461],
      ['Jul', 6, 78900, 497],
      ['Aug', 7, 88200, 534],
      ['Sep', 8, 96500, 578],
      ['Oct', 9, 107300, 621],
      ['Nov', 10, 119800, 688],
      ['Dec', 11, 134200, 742]
    ];

    // Initial configuration with ECharts Options
    const option = {
      backgroundColor: paperBg,
      color: ['#6366f1', '#10b981'],
      textStyle: {
        fontFamily: 'Inter, sans-serif',
        color: fontColor
      },
      tooltip: {
        trigger: 'axis',
        transitionDuration: 0.15,
        confine: true,
        backgroundColor: isDark ? '#1e1c19' : '#ffffff',
        borderColor: gridColor,
        textStyle: {
          color: isDark ? '#ffffff' : '#000000'
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        top: '12%',
        bottom: '12%',
        containLabel: true,
        backgroundColor: plotBg,
        show: true,
        borderColor: 'transparent'
      },
      dataset: {
        source: rawSource
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: months, // Fixed categories to prevent X-axis scaling animation
        axisLabel: { color: fontColor },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'MRR ($)',
          nameTextStyle: { color: fontColor },
          min: 0,
          max: 140000, // Fixed max scale prevents dynamic Y-axis "zoom out" animation
          axisLabel: {
            color: fontColor,
            formatter: (value) => '$' + formatKValue(value)
          },
          splitLine: { lineStyle: { color: gridColor } },
          axisLine: { show: false }
        },
        {
          type: 'value',
          name: 'Signups',
          nameTextStyle: { color: fontColor },
          min: 0,
          max: 800, // Fixed max scale prevents dynamic Y-axis "zoom out" animation
          axisLabel: { color: fontColor, formatter: formatKValue },
          splitLine: { show: false }, // only show grid lines for left axis
          axisLine: { show: false }
        }
      ],
      // Enable native ECharts smooth line-drawing entry animation
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      series: [
        {
          name: 'MRR ($)',
          type: 'line',
          encode: { x: 'Month', y: 'MRR' },
          yAxisIndex: 0,
          smooth: 0.3,
          lineStyle: { width: 3 },
          symbolSize: 6,
          emphasis: {
            scale: true,
            lineStyle: { width: 4 }
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99, 102, 241, 0.2)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.01)' }
            ])
          }
        },
        {
          name: 'Signups',
          type: 'line',
          encode: { x: 'Month', y: 'Signups' },
          yAxisIndex: 1,
          smooth: 0.3,
          lineStyle: { width: 3 },
          symbolSize: 6,
          emphasis: {
            scale: true,
            lineStyle: { width: 4 }
          }
        }
      ]
    };

    chart.setOption(option);

    // Dynamic responsiveness via ResizeObserver
    if (container.__resizeObserver) {
      container.__resizeObserver.disconnect();
    }
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(container);
    container.__resizeObserver = resizeObserver;
  }

  // ── Theme Change — Re-render charts ──────────────────────
  window.addEventListener('themeChanged', function () {
    const pane = document.getElementById('pane-visualization');
    if (pane && pane.classList.contains('active')) {
      renderShowcaseECharts();
    }

    // Also re-render the showcase chart
    const showcaseContainer = document.getElementById('dashboard-showcase-chart');
    if (showcaseContainer && showcaseContainer.__transformChartInstance) {
      const activePill = document.querySelector('.selector-pill.active');
      if (activePill) {
        // Triggering click re-calculates colors and updates active theme
        activePill.click();
      }
    }
  });

  // ── Play Button (Hero Panel) ─────────────────────────────
  const playBtn = document.querySelector('.play-btn');
  let playing = false;

  if (playBtn) {
    playBtn.addEventListener('click', function () {
      playing = !playing;
      const icon = playBtn.querySelector('.material-symbols-outlined');
      icon.textContent = playing ? 'pause' : 'play_arrow';
    });
  }

  // ── Multi-Chart Showcase Widget (ECharts version) ────────
  function initChartShowcaseWidget() {
    const chartContainer = document.getElementById('dashboard-showcase-chart');
    if (!chartContainer || typeof echarts === 'undefined') return;

    let showcaseChart = echarts.getInstanceByDom(chartContainer);
    if (showcaseChart) {
      showcaseChart.dispose();
    }
    showcaseChart = echarts.init(chartContainer);
    chartContainer.addEventListener('contextmenu', e => e.preventDefault());

    const selectorPills = document.querySelectorAll('.selector-pill');
    const titleText = document.getElementById('showcase-title-text');
    const descText = document.getElementById('showcase-desc-text');
    const statsValue = document.getElementById('showcase-stats-value');

    let currentChart = 'line';

    const titles = {
      line: 'Line Chart Analysis',
      bar: 'Bar Chart Analysis',
      scatter: 'Scatter Plot Analysis',
      area: 'Area Chart Analysis',
      pie: 'Pie Chart Analysis',
      histogram: 'Histogram Analysis'
    };

    // Descriptions for each chart type
    const descriptions = {
      line: 'Interactive line chart tracking daily revenue and target benchmarks over 120 days.',
      bar: 'Grouped daily sales vs targets over 100 days with zoomable category columns.',
      scatter: 'Large dataset distribution mapping ROI against marketing spend across 120 nodes.',
      area: 'Filled area series mapping daily signup velocity and user acquisition trends over 120 days.',
      pie: 'Proper circular pie chart with segment labels and scrollable paging legend.',
      histogram: 'Value frequency distribution binned into 12 segments across 150 data points.'
    };

    // Stats for each chart type
    const stats = {
      line: '120 Days (Revenue vs Target)',
      bar: '100 Days (Sales vs Target)',
      scatter: '120 Data Points (Spend vs ROI)',
      area: '120 Days (Signups Trend)',
      pie: '166 Samples (6 Main Sectors)',
      histogram: '150 Samples (Value Bins)'
    };

    // Helper to generate 100+ daily data points
    function generateDailyData(count, baseVal, variance, trend = 0) {
      const dates = [];
      const series1 = [];
      const series2 = [];
      let val1 = baseVal;
      let val2 = baseVal * 0.95;
      
      const start = new Date(2026, 0, 1);
      for (let i = 0; i < count; i++) {
        const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        dates.push(dateStr);
        
        val1 += (Math.random() - 0.48) * variance + trend;
        val2 += (Math.random() - 0.48) * variance + trend * 0.95;
        
        series1.push(Math.round(Math.max(10, val1)));
        series2.push(Math.round(Math.max(10, val2)));
      }
      return { dates, series1, series2 };
    }

    function renderShowcaseChart() {
      const isDark = document.documentElement.classList.contains('dark');
      const fontColor = isDark ? '#9A9895' : '#6B6B6B';
      const gridColor = isDark ? '#2A2926' : '#E7E7E4';

      // Update widget text elements
      if (titleText) titleText.textContent = titles[currentChart];
      if (descText) descText.textContent = descriptions[currentChart];
      if (statsValue) statsValue.textContent = stats[currentChart];

      let option = {};

      if (currentChart === 'line') {
        const data = generateDailyData(120, 50, 8, 0.4);
        option = {
          backgroundColor: 'transparent',
          color: ['#6366f1', '#10b981'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'axis',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          grid: { left: '3%', right: '5%', top: '12%', bottom: '22%', containLabel: true },
          xAxis: {
            type: 'category',
            data: data.dates,
            boundaryGap: false,
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            splitLine: { lineStyle: { color: gridColor } }
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 40 },
            { type: 'slider', start: 0, end: 40, height: 16, bottom: '2%', textStyle: { fontSize: 8 }, handleSize: '80%' }
          ],
          series: [
            {
              name: 'Revenue',
              type: 'line',
              data: data.series1,
              smooth: 0.2,
              lineStyle: { width: 2.5 },
              symbol: 'none',
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(99, 102, 241, 0.15)' },
                  { offset: 1, color: 'rgba(99, 102, 241, 0.01)' }
                ])
              }
            },
            {
              name: 'Target',
              type: 'line',
              data: data.series2,
              smooth: 0.2,
              lineStyle: { width: 1.5, type: 'dashed' },
              symbol: 'none'
            }
          ]
        };
      } else if (currentChart === 'bar') {
        const data = generateDailyData(100, 200, 25, 1);
        option = {
          backgroundColor: 'transparent',
          color: ['#8b5cf6', '#3b82f6'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'axis',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          grid: { left: '3%', right: '5%', top: '12%', bottom: '22%', containLabel: true },
          xAxis: {
            type: 'category',
            data: data.dates,
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            splitLine: { lineStyle: { color: gridColor } }
          },
          dataZoom: [
            { type: 'inside', start: 70, end: 100 },
            { type: 'slider', start: 70, end: 100, height: 16, bottom: '2%', textStyle: { fontSize: 8 }, handleSize: '80%' }
          ],
          series: [
            {
              name: 'Sales',
              type: 'bar',
              data: data.series1,
              emphasis: { focus: 'series' }
            },
            {
              name: 'Target',
              type: 'bar',
              data: data.series2,
              emphasis: { focus: 'series' }
            }
          ]
        };
      } else if (currentChart === 'scatter') {
        const points = [];
        for (let i = 0; i < 120; i++) {
          const x = +(Math.random() * 100).toFixed(2);
          const y = +(x * 1.5 + Math.random() * 40 - 20 + 30).toFixed(2);
          points.push([x, y]);
        }
        option = {
          backgroundColor: 'transparent',
          color: ['#3b82f6'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'item',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          grid: { left: '3%', right: '5%', top: '12%', bottom: '22%', containLabel: true },
          xAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } },
            splitLine: { lineStyle: { color: gridColor } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } },
            splitLine: { lineStyle: { color: gridColor } }
          },
          dataZoom: [
            { type: 'inside', filterMode: 'empty' },
            { type: 'slider', height: 16, bottom: '2%', textStyle: { fontSize: 8 }, filterMode: 'empty', handleSize: '80%' }
          ],
          series: [
            {
              name: 'Spend vs ROI',
              type: 'scatter',
              symbolSize: 6,
              emphasis: {
                scale: true,
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.4)'
                }
              },
              data: points
            }
          ]
        };
      } else if (currentChart === 'area') {
        const data = generateDailyData(120, 100, 12, 0.5);
        option = {
          backgroundColor: 'transparent',
          color: ['#10b981'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'axis',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          grid: { left: '3%', right: '5%', top: '12%', bottom: '22%', containLabel: true },
          xAxis: {
            type: 'category',
            data: data.dates,
            boundaryGap: false,
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            splitLine: { lineStyle: { color: gridColor } }
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 50 },
            { type: 'slider', start: 0, end: 50, height: 16, bottom: '2%', textStyle: { fontSize: 8 }, handleSize: '80%' }
          ],
          series: [
            {
              name: 'Signups',
              type: 'line',
              data: data.series1,
              smooth: 0.2,
              lineStyle: { width: 2.5 },
              symbol: 'none',
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                  { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }
                ])
              }
            }
          ]
        };
      } else if (currentChart === 'pie') {
        const categories = ['Tech', 'Health', 'Finance', 'Education', 'Retail', 'Services'];
        const values = [55, 38, 27, 20, 15, 11];
        const data = categories.map((cat, i) => ({ value: values[i], name: cat }));
        
        option = {
          backgroundColor: 'transparent',
          color: ['#6366f1', '#10b981', '#ea580c', '#3b82f6', '#8b5cf6', '#ec4899'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'item',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          legend: {
            type: 'scroll',
            orient: 'horizontal',
            bottom: '2%',
            left: 'center',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { color: fontColor, fontSize: 9, fontFamily: 'Inter, sans-serif' }
          },
          series: [
            {
              name: 'Industry Sectors',
              type: 'pie',
              radius: '55%',
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              label: {
                show: true,
                position: 'outside',
                formatter: '{b}\n({d}%)',
                color: fontColor,
                fontSize: 9
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.15)'
                }
              },
              labelLine: {
                show: true,
                length: 8,
                length2: 8,
                lineStyle: {
                  color: gridColor
                }
              },
              data: data
            }
          ]
        };
      } else if (currentChart === 'histogram') {
        const bins = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100', '100-110', '110-120'];
        const values = [4, 8, 15, 22, 28, 33, 20, 12, 6, 4, 2, 1];
        option = {
          backgroundColor: 'transparent',
          color: ['#ea580c'],
          textStyle: { fontFamily: 'Inter, sans-serif', color: fontColor },
          tooltip: {
            trigger: 'axis',
            transitionDuration: 0.15,
            confine: true,
            backgroundColor: isDark ? '#1c1c19' : '#ffffff',
            borderColor: gridColor,
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 11 },
            padding: 8
          },
          grid: { left: '3%', right: '5%', top: '12%', bottom: '22%', containLabel: true },
          xAxis: {
            type: 'category',
            data: bins,
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            axisLine: { lineStyle: { color: gridColor } }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: fontColor, fontSize: 9, formatter: formatKValue },
            splitLine: { lineStyle: { color: gridColor } }
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, height: 16, bottom: '2%', textStyle: { fontSize: 8 }, handleSize: '80%' }
          ],
          series: [
            {
              name: 'Sample Count',
              type: 'bar',
              barWidth: '85%',
              data: values,
              itemStyle: { borderRadius: [2, 2, 0, 0] }
            }
          ]
        };
      }

      option.animation = true;
      option.animationDuration = 700;
      option.animationEasing = 'cubicOut';

      showcaseChart.setOption(option, true);
    }

    // Click handlers for the pills
    selectorPills.forEach(pill => {
      pill.addEventListener('click', function () {
        selectorPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentChart = pill.getAttribute('data-chart');
        renderShowcaseChart();
      });
    });

    // Initial render
    renderShowcaseChart();

    // Resize observer
    if (chartContainer.__resizeObserver) {
      chartContainer.__resizeObserver.disconnect();
    }
    const resizeObserver = new ResizeObserver(() => {
      showcaseChart.resize();
    });
    resizeObserver.observe(chartContainer);
    chartContainer.__resizeObserver = resizeObserver;

    // Save chart instance to container for theme callbacks
    chartContainer.__transformChartInstance = showcaseChart;
  }

  // Initialize showcase widget
  initChartShowcaseWidget();

  // ── FAQ Accordion Toggles (For enhanced landing page) ───
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        
        // Close all first
        faqItems.forEach(i => i.classList.remove('active'));
        
        // Toggle current
        if (!isOpen) {
          item.classList.add('active');
        }
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanding);
} else {
  initLanding();
}
