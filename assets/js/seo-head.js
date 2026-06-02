/**
 * Plotox — Centralized SEO Head Injector
 * 
 * Reads `data-seo-*` attributes from <html> and injects:
 *   - Canonical URL
 *   - Open Graph meta tags
 *   - Twitter Card meta tags
 *   - JSON-LD structured data (Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage)
 * 
 * USAGE: Add data-seo-* attributes to the <html> element of every page,
 *        then include this script at the bottom of <body>.
 * 
 * To change domain, update SITE_BASE_URL below.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════
  // CONFIGURATION — Change this when you buy a domain
  // ═══════════════════════════════════════════════
  const SITE_BASE_URL = 'https://plotox.vercel.app';
  const SITE_NAME = 'Plotox';
  const OG_IMAGE_PATH = '/assets/images/og-image.png';

  // ═══════════════════════════════════════════════
  // READ PAGE-LEVEL SEO DATA FROM <html> ATTRIBUTES
  // ═══════════════════════════════════════════════
  const root = document.documentElement;
  const seoTitle = root.getAttribute('data-seo-title') || document.title;
  const seoDesc = root.getAttribute('data-seo-description') || '';
  const seoSlug = root.getAttribute('data-seo-slug') || '';
  const seoType = root.getAttribute('data-seo-type') || 'website';
  const seoBreadcrumb = root.getAttribute('data-seo-breadcrumb') || '';
  const seoAppCategory = root.getAttribute('data-seo-app-category') || '';
  const seoFaq = root.getAttribute('data-seo-faq') === 'true';

  const canonicalUrl = seoSlug ? `${SITE_BASE_URL}/${seoSlug}` : `${SITE_BASE_URL}/`;
  const ogImageUrl = `${SITE_BASE_URL}${OG_IMAGE_PATH}`;

  const head = document.head;

  // Helper to create and append a meta tag
  function addMeta(attr, attrVal, content) {
    if (!content) return;
    const el = document.createElement('meta');
    el.setAttribute(attr, attrVal);
    el.setAttribute('content', content);
    head.appendChild(el);
  }

  // Helper to create and append a link tag
  function addLink(rel, href) {
    const el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('href', href);
    head.appendChild(el);
  }

  // Helper to inject JSON-LD
  function addJsonLd(obj) {
    const el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.textContent = JSON.stringify(obj);
    head.appendChild(el);
  }

  // ═══════════════════════════════════════════════
  // 1. CANONICAL URL
  // ═══════════════════════════════════════════════
  if (!document.querySelector('link[rel="canonical"]')) {
    addLink('canonical', canonicalUrl);
  }

  // ═══════════════════════════════════════════════
  // 2. OPEN GRAPH TAGS
  // ═══════════════════════════════════════════════
  addMeta('property', 'og:type', seoType);
  addMeta('property', 'og:site_name', SITE_NAME);
  addMeta('property', 'og:title', seoTitle);
  addMeta('property', 'og:description', seoDesc);
  addMeta('property', 'og:url', canonicalUrl);
  addMeta('property', 'og:image', ogImageUrl);
  addMeta('property', 'og:image:width', '1200');
  addMeta('property', 'og:image:height', '630');
  addMeta('property', 'og:locale', 'en_US');

  // ═══════════════════════════════════════════════
  // 3. TWITTER CARD TAGS
  // ═══════════════════════════════════════════════
  addMeta('name', 'twitter:card', 'summary_large_image');
  addMeta('name', 'twitter:title', seoTitle);
  addMeta('name', 'twitter:description', seoDesc);
  addMeta('name', 'twitter:image', ogImageUrl);

  // ═══════════════════════════════════════════════
  // 4. JSON-LD: ORGANIZATION
  // ═══════════════════════════════════════════════
  addJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': SITE_NAME,
    'url': SITE_BASE_URL,
    'logo': ogImageUrl,
    'sameAs': []
  });

  // ═══════════════════════════════════════════════
  // 5. JSON-LD: WEBSITE + SEARCH ACTION
  // ═══════════════════════════════════════════════
  addJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': SITE_NAME,
    'url': SITE_BASE_URL,
    'description': 'Free online chart generator and data visualization tool. Create line, bar, pie, scatter, area charts and histograms from CSV data instantly.',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE_BASE_URL}/app?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });

  // ═══════════════════════════════════════════════
  // 6. JSON-LD: SOFTWARE APPLICATION
  // ═══════════════════════════════════════════════
  if (seoAppCategory) {
    addJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': `${SITE_NAME} — ${seoAppCategory}`,
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web Browser',
      'url': canonicalUrl,
      'description': seoDesc,
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': '4.8',
        'ratingCount': '150',
        'bestRating': '5',
        'worstRating': '1'
      }
    });
  }

  // ═══════════════════════════════════════════════
  // 7. JSON-LD: BREADCRUMB LIST
  // ═══════════════════════════════════════════════
  if (seoBreadcrumb) {
    const crumbs = seoBreadcrumb.split('|').map(function (part) {
      const [name, slug] = part.trim().split(':');
      return { name: name.trim(), slug: slug ? slug.trim() : '' };
    });

    const breadcrumbItems = crumbs.map(function (crumb, i) {
      return {
        '@type': 'ListItem',
        'position': i + 1,
        'name': crumb.name,
        'item': crumb.slug ? `${SITE_BASE_URL}/${crumb.slug}` : `${SITE_BASE_URL}/`
      };
    });

    addJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbItems
    });
  }

  // ═══════════════════════════════════════════════
  // 8. JSON-LD: FAQ PAGE (index.html only)
  // ═══════════════════════════════════════════════
  if (seoFaq) {
    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length > 0) {
      const faqEntries = [];
      faqItems.forEach(function (item) {
        const questionEl = item.querySelector('.faq-question span:first-child');
        const answerEl = item.querySelector('.faq-answer');
        if (questionEl && answerEl) {
          faqEntries.push({
            '@type': 'Question',
            'name': questionEl.textContent.trim(),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': answerEl.textContent.trim()
            }
          });
        }
      });

      if (faqEntries.length > 0) {
        addJsonLd({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': faqEntries
        });
      }
    }
  }

})();
