/* =====================================================================
   Sanatana — shared script for every page.
   Preferences are stored once for the whole site:
     sanatana-theme      'dark' | 'light'
     sanatana-size-idx   text size step (0–4)
     sanatana-native     '1' to show Sanskrit / Tamil names
   Each feature below only runs if its elements are on the page.
   ===================================================================== */
(function(){
  "use strict";
  var root = document.documentElement, body = document.body;
  function $(sel, ctx){ return (ctx || document).querySelector(sel); }
  function $$(sel, ctx){ return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function store(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  function safe(name, fn){ try{ fn(); }catch(e){ console.error(name + ' failed:', e); } }

  /* ---------- THEME ---------- */
  function initTheme(){
    var btn = $('#themeToggle'); if(!btn) return;
    var knob = $('#knob'), label = $('#toggleLabel');
    function apply(t){
      root.setAttribute('data-theme', t); store('sanatana-theme', t);
      var light = t === 'light';
      if(knob) knob.textContent = light ? '☀️' : '🌙';
      if(label) label.textContent = light ? 'Dark' : 'Light';
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    }
    btn.addEventListener('click', function(){ apply(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });
    apply(root.getAttribute('data-theme') || 'dark');
  }

  /* ---------- TEXT SIZE ---------- */
  function initSize(){
    var up = $('#sizeUp'), down = $('#sizeDown'), val = $('#sizeVal'); if(!up) return;
    var sizes = [0.85, 1, 1.15, 1.3, 1.5], idx = parseInt(store('sanatana-size-idx') || '1', 10);
    function apply(i){
      idx = Math.max(0, Math.min(sizes.length - 1, isNaN(i) ? 1 : i));
      root.style.setProperty('--scale', sizes[idx]); store('sanatana-size-idx', idx);
      val.textContent = Math.round(sizes[idx] * 100) + '%';
    }
    up.addEventListener('click', function(){ apply(idx + 1); });
    down.addEventListener('click', function(){ apply(idx - 1); });
    apply(idx);
  }

  /* ---------- NATIVE SCRIPT ---------- */
  function initLang(){
    var en = $('#langEn'), nat = $('#langNative'); if(!en || !nat) return;
    function apply(on){
      body.classList.toggle('show-native', on);
      en.classList.toggle('active', !on); nat.classList.toggle('active', on);
      en.setAttribute('aria-pressed', String(!on)); nat.setAttribute('aria-pressed', String(on));
      store('sanatana-native', on ? '1' : '0');
    }
    en.addEventListener('click', function(){ apply(false); });
    nat.addEventListener('click', function(){ apply(true); });
    apply(store('sanatana-native') === '1');
  }

  /* ---------- MAP (circuit pages) ---------- */
  var map = null, markers = {}, route = null;
  function initMap(){
    var el = $('#map'), data = window.SANATANA_SITES;
    if(!el || !data || el.classList.contains('tall')) return;
    if(typeof L === 'undefined'){ el.innerHTML = '<p style="padding:20px;color:var(--muted)">The map could not load. The sites are listed below.</p>'; return; }
    map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    data.forEach(function(s){
      var icon = L.divIcon({ className: '', html: '<div class="num-marker" style="background:' + s.color + '">' + s.n + '</div>',
                             iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] });
      var m = L.marker([s.lat, s.lng], { icon: icon, title: s.name, keyboard: true });
      m.bindPopup('<h3 style="color:' + s.color + '">' + s.name + '</h3><div class="sub">' + s.sub + '</div><a class="go" href="#' + s.id + '">Read more ↓</a>');
      m.on('click', function(){ var c = document.getElementById(s.id); if(c){ c.classList.add('flash'); setTimeout(function(){ c.classList.remove('flash'); }, 1600); } });
      m.addTo(map); markers[s.id] = m;
    });
    fitMap(Object.keys(markers));
    drawRoute(Object.keys(markers));
    $$('.map-link').forEach(function(b){
      b.addEventListener('click', function(){
        var m = markers[b.getAttribute('data-id')];
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if(m){ map.setView(m.getLatLng(), 12); m.openPopup(); }
      });
    });
    setTimeout(function(){ map.invalidateSize(); }, 250);
  }
  /* Optional journey line (page sets window.SANATANA_ROUTE = [card ids in order]) */
  function drawRoute(visibleIds){
    var order = window.SANATANA_ROUTE; if(!map || !order) return;
    if(route){ map.removeLayer(route); route = null; }
    var pts = order.filter(function(id){ return markers[id] && visibleIds.indexOf(id) !== -1; })
                   .map(function(id){ return markers[id].getLatLng(); });
    if(pts.length < 2) return;
    var c = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e67e22';
    route = L.polyline(pts, { color: c, weight: 3, opacity: .75, dashArray: '8 8', interactive: false }).addTo(map);
  }
  function fitMap(ids){
    if(!map || !ids.length) return;
    var pts = ids.map(function(id){ return markers[id].getLatLng(); });
    if(pts.length === 1) map.setView(pts[0], 11); else map.fitBounds(pts, { padding: [36, 36], maxZoom: 11 });
  }

  /* ---------- MAP (Sacred Geography: two circuits) ---------- */
  function initGeoMap(){
    var el = $('#map.tall'), groups = window.SANATANA_GROUPS;
    if(!el || !groups) return;
    var counter = $('#counter');
    if(typeof L === 'undefined'){ el.innerHTML = '<p style="padding:20px;color:var(--muted)">The map could not load.</p>'; return; }
    var gmap = L.map(el, { center: [20.5, 78.5], zoom: 5, scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(gmap);
    var all = [];
    groups.forEach(function(g){
      g.sites.forEach(function(s){
        var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: '<div class="dot-marker" style="background:' + g.color + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8] }) });
        m.bindPopup('<h3 style="color:' + g.color + '">' + s.name + '</h3><div class="sub">' + g.label + ' · ' + s.loc + '</div><div class="desc">' + s.note + '</div>');
        m._group = g.key; m.addTo(gmap); all.push(m);
      });
    });
    function count(f){
      if(!counter) return;
      var g = groups.filter(function(x){ return x.key === f; })[0];
      counter.textContent = f === 'all'
        ? '📍 ' + all.length + ' sites mapped — ' + groups.map(function(x){ return x.sites.length + ' ' + x.plural; }).join(' · ')
        : '📍 Showing ' + g.sites.length + ' ' + g.plural;
    }
    $$('[data-group-filter]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var f = btn.getAttribute('data-group-filter');
        $$('[data-group-filter]').forEach(function(b){ b.classList.toggle('active', b === btn); });
        all.forEach(function(m){
          var show = f === 'all' || m._group === f;
          if(show && !gmap.hasLayer(m)) m.addTo(gmap);
          if(!show && gmap.hasLayer(m)) gmap.removeLayer(m);
        });
        count(f);
      });
    });
    count('all');
    setTimeout(function(){ gmap.invalidateSize(); }, 250);
  }

  /* ---------- SEARCH + FILTERS ----------
     Items ([data-item]) match the active chip by their data-tags; an item with no
     tags follows its block's data-section. Blocks ([data-block]) hide when nothing
     in them matches. Comparison-table columns ([data-col]) follow the chip too. */
  var activeFilter = 'all', onFilter = [];
  function tagsOf(el){ var t = el.getAttribute('data-tags'); return t ? t.split(/\s+/) : null; }
  function applyFilters(refit){
    var search = $('#searchInput'), q = search ? search.value.trim().toLowerCase() : '';
    var F = activeFilter, visibleIds = [], anyItem = false, anyVisible = false;
    $$('[data-block]').forEach(function(block){
      var sect = block.getAttribute('data-section'), items = $$('[data-item]', block), shown = 0, taggedHit = false;
      items.forEach(function(it){
        anyItem = true;
        var tags = tagsOf(it);
        var tagOK = F === 'all' || (tags ? tags.indexOf(F) !== -1 : (sect ? sect === F : true));
        var ok = tagOK && (!q || it.textContent.toLowerCase().indexOf(q) !== -1);
        it.classList.toggle('hidden', !ok);
        if(ok){ shown++; if(it.id) visibleIds.push(it.id); if(tags) taggedHit = true; }
      });
      var inScope = !sect || F === 'all' || sect === F || taggedHit;
      var vis = items.length ? (inScope && shown > 0) : (inScope && (!q || block.textContent.toLowerCase().indexOf(q) !== -1));
      block.style.display = vis ? '' : 'none';
      if(vis && shown) anyVisible = true;
    });
    $$('.stage-header[data-stage]').forEach(function(h){
      var st = h.getAttribute('data-stage');
      h.classList.toggle('hidden', !$$('.timeline-item[data-tags="' + st + '"]').some(function(i){ return !i.classList.contains('hidden'); }));
    });
    $$('.compare').forEach(function(table){
      var keys = $$('thead [data-col]', table).map(function(th){ return th.getAttribute('data-col'); });
      var byCol = keys.indexOf(F) !== -1;
      $$('[data-col]', table).forEach(function(cell){
        cell.classList.toggle('col-hidden', byCol && cell.getAttribute('data-col') !== F);
      });
    });
    /* Family-tree people stay in place (the tree keeps its shape); non-matches fade */
    $$('.ft-node').forEach(function(n){
      var tags = tagsOf(n), tagOK = F === 'all' || (tags && tags.indexOf(F) !== -1);
      var hit = !q || n.textContent.toLowerCase().indexOf(q) !== -1;
      n.classList.toggle('faded', !(tagOK && hit));
      n.classList.toggle('match', !!q && hit);
    });
    $$('.journey a').forEach(function(a){
      var t = document.getElementById(a.getAttribute('href').slice(1));
      a.style.opacity = t && t.classList.contains('hidden') ? '.35' : '';
    });
    if(map){
      Object.keys(markers).forEach(function(id){
        var show = visibleIds.indexOf(id) !== -1;
        if(show && !map.hasLayer(markers[id])) markers[id].addTo(map);
        if(!show && map.hasLayer(markers[id])) map.removeLayer(markers[id]);
      });
      if(refit) fitMap(visibleIds.filter(function(id){ return markers[id]; }));
      drawRoute(visibleIds);
    }
    body.classList.toggle('nothing', anyItem && !anyVisible);
    onFilter.forEach(function(fn){ fn(F, q); });
  }
  function initFilters(){
    var chips = $$('.filter-chip');
    chips.forEach(function(chip){
      chip.addEventListener('click', function(){
        activeFilter = chip.getAttribute('data-filter');
        chips.forEach(function(c){ c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
        applyFilters(true);
      });
    });
    var search = $('#searchInput');
    if(search) search.addEventListener('input', function(){ applyFilters(false); });
    applyFilters(false);
  }

  /* ---------- VEDIC MAP: chronological view + connections ---------- */
  function initVeda(){
    var chrono = $('#chrono'); if(!chrono) return;
    var mapBtn = $('#viewMap'), tlBtn = $('#viewTimeline'), built = false;
    function build(){
      if(built) return; built = true;
      var items = $$('.category-view .card[data-era]').map(function(card){
        var era = card.getAttribute('data-era');
        var y = parseInt((era.match(/(\d{3,4})/) || [0, 0])[1], 10);
        if(/BCE/i.test(era)) y = -y;   /* same rule as the original page: any BCE date sorts as negative */
        return { card: card, era: era, year: y };
      });
      items.sort(function(a, b){ return a.year - b.year; });
      items.forEach(function(it){
        var c = it.card, div = document.createElement('div');
        div.className = 'tl-item'; div.setAttribute('data-item', ''); div.setAttribute('data-tags', c.getAttribute('data-tags') || '');
        div.style.setProperty('--accent', c.style.getPropertyValue('--accent'));
        var p = $('p', c), chips = $('.chips', c);
        div.innerHTML = '<div class="tl-box"><div class="era">' + it.era + '</div><h4>' + $('h3', c).innerHTML + '</h4>' +
          (p ? '<p>' + p.innerHTML + '</p>' : '') + (chips ? '<div class="chips">' + chips.innerHTML + '</div>' : '') + '</div>';
        div.addEventListener('click', function(){ setView('map'); select(c, true); });
        chrono.appendChild(div);
      });
      applyFilters(false);
    }
    function setView(v){
      body.classList.toggle('view-timeline', v === 'timeline');
      mapBtn.classList.toggle('active', v !== 'timeline'); tlBtn.classList.toggle('active', v === 'timeline');
      mapBtn.setAttribute('aria-pressed', String(v !== 'timeline')); tlBtn.setAttribute('aria-pressed', String(v === 'timeline'));
      store('sanatana-veda-view', v);
      if(v === 'timeline') build();
      clear();
    }
    mapBtn.addEventListener('click', function(){ setView('map'); });
    tlBtn.addEventListener('click', function(){ setView('timeline'); });

    var svg = null, selected = null, NS = 'http://www.w3.org/2000/svg';
    function overlay(){ if(!svg){ svg = document.createElementNS(NS, 'svg'); svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;'; body.appendChild(svg); } return svg; }
    function linksOf(c){ return (c.getAttribute('data-links') || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean); }
    function draw(){
      if(!selected) return;
      var o = overlay(); o.innerHTML = '';
      var r = selected.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + r.height / 2;
      var accent = getComputedStyle(selected).getPropertyValue('--accent').trim() || '#ff9f43';
      linksOf(selected).forEach(function(id){
        var t = $('.category-view .card[data-id="' + id + '"]'); if(!t || t.classList.contains('hidden')) return;
        var tr = t.getBoundingClientRect(), tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M ' + sx + ' ' + sy + ' Q ' + (sx + tx) / 2 + ' ' + ((sy + ty) / 2 - 40) + ' ' + tx + ' ' + ty);
        path.setAttribute('stroke', accent); path.setAttribute('stroke-width', '2'); path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '6 6'); path.setAttribute('opacity', '0.85');
        path.style.filter = 'drop-shadow(0 0 4px ' + accent + ')';
        o.appendChild(path);
      });
    }
    function clear(){
      $$('.category-view .card').forEach(function(c){ c.classList.remove('selected', 'dimmed'); });
      if(svg) svg.innerHTML = ''; selected = null;
    }
    function select(card, scroll){
      if(selected === card){ clear(); return; }
      clear(); selected = card;
      var links = linksOf(card);
      $$('.category-view .card').forEach(function(c){ c.classList.add('dimmed'); });
      card.classList.remove('dimmed'); card.classList.add('selected');
      links.forEach(function(id){ var t = $('.category-view .card[data-id="' + id + '"]'); if(t){ t.classList.remove('dimmed'); t.classList.add('selected'); } });
      if(scroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      draw();
    }
    $$('.category-view .card').forEach(function(card){
      card.classList.add('linkable'); card.setAttribute('tabindex', '0');
      card.addEventListener('click', function(e){ if(e.target.closest('a')) return; select(card); });
      card.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); select(card); } });
    });
    document.addEventListener('click', function(e){ if(selected && !e.target.closest('.card') && !e.target.closest('.tl-item')) clear(); });
    var raf = null;
    window.addEventListener('scroll', function(){ if(raf) return; raf = requestAnimationFrame(function(){ draw(); raf = null; }); }, { passive: true });
    window.addEventListener('resize', draw);
    onFilter.push(function(){ draw(); });
    setView(store('sanatana-veda-view') || 'map');
  }

  /* ---------- Keep content clear of the fixed toolbar ---------- */
  function initFit(){
    var bar = $('.controls'); if(!bar) return;
    function fit(){
      body.style.paddingTop = '';
      var base = parseFloat(getComputedStyle(body).paddingTop) || 0, need = Math.ceil(bar.getBoundingClientRect().height) + 16;
      if(need > base) body.style.paddingTop = need + 'px';
    }
    window.addEventListener('resize', fit); window.addEventListener('load', fit); fit();
  }

  /* ---------- BOOT — each feature isolated so one failure can't blank the page ---------- */
  safe('theme', initTheme);
  safe('size', initSize);
  safe('lang', initLang);
  safe('map', initMap);
  safe('geo map', initGeoMap);
  safe('filters', initFilters);
  safe('veda', initVeda);
  safe('toolbar', initFit);
})();
