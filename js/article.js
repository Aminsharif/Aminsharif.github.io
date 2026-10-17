/* ==========================================================================
   Article page — loads a single article from the backend by ?slug=… and
   renders the khalidfarhan-style detail layout:
     • dark article hero (category, title, author/date/read meta)
     • prose body with a sticky sidebar (free-audit CTA + related articles)
     • "More articles" band and closing CTA
   Also updates the document metadata and the breadcrumb.
   ========================================================================== */
'use strict';

(function () {
  var CONFIG = window.SITE_CONFIG || {};
  var root = document.getElementById('article-root');
  if (!root) return;

  var slug = new URLSearchParams(window.location.search).get('slug') || '';

  function apiPath(path) {
    var base = (CONFIG.apiBase || '').replace(/\/+$/, '');
    return base + path;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setMeta(key, value, attr) {
    if (!value) return;
    var selector = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function setCanonical(url) {
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', url);
  }

  function setJsonLd(id, data) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function absoluteUrl(value) {
    try {
      return new URL(value, window.location.origin).href;
    } catch (err) {
      return window.location.href;
    }
  }

  function buildJsonLd(article, canonical, description) {
    var site = 'https://aminsharif.com';
    var category = article.category ? article.category.name : 'Insights';
    var published = (article.publishedAt || '').slice(0, 10);
    var modified = (article.updatedAt || article.publishedAt || '').slice(0, 10);
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': site + '/#founder',
          name: 'Amin Sharif',
          url: site + '/about.html',
          jobTitle: 'AI Automation Developer'
        },
        {
          '@type': 'Organization',
          '@id': site + '/#organization',
          name: 'Amin Sharif',
          url: site + '/',
          sameAs: ['https://github.com/Aminsharif']
        },
        {
          '@type': 'BlogPosting',
          '@id': canonical + '#article',
          headline: article.title,
          description: description,
          datePublished: published,
          dateModified: modified,
          author: { '@id': site + '/#founder' },
          publisher: { '@id': site + '/#organization' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          inLanguage: 'en',
          articleSection: category
        },
        {
          '@type': 'BreadcrumbList',
          '@id': canonical + '#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: site + '/' },
            { '@type': 'ListItem', position: 2, name: 'Insights', item: site + '/insights.html' },
            { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
          ]
        }
      ]
    };
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function metaBits(article) {
    var bits = [];
    var date = formatDate(article.publishedAt);
    if (date) bits.push(esc(date));
    if (article.readTime) bits.push(esc(article.readTime) + ' min read');
    return bits.join('<span class="kf-meta__dot">&middot;</span>');
  }

  function cardHtml(a) {
    var catName = a.category ? a.category.name : 'Insights';
    var bits = metaBits(a);
    return '<a class="kf-card" href="' + esc(a.url || '#') + '"><article>' +
      '<span class="kf-eyebrow kf-card__cat">' + esc(catName) + '</span>' +
      '<h3 class="kf-card__title">' + esc(a.title) + '</h3>' +
      (a.excerpt ? '<p class="kf-card__excerpt">' + esc(a.excerpt) + '</p>' : '') +
      (bits ? '<div class="kf-meta">' + bits + '</div>' : '') +
      '</article></a>';
  }

  function relatedHtml(list) {
    if (!list.length) return '';
    var html = '<p class="kf-eyebrow">Related</p><div class="kf-related">';
    list.forEach(function (a) {
      var catName = a.category ? a.category.name : 'Insights';
      html += '<a href="' + esc(a.url || '#') + '">' +
        '<span class="kf-related__cat">' + esc(catName) + '</span>' +
        '<span class="kf-related__title">' + esc(a.title) + '</span></a>';
    });
    return html + '</div>';
  }

  function loadExtras(article) {
    var relatedEl = document.getElementById('article-related');
    var moreEl = document.getElementById('article-more');
    var moreSection = document.getElementById('article-more-section');
    var current = article.slug;

    function pick(list) {
      return (list || []).filter(function (a) { return a.slug !== current; });
    }

    var latestReq = fetch(apiPath('/api/articles?limit=6'), { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); });

    var catReq = article.category
      ? fetch(apiPath('/api/articles?limit=6&category=' + encodeURIComponent(article.category.slug)), { headers: { Accept: 'application/json' } })
          .then(function (res) { return res.json(); })
      : Promise.resolve(null);

    Promise.all([latestReq, catReq])
      .then(function (results) {
        var latest = pick(results[0] && results[0].articles).slice(0, 3);

        if (latest.length && moreEl && moreSection) {
          moreEl.innerHTML = latest.map(cardHtml).join('');
          moreSection.hidden = false;
        }

        var sameCat = results[1] ? pick(results[1].articles) : [];
        var related = sameCat.length ? sameCat.slice(0, 3) : latest;
        if (relatedEl) relatedEl.innerHTML = relatedHtml(related);
      })
      .catch(function () { /* related + more articles are optional */ });
  }

  function render(article) {
    var title = article.metaTitle || article.title;
    if (title.toLowerCase().indexOf('amin sharif') === -1) title += ' | Amin Sharif';
    var description = article.metaDescription || article.excerpt || '';
    var canonical = absoluteUrl(
      article.url || ('/article.html?slug=' + encodeURIComponent(article.slug))
    );

    document.title = title;
    // The shell is shipped noindex; a successfully rendered article is a real
    // page, so it becomes indexable here (see also fail(), which reverts it).
    setMeta('robots', 'index, follow, max-image-preview:large', 'name');
    setMeta('description', description, 'name');
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', 'article', 'property');
    setMeta('og:url', canonical, 'property');
    setMeta('og:image', article.coverImage ? absoluteUrl(article.coverImage) : '', 'property');
    setMeta('article:published_time', article.publishedAt || '', 'property');
    setCanonical(canonical);
    setJsonLd('article-jsonld', buildJsonLd(article, canonical, description));

    var cat = article.category ? article.category.name : 'Insights';
    var catSlug = article.category ? article.category.slug : '';
    var crumb = document.getElementById('article-crumb');
    if (crumb) crumb.textContent = article.title;

    var catLink = catSlug
      ? '<a class="kf-cat-link" href="insights.html?category=' + encodeURIComponent(catSlug) + '"><p class="kf-eyebrow kf-eyebrow-light">' + esc(cat) + '</p></a>'
      : '<p class="kf-eyebrow kf-eyebrow-light">' + esc(cat) + '</p>';

    var tag = catSlug
      ? '<div class="kf-tags"><a class="kf-tag" href="insights.html?category=' + encodeURIComponent(catSlug) + '">' + esc(cat) + '</a></div>'
      : '';

    var metaHtml = '<span class="kf-avatar">AS</span><a href="about.html">Amin Sharif</a>' +
      (formatDate(article.publishedAt) ? '<span class="kf-meta__dot">&middot;</span><span>' + esc(formatDate(article.publishedAt)) + '</span>' : '') +
      '<span class="kf-meta__dot">&middot;</span><span>' + esc(article.readTime || 5) + ' min read</span>';

    root.innerHTML =
      '<header class="kf-article-hero">' +
        '<div class="kf-container"><div class="kf-article-hero__inner">' +
          catLink +
          '<h1 class="kf-article-title">' + esc(article.title) + '</h1>' +
          '<div class="kf-article-meta">' + metaHtml + '</div>' +
        '</div></div>' +
      '</header>' +
      '<section class="kf-sec-lg kf-line-b">' +
        '<div class="kf-container"><div class="kf-article-layout">' +
          '<div class="kf-prose">' +
            (article.excerpt ? '<p class="kf-lead">' + esc(article.excerpt) + '</p>' : '') +
            '<div class="kf-article-body">' + (article.content || '<p>This article has no content yet.</p>') + '</div>' +
            tag +
            '<div class="kf-author-box"><span class="kf-author-box__avatar">AS</span><div>' +
              '<p class="kf-author-box__name">Written by Amin Sharif</p>' +
              '<p class="kf-author-box__text">Founder-led AI automation agency. I design and ship n8n workflows, CRM integrations and AI agents that remove repetitive work. <a href="about.html">More about me &rarr;</a></p>' +
            '</div></div>' +
          '</div>' +
          '<aside class="kf-aside">' +
            '<div class="kf-audit">' +
              '<span class="kf-audit__label">Free automation audit</span>' +
              '<p class="kf-audit__title">Not sure where to start?</p>' +
              '<p class="kf-audit__text">Tell me the process that is slowing you down and I will map the fastest automation win.</p>' +
              '<a class="kf-btn kf-btn-white kf-btn-sm" href="contact.html" data-booking>Book a call</a>' +
            '</div>' +
            '<div id="article-related"></div>' +
          '</aside>' +
        '</div></div>' +
      '</section>' +
      '<section class="kf-sec-lg kf-bg-soft kf-line-b" id="article-more-section" hidden>' +
        '<div class="kf-container"><p class="kf-eyebrow">More articles</p>' +
          '<div class="kf-card-grid" id="article-more"></div>' +
        '</div>' +
      '</section>' +
      '<section class="kf-cta">' +
        '<div class="kf-container"><div class="kf-cta__inner">' +
          "<h2 class=\"kf-display-l\">Let's find your next automation opportunity.</h2>" +
          "<p class=\"kf-body-lead\">Reading is useful; building is better. If a process in your business is slowing things down, let's look at it together.</p>" +
          '<div class="kf-btn-group">' +
            '<a class="kf-btn kf-btn-white kf-btn-lg" href="contact.html" data-booking>Book a Discovery Call</a>' +
            '<a class="kf-btn kf-btn-lg" href="insights.html">Back to insights</a>' +
          '</div>' +
        '</div></div>' +
      '</section>';

    loadExtras(article);
  }

  function fail(message) {
    setMeta('robots', 'noindex, follow', 'name');
    root.innerHTML =
      '<header class="kf-article-hero">' +
        '<div class="kf-container"><div class="kf-article-hero__inner">' +
          '<p class="kf-eyebrow kf-eyebrow-light">Insights</p>' +
          '<h1 class="kf-article-title">Article unavailable</h1>' +
          '<p class="kf-body-lead" style="color:var(--kf-ink-300);margin-top:16px;">' + esc(message) + '</p>' +
        '</div></div>' +
      '</header>' +
      '<section class="kf-sec-lg">' +
        '<div class="kf-container"><a class="kf-btn" href="insights.html">Back to insights</a></div>' +
      '</section>';
  }

  if (!slug) {
    fail('No article was specified.');
    return;
  }

  fetch(apiPath('/api/articles/' + encodeURIComponent(slug)), { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (res.status === 404) throw new Error('notfound');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var article = data.article;
      if (!article) throw new Error('notfound');
      if (article.externalUrl) {
        window.location.replace(article.externalUrl);
        return;
      }
      render(article);
    })
    .catch(function (err) {
      if (err && err.message === 'notfound') {
        fail('This article does not exist, or it is no longer published.');
      } else {
        fail('The article could not be loaded right now. Please try again shortly.');
      }
    });
})();
