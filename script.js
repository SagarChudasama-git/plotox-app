(function () {
  const scripts = [
    'assets/js/theme.js',
    'assets/js/common.js',
    'assets/js/landing.js'
  ];

  scripts.forEach(function (src) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // Maintain execution order
    document.body.appendChild(script);
  });
})();
