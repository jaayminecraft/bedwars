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
    tbodyNormal: document.querySelector('#tbl-normal tbody'),
    tbodySeasonal: document.querySelector('#tbl-seasonal tbody'),
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

  function formatDaysLive(m){
    const n = daysLiveFromEffective(m);
    return (n == null) ? '—' : String(n);
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
      mode: (m.mode || 'Solos/Doubles'),
      status: (m.status || 'out'),
      effective_date: m.effective_date || m.dateStatus || m.last_seen || 'Unknown',
      released: m.released || 'Unknown',
      playstyle: m.playstyle || 'Not specified.',
      wiki: m.wiki || '',
      note: m.note || '',
      gen_html: m.gen_html || '',
      emoji: m.emoji || '', // keep your JSON emoji if present
    };
  });

  function modeMatches(m, selectedMode){
    if(selectedMode === 'all') return true;

    // only show seasonal in seasonal mode if you later add that option
    return m.mode === selectedMode;
  }

  function statusMatches(m, selectedStatus){
    if(selectedStatus === 'all') return true;
    return m.status === selectedStatus;
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

  function stripBBCode(s){
    if(s == null) return '';
    let t = String(s);

    t = t.replace(/\[\/?[a-z0-9]+(?:=[^\]]+)?\]/gi, '');

    t = t.replace(/\[(?:color|url|img|b|i|u|s|quote|spoiler|size|center|left|right)[^\]]*\]/gi, '');

    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function render(){
    els.tbodyNormal.innerHTML = '';
    els.tbodySeasonal.innerHTML = '';

    const q = norm(els.q.value);
    const mode = els.mode.value;
    const status = els.status.value;

    function matchesShared(m){
      if(!modeMatches(m, mode)) return false;
      if(!statusMatches(m, status)) return false;

      if(q){
        const blob = `${m.name} ${m.mode} ${m.status} ${m.effective_date || m.dateStatus || ''} ${m.note || ''}`.toLowerCase();
        if(!blob.includes(q)) return false;
      }
      return true;
    }

    const filteredNormal = normalMaps
      .filter(matchesShared)
      .slice()
      .sort(compareMaps);

    const filteredSeasonal = seasonalMaps
      .filter(matchesShared)
      .slice()
      .sort(compareMaps);


    for(const m of filteredNormal){
      const tr = document.createElement('tr');
      tr.classList.add(m.status === 'in' ? 'row-in' : 'row-out');

      tr.appendChild(td(m.name));

      tr.appendChild(td(
        m.mode === '3s/4s' ? '3v3v3v3/4v4v4v4' : 'Solos/Doubles',
        'nowrap'
      ));

      tr.appendChild(td(
        m.status === 'in' ? 'IN' : 'OUT',
        `nowrap ${m.status === 'in' ? 'status-in' : 'status-out'}`
      ));

      tr.appendChild(td(m.effective_date || m.dateStatus || ''));

      tr.appendChild(td(formatDaysLive(m), 'nowrap'));

      tr.appendChild(td(m.playstyle || ''));

      tr.appendChild(tdHtml(m.mode !== '3s/4s' ? (m.gen_html || '') : ''));

      tr.appendChild(tdHtml(m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : ''));

      tr.appendChild(td(stripBBCode(m.note || '')));

      els.tbodyNormal.appendChild(tr);
    }

    for(const m of filteredSeasonal){
      const tr = document.createElement('tr');
      tr.classList.add(m.status === 'in' ? 'row-in' : 'row-out');

      const emoji = (m.emoji || m.seasonEmoji || '').trim();
      const mapLabel = emoji ? `${emoji} ${m.name || ''}` : (m.name || '');
      tr.appendChild(td(mapLabel));

      tr.appendChild(td(
        m.mode === '3s/4s' ? '3v3v3v3/4v4v4v4' : 'Solos/Doubles',
        'nowrap'
      ));

      tr.appendChild(td(
        m.status === 'in' ? 'IN' : 'OUT',
        `nowrap ${m.status === 'in' ? 'status-in' : 'status-out'}`
      ));

      tr.appendChild(td(m.effective_date || m.dateStatus || ''));

      tr.appendChild(td(formatDaysLive(m), 'nowrap'));

      tr.appendChild(td(m.playstyle || ''));

      tr.appendChild(tdHtml(''));

      tr.appendChild(tdHtml(m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : ''));

      tr.appendChild(tdHtml(m.note || ''));

      els.tbodySeasonal.appendChild(tr);
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
