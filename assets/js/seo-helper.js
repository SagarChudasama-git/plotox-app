function initSeoHelper() {
  
  // Detect active chart page type
  const container = document.getElementById('seo-chart');
  if (!container) return;

  const chartType = container.getAttribute('data-chart-type');
  const sampleName = container.getAttribute('data-sample');

  const isMobile = window.innerWidth < 480;

  const config = {
    chartType: chartType,
    xAxis: '',
    yAxes: [],
    title: container.getAttribute('data-title') || 'Interactive Demo',
    showGrid: true,
    showLegend: true,
    lineSmooth: false,
    barmode: 'group',
    height: isMobile ? 280 : 320
  };

  let activeDataset = null;

  // Bind controls
  const gridCheck = document.getElementById('demo-grid');
  const legendCheck = document.getElementById('demo-legend');
  const smoothCheck = document.getElementById('demo-smooth');
  const pngBtn = document.getElementById('demo-png');

  if (gridCheck) {
    gridCheck.addEventListener('change', (e) => {
      config.showGrid = e.target.checked;
      renderChart();
    });
  }

  if (legendCheck) {
    legendCheck.addEventListener('change', (e) => {
      config.showLegend = e.target.checked;
      renderChart();
    });
  }

  if (smoothCheck) {
    smoothCheck.addEventListener('change', (e) => {
      config.lineSmooth = e.target.checked;
      renderChart();
    });
  }

  if (pngBtn) {
    pngBtn.addEventListener('click', () => {
      ExportManager.exportPNG('seo-chart', `plotox_${chartType}_export`);
    });
  }

  // Load appropriate data
  fetch('assets/data/mobile_app_downloads.csv')
    .then(response => {
      if (!response.ok) throw new Error('Data fetch failed');
      return response.text();
    })
    .then(text => {
      activeDataset = DataParser.parse(text);
      setupDefaultMapping();
      renderChart();
    })
    .catch(err => {
      console.warn('SEO Chart fetch error, falling back to local static dataset:', err);
      loadSeoLocalSampleData('mobile_app_downloads');
    });

  function loadSeoLocalSampleData(name) {
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

    try {
      activeDataset = DataParser.parse(csvContent);
      setupDefaultMapping();
      renderChart();
    } catch (parserErr) {
      console.error('Error parsing local fallback data:', parserErr);
    }
  }

  function setupDefaultMapping() {
    if (!activeDataset) return;

    if (chartType === 'line' || chartType === 'area') {
      config.xAxis = 'Month';
      config.yAxes = ['Android', 'iOS'];
      config.xAxisLabel = 'Month';
      config.yAxisLabel = 'Downloads';
      config.title = 'Monthly Mobile App Downloads';
    } else if (chartType === 'bar') {
      config.xAxis = 'Month';
      config.yAxes = ['Android', 'iOS'];
      config.xAxisLabel = 'Month';
      config.yAxisLabel = 'Downloads';
      config.title = 'Monthly Mobile App Downloads';
    } else if (chartType === 'pie' || chartType === 'donut') {
      config.xAxis = 'Month';
      config.yAxes = ['Android'];
      config.title = 'Android Downloads Distribution';
    } else if (chartType === 'scatter') {
      config.xAxis = 'Android';
      config.yAxes = ['iOS'];
      config.xAxisLabel = 'Android Downloads';
      config.yAxisLabel = 'iOS Downloads';
      config.title = 'Android vs iOS App Downloads Correlation';
    } else if (chartType === 'histogram') {
      config.xAxis = 'Android';
      config.yAxes = ['Android'];
      config.xAxisLabel = 'Android Downloads';
      config.title = 'Distribution of Android Downloads';
    } else if (chartType === 'heatmap') {
      // Heatmap handles auto numeric cols inside engine
      config.xAxis = activeDataset.headers[0];
      config.yAxes = [];
    }
  }

  function renderChart() {
    if (!activeDataset) return;
    const isDark = document.documentElement.classList.contains('dark');
    ChartEngine.render('seo-chart', activeDataset, config, isDark);
  }

  // Handle theme changes
  window.addEventListener('themeChanged', () => {
    renderChart();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSeoHelper);
} else {
  initSeoHelper();
}
