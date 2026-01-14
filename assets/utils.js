function basePath(){
  // If hosted at https://jaayminecraft.github.io/bedwars/
  // this returns "/bedwars"
  return window.location.pathname.replace(/\/[^\/]*$/, '');
}

async function loadData(){
  const res = await fetch(`${basePath()}/data/maps.json`, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load maps.json: ${res.status}`);
  return await res.json();
}

async function loadSeasonalData(){
  const res = await fetch(`${basePath()}/data/seasonal_maps.json`, { cache: 'no-store' });
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
