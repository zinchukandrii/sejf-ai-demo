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
        await page.select('#router-sensitivity', 'confidential');
        const routed = await page.$eval('#route-label', el => el.textContent.trim());
        if (routed !== 'On-prem / klient') errors.push(`router mismatch: ${routed}`);
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
} finally { await browser.close(); }
await writeFile('qa/matrix/results.json', JSON.stringify(results,null,2));
const failures=results.filter(x=>x.http!==200 || x.overflow>0 || x.errors.length || !x.ctaVisible);
console.log(JSON.stringify({checks:results.length,failures,pass:failures.length===0},null,2));
if (failures.length) process.exitCode=1;
