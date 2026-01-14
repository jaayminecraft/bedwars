(async function(){
  const data = await loadData();
  const seasonal = await loadSeasonalData();

  const meta = data.meta || {};
  document.getElementById('metaLine').textContent =
    `Latest update: ${meta.latest_update || ''} • Latest rotation: ${meta.latest_rotation || ''}`;

  const els = {
    q: document.getElementById('q'),
    mode: document.getElementById('mode'),
    status: document.getElementById('status'),
    sort: document.getElementById('sort'),
    tbody: document.querySelector('#tbl tbody'),
  };

  const SEASON_ORDER = [
    'Lunar New Year',
    'Easter',
    'Summer',
    'Halloween',
    'Winter',
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
    if(n.startsWith('🧧')) return 'Lunar New Year';
    if(n.startsWith('🐰')) return 'Easter';
    if(n.startsWith('☀️')) return 'Summer';
    if(n.startsWith('🎃')) return 'Halloween';
    if(n.startsWith('❄️')) return 'Winter';

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

  function parseDateLoose(s){
    if(!s) return null;
    const t = String(s).trim();
    if(!t || t.toLowerCase() === 'unknown') return null;
    const dt = new Date(t);
    if(Number.isNaN(dt.getTime())) return null;
    dt.setHours(0,0,0,0);
    return dt;
  }

  function getBaseDate(){
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  }

  function daysLiveFromEffective(m){
    const eff = parseDateLoose(m.effective_date || m.dateStatus || m.last_seen || 'Unknown');
    if(!eff) return null;
    const base = getBaseDate();
    const diffDays = Math.floor((base.getTime() - eff.getTime()) / 86400000);
    return (diffDays >= 0) ? diffDays : 0;
  }


  const normalMaps = (data.maps || []).map(m => ({
    ...m,
    isSeasonal: false,
  }));

  const seasonalMaps = (seasonal.maps || []).map(m => {
    const seasonLabel = detectSeasonLabel(m);
    return {
      ...m,
      isSeasonal: true,
      seasonLabel,
      seasonOrder: seasonOrderIndex(seasonLabel),
      seasonEmoji: seasonEmoji(seasonLabel),

      name: stripLeadingEmoji(m.name || ''),
      mode: 'Seasonal',
      status: (m.status || 'out'),
      effective_date: m.effective_date || m.dateStatus || m.last_seen || 'Unknown',
      released: m.released || 'Unknown',
      playstyle: m.playstyle || 'Not specified.',
      wiki: m.wiki || '',
      note: m.note || '',
      gen_html: m.gen_html || '',
    };
  });

  const mapsRaw = normalMaps.concat(seasonalMaps);

  function matches(m){
    const q = norm(els.q.value);
    const mode = els.mode.value;
    const status = els.status.value;

    if(mode !== 'all' && m.mode !== mode) return false;
    if(status !== 'all' && m.status !== status) return false;

    if(q){
      const blob = `${m.name} ${m.mode} ${m.status} ${m.playstyle} ${m.effective_date || ''} ${m.note || ''}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  }

  function td(text, cls){
    const el = document.createElement('td');
    if(cls) el.className = cls;
    el.textContent = text ?? '';
    return el;
  }

  function tdHtml(htmlStr, cls){
    const el = document.createElement('td');
    if(cls) el.className = cls;
    el.innerHTML = htmlStr || '';
    return el;
  }

  function daysValForSort(m){
    const live = daysLiveFromEffective(m);
    if(live == null) return Number.POSITIVE_INFINITY;
    return live;
  }

  function compareMaps(a, b){
    const sortKey = els.sort.value;

    const isNameSort = (sortKey === 'name_asc' || sortKey === 'name_desc');
    const isDaysSort = (sortKey === 'days_asc' || sortKey === 'days_desc');

    if(isNameSort){
      if(!!a.isSeasonal !== !!b.isSeasonal){
        return a.isSeasonal ? 1 : -1;
      }

      if(a.isSeasonal && b.isSeasonal){
        const sa = (typeof a.seasonOrder === 'number') ? a.seasonOrder : 999;
        const sb = (typeof b.seasonOrder === 'number') ? b.seasonOrder : 999;
        if(sa !== sb) return sa - sb;

        return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
      }

      return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
    }

    if(isDaysSort){
      const da = daysValForSort(a);
      const db = daysValForSort(b);

      if(sortKey === 'days_asc'){
        if(da !== db) return da - db;
        return byName(a,b);
      }else{
        if(da !== db) return db - da;
        return byName(a,b);
      }
    }

    return byName(a,b);
  }

  function render(){
    els.tbody.innerHTML = '';
    const filtered = mapsRaw.filter(matches).slice().sort(compareMaps);

    for(const m of filtered){
      const tr = document.createElement('tr');

      tr.classList.add(m.status === 'in' ? 'row-in' : 'row-out');

      const mapLabel = m.isSeasonal
        ? `${m.seasonEmoji || '🎉'} ${m.name || ''}`
        : (m.name || '');

      tr.appendChild(td(mapLabel));

      tr.appendChild(td(
        m.mode === 'Seasonal' ? 'Seasonal'
        : (m.mode === '3s/4s' ? '3v3v3v3/4v4v4v4' : 'Solos/Doubles'),
        'nowrap'
      ));

      tr.appendChild(td(
        m.status === 'in' ? 'In' : 'Out',
        `nowrap ${m.status === 'in' ? 'status-in' : 'status-out'}`
      ));

      tr.appendChild(td(m.effective_date || ''));

      const liveDays = daysLiveFromEffective(m);
      tr.appendChild(td(liveDays == null ? 'Unknown' : String(liveDays), 'nowrap'));

      tr.appendChild(td(m.playstyle || ''));

      tr.appendChild(tdHtml(
        (m.mode !== '3s/4s' && m.mode !== 'Seasonal') ? (m.gen_html || '') : '',
        'nowrap'
      ));

      tr.appendChild(tdHtml(
        m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : '',
        'nowrap'
      ));

      tr.appendChild(tdHtml(m.note || ''));

      els.tbody.appendChild(tr);
    }

  }

  for(const el of [els.q, els.mode, els.status, els.sort]){
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }

  render();
})().catch(err=>{
  console.error(err);
  alert(err.message || String(err));
});
