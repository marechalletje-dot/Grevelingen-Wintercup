// Ingesproken meldingen: opnemen (microfoon), bewaren (IndexedDB, op dit apparaat), afspelen als reeks, exporteren/importeren.
import { CLIPS, complete, trimSilence, normalize } from '../core/clips.js';
const DBN = 'wintercup-clips', OS = 'clips';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(OS); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(OS, mode); const s = t.objectStore(OS); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };

export function initClips({ getCtx, onChange = () => {} }) {
  const mem = new Map();   // sleutel -> {sr, pcm: Float32Array}
  const bufs = new Map();  // sleutel -> AudioBuffer
  let playing = [], until = 0, ready = false;
  const have = () => new Set(mem.keys());
  async function load() {
    try {
      const db = await idb();
      await new Promise((res) => { const t = db.transaction(OS, 'readonly'); const c = t.objectStore(OS).openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { const v = cur.value; mem.set(cur.key, { sr: v.sr, pcm: new Float32Array(v.pcm) }); cur.continue(); } };
        t.oncomplete = res; t.onerror = res; });
    } catch (e) {}
    ready = true; onChange();
  }
  async function put(k, sr, pcm) { mem.set(k, { sr, pcm }); bufs.delete(k); try { await tx('readwrite', s => s.put({ sr, pcm: pcm.buffer.slice(0) }, k)); } catch (e) {} onChange(); }
  async function del(k) { mem.delete(k); bufs.delete(k); try { await tx('readwrite', s => s.delete(k)); } catch (e) {} onChange(); }
  async function clear() { mem.clear(); bufs.clear(); try { await tx('readwrite', s => s.clear()); } catch (e) {} onChange(); }
  function buf(ac, k) { let b = bufs.get(k); if (b) return b; const c = mem.get(k); b = ac.createBuffer(1, c.pcm.length, c.sr); b.copyToChannel(c.pcm, 0); bufs.set(k, b); return b; }
  function stop() { for (const s of playing) { try { s.stop(); } catch (e) {} } playing = []; until = 0; }
  /** Speelt de reeks af als alle fragmenten er zijn; geeft false terug als er iets ontbreekt (dan gebruikt de app de telefoonstem). */
  function play(keys, cut) {
    if (!keys || !keys.length || !complete(keys, have())) return false;
    const ac = getCtx(); if (!ac) return false;
    if (cut) stop();
    let t = Math.max(ac.currentTime + 0.03, until);
    const srcs = [];
    for (const k of keys) { const b = buf(ac, k); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(t); srcs.push(s); t += b.duration + 0.06; }
    playing = playing.concat(srcs); until = t; srcs[srcs.length - 1].onended = () => { playing = playing.filter(s => !srcs.includes(s)); };
    return true;
  }
  // ---------- opnemen ----------
  let stream = null, rec = null, recKey = null, recTimer = 0;
  async function startRec(k, onDone) {
    const ac = getCtx();
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const chunks = []; rec = new MediaRecorder(stream); recKey = k;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      clearTimeout(recTimer); const blob = new Blob(chunks, { type: rec.mimeType || 'audio/mp4' }); rec = null;
      try {
        const ab = await blob.arrayBuffer(); const au = await new Promise((res, rej) => ac.decodeAudioData(ab, res, rej));
        let x = au.getChannelData(0); x = trimSilence(x, au.sampleRate); if (x.length < au.sampleRate * 0.08) throw new Error('te kort / geen geluid');
        x = normalize(x); await put(k, au.sampleRate, Float32Array.from(x)); onDone(null);
      } catch (e) { onDone(e); }
    };
    rec.start(); recTimer = setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 4000);
  }
  function stopRec() { if (rec && rec.state === 'recording') rec.stop(); }
  function closeMic() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  // ---------- export / import ----------
  function exportJson() {
    const out = { v: 1, app: 'wintercup', clips: {} };
    for (const [k, c] of mem) { const i16 = new Int16Array(c.pcm.length); for (let i = 0; i < c.pcm.length; i++) i16[i] = Math.max(-32767, Math.min(32767, Math.round(c.pcm[i] * 32767)));
      let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); out.clips[k] = { sr: c.sr, b64: btoa(s) }; }
    return JSON.stringify(out);
  }
  async function importJson(txt) {
    const o = JSON.parse(txt); if (!o || o.app !== 'wintercup' || !o.clips) throw new Error('geen Wintercup-opnamebestand'); let n = 0;
    for (const [k, c] of Object.entries(o.clips)) { if (!CLIPS.some(x => x.k === k)) continue; const bin = atob(c.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const i16 = new Int16Array(u8.buffer); const f = new Float32Array(i16.length); for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767; await put(k, c.sr, f); n++; }
    return n;
  }
  // ---------- opnamescherm ----------
  function open() {
    let ov = document.getElementById('recOv'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'recOv'; ov.className = 'recov';
    const groups = [...new Set(CLIPS.map(c => c.g))];
    ov.innerHTML = `<div class="recbox"><div class="rechd"><b>Meldingen inspreken</b><span id="recCnt"></span><button type="button" class="recx" id="recClose" aria-label="Sluiten">×</button></div>
      <p class="sub">Tik op <b>●</b>, spreek het woord duidelijk in en tik op <b>■</b> (of wacht 4 seconden). Stilte voor en na wordt automatisch weggeknipt. Met <b>▶</b> luister je terug. Een melding gebruikt je opnames zodra alle stukjes van die melding zijn ingesproken; anders spreekt de telefoonstem.</p>
      <div class="reclist">${groups.map(g => `<h3>${g}</h3>` + CLIPS.filter(c => c.g === g).map(c => `<div class="recrow" data-k="${c.k}"><span class="rect">${c.t}</span><span class="recst"></span><button type="button" class="recb rec" title="Opnemen">●</button><button type="button" class="recb play" title="Afspelen">▶</button><button type="button" class="recb del" title="Wissen">✕</button></div>`).join('')).join('')}</div>
      <div class="recfoot"><button type="button" id="recExp" class="act alt">Exporteren</button><label class="act alt recimp">Importeren<input type="file" id="recImp" accept=".json,application/json" hidden></label><button type="button" id="recClr" class="act alt">Alles wissen</button></div>
      <div class="sub" id="recMsg"></div></div>`;
    document.body.appendChild(ov);
    const msg = t => { ov.querySelector('#recMsg').textContent = t; };
    const refresh = () => { ov.querySelector('#recCnt').textContent = `${mem.size} van ${CLIPS.length}`;
      ov.querySelectorAll('.recrow').forEach(r => { const ok = mem.has(r.dataset.k); r.classList.toggle('done', ok); r.querySelector('.recst').textContent = ok ? '✓' : ''; r.querySelector('.play').disabled = !ok; r.querySelector('.del').disabled = !ok; }); };
    refresh();
    ov.querySelector('#recClose').onclick = () => { stopRec(); closeMic(); ov.remove(); };
    ov.querySelectorAll('.recrow').forEach(r => {
      const k = r.dataset.k, rb = r.querySelector('.rec');
      rb.onclick = async () => {
        if (rec && recKey === k) { stopRec(); return; }
        if (rec) return;
        try { getCtx(); rb.textContent = '■'; r.classList.add('recording'); msg('Opnemen… spreek nu: “' + CLIPS.find(c => c.k === k).t + '”');
          await startRec(k, err => { rb.textContent = '●'; r.classList.remove('recording'); refresh();
            if (err) { msg('Niet gelukt (' + err.message + '). Probeer opnieuw, iets dichter bij de microfoon.'); return; }
            msg(''); play([k], true); const nx = [...ov.querySelectorAll('.recrow')].find(x => !mem.has(x.dataset.k)); if (nx) nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
        } catch (e) { rb.textContent = '●'; r.classList.remove('recording'); msg('Geen toegang tot de microfoon. Sta de microfoon toe voor deze site/app en probeer opnieuw.'); }
      };
      r.querySelector('.play').onclick = () => { getCtx(); play([k], true); };
      r.querySelector('.del').onclick = async () => { await del(k); refresh(); };
    });
    ov.querySelector('#recExp').onclick = () => { const b = new Blob([exportJson()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wintercup-stem.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    ov.querySelector('#recImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const n = await importJson(await f.text()); msg(`${n} opnames geïmporteerd.`); refresh(); } catch (er) { msg('Importeren mislukt: ' + er.message); } };
    ov.querySelector('#recClr').onclick = async () => { if (!confirm('Alle opnames op dit apparaat wissen?')) return; await clear(); refresh(); };
  }
  load();
  return { have, play, stop, open, put, count: () => mem.size, total: CLIPS.length, ready: () => ready, exportJson, importJson };
}
