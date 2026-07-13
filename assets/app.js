(async function(){
  const data = await loadData();
  const seasonal = await loadSeasonalData();

  const params = new URLSearchParams(location.search);
  const exportType = params.get('export') || '';
  const exportMode = exportType === '1' || exportType === 'twitter';
  const twitterExportMode = exportType === 'twitter';
  const exportMapName = params.get('map') || '';

  if(twitterExportMode){
    document.body.classList.add('twitterExportMode');
  }

  function mapImageSlug(name){
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function testImage(url){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function openImageLightbox(url, title, images=[url], startIndex=0){
    let currentIndex = Math.max(0, startIndex);

    let lightbox = document.querySelector('.imageLightbox');

    if(!lightbox){
      lightbox = document.createElement('div');
      lightbox.className = 'imageLightbox';

      lightbox.innerHTML = `
        <div class="imageLightboxPanel">
          <button class="imageLightboxClose" type="button" aria-label="Close image">×</button>

          <button class="imageLightboxArrow imageLightboxPrev" type="button" aria-label="Previous image">
            <span class="lightboxChevron lightboxChevronPrev"></span>
          </button>

          <img class="imageLightboxImg" alt="">

          <button class="imageLightboxArrow imageLightboxNext" type="button" aria-label="Next image">
            <span class="lightboxChevron lightboxChevronNext"></span>
          </button>

          <div class="imageLightboxTitle"></div>

          <div class="imageLightboxThumbs"></div>
        </div>
      `;

      document.body.appendChild(lightbox);

      lightbox.addEventListener('click', e => {
        if(e.target === lightbox || e.target.classList.contains('imageLightboxClose')){
          lightbox.classList.remove('open');
        }
      });

      document.addEventListener('keydown', e => {
        if(!lightbox.classList.contains('open')) return;

        if(e.key === 'Escape'){
          lightbox.classList.remove('open');
        }

        if(e.key === 'ArrowLeft'){
          lightbox.querySelector('.imageLightboxPrev')?.click();
        }

        if(e.key === 'ArrowRight'){
          lightbox.querySelector('.imageLightboxNext')?.click();
        }
      });
    }

    const img = lightbox.querySelector('.imageLightboxImg');
    const titleEl = lightbox.querySelector('.imageLightboxTitle');
    const prevBtn = lightbox.querySelector('.imageLightboxPrev');
    const nextBtn = lightbox.querySelector('.imageLightboxNext');

    const thumbsEl = lightbox.querySelector('.imageLightboxThumbs');

    thumbsEl.innerHTML = '';

    images.forEach((thumbUrl, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'imageLightboxThumb';
      thumb.style.backgroundImage = `url("${thumbUrl}")`;
      thumb.setAttribute('aria-label', `View image ${index + 1}`);

      thumb.addEventListener('click', e => {
        e.stopPropagation();
        showImage(index);
      });

      thumbsEl.appendChild(thumb);
    });

    function showImage(index){
      currentIndex = (index + images.length) % images.length;

      img.src = images[currentIndex];
      img.alt = title || 'Map image';

      titleEl.textContent = images.length > 1
        ? `${title || 'Map image'} (${currentIndex + 1}/${images.length})`
        : title || '';

      prevBtn.style.display = images.length > 1 ? '' : 'none';
      nextBtn.style.display = images.length > 1 ? '' : 'none';

      thumbsEl.querySelectorAll('.imageLightboxThumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentIndex);
      });

      thumbsEl.style.display = images.length > 1 ? 'flex' : 'none';
    }

    prevBtn.onclick = e => {
      e.stopPropagation();
      showImage(currentIndex - 1);
    };

    nextBtn.onclick = e => {
      e.stopPropagation();
      showImage(currentIndex + 1);
    };

    showImage(currentIndex);
    lightbox.classList.add('open');
  }

  async function getMapGalleryImages(m){
    const slug = mapImageSlug(m.name);
    const base = `assets/map-images/${slug}`;
    const found = [];

    for(let i = 1; i <= 7; i++){
      const img = await testImage(`${base}/${i}.webp`);
      if(img) found.push(img);
    }

    return found;
  }

  const seasonalSource = Array.isArray(seasonal)
    ? seasonal
    : (seasonal.maps || []);

  const seasonalMaps = seasonalSource.map(m => {
    const seasonLabel = detectSeasonLabel(m);

    const image_url = `assets/map-images/${mapImageSlug(stripLeadingEmoji(m.name || ''))}/main.webp`;
    const effective_date = m.effective_date || m.dateStatus || m.last_seen || 'Unknown';
    const gen_html = m.gen_html || genBBCodeToHTML(m.gen);

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
      gen_html,
      wiki: m.wiki || ''
    };
  });


  const maps = ([(data.maps || []), seasonalMaps].flat()).slice();

  let focusNames = null;

  const meta = data.meta || {};
  const metaLine = document.getElementById('metaLine');
  if(metaLine){
    metaLine.innerHTML = `
      Latest update:<br>
      <span class="topInfoValueLarge">${meta.latest_update}</span>
    `;
  }

  function normalizedPlaystyleValue(m){
    const value = String(m.playstyle || '').trim();
    const lower = value.toLowerCase();

    if(!value || lower === 'unknown' || lower === 'not specified' || lower === 'not specified.'){
      return 'Unknown';
    }

    return value;
  }

  const playstyles = uniq(
    maps.map(normalizedPlaystyleValue)
  );

  const playstyleFilters = document.getElementById('playstyleFilters');

  for(const p of playstyles){
    playstyleFilters.insertAdjacentHTML('beforeend', `
      <button class="filterMenuChoice" type="button" data-playstyle-value="${escapeHTML(p)}">
        <span>${escapeHTML(p)}</span>
        <span class="filterOptionCount" data-playstyle-count="${escapeHTML(p)}">0</span>
      </button>
    `);
  }

  playstyleFilters.insertAdjacentHTML('afterbegin', `
    <button class="filterMenuChoice" type="button" data-playstyle-value="all">
      <span>All Playstyles</span>
      <span class="filterOptionCount" data-playstyle-count="all">0</span>
    </button>
  `);

  const els = {
    q: document.getElementById('q'),
    sort: document.getElementById('sort'),
    mode: document.getElementById('mode'),
    status: document.getElementById('status'),

    modeFilterToggle: document.getElementById('modeFilterToggle'),
    modeFilterLabel: document.getElementById('modeFilterLabel'),
    modeFilterPanel: document.getElementById('modeFilterPanel'),

    statusFilterToggle: document.getElementById('statusFilterToggle'),
    statusFilterLabel: document.getElementById('statusFilterLabel'),
    statusFilterPanel: document.getElementById('statusFilterPanel'),

    playstyleFilterToggle: document.getElementById('playstyleFilterToggle'),
    playstyleFilterLabel: document.getElementById('playstyleFilterLabel'),
    playstyleFilterPanel: document.getElementById('playstyleFilterPanel'),

    genFilterToggle: document.getElementById('genFilterToggle'),
    genFilterLabel: document.getElementById('genFilterLabel'),
    genFilterPanel: document.getElementById('genFilterPanel'),

    hideSummariesToggle: document.getElementById('hideSummariesToggle'),
    rotationOverview: document.querySelector('.rotationOverview'),
    settingsFilterToggle: document.getElementById('settingsFilterToggle'),
    settingsFilterLabel: document.getElementById('settingsFilterLabel'),
    settingsFilterPanel: document.getElementById('settingsFilterPanel'),
    activeFilters: document.getElementById('activeFilters'),

    map_list: document.getElementById('map-list'),
    mapListTitle: document.getElementById('mapListTitle'),
    mapCountLabel: document.getElementById('mapCountLabel'),

    rotation_overview: document.getElementById('rotation-overview'),
    latestRotationDate: document.getElementById('latestRotationDate'),
    latestEnteringCount: document.getElementById('latestEnteringCount'),
    latestLeavingCount: document.getElementById('latestLeavingCount'),
    latestEnteringList: document.getElementById('latestEnteringList'),
    latestLeavingList: document.getElementById('latestLeavingList'),
    viewLatestRotation: document.getElementById('viewLatestRotation'),

    eventPanel: document.getElementById('eventPanel'),
    eventPanelTitle: document.getElementById('eventPanelTitle'),
    eventPanelStatus: document.getElementById('eventPanelStatus'),
    eventPanelBody: document.getElementById('eventPanelBody'),
    viewEventMaps: document.getElementById('viewEventMaps'),

    mapSummaryPanel: document.getElementById('mapSummaryPanel'),
    mapSummaryBody: document.getElementById('mapSummaryBody'),

    nextRotationCountdown: document.getElementById('nextRotationCountdown'),
  };

  const filterOptionEls = {
    filterGroup: [...document.querySelectorAll('[data-filter-group]')],
    modeValue: [...document.querySelectorAll('[data-mode-value]')],
    statusValue: [...document.querySelectorAll('[data-status-value]')],
    playstyleValue: [...document.querySelectorAll('[data-playstyle-value]')],
    genValue: [...document.querySelectorAll('[data-gen-value]')],
    modeCount: [...document.querySelectorAll('[data-mode-count]')],
    statusCount: [...document.querySelectorAll('[data-status-count]')],
    playstyleCount: [...document.querySelectorAll('[data-playstyle-count]')],
    genCount: [...document.querySelectorAll('[data-gen-count]')],
  };

  function setSearchUrl(value){
    const url = new URL(window.location.href);
    const clean = String(value || '').trim();

    if(clean){
      url.searchParams.set('q', clean);
    }else{
      url.searchParams.delete('q');
    }

    if(els?.mode?.value === 'seasonal'){
      url.searchParams.set('mode', 'seasonal');
    }else if(els?.mode?.value === 'Solos/Doubles' || els?.mode?.value === '3s/4s'){
      url.searchParams.set('mode', els.mode.value);
    }else{
      url.searchParams.delete('mode');
    }

    history.replaceState(null, '', url);
  }

  function applySummaryVisibility(){
    if(!els.rotation_overview || !els.hideSummariesToggle) return;

    const hidden = els.hideSummariesToggle.checked;

    els.rotation_overview.hidden = hidden;
    els.rotation_overview.style.display = hidden ? 'none' : '';
    localStorage.setItem('hideSummaries', hidden ? '1' : '0');
  }

  function loadSummaryVisibility(){
    if(!els.hideSummariesToggle) return;

    const saved = localStorage.getItem('hideSummaries');
    const isMobile = window.matchMedia('(max-width: 640px)').matches;

    els.hideSummariesToggle.checked = saved === null
      ? isMobile
      : saved === '1';

    applySummaryVisibility();
  }

  function loadSearchFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const mode = params.get('mode');

    if(q){
      els.q.value = q;
    }

    if(mode){
      if(mode === 'seasonal'){
        els.mode.value = 'seasonal';

        getFilterBoxes('mapType').forEach(box => {
          if(box.value === 'seasonal'){
            box.checked = true;
          }
        });

        readFiltersFromUI();
      }else if(mode === 'Solos/Doubles' || mode === '3s/4s'){
        els.mode.value = mode;
      }
    }
  }

  function searchAliasMaps(value){
    const q = String(value || '').trim().toLowerCase();

    if(q === 'latest rotation'){
      const normalMaps = maps.filter(m => !m.isSeasonal);
      const latestDateValue = newestRotationDate(normalMaps);
      return mapsOnDate(normalMaps, latestDateValue);
    }

    if(q === 'new maps'){
      return maps.filter(m => m.is_new);
    }

    const seasonAliases = {
      'lunar maps': 'lunar',
      'easter maps': 'easter',
      'summer maps': 'summer',
      'halloween maps': 'halloween',
      'winter maps': 'winter'
    };

    if(seasonAliases[q]){
      return maps.filter(m =>
        m.isSeasonal &&
        m.status === 'in' &&
        String(m.seasonLabel || '').toLowerCase().includes(seasonAliases[q])
      );
    }

    return null;
  }

  function isSearchAlias(value){
    const q = String(value || '').trim().toLowerCase();

    return [
      'latest rotation',
      'new maps',
      'easter maps',
      'summer maps',
      'halloween maps',
      'winter maps'
    ].includes(q);
  }

  function generatorTags(m){
    const raw = String(m.gen_html || m.gen || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    const tags = new Set();

    if(raw.includes('slow')) tags.add('slow');
    if(raw.includes('medium')) tags.add('medium');
    if(raw.includes('fast')) tags.add('fast');

    return tags;
  }

  const generatorOptions = ['slow', 'medium', 'fast'];

  if(maps.some(m => generatorTags(m).size === 0)){
    generatorOptions.push('unknown');
  }

  const filterDefaults = {
    mode: ['Solos/Doubles', '3s/4s'],
    mapType: ['normal', 'seasonal'],
    status: ['in', 'out'],
    playstyle: playstyles.slice(),
    generator: generatorOptions.slice()
  };

  const filterState = {
    mode: new Set(filterDefaults.mode),
    mapType: new Set(filterDefaults.mapType),
    status: new Set(filterDefaults.status),
    playstyle: new Set(filterDefaults.playstyle),
    generator: new Set(filterDefaults.generator)
  };

  if(generatorOptions.includes('unknown')){
    const genFilterBody = document.querySelector('#genFilterPanel .quickFilterBody');

    genFilterBody.insertAdjacentHTML('beforeend', `
      <button class="filterMenuChoice" type="button" data-gen-value="unknown">
        <span>Unknown</span>
        <span class="filterOptionCount" data-gen-count="unknown">0</span>
      </button>
    `);
  }

  function getFilterBoxes(group){
    return Array.from(document.querySelectorAll(`[data-filter-group="${group}"]`));
  }

  function readFiltersFromUI(){
    filterState.mapType = new Set(
      getFilterBoxes('mapType')
        .filter(box => box.checked)
        .map(box => box.value)
    );
  }

  function resetFilters(){
    els.mode.value = 'all';
    els.status.value = 'all';

    filterState.playstyle = new Set(filterDefaults.playstyle);
    filterState.generator = new Set(filterDefaults.generator);

    getFilterBoxes('mapType').forEach(box => {
      box.checked = filterDefaults.mapType.includes(box.value);
    });

    readFiltersFromUI();
    updateFilterUI();
  }

  function isGroupFiltered(group){
    return filterState[group].size !== filterDefaults[group].length;
  }

  function activeFilterCount(){
    let count = ['mapType', 'playstyle', 'generator'].filter(isGroupFiltered).length;

    if(els.mode.value !== 'all') count++;
    if(els.status.value !== 'all') count++;

    return count;
  }

  function hasAny(setA, setB){
    for(const value of setA){
      if(setB.has(value)) return true;
    }

    return false;
  }

  function filterLabel(group, value){
    if(group === 'mode'){
      const labels = {
        all: 'All Modes',
        'Solos/Doubles': 'Solos/Doubles',
        '3s/4s': '3s/4s',
        seasonal: 'Seasonal'
      };

      return labels[value] || value;
    }

    if(group === 'status'){
      const labels = {
        all: 'In + Out',
        in: 'In rotation',
        out: 'Out of rotation'
      };

      return labels[value] || value;
    }

    if(group === 'generator'){
      const labels = {
        slow: 'Slow Iron',
        medium: 'Medium Iron',
        fast: 'Fast Iron',
        unknown: 'Unknown'
      };

      return labels[value] || value;
    }

    if(group === 'mapType'){
      return value === 'seasonal' ? 'Active seasonal maps' : 'Normal maps';
    }

    return value;
  }

  function updateFilterCounts(){
    filterOptionEls.filterGroup.forEach(box => {
      const label = box.closest('.filterCheck');
      if(!label) return;

      let countEl = label.querySelector('.filterOptionCount');

      if(!countEl){
        countEl = document.createElement('span');
        countEl.className = 'filterOptionCount';
        label.appendChild(countEl);
      }

      countEl.textContent = countForFilterOption(box.dataset.filterGroup, box.value);
    });
  }

  function countForFilterOption(group, value){
    if(group === 'mapType' && value === 'seasonal'){
      return maps.filter(m => m.isSeasonal && m.status === 'in').length;
    }

    const testState = {};

    for(const key of Object.keys(filterState)){
      testState[key] = new Set(filterState[key]);
    }

    testState[group] = new Set([value]);

    return maps.filter(m => matchesWithState(m, testState)).length;
  }

  function matchesWithState(m, state){
    const aliasMaps = searchAliasMaps(els.q.value);

    if(exportMode && exportMapName){
      return String(m.name || '').toLowerCase() === String(exportMapName || '').toLowerCase();
    }

    const q = (focusNames || aliasMaps) ? '' : norm(els.q.value);
    const mapTypeValue = m.isSeasonal ? 'seasonal' : 'normal';
    const modeFilter = els.mode.value;
    const statusFilter = els.status.value;

    if(modeFilter === 'seasonal' && !m.isSeasonal) return false;
    if(modeFilter !== 'all' && modeFilter !== 'seasonal' && m.mode !== modeFilter) return false;

    if(modeFilter !== 'seasonal' && m.isSeasonal){
      if(m.status !== 'in') return false;
      if(!state.mapType.has('seasonal')) return false;
    }

    if(statusFilter !== 'all' && m.status !== statusFilter) return false;

    const playstyleValue = normalizedPlaystyleValue(m);

    if(
      state.playstyle.size &&
      state.playstyle.size !== filterDefaults.playstyle.length &&
      !state.playstyle.has(playstyleValue)
    ){
      return false;
    }

    const genTags = generatorTags(m);

    if(
      state.generator.size &&
      state.generator.size !== filterDefaults.generator.length
    ){
      if(state.generator.has('unknown')){
        if(genTags.size) return false;
      }else{
        if(!genTags.size) return false;
        if(!hasAny(genTags, state.generator)) return false;
      }
    }

    if(q){
      const blob = `${m.name} ${m.note || ''}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }

    if(aliasMaps && !aliasMaps.some(x => x.name === m.name)) return false;
    if(focusNames && !focusNames.has(m.name)) return false;

    return true;
  }

  function countWithMode(value){
    const oldValue = els.mode.value;
    els.mode.value = value;

    const count = maps.filter(matches).length;

    els.mode.value = oldValue;
    return count;
  }

  function countWithStatus(value){
    const oldValue = els.status.value;
    els.status.value = value;

    const count = maps.filter(matches).length;

    els.status.value = oldValue;
    return count;
  }

  function countWithPlaystyle(value){
    const oldState = new Set(filterState.playstyle);

    filterState.playstyle = value === 'all'
      ? new Set(filterDefaults.playstyle)
      : new Set([value]);

    const count = maps.filter(matches).length;

    filterState.playstyle = oldState;
    return count;
  }

  function countWithGen(value){
    const oldState = new Set(filterState.generator);

    filterState.generator = value === 'all'
      ? new Set(filterDefaults.generator)
      : new Set([value]);

    const count = maps.filter(matches).length;

    filterState.generator = oldState;
    return count;
  }

  function visibleMapCount(){
    return maps.filter(matches).length;
  }

  function updateMenuChoiceState(){
    filterOptionEls.modeValue.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modeValue === els.mode.value);
    });

    filterOptionEls.statusValue.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.statusValue === els.status.value);
    });
  }

  function updateToolbarCounts(){
    els.modeFilterLabel.textContent = filterLabel('mode', els.mode.value);
    els.statusFilterLabel.textContent = filterLabel('status', els.status.value);

    filterOptionEls.modeCount.forEach(el => {
      el.textContent = countWithMode(el.dataset.modeCount);
    });

    filterOptionEls.statusCount.forEach(el => {
      el.textContent = countWithStatus(el.dataset.statusCount);
    });

    filterOptionEls.playstyleCount.forEach(el => {
      el.textContent = countWithPlaystyle(el.dataset.playstyleCount);
    });

    filterOptionEls.genCount.forEach(el => {
      el.textContent = countWithGen(el.dataset.genCount);
    });

    filterOptionEls.playstyleValue.forEach(btn => {
      const value = btn.dataset.playstyleValue;
      const active = value === 'all'
        ? !isGroupFiltered('playstyle')
        : filterState.playstyle.size === 1 && filterState.playstyle.has(value);

      btn.classList.toggle('active', active);
    });

    filterOptionEls.genValue.forEach(btn => {
      const value = btn.dataset.genValue;
      const active = value === 'all'
        ? !isGroupFiltered('generator')
        : filterState.generator.size === 1 && filterState.generator.has(value);

      btn.classList.toggle('active', active);
    });

    updateMenuChoiceState();
  }

  function activeFilterIconClass(group){
    const icons = {
      mode: 'filterGroupIcon-mode',
      status: 'filterGroupIcon-status',
      playstyle: 'filterGroupIcon-playstyle',
      generator: 'filterGroupIcon-gen',
      mapType: 'filterGroupIcon-settings'
    };

    return icons[group] || '';
  }

  function activeFilterChipHTML(group, label){
    return `
      <span class="activeFilterChipIcon filterGroupIcon ${activeFilterIconClass(group)}" aria-hidden="true"></span>
      <span>${label}</span>
      <span>×</span>
    `;
  }

  function updateFilterUI(){
    const count = activeFilterCount();

    els.playstyleFilterLabel.textContent =
      filterState.playstyle.size === 1
        ? Array.from(filterState.playstyle)[0]
        : 'Playstyle';

    if(filterState.generator.size === 1){
      const value = Array.from(filterState.generator)[0];

      els.genFilterLabel.textContent =
        value.charAt(0).toUpperCase() + value.slice(1);
    }else{
      els.genFilterLabel.textContent = 'Gen Speed';
    }

    els.settingsFilterLabel.textContent = isGroupFiltered('mapType')
      ? 'Settings (1)'
      : 'Settings';

    els.activeFilters.innerHTML = '';

    if(els.mode.value !== 'all'){
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'activeFilterChip';
      chip.dataset.filterGroup = 'mode';
      chip.dataset.filterValue = els.mode.value;
      chip.innerHTML = activeFilterChipHTML('mode', filterLabel('mode', els.mode.value));
      els.activeFilters.appendChild(chip);
    }

    if(els.status.value !== 'all'){
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'activeFilterChip';
      chip.dataset.filterGroup = 'status';
      chip.dataset.filterValue = els.status.value;
      chip.innerHTML = activeFilterChipHTML('status', filterLabel('status', els.status.value));
      els.activeFilters.appendChild(chip);
    }

    for(const group of ['mapType', 'playstyle', 'generator']){
      if(!isGroupFiltered(group)) continue;

      if(group === 'mapType'){
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'activeFilterChip';
        chip.dataset.filterGroup = 'mapType';
        chip.dataset.filterValue = 'seasonal';
        chip.innerHTML = activeFilterChipHTML('mapType', 'Excluding seasonal maps');
        els.activeFilters.appendChild(chip);
        continue;
      }

      for(const value of filterState[group]){
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'activeFilterChip';
        chip.dataset.filterGroup = group;
        chip.dataset.filterValue = value;
        chip.innerHTML = activeFilterChipHTML(group, filterLabel(group, value));
        els.activeFilters.appendChild(chip);
      }
    }

    els.activeFilters.hidden = !els.activeFilters.children.length;

    updateFilterCounts();
    updateToolbarCounts();
  }

  function matches(m){
    const aliasMaps = searchAliasMaps(els.q.value);

    if(exportMode && exportMapName){
      return String(m.name || '').toLowerCase() === String(exportMapName || '').toLowerCase();
    }

    const q = (focusNames || aliasMaps) ? '' : norm(els.q.value);
    const modeValue = m.isSeasonal ? 'Seasonal' : m.mode;
    const mapTypeValue = m.isSeasonal ? 'seasonal' : 'normal';
    const modeFilter = els.mode.value;
    const statusFilter = els.status.value;

    if(modeFilter === 'seasonal' && !m.isSeasonal) return false;
    if(modeFilter !== 'all' && modeFilter !== 'seasonal' && m.mode !== modeFilter) return false;

    if(modeFilter !== 'seasonal' && m.isSeasonal){
      if(m.status !== 'in') return false;
      if(!filterState.mapType.has('seasonal')) return false;
    }

    if(statusFilter !== 'all' && m.status !== statusFilter) return false;

   const playstyleValue = normalizedPlaystyleValue(m);

   if(
     filterState.playstyle.size &&
     filterState.playstyle.size !== filterDefaults.playstyle.length &&
     !filterState.playstyle.has(playstyleValue)
   ){
     return false;
   }

    const genTags = generatorTags(m);

    if(
      filterState.generator.size &&
      filterState.generator.size !== filterDefaults.generator.length
    ){
      if(filterState.generator.has('unknown')){
        if(genTags.size) return false;
      }else{
        if(!genTags.size) return false;
        if(!hasAny(genTags, filterState.generator)) return false;
      }
    }

    if(q){
      const blob = `${m.name} ${m.note || ''}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }

    if(aliasMaps && !aliasMaps.some(x => x.name === m.name)) return false;
    if(focusNames && !focusNames.has(m.name)) return false;

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

  function mapShareText(m){
    const action = m.status === 'in'
      ? 'entered'
      : 'left';

    const days = Number(formatDaysLive(m));

    let daysText;

    if(!Number.isFinite(days) || days === 0){
      daysText = 'TODAY';
    }else if(days === 1){
      daysText = '1 day ago';
    }else{
      daysText = `${days} days ago`;
    }

    const dateText = shortDateNoYear(m.effective_date);

    return `${m.name} ${action} rotation ${daysText} on ${dateText}! #hypixel #bedwars`;
  }

  function shortDateNoYear(dateStr){
    if(!dateStr) return 'Unknown';

    return String(dateStr).replace(/,\s*\d{4}$/, '');
  }

  function mapStaticPageUrl(m){
    const base =
      window.location.origin +
      window.location.pathname.replace(/\/[^/]*$/, '/');

    const url = new URL(base, window.location.origin);
    url.searchParams.set('q', m.name || '');

    if(m.isSeasonal){
      url.searchParams.set('mode', 'seasonal');
    }else if(m.mode === 'Solos/Doubles' || m.mode === '3s/4s'){
      url.searchParams.set('mode', m.mode);
    }

    return url.toString();
  }

  function mapShareCardUrl(m){
    const base =
      window.location.origin +
      window.location.pathname.replace(/\/[^/]*$/, '/');

    return `${base}assets/share-cards/${mapImageSlug(m.name)}.png`;
  }

  function shareOptionHTML(iconClass, label){
    return `<span class="shareIcon ${iconClass}"></span><span>${label}</span>`;
  }

  function mapHypixelBBCode(m){
    return `[IMG]${mapShareCardUrl(m)}[/IMG]

  ${mapShareText(m)}

  ${mapStaticPageUrl(m)}`;
  }

  async function createMapCardFile(card, m){
    if(typeof html2canvas === 'undefined'){
      alert('Download tool failed to load. Please refresh and try again.');
      return null;
    }

    const clone = card.cloneNode(true);
    clone.open = true;
    clone.classList.add('shareExportCard');

    clone.querySelectorAll('.mapShareRow').forEach(el => el.remove());

    const exportIconSVG = {
      'kvIcon-mode': `<svg viewBox="0 0 100 100" width="22" height="22"><path fill="#38bdf8" d="M84.267,73.664l-37.61-37.611c13.616-12.724,23.23-17.65,23.23-17.65c-4.153-1.428-8.604-2.213-13.242-2.213c-8.467,0-16.33,2.585-22.845,7.006l-4.686-4.686c-0.839-0.838-1.954-1.299-3.139-1.299c-1.186,0-2.3,0.461-3.14,1.3l-4.605,4.605c-1.729,1.731-1.729,4.547,0.001,6.278l4.685,4.685c0.001-0.001,0.002-0.002,0.003-0.004c-4.423,6.516-7.009,14.38-7.009,22.849c0,4.638,0.786,9.089,2.213,13.242c0,0,6.024-10.222,17.736-23.144l37.525,37.525c0.839,0.838,1.954,1.299,3.139,1.299c1.186,0,2.3-0.461,3.14-1.3l4.605-4.605C85.998,78.211,85.998,75.396,84.267,73.664z M25.975,23.856l3.094,3.094c-0.833,0.766-1.632,1.566-2.398,2.398l-3.094-3.093L25.975,23.856z M53.416,22.339c-4.407,3.452-9.654,7.972-15.413,13.73c-6.638,6.638-11.972,12.932-15.985,18.097C23.344,37.364,36.677,23.889,53.416,22.339z M76.523,79.202L39.961,42.64c0.745-0.771,1.502-1.546,2.284-2.328c0.031-0.031,0.062-0.061,0.093-0.092l36.583,36.583L76.523,79.202z"/></svg>`,
      'kvIcon-generator': `<svg viewBox="10 10 70 70" width="22" height="22" fill="none"><polygon stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" points="37.434,71.468 18.607,61.999 18.607,46.971 37.434,56.44 72.107,38.001 72.107,53.029"/><polygon stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" points="37.434,56.44 18.607,46.971 53.607,28.532 72.107,38.001"/><line stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" x1="37.434" y1="71.468" x2="37.434" y2="56.44"/></svg>`,
      'sectionIcon-map': `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#4ade80" stroke-width="2.4"/><path d="M12 10.5v6" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.35" fill="#4ade80"/></svg>`,
      'sectionIcon-build': `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c084fc" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5 8 4.5v8l-8 4.5-8-4.5v-8l8-4.5Z"/><path d="M12 12 4 8"/><path d="m12 12 8-4"/><path d="M12 12v8.5"/></svg>`
    };

    clone.querySelectorAll('.kvIcon-mode, .kvIcon-generator, .sectionIcon-map, .sectionIcon-build').forEach(icon => {
      const replacement = document.createElement('span');
      replacement.className = icon.className;
      replacement.style.display = 'inline-flex';
      replacement.style.alignItems = 'center';
      replacement.style.justifyContent = 'center';
      replacement.style.width = '22px';
      replacement.style.height = '22px';
      replacement.style.minWidth = '22px';
      replacement.style.minHeight = '22px';
      replacement.style.background = 'none';
      replacement.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,.45))';

      const iconClass = Object.keys(exportIconSVG).find(cls => icon.classList.contains(cls));
      replacement.innerHTML = exportIconSVG[iconClass];

      icon.replaceWith(replacement);
    });

    clone.querySelectorAll('.kv').forEach(row => {
      const label = row.querySelector('.k');
      if(label && label.textContent.trim() === 'Links'){
        row.remove();
      }
    });

    const watermark = document.createElement('div');
    watermark.className = 'shareExportWatermark';

    const generatedDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    watermark.textContent =
      `Generated on ${generatedDate} with Jaay's Bed Wars Map List • https://jaaymc.com/bedwars`;

    clone.appendChild(watermark);

    const hero = clone.querySelector('.mapHero');
    const bg = `assets/map-images/${mapImageSlug(m.name)}/main.webp`;

    if(hero){
      const bgDataUrl = await new Promise(resolve => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          resolve(canvas.toDataURL('image/webp'));
        };

        img.onerror = () => resolve('');
        img.src = bg;
      });

      if(bgDataUrl){
        hero.style.setProperty('--export-bg', `url("${bgDataUrl}")`);
        hero.style.backgroundImage = `url("${bgDataUrl}")`;
      }
    }

    const holder = document.createElement('div');
    holder.className = 'shareExportHolder';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    await new Promise(resolve => setTimeout(resolve, 120));

    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      width: clone.offsetWidth,
      height: clone.offsetHeight,
      windowWidth: 900
    });

    holder.remove();

    const fileName = String(m.name || 'bed-wars-map')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    if(!blob) return null;

    return new File([blob], `${fileName}-bedwars-map.png`, {
      type: 'image/png'
    });
  }

  async function downloadMapCard(card, m){
    const file = await createMapCardFile(card, m);
    if(!file) return;

    const link = document.createElement('a');
    link.download = file.name;
    link.href = URL.createObjectURL(file);
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  function shortGenLabel(m){
    const raw = String(m.gen_html || m.gen || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tags = [];

    if(/slow/i.test(raw)) tags.push('Slow');
    if(/medium/i.test(raw)) tags.push('Medium');
    if(/fast/i.test(raw)) tags.push('Fast');

    return tags.length ? tags.join('/') + ' Iron' : raw;
  }

  function buildRushGuide(m, detailsGrid){
    if(!m.rush || exportMode) return;

    const rushRoutes = Array.isArray(m.rush.routes)
      ? m.rush.routes.filter(r => Array.isArray(r.points) && r.points.length >= 2)
      : [];

    if(!rushRoutes.length) return;

    const primaryType = m.rush.primary || 'Side';

    const sortedRushRoutes = [...rushRoutes].sort((a, b) => {
      if(a.type === primaryType) return -1;
      if(b.type === primaryType) return 1;

      const ab = Number.isFinite(Number(a.blocks)) ? Number(a.blocks) : 9999;
      const bb = Number.isFinite(Number(b.blocks)) ? Number(b.blocks) : 9999;
      return ab - bb;
    });

    const primaryRoute = sortedRushRoutes.find(r => r.type === primaryType) || sortedRushRoutes[0];
    const otherRoutes = sortedRushRoutes.filter(r => r !== primaryRoute);

    function routeLabel(type){
      if(type === 'Diamonds') return 'Through Diamonds';
      if(type === 'Mid') return 'Through Mid';
      return type || 'Route';
    }

    function routeColor(type){
      if(type === 'Side') return '#ff4b4b';
      if(type === 'Long Side') return '#ff8a3d';
      if(type === 'Diagonal') return '#d946ef';
      if(type === 'Diamonds') return '#4aa3ff';
      if(type === 'Mid') return '#7bd957';
      return '#ffffff';
    }

    const rushWrap = document.createElement('div');
    rushWrap.className = 'rushGuideWrap rushGuideWrap-compact';

    const rushPanel = document.createElement('div');
    rushPanel.className = 'rushGuidePanel rushGuidePanel-compact';

    const crop = m.rush.crop || {};
    const cropLeft = Math.max(0, Math.min(45, Number(crop.left) || 0));
    const cropTop = Math.max(0, Math.min(45, Number(crop.top) || 0));
    const cropRight = Math.max(0, Math.min(45, Number(crop.right) || 0));
    const cropBottom = Math.max(0, Math.min(45, Number(crop.bottom) || 0));
    const cropW = Math.max(1, 100 - cropLeft - cropRight);
    const cropH = Math.max(1, 100 - cropTop - cropBottom);

    function croppedPct(pt){
      return {
        x: ((Number(pt.x) - cropLeft) / cropW) * 100,
        y: ((Number(pt.y) - cropTop) / cropH) * 100
      };
    }
    const rushMap = document.createElement('div');
    rushMap.className = 'rushMiniMap rushMiniMap-compact';

    const rushImg = document.createElement('img');
    rushImg.className = 'rushMiniMapImg';
    rushImg.src = `assets/map-images/${mapImageSlug(m.name)}/${m.rush.image || '1.webp'}`;
    rushImg.alt = `${m.name || 'Map'} rush diagram`;
    rushImg.style.width = `${10000 / cropW}%`;
    rushImg.style.height = `${10000 / cropH}%`;
    rushImg.style.left = `${-(cropLeft / cropW) * 100}%`;
    rushImg.style.top = `${-(cropTop / cropH) * 100}%`;
    rushImg.style.objectFit = 'fill';

    rushMap.style.aspectRatio = `${cropW * 16} / ${cropH * 9}`;

    const rushSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rushSvg.setAttribute('viewBox', `${cropLeft} ${cropTop} ${cropW} ${cropH}`);
    rushSvg.setAttribute('preserveAspectRatio', 'none');
    rushSvg.classList.add('rushMiniSvg');

    sortedRushRoutes.forEach((route, index) => {
      const points = (route.points || [])
        .map(p => ({ x:Number(p.x), y:Number(p.y) }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

      if(points.length < 2) return;

      const color = routeColor(route.type);
      const end = points[points.length - 1];
      const beforeEnd = points[points.length - 2];

      const xScale = 16 / 9;
      const yScale = 1;

      const dxScreen = (end.x - beforeEnd.x) * xScale;
      const dyScreen = (end.y - beforeEnd.y) * yScale;
      const lenScreen = Math.hypot(dxScreen, dyScreen) || 1;

      const uxScreen = dxScreen / lenScreen;
      const uyScreen = dyScreen / lenScreen;

      const arrowLength = 4.2;
      const arrowHalfWidth = 1.6;

      const endScreen = {
        x:end.x * xScale,
        y:end.y * yScale
      };

      const lineEndScreen = {
        x:endScreen.x - uxScreen * arrowLength,
        y:endScreen.y - uyScreen * arrowLength
      };

      const lineEnd = {
        x:lineEndScreen.x / xScale,
        y:lineEndScreen.y / yScale
      };

      const visiblePoints = [
        ...points.slice(0, -1),
        lineEnd
      ];

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', visiblePoints.map(p => `${p.x},${p.y}`).join(' '));
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', color);
      polyline.setAttribute('stroke-width', index === 0 ? '2' : '1.5');
      polyline.setAttribute('stroke-linecap', 'round');
      polyline.setAttribute('stroke-linejoin', 'round');
      polyline.classList.add(index === 0 ? 'rushPrimaryLine' : 'rushAltLine');
      rushSvg.appendChild(polyline);

      const leftBaseScreen = {
        x:lineEndScreen.x + (-uyScreen * arrowHalfWidth),
        y:lineEndScreen.y + (uxScreen * arrowHalfWidth)
      };

      const rightBaseScreen = {
        x:lineEndScreen.x - (-uyScreen * arrowHalfWidth),
        y:lineEndScreen.y - (uxScreen * arrowHalfWidth)
      };

      const leftBase = {
        x:leftBaseScreen.x / xScale,
        y:leftBaseScreen.y / yScale
      };

      const rightBase = {
        x:rightBaseScreen.x / xScale,
        y:rightBaseScreen.y / yScale
      };

      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute(
        'points',
        `${end.x},${end.y} ${leftBase.x},${leftBase.y} ${rightBase.x},${rightBase.y}`
      );
      arrow.setAttribute('fill', color);
      arrow.classList.add(index === 0 ? 'rushPrimaryArrow' : 'rushAltArrow');
      rushSvg.appendChild(arrow);
    });

    rushMap.appendChild(rushSvg);
    rushMap.appendChild(rushImg);

    if(m.rush.you){
      const youPos = croppedPct(m.rush.you);

      const youDot = document.createElement('div');
      youDot.className = 'rushYouDotHtml';
      youDot.style.left = `${youPos.x}%`;
      youDot.style.top = `${youPos.y}%`;
      rushMap.appendChild(youDot);

      const youLabel = document.createElement('div');
      youLabel.className = 'rushYouLabel';
      youLabel.textContent = 'YOU';
      youLabel.style.left = `${youPos.x}%`;
      youLabel.style.top = `${youPos.y}%`;
      rushMap.appendChild(youLabel);
    }

    rushMap.tabIndex = 0;
    rushMap.setAttribute('role', 'button');
    rushMap.setAttribute('aria-label', `Open ${m.name || 'map'} rush diagram`);

    rushMap.addEventListener('click', e => {
      e.stopPropagation();

      let modal = document.querySelector('.rushDiagramModal');

      if(!modal){
        modal = document.createElement('div');
        modal.className = 'rushDiagramModal';
        modal.innerHTML = `
          <div class="rushDiagramModalPanel">
            <button class="rushDiagramModalClose" type="button" aria-label="Close diagram">×</button>
            <div class="rushDiagramModalTitle"></div>
            <div class="rushDiagramModalStage"></div>
          </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', ev => {
          if(ev.target === modal || ev.target.classList.contains('rushDiagramModalClose')){
            modal.classList.remove('open');
          }
        });

        document.addEventListener('keydown', ev => {
          if(ev.key !== 'Escape') return;
          if(!modal.classList.contains('open')) return;

          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();

          modal.classList.remove('open');
        }, true);
      }

      modal.querySelector('.rushDiagramModalTitle').textContent = `${m.name || 'Map'} Rush Guide`;

      const stage = modal.querySelector('.rushDiagramModalStage');
      stage.innerHTML = '';

      const clone = rushMap.cloneNode(true);
      clone.classList.add('rushDiagramModalMap');
      clone.classList.remove('rushMiniMap-compact');
      clone.removeAttribute('tabindex');
      clone.removeAttribute('role');
      clone.removeAttribute('aria-label');
      clone.style.cursor = 'default';

      clone.addEventListener('click', ev => {
        ev.stopPropagation();
      });

      stage.appendChild(clone);
      modal.classList.add('open');

      const ratio = (cropW * 16) / (cropH * 9);
      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      let fitW = stageW;
      let fitH = fitW / ratio;
      if(fitH > stageH){
        fitH = stageH;
        fitW = fitH * ratio;
      }
      clone.style.width = `${fitW}px`;
      clone.style.height = `${fitH}px`;
    });

    const rushInfo = document.createElement('div');
    rushInfo.className = 'rushInfo rushInfo-compact';

    rushInfo.innerHTML = `
      <div class="rushRecommendedTitle">
        <span class="sectionIcon sectionIcon-rush"></span>
        <span>Recommended Rush</span>
      </div>

      <div class="rushRecommendedLine">
        <span class="rushRouteDot" style="--route-color:${routeColor(primaryRoute.type)}"></span>
        <strong>${routeLabel(primaryRoute.type)}</strong>
        <span>${primaryRoute.blocks ? `${primaryRoute.blocks} blocks` : '—'}</span>
      </div>

      ${
        otherRoutes.length
          ? `<div class="rushOtherLabel">Other options</div>
            <div class="rushOtherRows">
              ${otherRoutes.map(r => `
                <div class="rushRecommendedLine rushOtherLine">
                  <span class="rushRouteDot" style="--route-color:${routeColor(r.type)}"></span>
                  <strong>${routeLabel(r.type)}</strong>
                  <span>${r.blocks ? `${r.blocks} blocks` : '—'}</span>
                </div>
              `).join('')}
            </div>`
          : ''
      }
    `;

    rushPanel.appendChild(rushMap);
    rushPanel.appendChild(rushInfo);
    rushWrap.appendChild(rushPanel);
    detailsGrid.appendChild(rushWrap);
    return rushWrap;
  }

  function mapCard(m){
    const d = document.createElement('details');
    d.classList.add('mapcard');
    d.classList.add(m.status === 'in' ? 'is-in' : 'is-out');

    if(exportMode){
      d.classList.add('exportMode');
      d.open = true;
    }

    if(twitterExportMode){
      d.classList.add('twitterExportCard');
    }

    const summary = document.createElement('summary');
    summary.className = 'mapSummary';

    const hero = document.createElement('div');
    hero.className = 'mapHero';
    const initialImage = m.image_url || '';

    if(initialImage){
      hero.dataset.fullImage = initialImage;

      if(bgIO){
        hero.dataset.bg = initialImage;
        bgIO.observe(hero);
      }else{
        hero.style.backgroundImage = `url("${initialImage}")`;
      }
    }

    if(m.isSeasonal){
      const seasonPill = document.createElement('div');
      seasonPill.className = 'mapPill mapPill-season';
      seasonPill.textContent = `${m.seasonEmoji || '🎉'} ${m.seasonLabel || 'Seasonal'}`;
      hero.appendChild(seasonPill);
    }

    const overlay = document.createElement('div');
    overlay.className = 'mapOverlay';

    const left = document.createElement('div');
    left.className = 'mapLeft';

    const title = document.createElement('div');
    title.className = 'mapTitle';
    title.textContent = m.name || '';

    if(m.is_new){
      const inlineNew = document.createElement('span');
      inlineNew.className = 'inlineNewPill';
      inlineNew.textContent = 'NEW';
      title.appendChild(inlineNew);
    }

    left.appendChild(title);

    const chipRow = document.createElement('div');
    chipRow.className = 'mapChipRow';

    function chip(text, className){
      if(!text) return;
      const el = document.createElement('span');
      el.className = `mapChip ${className || ''}`;
      el.textContent = text;
      chipRow.appendChild(el);
    }

    chip(m.mode || '', m.mode === '3s/4s' ? 'mapChip-mode34' : 'mapChip-modeSD');
    const playstyleText = (m.playstyle || '').trim();
    if(normalizedPlaystyleValue(m) !== 'Unknown'){
      chip(playstyleText, playstyleText === 'Quick & Rushy' ? 'mapChip-quick' : 'mapChip-long');
    }

    const genText = shortGenLabel(m);

    if(genText){
      chip(genText, 'mapChip-gen');
    }

    left.appendChild(chipRow);

    const daysWrap = document.createElement('div');
    daysWrap.className = 'mapDays';

    const statusLabel = document.createElement('div');
    statusLabel.className = m.status === 'in'
      ? 'mapCardStatus mapCardStatus-in'
      : 'mapCardStatus mapCardStatus-out';

    statusLabel.innerHTML = m.status === 'in'
      ? '<span class="mapCardStatusIcon mapCardStatusIcon-in" aria-hidden="true"></span><span>IN ROTATION</span>'
      : '<span class="mapCardStatusIcon mapCardStatusIcon-out" aria-hidden="true"></span><span>OUT OF ROTATION</span>';

    const sinceDate = document.createElement('div');
    sinceDate.className = 'mapDaysDate';

    if(exportMode){
      sinceDate.classList.add(
        m.status === 'in'
          ? 'mapDaysDateIn'
          : 'mapDaysDateOut'
      );
    }

    sinceDate.textContent = m.effective_date || 'Unknown';

    daysWrap.appendChild(statusLabel);

    if(!exportMode){
      const days = document.createElement('div');
      days.className = 'mapDaysValue';
      days.textContent = `${formatDaysLive(m)} days`;
      daysWrap.appendChild(days);
    }

    daysWrap.appendChild(sinceDate);

        overlay.appendChild(left);
        overlay.appendChild(daysWrap);
        hero.appendChild(overlay);

        summary.appendChild(hero);

        const body = document.createElement('div');
        body.className = 'detailsBody';

    let galleryLoaded = false;

    async function loadGallery(){
      if(exportMode || galleryLoaded) return;
      galleryLoaded = true;

      const images = await getMapGalleryImages(m);
      if(!images.length) return;

      hero.galleryImages = images;
      hero.galleryIndex = 0;

      if(images.length <= 1) return;

      const gallery = document.createElement('div');
      gallery.className = 'mapGallery';

      images.forEach((url, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapGalleryThumb';

        btn.style.backgroundImage = `url("${url}")`;
        btn.setAttribute('aria-label', `View image ${index + 1}`);

        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();

          hero.galleryIndex = index;
          openImageLightbox(
            url,
            m.name || 'Map image',
            images,
            index
          );
        });

        gallery.appendChild(btn);
      });

      body.insertBefore(gallery, body.firstChild);
    }

    d.addEventListener('toggle', () => {
      if(d.open) loadGallery();
    });

    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'detailsGrid detailsGrid-compact';
    body.appendChild(detailsGrid);

    function infoCell(label, value, isHtml=false, icon='', extraClass=''){
      const row = document.createElement('div');
      row.className = `infoCell ${extraClass}`;

      const ii = document.createElement('div');
      ii.className = `kvIcon kvIcon-${icon}`;

      const text = document.createElement('div');
      text.className = 'infoCellText';

      const l = document.createElement('div');
      l.className = 'infoCellLabel';
      l.textContent = label;

      const v = document.createElement('div');
      v.className = 'infoCellValue';

      if(isHtml) v.innerHTML = value || '';
      else v.textContent = value || '';

      if(label === 'Mode'){
        if(value === 'Solos/Doubles') v.classList.add('mode-sd');
        if(value === '3s/4s') v.classList.add('mode-34');
      }

      if(label === 'Playstyle'){
        if(value === 'Quick & Rushy') v.classList.add('ps-quick');
        if(value === 'Long & Tactical') v.classList.add('ps-long');
      }

      text.appendChild(l);
      text.appendChild(v);
      row.appendChild(ii);
      row.appendChild(text);

      return row;
    }

    const displayPlaystyle =
      normalizedPlaystyleValue(m) !== 'Unknown'
        ? playstyleText
        : '—';

    const compactPanel = document.createElement('div');
    compactPanel.className = 'compactInfoPanel';

    const infoColA = document.createElement('div');
    infoColA.className = 'compactInfoCol';

    infoColA.appendChild(infoCell('Mode', m.mode || '', false, 'mode'));
    infoColA.appendChild(infoCell('Playstyle', displayPlaystyle, false, 'playstyle'));
    infoColA.appendChild(infoCell('Gen Speed', m.gen_html || '—', true, 'generator'));

    const infoColB = document.createElement('div');
    infoColB.className = 'compactInfoCol';

    infoColB.appendChild(infoCell('Released', shortDate(m.released), false, 'released'));

    if(m.note){
      infoColB.appendChild(infoCell('Note', m.note, true, 'note'));
    }

    if(!exportMode){
      const linkHtml = (m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : '')
        + (m.image_url ? ` • <a href="${m.image_url}" target="_blank" rel="noopener">Image</a>` : '');

      infoColB.appendChild(infoCell('Links', linkHtml || '—', true, 'links', 'infoCell-links'));
    }

    const infoColC = document.createElement('div');
    infoColC.className = 'compactInfoCol compactInfoCol-build';

    if(!exportMode){
      const help = document.createElement('span');
      help.className = 'buildInfoHelp compactBuildHelp';
      help.tabIndex = 0;
      help.innerHTML = `?<span class="buildInfoTooltip">Build Limits are currently being recalculated based on recent changes from Hypixel staff</span>`;
      infoColC.appendChild(help);
    }

    infoColC.appendChild(infoCell('Max Y', m.buildMaxY ?? '—', false, 'maxy'));
    infoColC.appendChild(infoCell('Min Y', m.buildMinY ?? '—', false, 'miny'));
    infoColC.appendChild(infoCell('Y Layers', m.buildRange ?? '—', false, 'range'));
    infoColC.appendChild(infoCell('Build Radius', m.buildRadius ?? '—', false, 'radius'));

    compactPanel.appendChild(infoColA);
    compactPanel.appendChild(infoColB);
    compactPanel.appendChild(infoColC);
    detailsGrid.appendChild(compactPanel);

    const rushWrapEl = buildRushGuide(m, detailsGrid);

    if(exportMode){
      const exportFooter = document.createElement('div');
      exportFooter.className = 'shareExportWatermark';

      const generatedDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      exportFooter.textContent =
        `Generated on ${generatedDate} with Jaay's Bed Wars Map List • https://jaaymc.com/bedwars`;

      body.appendChild(exportFooter);
    }

    if(!exportMode){
      const shareRow = document.createElement('div');
      shareRow.className = rushWrapEl ? 'mapShareRow mapShareRow-overlay' : 'mapShareRow';

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'mapShareBtn';
      shareBtn.innerHTML = '<span class="shareIcon-share" aria-hidden="true"></span><span class="mapShareBtnLabel">Share</span>';

      const shareMenu = document.createElement('div');
      shareMenu.className = 'mapShareMenu';
      shareMenu.hidden = true;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mapShareOption';
      copyBtn.innerHTML = shareOptionHTML('shareIcon-link', 'Copy Link');

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'mapShareOption';
      downloadBtn.innerHTML = shareOptionHTML('shareIcon-download', 'Download Card');

      const twitterBtn = document.createElement('button');
      twitterBtn.type = 'button';
      twitterBtn.className = 'mapShareOption';
      twitterBtn.innerHTML = shareOptionHTML('shareIcon-twitter', 'Share to Twitter');

      const hypixelBtn = document.createElement('button');
      hypixelBtn.type = 'button';
      hypixelBtn.className = 'mapShareOption';
      hypixelBtn.innerHTML = shareOptionHTML('shareIcon-hypixel', 'Share to Hypixel Forums');

      hypixelBtn.addEventListener('click', async e => {
        e.stopPropagation();

        shareMenu.hidden = true;

        await navigator.clipboard.writeText(mapHypixelBBCode(m));

        alert('BBCode copied. Paste it into your Hypixel profile post.');

        window.open('https://hypixel.net/whats-new/profile-posts/', '_blank', 'noopener');
      });

      copyBtn.addEventListener('click', async e => {
        e.stopPropagation();

        await navigator.clipboard.writeText(mapStaticPageUrl(m));

        copyBtn.textContent = '✅ Copied!';

        setTimeout(() => {
          copyBtn.innerHTML = shareOptionHTML('shareIcon-link', 'Copy Link');
        }, 1200);

        shareMenu.hidden = true;
      });

      downloadBtn.addEventListener('click', async e => {
        e.stopPropagation();

        shareMenu.hidden = true;
        downloadBtn.textContent = '⏳ Downloading...';

        await downloadMapCard(d, m);

        downloadBtn.innerHTML = shareOptionHTML('shareIcon-download', 'Download Card');
      });

      twitterBtn.addEventListener('click', e => {
       e.stopPropagation();

       shareMenu.hidden = true;

       const text = mapShareText(m);
       const shareUrl = mapStaticPageUrl(m);

       const url =
         `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

       window.open(url, '_blank', 'noopener');
     });

      shareMenu.append(copyBtn, downloadBtn, twitterBtn, hypixelBtn);

      shareBtn.addEventListener('click', e => {
        e.stopPropagation();
        shareMenu.hidden = !shareMenu.hidden;
      });

      document.addEventListener('click', () => {
        shareMenu.hidden = true;
      });

      shareRow.append(shareMenu, shareBtn);

      if(rushWrapEl){
        rushWrapEl.appendChild(shareRow);
      }else{
        body.appendChild(shareRow);
      }
    }

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

  function escapeHTML(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function modeLabel(mode){
    if(mode === 'Solos/Doubles') return '8 teams';
    if(mode === '3s/4s') return '4 teams';
    return mode || '';
  }

  function rotationSummaryModeClass(mode){
    if(mode === 'Solos/Doubles') return 'rotationModeSD';
    if(mode === '3s/4s') return 'rotationMode34';
    return '';
  }

  function validDateValue(m){
    const raw = m.effective_date || m.dateStatus || m.rotation_date || m.last_seen || '';
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }

  function newestRotationDate(maps){
    return Math.max(...maps.map(validDateValue));
  }

  function mapsOnDate(maps, dateValue){
    return maps.filter(m => validDateValue(m) === dateValue);
  }

  function groupedMiniList(maps){
    const groups = [
      ['Solos/Doubles', maps.filter(m => m.mode === 'Solos/Doubles')],
      ['3s/4s', maps.filter(m => m.mode === '3s/4s')]
    ];

    return groups
      .filter(([, items]) => items.length)
      .map(([mode, items]) => {
        const names = items
          .slice()
          .sort((a, b) => {
            if(!!a.is_new !== !!b.is_new) return a.is_new ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
          })
          .map(m => `<span class="rotationMapLink" data-map="${m.name}">${m.name}${m.is_new ? ' <span class="rotationNewPill">NEW</span>' : ''}</span>`)
          .join(', ');

        return `
          <div class="rotationModeLine">
            <span class="${rotationSummaryModeClass(mode)}">[${modeLabel(mode)}]</span>
            ${names}
          </div>
        `;
      })
      .join('');
  }
  function setFiltersForMaps(maps, label){
    const names = new Set(maps.map(m => m.name));

    focusNames = names;

    els.q.value = label || '';
    setSearchUrl(label || '');

    resetFilters();
    closeFilterPanels();

    render();

    document.querySelector('.controls')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function focusMap(name){
      focusNames = null;

      els.q.value = name;
      setSearchUrl(name);
      resetFilters();

      render();

      document.querySelector('.controls')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
      });
  }

  function mapTypeLabel(scope){
    if(scope === '8') return '8 teams';
    if(scope === '4') return '4 teams';
    if(scope === 'seasonal') return 'Seasonal';
    if(scope === 'core') return 'Core';
    return 'All maps';
  }

  function percentage(part, total){
    if(!total) return '0%';
    return `${Math.round((part / total) * 100)}%`;
  }

  function setMapTypeBoxes(values){
    const allowed = new Set(values);

    getFilterBoxes('mapType').forEach(box => {
      box.checked = allowed.has(box.value);
    });

    readFiltersFromUI();
  }

  function applySummaryFilter(scope, status){
    focusNames = null;
    els.q.value = '';
    setSearchUrl('');

    resetFilters();

    if(scope === '8'){
      els.mode.value = 'Solos/Doubles';
      setMapTypeBoxes(['normal']);

    }else if(scope === '4'){
      els.mode.value = '3s/4s';
      setMapTypeBoxes(['normal']);

    }else if(scope === 'seasonal'){
      els.mode.value = 'seasonal';
      setMapTypeBoxes(['normal', 'seasonal']);

    }else{
      // "All", "In Rotation", and "Out of Rotation"
      // should represent Core maps only.
      els.mode.value = 'all';
      setMapTypeBoxes(['normal']);
    }

    if(status){
      els.status.value = status;
    }

    updateFilterUI();
    render();
    closeFilterPanels();

    document.querySelector('.controls')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function summaryButtonHTML(scope, status, label, value, extraClass){
    const statusAttr = status ? ` data-summary-status="${status}"` : '';

    return `
      <button class="mapSummaryButton ${extraClass || ''}" type="button" data-summary-scope="${scope}"${statusAttr}>
        <span>${label}</span>
        <strong>${value}</strong>
      </button>
    `;
  }

  function renderMapSummary(){
    if(!els.mapSummaryBody) return;

    const total = maps.length;
    const coreMaps = maps.filter(m => !m.isSeasonal);
    const seasonalMaps = maps.filter(m => m.isSeasonal);
    const teams8 = coreMaps.filter(m => m.mode === 'Solos/Doubles');
    const teams4 = coreMaps.filter(m => m.mode === '3s/4s');

    const inMaps = coreMaps.filter(m => m.status === 'in');
    const outMaps = coreMaps.filter(m => m.status === 'out');

    const in8 = teams8.filter(m => m.status === 'in');
    const in4 = teams4.filter(m => m.status === 'in');
    const inSeasonal = seasonalMaps.filter(m => m.status === 'in');

    const out8 = teams8.filter(m => m.status === 'out');
    const out4 = teams4.filter(m => m.status === 'out');
    const outSeasonal = seasonalMaps.filter(m => m.status === 'out');

    els.mapSummaryBody.innerHTML = `
      <div class="mapSummaryTop">
        <button class="mapSummaryTotal mapSummary-purple" type="button" data-summary-scope="all">
          <span class="mapSummaryTopLabel">
            <span>Total maps</span>
          </span>
          <strong>${total}</strong>
          <small>${coreMaps.length} core</small>
        </button>

        ${summaryButtonHTML('8', '', '<span class="mapSummaryIcon mapSummaryIcon-8" aria-hidden="true"></span>8 teams', teams8.length, 'mapSummary-blue')}
        ${summaryButtonHTML('4', '', '<span class="mapSummaryIcon mapSummaryIcon-4" aria-hidden="true"></span>4 teams', teams4.length, 'mapSummary-orange')}
        ${summaryButtonHTML('seasonal', '', '<span class="mapSummaryIcon mapSummaryIcon-seasonal" aria-hidden="true"></span>Seasonal', seasonalMaps.length, 'mapSummary-green')}
      </div>

      <div class="mapSummaryStatusRows">
        <div class="mapSummaryStatusRow mapSummaryStatusRow-in">
          <button class="mapSummaryStatusMain" type="button" data-summary-scope="all" data-summary-status="in">
            <span class="mapSummaryStatusIcon mapSummaryStatusIcon-in" aria-hidden="true"></span>
            <span class="mapSummaryStatusText">
              <span>In rotation</span>
              <strong>${inMaps.length}</strong>
              <small>${percentage(inMaps.length, coreMaps.length)}</small>
            </span>
          </button>

          <button class="mapSummaryMiniStat mapSummary-blue" type="button" data-summary-scope="8" data-summary-status="in">
            <span>8 teams</span>
            <strong>${in8.length}</strong>
          </button>

          <button class="mapSummaryMiniStat mapSummary-orange" type="button" data-summary-scope="4" data-summary-status="in">
            <span>4 teams</span>
            <strong>${in4.length}</strong>
          </button>

          <button class="mapSummaryMiniStat mapSummaryMiniStat-seasonal mapSummary-green" type="button" data-summary-scope="seasonal" data-summary-status="in">
            <span>Seasonal</span>
            <strong>${inSeasonal.length}</strong>
          </button>
        </div>

        <div class="mapSummaryStatusRow mapSummaryStatusRow-out">
          <button class="mapSummaryStatusMain" type="button" data-summary-scope="all" data-summary-status="out">
            <span class="mapSummaryStatusIcon mapSummaryStatusIcon-out" aria-hidden="true"></span>
            <span class="mapSummaryStatusText">
              <span>Out of rotation</span>
              <strong>${outMaps.length}</strong>
              <small>${percentage(outMaps.length, coreMaps.length)}</small>
            </span>
          </button>

          <button class="mapSummaryMiniStat mapSummary-blue" type="button" data-summary-scope="8" data-summary-status="out">
            <span>8 teams</span>
            <strong>${out8.length}</strong>
          </button>

          <button class="mapSummaryMiniStat mapSummary-orange" type="button" data-summary-scope="4" data-summary-status="out">
            <span>4 teams</span>
            <strong>${out4.length}</strong>
          </button>

          <button class="mapSummaryMiniStat mapSummaryMiniStat-seasonal mapSummary-green" type="button" data-summary-scope="seasonal" data-summary-status="out">
            <span>Seasonal</span>
            <strong>${outSeasonal.length}</strong>
          </button>
        </div>
      </div>
    `;

    els.mapSummaryBody.querySelectorAll('[data-summary-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        applySummaryFilter(
          btn.dataset.summaryScope,
          btn.dataset.summaryStatus || ''
        );
      });
    });
  }

  function renderRotationOverview(){
    renderMapSummary();

    const normalMaps = maps.filter(m => !m.isSeasonal);
    const latestDateValue = newestRotationDate(normalMaps);

    if(!latestDateValue || latestDateValue <= 0){
      els.rotation_overview.style.display = 'none';
      return;
    }

    const latestMaps = mapsOnDate(normalMaps, latestDateValue);
    const entering = latestMaps.filter(m => m.status === 'in');
    const leaving = latestMaps.filter(m => m.status === 'out');

    const dateText = new Date(latestDateValue).toLocaleDateString('en-US', {
      month:'long',
      day:'numeric',
      year:'numeric'
    });

    els.latestRotationDate.textContent = dateText;
    els.latestEnteringCount.textContent = entering.length;
    els.latestLeavingCount.textContent = leaving.length;
    els.latestEnteringList.innerHTML = groupedMiniList(entering) || '<span class="muted">No entering maps detected.</span>';
    els.latestLeavingList.innerHTML = groupedMiniList(leaving) || '<span class="muted">No leaving maps detected.</span>';
    document.querySelectorAll('.rotationMapLink').forEach(btn => {
        btn.onclick = () => focusMap(btn.dataset.map);
    });

    els.viewLatestRotation.onclick = () => {
      setFiltersForMaps(latestMaps, 'Latest rotation');
    };

    const newMaps = maps.filter(m => m.is_new);
    const activeSeasonalMaps = maps.filter(m =>
      m.isSeasonal &&
      m.status === 'in'
    );

    const activeSeasonLabel = activeSeasonalMaps.length
      ? activeSeasonalMaps[0].seasonLabel || 'Seasonal Event'
      : '';

    const activeSeasonEmoji = activeSeasonalMaps.length
      ? activeSeasonalMaps[0].seasonEmoji || '🎉'
      : '';

    const sideMaps = activeSeasonalMaps.length ? activeSeasonalMaps : newMaps;
    const showingSeasonal = activeSeasonalMaps.length > 0;

    if(sideMaps.length){
      els.eventPanel.classList.remove(
        'eventPanel-new',
        'eventPanel-easter',
        'eventPanel-summer',
        'eventPanel-halloween',
        'eventPanel-winter',
        'eventPanel-lunar'
      );

      const seasonKey = String(activeSeasonLabel || '').toLowerCase();

      if(showingSeasonal){
        if(seasonKey.includes('easter')){
          els.eventPanel.classList.add('eventPanel-easter');
        }else if(seasonKey.includes('summer')){
          els.eventPanel.classList.add('eventPanel-summer');
        }else if(seasonKey.includes('halloween')){
          els.eventPanel.classList.add('eventPanel-halloween');
        }else if(seasonKey.includes('winter')){
          els.eventPanel.classList.add('eventPanel-winter');
        }else if(seasonKey.includes('lunar')){
          els.eventPanel.classList.add('eventPanel-lunar');
        }
      }else{
        els.eventPanel.classList.add('eventPanel-new');
      }

      els.eventPanel.style.display = '';
      els.eventPanelTitle.textContent = showingSeasonal
        ? `${activeSeasonEmoji} ${activeSeasonLabel} Event`
        : '🆕 New Maps';
      els.eventPanelStatus.textContent = showingSeasonal
        ? 'Active'
        : `${sideMaps.length} map${sideMaps.length === 1 ? '' : 's'}`;
      els.eventPanelBody.innerHTML = showingSeasonal
        ? `
          <div class="eventCountBlock">
            <strong>${sideMaps.length}</strong>
            <span>${activeSeasonLabel} Maps</span>
          </div>
          ${groupedMiniList(sideMaps)}
        `
        : groupedMiniList(sideMaps);
      document.querySelectorAll('.rotationMapLink').forEach(btn => {
          btn.onclick = () => focusMap(btn.dataset.map);
      });
      els.viewEventMaps.textContent = showingSeasonal
        ? `View ${activeSeasonLabel.toLowerCase()} maps →`
        : 'View new maps →';
      els.viewEventMaps.onclick = () => {
        setFiltersForMaps(
          sideMaps,
          showingSeasonal ? `${activeSeasonLabel} maps` : 'New maps'
        );
      };
    }else{
      els.eventPanel.style.display = 'none';
    }

    applySummaryVisibility();
  }


  function hasActiveResultsFilter(){
    const hasSearch =
      String(els.q.value || '').trim() !== '' &&
      !isSearchAlias(els.q.value);

    return (
      hasSearch ||
      !!focusNames ||
      els.mode.value !== 'all' ||
      els.status.value !== 'all' ||
      isGroupFiltered('mapType') ||
      isGroupFiltered('playstyle') ||
      isGroupFiltered('generator')
    );
  }

  function currentMapListTitle(){
    const q = String(els.q.value || '').trim();

    if(isSearchAlias(q)){
      if(q.toLowerCase() === 'latest rotation') return 'Latest rotation';
      if(q.toLowerCase() === 'new maps') return 'New maps';
      if(q.toLowerCase().endsWith(' maps')) return q;
    }

    return 'Maps';
  }

  function updateMapCountLabel(count){
    const filtered = hasActiveResultsFilter();

    const suffix = filtered
      ? count === 1 ? 'map filtered' : 'maps filtered'
      : count === 1 ? 'map' : 'maps';

    els.mapListTitle.textContent = currentMapListTitle();
    els.mapCountLabel.textContent = `${count} ${suffix}`;
  }

  function render(){
    els.map_list.textContent = '';
    renderRotationOverview();

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

      if(els.mode.value === 'seasonal' && !isDaysSort){
        if(a.status !== b.status){
          return a.status === 'in' ? -1 : 1;
        }

        return sortKey === 'name_desc' ? -byName(a,b) : byName(a,b);
      }

      if(sortKey === 'name_asc'){
        const aNewActive = !!a.is_new && a.status === 'in';
        const bNewActive = !!b.is_new && b.status === 'in';

        if(aNewActive !== bNewActive) return aNewActive ? -1 : 1;
      }

      if(!isDaysSort){
        if(sortKey === 'name_desc'){
          return -byName(a,b);
        }

        const block = seasonalFirstOrLast(a,b);
        if(block !== 0) return block;

        if(a.isSeasonal && b.isSeasonal){
          return seasonalInternalSort(a,b, sortKey);
        }

        return byName(a,b);
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

    const visibleMaps = filtered.slice().sort(compare);

    updateMapCountLabel(visibleMaps.length);

    const frag = document.createDocumentFragment();

    for(const m of visibleMaps){
      frag.appendChild(getCard(m));
    }

    els.map_list.appendChild(frag);

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

  els.q.addEventListener('input', () => {
    focusNames = null;
    setSearchUrl(els.q.value);
    updateFilterUI();
    scheduleRenderDebounced();
  });

  els.q.addEventListener('keydown', e => {
    if(e.key !== 'Backspace') return;

    if(
      els.q.selectionStart !== els.q.selectionEnd ||
      els.q.selectionStart !== els.q.value.length
    ){
      return;
    }

    if(!isSearchAlias(els.q.value)) return;

    e.preventDefault();

    els.q.value = '';
    focusNames = null;
    setSearchUrl('');
    scheduleRender();
  });

  els.sort.addEventListener('change', () => {
    focusNames = null;
    scheduleRender();
  });

  els.mode.addEventListener('change', () => {
    focusNames = null;

    if(els.mode.value === 'seasonal'){
      getFilterBoxes('mapType').forEach(box => {
        if(box.value === 'seasonal'){
          box.checked = true;
        }
      });

      readFiltersFromUI();
    }

    setSearchUrl(els.q.value);
    updateFilterUI();
    scheduleRender();
  });

  els.status.addEventListener('change', () => {
    focusNames = null;
    updateFilterUI();
    scheduleRender();
  });

  filterOptionEls.filterGroup.forEach(box => {
    box.addEventListener('change', () => {
      focusNames = null;
      readFiltersFromUI();
      updateFilterUI();
      scheduleRender();
    });
  });

  function allFilterPanels(){
    return [
      els.modeFilterPanel,
      els.statusFilterPanel,
      els.playstyleFilterPanel,
      els.genFilterPanel,
      els.settingsFilterPanel
    ];
  }

  function allFilterToggles(){
    return [
      els.modeFilterToggle,
      els.statusFilterToggle,
      els.playstyleFilterToggle,
      els.genFilterToggle,
      els.settingsFilterToggle
    ];
  }

  function closeFilterPanels(){
    allFilterPanels().forEach(panel => {
      panel.hidden = true;
    });

    allFilterToggles().forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleFilterPanel(panel, button){
    const shouldOpen = panel.hidden;

    closeFilterPanels();

    if(!shouldOpen){
      return;
    }

    const controls = document.querySelector('.controls');
    const controlsRect = controls.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    panel.style.right = 'auto';
    panel.style.top = `${buttonRect.bottom - controlsRect.top + 8}px`;
    panel.style.left = `${buttonRect.left - controlsRect.left}px`;

    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');

    // Clamp so the panel never overflows the controls container's right edge
    const panelWidth = panel.getBoundingClientRect().width;
    const desiredLeft = buttonRect.left - controlsRect.left;
    const maxLeft = Math.max(4, controlsRect.width - panelWidth - 4);
    panel.style.left = `${Math.min(desiredLeft, maxLeft)}px`;
  }

  els.modeFilterToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleFilterPanel(els.modeFilterPanel, els.modeFilterToggle);
  });

  els.statusFilterToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleFilterPanel(els.statusFilterPanel, els.statusFilterToggle);
  });

  els.playstyleFilterToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleFilterPanel(els.playstyleFilterPanel, els.playstyleFilterToggle);
  });

  els.genFilterToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleFilterPanel(els.genFilterPanel, els.genFilterToggle);
  });

  els.settingsFilterToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleFilterPanel(els.settingsFilterPanel, els.settingsFilterToggle);
  });

  document.querySelectorAll('.filtersClose').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      closeFilterPanels();
    });
  });

  filterOptionEls.modeValue.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      els.mode.value = btn.dataset.modeValue;
      focusNames = null;

      if(els.mode.value === 'seasonal'){
        getFilterBoxes('mapType').forEach(box => {
          if(box.value === 'seasonal'){
            box.checked = true;
          }
        });

        readFiltersFromUI();
      }

      updateFilterUI();
      scheduleRender();
      closeFilterPanels();
    });
  });

  filterOptionEls.statusValue.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      els.status.value = btn.dataset.statusValue;
      focusNames = null;

      updateFilterUI();
      scheduleRender();
      closeFilterPanels();
    });
  });

  filterOptionEls.playstyleValue.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      const value = btn.dataset.playstyleValue;

      filterState.playstyle = value === 'all'
        ? new Set(filterDefaults.playstyle)
        : new Set([value]);

      focusNames = null;
      updateFilterUI();
      scheduleRender();
      closeFilterPanels();
    });
  });

  filterOptionEls.genValue.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      const value = btn.dataset.genValue;

      filterState.generator = value === 'all'
        ? new Set(filterDefaults.generator)
        : new Set([value]);

      focusNames = null;
      updateFilterUI();
      scheduleRender();
      closeFilterPanels();
    });
  });

  els.activeFilters.addEventListener('click', e => {
    const chip = e.target.closest('.activeFilterChip');
    if(!chip) return;

    if(chip.dataset.filterGroup === 'mode'){
      els.mode.value = 'all';
      focusNames = null;
      setSearchUrl(els.q.value);
      updateFilterUI();
      scheduleRender();
      return;
    }

    if(chip.dataset.filterGroup === 'status'){
      els.status.value = 'all';
      focusNames = null;
      updateFilterUI();
      scheduleRender();
      return;
    }

    if(chip.dataset.filterGroup === 'playstyle'){
      filterState.playstyle = new Set(filterDefaults.playstyle);
      focusNames = null;
      updateFilterUI();
      scheduleRender();
      return;
    }

    if(chip.dataset.filterGroup === 'generator'){
      filterState.generator = new Set(filterDefaults.generator);
      focusNames = null;
      updateFilterUI();
      scheduleRender();
      return;
    }

    const box = document.querySelector(
      `[data-filter-group="${chip.dataset.filterGroup}"][value="${chip.dataset.filterValue}"]`
    );

    if(box){
      box.checked = true;
    }

    focusNames = null;
    readFiltersFromUI();
    updateFilterUI();
    scheduleRender();
  });

  document.addEventListener('click', e => {
    const clickedPanel = allFilterPanels().some(panel => panel.contains(e.target));
    const clickedToggle = allFilterToggles().some(btn => btn.contains(e.target));

    if(clickedPanel || clickedToggle) return;

    closeFilterPanels();
  });

  function seasonalSortKey(m, seasonalActive){
    if(seasonalActive){
      return m.isSeasonal ? 0 : 1;
    }
    return m.isSeasonal ? 1 : 0;
  }

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;

    const rushModal = document.querySelector('.rushDiagramModal.open');
    if(rushModal) return;

    const lightbox = document.querySelector('.imageLightbox.open');
    if(lightbox) return;

    const active = document.activeElement;
    if(active && active.tagName === 'INPUT'){
      active.blur();
    }

    focusNames = null;
    els.q.value = '';
    setSearchUrl('');
    resetFilters();
    updateFilterUI();
    closeFilterPanels();
    render();
  });

  if(els.hideSummariesToggle){
    els.hideSummariesToggle.addEventListener('change', applySummaryVisibility);
  }

  loadSearchFromUrl();
  loadSummaryVisibility();
  updateNextRotationCountdown(meta);
  setInterval(() => updateNextRotationCountdown(meta), 60000);
  readFiltersFromUI();
  updateFilterUI();
  render();


})().catch(err=>{
  console.error(err);
  alert(err.message || String(err));
});

document.addEventListener('toggle', (e) => {
  const opened = e.target;
  if(!(opened instanceof HTMLDetailsElement)) return;
  if(!opened.classList.contains('mapcard')) return;
  if(opened.classList.contains('shareExportCard')) return;
  if(!opened.open) return;

  document.querySelectorAll('details.mapcard[open]').forEach(d => {
    if(d !== opened) d.open = false;
  });
}, true);

