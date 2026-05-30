(function () {
  // Initialize theme from localStorage or system preference
  function initTheme() {
    const isApp = window.location.pathname.includes('app.html');
    if (!isApp) {
      document.documentElement.classList.remove('dark');
      return;
    }

    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('plotiq-theme') || localStorage.getItem('plotox-theme');
    } catch (e) {
      console.warn("theme.js: localStorage read access blocked.", e);
    }
    
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Toggle theme and update localStorage
  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('plotiq-theme', isDark ? 'dark' : 'light');
      localStorage.setItem('plotox-theme', isDark ? 'dark' : 'light');
    } catch (e) {
      console.warn("theme.js: localStorage write access blocked.", e);
    }
    
    // Dispatch custom event to notify components (e.g. ECharts charts)
    const event = new CustomEvent('themeChanged', { 
      detail: { theme: isDark ? 'dark' : 'light' } 
    });
    window.dispatchEvent(event);
    
    // Update theme toggle buttons' icons if any exist
    updateToggleIcons(isDark);
  };

  function updateToggleIcons(isDark) {
    const icons = document.querySelectorAll('.theme-toggle-btn .material-symbols-outlined');
    icons.forEach(icon => {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    });
  }

  // Run on load
  initTheme();

  function initThemeDOM() {
    const isDark = document.documentElement.classList.contains('dark');
    updateToggleIcons(isDark);

    // Bind Topbar Theme Toggle Button
    const topToggle = document.getElementById('theme-toggle');
    if (topToggle) {
      topToggle.addEventListener('click', function() {
        window.toggleTheme();
      });
    }

    // Bind Sidebar Theme Pills
    const lightPill = document.getElementById('theme-light-pill');
    const darkPill = document.getElementById('theme-dark-pill');

    if (lightPill && darkPill) {
      lightPill.addEventListener('click', function() {
        if (document.documentElement.classList.contains('dark')) {
          window.toggleTheme();
        }
      });

      darkPill.addEventListener('click', function() {
        if (!document.documentElement.classList.contains('dark')) {
          window.toggleTheme();
        }
      });

      // Synchronize active states on themeChanged event
      window.addEventListener('themeChanged', function(e) {
        const darkActive = e.detail.theme === 'dark';
        if (darkActive) {
          darkPill.classList.add('active');
          lightPill.classList.remove('active');
        } else {
          lightPill.classList.add('active');
          darkPill.classList.remove('active');
        }
      });

      // Initial active pill state
      if (isDark) {
        darkPill.classList.add('active');
        lightPill.classList.remove('active');
      } else {
        lightPill.classList.add('active');
        darkPill.classList.remove('active');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeDOM);
  } else {
    initThemeDOM();
  }
})();
