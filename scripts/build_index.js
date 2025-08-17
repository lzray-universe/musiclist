#!/usr/bin/env node
/**
 * Generate index.json by scanning the ./music directory recursively.
 * Outputs to ./index.json (root).
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.MUSIC_BASE || 'music';
const exts = new Set(['.mp3','.m4a','.aac','.flac','.ogg','.wav','.webm']);

function walk(dir){
  let results = [];
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, ent.name);
    if(ent.isDirectory()){
      results = results.concat(walk(p));
    }else if(ent.isFile()){
      const ext = path.extname(ent.name).toLowerCase();
      if(exts.has(ext)){
        const rel = path.relative('.', p).replace(/\\/g,'/');
        const title = path.basename(ent.name, ext);
        results.push({
          id: rel,
          title,
          artist: '',
          album: '',
          src: './' + rel,
          ext: ext.slice(1)
        });
      }
    }
  }
  return results;
}

function main(){
  if(!fs.existsSync(BASE)){
    console.error(`[build_index] Directory "${BASE}" not found. Skipping; index.json will be empty.`);
    fs.writeFileSync('index.json', JSON.stringify({ generated_at: new Date().toISOString(), tracks: [] }, null, 2));
    return;
  }
  const tracks = walk(BASE);
  tracks.sort((a,b)=> a.title.localeCompare(b.title,'zh-Hans'));
  const out = { generated_at: new Date().toISOString(), tracks };
  fs.writeFileSync('index.json', JSON.stringify(out, null, 2));
  console.log(`[build_index] Wrote index.json with ${tracks.length} tracks.`);
}

if (require.main === module) main();
