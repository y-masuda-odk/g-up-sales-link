// Manual smoke test against a fresh local Wrangler/D1 instance.
// Requires BASE_URL and BOOTSTRAP_TOKEN in the environment.
import assert from 'node:assert/strict';

const origin = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
if (!bootstrapToken) throw new Error('BOOTSTRAP_TOKEN is required');
const nonce = Date.now();

async function get(cookie = '', query = '') {
  const response = await fetch(`${origin}/api/app${query}`, {
    headers: { cookie },
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}
async function post(action, values = {}, cookie = '', expected = 200) {
  const response = await fetch(`${origin}/api/app`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify({ action, ...values }),
  });
  const body = await response.json();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(body)}`);
  return {
    body,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie,
  };
}

assert.equal((await get()).setupRequired, true);
const admin = (
  await post('bootstrap', {
    bootstrapToken,
    email: `admin-${nonce}@example.test`,
    name: '管理者',
    password: 'TestPassword123456',
  })
).cookie;
await post('createCompany', { name: '会社A' }, admin);
await post('createCompany', { name: '会社B' }, admin);
let state = await get(admin);
await post(
  'createTeam',
  {
    companyId: state.companies.find((company) => company.name === '会社A').id,
    name: '部隊A',
  },
  admin,
);
await post(
  'createTeam',
  {
    companyId: state.companies.find((company) => company.name === '会社B').id,
    name: '部隊B',
  },
  admin,
);
state = await get(admin);
const aTeam = state.teams.find((team) => team.name === '部隊A').id;
const bTeam = state.teams.find((team) => team.name === '部隊B').id;
async function invite(teamId, email) {
  const issued = await post(
    'createInvite',
    { teamId, email, role: 'member' },
    admin,
  );
  const token = new URL(issued.body.inviteUrl).searchParams.get('invite');
  return (
    await post('acceptInvite', {
      token,
      name: email,
      password: 'TestPassword123456',
    })
  ).cookie;
}
const a = await invite(aTeam, `a-${nonce}@example.test`);
const b = await invite(bTeam, `b-${nonce}@example.test`);
const productId = (await post('saveProduct', { name: '共有商材' }, b)).body.id;
const caseId = (
  await post(
    'saveCase',
    {
      accountKind: 'university',
      accountName: 'A大学',
      department: 'IR室',
      issueSummary: '機密の課題',
      status: '',
      nextAction: '',
      isDraft: false,
      listVisible: true,
      showDepartment: false,
      showIssue: false,
      selectedProducts: [{ productId, stage: 'mentioned' }],
    },
    a,
  )
).body.id;
state = await get(b);
assert.equal(state.cases.length, 1);
assert.equal(state.cases[0].department, null);
assert.equal(state.cases[0].issueSummary, null);
assert.equal((await get(b, '?q=%E6%A9%9F%E5%AF%86')).cases.length, 0);
await post(
  'saveCase',
  {
    id: caseId,
    accountKind: 'university',
    accountName: 'A大学',
    department: 'IR室',
    issueSummary: '機密の課題',
    status: '',
    nextAction: '',
    isDraft: false,
    listVisible: false,
    showDepartment: false,
    showIssue: false,
    selectedProducts: [{ productId, stage: 'mentioned' }],
  },
  a,
);
assert.equal((await get(b)).cases.length, 0);
await post(
  'saveCase',
  {
    id: caseId,
    accountKind: 'university',
    accountName: '改ざん',
    isDraft: false,
    listVisible: true,
    showDepartment: true,
    showIssue: true,
    selectedProducts: [],
  },
  b,
  403,
);
const consultationId = (
  await post(
    'sendConsultation',
    {
      caseId,
      teamIds: [bTeam],
      includeAccount: true,
      includeDepartment: false,
      includeIssue: true,
      includeProducts: true,
      note: 'ご相談です。',
    },
    a,
  )
).body.id;
assert.equal((await get(b)).received[0].issueSummary, '機密の課題');
assert.equal((await get(b)).received[0].department, null);
await post('setHandled', { id: consultationId, handled: true }, b);
assert.equal(Object.hasOwn((await get(a)).sent[0], 'handled'), false);
await post('withdrawConsultation', { id: consultationId }, a);
assert.equal((await get(b)).received.length, 0);
assert.ok((await get(a)).sent[0].withdrawnAt);
await post(
  'sendConsultation',
  {
    caseId,
    teamIds: [bTeam],
    includeAccount: true,
    includeDepartment: false,
    includeIssue: true,
    includeProducts: false,
    note: '再送',
  },
  a,
);
assert.equal((await get(b)).received.length, 1);
await post(
  'setShare',
  { fromTeamId: aTeam, toTeamId: bTeam, enabled: false },
  admin,
);
assert.equal((await get(b)).received.length, 0);
await post(
  'sendConsultation',
  {
    caseId,
    teamIds: [bTeam],
    includeAccount: true,
    includeDepartment: false,
    includeIssue: true,
    includeProducts: false,
    note: '',
  },
  a,
  403,
);
assert.equal((await get()).user, null);
console.log('local e2e passed');
