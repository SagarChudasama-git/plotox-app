/**
 * ═══════════════════════════════════════════
 * PLOTOX LOADING EXPERIENCE COORDINATOR
 * ═══════════════════════════════════════════
 */
(function () {
  // Add class immediately to prevent any initial unstyled content flash
  document.documentElement.classList.add('loading-active');
  document.body.classList.add('loading-active');

  // We set a baseline time to ensure the brand animations play in their entirety.
  // 3600ms matches: 200ms heading fade + 500ms subheading fade + 1000ms staggered brand reveal + 1100ms letters rise + 800ms brand hold.
  var MINIMUM_DISPLAY_TIME = 3000; 
  var startTime = Date.now();

  function initLoaderReveal() {
    var loader = document.getElementById('plotox-loader');
    if (!loader) return;

    // Phase 1: Fade out loader container (GPU-accelerated opacity & translate)
    loader.classList.add('fade-out');

    // Phase 2: Fade in and translate upward the core app workspace
    document.body.classList.add('app-ready');

    // Phase 3: Allow document scrolling once overlay begins fading out
    setTimeout(function () {
      document.documentElement.classList.remove('loading-active');
      document.body.classList.remove('loading-active');
    }, 250);

    // Phase 4: Clean up memory and remove the loader DOM once completely hidden (700ms animation duration)
    setTimeout(function () {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
      
      // Dispatch custom event to notify other scripts (e.g. app.js) that loader is complete
      window.dispatchEvent(new CustomEvent('plotoxLoaderComplete'));
    }, 750);
  }

  // Bind loader reveal to page initialization
  window.addEventListener('load', function () {
    var elapsedTime = Date.now() - startTime;
    var remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsedTime);

    // If the assets loaded incredibly fast (e.g. cached/localhost), hold for the perfect animation lifecycle.
    // If the network was slow, display the loading screen until all charts/modules are parsed, then reveal immediately.
    setTimeout(initLoaderReveal, remainingTime);
  });
})();
