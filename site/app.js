// --- Theme & Color Config ---
const modal = document.getElementById('modal');
const btnTheme = document.getElementById('btn-theme');
const btnColors = document.getElementById('btn-colors');
const btnClose = document.getElementById('btn-close');
const cAccent = document.getElementById('c-accent');
const cStop1 = document.getElementById('c-stop1');
const cStop2 = document.getElementById('c-stop2');
const cRing = document.getElementById('c-ring');

async function applyConfig(){
  try{
    const res = await fetch('./config.json?ts='+Date.now());
    if(res.ok){
      const cfg = await res.json();
      const themePref = localStorage.getItem('player.theme') || cfg.defaultTheme || 'auto';
      setTheme(themePref);
      const saved = JSON.parse(localStorage.getItem('player.colors')||'null');
      const colors = saved || cfg.viz || {};
      setColors(colors);
      if(cfg.accent) document.documentElement.style.setProperty('--accent', cfg.accent);
    }else{
      setTheme(localStorage.getItem('player.theme') || 'auto');
    }
  }catch(e){
    setTheme(localStorage.getItem('player.theme') || 'auto');
  }
}

function setTheme(mode){
  const b = document.body;
  b.classList.remove('theme-dark','theme-light');
  if(mode==='dark') b.classList.add('theme-dark');
  else if(mode==='light') b.classList.add('theme-light');
  localStorage.setItem('player.theme', mode);
}

function setColors(colors){
  const r = document.documentElement;
  const bars = colors.bars || {};
  if(colors.accent) r.style.setProperty('--accent', colors.accent);
  if(bars.stop1) r.style.setProperty('--viz-stop1', bars.stop1);
  if(bars.stop2) r.style.setProperty('--viz-stop2', bars.stop2);
  if(colors.ring) r.style.setProperty('--viz-ring', colors.ring);

  // sync pickers
  cAccent && (cAccent.value = rgbToHex(getComputedStyle(r).getPropertyValue('--accent')));
  cStop1 && (cStop1.value = rgbToHex(getComputedStyle(r).getPropertyValue('--viz-stop1')));
  cStop2 && (cStop2.value = rgbToHex(getComputedStyle(r).getPropertyValue('--viz-stop2')));
  cRing && (cRing.value = rgbToHex(getComputedStyle(r).getPropertyValue('--viz-ring')));
}

function rgbToHex(rgb){
  rgb = rgb.trim();
  if(rgb.startsWith('#')) return rgb;
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if(!m) return '#6ea8fe';
  const toHex = (n)=> ('0'+parseInt(n,10).toString(16)).slice(-2);
  return '#' + toHex(m[1]) + toHex(m[2]) + toHex(m[3]);
}

// Simple SPA music player with WebAudio visualizer
const audio = document.getElementById('audio');
const listEl = document.getElementById('list');
const treeEl = document.getElementById('tree');
const searchEl = document.getElementById('search');
const viz = document.getElementById('viz');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const npTitle = document.getElementById('np-title');
const npArtist = document.getElementById('np-artist');
const seek = document.getElementById('seek');
const timeEl = document.getElementById('time');
const vol = document.getElementById('vol');

let ctx, analyser, srcNode, rafId;
let allTracks = [];
let filteredTracks = [];
let queue = [];
let currentIndex = -1;
let treeData = {};

function fmtTime(sec){
  if(!isFinite(sec)) return "00:00";
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function groupByPath(tracks){
  const root = {};
  for(const tr of tracks){
    const parts = tr.groupPath ? tr.groupPath.split('/').filter(Boolean) : [];
    let node = root;
    for(const p of parts){
      node[p] = node[p] || {__children__: {}};
      node = node[p].__children__;
    }
    node.__list__ = node.__list__ || [];
    node.__list__.push(tr);
  }
  return root;
}

function pickBestSource(sources){
  const can = (mime)=> audio.canPlayType(mime) !== '';
  const order = [
    (s)=> s.mime?.includes('mp4') && can('audio/mp4'),
    (s)=> s.mime?.includes('mpeg') && can('audio/mpeg'),
    (s)=> s.mime?.includes('flac') && can('audio/flac'),
    (s)=> s.mime && can(s.mime)
  ];
  for(const test of order){
    const found = sources.find(test);
    if(found) return found.url;
  }
  return sources[0]?.url || "";
}

function buildList(tracks){
  listEl.innerHTML = '';
  tracks.forEach((tr, idx)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.index = idx;

    const title = document.createElement('div');
    title.className = 't';
    title.textContent = tr.title;

    const right = document.createElement('div');
    right.innerHTML = `<div class="t">${tr.artist || '—'}</div><div class="muted">${tr.album || tr.groupPath || ''}</div>`;

    const dur = document.createElement('div');
    dur.textContent = tr.duration ? fmtTime(tr.duration) : '—';

    row.appendChild(title);
    row.appendChild(right);
    row.appendChild(dur);

    row.addEventListener('click', ()=> playIndex(idx));

    listEl.appendChild(row);
  });
}

function buildTree(node, path=[], container=treeEl){
  container.innerHTML = '';
  const entries = Object.entries(node).filter(([k])=>k!=='__list__').sort();
  const frag = document.createDocumentFragment();

  function addGroup(name, obj, parentPath){
    const group = document.createElement('div');
    group.className = 'group';
    group.textContent = name;
    const childrenWrap = document.createElement('div');
    childrenWrap.className = 'children';
    let open = false;
    group.addEventListener('click', ()=>{
      open = !open;
      childrenWrap.style.display = open ? 'block' : 'none';
    });
    frag.appendChild(group);
    frag.appendChild(childrenWrap);

    const innerEntries = Object.entries(obj.__children__ || {}).filter(([k])=>k!=='__list__').sort();
    for(const [n, child] of innerEntries){
      addGroup(n, child, parentPath.concat(name));
    }
    const list = obj.__children__?.__list__ || obj.__list__ || [];
    if(list.length){
      const ul = document.createElement('div');
      for(const tr of list){
        const item = document.createElement('div');
        item.className = 'group item';
        item.textContent = `♪ ${tr.title}`;
        item.addEventListener('click', (e)=>{
          e.stopPropagation();
          const idx = filteredTracks.findIndex(x=>x.id===tr.id);
          if(idx>=0) playIndex(idx);
        });
        ul.appendChild(item);
      }
      childrenWrap.appendChild(ul);
    }
  }

  for(const [name,obj] of entries){
    addGroup(name, obj, []);
  }

  if(node.__list__){
    const div = document.createElement('div');
    div.className = 'children';
    for(const tr of node.__list__){
      const item = document.createElement('div');
      item.className = 'group item';
      item.textContent = `♪ ${tr.title}`;
      item.addEventListener('click', (e)=>{
        e.stopPropagation();
        const idx = filteredTracks.findIndex(x=>x.id===tr.id);
        if(idx>=0) playIndex(idx);
      });
      div.appendChild(item);
    }
    frag.appendChild(div);
  }

  container.appendChild(frag);
}

function filterTracks(){
  const q = searchEl.value.trim().toLowerCase();
  if(!q){
    filteredTracks = allTracks.slice();
  }else{
    filteredTracks = allTracks.filter(tr=>{
      return (tr.title||'').toLowerCase().includes(q)
          || (tr.artist||'').toLowerCase().includes(q)
          || (tr.album||'').toLowerCase().includes(q)
          || (tr.groupPath||'').toLowerCase().includes(q);
    });
  }
  buildList(filteredTracks);
}

async function load(){
  await applyConfig();

  let data = {tracks:[]};
  try{
    const res = await fetch('./index.json?ts=' + Date.now());
    if(res.ok){
      data = await res.json();
    } else {
      console.warn('index.json not found or invalid status', res.status);
    }
  }catch(e){
    console.warn('Failed to load index.json', e);
  }

  allTracks = data.tracks || [];
  filteredTracks = allTracks.slice();
  buildList(filteredTracks);

  const tree = groupByPath(allTracks);
  buildTree(tree);

  const saved = JSON.parse(localStorage.getItem('player.state') || '{}');
  if(saved.id){
    const idx = allTracks.findIndex(t=>t.id===saved.id);
    if(idx>=0){
      queue = filteredTracks;
      playIndex(idx, false);
      if(saved.time) audio.currentTime = saved.time;
    }
  }
}

function playIndex(idx, autoplay=true){
  queue = filteredTracks;
  currentIndex = idx;
  const tr = queue[idx];
  const url = pickBestSource(tr.sources || []);
  if(!url){ console.warn('No playable source'); return; }
  audio.src = url;
  npTitle.textContent = tr.title || '—';
  npArtist.textContent = tr.artist || tr.album || tr.groupPath || '—';

  document.querySelectorAll('.row').forEach((el,i)=>{
    el.classList.toggle('active', i===idx);
  });

  if(autoplay){
    audio.play().catch(()=>{});
  }
  ensureAudioGraph();
  updateMediaSession(tr);
  saveState();
}

function ensureAudioGraph(){
  if(!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    srcNode = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    srcNode.connect(analyser);
    analyser.connect(ctx.destination);
  }
  if(rafId) cancelAnimationFrame(rafId);
  draw();
}

function draw(){
  const dpr = window.devicePixelRatio || 1;
  const w = viz.clientWidth, h = viz.clientHeight;
  if(viz.width !== w*dpr || viz.height !== h*dpr){
    viz.width = w*dpr;
    viz.height = h*dpr;
  }
  const cx = viz.getContext('2d');
  cx.setTransform(dpr,0,0,dpr,0,0);
  cx.clearRect(0,0,w,h);

  const bufferLen = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLen);
  analyser.getByteFrequencyData(dataArray);

  const grad = cx.createLinearGradient(0,0,0,h);
  const stop1 = getComputedStyle(document.documentElement).getPropertyValue('--viz-stop1').trim()||'#9ec5ff';
  const stop2 = getComputedStyle(document.documentElement).getPropertyValue('--viz-stop2').trim()||'#6ea8fe';
  grad.addColorStop(0, stop1);
  grad.addColorStop(1, stop2);
  cx.fillStyle = grad;

  const bars = Math.min(96, bufferLen);
  const step = Math.floor(bufferLen / bars);
  const bw = Math.max(2, w/(bars*1.2));
  const gap = bw*0.2;
  for(let i=0;i<bars;i++){
    const v = dataArray[i*step]/255;
    const bh = Math.pow(v, 1.4) * (h*0.9);
    const x = i*(bw+gap)+8;
    const y = h - bh - 8;
    cx.shadowColor = 'rgba(110,168,254,0.6)';
    cx.shadowBlur = 14;
    cx.fillRect(x,y,bw,bh);
  }

  const avg = dataArray.reduce((a,b)=>a+b,0)/dataArray.length/255;
  const cxm = w-120, cym = 120;
  const r = 60 + avg*26;
  const ring = getComputedStyle(document.documentElement).getPropertyValue('--viz-ring').trim()||'#9ec5ff';
  cx.beginPath();
  cx.arc(cxm, cym, r, 0, Math.PI*2);
  cx.strokeStyle = ring;
  cx.lineWidth = 6;
  cx.shadowBlur = 22;
  cx.shadowColor = ring;
  cx.stroke();

  rafId = requestAnimationFrame(draw);
}

function saveState(){
  const tr = queue[currentIndex];
  localStorage.setItem('player.state', JSON.stringify({
    id: tr?.id,
    time: audio.currentTime || 0
  }));
}

function updateMediaSession(tr){
  if('mediaSession' in navigator){
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tr.title || '',
      artist: tr.artist || '',
      album: tr.album || '',
    });
    navigator.mediaSession.setActionHandler('previoustrack', ()=> prev());
    navigator.mediaSession.setActionHandler('nexttrack', ()=> next());
    navigator.mediaSession.setActionHandler('pause', ()=> audio.pause());
    navigator.mediaSession.setActionHandler('play', ()=> audio.play());
  }
}

function next(){ if(currentIndex < queue.length-1) playIndex(currentIndex+1); }
function prev(){ if(currentIndex > 0) playIndex(currentIndex-1); }

audio.addEventListener('timeupdate', ()=>{
  if(audio.duration){
    seek.value = Math.floor((audio.currentTime/audio.duration)*1000);
    timeEl.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
    saveState();
  }
});
seek.addEventListener('input', ()=>{
  if(audio.duration){
    audio.currentTime = (seek.value/1000)*audio.duration;
  }
});
vol.addEventListener('input', ()=>{ audio.volume = parseFloat(vol.value); });

btnPlay.addEventListener('click', async ()=>{
  if(!ctx) ensureAudioGraph();
  if(audio.paused){
    try{ await audio.play(); }catch(e){}
    btnPlay.textContent = '⏸';
  } else {
    audio.pause();
    btnPlay.textContent = '▶️';
  }
});
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);

audio.addEventListener('play', ()=>{ btnPlay.textContent='⏸'; });
audio.addEventListener('pause', ()=>{ btnPlay.textContent='▶️'; });
audio.addEventListener('ended', ()=> next());

// try next source on decode/network error
audio.addEventListener('error', ()=>{
  const tr = queue[currentIndex];
  if(!tr) return;
  const s = (tr.sources || []).slice();
  if(s.length > 1){
    tr.sources = s.slice(1).concat(s[0]);
    const nextUrl = pickBestSource(tr.sources || []);
    if(nextUrl && nextUrl !== audio.src){
      audio.src = nextUrl;
      audio.play().catch(()=>{});
      return;
    }
  }
  console.warn('All sources failed for track:', tr?.title);
});

searchEl.addEventListener('input', filterTracks);
window.addEventListener('keydown', (e)=>{
  if(e.target.matches('input,textarea')) return;
  if(e.code === 'Space'){ e.preventDefault(); btnPlay.click(); }
  if(e.code === 'ArrowRight'){ audio.currentTime = Math.min(audio.duration||0, audio.currentTime+5); }
  if(e.code === 'ArrowLeft'){ audio.currentTime = Math.max(0, audio.currentTime-5); }
  if(e.code === 'ArrowUp'){ audio.volume = Math.min(1, audio.volume+0.05); vol.value = audio.volume; }
  if(e.code === 'ArrowDown'){ audio.volume = Math.max(0, audio.volume-0.05); vol.value = audio.volume; }
  if(e.key.toLowerCase()==='n'){ next(); }
  if(e.key.toLowerCase()==='p'){ prev(); }
});

load();
