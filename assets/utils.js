async function loadData(){
  const res = await fetch('./data/maps.json', { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load maps.json: ${res.status}`);
  return await res.json();
}

async function loadSeasonalData(){
  const res = await fetch('./data/seasonal_maps.json', { cache: 'no-store' });
  if(!res.ok) return { maps: [] };
  return await res.json();
}


function norm(s){ return (s ?? '').toString().trim().toLowerCase(); }

function byName(a,b){
  return (a.name||'').localeCompare((b.name||''), undefined, {sensitivity:'base'});
}

function uniq(values){
  const set = new Set(values.filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b, undefined, {sensitivity:'base'}));
}

function revealOnLoad(root = document){
  const targets = root.querySelectorAll(
    '.card, .mapcard, .tablewrap, .controls, header.wrap, footer.wrap'
  );

  let i = 0;
  for(const el of targets){
    el.classList.add('reveal');

    // stagger
    el.style.animationDelay = `${Math.min(i * 35, 420)}ms`;
    i++;
  }

  // next frame so CSS applies before we flip it on
  requestAnimationFrame(()=>{
    for(const el of targets){
      el.classList.add('is-in');
    }
  });
}

const CHANGELOG_SEEN_KEY = 'bedwars_changelog_seen_id';

async function updateChangelogBadge({ clear = false } = {}){
  const badge = document.querySelector('.navAlertBadge');
  if(!badge) return;

  let data;
  try{
    const res = await fetch('./data/changelog.json', { cache: 'no-store' });
    if(!res.ok) return;
    data = await res.json();
  }catch{
    return;
  }

  const entries = Array.isArray(data.entries) ? data.entries : [];
  const groups = [];

  function buildGroupTime(entry){
    if(entry.timestamp) return String(entry.timestamp).slice(0, 16);
    return entry.time || '';
  }

  for(const entry of entries){
    const key = entry.type === 'build_limit'
      ? [
          entry.date || '',
          buildGroupTime(entry),
          entry.map || '',
          entry.mode || '',
          entry.event || '',
          entry.type || ''
        ].join('|')
      : String(entry.id || entry.timestamp || '');

    if(!groups.some(group => group.key === key)){
      groups.push({
        key,
        newestId: entry.id
      });
    }
  }

  const newestId = groups[0]?.newestId;
  if(!newestId) return;

  if(clear){
    localStorage.setItem(CHANGELOG_SEEN_KEY, newestId);
    badge.hidden = true;
    return;
  }

  const seenId = localStorage.getItem(CHANGELOG_SEEN_KEY);

  if(!seenId){
    localStorage.setItem(CHANGELOG_SEEN_KEY, newestId);
    badge.hidden = true;
    return;
  }

  const seenIndex = groups.findIndex(group => String(group.newestId) === String(seenId));

  if(seenIndex <= 0){
    badge.hidden = true;
    return;
  }

  badge.textContent = seenIndex > 99 ? '99+' : String(seenIndex);
  badge.hidden = false;
}
