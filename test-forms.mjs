import { onRequest } from './functions/api/form.js';

const env = {
  MS_TENANT_ID: 't-123',
  MS_CLIENT_ID: 'c-123',
  MS_CLIENT_SECRET: 's-123',
  MS_SENDER: 'info@oryele.com',
  TURNSTILE_SECRET_KEY: 'ts-secret',
  SITE_ORIGIN: 'https://oryele.com',
  SEND_AUTOREPLY: 'true',
};

let calls = [];
let graphStatus = 202;
let lastMessage = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  calls.push(u);
  if (u.includes('siteverify')) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (u.includes('oauth2/v2.0/token')) {
    return new Response(
      JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (u.includes('/sendMail')) {
    const msg = JSON.parse(init.body).message;
    if (msg.subject !== 'We received your message') lastMessage = msg;
    calls.push('to:' + msg.toRecipients.map((r) => r.emailAddress.address).join(','));
    calls.push('subject:' + msg.subject);
    return new Response('', { status: graphStatus });
  }
  return new Response('', { status: 404 });
};

let submissions = [];
let subscribers = [];
const DB = {
  prepare: (sql) => ({
    bind: (...args) => ({
      run: async () => {
        if (sql.includes('newsletter_subscribers')) subscribers.push(args);
        else submissions.push(args);
      },
    }),
  }),
};

const ctx = (request, over = {}) => ({
  request,
  env: { ...env, DB, ...over },
  waitUntil: (p) => p,
});

function multipart(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request('https://oryele.com/api/form', {
    method: 'POST',
    headers: {
      Origin: 'https://oryele.com',
      'CF-Connecting-IP': '203.0.113.9',
      'CF-IPCountry': 'US',
      'User-Agent': 'test',
    },
    body,
  });
}

const TS = { 'cf-turnstile-response': 'tok' };

const contactGeneral = {
  formType: 'contact',
  'First Name': 'Jane',
  'Last Name': 'Doe',
  Email: 'jane@acme.com',
  Firm: 'Acme Accounting',
  Reason: 'Technical Question',
  Message: 'We would like to see the digital workforce module in action.',
  ...TS,
};
const contactSales = { ...contactGeneral, Reason: 'Talk to Sales' };
const newsletter = { formType: 'newsletter', Email: 'reader@example.com', Source: 'Newsletter footer' };

let pass = 0;
let fail = 0;
async function check(label, fn) {
  try {
    await fn();
    pass++;
    console.log('  PASS  ' + label);
  } catch (e) {
    fail++;
    console.log('  FAIL  ' + label + '  >> ' + e.message);
  }
}
function eq(a, b, what) {
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}
function has(needle) {
  if (!calls.some((c) => c.includes(needle))) throw new Error('missing call ' + needle);
}

console.log('\nOryele form router (contact + newsletter only), server side checks\n');

console.log('  Routing');
await check('general contact routes to info@oryele.com', async () => {
  calls = [];
  const res = await onRequest(ctx(multipart(contactGeneral)));
  eq(res.status, 200, 'status');
  has('to:info@oryele.com');
  has('subject:Contact form: Jane Doe at Acme Accounting');
});

await check('"Talk to Sales" reason routes to sales@oryele.com', async () => {
  calls = [];
  const res = await onRequest(ctx(multipart(contactSales)));
  eq(res.status, 200, 'status');
  has('to:sales@oryele.com');
});

await check('careers is not handled here', async () => {
  const res = await onRequest(ctx(multipart({ formType: 'careers', Name: 'x' })));
  eq(res.status, 400, 'status');
});

await check('unknown form type rejected', async () => {
  const res = await onRequest(ctx(multipart({ ...contactGeneral, formType: 'payroll' })));
  eq(res.status, 400, 'status');
});

console.log('\n  Newsletter');
await check('newsletter writes a subscriber and notifies info@oryele.com by default', async () => {
  calls = [];
  subscribers = [];
  const res = await onRequest(ctx(multipart(newsletter)));
  const out = await res.json();
  eq(res.status, 200, 'status');
  eq(subscribers.length, 1, 'subscriber rows');
  eq(subscribers[0][0], 'reader@example.com', 'email column');
  has('to:info@oryele.com');
  if (calls.some((c) => c.includes('siteverify'))) throw new Error('turnstile required');
  eq(out.message, 'You are on the list. Thank you for subscribing.', 'message');
});

await check('TO_NEWSLETTER off suppresses the notification', async () => {
  calls = [];
  const res = await onRequest(ctx(multipart(newsletter), { TO_NEWSLETTER: 'off' }));
  eq(res.status, 200, 'status');
  if (calls.some((c) => c.includes('sendMail'))) throw new Error('mail sent despite off');
});

await check('newsletter without D1 returns 503', async () => {
  const res = await onRequest({ request: multipart(newsletter), env, waitUntil: () => {} });
  eq(res.status, 503, 'status');
});

console.log('\n  Validation and abuse');
await check('missing last name on contact rejected', async () => {
  const res = await onRequest(ctx(multipart({ ...contactGeneral, 'Last Name': '' })));
  eq(res.status, 400, 'status');
});

await check('contact message is optional (page has no required attribute on it)', async () => {
  const res = await onRequest(ctx(multipart({ ...contactGeneral, Message: '' })));
  eq(res.status, 200, 'status');
});

await check('header injection in Reason rejected', async () => {
  const res = await onRequest(
    ctx(multipart({ ...contactGeneral, Reason: 'x\r\nBcc: evil@x.com' }))
  );
  eq(res.status, 400, 'status');
});

await check('honeypot silently accepts and sends nothing', async () => {
  calls = [];
  const res = await onRequest(ctx(multipart({ ...contactGeneral, website: 'http://spam.example' })));
  eq(res.status, 200, 'status');
  if (calls.some((c) => c.includes('sendMail'))) throw new Error('mail sent for bot');
});

await check('foreign origin blocked with 403', async () => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(contactGeneral)) fd.append(k, v);
  const bad = new Request('https://oryele.com/api/form', {
    method: 'POST',
    headers: { Origin: 'https://evil.example' },
    body: fd,
  });
  const res = await onRequest(ctx(bad));
  eq(res.status, 403, 'status');
});

await check('GET returns 405', async () => {
  const res = await onRequest({ request: new Request('https://oryele.com/api/form'), env, waitUntil: () => {} });
  eq(res.status, 405, 'status');
});

console.log('\n  Plumbing');
await check('replyTo is the submitter with their full name', async () => {
  await onRequest(ctx(multipart(contactGeneral)));
  eq(lastMessage.replyTo[0].emailAddress.address, 'jane@acme.com', 'replyTo address');
  eq(lastMessage.replyTo[0].emailAddress.name, 'Jane Doe', 'replyTo name');
});

await check('D1 backup records the form type and display name', async () => {
  submissions = [];
  await onRequest(ctx(multipart(contactGeneral)));
  eq(submissions.length, 1, 'rows');
  eq(submissions[0][0], 'contact', 'form_type column');
  eq(submissions[0][1], 'Jane Doe', 'name column');
});

await check('graph failure returns 502 with a safe message', async () => {
  graphStatus = 500;
  const res = await onRequest(ctx(multipart(contactGeneral)));
  const out = await res.json();
  graphStatus = 202;
  eq(res.status, 502, 'status');
  if (!out.error.includes('info@oryele.com')) throw new Error('no fallback address');
});

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
