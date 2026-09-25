import {categories, classify, flatten} from './classifier.mjs';
import {organize, restore} from './engine.mjs';
const $ = id => document.getElementById(id);
let rows = [], busy = false;
let activeCategories = categories;
const status = message => { $('status').textContent = message; };
const api = globalThis.chrome?.bookmarks;
const storage = globalThis.chrome?.storage?.local;
const PLAN_FORMAT = 'Tidymark plan v1';
function element(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function visible() { const query = $('search').value.toLowerCase(); return rows.filter(r => `${r.title} ${r.url} ${r.path} ${r.category}`.toLowerCase().includes(query)); }
function count() { const n = rows.filter(r => r.selected).length; $('count').textContent = `${n} of ${rows.length} bookmarks selected`; $('apply').disabled = !n || busy; }
function render() {
  $('rows').replaceChildren();
  for (const row of visible()) {
    const tr = document.createElement('tr'), checkCell = document.createElement('td'), info = document.createElement('td'), choice = document.createElement('td');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = row.selected; checkbox.setAttribute('aria-label', `Select ${row.title}`);
    checkbox.onchange = () => { row.selected = checkbox.checked; count(); }; checkCell.append(checkbox);
    info.append(element('b', row.title || '(untitled)'), element('small', row.url, 'url'), element('small', row.path));
    const select = document.createElement('select'); select.setAttribute('aria-label', `Destination folder for ${row.title}`);
    for (const category of activeCategories) { const option = element('option', category); option.value = category; select.append(option); }
    select.value = row.category; select.onchange = () => { row.category = select.value; summary(); };
    choice.append(select, element('small', row.reason)); tr.append(checkCell, info, choice); $('rows').append(tr);
  }
  summary(); count();
}
function summary() {
  $('summary').replaceChildren();
  for (const top of [...new Set(rows.map(r => r.category.split(' / ')[0]))]) {
    const card = element('div', top, 'card'); card.append(element('b', String(rows.filter(r => r.category.split(' / ')[0] === top).length))); $('summary').append(card);
  }
}
async function refreshUndo() { const {journal} = await storage.get('journal'); $('undo').disabled = !journal?.moves?.some(m => !m.restored); }
async function scan() {
  const tree = await api.getTree();
  rows = flatten(tree).map(r => ({...r, ...classify(r), selected: false}));
  $('root').replaceChildren();
  for (const folder of tree[0].children || []) {
    if (folder.url || folder.unmodifiable) continue;
    const option = element('option', folder.title || folder.id); option.value = folder.id; $('root').append(option);
  }
  $('workspace').hidden = false; render(); await refreshUndo();
  status(`Found ${rows.length} editable bookmarks. Select the ones you want and review the suggestions.`);
}
async function run(task) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
  try { await navigator.locks.request('tidymark-write', {ifAvailable: true}, async lock => { if (!lock) throw Error('Tidymark is busy in another tab.'); await task(); }); }
  catch (error) { status(`Operation stopped: ${error.message}\nIf a move had started, use Undo.`); }
  finally { busy = false; document.querySelectorAll('button,input,select').forEach(el => el.disabled = false); count(); if (storage) await refreshUndo(); }
}
async function applyPlan(plan) {
  if (plan.format !== PLAN_FORMAT || !Array.isArray(plan.bookmarks)) throw Error(`Invalid plan: expected format "${PLAN_FORMAT}".`);
  await scan();
  const lookup = new Map(plan.bookmarks.map(r => [r.id, r]));
  let matched = 0, needsReview = 0;
  for (const row of rows) {
    const proposed = lookup.get(row.id);
    // Only trust a plan entry if the bookmark hasn't changed since the plan was made.
    if (!proposed || proposed.url !== row.url || proposed.title !== row.title) continue;
    row.category = proposed.category;
    row.reason = proposed.reason || (proposed.reviewRequired ? 'Needs review: intent or project is unclear.' : 'From imported plan');
    row.selected = !proposed.reviewRequired;
    if (proposed.reviewRequired) needsReview++;
    matched++;
  }
  activeCategories = [...new Set([...categories, ...plan.bookmarks.map(r => r.category), ...rows.map(r => r.category)])];
  render();
  status(`${matched} bookmarks matched the plan. ${needsReview} flagged for review and ${rows.length - matched} outside the plan were left unselected. Review the destinations; nothing has moved yet.`);
}
$('scan').onclick = () => run(async () => { activeCategories = categories; await scan(); });
$('importPlan').onclick = () => $('planFile').click();
$('planFile').onchange = () => {
  const file = $('planFile').files[0];
  $('planFile').value = '';
  if (file) run(async () => applyPlan(JSON.parse(await file.text())));
};
$('search').oninput = render;
$('all').onclick = () => { visible().forEach(r => r.selected = true); render(); };
$('none').onclick = () => { visible().forEach(r => r.selected = false); render(); };
$('apply').onclick = () => {
  const n = rows.filter(r => r.selected).length;
  if (!n || !$('root').value) return;
  $('confirmText').textContent = `Move ${n} bookmarks into Tidymark subfolders under “${$('root').selectedOptions[0].textContent}”?`;
  $('confirm').showModal();
};
$('cancel').onclick = () => $('confirm').close();
$('approve').onclick = () => {
  $('confirm').close();
  const selected = rows.filter(r => r.selected).map(r => ({...r})), rootId = $('root').value;
  run(async () => {
    const result = await organize(api, storage, selected, rootId, n => status(`Moved ${n} bookmarks…`));
    await scan(); status(`${result.moved} moved; ${result.skipped} left unchanged. Undo is available.`);
  });
};
$('undo').onclick = () => run(async () => { const result = await restore(api, storage); await scan(); status(`${result.restored} restored; ${result.conflicts} need attention because they were changed or deleted. Empty folders are kept.`); });
$('backup').onclick = () => run(async () => {
  const saved = await storage.get('backup');
  const tree = saved.backup || await api.getTree();
  const url = URL.createObjectURL(new Blob([JSON.stringify({format: 'Tidymark bookmark tree v1', tree}, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'tidymark-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  status('JSON backup downloaded. After a move, this file contains the state from before the last operation.');
});
if (api) refreshUndo().catch(e => status(e.message));
else { status('To use Tidymark, load the extension folder via “Load unpacked” in chrome://extensions.'); document.querySelectorAll('button').forEach(b => b.disabled = true); }
