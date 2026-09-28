import {
  database,
  hashPassword,
  randomToken,
  tokenHash,
  verifyPassword,
  validBootstrapToken,
  type AppUser,
} from './auth';
import {
  canEditProduct,
  canManageShare,
  canViewCase,
  matchesVisibleSearch,
  visibleCaseFields,
} from './policy';

type Payload = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const STATUS = new Set([
  'A 受注済',
  'B ほぼ確定・契約待ち',
  'C 商談中',
  'D アポ済み・見積提出前',
  'E アポ取り中',
  'F 失注',
]);

const LEGACY_STATUS: Record<string, string> = {
  受注: 'A 受注済',
  契約調整: 'B ほぼ確定・契約待ち',
  提案中: 'C 商談中',
  提案準備: 'D アポ済み・見積提出前',
  課題把握: 'E アポ取り中',
  初回接点: 'E アポ取り中',
  失注: 'F 失注',
};

function normalizedStatus(value: string | null): string | null {
  return value ? (LEGACY_STATUS[value] ?? value) : null;
}

function string(
  value: unknown,
  label: string,
  max = 4000,
  required = false,
): string {
  if (value == null) value = '';
  if (typeof value !== 'string')
    throw new ApiError(`${label}を確認してください。`);
  const result = value.trim();
  if (required && !result) throw new ApiError(`${label}を入力してください。`);
  if (result.length > max)
    throw new ApiError(`${label}は${max}文字以内で入力してください。`);
  return result;
}

function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new ApiError('パスワードは12～128文字で入力してください。');
  return value;
}

function email(value: unknown): string {
  const address = string(value, 'メールアドレス', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    throw new ApiError('メールアドレスを確認してください。');
  return address;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new ApiError(`${label}を確認してください。`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new ApiError(`${label}を0以上の整数で入力してください。`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean')
    throw new ApiError(`${label}を確認してください。`);
  return value;
}

function requireTeam(user: AppUser): number {
  if (!user.teamId)
    throw new ApiError('部隊に所属する利用者のみ操作できます。', 403);
  return user.teamId;
}

async function audit(
  userId: number | null,
  kind: string,
  targetType: string,
  targetId: number | null,
): Promise<void> {
  await database()
    .prepare(
      'INSERT INTO audit_events (actor_id, kind, target_type, target_id) VALUES (?, ?, ?, ?)',
    )
    .bind(userId, kind, targetType, targetId)
    .run();
}

export async function setupRequired(): Promise<boolean> {
  const row = await database()
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  return !row?.count;
}

export async function bootstrap(body: Payload): Promise<{ userId: number }> {
  if (!(await setupRequired()))
    throw new ApiError('初期設定は完了しています。', 403);
  if (
    !(await validBootstrapToken(
      string(body.bootstrapToken, '初期設定トークン', 200, true),
    ))
  )
    throw new ApiError('初期設定トークンが正しくありません。', 403);
  const emailAddress = email(body.email);
  const name = string(body.name, '名前', 100, true);
  const rawPassword = password(body.password);
  const result = await database()
    .prepare(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(emailAddress, name, await hashPassword(rawPassword), 'global_admin')
    .first<{ id: number }>();
  if (!result) throw new Error('初期管理者の作成に失敗しました。');
  await audit(result.id, 'bootstrap', 'user', result.id);
  return { userId: result.id };
}

export async function login(body: Payload): Promise<{ userId: number }> {
  const emailAddress = email(body.email);
  const rawPassword = password(body.password);
  const user = await database()
    .prepare(
      'SELECT id, password_hash AS passwordHash, disabled, failed_logins AS failedLogins, locked_until AS lockedUntil FROM users WHERE email = ? LIMIT 1',
    )
    .bind(emailAddress)
    .first<{
      id: number;
      passwordHash: string;
      disabled: number;
      failedLogins: number;
      lockedUntil: string | null;
    }>();
  if (
    !user ||
    user.disabled ||
    (user.lockedUntil && user.lockedUntil > new Date().toISOString())
  )
    throw new ApiError(
      'メールアドレスまたはパスワードが正しくありません。',
      401,
    );
  if (!(await verifyPassword(rawPassword, user.passwordHash))) {
    const failures = user.failedLogins + 1;
    const lock =
      failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await database()
      .prepare(
        'UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?',
      )
      .bind(lock ? 0 : failures, lock, user.id)
      .run();
    throw new ApiError(
      'メールアドレスまたはパスワードが正しくありません。',
      401,
    );
  }
  await database()
    .prepare(
      'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?',
    )
    .bind(user.id)
    .run();
  return { userId: user.id };
}

export async function acceptInvite(body: Payload): Promise<{ userId: number }> {
  const token = string(body.token, '招待リンク', 200, true);
  const invite = await database()
    .prepare(
      'SELECT id, email, role, team_id AS teamId, used_at AS usedAt, expires_at AS expiresAt FROM invitations WHERE token_hash = ? LIMIT 1',
    )
    .bind(await tokenHash(token))
    .first<{
      id: number;
      email: string;
      role: string;
      teamId: number | null;
      usedAt: string | null;
      expiresAt: string;
    }>();
  if (!invite || invite.usedAt || invite.expiresAt <= new Date().toISOString())
    throw new ApiError('招待リンクが無効か期限切れです。');
  const name = string(body.name, '名前', 100, true);
  const rawPassword = password(body.password);
  const existing = await database()
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(invite.email)
    .first();
  if (existing) throw new ApiError('このメールアドレスは登録済みです。');
  const result = await database()
    .prepare(
      'INSERT INTO users (email, name, password_hash, role, team_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(
      invite.email,
      name,
      await hashPassword(rawPassword),
      invite.role,
      invite.teamId,
    )
    .first<{ id: number }>();
  if (!result) throw new Error('利用者の作成に失敗しました。');
  await database()
    .prepare('UPDATE invitations SET used_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), invite.id)
    .run();
  await audit(result.id, 'invite_accepted', 'user', result.id);
  return { userId: result.id };
}

type CaseDbRow = {
  id: number;
  creatorId: number;
  teamId: number;
  accountKind: string;
  accountName: string;
  department: string | null;
  issueSummary: string | null;
  status: string | null;
  amount: number;
  revenuePeriod: string;
  nextAction: string | null;
  isDraft: number;
  listVisible: number;
  showDepartment: number;
  showIssue: number;
  ownerName: string;
  ownerEmail: string;
  teamName: string;
  createdAt: string;
  updatedAt: string;
};

export async function loadApp(user: AppUser, query = ''): Promise<Payload> {
  const db = database();
  const [
    companyResult,
    teamResult,
    productResult,
    caseResult,
    linkResult,
    shareResult,
    accountResult,
    targetResult,
  ] = await Promise.all([
    db
      .prepare('SELECT id, name FROM companies ORDER BY name')
      .all<{ id: number; name: string }>(),
    db
      .prepare(
        'SELECT t.id, t.name, t.company_id AS companyId, c.name AS companyName FROM teams t JOIN companies c ON c.id = t.company_id ORDER BY c.name, t.name',
      )
      .all<{
        id: number;
        name: string;
        companyId: number;
        companyName: string;
      }>(),
    db
      .prepare(
        'SELECT p.id, p.team_id AS teamId, p.name, p.description, p.target_customer AS targetCustomer, p.outcome, p.contact, t.name AS teamName FROM catalog_products p JOIN teams t ON t.id = p.team_id ORDER BY p.updated_at DESC',
      )
      .all(),
    db
      .prepare(
        'SELECT c.id, c.creator_id AS creatorId, c.team_id AS teamId, c.account_kind AS accountKind, c.account_name AS accountName, c.department, c.issue_summary AS issueSummary, c.status, c.amount, c.revenue_period AS revenuePeriod, c.next_action AS nextAction, c.is_draft AS isDraft, c.list_visible AS listVisible, c.show_department AS showDepartment, c.show_issue AS showIssue, c.created_at AS createdAt, c.updated_at AS updatedAt, u.name AS ownerName, u.email AS ownerEmail, t.name AS teamName FROM sales_cases c JOIN users u ON u.id = c.creator_id JOIN teams t ON t.id = c.team_id ORDER BY c.updated_at DESC',
      )
      .all<CaseDbRow>(),
    db
      .prepare(
        'SELECT cp.case_id AS caseId, cp.product_id AS productId, cp.stage, p.name FROM case_products cp JOIN catalog_products p ON p.id = cp.product_id',
      )
      .all<{
        caseId: number;
        productId: number;
        stage: string;
        name: string;
      }>(),
    db
      .prepare(
        'SELECT from_team_id AS fromTeamId, to_team_id AS toTeamId, enabled FROM team_shares',
      )
      .all<{ fromTeamId: number; toTeamId: number; enabled: number }>(),
    db
      .prepare(
        "SELECT a.id, a.team_id AS teamId, a.creator_id AS creatorId, a.kind, a.name, a.priority, a.scale, a.updated_at AS updatedAt, t.name AS teamName, (SELECT c.status FROM sales_cases c WHERE c.team_id = a.team_id AND c.account_name = a.name COLLATE NOCASE AND c.is_draft = 0 ORDER BY c.updated_at DESC LIMIT 1) AS status, (SELECT COUNT(*) FROM sales_cases c WHERE c.team_id = a.team_id AND c.account_name = a.name COLLATE NOCASE AND c.is_draft = 0) AS caseCount FROM sales_accounts a JOIN teams t ON t.id = a.team_id ORDER BY CASE a.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.updated_at DESC",
      )
      .all<{
        id: number;
        teamId: number;
        creatorId: number;
        kind: string;
        name: string;
        priority: string;
        scale: string;
        updatedAt: string;
        teamName: string;
        status: string | null;
        caseCount: number;
      }>(),
    db
      .prepare(
        'SELECT team_id AS teamId, period, revenue_target AS revenueTarget, case_target AS caseTarget FROM sales_targets',
      )
      .all<{
        teamId: number;
        period: string;
        revenueTarget: number;
        caseTarget: number;
      }>(),
  ]);
  const disabled = new Set(
    (shareResult.results ?? [])
      .filter((item) => !item.enabled)
      .map((item) => `${item.fromTeamId}:${item.toTeamId}`),
  );
  const links = linkResult.results ?? [];
  const cases = (caseResult.results ?? []).flatMap((row) => {
    const allowed = !disabled.has(`${row.teamId}:${user.teamId}`);
    if (!canViewCase(user, row, allowed)) return [];
    const fields = visibleCaseFields(user, row);
    const selectedProducts = links
      .filter((link) => link.caseId === row.id)
      .map((link) => ({
        productId: link.productId,
        name: link.name,
        stage: link.stage,
      }));
    const projected = {
      ...fields,
      status: normalizedStatus(fields.status),
      isDraft: !!row.isDraft,
      listVisible: !!row.listVisible,
      showDepartment: !!row.showDepartment,
      showIssue: !!row.showIssue,
      selectedProducts,
    };
    if (
      !matchesVisibleSearch(
        {
          accountName: projected.accountName,
          department: projected.department,
          issueSummary: projected.issueSummary,
          teamName: row.teamName,
          productNames: selectedProducts.map((product) => product.name),
        },
        query,
      )
    )
      return [];
    return [projected];
  });

  const sent = await db
    .prepare(
      'SELECT c.id, c.case_id AS caseId, c.account_name AS accountName, c.department, c.issue_summary AS issueSummary, c.product_summary AS productSummary, c.note, c.withdrawn_at AS withdrawnAt, c.created_at AS createdAt, GROUP_CONCAT(t.name, ", ") AS recipientNames FROM consultations c JOIN consultation_recipients r ON r.consultation_id = c.id JOIN teams t ON t.id = r.team_id WHERE c.sender_id = ? GROUP BY c.id ORDER BY c.created_at DESC',
    )
    .bind(user.id)
    .all();
  const received = user.teamId
    ? await db
        .prepare(
          'SELECT c.id, c.account_name AS accountName, c.department, c.issue_summary AS issueSummary, c.product_summary AS productSummary, c.note, c.created_at AS createdAt, r.handled, u.name AS senderName, u.email AS senderEmail FROM consultation_recipients r JOIN consultations c ON c.id = r.consultation_id JOIN sales_cases sc ON sc.id = c.case_id LEFT JOIN team_shares ts ON ts.from_team_id = sc.team_id AND ts.to_team_id = r.team_id JOIN users u ON u.id = c.sender_id WHERE r.team_id = ? AND c.withdrawn_at IS NULL AND COALESCE(ts.enabled, 1) = 1 ORDER BY c.created_at DESC',
        )
        .bind(user.teamId)
        .all()
    : { results: [] };

  let members: unknown[] = [];
  if (user.role === 'global_admin') {
    members =
      (
        await db
          .prepare(
            'SELECT id, email, name, role, team_id AS teamId, disabled FROM users ORDER BY created_at DESC',
          )
          .all()
      ).results ?? [];
  } else if (user.role === 'team_admin') {
    members =
      (
        await db
          .prepare(
            'SELECT id, email, name, role, team_id AS teamId, disabled FROM users WHERE team_id = ? ORDER BY created_at DESC',
          )
          .bind(user.teamId)
          .all()
      ).results ?? [];
  }

  const accountRows = (accountResult.results ?? [])
    .filter(
      (item) => user.role === 'global_admin' || item.teamId === user.teamId,
    )
    .map((item) => ({ ...item, status: normalizedStatus(item.status) }));
  const dashboardCases = (caseResult.results ?? [])
    .filter(
      (item) =>
        !item.isDraft &&
        (user.role === 'global_admin' || item.teamId === user.teamId),
    )
    .map((item) => ({
      id: item.id,
      accountName: item.accountName,
      issueSummary: item.issueSummary,
      status: normalizedStatus(item.status),
      amount: item.amount,
      revenuePeriod: item.revenuePeriod,
      teamId: item.teamId,
      teamName: item.teamName,
      ownerName: item.ownerName,
    }));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    },
    companies: companyResult.results ?? [],
    teams: teamResult.results ?? [],
    products: productResult.results ?? [],
    cases,
    salesAccounts: accountRows,
    dashboardCases,
    salesTargets: (targetResult.results ?? []).filter(
      (item) => user.role === 'global_admin' || item.teamId === user.teamId,
    ),
    sent: sent.results ?? [],
    received: received.results ?? [],
    members,
    shares:
      user.role === 'global_admin'
        ? (shareResult.results ?? [])
        : user.role === 'team_admin'
          ? (shareResult.results ?? []).filter(
              (item) => item.fromTeamId === user.teamId,
            )
          : [],
  };
}

async function saveCase(user: AppUser, body: Payload): Promise<{ id: number }> {
  const teamId = requireTeam(user);
  const id = body.id == null ? null : integer(body.id, '案件ID');
  if (id) {
    const existing = await database()
      .prepare('SELECT creator_id AS creatorId FROM sales_cases WHERE id = ?')
      .bind(id)
      .first<{ creatorId: number }>();
    if (!existing) throw new ApiError('案件が見つかりません。', 404);
    if (existing.creatorId !== user.id)
      throw new ApiError('この案件は編集できません。', 403);
  }
  const accountName = string(body.accountName, '営業先名', 200, true);
  const accountKind =
    body.accountKind === 'university'
      ? 'university'
      : body.accountKind === 'company'
        ? 'company'
        : null;
  if (!accountKind) throw new ApiError('営業先の種類を選んでください。');
  const department = string(body.department, '部署名', 200);
  const issueSummary = string(body.issueSummary, '課題概要', 4000);
  const status = string(body.status, '営業ステータス', 40);
  if (status && !STATUS.has(status))
    throw new ApiError('営業ステータスを確認してください。');
  const nextAction = string(body.nextAction, '次のアクション', 500);
  const amount = nonNegativeInteger(body.amount, '売上金額');
  const revenuePeriod =
    body.revenuePeriod === 'current'
      ? 'current'
      : body.revenuePeriod === 'next'
        ? 'next'
        : null;
  if (!revenuePeriod) throw new ApiError('売上時期を選んでください。');
  const isDraft = boolean(body.isDraft, '下書き設定');
  const listVisible = boolean(body.listVisible, '一覧公開設定');
  const showDepartment = boolean(body.showDepartment, '部署名の公開設定');
  const showIssue = boolean(body.showIssue, '課題概要の公開設定');
  if (
    !Array.isArray(body.selectedProducts) ||
    body.selectedProducts.length > 100
  )
    throw new ApiError('商材の選択を確認してください。');
  const selected = body.selectedProducts.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new ApiError('商材の選択を確認してください。');
    const productId = integer((entry as Payload).productId, '商材ID');
    const stage = (entry as Payload).stage;
    if (stage !== 'mentioned' && stage !== 'proposed')
      throw new ApiError('商材の進捗を選んでください。');
    return { productId, stage };
  });
  if (new Set(selected.map((item) => item.productId)).size !== selected.length)
    throw new ApiError('同じ商材が重複しています。');
  const productRows =
    (
      await database()
        .prepare('SELECT id FROM catalog_products')
        .all<{ id: number }>()
    ).results ?? [];
  const validProducts = new Set(productRows.map((item) => item.id));
  if (selected.some((item) => !validProducts.has(item.productId)))
    throw new ApiError('商材が見つかりません。');
  const values = [
    accountKind,
    accountName,
    department || null,
    issueSummary || null,
    status || null,
    amount,
    revenuePeriod,
    nextAction || null,
    Number(isDraft),
    Number(listVisible),
    Number(showDepartment),
    Number(showIssue),
    new Date().toISOString(),
  ];
  let caseId = id;
  if (id) {
    await database()
      .prepare(
        'UPDATE sales_cases SET account_kind = ?, account_name = ?, department = ?, issue_summary = ?, status = ?, amount = ?, revenue_period = ?, next_action = ?, is_draft = ?, list_visible = ?, show_department = ?, show_issue = ?, updated_at = ? WHERE id = ? AND creator_id = ?',
      )
      .bind(...values, id, user.id)
      .run();
  } else {
    const inserted = await database()
      .prepare(
        'INSERT INTO sales_cases (creator_id, team_id, account_kind, account_name, department, issue_summary, status, amount, revenue_period, next_action, is_draft, list_visible, show_department, show_issue, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(user.id, teamId, ...values)
      .first<{ id: number }>();
    if (!inserted) throw new Error('案件を保存できませんでした。');
    caseId = inserted.id;
  }
  const statements = [
    database()
      .prepare('DELETE FROM case_products WHERE case_id = ?')
      .bind(caseId),
  ];
  for (const item of selected)
    statements.push(
      database()
        .prepare(
          'INSERT INTO case_products (case_id, product_id, stage) VALUES (?, ?, ?)',
        )
        .bind(caseId, item.productId, item.stage),
    );
  await database().batch(statements);
  await audit(user.id, id ? 'case_updated' : 'case_created', 'case', caseId);
  return { id: caseId! };
}

async function saveSalesAccount(
  user: AppUser,
  body: Payload,
): Promise<{ id: number }> {
  const teamId = requireTeam(user);
  const id = body.id == null ? null : integer(body.id, '営業先ID');
  const name = string(body.name, '営業先名', 200, true);
  const kind =
    body.kind === 'university'
      ? 'university'
      : body.kind === 'company'
        ? 'company'
        : null;
  if (!kind) throw new ApiError('営業先の種類を選んでください。');
  const priority = body.priority;
  if (priority !== 'high' && priority !== 'medium' && priority !== 'low')
    throw new ApiError('優先度を選んでください。');
  const scale = body.scale;
  if (scale !== 'large' && scale !== 'medium' && scale !== 'small')
    throw new ApiError('規模感を選んでください。');

  if (id) {
    const existing = await database()
      .prepare('SELECT team_id AS teamId FROM sales_accounts WHERE id = ?')
      .bind(id)
      .first<{ teamId: number }>();
    if (!existing || existing.teamId !== teamId)
      throw new ApiError('営業先を編集できません。', 403);
  }
  const duplicate = await database()
    .prepare(
      'SELECT id FROM sales_accounts WHERE team_id = ? AND name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)',
    )
    .bind(teamId, name, id, id)
    .first();
  if (duplicate) throw new ApiError('同じ営業先がすでに登録されています。');

  const now = new Date().toISOString();
  if (id) {
    await database()
      .prepare(
        'UPDATE sales_accounts SET kind = ?, name = ?, priority = ?, scale = ?, updated_at = ? WHERE id = ? AND team_id = ?',
      )
      .bind(kind, name, priority, scale, now, id, teamId)
      .run();
    await audit(user.id, 'sales_account_updated', 'sales_account', id);
    return { id };
  }
  const inserted = await database()
    .prepare(
      'INSERT INTO sales_accounts (team_id, creator_id, kind, name, priority, scale, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(teamId, user.id, kind, name, priority, scale, now)
    .first<{ id: number }>();
  if (!inserted) throw new Error('営業先を保存できませんでした。');
  await audit(user.id, 'sales_account_created', 'sales_account', inserted.id);
  return { id: inserted.id };
}

async function saveSalesTarget(user: AppUser, body: Payload): Promise<void> {
  const teamId = requireTeam(user);
  const period =
    body.period === 'current'
      ? 'current'
      : body.period === 'next'
        ? 'next'
        : null;
  if (!period) throw new ApiError('対象期間を選んでください。');
  const revenueTarget = nonNegativeInteger(body.revenueTarget, '目標売上');
  const caseTarget = nonNegativeInteger(body.caseTarget, '目標案件数');
  await database()
    .prepare(
      'INSERT INTO sales_targets (team_id, period, revenue_target, case_target, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (team_id, period) DO UPDATE SET revenue_target = excluded.revenue_target, case_target = excluded.case_target, updated_at = excluded.updated_at',
    )
    .bind(teamId, period, revenueTarget, caseTarget, new Date().toISOString())
    .run();
  await audit(user.id, 'sales_target_updated', 'sales_target', teamId);
}

async function saveProduct(
  user: AppUser,
  body: Payload,
): Promise<{ id: number }> {
  const teamId = requireTeam(user);
  const id = body.id == null ? null : integer(body.id, '商材ID');
  if (id) {
    const row = await database()
      .prepare('SELECT team_id AS teamId FROM catalog_products WHERE id = ?')
      .bind(id)
      .first<{ teamId: number }>();
    if (!row) throw new ApiError('商材が見つかりません。', 404);
    if (!canEditProduct(user, row.teamId))
      throw new ApiError('他部隊の商材は編集できません。', 403);
  }
  const name = string(body.name, '商材名', 200, true);
  const description = string(body.description, '説明', 4000);
  const targetCustomer = string(body.targetCustomer, '対象顧客', 1000);
  const outcome = string(body.outcome, '効果', 1000);
  const contact = string(body.contact, '連絡先', 300);
  let productId = id;
  if (id) {
    await database()
      .prepare(
        'UPDATE catalog_products SET name = ?, description = ?, target_customer = ?, outcome = ?, contact = ?, updated_at = ? WHERE id = ? AND team_id = ?',
      )
      .bind(
        name,
        description || null,
        targetCustomer || null,
        outcome || null,
        contact || null,
        new Date().toISOString(),
        id,
        teamId,
      )
      .run();
  } else {
    const result = await database()
      .prepare(
        'INSERT INTO catalog_products (team_id, creator_id, name, description, target_customer, outcome, contact) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(
        teamId,
        user.id,
        name,
        description || null,
        targetCustomer || null,
        outcome || null,
        contact || null,
      )
      .first<{ id: number }>();
    if (!result) throw new Error('商材を保存できませんでした。');
    productId = result.id;
  }
  await audit(
    user.id,
    id ? 'product_updated' : 'product_created',
    'product',
    productId,
  );
  return { id: productId! };
}

async function sendConsultation(
  user: AppUser,
  body: Payload,
): Promise<{ id: number }> {
  const ownTeamId = requireTeam(user);
  const caseId = integer(body.caseId, '案件ID');
  const salesCase = await database()
    .prepare(
      'SELECT creator_id AS creatorId, team_id AS teamId, account_name AS accountName, department, issue_summary AS issueSummary FROM sales_cases WHERE id = ?',
    )
    .bind(caseId)
    .first<{
      creatorId: number;
      teamId: number;
      accountName: string;
      department: string | null;
      issueSummary: string | null;
    }>();
  if (
    !salesCase ||
    salesCase.creatorId !== user.id ||
    salesCase.teamId !== ownTeamId
  )
    throw new ApiError('この案件は相談できません。', 403);
  if (
    !Array.isArray(body.teamIds) ||
    body.teamIds.length < 1 ||
    body.teamIds.length > 20
  )
    throw new ApiError('送信先の部隊を選んでください。');
  const teamIds = body.teamIds.map((value) => integer(value, '送信先'));
  if (new Set(teamIds).size !== teamIds.length || teamIds.includes(ownTeamId))
    throw new ApiError('送信先の部隊を確認してください。');
  const existingTeams = new Set(
    (
      (await database().prepare('SELECT id FROM teams').all<{ id: number }>())
        .results ?? []
    ).map((item) => item.id),
  );
  const blockedTeams = new Set(
    (
      (
        await database()
          .prepare(
            'SELECT to_team_id AS toTeamId FROM team_shares WHERE from_team_id = ? AND enabled = 0',
          )
          .bind(ownTeamId)
          .all<{ toTeamId: number }>()
      ).results ?? []
    ).map((item) => item.toTeamId),
  );
  if (teamIds.some((id) => !existingTeams.has(id) || blockedTeams.has(id)))
    throw new ApiError('許可されていない送信先が含まれています。', 403);
  const includeAccount = boolean(body.includeAccount, '営業先名の送信設定');
  const includeDepartment = boolean(body.includeDepartment, '部署名の送信設定');
  const includeIssue = boolean(body.includeIssue, '課題概要の送信設定');
  const includeProducts = boolean(body.includeProducts, '商材の送信設定');
  const note = string(body.note, '補足メモ', 4000);
  if (
    !includeAccount &&
    !includeDepartment &&
    !includeIssue &&
    !includeProducts &&
    !note
  )
    throw new ApiError('送信する項目か補足メモを指定してください。');
  const productRows = includeProducts
    ? ((
        await database()
          .prepare(
            'SELECT p.name, cp.stage FROM case_products cp JOIN catalog_products p ON p.id = cp.product_id WHERE cp.case_id = ?',
          )
          .bind(caseId)
          .all<{ name: string; stage: string }>()
      ).results ?? [])
    : [];
  const productSummary = productRows
    .map(
      (row) =>
        `${row.name}（${row.stage === 'proposed' ? '提案済み' : '頭出し'}）`,
    )
    .join('、');
  const result = await database()
    .prepare(
      'INSERT INTO consultations (case_id, sender_id, account_name, department, issue_summary, product_summary, note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(
      caseId,
      user.id,
      includeAccount ? salesCase.accountName : null,
      includeDepartment ? salesCase.department : null,
      includeIssue ? salesCase.issueSummary : null,
      includeProducts ? productSummary : null,
      note || null,
    )
    .first<{ id: number }>();
  if (!result) throw new Error('相談を送信できませんでした。');
  await database().batch(
    teamIds.map((teamId) =>
      database()
        .prepare(
          'INSERT INTO consultation_recipients (consultation_id, team_id) VALUES (?, ?)',
        )
        .bind(result.id, teamId),
    ),
  );
  await audit(user.id, 'consultation_sent', 'consultation', result.id);
  return { id: result.id };
}

async function withdrawConsultation(
  user: AppUser,
  body: Payload,
): Promise<void> {
  const id = integer(body.id, '相談ID');
  const row = await database()
    .prepare(
      'SELECT sender_id AS senderId, withdrawn_at AS withdrawnAt FROM consultations WHERE id = ?',
    )
    .bind(id)
    .first<{ senderId: number; withdrawnAt: string | null }>();
  if (!row || row.senderId !== user.id)
    throw new ApiError('相談を撤回できません。', 403);
  if (!row.withdrawnAt) {
    await database()
      .prepare(
        'UPDATE consultations SET withdrawn_at = ? WHERE id = ? AND sender_id = ?',
      )
      .bind(new Date().toISOString(), id, user.id)
      .run();
    await audit(user.id, 'consultation_withdrawn', 'consultation', id);
  }
}

async function setHandled(user: AppUser, body: Payload): Promise<void> {
  const teamId = requireTeam(user);
  const id = integer(body.id, '相談ID');
  const handled = boolean(body.handled, '対応済み設定');
  const row = await database()
    .prepare(
      'SELECT c.withdrawn_at AS withdrawnAt, ts.enabled AS shareEnabled FROM consultation_recipients r JOIN consultations c ON c.id = r.consultation_id JOIN sales_cases sc ON sc.id = c.case_id LEFT JOIN team_shares ts ON ts.from_team_id = sc.team_id AND ts.to_team_id = r.team_id WHERE r.consultation_id = ? AND r.team_id = ?',
    )
    .bind(id, teamId)
    .first<{ withdrawnAt: string | null; shareEnabled: number | null }>();
  if (!row || row.withdrawnAt || row.shareEnabled === 0)
    throw new ApiError('相談が見つかりません。', 404);
  await database()
    .prepare(
      'UPDATE consultation_recipients SET handled = ? WHERE consultation_id = ? AND team_id = ?',
    )
    .bind(Number(handled), id, teamId)
    .run();
}

async function setShare(user: AppUser, body: Payload): Promise<void> {
  const fromTeamId = integer(body.fromTeamId, '公開元の部隊');
  const toTeamId = integer(body.toTeamId, '共有先の部隊');
  const enabled = boolean(body.enabled, '共有設定');
  if (fromTeamId === toTeamId || !canManageShare(user, fromTeamId))
    throw new ApiError('共有設定を変更できません。', 403);
  const rows =
    (
      await database()
        .prepare('SELECT id FROM teams WHERE id IN (?, ?)')
        .bind(fromTeamId, toTeamId)
        .all()
    ).results ?? [];
  if (rows.length !== 2) throw new ApiError('部隊が見つかりません。');
  await database()
    .prepare(
      'INSERT INTO team_shares (from_team_id, to_team_id, enabled) VALUES (?, ?, ?) ON CONFLICT (from_team_id, to_team_id) DO UPDATE SET enabled = excluded.enabled',
    )
    .bind(fromTeamId, toTeamId, Number(enabled))
    .run();
  await audit(user.id, 'team_share_changed', 'team', fromTeamId);
}

async function createCompany(user: AppUser, body: Payload): Promise<void> {
  if (user.role !== 'global_admin')
    throw new ApiError('全体管理者のみ操作できます。', 403);
  const name = string(body.name, '会社名', 200, true);
  const result = await database()
    .prepare('INSERT INTO companies (name) VALUES (?) RETURNING id')
    .bind(name)
    .first<{ id: number }>();
  await audit(user.id, 'company_created', 'company', result?.id ?? null);
}

async function createTeam(user: AppUser, body: Payload): Promise<void> {
  if (user.role !== 'global_admin')
    throw new ApiError('全体管理者のみ操作できます。', 403);
  const companyId = integer(body.companyId, '会社');
  const company = await database()
    .prepare('SELECT id FROM companies WHERE id = ?')
    .bind(companyId)
    .first();
  if (!company) throw new ApiError('会社が見つかりません。');
  const name = string(body.name, '部隊名', 200, true);
  const result = await database()
    .prepare('INSERT INTO teams (company_id, name) VALUES (?, ?) RETURNING id')
    .bind(companyId, name)
    .first<{ id: number }>();
  await audit(user.id, 'team_created', 'team', result?.id ?? null);
}

async function createInvite(
  user: AppUser,
  body: Payload,
  origin: string,
): Promise<{ inviteUrl: string }> {
  const emailAddress = email(body.email);
  const role = body.role;
  const teamId = role === 'global_admin' ? null : integer(body.teamId, '部隊');
  if (role !== 'global_admin' && role !== 'team_admin' && role !== 'member')
    throw new ApiError('権限を確認してください。');
  if (
    user.role === 'team_admin' &&
    (role !== 'member' || teamId !== user.teamId)
  )
    throw new ApiError('自部隊のメンバーのみ招待できます。', 403);
  if (user.role === 'member')
    throw new ApiError('招待する権限がありません。', 403);
  if (teamId) {
    const team = await database()
      .prepare('SELECT id FROM teams WHERE id = ?')
      .bind(teamId)
      .first();
    if (!team) throw new ApiError('部隊が見つかりません。');
  }
  const existing = await database()
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(emailAddress)
    .first();
  if (existing) throw new ApiError('このメールアドレスは登録済みです。');
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const result = await database()
    .prepare(
      'INSERT INTO invitations (email, role, team_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(
      emailAddress,
      role,
      teamId,
      await tokenHash(token),
      expiresAt,
      user.id,
    )
    .first<{ id: number }>();
  await audit(user.id, 'user_invited', 'invitation', result?.id ?? null);
  return { inviteUrl: `${origin}/?invite=${encodeURIComponent(token)}` };
}

export async function performAction(
  user: AppUser,
  action: string,
  body: Payload,
  origin: string,
): Promise<Payload> {
  switch (action) {
    case 'saveCase':
      return saveCase(user, body);
    case 'saveSalesAccount':
      return saveSalesAccount(user, body);
    case 'saveSalesTarget':
      await saveSalesTarget(user, body);
      return {};
    case 'saveProduct':
      return saveProduct(user, body);
    case 'sendConsultation':
      return sendConsultation(user, body);
    case 'withdrawConsultation':
      await withdrawConsultation(user, body);
      return {};
    case 'setHandled':
      await setHandled(user, body);
      return {};
    case 'setShare':
      await setShare(user, body);
      return {};
    case 'createCompany':
      await createCompany(user, body);
      return {};
    case 'createTeam':
      await createTeam(user, body);
      return {};
    case 'createInvite':
      return createInvite(user, body, origin);
    default:
      throw new ApiError('操作が見つかりません。', 404);
  }
}
