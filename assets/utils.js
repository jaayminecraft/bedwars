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

