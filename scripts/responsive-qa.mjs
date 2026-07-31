import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const chrome = process.env.SEJF_QA_CHROME || '/home/andrii_zinchuk/.cache/sejf-qa-chrome/chrome-headless-shell-linux64/chrome-headless-shell';
const base = process.env.BASE_URL || 'http://127.0.0.1:4177';
const widths = [320,390,768,1366,1920,2560,3840];
const routes = ['/', '/portal.html'];
const results = [];
await mkdir('qa/matrix', { recursive:true });

const browser = await puppeteer.launch({ executablePath:chrome, headless:true, args:['--no-sandbox','--disable-gpu'] });
try {
  for (const route of routes) {
    for (const width of widths) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => m.type()==='error' && errors.push(m.text()));
      await page.setViewport({ width, height: width <= 390 ? 844 : 1000, deviceScaleFactor:1 });
      const response = await page.goto(`${base}${route}?qa=${width}`, { waitUntil:'networkidle0', timeout:30000 });
      const data = await page.evaluate(() => {
        const root=document.documentElement;
        const visible = el => { const r=el?.getBoundingClientRect(); return !!r && r.width>0 && r.height>0; };
        const h1=document.querySelector('h1');
        const cta=document.querySelector('.nav-cta, .command');
        return {
          title:document.title,
          clientWidth:root.clientWidth,
          scrollWidth:root.scrollWidth,
          overflow:root.scrollWidth-root.clientWidth,
          h1:h1?.innerText,
          h1Rect:h1 ? {left:h1.getBoundingClientRect().left,right:h1.getBoundingClientRect().right,width:h1.getBoundingClientRect().width}:null,
          ctaVisible:visible(cta),
          syntheticBanner:document.body.innerText.includes('SYNTHETIC DATA')
        };
      });
      if (route === '/' && width === 1366) {
        await page.evaluate(() => document.querySelector('[data-castle-stage="5"]')?.scrollIntoView({ block:'center', behavior:'instant' }));
        await new Promise(resolve => setTimeout(resolve, 1600));
        const castleState = await page.$eval('.castle-stage', el => ({ stage:el.dataset.stage, gate:Number(getComputedStyle(el.querySelector('.gate')).opacity), flag:Number(getComputedStyle(el.querySelector('.flag')).opacity) }));
        if (castleState.stage !== '5' || castleState.gate < .9 || castleState.flag < .9) errors.push(`castle final mismatch: ${JSON.stringify(castleState)}`);
        const hiddenReveals = await page.$$eval('.reveal', els => els.filter(el => Number(getComputedStyle(el).opacity) < .9 && el.getBoundingClientRect().top < innerHeight && el.getBoundingClientRect().bottom > 0).length);
        if (hiddenReveals) errors.push(`visible reveal nodes hidden: ${hiddenReveals}`);
        await page.evaluate(() => scrollTo({ top:0, behavior:'instant' }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (route === '/portal.html' && width === 1366) {
        await page.click('#queue-filter');
        const allRows = await page.$$eval('.queue-row', els => els.length);
        if (allRows !== 4) errors.push(`queue filter mismatch: ${allRows}`);
      }
      if ([390,1366].includes(width)) await page.screenshot({ path:`qa/matrix/${route==='/'?'home':'portal'}-${width}.png`, fullPage:false });
      results.push({ route,width,http:response?.status(),errors,...data });
      await page.close();
    }
  }
  const reducedPage = await browser.newPage();
  const reducedErrors = [];
  reducedPage.on('pageerror', error => reducedErrors.push(error.message));
  reducedPage.on('console', message => message.type() === 'error' && reducedErrors.push(message.text()));
  await reducedPage.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
  await reducedPage.setViewport({ width:390, height:844, deviceScaleFactor:1 });
  const reducedResponse = await reducedPage.goto(`${base}/?qa=reduced-motion`, { waitUntil:'networkidle0', timeout:30000 });
  const reducedData = await reducedPage.evaluate(() => {
    const root = document.documentElement;
    const hidden = [...document.querySelectorAll('.reveal')].filter(el => Number(getComputedStyle(el).opacity) < .99).length;
    const running = document.getAnimations().filter(animation => animation.playState === 'running').length;
    const cta = document.querySelector('.nav-cta');
    const rect = cta?.getBoundingClientRect();
    return { title:document.title, clientWidth:root.clientWidth, scrollWidth:root.scrollWidth, overflow:root.scrollWidth-root.clientWidth, h1:document.querySelector('h1')?.innerText, h1Rect:null, ctaVisible:!!rect?.width, syntheticBanner:false, hidden, running, stage:document.querySelector('.castle-stage')?.dataset.stage };
  });
  if (reducedData.hidden || reducedData.running || reducedData.stage !== '5') reducedErrors.push(`reduced motion mismatch: ${JSON.stringify({ hidden:reducedData.hidden, running:reducedData.running, stage:reducedData.stage })}`);
  results.push({ route:'/reduced-motion', width:390, http:reducedResponse?.status(), errors:reducedErrors, ...reducedData });
  await reducedPage.close();
} finally { await browser.close(); }
await writeFile('qa/matrix/results.json', JSON.stringify(results,null,2));
const failures=results.filter(x=>x.http!==200 || x.overflow>0 || x.errors.length || !x.ctaVisible);
console.log(JSON.stringify({checks:results.length,failures,pass:failures.length===0},null,2));
if (failures.length) process.exitCode=1;
