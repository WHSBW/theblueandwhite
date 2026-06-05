// assets/js/feed.js — The Blue & White
// Pulls PUBLISHED articles from Supabase and renders them as story cards.
// Used by the homepage and by each section landing page.
// Requires the supabase-js script loaded on the page before this file.

(function () {
  'use strict';

  var SUPABASE_URL = 'https://cybjclqcdmrjhoaoiund.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_G-U4_7cECYwC3c1Sa2MqWQ_9NHN-7_g';

  var LABEL_CLASS = {
    'News': 'label-news', 'Sports': 'label-sports', 'Culture': 'label-culture',
    'Hot Spot': 'label-hotspot', 'We Are Wharton': 'label-wharton', 'Editorial': 'label-editorial'
  };

  function escapeHTML(value) {
    return (value == null ? '' : String(value)).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function articleURL(article) {
    var p = (article.github_path || '').replace(/^\/+/, '');
    return p ? '/' + p : '#';
  }
  function thumbStyle(photoUrl) {
    if (!photoUrl) return '';
    return 'style="background-image:url(\'' + photoUrl.replace(/'/g, '%27') + '\');background-size:cover;background-position:center;"';
  }

  function cardHTML(article) {
    var labelClass = LABEL_CLASS[article.section] || 'label-news';
    var byline = [article.author_name, formatDate(article.published_at)]
      .filter(Boolean).map(escapeHTML).join(' &nbsp;&middot;&nbsp; ');

    return '' +
      '<div class="more-card">' +
        '<div class="more-thumb" ' + thumbStyle(article.photo_url) + '></div>' +
        '<span class="more-label ' + labelClass + '">' + escapeHTML(article.section || '') + '</span>' +
        '<a href="' + articleURL(article) + '"><div class="more-hed">' +
          escapeHTML(article.headline || 'Untitled') + '</div></a>' +
        (article.dek ? '<div class="feed-dek">' + escapeHTML(article.dek) + '</div>' : '') +
        '<div class="more-byline">' + (byline || '&nbsp;') + '</div>' +
      '</div>';
  }

  async function render(opts) {
    opts = opts || {};
    var el = typeof opts.target === 'string'
      ? document.querySelector(opts.target)
      : opts.target;
    if (!el) return;

    el.innerHTML = '<div class="feed-status">Loading stories&hellip;</div>';

    if (!window.supabase || !window.supabase.createClient) {
      el.innerHTML = '<div class="feed-status">Could not start the story feed.</div>';
      return;
    }

    try {
      var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var query = sb.from('articles')
        .select('headline,dek,section,author_name,published_at,github_path,photo_url')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(opts.limit || 60);

      if (opts.section) query = query.eq('section', opts.section);

      var result = await query;
      if (result.error) {
        console.error('[feed]', result.error);
        el.innerHTML = '<div class="feed-status">Could not load stories right now.</div>';
        return;
      }

      var rows = (result.data || []).filter(function (a) { return a.github_path; });
      if (rows.length === 0) {
        el.innerHTML = '<div class="feed-status">No stories published here yet. Check back soon.</div>';
        return;
      }

      el.innerHTML = rows.map(cardHTML).join('');
    } catch (err) {
      console.error('[feed]', err);
      el.innerHTML = '<div class="feed-status">Could not load stories right now.</div>';
    }
  }

  var css = '' +
    '.section-page{padding:28px 24px 44px;}' +
    '.section-page-header{border-bottom:2px solid var(--navy);padding-bottom:14px;margin-bottom:26px;}' +
    '.section-page-title{font-family:"Playfair Display",serif;font-size:34px;font-weight:700;color:var(--navy);line-height:1.1;margin:4px 0 6px;}' +
    '.section-page-sub{font-size:14px;color:var(--text-muted);max-width:640px;}' +
    '.bw-feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:24px 26px;}' +
    '.feed-dek{font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-size:13px;color:var(--text-mid);line-height:1.4;margin:2px 0 6px;}' +
    '.feed-status{grid-column:1/-1;color:var(--text-muted);font-size:14px;padding:24px 0;}';
  var styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  window.BWFeed = { render: render };
})();
