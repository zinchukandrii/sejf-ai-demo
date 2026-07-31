import { animate, stagger } from './vendor/anime.esm.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let showActive = true;
let dashboard;

const riskClass = risk => `risk-${risk.toLowerCase()}`;
const renderQueue = () => {
  const rows = showActive ? dashboard.queue.filter(x => x.status !== 'COMPLETED') : dashboard.queue;
  $('#queue-rows').innerHTML = rows.map(item => `<article class="queue-row"><div><strong>${item.id}</strong><span>${item.workflow}</span></div><span>${item.owner}</span><b class="${riskClass(item.risk)}">${item.risk}</b><i>${item.status.replaceAll('_',' ')}</i><span>${item.age}</span><em>${item.evidence} refs</em></article>`).join('');
  if (!reduced) animate('.queue-row', { opacity:[0,1], y:[18,0], delay:stagger(70), duration:520, ease:'out(3)' });
};

async function boot() {
  const publicStatic = location.hostname.endsWith('github.io') || location.pathname.includes('/sejf-ai-demo/');
  let response = await fetch(publicStatic ? './demo-dashboard.json' : './api/demo-dashboard');
  if (!response.ok && !publicStatic) response = await fetch('./demo-dashboard.json');
  if (!response.ok) throw new Error('Dashboard data unavailable');
  dashboard = await response.json();
  $('#tenant').textContent = dashboard.tenant;
  $('#health').textContent = dashboard.health;
  $('#environment').textContent = dashboard.environment;
  $$('[data-metric]').forEach(el => el.textContent = dashboard.metrics[el.dataset.metric]);
  $('#route-flow').innerHTML = dashboard.route.map(x => `<article><span>${x.step}</span><strong>${x.label}</strong><i>${x.state}</i></article>`).join('<b class="route-arrow">→</b>');
  $('#quality-bars').innerHTML = dashboard.quality.map(x => `<div><header><span>${x.label}</span><strong>${x.value}%</strong></header><i><b style="--score:${x.value}%"></b></i></div>`).join('');
  $('#event-log').innerHTML = dashboard.events.map(x => `<article><time>${x.time}</time><strong>${x.action}</strong><span>${x.actor}</span><code>${x.receipt}</code></article>`).join('');
  renderQueue();
  if (!reduced) {
    animate('.dashboard-hero h1', { opacity:[0,1], y:[45,0], duration:900, ease:'out(4)' });
    animate('.metrics article', { opacity:[0,1], y:[22,0], delay:stagger(85), duration:650, ease:'out(3)' });
    animate('.route-flow article', { opacity:[0,1], x:[-20,0], delay:stagger(120), duration:700, ease:'out(4)' });
    animate('.quality-bars i b', { width:['0%', el => el.style.getPropertyValue('--score')], delay:stagger(120), duration:1100, ease:'inOut(3)' });
    animate('.progress', { strokeDashoffset:[553,32.6], duration:1400, ease:'inOut(3)' });
    animate('.route-pulse i', { x:['0%', 'calc(100vw - 12vw)'], opacity:[0,1,1,0], duration:3200, loop:true, ease:'inOut(2)' });
  }
}

$('#queue-filter').addEventListener('click', e => { showActive=!showActive; e.currentTarget.textContent=`Pokaż: ${showActive?'aktywne':'wszystkie'}`; renderQueue(); });
$('.command').addEventListener('click', () => alert('Demo command palette\n\n01 Otwórz kolejkę\n02 Zweryfikuj evidence chain\n03 Eksportuj receipt\n\nW produkcji wszystkie akcje są tenant-scoped i audytowane.'));
boot().catch(error => { $('#health').textContent='DATA ERROR'; console.error(error); });
