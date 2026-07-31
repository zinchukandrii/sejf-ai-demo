import http from 'node:http';
import { readFile, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const dataDir = join(root, 'data');
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '0.0.0.0';

const demoDashboard = {
  generatedAt: '2026-07-30T21:00:00.000Z',
  synthetic: true,
  tenant: 'NORTHSTAR COMPONENTS / DEMO',
  environment: 'ISOLATED ON-PREM',
  health: 'OPERATIONAL',
  metrics: {
    workflowRuns: 1842,
    approvalRequired: 312,
    citationCoverage: 98.7,
    humanOverrideRate: 4.2,
    p95LatencySeconds: 7.8,
    openIncidents: 0
  },
  queue: [
    { id:'QC-1842', workflow:'Supplier quality packet', owner:'A. Kowalska', risk:'MEDIUM', status:'WAITING_APPROVAL', age:'12 min', evidence:8 },
    { id:'QC-1841', workflow:'Specification gap scan', owner:'P. Nowak', risk:'LOW', status:'READY', age:'19 min', evidence:12 },
    { id:'QC-1840', workflow:'Deviation evidence brief', owner:'M. Zieliński', risk:'HIGH', status:'HUMAN_REVIEW', age:'31 min', evidence:5 },
    { id:'QC-1839', workflow:'Change-control summary', owner:'A. Kowalska', risk:'LOW', status:'COMPLETED', age:'47 min', evidence:9 }
  ],
  quality: [
    { label:'Citations valid', value:98.7 },
    { label:'Required fields', value:96.4 },
    { label:'Policy compliance', value:100 },
    { label:'Human agreement', value:94.1 }
  ],
  route: [
    { step:'01', label:'SharePoint', state:'SOURCE' },
    { step:'02', label:'Policy gate v1.8', state:'PASS' },
    { step:'03', label:'Local SLM', state:'ROUTE' },
    { step:'04', label:'Private LLM 32B', state:'INFERENCE' },
    { step:'05', label:'Human approval', state:'REQUIRED' }
  ],
  events: [
    { time:'14:42:18', action:'OUTPUT_CREATED', actor:'agent/qc-review', receipt:'rcpt_91f2' },
    { time:'14:42:11', action:'CITATIONS_VERIFIED', actor:'eval/citation-v3', receipt:'rcpt_91f1' },
    { time:'14:41:56', action:'MODEL_ROUTED', actor:'policy/router-v1.8', receipt:'rcpt_91f0' },
    { time:'14:41:49', action:'SOURCE_SCOPE_CHECKED', actor:'access/rbac', receipt:'rcpt_91ef' }
  ]
};

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

export function scoreLead(lead) {
  let score = 0;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };
  if (['confidential', 'regulated'].includes(lead.sensitivity)) add(25, 'poufne lub regulowane dane');
  if (lead.sensitivity === 'internal') add(12, 'dane wewnętrzne');
  if (['weekly', 'daily'].includes(lead.frequency)) add(20, 'powtarzalny workflow');
  if (lead.frequency === 'monthly') add(8, 'cykliczny workflow');
  if (Number(lead.users) >= 20) add(15, 'co najmniej 20 użytkowników');
  else if (Number(lead.users) >= 5) add(8, 'zespół pilotażowy');
  if (lead.systems && lead.systems.trim().length >= 3) add(10, 'widoczne systemy integracyjne');
  if (lead.outcome && lead.outcome.trim().length >= 20) add(15, 'opisany wynik biznesowy');
  if (lead.email && /@/.test(lead.email)) add(5, 'kontakt firmowy do weryfikacji');
  score = Math.min(100, score);
  const route = score >= 70 ? 'PAID_PILOT' : score >= 40 ? 'AUDIT_LITE' : 'NOT_NOW';
  return { score, route, reasons };
}

function clean(value, max = 1000) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}

function validate(payload) {
  const lead = {
    company: clean(payload.company, 120),
    name: clean(payload.name, 120),
    email: clean(payload.email, 180),
    workflow: clean(payload.workflow, 1200),
    outcome: clean(payload.outcome, 1200),
    systems: clean(payload.systems, 500),
    sensitivity: clean(payload.sensitivity, 30),
    frequency: clean(payload.frequency, 30),
    users: Number(payload.users || 0),
    consent: payload.consent === true
  };
  const errors = [];
  if (!lead.company) errors.push('company');
  if (!lead.name) errors.push('name');
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) errors.push('email');
  if (lead.workflow.length < 20) errors.push('workflow');
  if (!['public', 'internal', 'confidential', 'regulated'].includes(lead.sensitivity)) errors.push('sensitivity');
  if (!['occasional', 'monthly', 'weekly', 'daily'].includes(lead.frequency)) errors.push('frequency');
  if (!lead.consent) errors.push('consent');
  return { lead, errors };
}

async function saveLead(lead, qualification) {
  await mkdir(join(dataDir, 'briefs'), { recursive: true });
  const id = `lead_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const record = { id, createdAt: new Date().toISOString(), ...lead, qualification, status: 'PENDING_HUMAN_APPROVAL' };
  await appendFile(join(dataDir, 'leads.jsonl'), JSON.stringify(record) + '\n');
  const brief = `# Private AI lead brief\n\n- ID: ${id}\n- Status: PENDING_HUMAN_APPROVAL\n- Firma: ${lead.company}\n- Kontakt: ${lead.name} <${lead.email}>\n- Score: ${qualification.score}/100\n- Route: ${qualification.route}\n- Powody: ${qualification.reasons.join('; ') || 'brak'}\n\n## Workflow\n${lead.workflow}\n\n## Oczekiwany wynik\n${lead.outcome || 'Nie podano'}\n\n## Dane i systemy\n- Wrażliwość: ${lead.sensitivity}\n- Częstotliwość: ${lead.frequency}\n- Użytkownicy: ${lead.users}\n- Systemy: ${lead.systems || 'Nie podano'}\n\n## Gate\nNie kontaktować automatycznie. Outreach, CRM, email i kalendarz wymagają zatwierdzenia człowieka.\n`;
  await writeFile(join(dataDir, 'briefs', `${id}.md`), brief);
  await appendFile(join(dataDir, 'approval-queue.jsonl'), JSON.stringify({ id, route: qualification.route, score: qualification.score, status: 'WAITING' }) + '\n');
  return { id, status: record.status, qualification };
}

async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50_000) throw new Error('payload_too_large');
  }
  return JSON.parse(raw || '{}');
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.includes('json') ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, service: 'sejf-site', approvalGate: true });
    if (req.method === 'GET' && req.url === '/api/demo-dashboard') return send(res, 200, demoDashboard);
    if (req.method === 'POST' && req.url === '/api/leads') {
      const payload = await bodyJson(req);
      const { lead, errors } = validate(payload);
      if (errors.length) return send(res, 400, { ok: false, errors });
      const result = await saveLead(lead, scoreLead(lead));
      return send(res, 201, { ok: true, ...result });
    }
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method_not_allowed' });
    const pathname = req.url.split('?')[0];
    if (pathname === '/vendor/anime.esm.js') {
      const anime = await readFile(join(root, 'node_modules', 'animejs', 'lib', 'anime.esm.min.js'));
      res.writeHead(200, { 'content-type': types['.js'], 'cache-control': 'public, max-age=86400' });
      return res.end(anime);
    }
    const rawPath = pathname === '/' ? '/index.html' : pathname;
    const safe = normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const path = join(publicDir, safe);
    if (!path.startsWith(publicDir)) return send(res, 403, { ok: false });
    try {
      const file = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'public, max-age=300' });
      res.end(file);
    } catch {
      send(res, 404, { ok: false, error: 'not_found' });
    }
  } catch (error) {
    send(res, error.message === 'payload_too_large' ? 413 : 500, { ok: false, error: error.message });
  }
});

if (process.env.NODE_ENV !== 'test') server.listen(port, host, () => console.log(`SEJF AI → http://${host}:${port}`));
export { server, validate };
