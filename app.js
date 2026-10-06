/* ============ Configuration métier ============ */
const FIELD_LABELS = { ADRESSE_COMPLETE_DE_DGS: 'Adresse du siège (n°, rue, cité)', NOM_FONCTION: 'Rédacteur par défaut (nom / fonction)', CAPITAL_SOCIAL: 'Capital social (DA)', VILLE_SIEGE: 'Ville (pour « Fait à »)', NOM_DU_GERANT: 'Nom du gérant', DENOMINATION: 'Dénomination', N_LOT_SANS_OBJET: 'N° lot', A_COMPLETER_RIB: 'RIB', N_RC: 'N° RC', N_AO: "N° appel d'offres", OBJET_DE_L_APPEL_D_OFFRES: "Objet de l'appel d'offres", NOM_ET_PRENOM_DE_L_ASSOCIE_UNIQUE: "Nom et prénom de l'associé unique" };
const ET = {
  societe: {
    label: 'Société', plural: 'Sociétés', icon: '🏢', folders: ['01_ENTREPRISE', '04_FOURNISSEURS', '05_SOUS_TRAITANTS', '06_PERSONNEL', '07_MATERIEL_VEHICULES', '09_MODELES_MASTER'],
    fields: ['DENOMINATION', 'NOM_DU_GERANT', 'NOM_ET_PRENOM_DE_L_ASSOCIE_UNIQUE', 'NOM_FONCTION', 'ADRESSE_COMPLETE_DE_DGS', 'VILLE_SIEGE', 'CAPITAL_SOCIAL', 'A_COMPLETER_RIB'], req: 'DENOMINATION'
  },
  client: { label: 'Client', plural: 'Clients', icon: '👤', folders: ['02_CLIENTS'], fields: ['NOM_CLIENT', 'ADRESSE_CLIENT'], req: 'NOM_CLIENT' },
  projet: {
    label: 'Projet', plural: 'Projets', icon: '🏗️', folders: ['03_CHANTIERS', '02_CLIENTS', '08_PROMOTION_IMMOBILIERE'],
    fields: ['INTITULE_DU_PROJET', 'N_PROJET', 'ADRESSE_DU_CHANTIER', 'N_DEVIS', 'N_DOSSIER', 'NATURE_DES_TRAVAUX', 'DELAI', 'DATE_DE_DEMARRAGE', 'MAITRE_D_OUVRAGE', 'CONDITIONS_DE_PAIEMENT'], req: 'INTITULE_DU_PROJET'
  },
  marche: {
    label: 'Marché public', plural: 'Marchés', icon: '📑', folders: ['10_MARCHES_PUBLICS'],
    fields: ['N_AO', 'OBJET_DE_L_APPEL_D_OFFRES', 'NOM_DU_SERVICE_CONTRACTANT', 'ADRESSE_DU_SERVICE_CONTRACTANT', 'N_MARCHE', 'N_LOT_SANS_OBJET', 'OBJET_DU_MARCHE'], req: 'N_AO'
  }
};
const ENT_OWNER = {}; for (const t of ['societe', 'client', 'projet', 'marche']) for (const k of ET[t].fields) if (!ENT_OWNER[k]) ENT_OWNER[k] = t;

function fieldLabel(k) { return FIELD_LABELS[k] || FIELDS[k] || k; }
function fieldType(k) {
  k = String(k).split('@')[0];
  if (k === 'DATE' || /^DATE_|_DATE$/.test(k)) return 'date';
  if (/^HEURE/.test(k)) return 'time';
  if (/MONTANT|^TVA$|^TAUX|PRIX/.test(k)) return 'decimal';
  if (/^(ADRESSE|OBJET|TEXTE|MOTIF|CAUSE|JUSTIFICATION|INTRODUCTION|PRESTATION|DESIGNATION|MESURE|CONDITIONS|NATURE|INTITULE_DE_L_OPERATION|POSTE|DEUXIEME|PREMIER|TROISIEME|ELEMENT|INTITULE_DE_LA)/.test(k)) return 'textarea';
  return 'text';
}
/* Enchaînement conseillé des documents (modifiable) */
const WORKFLOW = (() => {
  const w = {}; const ch = (...c) => { for (let i = 0; i < c.length - 1; i++) { (w['DGS-' + c[i]] = w['DGS-' + c[i]] || []); const n = 'DGS-' + c[i + 1]; if (!w['DGS-' + c[i]].includes(n)) w['DGS-' + c[i]].push(n); } };
  ch('CLI-001', 'CLI-002', 'CLI-003', 'CLI-004', 'CLI-005', 'CLI-006', 'CLI-007', 'CLI-008', 'CLI-009', 'CLI-011', 'CLI-012');
  ch('CLI-008', 'CLI-010', 'CLI-011'); ch('CLI-007', 'CLI-008');
  for (const c of ['CON-001', 'CON-002', 'CON-003', 'CON-004', 'CON-005']) { ch('CLI-012', c); ch(c, 'PV-001'); ch(c, 'PV-003'); }
  ch('PV-001', 'PV-002', 'PV-003', 'PV-004', 'PV-005', 'CHT-001', 'CHT-002', 'CHT-003', 'CHT-011', 'CHT-012', 'CHT-013', 'PV-011', 'PV-022');
  ch('CHT-003', 'PV-010'); ch('PV-010', 'PV-011'); ch('PV-011', 'PV-013'); ch('PV-013', 'PV-022');
  ch('PV-022', 'PV-024', 'PV-026'); ch('PV-022', 'PV-023', 'PV-025', 'PV-026');
  ch('PV-026', 'PV-027', 'PV-028', 'PV-029', 'PV-030', 'CLI-014', 'CLI-024');
  ch('PV-005', 'PV-014'); ch('PV-005', 'PV-015'); ch('PV-005', 'PV-017', 'PV-018'); ch('PV-005', 'PV-019');
  ch('CLI-015', 'CLI-016', 'CLI-017'); ch('CLI-013', 'PV-031', 'PV-032', 'PV-033', 'PV-034', 'PV-035');
  ch('MAR-001', 'MAR-002', 'MAR-008', 'MAR-003', 'MAR-105', 'MAR-010', 'MAR-011', 'MAR-024', 'MAR-015', 'MAR-017', 'MAR-040', 'MAR-041', 'MAR-042', 'MAR-043', 'MAR-044', 'MAR-046', 'MAR-070', 'MAR-072', 'MAR-080', 'MAR-079', 'MAR-061', 'MAR-083', 'MAR-063');
  return w;
})();
const DOC_BY_CODE = {}; DOCS.forEach(d => DOC_BY_CODE[d.c] = d);

/* ============ État & utilitaires UI ============ */
const A = { templates: 0, entities: [], docs: [], log: [] };
const today = () => new Date().toISOString().slice(0, 10);
const frDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
const fmtVal = (k, v) => {
  v = String(v ?? '').trim(); const b = String(k).split('@')[0];
  if (fieldType(k) === 'date') return frDate(v);
  if (/^MONTANT(_HT|_TTC|_TVA)?$/.test(b)) { const n = parseNum(v); if (n != null && /^[\d\s.,]+$/.test(v)) return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, '\u00a0'); }
  return v;
};
const parseNum = v => { const x = String(v ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'); return x !== '' && /^-?\d+(\.\d+)?$/.test(x) ? parseFloat(x) : null; };
function deriveAmounts(v) {
  const ht = parseNum(v.MONTANT_HT), tva = parseNum(v.TVA);
  const f = n => String(Math.round(n * 100) / 100);
  if (ht != null && tva != null) {
    if (!String(v.MONTANT_TVA || '').trim()) v.MONTANT_TVA = f(ht * tva / 100);
    if (!String(v.MONTANT_TTC || '').trim()) v.MONTANT_TTC = f(ht + ht * tva / 100);
  }
  return v;
}
const COMPANY_DEFAULTS = { DENOMINATION: 'EURL DYNAMIC GROUP SOLUTION', A_COMPLETER_RIB: '001.00811 03300.0002.220/76', VILLE_SIEGE: 'Annaba' };
function autoValue(f, inh) {
  const k = f.key, b = f.before || '';
  if (!f.generic) { const x = inh[k]; return x != null && x !== '' ? x : ''; }
  if (k === 'DATE' && (/(modification|cr[ée]ation|[ée]mission|[ée]dition|[ée]tabli|date)\s*[:·]?\s*$/i.test(b) || /fait [àa][^\[]*\ble\s*$/i.test(b) || /,\s*le\s*$/i.test(b))) return today();
  if (k === 'A_COMPLETER_RIB' && !/sous-traitant|client|fournisseur|cotraitant/i.test(b)) return inh.A_COMPLETER_RIB || '';
  if (k === 'LIEU' && /fait [àa]\s*$/i.test(b)) return inh.VILLE_SIEGE || '';
  return '';
}
const ent = id => A.entities.find(e => e.id === id);
const entName = e => !e ? '' : e.type === 'societe' ? (e.data.DENOMINATION || 'Société') : e.type === 'client' ? (e.data.NOM_CLIENT || 'Client') : e.type === 'projet' ? ((e.data.N_PROJET ? e.data.N_PROJET + ' · ' : '') + (e.data.INTITULE_DU_PROJET || 'Projet')) : (e.data.N_AO ? 'AO ' + e.data.N_AO : 'Marché') + (e.data.NOM_DU_SERVICE_CONTRACTANT ? ' · ' + e.data.NOM_DU_SERVICE_CONTRACTANT : '');
const entSub = e => e.type === 'client' ? (ent(e.societeId) ? entName(ent(e.societeId)) : '') : e.type === 'projet' ? (ent(e.clientId) ? entName(ent(e.clientId)) : '') : e.type === 'marche' ? (e.data.OBJET_DE_L_APPEL_D_OFFRES || '') : (e.data.NOM_DU_GERANT ? 'Gérant : ' + e.data.NOM_DU_GERANT : '');
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200); }
let busyEl = null;
function busy(msg) { if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'busy'; document.body.appendChild(busyEl); } busyEl.innerHTML = `<div class="busybox"><div class="spin"></div><div id="busymsg">${esc(msg)}</div><div class="bar"><i id="busybar"></i></div></div>`; }
function busyMsg(msg, pct) { const m = $('#busymsg'); if (m) m.textContent = msg; const b = $('#busybar'); if (b && pct != null) b.style.width = pct + '%'; }
function busyDone() { if (busyEl) { busyEl.remove(); busyEl = null; } }
function logLine(m) { A.log.unshift(new Date().toLocaleString('fr-FR') + ' — ' + m); A.log.length = Math.min(A.log.length, 60); DB.put('kv', 'log', A.log).catch(() => { }); }
const confirmBox = msg => Promise.resolve(window.confirm(msg));

async function loadAll() {
  A.entities = await DB.all('entities'); A.docs = await DB.all('docs');
  A.templates = (await DB.keys('templates')).length; A.log = (await DB.get('kv', 'log')) || [];
}
const saveEnt = async e => { e.updatedAt = Date.now(); await DB.put('entities', e.id, e); const i = A.entities.findIndex(x => x.id === e.id); if (i >= 0) A.entities[i] = e; else A.entities.push(e); };
const saveDoc = async d => { await DB.put('docs', d.id, d); const i = A.docs.findIndex(x => x.id === d.id); if (i >= 0) A.docs[i] = d; else A.docs.push(d); };

/* ============ Import des modèles ============ */
async function importTemplates(u8, onProg) {
  const entries = readZip(u8).filter(e => /\.docx$/i.test(e.name) && !/\/~\$/.test(e.name) && !/^__MACOSX/.test(e.name));
  let n = 0, i = 0;
  for (const en of entries) {
    const m = /(DGS-[A-Z]+-\d+)/.exec(en.name.split('/').pop());
    i++;
    if (!m || !DOC_BY_CODE[m[1]]) continue;
    await DB.put('templates', m[1], await entryBytes(en)); n++;
    if (i % 5 === 0) { onProg && onProg(i, entries.length); await nextFrame(); }
  }
  A.templates = (await DB.keys('templates')).length; return n;
}
async function autoImport() {
  if (A.templates > 0) return;
  try {
    const r = await fetch('templates.zip'); if (!r.ok) return;
    busy('Installation des modèles de documents…');
    const buf = new Uint8Array(await r.arrayBuffer());
    const n = await importTemplates(buf, (i, t) => busyMsg(`Modèles ${i}/${t}`, i / t * 100));
    logLine(`${n} modèles installés automatiquement`);
  } catch (e) { logLine('Import auto impossible : ' + e.message); } finally { busyDone(); }
}

/* ============ Valeurs héritées ============ */
function ctxFromEntity(e, projetId) {
  const c = { societeId: null, clientId: null, projetId: null, marcheId: null };
  if (e.type === 'societe') c.societeId = e.id;
  else if (e.type === 'client') { c.clientId = e.id; c.societeId = e.societeId; c.projetId = projetId || null; }
  else if (e.type === 'projet') { c.projetId = e.id; c.clientId = e.clientId; c.marcheId = e.marcheId || null; c.societeId = ent(e.clientId)?.societeId || e.societeId || null; }
  else if (e.type === 'marche') { c.marcheId = e.id; c.societeId = e.societeId; }
  if (c.projetId && e.type === 'client') { const p = ent(c.projetId); if (p) c.marcheId = p.marcheId || null; }
  return c;
}
function ctxValues(ctx) {
  const v = {};
  const soc0 = A.entities.find(x => x.type === 'societe');
  for (const id of [ctx.societeId || (soc0 && soc0.id), ctx.marcheId, ctx.clientId, ctx.projetId]) { const e = ent(id); if (e) Object.assign(v, e.memo || {}, e.data || {}); }
  const set = (k, x) => { if ((v[k] == null || v[k] === '') && x) v[k] = x; };
  set('NOM_ET_PRENOM_DU_GERANT', v.NOM_DU_GERANT); set('NOM_ET_PRENOM_DE_L_ASSOCIE_UNIQUE', v.NOM_DU_GERANT); set('NOM_FONCTION', v.NOM_DU_GERANT ? v.NOM_DU_GERANT + ' / Gérant' : ''); set('SERVICE_CONTRACTANT', v.NOM_DU_SERVICE_CONTRACTANT);
  if (v.INTITULE_DU_PROJET && v.N_PROJET) set('INTITULE_DU_PROJET_N_PROJET', `${v.INTITULE_DU_PROJET} / ${v.N_PROJET}`);
  if (v.NOM_DU_SERVICE_CONTRACTANT && v.N_PROJET) set('SERVICE_N_PROJET', `${v.NOM_DU_SERVICE_CONTRACTANT} / ${v.N_PROJET}`);
  return v;
}

/* ============ Génération d'un document ============ */
async function generate(code, values, onStatus) {
  const tpl = await DB.get('templates', code);
  if (!tpl) throw new Error("Modèle introuvable : importez d'abord les modèles (Réglages).");
  const an = await analyzeDocx(code, tpl);
  const raw = deriveAmounts({ ...values });
  const map = {}; for (const k in raw) map[k] = (k === 'PARTY' || /^B\d+$/.test(k)) ? raw[k] : fmtVal(k, raw[k]);
  onStatus && onStatus('Remplissage du document Word…', 20);
  const { bytes, used } = await fillDocx(tpl, map);
  onStatus && onStatus('Mise en page et création du PDF…', 45);
  const r = await renderDocxToJpegs(bytes, { scale: 2, quality: 0.9, onPage: (i, n) => onStatus && onStatus(`Page ${i}/${n}…`, 45 + 50 * i / n) });
  const miss = an.fields.filter(f => !used.has(f.id)).map(f => fieldLabelOf(f));
  return { docx: bytes, pages: r.pages.map(p => p.jpeg), pw: r.pw, ph: r.ph, filled: an.fields.filter(f => used.has(f.id)).map(f => f.id), missing: [...new Set(miss)] };
}
const fieldLabelOf = f => FIELD_LABELS[f.key] || FIELDS[f.key] || f.label;
const fileBase = d => { const e = ent(d.entityId); const tag = (d.values.N_PROJET || d.values.N_AO || d.values.NOM_CLIENT || (e && entName(e)) || '').toString().replace(/[^\w\-]+/g, '_').slice(0, 30); return `${d.code}${tag ? '_' + tag : ''}_${(d.validatedAt ? new Date(d.validatedAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '')}_v${d.version}`; };

function companyBanner(v) {
  const soc = A.entities.find(x => x.type === 'societe'); if (!soc) return;
  const need = ['NOM_DU_GERANT', 'ADRESSE_COMPLETE_DE_DGS'].filter(k => !soc.data[k]);
  if (need.length) v.insertAdjacentHTML('afterbegin', `<a class="card warn" href="#/edit/${soc.id}" style="display:block;text-decoration:none">⚠ Complétez une seule fois le profil de l’entreprise (${need.map(k => esc(fieldLabel(k))).join(', ')}) : il sera appliqué automatiquement à tous les documents. <b>Ouvrir ›</b></a>`);
}
/* ============ Routeur ============ */
const view = () => $('#view');
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function parseHash() { const h = location.hash.replace(/^#/, '') || '/'; const [path, q] = h.split('?'); return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(q || '')) }; }
let homeTab = localStorage.getItem('homeTab') || 'projet'; let homeQ = '';
async function render() {
  const { parts, q } = parseHash(); const v = view(); window.scrollTo(0, 0);
  try {
    if (!parts.length) { pageHome(v); companyBanner(v); return; }
    if (parts[0] === 'e') return pageEntity(v, parts[1], q);
    if (parts[0] === 'new') return pageEntityForm(v, parts[1], null, q);
    if (parts[0] === 'edit') return pageEntityForm(v, ent(parts[1])?.type, parts[1], q);
    if (parts[0] === 'doc') return pageDocForm(v, parts[1], parts[2], q);
    if (parts[0] === 'gen') return pageResult(v, parts[1]);
    if (parts[0] === 'settings') return pageSettings(v);
    pageHome(v);
  } catch (e) { console.error(e); v.innerHTML = `<div class="card err">Erreur : ${esc(e.message)}</div><a class="btn" href="#/">Accueil</a>`; }
}
const topbar = (title, back, right = '') => `<header class="top">${back ? `<a class="back" href="${back}">‹</a>` : '<span class="logo">DGS</span>'}<h1>${esc(title)}</h1>${right}</header>`;

/* ---------- Accueil ---------- */
function pageHome(v) {
  const t = ET[homeTab]; const list = A.entities.filter(e => e.type === homeTab && (!homeQ || (entName(e) + ' ' + entSub(e)).toLowerCase().includes(homeQ.toLowerCase()))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  v.innerHTML = topbar('DGS DOCS', null, '<a class="ico" href="#/settings" title="Réglages">⚙️</a>') +
    (A.templates === 0 ? `<div class="card warn">Les modèles de documents ne sont pas installés. <a href="#/settings">Les importer</a></div>` : '') +
    `<nav class="tabs">${Object.keys(ET).map(k => `<button data-tab="${k}" class="${k === homeTab ? 'on' : ''}">${ET[k].icon} ${ET[k].plural}<small>${A.entities.filter(e => e.type === k).length}</small></button>`).join('')}</nav>` +
    `<div class="searchrow"><input id="homeq" type="search" placeholder="Rechercher…" value="${esc(homeQ)}"></div>` +
    `<div class="list">${list.map(e => `<a class="item" href="#/e/${e.id}"><span class="av">${ET[e.type].icon}</span><span class="tx"><b>${esc(entName(e))}</b><small>${esc(entSub(e))}</small></span><span class="chev">›</span></a>`).join('') || `<div class="empty">Aucun ${t.label.toLowerCase()}.<br>Touchez ＋ pour en créer un.</div>`}</div>` +
    `<a class="fab" href="#/new/${homeTab}">＋</a>`;
  $$('[data-tab]', v).forEach(b => b.onclick = () => { homeTab = b.dataset.tab; localStorage.setItem('homeTab', homeTab); homeQ = ''; pageHome(v); });
  const q = $('#homeq'); q.oninput = () => { homeQ = q.value; const pos = q.selectionStart; pageHome(v); const n = $('#homeq'); n.focus(); n.setSelectionRange(pos, pos); };
}

/* ---------- Formulaire d'entité ---------- */
function entInput(k, val) {
  const ty = fieldType(k), id = 'f_' + k;
  const base = `id="${id}" data-k="${k}"`;
  if (ty === 'textarea') return `<textarea ${base} rows="2">${esc(val)}</textarea>`;
  if (ty === 'date') return `<input ${base} type="date" value="${esc(val)}">`;
  if (ty === 'decimal') return `<input ${base} type="text" inputmode="decimal" value="${esc(val)}">`;
  return `<input ${base} type="text" value="${esc(val)}">`;
}
function pageEntityForm(v, type, id, q) {
  const t = ET[type]; if (!t) return go('#/');
  const e = id ? ent(id) : { id: uid(), type, data: type === 'societe' && !A.entities.some(x => x.type === 'societe') ? { DENOMINATION: 'EURL DYNAMIC GROUP SOLUTION' } : {}, societeId: null, clientId: q.client || null, marcheId: null, createdAt: Date.now() };
  const socs = A.entities.filter(x => x.type === 'societe'), clients = A.entities.filter(x => x.type === 'client'), marches = A.entities.filter(x => x.type === 'marche');
  if (!id) { if (type === 'client' || type === 'marche') e.societeId = q.societe || socs[0]?.id || null; }
  const sel = (nm, list, cur, lbl, req, optLabel) => `<label class="fld"><span>${lbl}${req ? ' *' : ''}</span><select id="${nm}">${req ? '' : `<option value="">${optLabel || '—'}</option>`}${list.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(entName(x))}</option>`).join('')}</select></label>`;
  v.innerHTML = topbar((id ? 'Modifier — ' : 'Nouveau — ') + t.label, id ? '#/e/' + id : '#/') +
    `<form id="entform" class="form">` +
    (type === 'client' || type === 'marche' ? sel('p_soc', socs, e.societeId, 'Société', true) : '') +
    (type === 'projet' ? sel('p_cli', clients, e.clientId, 'Client', true) + sel('p_mar', marches, e.marcheId, 'Marché public lié (facultatif)', false) : '') +
    t.fields.map(k => `<label class="fld"><span>${esc(fieldLabel(k))}${k === t.req ? ' *' : ''}</span>${entInput(k, e.data[k] ?? '')}</label>`).join('') +
    `<div class="actions"><button class="btn primary" type="submit">Enregistrer</button></div></form>`;
  if ((type === 'client' || type === 'marche') && !socs.length) v.insertAdjacentHTML('afterbegin', `<div class="card warn">Créez d'abord une société (onglet Sociétés).</div>`);
  if (type === 'projet' && !clients.length) v.insertAdjacentHTML('afterbegin', `<div class="card warn">Créez d'abord un client.</div>`);
  $('#entform').onsubmit = async ev => {
    ev.preventDefault();
    const data = {}; $$('[data-k]', v).forEach(i => { const x = i.value.trim(); if (x) data[i.dataset.k] = x; });
    if (!data[t.req]) return toast(`« ${fieldLabel(t.req)} » est obligatoire`);
    if (type === 'client' || type === 'marche') { e.societeId = $('#p_soc')?.value || null; if (!e.societeId) return toast('Choisissez une société'); }
    if (type === 'projet') { e.clientId = $('#p_cli').value; if (!e.clientId) return toast('Choisissez un client'); e.marcheId = $('#p_mar').value || null; e.societeId = ent(e.clientId)?.societeId || null; }
    e.data = data; await saveEnt(e); toast('Enregistré'); go('#/e/' + e.id);
  };
}

/* ---------- Fiche d'entité ---------- */
function docGroupName(p) { const parts = p.split('/').slice(1, -1).map(s => s.replace(/^\d+_/, '').replace(/_/g, ' ')); return parts.join(' › ') || 'Général'; }
function entDocs(e) { const f = ET[e.type].folders; return DOCS.filter(d => f.includes(d.p.split('/')[0])); }
const instOf = (e, code) => A.docs.filter(d => d.entityId === e.id && d.code === code).sort((a, b) => b.version - a.version)[0];
let docQ = '';
function pageEntity(v, id, q) {
  const e = ent(id); if (!e) return go('#/');
  const t = ET[e.type]; const mine = A.docs.filter(d => d.entityId === e.id);
  const kids = e.type === 'societe' ? A.entities.filter(x => x.type === 'client' && x.societeId === e.id) : e.type === 'client' ? A.entities.filter(x => x.type === 'projet' && x.clientId === e.id) : e.type === 'marche' ? A.entities.filter(x => x.type === 'projet' && x.marcheId === e.id) : [];
  const valid = new Set(mine.filter(d => d.status === 'validé').map(d => d.code));
  const dl = entDocs(e);
  const groups = {}; dl.forEach(d => (groups[docGroupName(d.p)] = groups[docGroupName(d.p)] || []).push(d));
  const ql = docQ.toLowerCase();
  const gh = Object.keys(groups).sort().map(g => {
    const items = groups[g].filter(d => !ql || (d.c + ' ' + d.t).toLowerCase().includes(ql)); if (!items.length) return '';
    return `<details class="grp" ${ql ? 'open' : ''}><summary>${esc(g)} <small>${items.filter(d => valid.has(d.c)).length}/${items.length}</small></summary>${items.map(d => {
      const i = instOf(e, d.c); const st = !i ? '⚪' : i.status === 'validé' ? '🟢' : '🟡';
      return `<a class="doc" href="#/doc/${e.id}/${d.c}${i && i.status === 'brouillon' ? '?edit=' + i.id : ''}"><span class="st">${st}</span><span class="tx"><b>${esc(d.t)}</b><small>${d.c}</small></span><span class="chev">›</span></a>`;
    }).join('')}</details>`;
  }).join('');
  const info = t.fields.filter(k => e.data[k]).map(k => `<div class="kv"><span>${esc(fieldLabel(k))}</span><b>${esc(fmtVal(k, e.data[k]))}</b></div>`).join('');
  const parents = [e.societeId, e.clientId, e.marcheId].filter(Boolean).map(ent).filter(Boolean);
  const gens = mine.filter(d => d.status === 'validé').sort((a, b) => b.validatedAt - a.validatedAt);
  v.innerHTML = topbar(t.icon + ' ' + t.label, '#/', `<a class="ico" href="#/edit/${e.id}" title="Modifier">✏️</a>`) +
    `<div class="card"><h2>${esc(entName(e))}</h2>${parents.map(p => `<a class="chip" href="#/e/${p.id}">${ET[p.type].icon} ${esc(entName(p))}</a>`).join('')}<div class="kvs">${info || '<small>Aucune donnée saisie.</small>'}</div></div>` +
    (e.type !== 'projet' && (kids.length || e.type !== 'marche') ? `<div class="sec"><h3>${e.type === 'societe' ? 'Clients' : e.type === 'client' ? 'Projets' : 'Projets liés'} <a class="mini" href="#/new/${e.type === 'societe' ? 'client?societe=' + e.id : e.type === 'client' ? 'projet?client=' + e.id : 'projet'}">＋ Ajouter</a></h3>${kids.map(k => `<a class="item sm" href="#/e/${k.id}"><span class="av">${ET[k.type].icon}</span><span class="tx"><b>${esc(entName(k))}</b></span><span class="chev">›</span></a>`).join('') || '<small>Aucun.</small>'}</div>` : '') +
    `<div class="sec"><h3>Documents <small>${valid.size} validé(s)</small></h3><input id="docq" type="search" placeholder="Rechercher un document (code ou nom)…" value="${esc(docQ)}">${gh || '<div class="empty">Aucun document.</div>'}</div>` +
    (gens.length ? `<div class="sec"><h3>Documents générés</h3>${gens.map(d => `<a class="doc" href="#/gen/${d.id}"><span class="st">🟢</span><span class="tx"><b>${esc(DOC_BY_CODE[d.code]?.t || d.code)}</b><small>${d.code} · v${d.version} · ${new Date(d.validatedAt).toLocaleDateString('fr-FR')}</small></span><span class="chev">›</span></a>`).join('')}</div>` : '') +
    `<div class="sec"><button class="btn danger" id="delent">Supprimer ${t.label.toLowerCase()}</button></div>`;
  const dq = $('#docq'); dq.oninput = () => { docQ = dq.value; const p = dq.selectionStart; pageEntity(v, id, q); const n = $('#docq'); n.focus(); n.setSelectionRange(p, p); };
  $('#delent').onclick = async () => {
    if (kids.length) return toast('Supprimez d’abord les éléments liés (' + kids.length + ')');
    if (!await confirmBox(`Supprimer « ${entName(e)} » et ses documents générés ?`)) return;
    for (const d of mine) { await DB.del('docs', d.id); } A.docs = A.docs.filter(d => d.entityId !== e.id);
    await DB.del('entities', e.id); A.entities = A.entities.filter(x => x.id !== e.id); go('#/');
  };
}

/* ---------- Formulaire d'un document ---------- */
let F = null; // état du formulaire
async function pageDocForm(v, entityId, code, q) {
  const e = ent(entityId), doc = DOC_BY_CODE[code]; if (!e || !doc) return go('#/');
  const tpl = await DB.get('templates', code);
  if (!tpl) { v.innerHTML = topbar(doc.t, '#/e/' + entityId) + `<div class="card err">Modèle introuvable. Importez les modèles dans Réglages.</div>`; return; }
  const an = await analyzeDocx(code, tpl); const fields = an.fields;
  const prevDoc = q.edit ? A.docs.find(d => d.id === q.edit) : q.prev ? A.docs.find(d => d.id === q.prev) : null;
  if (!F || F.entityId !== entityId || F.code !== code || F.key !== (q.edit || q.prev || '')) {
    const ctx = prevDoc && q.edit ? prevDoc.ctx : ctxFromEntity(e, q.proj || (prevDoc ? prevDoc.ctx.projetId : null));
    F = { entityId, code, key: q.edit || q.prev || '', ctx, typed: prevDoc ? { ...prevDoc.values } : {}, editId: q.edit || null, save: true };
    if (prevDoc && !q.edit) { // document suivant : reprendre les valeurs partagées (hors fiches, dates, textes longs, cases)
      F.typed = {}; for (const k in prevDoc.values) if (!k.includes('@') && !/^B\d+$/.test(k) && k !== 'PARTY' && !ENT_OWNER[k] && !['date', 'time', 'textarea'].includes(fieldType(k)) && prevDoc.values[k]) F.typed[k] = prevDoc.values[k];
    }
  }
  if (e.type === 'client' && q.proj !== undefined && F.ctx.projetId !== (q.proj || null)) { F.ctx = ctxFromEntity(e, q.proj || null); }
  const inh = ctxValues(F.ctx);
  const valOf = f => (F.typed[f.id] != null && F.typed[f.id] !== '') ? F.typed[f.id] : (f.key === 'DATE' && !f.generic ? today() : autoValue(f, inh));
  const empties = fields.filter(f => !String(valOf(f)).trim()), filled = fields.filter(f => String(valOf(f)).trim());
  const hist = {}; A.docs.forEach(d => { for (const k in d.values) { if (d.values[k] && !ENT_OWNER[k] && !k.includes('@') && k !== 'PARTY' && !/^B\d+$/.test(k)) (hist[k] = hist[k] || new Set()).add(d.values[k]); } });
  const input = f => {
    const ty = fieldType(f.key), val = valOf(f), typed = F.typed[f.id] != null && F.typed[f.id] !== '';
    const from = typed ? '' : (String(val).trim() ? (f.generic ? 'auto' : 'hérité') : '');
    const dl = hist[f.id] && ty === 'text' ? `list="dl_${f.id}"` : ''; const dlh = hist[f.id] && ty === 'text' ? `<datalist id="dl_${f.id}">${[...hist[f.id]].slice(0, 12).map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
    const el = ty === 'textarea' ? `<textarea data-k="${esc(f.id)}" rows="3">${esc(val)}</textarea>` : `<input data-k="${esc(f.id)}" ${dl} type="${ty === 'date' ? 'date' : ty === 'time' ? 'time' : 'text'}" ${ty === 'decimal' ? 'inputmode="decimal"' : ''} value="${esc(val)}">`;
    const ctxl = f.generic ? `<small class="ctx">… ${esc(f.before.slice(-40))}<b>▢</b>${esc(f.after)}</small>` : '';
    return `<label class="fld"><span>${esc(fieldLabelOf(f))}${f.n > 1 ? ` <em>(×${f.n})</em>` : ''}${from ? ` <em class="inh">${from}</em>` : ''}</span>${ctxl}${el}${dlh}</label>`;
  };
  const projs = e.type === 'client' ? A.entities.filter(x => x.type === 'projet' && x.clientId === e.id) : [];
  const ctxNames = [F.ctx.societeId, F.ctx.clientId, F.ctx.projetId, F.ctx.marcheId].map(ent).filter(Boolean);
  const partySel = an.party ? `<label class="fld"><span>Type de cocontractant</span><select data-k="PARTY"><option value="">— garder les deux mentions —</option><option value="PHYSIQUE" ${F.typed.PARTY === 'PHYSIQUE' ? 'selected' : ''}>Personne physique</option><option value="MORALE" ${F.typed.PARTY === 'MORALE' ? 'selected' : ''}>Personne morale</option></select></label>` : '';
  const boxes = an.boxes.length ? `<details class="grp"><summary>Cases à cocher <small>${an.boxes.length}</small></summary><div class="inner">${an.boxes.map(b => `<label class="chk"><input type="checkbox" data-b="${b.id}" ${F.typed[b.id] === true ? 'checked' : ''}> ${esc(b.label)}</label>`).join('')}</div></details>` : '';
  v.innerHTML = topbar(doc.t, '#/e/' + entityId) +
    `<div class="card slim"><b>${doc.c}</b>${doc.u ? ` — <small>${esc(doc.u)}</small>` : ''}<div>${ctxNames.map(p => `<span class="chip s">${ET[p.type].icon} ${esc(entName(p))}</span>`).join('')}</div></div>` +
    (projs.length ? `<label class="fld"><span>Projet concerné (facultatif)</span><select id="projsel"><option value="">— aucun —</option>${projs.map(p => `<option value="${p.id}" ${p.id === F.ctx.projetId ? 'selected' : ''}>${esc(entName(p))}</option>`).join('')}</select></label>` : '') +
    (!fields.length && !an.boxes.length ? `<div class="card warn">Ce document n’a aucun champ variable : il sera généré tel quel.</div>` : '') +
    `<form id="docform" class="form">` + partySel +
    (empties.length ? `<h3 class="hh">À remplir <small>${empties.length}</small></h3>${empties.map(input).join('')}` : (fields.length ? `<div class="card ok">Tous les champs sont déjà renseignés ✔</div>` : '')) +
    (filled.length ? `<details class="grp" ${empties.length ? '' : 'open'}><summary>Données déjà renseignées <small>${filled.length}</small></summary><div class="inner">${filled.map(input).join('')}</div></details>` : '') + boxes +
    (fields.some(f => ENT_OWNER[f.id]) ? `<label class="chk"><input type="checkbox" id="savent" ${F.save ? 'checked' : ''}> Mettre à jour les fiches (client / projet / société) avec ces valeurs</label>` : '') +
    `<div class="actions"><button type="button" class="btn" id="draft">Enregistrer le brouillon</button><button type="submit" class="btn primary big">Validé</button></div></form>`;
  $$('[data-k]', v).forEach(i => { i.oninput = () => { F.typed[i.dataset.k] = i.value; }; });
  $$('[data-b]', v).forEach(i => { i.onchange = () => { F.typed[i.dataset.b] = i.checked; }; });
  const ps = $('#projsel'); if (ps) ps.onchange = () => { snapshot(v); go(`#/doc/${entityId}/${code}?${F.key.startsWith('') && q.edit ? 'edit=' + q.edit + '&' : ''}proj=${ps.value}`); };
  const collect = () => {
    snapshot(v); const vals = {};
    for (const f of fields) { const x = valOf(f); if (String(x).trim()) vals[f.id] = x; }
    for (const b of an.boxes) if (F.typed[b.id] === true) vals[b.id] = true;
    if (F.typed.PARTY) vals.PARTY = F.typed.PARTY;
    return vals;
  };
  $('#draft').onclick = async () => {
    const vals = collect(); const d = F.editId ? A.docs.find(x => x.id === F.editId) : null;
    const rec = d && d.status === 'brouillon' ? d : { id: uid(), code, entityId, entityType: e.type, ctx: F.ctx, status: 'brouillon', version: nextVersion(entityId, code), gid: uid(), createdAt: Date.now() };
    rec.values = vals; rec.ctx = F.ctx; rec.updatedAt = Date.now(); await saveDoc(rec); F.editId = rec.id; toast('Brouillon enregistré');
  };
  $('#docform').onsubmit = async ev => {
    ev.preventDefault(); const vals = collect(); const miss = fields.filter(f => !String(vals[f.id] ?? '').trim()).length;
    if (miss && !await confirmBox(`${miss} champ(s) non renseigné(s) resteront entre [crochets] dans le document.\n\nValider quand même ?`)) return;
    F.save = !$('#savent') || $('#savent').checked;
    busy('Création du document…');
    try {
      const g = await generate(code, vals, (m, p) => busyMsg(m, p));
      const old = F.editId ? A.docs.find(x => x.id === F.editId) : null;
      const rec = old && old.status === 'brouillon' ? old : { id: uid(), code, entityId, entityType: e.type, gid: uid(), createdAt: Date.now() };
      Object.assign(rec, { ctx: F.ctx, values: vals, status: 'validé', version: old && old.status === 'brouillon' ? nextVersion(entityId, code, old.id) : nextVersion(entityId, code), validatedAt: Date.now(), docx: g.docx, pages: g.pages, pw: g.pw, ph: g.ph, missing: g.missing });
      await saveDoc(rec);
      await updateEntities(rec, fields.filter(f => !f.generic).map(f => f.id), F.save);
      if (g.missing.length) logLine(`${code} : champs restés vides → ${g.missing.join(', ')}`);
      busyDone(); F = null; go('#/gen/' + rec.id);
    } catch (err) { busyDone(); console.error(err); logLine(`${code} : ERREUR ${err.message}`); toast('Erreur : ' + err.message); }
  };
}
function snapshot(v) { $$('[data-k]', v).forEach(i => { if (F) F.typed[i.dataset.k] = i.value; }); }
const nextVersion = (entityId, code, skipId) => 1 + Math.max(0, ...A.docs.filter(d => d.entityId === entityId && d.code === code && d.status === 'validé' && d.id !== skipId).map(d => d.version));
async function updateEntities(rec, keys, save) {
  const ctx = rec.ctx; const owner = ent(ctx.projetId) || ent(ctx.marcheId) || ent(ctx.clientId) || ent(ctx.societeId);
  if (owner) {
    const memo = owner.memo || {};
    for (const k of keys) { const val = rec.values[k]; const ty = fieldType(k); if (!val || ENT_OWNER[k] || ['date', 'time', 'textarea'].includes(ty)) continue; memo[k] = val; }
    owner.memo = memo; await saveEnt(owner);
  }
  if (!save) return;
  for (const k of keys) {
    const t = ENT_OWNER[k]; const val = rec.values[k]; if (!t || !val) continue;
    const e = ent({ societe: ctx.societeId, client: ctx.clientId, projet: ctx.projetId, marche: ctx.marcheId }[t]); if (!e) continue;
    if (e.data[k] !== val) { e.data[k] = val; await saveEnt(e); }
  }
}

/* ---------- Résultat ---------- */
const urlCache = {};
async function ensureFiles(d) {
  if (d.pages && d.docx) return d;
  busy('Régénération du document…');
  try { const g = await generate(d.code, d.values, (m, p) => busyMsg(m, p)); Object.assign(d, { docx: g.docx, pages: g.pages, pw: g.pw, ph: g.ph, missing: g.missing }); await saveDoc(d); } finally { busyDone(); }
  return d;
}
async function pageResult(v, id) {
  let d = A.docs.find(x => x.id === id); if (!d) return go('#/');
  if (d.status !== 'validé') return go(`#/doc/${d.entityId}/${d.code}?edit=${d.id}`);
  v.innerHTML = topbar('…', '#/e/' + d.entityId); d = await ensureFiles(d);
  const info = DOC_BY_CODE[d.code]; const e = ent(d.entityId);
  const imgs = d.pages.map((p, i) => { const k = d.id + ':' + i; if (!urlCache[k]) urlCache[k] = URL.createObjectURL(new Blob([p], { type: 'image/jpeg' })); return `<img class="pg" src="${urlCache[k]}" alt="page ${i + 1}">`; }).join('');
  const nexts = (WORKFLOW[d.code] || []).filter(c => DOC_BY_CODE[c]);
  v.innerHTML = topbar(info?.t || d.code, '#/e/' + d.entityId) +
    `<div class="card ok"><b>Document validé ✔</b><br><small>${d.code} · version ${d.version} · ${d.pages.length} page(s)${e ? ' · ' + esc(entName(e)) : ''}</small>${d.missing && d.missing.length ? `<div class="miss">⚠ ${d.missing.length} champ(s) restés entre crochets : ${d.missing.map(k => esc(fieldLabel(k))).join(', ')}</div>` : ''}</div>` +
    `<div class="actions col"><button class="btn primary big" id="dlpdf">⬇ Télécharger PDF</button><div class="row2"><button class="btn" id="shpdf">Partager le PDF</button><button class="btn" id="dldoc">Fichier Word</button></div></div>` +
    (nexts.length ? `<div class="sec"><h3>Document suivant suggéré</h3>${nexts.map(c => `<a class="next" href="#/doc/${d.entityId}/${c}?prev=${d.id}"><span>➜</span><span class="tx"><b>${esc(DOC_BY_CODE[c].t)}</b><small>${c}</small></span></a>`).join('')}</div>` : '') +
    `<div class="actions row2"><a class="btn" href="#/doc/${d.entityId}/${d.code}?edit=${d.id}">Modifier (nouvelle version)</a><button class="btn danger" id="deldoc">Supprimer</button></div>` +
    `<div class="sec"><h3>Aperçu</h3><div class="pages">${imgs}</div><p class="note">Le PDF est une image fidèle de la mise en page. Le fichier Word reste la version modifiable de référence.</p></div>`;
  const pdf = () => makePdf(d.pages, d.pw, d.ph);
  $('#dlpdf').onclick = async () => toast('Enregistré : ' + await saveFile(pdf(), fileBase(d) + '.pdf', 'application/pdf', false));
  $('#shpdf').onclick = async () => { const r = await saveFile(pdf(), fileBase(d) + '.pdf', 'application/pdf', true); if (r !== 'annulé') toast('PDF : ' + r); };
  $('#dldoc').onclick = async () => toast('Enregistré : ' + await saveFile(d.docx, fileBase(d) + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', false));
  $('#deldoc').onclick = async () => { if (await confirmBox('Supprimer ce document généré ?')) { await DB.del('docs', d.id); A.docs = A.docs.filter(x => x.id !== d.id); go('#/e/' + d.entityId); } };
}

/* ---------- Réglages ---------- */
async function pageSettings(v) {
  const soc = A.entities.find(x => x.type === 'societe');
  v.innerHTML = topbar('Réglages', '#/') +
    (soc ? `<div class="sec"><h3>Profil de l’entreprise</h3><a class="btn primary" href="#/edit/${soc.id}">Modifier gérant, adresse, RIB…</a></div>` : '') +
    `<div class="sec"><h3>Modèles de documents</h3><div class="card">${A.templates} / ${DOCS.length} modèles installés.<br><small>Importez le fichier ZIP des modèles (DGS_DOCUMENTS…zip) si nécessaire.</small></div><input type="file" id="zipin" accept=".zip,application/zip" hidden><button class="btn" id="zipbtn">Importer les modèles (.zip)</button></div>` +
    `<div class="sec"><h3>Sauvegarde des données</h3><div class="card"><small>Vos données sont stockées uniquement sur ce téléphone. Faites une sauvegarde régulière.</small></div><div class="row2"><button class="btn" id="exp">Exporter (JSON)</button><button class="btn" id="impbtn">Importer</button></div><input type="file" id="impin" accept=".json,application/json" hidden></div>` +
    `<div class="sec"><h3>Journal</h3><div class="log">${A.log.map(esc).join('<br>') || '<small>Vide.</small>'}</div></div>` +
    `<div class="sec"><button class="btn danger" id="reset">Effacer toutes les données</button><p class="note">DGS DOCS v1.1 — fonctionne hors ligne.</p></div>`;
  $('#zipbtn').onclick = () => $('#zipin').click();
  $('#zipin').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return; busy('Lecture du fichier…');
    try { const n = await importTemplates(new Uint8Array(await f.arrayBuffer()), (i, t) => busyMsg(`Modèles ${i}/${t}`, i / t * 100)); busyDone(); toast(n + ' modèles importés'); logLine(n + ' modèles importés'); pageSettings(v); } catch (e) { busyDone(); toast('Erreur : ' + e.message); }
  };
  $('#exp').onclick = async () => {
    const data = { app: 'dgsdocs', version: 1, date: new Date().toISOString(), entities: A.entities, docs: A.docs.map(d => { const c = { ...d }; delete c.docx; delete c.pages; return c; }) };
    toast('Enregistré : ' + await saveFile(new TextEncoder().encode(JSON.stringify(data)), `DGS_DOCS_sauvegarde_${today()}.json`, 'application/json', true));
  };
  $('#impbtn').onclick = () => $('#impin').click();
  $('#impin').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); if (j.app !== 'dgsdocs') throw new Error('Fichier non reconnu');
      if (!await confirmBox('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
      await DB.clear('entities'); await DB.clear('docs');
      for (const e of j.entities) await DB.put('entities', e.id, e); for (const d of j.docs) await DB.put('docs', d.id, d);
      await loadAll(); toast('Sauvegarde restaurée'); go('#/');
    } catch (e) { toast('Erreur : ' + e.message); }
  };
  $('#reset').onclick = async () => { if (await confirmBox('Effacer TOUS les clients, projets et documents générés ?')) { await DB.clear('entities'); await DB.clear('docs'); await loadAll(); toast('Données effacées'); go('#/'); } };
}

/* ============ Démarrage ============ */
window.addEventListener('hashchange', render);
(async function main() {
  try {
    await DB.open(); await loadAll();
    if (!A.entities.some(x => x.type === 'societe')) await saveEnt({ id: uid(), type: 'societe', data: { ...COMPANY_DEFAULTS }, societeId: null, clientId: null, marcheId: null, createdAt: Date.now() });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    if (!isNative() && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
    await autoImport();
  } catch (e) { view().innerHTML = `<div class="card err">Impossible d’ouvrir le stockage local : ${esc(e.message)}</div>`; return; }
  render();
})();
