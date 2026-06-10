import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const screenshotsDir = path.join(repoRoot, 'docs/graduation-book/assets/screenshots');
const sampleCvPath = path.join(repoRoot, 'docs/graduation-book/assets/sample_cv_careercompass_demo.pdf');
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chromePort = Number(process.env.CHROME_DEBUG_PORT || 9223);
const appOrigin = process.env.APP_ORIGIN || 'http://localhost';
const apiBase = `${appOrigin}/api/v1`;

const studentEmail = process.env.CC_REPORT_STUDENT_EMAIL || 'careercompass.report.20260529222439@gmail.com';
const studentPassword = process.env.CC_REPORT_STUDENT_PASSWORD || 'CareerCompass2026';
const adminEmail = process.env.CC_REPORT_ADMIN_EMAIL || 'careercompassadmin@gmail.com';
const adminPassword = process.env.CC_REPORT_ADMIN_PASSWORD || 'CareerCompassAdmin2026';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url, options = {}, attempts = 80) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Unable to fetch ${url}`);
}

function startChrome(userDataDir) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1366,768',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  return spawn(chromePath, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.opened = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }

      const callbacks = this.listeners.get(message.method) || [];
      callbacks.forEach((callback) => callback(message.params || {}));
    };
  }

  async send(method, params = {}) {
    await this.opened;
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const callback = (params) => {
        clearTimeout(timer);
        const callbacks = this.listeners.get(method) || [];
        this.listeners.set(method, callbacks.filter((item) => item !== callback));
        resolve(params);
      };
      const timer = setTimeout(() => {
        const callbacks = this.listeners.get(method) || [];
        this.listeners.set(method, callbacks.filter((item) => item !== callback));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const callbacks = this.listeners.get(method) || [];
      callbacks.push(callback);
      this.listeners.set(method, callbacks);
    });
  }

  close() {
    this.ws.close();
  }
}

async function openPage() {
  let target;
  try {
    target = await fetchJsonWithRetry(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' }, 8);
  } catch {
    const targets = await fetchJsonWithRetry(`http://127.0.0.1:${chromePort}/json`);
    target = targets.find((item) => item.type === 'page') || targets[0];
  }
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return cdp;
}

async function navigate(cdp, url, waitMs = 1400) {
  const load = cdp.once('Page.loadEventFired', 20000).catch(() => null);
  await cdp.send('Page.navigate', { url });
  await load;
  await delay(waitMs);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function setScroll(cdp, top = 0) {
  await evaluate(cdp, `window.scrollTo({ top: ${top}, left: 0, behavior: 'instant' }); true;`);
  await delay(400);
}

async function screenshot(cdp, fileName, note = '') {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const target = path.join(screenshotsDir, fileName);
  await writeFile(target, Buffer.from(result.data, 'base64'));
  console.log(`${fileName}${note ? ` - ${note}` : ''}`);
}

async function loginInPage(cdp, email, password) {
  const payload = JSON.stringify({ email, password });
  return evaluate(cdp, `
    (async () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: ${JSON.stringify(payload)}
      });
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      return { id: data.data.user.id, email: data.data.user.email, role: data.data.user.role };
    })()
  `);
}

async function getToken(cdp) {
  return evaluate(cdp, 'localStorage.getItem("auth_token")');
}

async function setStoredUser(cdp, user) {
  await evaluate(cdp, `localStorage.setItem('user', ${JSON.stringify(JSON.stringify(user))}); true;`);
}

async function apiJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${url}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function uploadSampleCv(cdp) {
  const token = await getToken(cdp);
  const bytes = await readFile(sampleCvPath);
  const form = new FormData();
  form.append(
    'cv',
    new Blob([bytes], { type: 'application/pdf' }),
    'sample_cv_careercompass_demo.pdf',
  );
  const response = await fetch(`${apiBase}/upload-cv`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`CV upload failed: ${JSON.stringify(payload)}`);
  }
  if (payload.user) {
    await setStoredUser(cdp, payload.user);
  }
  return { token, payload };
}

async function firstJobId(token) {
  let payload = await apiJson(`${apiBase}/jobs/recommended`, token);
  let jobs = Array.isArray(payload.data) ? payload.data : [];
  if (jobs.length === 0) {
    payload = await apiJson(`${apiBase}/jobs`, token);
    jobs = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
  }
  if (jobs.length === 0) {
    throw new Error('No jobs were available for screenshot navigation.');
  }
  return jobs[0].id;
}

async function saveApplication(token, jobId) {
  return apiJson(`${apiBase}/applications`, token, {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId, status: 'saved' }),
  });
}

async function run() {
  await mkdir(screenshotsDir, { recursive: true });
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'careercompass-chrome-'));
  const chrome = startChrome(userDataDir);
  let stderr = '';
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await fetchJsonWithRetry(`http://127.0.0.1:${chromePort}/json/version`);
    const cdp = await openPage();

    await navigate(cdp, `${appOrigin}/`);
    await screenshot(cdp, '01_home.png');

    await navigate(cdp, `${appOrigin}/register`);
    await screenshot(cdp, '02_register.png');

    await navigate(cdp, `${appOrigin}/login`);
    await screenshot(cdp, '03_login.png');

    await loginInPage(cdp, studentEmail, studentPassword);
    await navigate(cdp, `${appOrigin}/dashboard`, 2000);
    await screenshot(cdp, '04_dashboard_before_cv_upload.png');
    await setScroll(cdp, 260);
    await screenshot(cdp, '05_cv_upload_ui.png');

    const upload = await uploadSampleCv(cdp);
    const studentToken = upload.token;

    await navigate(cdp, `${appOrigin}/dashboard`, 2200);
    await screenshot(cdp, '06_dashboard_after_cv_upload.png', upload.payload.parsing_status || '');

    await navigate(cdp, `${appOrigin}/profile`, 1800);
    await screenshot(cdp, '07_extracted_profile_skills.png');

    await navigate(cdp, `${appOrigin}/jobs`, 2600);
    await screenshot(cdp, '08_jobs_recommendations.png');

    const jobId = await firstJobId(studentToken);
    await saveApplication(studentToken, jobId).catch(() => null);

    await setScroll(cdp, 420);
    await screenshot(cdp, '09_job_details_and_inline_gap.png');

    await navigate(cdp, `${appOrigin}/gap-analysis/${jobId}`, 4200);
    await screenshot(cdp, '10_gap_analysis.png');

    await navigate(cdp, `${appOrigin}/applications`, 2200);
    await screenshot(cdp, '11_applications_tracker.png');

    await navigate(cdp, `${appOrigin}/tools`, 1600);
    await screenshot(cdp, '12_tools_hub.png');

    await navigate(cdp, `${appOrigin}/status`, 1800);
    await screenshot(cdp, '13_system_status.png');

    await navigate(cdp, `${appOrigin}/login`);
    await loginInPage(cdp, adminEmail, adminPassword);

    await navigate(cdp, `${appOrigin}/admin/dashboard`, 2500);
    await screenshot(cdp, '14_admin_dashboard.png');

    await navigate(cdp, `${appOrigin}/admin/jobs`, 2200);
    await screenshot(cdp, '15_admin_jobs.png');

    await navigate(cdp, `${appOrigin}/admin/sources`, 2600);
    await screenshot(cdp, '16_admin_sources_diagnostics.png');

    await navigate(cdp, `${appOrigin}/admin/targets`, 2200);
    await screenshot(cdp, '17_admin_targets.png');

    cdp.close();
  } finally {
    chrome.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
    if (stderr.trim()) {
      console.error(stderr.split('\n').slice(-8).join('\n'));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
