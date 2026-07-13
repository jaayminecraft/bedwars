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

  // normalize to midnight local to avoid DST hour weirdness
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

function genBBCodeToHTML(value){
  const raw = String(value || '').trim();
  if(!raw) return '';

  return raw.replace(
    /\[COLOR=rgb\(([^)]+)\)\](.*?)\[\/COLOR\]/gi,
    '<span style="color:rgb($1)">$2</span>'
  );
}

function updateNextRotationCountdown(meta){
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

function debounce(fn, delay = 90){
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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
