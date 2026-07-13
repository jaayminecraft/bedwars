(async () => {
  const res = await fetch('data/changelog.json', {cache:'no-store'});
  const data = await res.json();
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const CHANGELOG_SEEN_KEY = 'bedwars_changelog_seen_id';
  const seenIdAtPageLoad = localStorage.getItem(CHANGELOG_SEEN_KEY);
  const newestIdAtPageLoad = entries[0]?.id;

  const entryIndexById = new Map(entries.map((item, i) => [String(item.id), i]));
  const seenIndexAtPageLoad = seenIdAtPageLoad ? (entryIndexById.get(String(seenIdAtPageLoad)) ?? -1) : -1;

  function isUnreadEntry(entry){
    if(!seenIdAtPageLoad) return false;
    const entryIndex = entryIndexById.get(String(entry.id));
    return seenIndexAtPageLoad > 0 && entryIndex !== undefined && entryIndex < seenIndexAtPageLoad;
  }

  const els = {
    list: document.getElementById('changelogList'),
    search: document.getElementById('changeSearch'),
    type: document.getElementById('changeType'),
    mode: document.getElementById('changeMode'),
    total: document.getElementById('changeTotal'),
    rotation: document.getElementById('changeRotation'),
    today: document.getElementById('changeToday')
  };

  const types = [
    ['all', 'All types'],
    ['rotation', 'Rotation'],
    ['build_limit', 'Build Limit'],
    ['generator', 'Gen Speed'],
    ['playstyle', 'Playstyle'],
    ['rename', 'Map Rename'],
    ['map_added', 'Map Added'],
    ['map_removed', 'Map Removed'],
    ['info', 'Info Change'],
    ['site_change', 'Site Change'],
  ];

  const modes = [
    ['all', 'All modes'],
    ['Solos/Doubles', '8 Teams'],
    ['3s/4s', '4 Teams'],
    ['Seasonal', 'Seasonal']
  ];

  els.type.innerHTML = types.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  els.mode.innerHTML = modes.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function slugify(name){
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function typeLabel(type){
    return {
      rotation:'Rotation',
      build_limit:'Build Limit',
      generator:'Gen Speed',
      playstyle:'Playstyle',
      rename:'Rename',
      map_added:'Map Added',
      map_removed:'Map Removed',
      date:'Date',
      info:'Info Change',
      site_change:'Site Change',
    }[type] || 'Update';
  }

  function typeIconClass(type){
    return {
      rotation:'changeTypeIcon-rotation',
      build_limit:'changeTypeIcon-build',
      generator:'changeTypeIcon-generator',
      rename:'changeTypeIcon-info',
      playstyle:'changeTypeIcon-playstyle',
      map_added:'changeTypeIcon-added',
      map_removed:'changeTypeIcon-removed',
      date:'changeTypeIcon-date',
      info:'changeTypeIcon-info',
      site_change:'changeTypeIcon-info'
    }[type] || 'changeTypeIcon-info';
  }

  function eventIcon(entry){
    const event = String(entry.event || '').toLowerCase();

    if(event.includes('lunar')) return '🧧';
    if(event.includes('easter')) return '🥚';
    if(event.includes('summer')) return '☀️';
    if(event.includes('halloween')) return '🎃';
    if(event.includes('holidays')) return '❄️';

    return '';
  }

  function changeLabel(entry){
    const label = String(entry.label || '');

    return {
      'Note':'Note Update',
      'Generator Speed':'Gen Speed',
      'Minimum Build Limit':'Minimum Y',
      'Maximum Build Limit':'Maximum Y',
      'Build Range':'Y Range',
      'Build Radius':'Radius'
    }[label] || label || typeLabel(entry.type);
  }

  function compareLabel(entry){
    return changeLabel(entry) === 'Note Update'
      ? 'Note'
      : changeLabel(entry);
  }

  function mapUrl(entry){
    const params = new URLSearchParams();
    params.set('q', entry.map || '');

    if(entry.event || entry.mode === 'Seasonal'){
      params.set('mode', 'seasonal');
    }else if(entry.mode){
      params.set('mode', entry.mode);
    }

    return `./index.html?${params.toString()}`;
  }

  function cleanValue(value){
    if(value === undefined || value === null || value === '' || value === '—' || value === '--') return 'None';
    if(value === 'true' || value === true) return 'IN';
    if(value === 'false' || value === false) return 'OUT';
    return String(value);
  }

  function valueClass(value){
    const v = String(value || '').toLowerCase();

    if(v === 'in') return 'changeValue-in';
    if(v === 'out') return 'changeValue-out';

    if(v.includes('quick')) return 'changeValue-quick';
    if(v.includes('long')) return 'changeValue-long';

    if(v.includes('slow')) return 'changeValue-genSlow';
    if(v.includes('medium')) return 'changeValue-genMedium';
    if(v.includes('fast')) return 'changeValue-genFast';

    return '';
  }

  function formatLocalTime(entry){
    if(!entry.timestamp) return entry.time || '';

    const date = new Date(entry.timestamp);

    if(Number.isNaN(date.getTime())) return entry.time || '';

    return date.toLocaleTimeString([], {
      hour:'numeric',
      minute:'2-digit'
    });
  }

  function displayOld(entry){
    if(entry.type === 'map_added') return 'None';
    if(entry.type === 'map_removed') return cleanValue(entry.old || entry.map);
    return cleanValue(entry.old);
  }

  function displayNew(entry){
    if(entry.type === 'map_added') return cleanValue(entry.new || entry.map);
    if(entry.type === 'map_removed') return 'None';
    return cleanValue(entry.new);
  }

  function subtitle(entry){
    if(entry.type === 'map_added') return 'Added to tracker';
    if(entry.type === 'map_removed') return 'Removed from tracker';
    if(entry.type === 'rotation') return entry.label === 'Rotated In' ? 'Now in rotation' : 'No longer in rotation';
    return '';
  }

  function rotationThumb(name){
    return `assets/map-images/${slugify(name)}/main.webp`;
  }

  function mapsByMode(maps){
    const groups = {
      'Solos/Doubles': [],
      '3s/4s': [],
      Other: []
    };

    for(const map of maps || []){
      if(map.mode === 'Solos/Doubles'){
        groups['Solos/Doubles'].push(map);
      }else if(map.mode === '3s/4s'){
        groups['3s/4s'].push(map);
      }else{
        groups.Other.push(map);
      }
    }

    Object.values(groups).forEach(group => {
      group.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    });

    return groups;
  }

  function modeTitle(mode){
    return {
      'Solos/Doubles': 'Solos/Doubles',
      '3s/4s': '3s/4s',
      Other: 'Other'
    }[mode] || mode;
  }

  function mapListBlock(title, maps, className){
    if(!Array.isArray(maps) || !maps.length) return '';

    const groups = mapsByMode(maps);
    const visibleGroups = Object.entries(groups).filter(([, modeMaps]) => modeMaps.length);
    const previewMode = groups['Solos/Doubles'].length
      ? 'Solos/Doubles'
      : visibleGroups[0]?.[0];

    const isLarge = maps.length > 2;

    return `
      <div class="changeRotationColumn ${className} ${isLarge ? 'is-collapsed' : ''}">
        <div class="changeRotationHeader">
          <strong>${escapeHtml(title)}</strong>
          <span>${maps.length}</span>
        </div>

        ${visibleGroups.map(([mode, modeMaps]) => {
          const isPreviewGroup = mode === previewMode;

          return `
            <div class="changeRotationModeGroup ${isPreviewGroup ? 'is-preview-group' : ''}" data-mode="${escapeHtml(mode)}">
              <div class="changeRotationModeTitle">${escapeHtml(modeTitle(mode))}</div>

              <div class="changeRotationMaps">
                ${modeMaps.map(map => `
                <a class="changeRotationMap" href="${escapeHtml(mapUrl({
                   map: map.name || '',
                   mode: map.mode || '',
                   event: map.event || ''
                 }))}">
                    <span class="changeRotationThumb" style="background-image:url('${rotationThumb(map.name || '')}')"></span>
                    <span>${escapeHtml(map.name || '—')}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        ${isLarge ? `
          <button class="changeRotationToggle" type="button">
            Show all ${maps.length} maps
          </button>
        ` : ''}
      </div>
    `;
  }

  function rotationTheme(entry){
    const event = String(entry.event || '').toLowerCase();

    if(event.includes('halloween')) return 'changeRotationCard-halloween';
    if(event.includes('summer')) return 'changeRotationCard-summer';
    if(event.includes('winter') || event.includes('holiday')) return 'changeRotationCard-winter';
    if(event.includes('lunar')) return 'changeRotationCard-lunar';
    if(event.includes('easter')) return 'changeRotationCard-easter';

    return 'changeRotationCard-normal';
  }

  function rotationEmoji(entry){
    const event = String(entry.event || '').toLowerCase();

    if(event.includes('lunar')) return '🧧';
    if(event.includes('easter')) return '🥚';
    if(event.includes('summer')) return '☀️';
    if(event.includes('halloween')) return '🎃';
    if(event.includes('winter') || event.includes('holiday')) return '❄️';

    return '♻️';
  }

  function rotationTitle(entry){
    const event = String(entry.event || '').trim();
    const entered = Array.isArray(entry.entered) ? entry.entered.length : 0;
    const left = Array.isArray(entry.left) ? entry.left.length : 0;
    const icon = rotationEmoji(entry);

    if(!event) return `${icon} New rotation is now live`;

    if(entered && !left) return `${icon} ${event} Maps Activated`;
    if(left && !entered) return `${icon} ${event} Maps Deactivated`;

    return `${icon} ${event} Rotation Updated`;
  }

  function compareBlock(entry){
    if(entry.type === 'rotation' && entry.field === 'rotation_summary'){
      return `
        <div class="changeRotationCard ${rotationTheme(entry)}">
          <div class="changeRotationTop">
            <div>
              <strong>${escapeHtml(rotationTitle(entry))}</strong>
            </div>

            ${entry.source_url ? `
              <a class="changeRotationSource" href="${escapeHtml(entry.source_url)}" target="_blank" rel="noopener">
                Source › ${escapeHtml(entry.source_title || 'Rotation Post')}
              </a>
            ` : ''}
          </div>

          <div class="changeRotationSummary ${!entry.entered?.length || !entry.left?.length ? 'changeRotationSummary-single' : ''}">
            ${mapListBlock('Entered Rotation', entry.entered, 'changeRotationIn')}
            ${mapListBlock('Left Rotation', entry.left, 'changeRotationOut')}
          </div>
        </div>
      `;
    }

    if(entry.type === 'site_change'){
      return `
        <div class="changeSiteMessage">
          ${escapeHtml(displayNew(entry))}
        </div>
      `;
    }

    if(entry.type === 'map_added'){
      return `
        <div class="changeCompareEmpty">
          Added to tracker
        </div>
      `;
    }

    if(entry.type === 'map_removed'){
      return `
        <div class="changeCompareEmpty">
          Removed from tracker
        </div>
      `;
    }

    const changes = Array.isArray(entry.changes) && entry.changes.length
      ? entry.changes
      : [entry];

    return `
      <div class="changeCompareBox">
        ${changes.map(change => `
          <div class="changeCompareLine">
            <span class="changeCompareLabel">${escapeHtml(compareLabel(change))}</span>
            <strong class="changeOld ${valueClass(displayOld(change))}">${escapeHtml(displayOld(change))}</strong>
            <b>→</b>
            <strong class="changeNew ${valueClass(displayNew(change))}">${escapeHtml(displayNew(change))}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function combineEntries(list){
    const combined = [];

    function buildGroupTime(entry){
      if(entry.timestamp) return String(entry.timestamp).slice(0, 16);
      return entry.time || '';
    }

    for(const entry of list){
      const key = entry.type === 'build_limit'
        ? [
            entry.date || '',
            buildGroupTime(entry),
            entry.map || '',
            entry.mode || '',
            entry.event || '',
            entry.type || ''
          ].join('|')
        : [
            entry.date || '',
            entry.timestamp || entry.time || '',
            entry.map || '',
            entry.mode || '',
            entry.event || '',
            entry.type || ''
          ].join('|');

      const canCombine = entry.type === 'build_limit';

      const existing = canCombine
        ? combined.find(item => item.key === key)
        : null;

      if(existing){
        existing.entry.changes.push(entry);
        continue;
      }

      combined.push({
        key,
        entry: {
          ...entry,
          label: entry.type === 'build_limit' ? 'Build Limit' : changeLabel(entry),
          changes: [entry]
        }
      });
    }

    return combined.map(item => item.entry);
  }

  function fullDateLabel(entry){
    if(!entry.timestamp) return entry.date || 'Unknown Date';

    const date = new Date(entry.timestamp);

    if(Number.isNaN(date.getTime())) return entry.date || 'Unknown Date';

    return date.toLocaleDateString([], {
      month:'long',
      day:'numeric',
      year:'numeric'
    });
  }

  function groupDateLabel(entry){
    if(!entry.timestamp) return entry.date || 'Unknown Date';

    const date = new Date(entry.timestamp);

    if(Number.isNaN(date.getTime())) return entry.date || 'Unknown Date';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if(sameDay(date, today)) return 'Today';
    if(sameDay(date, yesterday)) return 'Yesterday';

    return fullDateLabel(entry);
  }

  function groupByDate(list){
    return list.reduce((groups, entry) => {
      const date = groupDateLabel(entry);

      if(!groups[date]){
        groups[date] = [];
      }

      groups[date].push(entry);

      groups[date].sort((a, b) =>
        new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      );

      return groups;
    }, {});
  }

  function render(){
    const q = els.search.value.trim().toLowerCase();
    const type = els.type.value;
    const mode = els.mode.value;

    const filtered = entries.filter(entry => {
      const text = [
        entry.date,
        entry.type,
        entry.map,
        entry.mode,
        entry.event,
        entry.label,
        entry.old,
        entry.new,
        entry.timestamp,
        entry.time
      ].join(' ').toLowerCase();

      if(q && !text.includes(q)) return false;
      if(type !== 'all' && entry.type !== type) return false;
      if(mode !== 'all'){
        const isSeasonal = entry.mode === 'Seasonal' || !!entry.event;
        if(mode === 'Seasonal' && !isSeasonal) return false;
        if(mode !== 'Seasonal' && entry.mode !== mode) return false;
      }

      return true;
    });

    const groupedEntries = combineEntries(filtered);
    const groups = groupByDate(groupedEntries);

    els.list.innerHTML = Object.entries(groups)
      .sort((a, b) => {
        const ta = Math.max(...a[1].map(r => new Date(r.timestamp || 0).getTime()));
        const tb = Math.max(...b[1].map(r => new Date(r.timestamp || 0).getTime()));
        return tb - ta;
      })
      .map(([date, rows]) => `
      <div class="changeDateGroup">
        <div class="changeDateLabel" title="${escapeHtml(fullDateLabel(rows[0]))}">${escapeHtml(date)}</div>

        <div class="changeRows">
          ${rows.map(entry => {
            if(entry.type === 'site_change'){
              return `
                <article class="changeRow changeRow-siteChange ${isUnreadEntry(entry) ? 'changeRow-unread' : ''}">
                  <div class="changeTime">${escapeHtml(formatLocalTime(entry))}</div>

                  <div class="changePill changeType-site-change">
                    <span class="changeTypeIcon ${typeIconClass(entry.type)}" aria-hidden="true"></span>
                    ${typeLabel(entry.type)}
                  </div>

                  <div class="changeSiteMessage">
                    ${escapeHtml(displayNew(entry))}
                  </div>
                </article>
              `;
            }

            return `

            <article class="changeRow ${entry.type === 'rotation' && entry.field === 'rotation_summary' ? 'changeRow-rotationGroup' : ''} ${entry.type === 'site_change' ? 'changeRow-siteChange' : ''} ${isUnreadEntry(entry) ? 'changeRow-unread' : ''}">
              <div class="changeTime">${escapeHtml(formatLocalTime(entry))}</div>

              <div class="changePill changeType-${escapeHtml(String(entry.type || 'info').replace(/_/g, '-'))}">
                <span class="changeTypeIcon ${typeIconClass(entry.type)}" aria-hidden="true"></span>
                ${typeLabel(entry.type)}
              </div>

              ${entry.type === 'rotation' && entry.field === 'rotation_summary' || entry.type === 'site_change' ? '' : `
                <a class="changeMap" href="${escapeHtml(mapUrl(entry))}">
                  <span class="changeThumb" style="background-image:url('assets/map-images/${slugify(entry.map)}/main.webp')"></span>

                  <div>
                    <strong>${escapeHtml(`${eventIcon(entry)} ${entry.map || '—'}`.trim())}</strong>
                    <small>${escapeHtml(entry.event || entry.mode === 'Seasonal' ? 'Seasonal' : entry.mode || '')}</small>
                  </div>
                </a>
              `}

              <div class="changeCompare">
                ${compareBlock(entry)}
              </div>
            </article>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    const today = new Date();

    const isToday = entry => {
      const date = new Date(entry.timestamp || entry.date || '');

      return !Number.isNaN(date.getTime()) &&
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
    };

    els.total.textContent = entries.length;
    els.today.textContent = entries.filter(isToday).length;
    els.rotation.textContent = entries.filter(e => e.type === 'rotation').length;
  }

  els.search.addEventListener('input', debounce(render));
  els.type.addEventListener('change', render);
  els.mode.addEventListener('change', render);

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;

    els.search.value = '';
    els.type.value = 'all';
    els.mode.value = 'all';
    render();
  });

  els.list.addEventListener('click', e => {
    const btn = e.target.closest('.changeRotationToggle');
    if(!btn) return;

    const column = btn.closest('.changeRotationColumn');
    if(!column) return;

    column.classList.toggle('is-expanded');

    const count = column.querySelectorAll('.changeRotationMap').length;
    btn.textContent = column.classList.contains('is-expanded')
      ? 'Show fewer maps'
      : `Show all ${count} maps`;
  });

  render();

  if(newestIdAtPageLoad){
    localStorage.setItem(CHANGELOG_SEEN_KEY, newestIdAtPageLoad);
  }
  })();