/* Token Radar's page: renders window.RADAR (written by main.ts) with no network.
   Sorting, filtering, the detail view and the model document are all computed here,
   from the same rows board.json carries, so the page and the board always agree. */
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.getElementById('rows').innerHTML = '<tr><td colspan="7">No data loaded.</td></tr>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (n) {
    if (n == null) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var moneyFull = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var pct = function (n) {
    if (n == null) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  };
  var ageText = function (d) {
    if (d == null) return '—';
    if (d < 365) return d + 'd';
    return (d / 365).toFixed(1) + 'y';
  };

  /* ---- Header facts, stats and the worked example (the top row's own arithmetic). ---- */
  $('asOf').textContent = R.as_of;
  $('modelVersion').textContent = R.model_version;
  var stats = [
    [R.watchlist_size, 'on the watchlist — every one ranked'],
    [R.board_size, 'rows on the board'],
    [R.early_size, 'early finds below the $50M floor'],
    [R.live_size, 'live tokens shown at market value'],
  ];
  $('stats').innerHTML = stats.map(function (s) {
    return '<div class="stat"><b>' + s[0] + '</b><span>' + esc(s[1]) + '</span></div>';
  }).join('');

  var top = R.rows[0];
  function equationRows(r) {
    return [
      ['TVL', moneyFull(r.tvl_usd)],
      ['Band multiple (×' + r.band_multiple.toFixed(2) + ')', moneyFull(r.base_value_usd)],
      ['7-day change ' + pct(r.growth_pct), '×' + r.growth_multiplier.toFixed(2)],
      ['Maturity (' + (r.age_days == null ? 'age unknown' : r.age_days + ' days') + ')', '×' + r.maturity_multiplier.toFixed(2)],
      ['Breadth (' + r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains') + ')', '×' + r.breadth_multiplier.toFixed(2)],
    ];
  }
  $('worked').innerHTML = '<h3>Worked example — rank 1, ' + esc(top.name) + '</h3><dl>' +
    equationRows(top).map(function (e) { return '<div><dt>' + esc(e[0]) + '</dt><dd>' + esc(e[1]) + '</dd></div>'; }).join('') +
    '<div class="total"><dt>Implied value</dt><dd>' + moneyFull(top.implied_value_usd) + '</dd></div></dl>';

  /* ---- Filter and sort state, read from the address hash so a view can be linked. ---- */
  var state = { view: 'board', q: '', cat: '', chain: '', status: '', sort: 'implied' };
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length === 2) state[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    });
  }
  function writeHash() {
    var parts = [];
    ['view', 'q', 'cat', 'chain', 'status', 'sort'].forEach(function (k) {
      if (state[k] && state[k] !== 'board' && state[k] !== 'implied') parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(state[k]));
    });
    if (state.detail) parts.push('detail=' + encodeURIComponent(state.detail));
    var h = parts.length ? '#' + parts.join('&') : '';
    if (location.hash !== h) history.replaceState(null, '', h || location.pathname + location.search);
  }

  /* ---- Controls. ---- */
  var cats = Array.from(new Set(R.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  var chains = Array.from(new Set(R.rows.flatMap(function (r) { return r.chains; }))).sort();
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = R.rows.filter(function (r) {
      if (state.status && r.status !== state.status) return false;
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var by = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -Infinity : b.change_7d) - (a.change_7d == null ? -Infinity : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
      name: function (a, b) { return a.name.localeCompare(b.name); },
    }[state.sort] || function (a, b) { return b.implied_value_usd - a.implied_value_usd; };
    return rows.slice().sort(by);
  }

  var maxImplied = Math.max.apply(null, R.rows.map(function (r) { return r.implied_value_usd; }));
  function renderBoard() {
    var rows = visibleRows();
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' protocols shown';
    $('empty').hidden = rows.length > 0;
    $('rows').innerHTML = rows.map(function (r) {
      var g = r.change_7d;
      var gCls = g == null ? '' : (g >= 0 ? 'pos' : 'neg');
      var badge = r.status === 'watchlist'
        ? '<span class="badge watch">Watchlist</span>'
        : '<span class="badge early">Early</span>';
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + badge + '</span><small>' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</small></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + gCls + '">' + pct(g) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num">' + r.chains.length + '</td>' +
        '<td class="num"><span class="value"><span class="bar"><i style="width:' + w + '%"></i></span>' + money(r.implied_value_usd) + '</span></td>' +
        '</tr>';
    }).join('');
  }

  /* ---- Live view: the market's own values, kept apart from the ranked board. ---- */
  $('liveRows').innerHTML = R.live.map(function (r, i) {
    var g = r.change_7d;
    var gCls = g == null ? '' : (g >= 0 ? 'pos' : 'neg');
    return '<tr>' +
      '<td class="rank">' + (i + 1) + '</td>' +
      '<td><span class="pname">' + esc(r.name) + '</span><small>' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.slice(0, 3).join(', ')) + '</small></td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num ' + gCls + '">' + pct(g) + '</td>' +
      '</tr>';
  }).join('');

  /* ---- The model, documented with its own constants. ---- */
  var m = R.model;
  $('modelDoc').innerHTML = '<h2>The model, in full</h2>' +
    '<p>Implied value = TVL × band multiple × growth × maturity × breadth. Each factor comes from the snapshot alone: the protocol\'s TVL, its seven-day change, how long it has run with no token recorded, and how many chains it runs on. No name is ever special-cased — the same four factors score every row.</p>' +
    '<h3>The four factors</h3>' +
    '<table><thead><tr><th>Factor</th><th>What it is</th><th>Range</th></tr></thead><tbody>' +
    '<tr><td>Band multiple</td><td>The fraction of TVL a launch is worth. It shrinks as the protocol gets bigger: under $50M ×0.60, $50M–$250M ×0.42, $250M–$1B ×0.28, $1B and up ×0.18.</td><td>0.18 – 0.60</td></tr>' +
    '<tr><td>Growth</td><td>Seven-day TVL change, clamped to −50% … +100%, weighted ×' + m.growth_weight + '. A protocol up 100% in a week is worth 1.6× its band; one down 50% is 0.7×.</td><td>0.70 – 1.60</td></tr>' +
    '<tr><td>Maturity</td><td>' + m.maturity_floor + ' + ' + m.maturity_range + ' × min(age, ' + m.maturity_days + ' days) / ' + m.maturity_days + '. A longer run with no token recorded is more due a launch. Age unknown counts as ' + m.unknown_age_days + ' days.</td><td>0.70 – 1.00</td></tr>' +
    '<tr><td>Breadth</td><td>1 + ' + m.breadth_step + ' × min(chains − 1, ' + m.breadth_cap_chains + '). More chains means more surface for a token to land on.</td><td>1.00 – 1.30</td></tr>' +
    '</tbody></table>' +
    '<h3>Who gets ranked</h3>' +
    '<p>All ' + R.watchlist_size + ' watchlist protocols, plus every other pre-token protocol below the $50M floor that the watchlist\'s own rule would keep — ' + R.early_size + ' early finds. Left out: protocols whose token already trades (shown in Live tokens instead), wrapped, staked or bridged products, exchanges, and versioned pools. A protocol below the floor is no worse a subject than one on it.</p>' +
    '<h3>Why the board stops where it does</h3>' +
    '<p>The snapshot is sealed: ' + R.rows.length + ' rows, the same figures every run. The board is a claim about what a launch would be worth if the protocol\'s record stayed as it is — not a prediction that a token comes, or when.</p>';

  /* ---- Detail view. ---- */
  function stepParts(step) {
    var mm = step.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
    if (!mm) return { action: step, cost: '' };
    return { action: mm[1], cost: 'Cost: ' + mm[2] + ' · Time: ' + mm[3] };
  }
  function openDetail(slug) {
    var r = R.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    state.detail = slug;
    writeHash();
    var badge = r.status === 'watchlist' ? '<span class="badge watch">Watchlist</span>' : '<span class="badge early">Early</span>';
    $('modalCard').innerHTML =
      '<div class="modal-head"><div><h2 id="detailTitle">' + esc(r.name) + ' ' + badge + '</h2>' +
      '<p class="sub">Rank ' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · records no token</p></div>' +
      '<button type="button" class="close" id="closeBtn" aria-label="Close">✕</button></div>' +
      '<p class="big-value"><small>Implied value</small>' + moneyFull(r.implied_value_usd) + '</p>' +
      '<dl class="eq">' + equationRows(r).map(function (e) {
        return '<div><dt>' + esc(e[0]) + '</dt><dd>' + esc(e[1]) + '</dd></div>';
      }).join('') + '</dl>' +
      '<div class="detail-sec"><h3>How to farm it</h3><ol class="steps">' +
      r.farm_steps.map(function (s) {
        var p = stepParts(s);
        return '<li>' + esc(p.action) + (p.cost ? '<span class="cost">' + esc(p.cost) + '</span>' : '') + '</li>';
      }).join('') + '</ol></div>';
    $('modal').hidden = false;
    $('closeBtn').addEventListener('click', closeDetail);
    $('closeBtn').focus();
  }
  function closeDetail() {
    $('modal').hidden = true;
    delete state.detail;
    writeHash();
  }
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) closeDetail(); });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });

  /* ---- Views. ---- */
  function showView(view) {
    state.view = view;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    });
    $('view-board').hidden = view !== 'board';
    $('view-live').hidden = view !== 'live';
    $('view-model').hidden = view !== 'model';
    writeHash();
  }
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });

  /* ---- Wire the controls. ---- */
  function syncControls() {
    $('q').value = state.q;
    $('cat').value = state.cat;
    $('chain').value = state.chain;
    $('status').value = state.status;
    $('sort').value = state.sort;
  }
  $('q').addEventListener('input', function () { state.q = $('q').value; renderBoard(); writeHash(); });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; renderBoard(); writeHash(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; renderBoard(); writeHash(); });
  $('status').addEventListener('change', function () { state.status = $('status').value; renderBoard(); writeHash(); });
  $('sort').addEventListener('change', function () { state.sort = $('sort').value; renderBoard(); writeHash(); });

  /* ---- Start: hash first, then the board. ---- */
  readHash();
  syncControls();
  renderBoard();
  showView(state.view === 'live' || state.view === 'model' ? state.view : 'board');
  if (state.detail) openDetail(state.detail);
})();
