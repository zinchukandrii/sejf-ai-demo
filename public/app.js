import { animate, stagger } from './vendor/anime.esm.js';

const routes = {
  public: { label: 'API UE', note: 'Niski koszt, szybki start, dane niesensytywne.' },
  internal: { label: 'Sovereign cloud', note: 'Kontrolowany region UE, prywatna sieć, audyt dostawcy.' },
  confidential: { label: 'On-prem / klient', note: 'Poufne dokumenty pozostają w środowisku klienta.' },
  regulated: { label: 'Isolated on-prem', note: 'Najpierw klasyfikacja prawna, DPIA i security review.' }
};

const sensitivity = document.querySelector('#router-sensitivity');
const frequency = document.querySelector('#router-frequency');
const routeLabel = document.querySelector('#route-label');
const routeNote = document.querySelector('#route-note');
const receipt = document.querySelector('#receipt');

function updateRouter() {
  const choice = routes[sensitivity.value];
  const cadence = frequency.value;
  routeLabel.textContent = choice.label;
  routeNote.textContent = choice.note;
  receipt.innerHTML = `<span>ROUTE / ${choice.label.toUpperCase()}</span><span>CADENCE / ${cadence.toUpperCase()}</span><span>APPROVAL / REQUIRED</span><span>LOG / ENABLED</span>`;
}
sensitivity.addEventListener('change', updateRouter);
frequency.addEventListener('change', updateRouter);
updateRouter();

const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (location.hostname.endsWith('github.io')) {
    status.className = 'form-status success';
    status.textContent = 'To publiczny showroom bez zbierania danych. Formularz zostanie podłączony dopiero po wdrożeniu polityki prywatności i bezpiecznego backendu.';
    return;
  }
  status.className = 'form-status';
  status.textContent = 'Analizuję workflow…';
  const data = Object.fromEntries(new FormData(form).entries());
  data.users = Number(data.users || 0);
  data.consent = Boolean(data.consent);
  try {
    const response = await fetch('./api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(`Uzupełnij pola: ${(result.errors || []).join(', ')}`);
    status.className = 'form-status success';
    status.innerHTML = `<strong>Brief zapisany: ${result.id}</strong><br>Wstępna ścieżka: ${result.qualification.route} · score ${result.qualification.score}/100.<br><small>Nic nie zostało wysłane automatycznie — zgłoszenie czeka na ludzką akceptację.</small>`;
    form.reset();
  } catch (error) {
    status.className = 'form-status error';
    status.textContent = error.message || 'Nie udało się zapisać zgłoszenia.';
  }
});

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) {
  animate('.hero .eyebrow', { opacity:[0,1], y:[18,0], duration:550, ease:'out(3)' });
  animate('.hero h1', { opacity:[0,1], y:[50,0], duration:950, delay:100, ease:'out(4)' });
  animate('.hero-bottom > *', { opacity:[0,1], y:[28,0], delay:stagger(130,{start:360}), duration:720, ease:'out(3)' });
}

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('visible');
  if (!reduced && entry.target.classList.contains('system-stage')) {
    animate('.system-map article', { opacity:[0,1], y:[24,0], delay:stagger(100), duration:650, ease:'out(3)' });
    animate('.system-beam i', { x:['0vw','82vw'], opacity:[0,1,1,0], duration:4200, loop:true, ease:'inOut(2)' });
  }
  if (!reduced && entry.target.classList.contains('cases')) {
    animate('.case-rail article', { opacity:[0,1], y:[30,0], delay:stagger(110), duration:700, ease:'out(4)' });
  }
  observer.unobserve(entry.target);
}), { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
