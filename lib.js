/* ============ Utilitaires ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => setTimeout(r, 0));

/* ============ ZIP (lecture / écriture, sans bibliothèque) ============ */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function pipeBytes(u8, stream) { const s = new Blob([u8]).stream().pipeThrough(stream); return new Uint8Array(await new Response(s).arrayBuffer()); }
const inflateRaw = u8 => pipeBytes(u8, new DecompressionStream('deflate-raw'));
const deflateRaw = u8 => pipeBytes(u8, new CompressionStream('deflate-raw'));

function readZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Fichier ZIP invalide');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const td = new TextDecoder(); const out = [];
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompu');
    const method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    out.push({ name, method, time, date, crc, cs, us, data: u8.subarray(ds, ds + cs) });
    p += 46 + nl + el + cl;
  }
  return out;
}
async function entryBytes(en) {
  if (en.method === 0) return en.data;
  if (en.method === 8) return inflateRaw(en.data);
  throw new Error('Compression ZIP non gérée : ' + en.method);
}
function writeZip(entries) {
  const te = new TextEncoder(); const parts = []; const cds = []; let off = 0;
  for (const en of entries) {
    const nb = te.encode(en.name);
    const h = new Uint8Array(30 + nb.length), dv = new DataView(h.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, en.method, true);
    dv.setUint16(10, en.time, true); dv.setUint16(12, en.date, true); dv.setUint32(14, en.crc, true); dv.setUint32(18, en.cs, true);
    dv.setUint32(22, en.us, true); dv.setUint16(26, nb.length, true); h.set(nb, 30);
    parts.push(h, en.data);
    const c = new Uint8Array(46 + nb.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, en.method, true);
    cv.setUint16(12, en.time, true); cv.setUint16(14, en.date, true); cv.setUint32(16, en.crc, true); cv.setUint32(20, en.cs, true);
    cv.setUint32(24, en.us, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true); c.set(nb, 46);
    cds.push(c); off += h.length + en.data.length;
  }
  let cdsz = 0; cds.forEach(c => cdsz += c.length);
  const eo = new Uint8Array(22), ev = new DataView(eo.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdsz, true); ev.setUint32(16, off, true);
  return concat([...parts, ...cds, eo]);
}
function concat(arrs) {
  let n = 0; arrs.forEach(a => n += a.length);
  const o = new Uint8Array(n); let p = 0; arrs.forEach(a => { o.set(a, p); p += a.length; }); return o;
}

/* ============ IndexedDB ============ */
const DB = {
  _db: null,
  async open() {
    if (this._db) return this._db;
    this._db = await new Promise((res, rej) => {
      const r = indexedDB.open('dgsdocs', 1);
      r.onupgradeneeded = () => { const d = r.result; ['kv', 'templates', 'entities', 'docs'].forEach(s => d.createObjectStore(s)); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._db;
  },
  async tx(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store);
      let out; Promise.resolve(fn(s)).then(v => out = v);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  get(store, k) { return this.tx(store, 'readonly', s => this.req(s.get(k))); },
  put(store, k, v) { return this.tx(store, 'readwrite', s => { s.put(v, k); }); },
  del(store, k) { return this.tx(store, 'readwrite', s => { s.delete(k); }); },
  keys(store) { return this.tx(store, 'readonly', s => this.req(s.getAllKeys())); },
  all(store) { return this.tx(store, 'readonly', s => this.req(s.getAll())); },
  clear(store) { return this.tx(store, 'readwrite', s => { s.clear(); }); }
};

/* ============ Clés de champs (même algorithme que dgs_fill.py) ============ */
function normKey(token) {
  let s = token.slice(1, -1).normalize('NFD').replace(/\p{Mn}/gu, '');
  s = s.replace(/°/g, '').replace(/’/g, ' ').replace(/'/g, ' ');  // même convention que le catalogue (extract_fields.py)
  s = s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().replace(/_+/g, '_');
  if (!s) return null;
  if (/^\d/.test(s)) s = 'F_' + s;
  return s;
}

/* ============ Remplissage du .docx (moteur dynamique) ============ */
const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const kids = (el, n) => el ? [...el.children].filter(c => c.localName === n) : [];
const kid = (el, n) => el ? ([...el.children].find(c => c.localName === n) || null) : null;
const wa = (el, a) => el ? (el.getAttributeNS(WNS, a) ?? el.getAttribute('w:' + a)) : null;

function runText(r) {
  let t = '';
  for (const c of r.children) {
    if (c.localName === 't') t += c.textContent;
    else if (c.localName === 'tab') t += '\t';
    else if (c.localName === 'br') t += '\n';
  }
  return t;
}
function setRunText(doc, r, text) {
  for (const c of [...r.children]) if (c.localName !== 'rPr') r.removeChild(c);
  const lines = String(text).split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (i > 0) r.appendChild(doc.createElementNS(WNS, 'w:br'));
    const t = doc.createElementNS(WNS, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    t.textContent = ln; r.appendChild(t);
  });
}
function clearShading(r) {
  const rPr = kid(r, 'rPr'); if (!rPr) return;
  for (const n of ['shd', 'color', 'b']) { const e = kid(rPr, n); if (e) rPr.removeChild(e); }
}

/* Champs génériques : un même mot (DATE, MONTANT…) a un sens différent à chaque endroit
   -> un champ distinct par occurrence (avec son contexte). Les autres champs sont partagés. */
const GENERIC = new Set(['DATE', 'MONTANT', 'DELAI', 'BLANK', 'A_COMPLETER', 'DUREE', 'TAUX', 'NOM_ET_FONCTION', 'INTITULE_DU_LOT', 'ADRESSE', 'NOMBRE', 'NOM', 'N', 'HEURE', 'LIEU', 'BANQUE', 'FONCTION', 'MODALITES', 'NOM_ET_PRENOM', 'N_CAUTION', 'A_COMPLETER_RIB', 'OBJET', 'ZONE', 'CONDITIONS', 'MOTIF', 'AUTRE_ANNEXE', 'N_CONSULTATION', 'NOM_TELEPHONE', 'NOM_DE_L_ANNEXE', 'EMAIL', 'TELEPHONE', 'DESIGNATION', 'DENOMINATION', 'FORME_JURIDIQUE', 'N_RC', 'NIF', 'NIS', 'QUALITE', 'AGENCE_ET_ADRESSE', 'CONTACT', 'NATIONALITE', 'N_PIECE_D_IDENTITE', 'AUTRE_PIECE_JOINTE', 'ETAPE', 'MODE', 'NOMS']);
const TOKRE = /\[[^\[\]]{1,120}\]/g;
const slug = s => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(-22).trim();
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const paraT = p => [...p.getElementsByTagNameNS(WNS, 't')];

/** Parcourt un document XML. mode 'scan' : collecte ; mode 'fill' : remplace. */
function walkXml(doc, part, mode, values, acc) {
  const isMain = part === 'word/document.xml';
  const have = id => { const v = values[id]; return v != null && String(v).trim() !== ''; };
  const toRemove = [];
  let boxN = acc.boxN || 0;
  for (const p of [...doc.getElementsByTagNameNS(WNS, 'p')]) {
    const ts = paraT(p); if (!ts.length) continue;
    let full = ts.map(t => t.textContent).join('');
    if (!full.includes('[') && !full.includes('☐')) continue;
    // --- Choix personne physique / morale
    const sm = /\[SI PERSONNE (PHYSIQUE|MORALE)\]\s*/.exec(full);
    if (sm && isMain) {
      if (mode === 'scan') { acc.party = true; for (const t of ts) t.textContent = t.textContent.replace(/\[SI PERSONNE (PHYSIQUE|MORALE)\]\s*/g, ''); full = ts.map(t => t.textContent).join(''); }
      else if (have('PARTY')) {
        if (values.PARTY !== sm[1]) { toRemove.push(p); continue; }
        for (const t of ts) t.textContent = t.textContent.replace(/\[SI PERSONNE (PHYSIQUE|MORALE)\]\s*/g, '');
      }
    }
    if (mode === 'fill' && have('PARTY') && /Supprimer la mention qui ne convient pas\.?\s*/.test(full))
      for (const t of ts) t.textContent = t.textContent.replace(/Supprimer la mention qui ne convient pas\.?\s*/, '');
    if (mode === 'fill') full = ts.map(t => t.textContent).join('');
    // positions des cases dans le paragraphe
    let off = 0;
    for (const t of ts) {
      const orig = t.textContent; const base = off; off += orig.length;
      if (!orig.includes('[') && !orig.includes('☐')) continue;
      const run = t.parentNode; const single = kids(run, 't').length === 1;
      const trimmed = orig.trim();
      let whole = null;
      let out = orig.replace(/☐|\[[^\[\]]{1,120}\]/g, (tok, idx) => {
        const pos = base + idx;
        if (tok === '☐') {
          if (!isMain) return tok;
          const id = 'B' + (boxN++);
          if (mode === 'scan') { const nx = full.indexOf('☐', pos + 1); acc.boxes.push({ id, label: full.slice(pos + 1, nx < 0 ? undefined : nx).replace(/\s+/g, ' ').trim().slice(0, 70) || 'Case' }); return tok; }
          if (values[id] === true) { acc.used.add(id); return '☒'; } return tok;
        }
        if (/^\[SI PERSONNE/.test(tok) || tok.startsWith('[À VALIDER')) return tok;
        let key = null;
        const inner = tok.slice(1, -1);
        if (inner.trim() === '') key = 'BLANK'; else key = normKey(tok);
        if (!key) return tok;
        const before = full.slice(Math.max(0, pos - 70), pos);
        const id = GENERIC.has(key) ? key + '@' + (slug(before) || 'x') : key;
        if (mode === 'scan') {
          if (!acc.map.has(id)) {
            const after = full.slice(pos + tok.length, pos + tok.length + 22);
            const lab = inner.trim() ? capFirst(inner.trim()) : 'Valeur';
            acc.map.set(id, { id, key, label: lab, generic: GENERIC.has(key), n: 1, before: before.slice(-48), after, tok });
            acc.list.push(acc.map.get(id));
          } else acc.map.get(id).n++;
          return tok;
        }
        if (have(id)) {
          acc.used.add(id);
          const val = String(values[id]).trim();
          if (single && trimmed === tok) whole = val;
          return val.replace(/\s*\r?\n\s*/g, ' ');
        }
        return tok;
      });
      if (mode === 'fill' && out !== orig) {
        if (whole !== null && /\n/.test(whole)) { setRunText(doc, run, whole); clearShading(run); }
        else { t.textContent = out; t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); if (whole !== null) clearShading(run); }
      }
    }
  }
  acc.boxN = boxN;
  for (const p of toRemove) {
    const par = p.parentNode;
    if (kids(par, 'p').length > 1) par.removeChild(p); else paraT(p).forEach(t => t.textContent = '');
  }
}
const _analysis = {};
async function analyzeDocx(code, bytes) {
  if (_analysis[code]) return _analysis[code];
  const entries = readZip(bytes); const td = new TextDecoder();
  const acc = { list: [], map: new Map(), boxes: [], party: false, boxN: 0, used: new Set() };
  const order = n => n === 'word/document.xml' ? 0 : 1;
  for (const en of entries.filter(e => /^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)).sort((a, b) => order(a.name) - order(b.name))) {
    const xml = td.decode(await entryBytes(en));
    if (!xml.includes('[') && !xml.includes('☐')) continue;
    walkXml(xmlDoc(xml), en.name, 'scan', {}, acc);
  }
  return _analysis[code] = { fields: acc.list, boxes: acc.boxes, party: acc.party };
}
/** Remplit un modèle .docx (Uint8Array). values : { id: texte, Bn: true, PARTY: 'PHYSIQUE'|'MORALE' } */
async function fillDocx(bytes, values) {
  const entries = readZip(bytes); const used = new Set(); const td = new TextDecoder(); const te = new TextEncoder();
  const acc = { used, boxN: 0 };
  const order = n => n === 'word/document.xml' ? 0 : 1;
  for (const en of entries.filter(e => /^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)).sort((a, b) => order(a.name) - order(b.name))) {
    const xml = td.decode(await entryBytes(en));
    if (!xml.includes('[') && !xml.includes('☐')) continue;
    const doc = xmlDoc(xml);
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML invalide dans le modèle');
    walkXml(doc, en.name, 'fill', values, acc);
    const out = te.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, ''));
    const comp = await deflateRaw(out);
    Object.assign(en, { method: 8, crc: crc32(out), cs: comp.length, us: out.length, data: comp });
  }
  return { bytes: writeZip(entries), used };
}

/* ============ Rendu .docx -> HTML (modèles DGS) ============ */
const tw2px = v => (parseFloat(v) || 0) / 15;
const FONT_STACKS = {
  'Cambria': "Cambria,Caladea,'Noto Serif','DejaVu Serif',serif",
  'Segoe UI Symbol': "'Segoe UI Symbol','Noto Sans Symbols','Noto Sans Symbols 2','DejaVu Sans',sans-serif"
};
const xmlDoc = t => new DOMParser().parseFromString(t, 'application/xml');
function bool(el) { if (!el) return undefined; const v = wa(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); }
function parseRPr(rPr) {
  const o = {}; if (!rPr) return o;
  const set = (k, v) => { if (v !== undefined && v !== null) o[k] = v; };
  set('b', bool(kid(rPr, 'b'))); set('i', bool(kid(rPr, 'i')));
  const u = kid(rPr, 'u'); if (u) set('u', wa(u, 'val') !== 'none');
  const st = kid(rPr, 'strike'); if (st) set('strike', bool(st));
  const c = kid(rPr, 'color'); if (c) { const v = wa(c, 'val'); set('color', v === 'auto' ? '000000' : v); }
  const sz = kid(rPr, 'sz'); if (sz) set('sz', parseFloat(wa(sz, 'val')));
  const f = kid(rPr, 'rFonts'); if (f) set('font', wa(f, 'ascii') || wa(f, 'hAnsi'));
  const sh = kid(rPr, 'shd'); if (sh && wa(sh, 'fill') && wa(sh, 'fill') !== 'auto') set('shd', wa(sh, 'fill'));
  const caps = kid(rPr, 'caps'); if (caps) set('caps', bool(caps));
  const va = kid(rPr, 'vertAlign'); if (va) set('vert', wa(va, 'val'));
  const rs = kid(rPr, 'rStyle'); if (rs) set('rStyle', wa(rs, 'val'));
  return o;
}
function parsePPr(pPr) {
  const o = {}; if (!pPr) return o;
  const jc = kid(pPr, 'jc'); if (jc) o.jc = wa(jc, 'val');
  const sp = kid(pPr, 'spacing');
  if (sp) { for (const [k, a] of [['before', 'before'], ['after', 'after'], ['line', 'line']]) { const v = wa(sp, a); if (v != null) o[k] = parseFloat(v); } const lr = wa(sp, 'lineRule'); if (lr) o.lineRule = lr; }
  const ind = kid(pPr, 'ind');
  if (ind) for (const [k, a] of [['left', 'left'], ['left', 'start'], ['right', 'right'], ['right', 'end'], ['firstLine', 'firstLine'], ['hanging', 'hanging']]) { const v = wa(ind, a); if (v != null) o[k] = parseFloat(v); }
  const kn = kid(pPr, 'keepNext'); if (kn) o.keepNext = bool(kn);
  const pb = kid(pPr, 'pageBreakBefore'); if (pb) o.pageBreakBefore = bool(pb);
  const ps = kid(pPr, 'pStyle'); if (ps) o.pStyle = wa(ps, 'val');
  const np = kid(pPr, 'numPr'); if (np) { o.numId = wa(kid(np, 'numId'), 'val'); o.ilvl = parseInt(wa(kid(np, 'ilvl'), 'val') || '0', 10); }
  const tabs = kid(pPr, 'tabs'); if (tabs) o.tabs = kids(tabs, 'tab').map(t => ({ val: wa(t, 'val'), pos: parseFloat(wa(t, 'pos')), leader: wa(t, 'leader') })).filter(t => t.val !== 'clear');
  const rp = kid(pPr, 'rPr'); if (rp) o.markRPr = parseRPr(rp);
  return o;
}
const mergeObj = (...os) => { const o = {}; for (const x of os) if (x) for (const k in x) if (x[k] !== undefined) o[k] = x[k]; return o; };

class DocxModel {
  constructor(files) {
    this.styles = {}; this.def = { rPr: {}, pPr: {} }; this.num = {}; this.footer = null; this.body = null; this.sect = {};
    const td = new TextDecoder();
    const st = files['word/styles.xml'];
    if (st) {
      const d = xmlDoc(td.decode(st)); const dd = kid(d.documentElement, 'docDefaults');
      if (dd) { this.def.rPr = parseRPr(kid(kid(dd, 'rPrDefault'), 'rPr')); this.def.pPr = parsePPr(kid(kid(dd, 'pPrDefault'), 'pPr')); }
      for (const s of kids(d.documentElement, 'style')) this.styles[wa(s, 'styleId')] = { based: wa(kid(s, 'basedOn'), 'val'), rPr: parseRPr(kid(s, 'rPr')), pPr: parsePPr(kid(s, 'pPr')) };
    }
    const nm = files['word/numbering.xml'];
    if (nm) {
      const d = xmlDoc(td.decode(nm)); const abs = {};
      for (const a of kids(d.documentElement, 'abstractNum')) {
        const lv = {};
        for (const l of kids(a, 'lvl')) lv[wa(l, 'ilvl')] = { fmt: wa(kid(l, 'numFmt'), 'val'), text: wa(kid(l, 'lvlText'), 'val'), start: parseInt(wa(kid(l, 'start'), 'val') || '1', 10), pPr: parsePPr(kid(l, 'pPr')), rPr: parseRPr(kid(l, 'rPr')) };
        abs[wa(a, 'abstractNumId')] = lv;
      }
      for (const n of kids(d.documentElement, 'num')) this.num[wa(n, 'numId')] = abs[wa(kid(n, 'abstractNumId'), 'val')] || {};
    }
    this.counters = {};
    const dm = xmlDoc(td.decode(files['word/document.xml'])); this.body = kid(dm.documentElement, 'body');
    const sp = kid(this.body, 'sectPr');
    const ps = kid(sp, 'pgSz'), pm = kid(sp, 'pgMar');
    this.sect = {
      w: tw2px(wa(ps, 'w') || 11906), h: tw2px(wa(ps, 'h') || 16838),
      top: tw2px(wa(pm, 'top') || 1440), bottom: tw2px(wa(pm, 'bottom') || 1440), left: tw2px(wa(pm, 'left') || 1440), right: tw2px(wa(pm, 'right') || 1440),
      footer: tw2px(wa(pm, 'footer') || 708)
    };
    const fk = Object.keys(files).filter(k => /^word\/footer\d*\.xml$/.test(k)).sort()[0];
    if (fk) this.footer = xmlDoc(td.decode(files[fk])).documentElement;
  }
  styleChain(id, pick) {
    const chain = []; let cur = id, n = 0;
    while (cur && this.styles[cur] && n++ < 12) { chain.unshift(this.styles[cur]); cur = this.styles[cur].based; }
    return mergeObj(...chain.map(s => s[pick]));
  }
  paraProps(p) {
    const direct = parsePPr(kid(p, 'pPr'));
    const sty = direct.pStyle ? this.styleChain(direct.pStyle, 'pPr') : {};
    let numP = {}, numR = {}, lvl = null;
    const numId = direct.numId ?? sty.numId, ilvl = direct.ilvl ?? sty.ilvl ?? 0;
    if (numId && numId !== '0' && this.num[numId] && this.num[numId][ilvl]) { lvl = this.num[numId][ilvl]; numP = lvl.pPr; numR = lvl.rPr; }
    return { pp: mergeObj(this.def.pPr, sty, numP, direct), sty, lvl, numId, ilvl, numR };
  }
  baseRPr(pp, sty) { return mergeObj(this.def.rPr, pp.pStyle ? this.styleChain(pp.pStyle, 'rPr') : {}); }
  numLabel(numId, ilvl, lvl) {
    const c = this.counters[numId] || (this.counters[numId] = {});
    c[ilvl] = (c[ilvl] ?? (lvl.start - 1)) + 1;
    for (const k of Object.keys(c)) if (+k > ilvl) delete c[k];
    if (lvl.fmt === 'bullet') return lvl.text || '•';
    const fmt = (n, f) => f === 'lowerLetter' ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : f === 'upperLetter' ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : f === 'lowerRoman' || f === 'upperRoman' ? roman(n, f === 'lowerRoman') : String(n);
    return (lvl.text || '%1.').replace(/%(\d)/g, (_, d) => { const L = +d - 1; const lv = this.num[numId][L]; return fmt(c[L] ?? lv?.start ?? 1, lv?.fmt); });
  }
  runCss(rp) {
    const css = [];
    const fam = rp.font ? (FONT_STACKS[rp.font] || `'${rp.font}',${FONT_STACKS.Cambria}`) : FONT_STACKS.Cambria;
    css.push('font-family:' + fam);
    if (rp.sz) css.push(`font-size:${(rp.sz * 2 / 3).toFixed(2)}px`);
    if (rp.b) css.push('font-weight:bold'); if (rp.i) css.push('font-style:italic');
    const deco = []; if (rp.u) deco.push('underline'); if (rp.strike) deco.push('line-through'); if (deco.length) css.push('text-decoration:' + deco.join(' '));
    if (rp.color) css.push('color:#' + rp.color);
    if (rp.shd) css.push('background:#' + rp.shd);
    if (rp.caps) css.push('text-transform:uppercase');
    if (rp.vert === 'superscript') css.push('vertical-align:super;font-size:0.7em'); if (rp.vert === 'subscript') css.push('vertical-align:sub;font-size:0.7em');
    return css.join(';');
  }
  runsHtml(container, baseRPr, out) {
    for (const r of container.children) {
      if (r.localName === 'hyperlink') { this.runsHtml(r, baseRPr, out); continue; }
      if (r.localName !== 'r') continue;
      const own = parseRPr(kid(r, 'rPr'));
      const rp = mergeObj(baseRPr, own.rStyle ? this.styleChain(own.rStyle, 'rPr') : {}, own);
      let inner = '';
      for (const c of r.children) {
        if (c.localName === 't') inner += esc(c.textContent);
        else if (c.localName === 'tab') inner += '<span class="tab">​</span>';
        else if (c.localName === 'br') inner += wa(c, 'type') === 'page' ? '<span class="pgbr"></span>' : '<br/>';
        else if (c.localName === 'instrText') { const t = c.textContent.trim().toUpperCase(); inner += t.startsWith('NUMPAGES') ? '\u0001NUMPAGES\u0001' : t.startsWith('PAGE') ? '\u0001PAGE\u0001' : ''; }
        else if (c.localName === 'noBreakHyphen') inner += '‑';
      }
      if (inner) out.push(`<span style="${this.runCss(rp)}">${inner}</span>`);
    }
  }
  paraHtml(p, inCell) {
    const { pp, sty, lvl, numId, ilvl, numR } = this.paraProps(p);
    const base = this.baseRPr(pp, sty);
    const css = []; const pad = [];
    css.push(`padding-top:${tw2px(pp.before ?? 0).toFixed(2)}px`); css.push(`padding-bottom:${tw2px(pp.after ?? 0).toFixed(2)}px`);
    const jc = { both: 'justify', center: 'center', right: 'right', end: 'right', left: 'left', start: 'left' }[pp.jc] || 'left'; css.push('text-align:' + jc);
    let left = tw2px(pp.left ?? 0), hang = tw2px(pp.hanging ?? 0), first = tw2px(pp.firstLine ?? 0);
    css.push(`margin-left:${left}px`); if (pp.right) css.push(`margin-right:${tw2px(pp.right)}px`);
    if (hang) css.push(`text-indent:${-hang}px`); else if (first) css.push(`text-indent:${first}px`);
    const line = pp.line ?? 240;
    if (pp.lineRule === 'exact' || pp.lineRule === 'atLeast') css.push(`line-height:${tw2px(line).toFixed(2)}px`); else css.push(`line-height:${(line / 240 * 1.17).toFixed(3)}`);
    const parts = [];
    if (lvl) {
      const lab = this.numLabel(numId, ilvl, lvl);
      const lrp = mergeObj(base, lvl.fmt === 'bullet' ? {} : {}, numR);
      parts.push(`<span style="display:inline-block;min-width:${hang || 18}px;padding-right:4px;white-space:nowrap;text-indent:0;${this.runCss(lrp)}">${esc(lab)}</span>`);
    }
    this.runsHtml(p, base, parts);
    if (!parts.length || (parts.length === 1 && lvl)) parts.push(`<span style="${this.runCss(mergeObj(base, pp.markRPr))}">​</span>`);
    const tabs = pp.tabs ? ` data-tabs="${esc(JSON.stringify(pp.tabs.map(t => ({ v: t.val, p: tw2px(t.pos), l: t.leader || '' }))))}"` : '';
    return `<div class="p"${pp.keepNext ? ' data-kn="1"' : ''}${pp.pageBreakBefore ? ' data-pbb="1"' : ''}${tabs} style="${css.join(';')}">${parts.join('')}</div>`;
  }
  borderCss(el, side) {
    const b = kid(el, side); if (!b) return null;
    const v = wa(b, 'val'); if (!v || v === 'none' || v === 'nil') return 'none';
    const sz = parseFloat(wa(b, 'sz') || '4'); let col = wa(b, 'color') || '000000'; if (col === 'auto') col = '000000';
    return `${Math.max(1, Math.round(sz / 6 * 10) / 10)}px ${v === 'dotted' ? 'dotted' : v === 'dashed' ? 'dashed' : v === 'double' ? 'double' : 'solid'} #${col}`;
  }
  tableHtml(t) {
    const pr = kid(t, 'tblPr'); const tb = kid(pr, 'tblBorders');
    const grid = kids(kid(t, 'tblGrid'), 'gridCol').map(g => tw2px(wa(g, 'w')));
    const tblW = kid(pr, 'tblW'); let total = grid.reduce((a, b) => a + b, 0);
    if (tblW && wa(tblW, 'type') === 'dxa') total = tw2px(wa(tblW, 'w')) || total;
    const ind = kid(pr, 'tblInd'); const ml = ind ? tw2px(wa(ind, 'w')) : 0;
    const rows = kids(t, 'tr'); let h = `<table style="border-collapse:collapse;table-layout:fixed;width:${total}px;margin-left:${ml}px"><colgroup>${grid.map(g => `<col style="width:${g}px"/>`).join('')}</colgroup>`;
    rows.forEach((tr, ri) => {
      const trp = kid(tr, 'trPr'); const th = kid(trp, 'trHeight'); const hdr = kid(trp, 'tblHeader');
      h += `<tr${hdr ? ' data-th="1"' : ''}${th ? ` style="height:${tw2px(wa(th, 'val'))}px"` : ''}>`;
      let ci = 0; const cells = kids(tr, 'tc');
      for (const tc of cells) {
        const tp = kid(tc, 'tcPr'); const span = parseInt(wa(kid(tp, 'gridSpan'), 'val') || '1', 10);
        const first = ci === 0, last = ci + span >= grid.length, firstRow = ri === 0, lastRow = ri === rows.length - 1;
        const tcb = kid(tp, 'tcBorders'); const css = [];
        const sides = { top: ['top', firstRow ? 'top' : 'insideH'], bottom: ['bottom', lastRow ? 'bottom' : 'insideH'], left: ['left', first ? 'left' : 'insideV'], right: ['right', last ? 'right' : 'insideV'] };
        for (const s in sides) { const v = this.borderCss(tcb, sides[s][0]) ?? this.borderCss(tb, sides[s][1]); if (v) css.push(`border-${s}:${v}`); }
        const mar = kid(tp, 'tcMar'); const m = s => { const e = kid(mar, s); return e ? tw2px(wa(e, 'w')) : (s === 'left' || s === 'right' ? 7.2 : 0); };
        css.push(`padding:${m('top')}px ${m('right')}px ${m('bottom')}px ${m('left')}px`);
        const va = wa(kid(tp, 'vAlign'), 'val'); css.push('vertical-align:' + (va === 'center' ? 'middle' : va === 'bottom' ? 'bottom' : 'top'));
        const sh = kid(tp, 'shd'); if (sh && wa(sh, 'fill') && wa(sh, 'fill') !== 'auto') css.push('background:#' + wa(sh, 'fill'));
        h += `<td${span > 1 ? ` colspan="${span}"` : ''} style="${css.join(';')}">${this.blocksHtml(tc, true)}</td>`;
        ci += span;
      }
      h += '</tr>';
    });
    return h + '</table>';
  }
  blocksHtml(container, inCell) {
    let h = '';
    for (const c of container.children) {
      if (c.localName === 'p') h += this.paraHtml(c, inCell);
      else if (c.localName === 'tbl') h += this.tableHtml(c);
    }
    return h;
  }
  bodyHtml() { this.counters = {}; return this.blocksHtml(this.body, false); }
  footerHtml() { return this.footer ? this.blocksHtml(this.footer, false) : ''; }
}

const PAGE_CSS = `.dgs *{box-sizing:border-box}.dgs{font-family:Cambria,Caladea,'Noto Serif',serif;color:#000;white-space:pre-wrap;word-wrap:break-word}
.dgs .p{display:block;min-height:0}.dgs table{border-spacing:0}.dgs td{overflow:visible;word-wrap:break-word}.dgs .tab{display:inline-block;white-space:pre}.dgs .pgbr{display:inline-block;width:0;height:0}`;

/** Met en page le .docx : renvoie { pages:[Uint8Array jpeg], w, h } */
async function renderDocxToJpegs(docxBytes, opts = {}) {
  const scale = opts.scale || 2, quality = opts.quality || 0.9;
  const entries = readZip(docxBytes); const files = {};
  for (const en of entries) if (/^word\/[^/]+\.xml$/.test(en.name)) files[en.name] = await entryBytes(en);
  const model = new DocxModel(files); const S = model.sect;
  const CW = S.w - S.left - S.right, CH = S.h - S.top - S.bottom;
  const bodyHtml = model.bodyHtml(), footHtml = model.footerHtml();
  const host = document.createElement('div');
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${CW}px;visibility:hidden`;
  host.innerHTML = `<style>${PAGE_CSS}</style><div class="dgs" id="dgsroot" style="position:relative;width:${CW}px">${bodyHtml}</div>`;
  document.body.appendChild(host);
  try {
    const root = host.querySelector('#dgsroot'); const rr = () => root.getBoundingClientRect();
    // tabulations
    for (const par of root.querySelectorAll('.p')) {
      const spans = [...par.querySelectorAll('.tab')]; if (!spans.length) continue;
      const tabs = par.dataset.tabs ? JSON.parse(par.dataset.tabs) : [];
      const cell = par.closest('td');
      for (let i = 0; i < spans.length; i++) {
        const sp = spans[i]; sp.style.width = '0px'; sp.style.borderBottom = '0';
        const base = (cell ? cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft) : rr().left);
        const x0 = sp.getBoundingClientRect().left - base;
        const stop = tabs.find(t => t.p > x0 + 1) || null;
        let target, kind = 'left', leader = '';
        if (stop) { target = stop.p; kind = stop.v; leader = stop.l; } else { target = (Math.floor(x0 / 48) + 1) * 48; }
        let w = target - x0;
        if (kind === 'right' || kind === 'center' || kind === 'end') {
          const rng = document.createRange(); rng.setStartAfter(sp);
          if (spans[i + 1]) rng.setEndBefore(spans[i + 1]); else rng.setEnd(par, par.childNodes.length);
          const aw = rng.getBoundingClientRect().width; w -= (kind === 'center' ? aw / 2 : aw);
        }
        sp.style.width = Math.max(4, w) + 'px';
        if (leader === 'dot') sp.style.borderBottom = '1px dotted #000'; else if (leader === 'underscore') sp.style.borderBottom = '1px solid #000'; else if (leader === 'hyphen') sp.style.borderBottom = '1px dashed #000';
        if (leader) sp.style.height = '1em';
      }
    }
    await nextFrame();
    // points de coupure
    const base0 = rr().top; const units = [];
    for (const el of root.children) {
      const r = el.getBoundingClientRect();
      if (el.tagName === 'TABLE') {
        const trs = [...el.querySelectorAll(':scope > tbody > tr, :scope > tr')];
        trs.forEach((tr, i) => { const q = tr.getBoundingClientRect(); units.push({ top: q.top - base0, bottom: q.bottom - base0, kn: false, force: false, th: tr.dataset.th === '1', tbl: el, ti: i }); });
        if (units.length) units[units.length - 1].bottom = Math.max(units[units.length - 1].bottom, r.bottom - base0);
      } else {
        units.push({ top: r.top - base0, bottom: r.bottom - base0, kn: el.dataset.kn === '1', force: el.dataset.pbb === '1' || !!el.querySelector('.pgbr'), th: false, pbAfter: !!el.querySelector('.pgbr') });
      }
    }
    const total = units.length ? units[units.length - 1].bottom : 0;
    const cuts = []; let start = 0, i = 0;
    while (i < units.length) {
      const limit = start + CH; let last = i - 1;
      for (let k = i; k < units.length; k++) {
        if (k > i && units[k].force && !units[k - 1].pbAfter) break;
        if (units[k].bottom <= limit + 0.5) { last = k; if (units[k].pbAfter) break; } else break;
      }
      if (last < i) { cuts.push({ start, end: limit }); start = limit; if (start >= units[i].bottom - 0.5) { start = units[i].bottom; i++; } continue; }
      if (last < units.length - 1 && !units[last].pbAfter && !units[last + 1].force) { let j = last, c = 0; while (j > i && units[j].kn && c++ < 2) j--; last = j; }
      cuts.push({ start, end: Math.min(units[last].bottom, limit) });
      start = last + 1 < units.length ? units[last + 1].top : total; i = last + 1;
    }
    if (!cuts.length) cuts.push({ start: 0, end: 0 });
    const N = cuts.length;
    // sérialisation XHTML du contenu (une fois)
    const bodyX = new XMLSerializer().serializeToString(root);
    const pages = [];
    for (let i = 0; i < N; i++) {
      const c = cuts[i]; const hgt = Math.max(1, Math.min(CH, c.end - c.start) + 0.5);
      const foot = footHtml.replace(/\u0001PAGE\u0001/g, String(i + 1)).replace(/\u0001NUMPAGES\u0001/g, String(N));
      const footDoc = new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml" class="dgs">${foot.replace(/<br>/g, '<br/>')}</div>`, 'application/xhtml+xml');
      const footX = footDoc.getElementsByTagName('parsererror').length ? '' : new XMLSerializer().serializeToString(footDoc.documentElement);
      const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${S.w}px;height:${S.h}px;position:relative;background:#fff;overflow:hidden"><style>${PAGE_CSS}</style>` +
        `<div style="position:absolute;left:${S.left}px;top:${S.top}px;width:${CW}px;height:${hgt}px;overflow:hidden"><div style="position:absolute;left:0;top:${-c.start}px;width:${CW}px">${bodyX}</div></div>` +
        `<div style="position:absolute;left:${S.left}px;bottom:${S.footer}px;width:${CW}px">${footX}</div></div>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}"><foreignObject x="0" y="0" width="${S.w}" height="${S.h}">${html}</foreignObject></svg>`;
      const img = await svgToImg(svg);
      const cv = document.createElement('canvas'); cv.width = Math.round(S.w * scale); cv.height = Math.round(S.h * scale);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.scale(scale, scale); g.drawImage(img, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', quality));
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
      if (opts.onPage) opts.onPage(i + 1, N);
      await nextFrame();
    }
    return { pages, pw: S.w, ph: S.h };
  } finally { host.remove(); }
}
function svgToImg(svg) {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Rendu de la page impossible'));
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function roman(n, lower) { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return lower ? s.toLowerCase() : s; }

/* ============ PDF (pages image JPEG, A4) ============ */
function jpegSize(u) { let i = 2; while (i < u.length) { if (u[i] !== 0xFF) { i++; continue; } const m = u[i + 1]; if (m >= 0xC0 && m <= 0xC3) return { h: (u[i + 5] << 8) | u[i + 6], w: (u[i + 7] << 8) | u[i + 8] }; i += 2 + ((u[i + 2] << 8) | u[i + 3]); } return { w: 1, h: 1 }; }
function makePdf(pages, pw, ph) {
  pages = pages.map(p => p.jpeg ? p : { jpeg: p, ...jpegSize(p) });
  const te = new TextEncoder(); const chunks = []; const offs = []; let pos = 0;
  const push = u => { chunks.push(u); pos += u.length; };
  const str = s => push(te.encode(s));
  const obj = (n, fn) => { offs[n] = pos; str(`${n} 0 obj\n`); fn(); str('\nendobj\n'); };
  const W = pw * 0.75, H = ph * 0.75; // px (96 dpi) -> pt
  str('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length; const pageObj = i => 3 + i * 3, imgObj = i => 4 + i * 3, conObj = i => 5 + i * 3;
  obj(1, () => str('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => str(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => pageObj(i) + ' 0 R').join(' ')}] >>`));
  pages.forEach((p, i) => {
    obj(pageObj(i), () => str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> /Contents ${conObj(i)} 0 R >>`));
    obj(imgObj(i), () => { str(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); push(p.jpeg); str('\nendstream'); });
    const c = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(conObj(i), () => str(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`));
  });
  const xref = pos; const total = 3 + n * 3;
  str(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) str(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
  str(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return concat(chunks);
}

/* ============ Enregistrer / partager (Android natif ou navigateur) ============ */
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function toBase64(u8) { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
async function saveFile(u8, name, mime, share) {
  if (isNative()) {
    const P = window.Capacitor.Plugins; const FS = P.Filesystem;
    const r = await FS.writeFile({ path: 'DGS/' + name, data: toBase64(u8), directory: 'DOCUMENTS', recursive: true });
    if (share && P.Share) { try { await P.Share.share({ title: name, url: r.uri, dialogTitle: 'Partager' }); } catch (e) { } }
    return 'Documents/DGS/' + name;
  }
  const url = URL.createObjectURL(new Blob([u8], { type: mime }));
  if (share && navigator.canShare) {
    try { const f = new File([u8], name, { type: mime }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); URL.revokeObjectURL(url); return 'partagé'; } } catch (e) { if (e.name === 'AbortError') return 'annulé'; }
  }
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000); return 'Téléchargements/' + name;
}
