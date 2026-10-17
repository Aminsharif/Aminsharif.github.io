/* ==========================================================================
   Insights listing — loads articles + categories from the backend API and
   renders the khalidfarhan-style design:
     • category pills + search in the toolbar band
     • a "Featured" band (big card + two stacked cards) for the latest posts
     • "All articles" list with a Topics / About-the-author sidebar
   Functionality kept from before: category filters, keyword search and
   "Load more" pagination. If the API is unreachable the <noscript> list in
   insights.html still links to the hand-built articles.
   ========================================================================== */
'use strict';

(function () {
  var CONFIG = window.SITE_CONFIG || {};
  var grid = document.getElementById('insights-grid');
  if (!grid) return;

  var PAGE_SIZE = 12;
  var FEATURED_COUNT = 3;

  var filterBar = document.getElementById('insights-filters');
  var statusEl = document.getElementById('insights-status');
  var moreWrap = document.getElementById('insights-more');
  var moreBtn = document.getElementById('insights-more-btn');
  var searchForm = document.getElementById('insights-search');
  var searchInput = document.getElementById('insights-search-input');
  var topicsEl = document.getElementById('insights-topics');
  var featuredSection = document.getElementById('insights-featured-section');
  var featuredGrid = document.getElementById('insights-featured');

  var params = new URLSearchParams(window.location.search);
  var category = params.get('category') || '';
  var search = params.get('q') || '';

  /* A filtered or searched listing is a near-duplicate of insights.html.
     Keep it crawlable (follow) but out of the index; the page's canonical
     already points at the unfiltered listing. */
  if (params.toString()) {
    var robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, follow');
  }

  var offset = 0;   /* next API offset */
  var skip = 0;     /* articles already shown in the Featured band */
  var shown = 0;    /* articles rendered in the list */
  var total = 0;    /* total published articles matching the current filters */
  var loading = false;
  var reqSeq = 0;   /* guards against out-of-order responses */

  if (searchInput) searchInput.value = search;

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

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function isFiltered() { return !!(category || search); }

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.innerHTML = html || '';
    statusEl.hidden = !html;
  }

  function metaHtml(article) {
    var parts = [];
    var date = formatDate(article.publishedAt);
    if (date) parts.push(esc(date));
    if (article.readTime) parts.push(esc(article.readTime) + ' min read');
    if (!parts.length) return '';
    return '<div class="kf-meta">' + parts.join('<span class="kf-meta__dot">&middot;</span>') + '</div>';
  }

  function makeCard(article, big) {
    var catName = article.category ? article.category.name : 'Insights';
    var a = document.createElement('a');
    a.className = 'kf-card' + (big ? ' kf-card--lg' : '');
    a.href = article.url || '#';
    a.innerHTML =
      '<article>' +
        '<span class="kf-eyebrow kf-card__cat">' + esc(catName) + '</span>' +
        '<h3 class="kf-card__title">' + esc(article.title) + '</h3>' +
        '<p class="kf-card__excerpt">' + esc(article.excerpt || '') + '</p>' +
        metaHtml(article) +
      '</article>';
    return a;
  }

  function hideFeatured() {
    if (featuredSection) featuredSection.hidden = true;
    if (featuredGrid) featuredGrid.innerHTML = '';
  }

  function renderFeatured(articles) {
    if (!featuredSection || !featuredGrid) return;
    var col1 = document.createElement('div');
    var col2 = document.createElement('div');
    col1.appendChild(makeCard(articles[0], true));
    for (var i = 1; i < articles.length; i++) col2.appendChild(makeCard(articles[i], false));
    featuredGrid.innerHTML = '';
    featuredGrid.appendChild(col1);
    if (col2.childNodes.length) featuredGrid.appendChild(col2);
    featuredSection.hidden = false;
  }

  function showEmpty() {
    var empty = document.createElement('div');
    empty.className = 'kf-empty';
    var msg = search
      ? 'No insights match &ldquo;' + esc(search) + '&rdquo;' + (category ? ' in this category' : '') + '.'
      : 'No insights in this category yet.';
    empty.innerHTML = '<p>' + msg + ' <a href="insights.html">See all insights</a>.</p>';
    grid.appendChild(empty);
  }

  function summary() {
    var listTotal = Math.max(total - skip, 0);
    if (!listTotal) return '';
    var text = 'Showing ' + shown + ' of ' + listTotal + ' insights';
    if (search) text += ' for &ldquo;' + esc(search) + '&rdquo;';
    return text;
  }

  function updateMore() {
    if (!moreWrap || !moreBtn) return;
    moreWrap.hidden = offset >= total || !total;
    moreBtn.disabled = false;
  }

  function syncUrl() {
    var qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (search) qs.set('q', search);
    var query = qs.toString();
    window.history.replaceState({}, '', 'insights.html' + (query ? '?' + query : ''));
  }

  function loadArticles(reset) {
    if (loading) return;
    loading = true;

    if (reset) {
      offset = skip;
      shown = 0;
      grid.innerHTML = '';
      setStatus('Loading insights&hellip;');
    }
    if (moreBtn) moreBtn.disabled = true;

    var seq = ++reqSeq;
    var qs = new URLSearchParams();
    qs.set('limit', PAGE_SIZE);
    qs.set('offset', offset);
    if (category) qs.set('category', category);
    if (search) qs.set('search', search);

    fetch(apiPath('/api/articles?' + qs.toString()), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (seq !== reqSeq) return; /* a newer request superseded this one */
        loading = false;

        var articles = data.articles || [];
        total = data.total || 0;

        if (!articles.length && !shown) {
          showEmpty();
        } else {
          articles.forEach(function (article) { grid.appendChild(makeCard(article, false)); });
          shown += articles.length;
        }

        offset += articles.length;
        updateMore();
        setStatus(summary());
      })
      .catch(function () {
        if (seq !== reqSeq) return;
        loading = false;
        if (moreBtn) moreBtn.disabled = false;
        grid.innerHTML = '';
        setStatus(
          window.location.protocol === 'file:'
            ? 'Insights need to be served by the site backend to load. ' +
              'See the README for how to run the server, then reload this page.'
            : 'Insights are temporarily unavailable. Please check back shortly, or <a href="contact.html">get in touch</a> directly.'
        );
      });
  }

  /* Rebuild the featured band (latest posts) when browsing unfiltered, then
     load / reload the article list. */
  function refresh() {
    if (isFiltered()) {
      hideFeatured();
      skip = 0;
      loadArticles(true);
      return;
    }
    setStatus('Loading insights&hellip;');
    fetch(apiPath('/api/articles?limit=' + FEATURED_COUNT + '&offset=0'), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var articles = data.articles || [];
        if ((data.total || 0) > FEATURED_COUNT && articles.length) {
          renderFeatured(articles);
          skip = FEATURED_COUNT;
        } else {
          hideFeatured();
          skip = 0;
        }
        loadArticles(true);
      })
      .catch(function () {
        hideFeatured();
        skip = 0;
        loadArticles(true);
      });
  }

  function markActive() {
    if (filterBar) {
      filterBar.querySelectorAll('.kf-pill').forEach(function (btn) {
        btn.classList.toggle('is-active', (btn.getAttribute('data-category') || '') === category);
      });
    }
    if (topicsEl) {
      topicsEl.querySelectorAll('a').forEach(function (link) {
        link.classList.toggle('is-active', (link.getAttribute('data-category') || '') === category);
      });
    }
  }

  function addFilter(label, slug) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kf-pill';
    btn.setAttribute('data-category', slug || '');
    btn.textContent = label;
    btn.addEventListener('click', function () {
      category = slug || '';
      /* Switching category starts a fresh browse: drop any active search. */
      search = '';
      if (searchInput) searchInput.value = '';
      syncUrl();
      markActive();
      refresh();
    });
    filterBar.appendChild(btn);
  }

  function renderTopics(cats, allCount) {
    if (!topicsEl) return;
    topicsEl.innerHTML = '';
    var all = document.createElement('a');
    all.href = 'insights.html';
    all.setAttribute('data-category', '');
    all.innerHTML = '<span>All insights</span><span class="kf-topics__count">' + allCount + '</span>';
    topicsEl.appendChild(all);
    cats.forEach(function (c) {
      var a = document.createElement('a');
      a.href = 'insights.html?category=' + encodeURIComponent(c.slug);
      a.setAttribute('data-category', c.slug || '');
      a.innerHTML = '<span>' + esc(c.name) + '</span><span class="kf-topics__count">' + (c.article_count || 0) + '</span>';
      topicsEl.appendChild(a);
    });
    markActive();
  }

  function loadCategories() {
    fetch(apiPath('/api/categories'), { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var cats = data.categories || [];
        var allCount = cats.reduce(function (sum, c) { return sum + (c.article_count || 0); }, 0);
        renderTopics(cats, allCount);
        if (filterBar && cats.length) {
          filterBar.hidden = false;
          addFilter('All', '');
          cats.forEach(function (c) { addFilter(c.name, c.slug); });
          markActive();
        }
      })
      .catch(function () { /* filters + topics are optional */ });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      search = (searchInput ? searchInput.value : '').trim();
      syncUrl();
      refresh();
    });
  }

  /* Clearing the box (the native "x" on type=search) restores the full list. */
  if (searchInput) {
    searchInput.addEventListener('search', function () {
      if (searchInput.value.trim() === '' && search !== '') {
        search = '';
        syncUrl();
        refresh();
      }
    });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', function () { loadArticles(false); });
  }

  loadCategories();
  refresh();
})();
