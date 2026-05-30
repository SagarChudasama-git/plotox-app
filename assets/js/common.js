function initCommon() {
  
  // ── Disable All Copying & Selection ───────────────────────
  // Helper: check if the event target is an editable form field
  function isEditableField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // Block right-click context menu everywhere (temporarily disabled)
  // document.addEventListener('contextmenu', function (e) {
  //   e.preventDefault();
  // });

  // Block copy and cut events
  document.addEventListener('copy', function (e) {
    if (!isEditableField(e.target)) {
      e.preventDefault();
    }
  });

  document.addEventListener('cut', function (e) {
    if (!isEditableField(e.target)) {
      e.preventDefault();
    }
  });

  // Block keyboard shortcuts: Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+U, Ctrl+S
  document.addEventListener('keydown', function (e) {
    if (isEditableField(e.target)) return;

    if (e.ctrlKey && (e.key === 'c' || e.key === 'C' ||
                      e.key === 'x' || e.key === 'X' ||
                      e.key === 'a' || e.key === 'A' ||
                      e.key === 'u' || e.key === 'U' ||
                      e.key === 's' || e.key === 'S')) {
      e.preventDefault();
    }
  });

  // Block drag on images and text
  document.addEventListener('dragstart', function (e) {
    if (!isEditableField(e.target)) {
      e.preventDefault();
    }
  });

  // ── Active Navigation Links ──────────────────────────────
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href.replace('.html', ''))) {
      link.classList.add('active');
    }
  });

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCommon);
} else {
  initCommon();
}
