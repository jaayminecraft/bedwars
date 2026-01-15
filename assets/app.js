(async function(){
  const data = await loadData();
  const seasonal = await loadSeasonalData();

  const SEASON_ORDER = [
    'Lunar New Year',
    'Easter',
    'Summer',
    'Halloween',
    'Winter'
  ];

  function seasonOrderIndex(label){
    const i = SEASON_ORDER.indexOf(label);
    return (i === -1) ? 999 : i;
  }

  function stripLeadingEmoji(name){
    if(!name) return '';
    const s = String(name).trim();
    try{
      return s.replace(/^(\p{Extended_Pictographic})\s*/u, '');
    }catch(_){
      return s;
    }
  }

  function detectSeasonLabel(m){
    const direct =
      m.season ||
      m.seasonLabel ||
      m.event ||
      m.holiday;

    if(direct) return String(direct).trim();

    const n = String(m.name || '').trim();
    if(n.startsWith('🐰')) return 'Easter';
    if(n.startsWith('☀️')) return 'Summer';
    if(n.startsWith('🎃')) return 'Halloween';
    if(n.startsWith('❄️')) return 'Winter';
    if(n.startsWith('🧧')) return 'Lunar New Year';

    return 'Winter';
  }

  function seasonEmoji(label){
    const s = String(label || '').toLowerCase();

    if(s.includes('lunar')) return '🧧';
    if(s.includes('easter')) return '🐰';
    if(s.includes('summer')) return '☀️';
    if(s.includes('halloween')) return '🎃';
    if(s.includes('winter') || s.includes('holiday')) return '❄️';

    return '🎉';
  }


  const seasonalMaps = (seasonal.maps || []).map(m => {
    const seasonLabel = detectSeasonLabel(m);

    const image_url = m.image_url || m.imageId || m.image || '';
    const effective_date = m.effective_date || m.dateStatus || m.last_seen || 'Unknown';

    return {
      ...m,

      name: stripLeadingEmoji(m.name || ''),
      mode: (m.mode || 'Solos/Doubles'),
      isSeasonal: true,
      status: (m.status || 'out'),
      inRotation: !!m.inRotation,

      seasonLabel,
      seasonOrder: seasonOrderIndex(seasonLabel),
      seasonEmoji: seasonEmoji(seasonLabel),


      image_url,
      effective_date,

      released: m.released || 'Unknown',
      playstyle: m.playstyle || 'Not specified.',
      wiki: m.wiki || ''
    };
  });


  const maps = ([(data.maps || []), seasonalMaps].flat()).slice();


  const meta = data.meta || {};
  const metaLine = document.getElementById('metaLine');
  if(metaLine){
    metaLine.textContent =
      `Latest update: ${meta.latest_update}`;
  }


  const USE_REAL_TODAY = true;


  function parseDateLoose(s){
    if(!s) return null;
    const t = String(s).trim();
    if(!t || t.toLowerCase() === 'unknown') return null;

    const dt = new Date(t);
    if(Number.isNaN(dt.getTime())) return null;

    // normalize to midnight local to avoid DST hour weirdness
    dt.setHours(0,0,0,0);
    return dt;
  }

  function getBaseDate(){
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  }




  function formatDaysLive(m){
    const base = getBaseDate();
    const eff = parseDateLoose(m.effective_date);

    if(!eff) return '—';

    const diffMs = base.getTime() - eff.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    // Guard against negative if dates are weird
    return (diffDays >= 0) ? String(diffDays) : '0';
  }

  const playstyles = uniq(
    maps
      .map(m => (m.playstyle ?? '').toString().trim())
      .filter(p => p && p.toLowerCase() !== 'not specified.' && p.toLowerCase() !== 'not specified')
  );

  const psSel = document.getElementById('playstyle');
  for(const p of playstyles){
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    psSel.appendChild(opt);
  }

  const els = {
    q: document.getElementById('q'),
    mode: document.getElementById('mode'),
    status: document.getElementById('status'),
    playstyle: document.getElementById('playstyle'),
    sort: document.getElementById('sort'),
    in_list: document.getElementById('in-list'),
    out_list: document.getElementById('out-list'),
  };

  function matches(m){
    const q = norm(els.q.value);
    const mode = els.mode.value;
    const status = els.status.value;
    const playstyle = els.playstyle ? els.playstyle.value : 'all';

    if(mode === 'Seasonal'){
      if(!m.isSeasonal) return false;
    }else if(mode === 'Solos/Doubles' || mode === '3s/4s'){
      if(m.isSeasonal){
        if(m.status !== 'in') return false;
        if(m.mode !== mode) return false;
      }else{
        if(m.mode !== mode) return false;
      }
    }else{
      if(m.isSeasonal && m.status !== 'in') return false;
    }

    if(status !== 'all' && m.status !== status) return false;

    if(playstyle !== 'all' && m.playstyle !== playstyle) return false;

    if(q){
      const blob = `${m.name} ${m.note || ''}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }

    return true;
  }

  const bgIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        for(const e of entries){
          if(!e.isIntersecting) continue;
          const el = e.target;
          const bg = el.dataset.bg;
          if(bg){
            el.style.backgroundImage = `url("${bg}")`;
            delete el.dataset.bg;
          }
          obs.unobserve(el);
        }
      }, { rootMargin: '600px 0px' })
    : null;

  function mapCard(m){
    const d = document.createElement('details');
    d.classList.add('mapcard');
    d.classList.add(m.status === 'in' ? 'is-in' : 'is-out');

    const summary = document.createElement('summary');
    summary.className = 'mapSummary';

    const hero = document.createElement('div');
    hero.className = 'mapHero';
    if(m.image_url){
      if(bgIO){
        hero.dataset.bg = m.image_url;
        bgIO.observe(hero);
      }else{
        hero.style.backgroundImage = `url("${m.image_url}")`;
      }
    }


    if(m.isSeasonal){
      const teamsPill = document.createElement('div');
      teamsPill.className = 'mapPill mapPill-teams';
      teamsPill.textContent = (m.mode === '3s/4s') ? '4 teams' : '8 teams';
      hero.appendChild(teamsPill);

      const seasonPill = document.createElement('div');
      seasonPill.className = 'mapPill mapPill-season';
      seasonPill.textContent = `${m.seasonEmoji || '🎉'} ${m.seasonLabel || 'Seasonal'}`;
      hero.appendChild(seasonPill);
    }else{
      const modePill = document.createElement('div');
      modePill.className = 'mapPill';
      modePill.textContent = (m.mode === '3s/4s') ? '4 teams' : '8 teams';
      hero.appendChild(modePill);
    }


    const overlay = document.createElement('div');
    overlay.className = 'mapOverlay';

    const left = document.createElement('div');
    left.className = 'mapLeft';

    const title = document.createElement('div');
    title.className = 'mapTitle';
    title.textContent = m.name || '';

    left.appendChild(title);

    const daysWrap = document.createElement('div');
    daysWrap.className = 'mapDays';

    const label = document.createElement('div');
    label.className = 'mapDaysLabel';
    label.textContent = (m.status === 'in')
      ? 'Available since'
      : 'Unavailable since';

    const sinceDate = document.createElement('div');
    sinceDate.className = 'mapDaysDate';
    sinceDate.textContent = m.effective_date || 'Unknown';

    const days = document.createElement('div');
    days.className = 'mapDaysValue';
    days.textContent = `${formatDaysLive(m)} days`;

    daysWrap.appendChild(label);
    daysWrap.appendChild(sinceDate);
    daysWrap.appendChild(days);

    overlay.appendChild(left);
    overlay.appendChild(daysWrap);
    hero.appendChild(overlay);

    summary.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'detailsBody';

    function kv(k,v, isHtml=false){
      const row = document.createElement('div');
      row.className = 'kv';
      const kk = document.createElement('div'); kk.className='k'; kk.textContent=k;
      const vv = document.createElement('div');
      if(isHtml) vv.innerHTML = v || '';
      else vv.textContent = v || '';
      row.appendChild(kk); row.appendChild(vv);
      return row;
    }

    body.appendChild(kv('Mode', m.mode || ''));
    body.appendChild(kv('Released', m.released || ''));
    body.appendChild(kv((m.status === 'in') ? 'In rotation since' : 'Last seen', m.effective_date || ''));

    if(m.mode !== '3s/4s' && m.gen_html){
      body.appendChild(kv('Generator Speed', m.gen_html, true));
    }
    body.appendChild(kv('Playstyle', m.playstyle || ''));
    body.appendChild(kv('Days', `${formatDaysLive(m)} days`));

    if(m.note){
      body.appendChild(kv('Note', m.note, true));
    }

    const links = document.createElement('div');
    links.className = 'kv';
    const k = document.createElement('div'); k.className='k'; k.textContent='Links';
    const v = document.createElement('div');
    v.innerHTML = (m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : '')
      + (m.image_url ? ` • <a href="${m.image_url}" target="_blank" rel="noopener">Image</a>` : '');
    links.appendChild(k); links.appendChild(v);
    body.appendChild(links);

    d.appendChild(summary);
    d.appendChild(body);
    return d;
  }

  const cardCache = new Map();
  function cardKey(m){
    return `${m.isSeasonal ? 'S' : 'N'}|${m.mode || ''}|${m.name || ''}`;
  }
  function getCard(m){
    const k = cardKey(m);
    let el = cardCache.get(k);
    if(el) return el;
    el = mapCard(m);
    cardCache.set(k, el);
    return el;
  }

  function render(){
    els.in_list.textContent = '';
    els.out_list.textContent = '';

    const seasonalActive = maps.some(m => m.isSeasonal && m.status === 'in');

    function daysVal(m){
      const raw = formatDaysLive(m);

      if(raw === '—' || raw == null) return Number.POSITIVE_INFINITY;

      const cleaned = String(raw).replace(/[^\d-]/g,'');
      if(!cleaned) return Number.POSITIVE_INFINITY;

      const n = Number(cleaned);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    }

    function seasonalFirstOrLast(a,b){
      if(!!a.isSeasonal !== !!b.isSeasonal){
        if(seasonalActive){
          return a.isSeasonal ? -1 : 1;
        }
        return a.isSeasonal ? 1 : -1;
      }
      return 0;
    }

    function seasonalInternalSort(a,b, sortKey){
      const sa = (typeof a.seasonOrder === 'number') ? a.seasonOrder : 999;
      const sb = (typeof b.seasonOrder === 'number') ? b.seasonOrder : 999;
      if(sa !== sb) return sa - sb;

      return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
    }

    function compare(a,b){
      const sortKey = els.sort ? els.sort.value : 'name_asc';
      const isDaysSort = (sortKey === 'days_desc' || sortKey === 'days_asc');

      if(!isDaysSort){
        const block = seasonalFirstOrLast(a,b);
        if(block !== 0) return block;

        if(a.isSeasonal && b.isSeasonal){
          return seasonalInternalSort(a,b, sortKey);
        }

        return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
      }

      const da = daysVal(a);
      const db = daysVal(b);

      if(sortKey === 'days_desc'){
        if(da === db) return byName(a,b);
        return (db - da);
      }

      if(da === db) return byName(a,b);
      return (da - db);
    }

    const filtered = maps.filter(matches);

    const inMaps  = filtered.filter(m => m.status === 'in').slice().sort(compare);
    const outMaps = filtered.filter(m => m.status === 'out').slice().sort(compare);

    const fragIn = document.createDocumentFragment();
    const fragOut = document.createDocumentFragment();

    for(const m of inMaps)  fragIn.appendChild(getCard(m));
    for(const m of outMaps) fragOut.appendChild(getCard(m));

    els.in_list.appendChild(fragIn);
    els.out_list.appendChild(fragOut);
  }

  let rafPending = false;
  function scheduleRender(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
    });
  }

  let qTimer = 0;
  function scheduleRenderDebounced(){
    clearTimeout(qTimer);
    qTimer = setTimeout(scheduleRender, 90);
  }

  els.q.addEventListener('input', scheduleRenderDebounced);
  for(const el of [els.mode, els.status, els.playstyle, els.sort]){
    el.addEventListener('change', scheduleRender);
  }

  function seasonalSortKey(m, seasonalActive){
    if(seasonalActive){
      return m.isSeasonal ? 0 : 1;
    }
    return m.isSeasonal ? 1 : 0;
  }

  render();
  revealOnLoad();


})().catch(err=>{
  console.error(err);
  alert(err.message || String(err));
});

document.addEventListener('toggle', (e) => {
  const opened = e.target;
  if(!(opened instanceof HTMLDetailsElement)) return;
  if(!opened.classList.contains('mapcard')) return;
  if(!opened.open) return;

  document.querySelectorAll('details.mapcard[open]').forEach(d => {
    if(d !== opened) d.open = false;
  });
}, true);

