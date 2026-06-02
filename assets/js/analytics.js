/**
 * Plotox — Centralized Analytics & Event Tracking System
 * 
 * Configures:
 *   - Google Analytics 4 (GA4) with client-side event tracking
 *   - Microsoft Clarity for user recording and heatmaps
 * 
 * Exposes a robust, error-tolerant tracking API (`window.PlotoxAnalytics`)
 * that is safe to use even if scripts are blocked by ad-blockers.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════
  // CONFIGURATION — Centralized Analytics Keys
  // ═══════════════════════════════════════════════
  const CONFIG = {
    GA4_ID: 'G-PCZMCKSTFG',      // Replace with your Google Analytics Measurement ID
    ENABLE_IN_DEV: false,        // If false, tracking is disabled on localhost
  };

  // Helper to check if we are in a development environment
  function isDev() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  }

  // Determine if analytics should run
  const shouldTrack = !isDev() || CONFIG.ENABLE_IN_DEV;

  // Initialize tracking queues safely
  window.dataLayer = window.dataLayer || [];
  
  // Safe helper to send events to dataLayer / gtag
  function safeGtag() {
    window.dataLayer.push(arguments);
  }

  // ═══════════════════════════════════════════════
  // 3. EXPOSE PUBLIC EVENT TRACKING API
  // ═══════════════════════════════════════════════
  const PlotoxAnalytics = {
    /**
     * Send a custom event to GA4
     * @param {string} eventName - Standard or custom event name (e.g. 'chart_generated')
     * @param {Object} eventParams - Optional parameters for the event
     */
    trackEvent: function (eventName, eventParams = {}) {
      if (!shouldTrack) {
        console.log(`[Plotox Analytics Debug] Event: "${eventName}"`, eventParams);
        return;
      }
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', eventName, eventParams);
        } else {
          safeGtag('event', eventName, eventParams);
        }
      } catch (err) {
        console.error('[Plotox Analytics] Error sending GA4 event:', err);
      }

      try {
        if (typeof window.clarity === 'function') {
          window.clarity('event', eventName, eventParams);
        }
      } catch (err) {
        console.error('[Plotox Analytics] Error sending Clarity event:', err);
      }
    },

    /**
     * Track specific user action category
     */
    trackAction: function (category, action, label = null, value = null) {
      const params = {
        event_category: category,
        event_label: label,
        value: value
      };
      // Clean undefined params
      if (label === null) delete params.event_label;
      if (value === null) delete params.value;

      this.trackEvent(action, params);
    }
  };

  // Attach to window object
  window.PlotoxAnalytics = PlotoxAnalytics;

  // ═══════════════════════════════════════════════
  // 4. AUTOMATIC INTERACTIONS LISTENERS
  // ═══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    // 4.1 Track Outbound Links
    document.body.addEventListener('click', function (e) {
      const link = e.target.closest('a');
      if (!link || !link.href) return;

      const url = new URL(link.href, window.location.href);
      const isInternal = url.hostname === window.location.hostname;

      if (!isInternal) {
        PlotoxAnalytics.trackEvent('outbound_click', {
          link_url: link.href,
          link_text: link.textContent ? link.textContent.trim().substring(0, 50) : ''
        });
      }
    });

    // 4.2 Track CTA and Lead Actions (Launch App, Get Started, Try for free)
    const ctaSelectors = [
      '.nav-cta',
      '.hero-actions .btn-primary',
      '.signoff-actions .btn-primary',
      '.hero-content .btn-primary',
      '.btn-primary[href="app.html"]',
      '.nav-logo'
    ];

    ctaSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('click', function () {
          const actionText = el.textContent ? el.textContent.trim() : 'CTA Clicks';
          PlotoxAnalytics.trackAction('lead_generation', 'cta_click', actionText);
        });
      });
    });

    // 4.3 Track interactive SEO Demo actions on individual chart pages
    const demoGrid = document.getElementById('demo-grid');
    const demoLegend = document.getElementById('demo-legend');
    const demoSmooth = document.getElementById('demo-smooth');
    const demoPng = document.getElementById('demo-png');

    if (demoGrid) {
      demoGrid.addEventListener('change', function (e) {
        PlotoxAnalytics.trackAction('demo_interaction', 'toggle_grid', e.target.checked ? 'on' : 'off');
      });
    }

    if (demoLegend) {
      demoLegend.addEventListener('change', function (e) {
        PlotoxAnalytics.trackAction('demo_interaction', 'toggle_legend', e.target.checked ? 'on' : 'off');
      });
    }

    if (demoSmooth) {
      demoSmooth.addEventListener('change', function (e) {
        PlotoxAnalytics.trackAction('demo_interaction', 'toggle_smooth', e.target.checked ? 'on' : 'off');
      });
    }

    if (demoPng) {
      demoPng.addEventListener('click', function () {
        PlotoxAnalytics.trackAction('demo_interaction', 'download_demo_chart');
      });
    }
  });

})();
