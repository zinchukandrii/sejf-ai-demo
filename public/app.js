const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const publicHost = /github\.io$/i.test(location.hostname);

const revealNodes = $$('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealNodes.forEach((node) => node.classList.add('visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  revealNodes.forEach((node) => revealObserver.observe(node));
}

function runHeroIntro() {
  if (reduceMotion || !window.anime) return;
  anime.timeline({ easing: 'cubicBezier(.2,.8,.2,1)' })
    .add({ targets: '.hero-piece', translateY: [70, 0], opacity: [0, 1], duration: 1050, delay: anime.stagger(110) })
    .add({ targets: '.hero-orbit', scale: [.78, 1], opacity: [0, 1], rotate: ['-14deg', '0deg'], duration: 1500 }, '-=1100')
    .add({ targets: '.signal-core', scale: [0, 1], opacity: [0, 1], duration: 700 }, '-=850');
}
if (document.readyState === 'complete') runHeroIntro();
else addEventListener('load', runHeroIntro, { once: true });

const hero = $('.hero');
if (hero && 'IntersectionObserver' in window) {
  const heroObserver = new IntersectionObserver(([entry]) => {
    hero.classList.toggle('is-offscreen', !entry.isIntersecting);
  }, { threshold: 0.02 });
  heroObserver.observe(hero);
}

document.addEventListener('visibilitychange', () => {
  hero?.classList.toggle('is-background', document.hidden);
});

const castle = $('.castle-stage');
const chapters = $$('.castle-chapters [data-castle-stage]');
let currentStage = 1;
let ticking = false;

function activateStage(nextStage) {
  if (!castle || nextStage === currentStage) return;
  currentStage = nextStage;
  castle.dataset.stage = String(nextStage);
  const stageNumber = $('#stage-number');
  if (stageNumber) stageNumber.textContent = String(nextStage).padStart(2, '0');
  chapters.forEach((chapter) => chapter.classList.toggle('active', Number(chapter.dataset.castleStage) === nextStage));
  if (!reduceMotion && window.anime) {
    const layerSelectors = {
      1: '.foundation', 2: '.wall', 3: '.tower', 4: '.bridge', 5: '.gate, .flag'
    };
    anime({
      targets: layerSelectors[nextStage],
      translateY: [24, 0],
      opacity: [0, 1],
      duration: 800,
      delay: anime.stagger(90),
      easing: 'cubicBezier(.16,.84,.3,1)'
    });
  }
}

function updateCastleStage() {
  ticking = false;
  if (!castle || reduceMotion) return;
  const focusY = innerHeight * 0.46;
  let closest = chapters[0];
  let distance = Infinity;
  chapters.forEach((chapter) => {
    const rect = chapter.getBoundingClientRect();
    const chapterCenter = rect.top + rect.height * 0.35;
    const nextDistance = Math.abs(chapterCenter - focusY);
    if (nextDistance < distance) {
      distance = nextDistance;
      closest = chapter;
    }
  });
  activateStage(Number(closest?.dataset.castleStage || 1));
}

if (castle) {
  if ('IntersectionObserver' in window) {
    const castleObserver = new IntersectionObserver(([entry]) => {
      castle.classList.toggle('is-offscreen', !entry.isIntersecting);
    }, { threshold: 0.02 });
    castleObserver.observe(castle);
  }
  if (reduceMotion) {
    currentStage = 5;
    castle.dataset.stage = '5';
    $('#stage-number').textContent = '05';
    chapters.forEach((chapter) => chapter.classList.add('active'));
  } else {
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateCastleStage);
    }, { passive: true });
    addEventListener('resize', updateCastleStage, { passive: true });
    updateCastleStage();
  }
}

const form = $('#audit-form');
const statusBox = $('#form-status');

function showStatus(message, type = '') {
  if (!statusBox) return;
  statusBox.className = `form-status ${type}`.trim();
  statusBox.textContent = message;
}

if (form) {
  if (publicHost) {
    form.querySelector('button').disabled = true;
    form.querySelector('button span').textContent = 'Formularz demo — bez zapisu';
    showStatus('Publiczny showroom nie zapisuje danych. Produkcyjny kontakt zostanie uruchomiony po zatwierdzeniu domeny i polityki prywatności.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (publicHost) return;
    if (!form.reportValidity()) return;

    const button = form.querySelector('button');
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.consent = form.elements.consent.checked;
    payload.users = Number(payload.users || 5);
    button.disabled = true;
    showStatus('Sprawdzam dane i przygotowuję brief…');

    try {
      const response = await fetch('./api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nie udało się zapisać briefu.');
      showStatus(`Brief zapisany: ${result.id}. Ścieżka: ${result.route}, score ${result.score}/100. Nic nie zostało wysłane automatycznie — zgłoszenie czeka na ludzką akceptację.`, 'success');
      form.reset();
    } catch (error) {
      showStatus(error.message || 'Błąd połączenia. Spróbuj ponownie.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}
