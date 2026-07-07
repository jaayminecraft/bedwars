(async function(){
  const data = await loadData();
  const seasonal = await loadSeasonalData();

  const meta = data.meta || {};
  document.getElementById('metaLine').innerHTML = `
    Latest update:<br>
    <span class="topInfoValueLarge">${meta.latest_update || meta.latest_rotation || ''}</span>
  `;

  const els = {
    q: document.getElementById('q'),
    mode: document.getElementById('mode'),
    status: document.getElementById('status'),

    modeFilterToggle: document.getElementById('modeFilterToggle'),
    modeFilterLabel: document.getElementById('modeFilterLabel'),
    modeFilterPanel: document.getElementById('modeFilterPanel'),

    statusFilterToggle: document.getElementById('statusFilterToggle'),
    statusFilterLabel: document.getElementById('statusFilterLabel'),
    statusFilterPanel: document.getElementById('statusFilterPanel'),

    tbodyNormal: document.querySelector('#tbl-normal tbody'),
    tbodySeasonal: document.querySelector('#tbl-seasonal tbody'),
  };

  const sheetSorts = {
    normal: {
      key: 'name',
      dir: 'asc'
    },
    seasonal: {
      key: 'days',
      dir: 'asc'
    }
  };

  const SEASON_ORDER = [
    'Lunar New Year',
    'Easter',
    'Summer',
    'Halloween',
    'Winter',
  ];

  function forceEmojiPresentation(s){
    if(!s) return s;
    return String(s)
      .replace(/☀️?/g, '☀️')
      .replace(/❄️?/g, '❄️')
      .replace(/⛅️?/g, '⛅️');
  }

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

  function updateNextRotationCountdown(){
    const el = document.getElementById('nextRotationCountdown');
    if(!el) return;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const latestRotation = parseDateLoose(meta.latest_rotation || meta.latest_update);
    const siteUpdatedToday = latestRotation && latestRotation.getTime() === today.getTime();

    const day = today.getDay();

    if(day === 1 && !siteUpdatedToday){
      el.textContent = 'Today';
      return;
    }

    if(day === 0){
      el.textContent = 'Tomorrow';
      return;
    }

    let daysUntilMonday = (8 - day) % 7;
    if(daysUntilMonday === 0) daysUntilMonday = 7;

    el.textContent = `${daysUntilMonday} day${daysUntilMonday === 1 ? '' : 's'}`;
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

  function shortDate(dateStr){
    if(!dateStr) return '';

    const months = {
      January: 'Jan.',
      February: 'Feb.',
      August: 'Aug.',
      September: 'Sept.',
      October: 'Oct.',
      November: 'Nov.',
      December: 'Dec.'
    };

    for(const [longName, shortName] of Object.entries(months)){
      if(String(dateStr).startsWith(longName)){
        return String(dateStr).replace(longName, shortName);
      }
    }

    return dateStr;
  }

  function cleanValue(value){
    const raw = String(value ?? '').trim();
    const lower = raw.toLowerCase();

    if(
      !raw ||
      lower === 'unknown' ||
      lower === 'not specified' ||
      lower === 'not specified.'
    ){
      return '—';
    }

    return raw;
  }

  function cleanDate(value){
    const raw = cleanValue(value);
    return raw === '—' ? '—' : shortDate(raw);
  }

  function genBBCodeToHTML(value){
    const raw = String(value || '').trim();

    if(!raw) return '';

    return raw.replace(
      /\[COLOR=rgb\(([^)]+)\)\](.*?)\[\/COLOR\]/gi,
      '<span style="color:rgb($1)">$2</span>'
    );
  }

  const normalMaps = (data.maps || []).map(m => ({
    ...m,
    isSeasonal: false,
  }));

  const seasonalSource = Array.isArray(seasonal)
    ? seasonal
    : (seasonal.maps || []);

  const seasonalMaps = seasonalSource.map(m => {
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
      gen_html: m.gen_html || genBBCodeToHTML(m.gen),
      emoji: m.emoji || '',
    };
  });

  function modeMatches(m, selectedMode){
    if(selectedMode === 'all') return true;

    return m.mode === selectedMode;
  }

  function modeClass(mode){
    return (mode === '3s/4s') ? 'mode-34' : 'mode-sd';
  }

  function playstyleClass(ps){
    const s = (ps || '').toLowerCase();
    if(s.includes('quick')) return 'ps-quick';
    if(s.includes('long')) return 'ps-long';
    return 'ps-unknown';
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

  function releasedValForSort(m){
    const dt = parseDateLoose(m.released || '');
    if(!dt) return Number.POSITIVE_INFINITY;
    return dt.getTime();
  }

  function numSortValue(v){
    if(v === null || v === undefined || v === '') return Number.POSITIVE_INFINITY;
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  function textSortValue(v){
    return String(v || '').toLowerCase();
  }

  function genSortValue(m){
    const raw = stripBBCode(m.gen || m.gen_html || '').toLowerCase();

    if(raw.includes('slow')) return 1;
    if(raw.includes('medium')) return 2;
    if(raw.includes('fast')) return 3;

    return 999;
  }

  function sortValue(m, key){
    switch(key){

      case 'name':
        return textSortValue(m.name);

      case 'mode':
        return m.mode === '3s/4s' ? 2 : 1;

      case 'days':
        return daysValForSort(m);

      case 'playstyle':
        return textSortValue(m.playstyle);

      case 'gen':
        return genSortValue(m);

      case 'released': {
        const d = parseDateLoose(m.released);
        return d ? d.getTime() : Number.POSITIVE_INFINITY;
      }

      case 'buildMinY':
        return numSortValue(m.buildMinY);

      case 'buildMaxY':
        return numSortValue(m.buildMaxY);

      case 'buildRange':
        return numSortValue(m.buildRange);

      case 'buildRadius':
        return numSortValue(m.buildRadius);

      default:
        return textSortValue(m.name);
    }
  }

  function compareMaps(sortState){
    return function(a, b){
      const av = sortValue(a, sortState.key);
      const bv = sortValue(b, sortState.key);

      if(av < bv) return sortState.dir === 'asc' ? -1 : 1;
      if(av > bv) return sortState.dir === 'asc' ? 1 : -1;

      return byName(a, b);
    };
  }

  function stripBBCode(s){
    if(s == null) return '';
    let t = String(s);

    t = t.replace(/\[\/?[a-z0-9]+(?:=[^\]]+)?\]/gi, '');

    t = t.replace(/\[(?:color|url|img|b|i|u|s|quote|spoiler|size|center|left|right)[^\]]*\]/gi, '');

    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function modeLabel(value){
    if(value === 'Solos/Doubles') return 'Solos/Doubles';
    if(value === '3s/4s') return '3s/4s';
    return 'All Modes';
  }

  function statusLabel(value){
    if(value === 'in') return 'In rotation';
    if(value === 'out') return 'Out of rotation';
    return 'In + Out';
  }

  function closeFilterPanels(exceptPanel = null){
    [els.modeFilterPanel, els.statusFilterPanel].forEach(panel => {
      if(panel && panel !== exceptPanel){
        panel.hidden = true;
      }
    });

    if(exceptPanel !== els.modeFilterPanel){
      els.modeFilterToggle.setAttribute('aria-expanded', 'false');
    }

    if(exceptPanel !== els.statusFilterPanel){
      els.statusFilterToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function positionFilterPanel(toggle, panel){
    const controls = toggle.closest('.controls');
    const controlsRect = controls.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();

    panel.style.left = `${toggleRect.left - controlsRect.left}px`;
    panel.style.right = 'auto';
    panel.style.top = `${toggleRect.bottom - controlsRect.top + 8}px`;
  }

  function togglePanel(toggle, panel){
    const opening = panel.hidden;

    closeFilterPanels(panel);

    if(opening){
      positionFilterPanel(toggle, panel);
    }

    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
  }

  function updateFilterLabels(){
    els.modeFilterLabel.textContent = modeLabel(els.mode.value);
    els.statusFilterLabel.textContent = statusLabel(els.status.value);

    document.querySelectorAll('[data-mode-value]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modeValue === els.mode.value);
    });

    document.querySelectorAll('[data-status-value]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.statusValue === els.status.value);
    });
  }

  function updateFilterCounts(){
    const allMaps = normalMaps.concat(seasonalMaps);

    const modeCounts = {
      all: allMaps.length,
      'Solos/Doubles': allMaps.filter(m => m.mode === 'Solos/Doubles').length,
      '3s/4s': allMaps.filter(m => m.mode === '3s/4s').length
    };

    const statusCounts = {
      all: allMaps.length,
      in: allMaps.filter(m => m.status === 'in').length,
      out: allMaps.filter(m => m.status === 'out').length
    };

    Object.entries(modeCounts).forEach(([key, count]) => {
      const el = document.querySelector(`[data-mode-count="${key}"]`);
      if(el) el.textContent = count;
    });

    Object.entries(statusCounts).forEach(([key, count]) => {
      const el = document.querySelector(`[data-status-count="${key}"]`);
      if(el) el.textContent = count;
    });
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
      .sort(compareMaps(sheetSorts.normal));

    const filteredSeasonal = seasonalMaps
      .filter(matchesShared)
      .slice()
      .sort(compareMaps(sheetSorts.seasonal));


    for(const m of filteredNormal){
      const tr = document.createElement('tr');
      tr.classList.add(m.status === 'in' ? 'row-in' : 'row-out');
      const statusStrong = (m.status === 'in') ? 'status-in' : 'status-out';
      const statusSoft = (m.status === 'in') ? 'status-in-soft' : 'status-out-soft';


      const mapName = m.is_new
        ? `<span class="sheetNewPill">NEW</span> ${m.name}`
        : m.name;

      tr.appendChild(tdHtml(mapName));

      const modeLabel =
        m.mode === '3s/4s' ? '4 teams' : '8 teams';

      tr.appendChild(td(
        modeLabel,
        `nowrap cell-mode ${modeClass(m.mode)}`
      ));

      tr.appendChild(td(
        m.status === 'in' ? 'IN' : 'OUT',
        `nowrap ${statusStrong}`
      ));

      tr.appendChild(td(formatDaysLive(m), `nowrap ${statusSoft}`));

      tr.appendChild(td(cleanDate(m.effective_date || m.dateStatus || ''), statusSoft));

      tr.appendChild(td(
        cleanValue(m.playstyle),
        `cell-playstyle ${playstyleClass(m.playstyle)}`
      ));

      tr.appendChild(tdHtml(cleanValue(m.gen_html)));

      tr.appendChild(td(cleanDate(m.released || '')));

      tr.appendChild(td(cleanValue(m.buildMinY)));
      tr.appendChild(td(cleanValue(m.buildMaxY)));
      tr.appendChild(td(cleanValue(m.buildRange)));
      tr.appendChild(td(cleanValue(m.buildRadius)));

      tr.appendChild(tdHtml(m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : ''));

      tr.appendChild(td(stripBBCode(m.note || '')));

      els.tbodyNormal.appendChild(tr);
    }

    for(const m of filteredSeasonal){
      const tr = document.createElement('tr');
      tr.classList.add(m.status === 'in' ? 'row-in' : 'row-out');

      const statusStrong = (m.status === 'in') ? 'status-in' : 'status-out';
      const statusSoft = (m.status === 'in') ? 'status-in-soft' : 'status-out-soft';

      const emoji = (m.emoji || m.seasonEmoji || '').trim();
      const mapLabel = emoji ? `${emoji} ${m.name || ''}` : (m.name || '');
      tr.appendChild(td(mapLabel));

      const modeLabel =
        m.mode === '3s/4s' ? '4 teams' : '8 teams';

      tr.appendChild(td(
        modeLabel,
        `nowrap cell-mode ${modeClass(m.mode)}`
      ));

      tr.appendChild(td(
        m.status === 'in' ? 'IN' : 'OUT',
        `nowrap ${statusStrong}`
      ));

      tr.appendChild(td(formatDaysLive(m), `nowrap ${statusSoft}`));

      tr.appendChild(td(cleanDate(m.effective_date || m.dateStatus || ''), statusSoft));

      tr.appendChild(td(
        m.playstyle || '',
        `cell-playstyle ${playstyleClass(m.playstyle)}`
      ));

      tr.appendChild(tdHtml(cleanValue(m.gen_html)));

      tr.appendChild(td(cleanDate(m.released || '')));

      tr.appendChild(td(cleanValue(m.buildMinY)));
      tr.appendChild(td(cleanValue(m.buildMaxY)));
      tr.appendChild(td(cleanValue(m.buildRange)));
      tr.appendChild(td(cleanValue(m.buildRadius)));

      tr.appendChild(tdHtml(m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : ''));

      tr.appendChild(td(stripBBCode(forceEmojiPresentation(m.note || ''))));

      els.tbodySeasonal.appendChild(tr);
    }

    updateFilterLabels();
    updateFilterCounts();
    updateSortHeaders();
  }

  function updateSortHeaders(){
    document.querySelectorAll('th[data-sort]').forEach(th => {
      const table = th.closest('table');
      const tableKey = table && table.id === 'tbl-seasonal'
        ? 'seasonal'
        : 'normal';

      const sortState = sheetSorts[tableKey];
      const key = th.dataset.sort;
      const label = th.dataset.label || th.textContent.replace(/[▲▼↑↓]/g, '').trim();

      th.dataset.label = label;

      if(key === sortState.key){
        th.textContent = `${label} ${sortState.dir === 'asc' ? '↑' : '↓'}`;
        th.classList.add('sort-active');
      }else{
        th.textContent = label;
        th.classList.remove('sort-active');
      }
    });
  }

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const table = th.closest('table');
      const tableKey = table && table.id === 'tbl-seasonal'
        ? 'seasonal'
        : 'normal';

      const sortState = sheetSorts[tableKey];
      const key = th.dataset.sort;

      if(sortState.key === key){
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      }else{
        sortState.key = key;
        sortState.dir = 'asc';
      }

      render();
    });
  });

  els.q.addEventListener('input', render);

  els.modeFilterToggle.addEventListener('click', () => {
    togglePanel(els.modeFilterToggle, els.modeFilterPanel);
  });

  els.statusFilterToggle.addEventListener('click', () => {
    togglePanel(els.statusFilterToggle, els.statusFilterPanel);
  });

  document.querySelectorAll('[data-mode-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      els.mode.value = btn.dataset.modeValue;
      closeFilterPanels();
      render();
    });
  });

  document.querySelectorAll('[data-status-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      els.status.value = btn.dataset.statusValue;
      closeFilterPanels();
      render();
    });
  });

  document.querySelectorAll('.filtersClose').forEach(btn => {
    btn.addEventListener('click', () => {
      closeFilterPanels();
    });
  });

  document.addEventListener('click', e => {
    if(e.target.closest('.filterToggle') || e.target.closest('.filterPanel')) return;
    closeFilterPanels();
  });

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    closeFilterPanels();
  });

  updateNextRotationCountdown();
  setInterval(updateNextRotationCountdown, 60000);

  render();
  revealOnLoad();

})().catch(err=>{
  console.error(err);
  alert(err.message || String(err));
});
