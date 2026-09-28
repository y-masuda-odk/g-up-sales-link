'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  ContactRound,
  CircleDollarSign,
  GraduationCap,
  Handshake,
  LogOut,
  PackageOpen,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type User = {
  id: number;
  email: string;
  name: string;
  role: 'global_admin' | 'team_admin' | 'member';
  teamId: number | null;
};
type Team = {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
};
type Product = {
  id: number;
  teamId: number;
  teamName: string;
  name: string;
  description: string | null;
  targetCustomer: string | null;
  outcome: string | null;
  contact: string | null;
};
type SelectedProduct = {
  productId: number;
  name: string;
  stage: 'mentioned' | 'proposed';
};
type SalesCase = {
  id: number;
  creatorId: number;
  teamId: number;
  teamName: string;
  ownerName: string;
  ownerEmail: string;
  accountKind: 'university' | 'company';
  accountName: string;
  department: string | null;
  issueSummary: string | null;
  status: string | null;
  amount: number;
  revenuePeriod: 'current' | 'next';
  nextAction: string | null;
  isDraft: boolean;
  listVisible: boolean;
  showDepartment: boolean;
  showIssue: boolean;
  selectedProducts: SelectedProduct[];
  updatedAt: string;
};
type SalesAccount = {
  id: number;
  teamId: number;
  teamName: string;
  creatorId: number;
  kind: 'university' | 'company';
  name: string;
  priority: 'high' | 'medium' | 'low';
  scale: 'large' | 'medium' | 'small';
  status: string | null;
  caseCount: number;
  updatedAt: string;
};
type DashboardCase = {
  id: number;
  accountName: string;
  issueSummary: string | null;
  status: string | null;
  amount: number;
  revenuePeriod: 'current' | 'next';
  teamId: number;
  teamName: string;
  ownerName: string;
};
type SalesTarget = {
  teamId: number;
  period: 'current' | 'next';
  revenueTarget: number;
  caseTarget: number;
};
type Consultation = {
  id: number;
  accountName: string | null;
  department: string | null;
  issueSummary: string | null;
  productSummary: string | null;
  note: string | null;
  createdAt: string;
  withdrawnAt?: string | null;
  recipientNames?: string;
  senderName?: string;
  senderEmail?: string;
  handled?: number;
};
type AppData = {
  user: User;
  companies: { id: number; name: string }[];
  teams: Team[];
  products: Product[];
  cases: SalesCase[];
  salesAccounts: SalesAccount[];
  dashboardCases: DashboardCase[];
  salesTargets: SalesTarget[];
  sent: Consultation[];
  received: Consultation[];
  members: {
    id: number;
    name: string;
    email: string;
    role: string;
    teamId: number | null;
  }[];
  shares: { fromTeamId: number; toTeamId: number; enabled: number }[];
};
type CaseForm = {
  id?: number;
  accountKind: 'university' | 'company';
  accountName: string;
  department: string;
  issueSummary: string;
  status: string;
  amount: number;
  revenuePeriod: 'current' | 'next';
  nextAction: string;
  isDraft: boolean;
  listVisible: boolean;
  showDepartment: boolean;
  showIssue: boolean;
  selectedProducts: { productId: number; stage: 'mentioned' | 'proposed' }[];
};
type SalesAccountForm = {
  id?: number;
  kind: 'university' | 'company';
  name: string;
  priority: 'high' | 'medium' | 'low';
  scale: 'large' | 'medium' | 'small';
};
type ProductForm = {
  id?: number;
  name: string;
  description: string;
  targetCustomer: string;
  outcome: string;
  contact: string;
};
type ConsultForm = {
  caseId: number;
  teamIds: number[];
  includeAccount: boolean;
  includeDepartment: boolean;
  includeIssue: boolean;
  includeProducts: boolean;
  note: string;
};

const statuses = [
  'A 受注済',
  'B ほぼ確定・契約待ち',
  'C 商談中',
  'D アポ済み・見積提出前',
  'E アポ取り中',
  'F 失注',
];
const statusProbability: Record<string, number> = {
  'A 受注済': 100,
  'B ほぼ確定・契約待ち': 90,
  'C 商談中': 50,
  'D アポ済み・見積提出前': 20,
  'E アポ取り中': 10,
  'F 失注': 0,
};
const statusColor: Record<string, string> = {
  'A 受注済': '#15803d',
  'B ほぼ確定・契約待ち': '#0f766e',
  'C 商談中': '#2563eb',
  'D アポ済み・見積提出前': '#d97706',
  'E アポ取り中': '#7c3aed',
  'F 失注': '#64748b',
};
const blankCase = (): CaseForm => ({
  accountKind: 'university',
  accountName: '',
  department: '',
  issueSummary: '',
  status: 'E アポ取り中',
  amount: 0,
  revenuePeriod: 'current',
  nextAction: '',
  isDraft: true,
  listVisible: true,
  showDepartment: true,
  showIssue: true,
  selectedProducts: [],
});
const blankSalesAccount = (): SalesAccountForm => ({
  kind: 'university',
  name: '',
  priority: 'medium',
  scale: 'medium',
});
const blankProduct = (): ProductForm => ({
  name: '',
  description: '',
  targetCustomer: '',
  outcome: '',
  contact: '',
});

async function requestApi(
  action: string,
  values: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await fetch('/api/app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
    credentials: 'same-origin',
  });
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string' ? result.error : '処理に失敗しました。',
    );
  return result;
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string): string {
  const date = new Date(
    value.includes('T') ? value : value.replace(' ', 'T') + 'Z',
  );
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
}

function formatYen(value: number): string {
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [tab, setTab] = useState<
    'cases' | 'accounts' | 'dashboard' | 'inbox' | 'products' | 'admin'
  >('cases');
  const [query, setQuery] = useState('');
  const [caseForm, setCaseForm] = useState<CaseForm | null>(null);
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [accountForm, setAccountForm] = useState<SalesAccountForm | null>(null);
  const [consultForm, setConsultForm] = useState<ConsultForm | null>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState<'current' | 'next'>(
    'current',
  );
  const [targetDraft, setTargetDraft] = useState<{
    period: 'current' | 'next';
    revenueTarget: number;
    caseTarget: number;
  } | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const response = await fetch('/api/app', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const result = (await response.json()) as AppData & {
      setupRequired?: boolean;
      error?: string;
    };
    if (!response.ok)
      throw new Error(
        result.error ??
          'データを読み込めませんでした。D1マイグレーションを確認してください。',
      );
    setData(result.user ? result : null);
    setSetupRequired(!!result.setupRequired);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setInviteToken(
        new URLSearchParams(window.location.search).get('invite') ?? '',
      );
      void reload()
        .catch((error) => setNotice(error.message))
        .finally(() => setLoading(false));
    });
  }, [reload]);

  async function act(
    action: string,
    values: Record<string, unknown> = {},
    message = '保存しました。',
  ) {
    setBusy(true);
    setNotice('');
    try {
      const result = await requestApi(action, values);
      await reload();
      setNotice(message);
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '処理に失敗しました。',
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  const filteredCases = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ja-JP');
    return (data?.cases ?? []).filter(
      (item) =>
        !q ||
        [
          item.accountName,
          item.department,
          item.issueSummary,
          item.teamName,
          ...item.selectedProducts.map((product) => product.name),
        ].some((value) => value?.toLocaleLowerCase('ja-JP').includes(q)),
    );
  }, [data?.cases, query]);

  const dashboard = useMemo(() => {
    const allCases = (data?.dashboardCases ?? []).filter(
      (item) => item.revenuePeriod === dashboardPeriod,
    );
    const target = (data?.salesTargets ?? []).find(
      (item) =>
        item.period === dashboardPeriod && item.teamId === data?.user.teamId,
    );
    const chart = allCases
      .map((item) => {
        const probability = statusProbability[item.status ?? ''] ?? 0;
        return {
          ...item,
          label: item.accountName,
          probability,
          expectedRevenue: Math.round((item.amount * probability) / 100),
          fill: statusColor[item.status ?? ''] ?? '#64748b',
        };
      })
      .sort((a, b) => b.expectedRevenue - a.expectedRevenue);
    const revenueTarget = target?.revenueTarget ?? 0;
    const caseTarget = target?.caseTarget ?? 0;
    const expectedRevenue = chart.reduce(
      (sum, item) => sum + item.expectedRevenue,
      0,
    );
    return {
      chart,
      revenueTarget,
      caseTarget,
      expectedRevenue,
      bookedRevenue: chart
        .filter((item) => item.status === 'A 受注済')
        .reduce((sum, item) => sum + item.amount, 0),
      pipelineRevenue: chart.reduce((sum, item) => sum + item.amount, 0),
      progress:
        revenueTarget > 0
          ? Math.min(100, Math.round((expectedRevenue / revenueTarget) * 100))
          : 0,
    };
  }, [dashboardPeriod, data]);
  const editableTarget =
    targetDraft?.period === dashboardPeriod
      ? targetDraft
      : {
          period: dashboardPeriod,
          revenueTarget: dashboard.revenueTarget,
          caseTarget: dashboard.caseTarget,
        };

  if (loading)
    return (
      <main className="auth-page">
        <div className="surface auth-card">読み込み中…</div>
      </main>
    );

  if (!data) {
    const mode = inviteToken
      ? 'acceptInvite'
      : setupRequired
        ? 'bootstrap'
        : 'login';
    return (
      <main className="auth-page">
        <div className="surface auth-card">
          <div className="brand-mark">
            <Handshake size={23} />
          </div>
          <h1>G-UP Sales Link</h1>
          <p className="muted">
            {mode === 'acceptInvite'
              ? '招待を受けて利用を開始'
              : mode === 'bootstrap'
                ? '初期管理者を設定'
                : 'メールアドレスでログイン'}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await act(
                mode,
                {
                  email: authEmail,
                  name: authName,
                  password: authPassword,
                  token: inviteToken,
                  bootstrapToken,
                },
                'ログインしました。',
              );
              if (result && inviteToken) {
                history.replaceState(null, '', '/');
                setInviteToken('');
              }
            }}
          >
            {mode !== 'acceptInvite' && (
              <Field label="メールアドレス">
                <input
                  className="form-control"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </Field>
            )}
            {mode !== 'login' && (
              <Field label="名前">
                <input
                  className="form-control"
                  required
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                />
              </Field>
            )}
            <Field label="パスワード">
              <input
                className="form-control"
                type="password"
                minLength={mode === 'login' ? undefined : 12}
                required
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </Field>
            {mode === 'bootstrap' && (
              <Field label="初期設定トークン">
                <input
                  className="form-control"
                  type="password"
                  required
                  value={bootstrapToken}
                  onChange={(event) => setBootstrapToken(event.target.value)}
                />
              </Field>
            )}
            {mode === 'acceptInvite' && (
              <p className="muted text-sm">
                招待を受けたメールアドレスでログインします。パスワードは12文字以上にしてください。
              </p>
            )}
            <button className="primary-button w-full" disabled={busy}>
              {busy ? '処理中…' : mode === 'login' ? 'ログイン' : '利用を開始'}
            </button>
          </form>
          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}
        </div>
      </main>
    );
  }

  const me = data.user;
  const ownTeam = data.teams.find((team) => team.id === me.teamId);
  const isAdmin = me.role !== 'member';
  const blockedTargets = new Set(
    data.shares
      .filter((share) => share.fromTeamId === me.teamId && !share.enabled)
      .map((share) => share.toTeamId),
  );

  function startCase(item?: SalesCase) {
    setConsultForm(null);
    setCaseForm(
      item
        ? {
            id: item.id,
            accountKind: item.accountKind,
            accountName: item.accountName,
            department: item.department ?? '',
            issueSummary: item.issueSummary ?? '',
            status: item.status ?? '',
            amount: item.amount,
            revenuePeriod: item.revenuePeriod,
            nextAction: item.nextAction ?? '',
            isDraft: item.isDraft,
            listVisible: item.listVisible,
            showDepartment: item.showDepartment,
            showIssue: item.showIssue,
            selectedProducts: item.selectedProducts.map(
              ({ productId, stage }) => ({ productId, stage }),
            ),
          }
        : blankCase(),
    );
  }

  function startConsult(item: SalesCase) {
    setCaseForm(null);
    setConsultForm({
      caseId: item.id,
      teamIds: [],
      includeAccount: true,
      includeDepartment: !!item.department,
      includeIssue: !!item.issueSummary,
      includeProducts: !!item.selectedProducts.length,
      note: '',
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-mark">
            <Handshake size={19} />
          </div>
          <div className="flex-1">
            <strong>G-UP Sales Link</strong>
            <p className="text-xs text-muted-foreground">
              課題を、次の提案へ。
            </p>
          </div>
          <div className="text-right text-sm">
            <strong>{me.name}</strong>
            <p className="text-xs text-muted-foreground">
              {ownTeam?.name ?? '全体管理者'}
            </p>
          </div>
          <button
            title="ログアウト"
            className="icon-button"
            onClick={async () => {
              await act('logout', {}, '');
              setData(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="app-content">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">営業連携ワークスペース</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            閲覧範囲に応じて、案件と商材を安全に共有します。
          </p>
        </div>
        {notice && <output className="notice mb-4 block">{notice}</output>}
        <nav className="app-tabs" aria-label="メインメニュー">
          <button
            className={tab === 'cases' ? 'active' : ''}
            onClick={() => setTab('cases')}
          >
            <ClipboardList size={17} />
            案件
          </button>
          <button
            className={tab === 'accounts' ? 'active' : ''}
            onClick={() => setTab('accounts')}
          >
            <ContactRound size={17} />
            営業先リスト
          </button>
          <button
            className={tab === 'dashboard' ? 'active' : ''}
            onClick={() => setTab('dashboard')}
          >
            <BarChart3 size={17} />
            進行中ダッシュボード
          </button>
          <button
            className={tab === 'inbox' ? 'active' : ''}
            onClick={() => setTab('inbox')}
          >
            <Send size={17} />
            個別相談
          </button>
          <button
            className={tab === 'products' ? 'active' : ''}
            onClick={() => setTab('products')}
          >
            <PackageOpen size={17} />
            商材台帳
          </button>
          {isAdmin && (
            <button
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => setTab('admin')}
            >
              <Settings2 size={17} />
              管理
            </button>
          )}
        </nav>

        {tab === 'cases' && (
          <div className="space-y-5">
            <section className="surface p-5">
              <div className="section-head">
                <div>
                  <h2 className="section-title">案件一覧</h2>
                  <p className="section-sub">
                    他部隊には公開が許可された項目だけが表示されます。
                  </p>
                </div>
                {me.teamId && (
                  <button
                    className="primary-button"
                    onClick={() => startCase()}
                  >
                    <Plus size={16} />
                    案件を登録
                  </button>
                )}
              </div>
              <label className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="営業先・部署・課題・商材・部隊で検索"
                />
              </label>
              <div className="case-list">
                {filteredCases.length ? (
                  filteredCases.map((item) => (
                    <article className="case-row" key={item.id}>
                      <div className="case-icon">
                        {item.accountKind === 'university' ? (
                          <GraduationCap size={20} />
                        ) : (
                          <Building2 size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{item.accountName}</h3>
                          {item.isDraft && (
                            <span className="badge muted-badge">下書き</span>
                          )}
                          {!item.isDraft && !item.listVisible && (
                            <span className="badge muted-badge">
                              一覧非公開
                            </span>
                          )}
                          {item.status && (
                            <span className="badge">{item.status}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.department || '部署未入力'} · {item.teamName}
                        </p>
                        {item.issueSummary && (
                          <p className="mt-2 text-sm">{item.issueSummary}</p>
                        )}
                        {item.amount > 0 && (
                          <p className="mt-2 text-sm font-bold text-slate-700">
                            {formatYen(item.amount)} ·{' '}
                            {item.revenuePeriod === 'current' ? '今期' : '来期'}
                          </p>
                        )}
                        {item.selectedProducts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.selectedProducts.map((product) => (
                              <span
                                className="product-tag"
                                key={product.productId}
                              >
                                {product.name} ·{' '}
                                {product.stage === 'proposed'
                                  ? '提案済み'
                                  : '頭出し'}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          担当: {item.ownerName} ·{' '}
                          <a
                            className="underline"
                            href={`mailto:${item.ownerEmail}`}
                          >
                            {item.ownerEmail}
                          </a>
                          {item.nextAction && <> · 次: {item.nextAction}</>}
                        </p>
                      </div>
                      <div className="row-actions">
                        {item.creatorId === me.id && (
                          <>
                            <button
                              className="outline-button"
                              onClick={() => startCase(item)}
                            >
                              編集
                            </button>
                            <button
                              className="outline-button"
                              onClick={() => startConsult(item)}
                            >
                              部隊に相談 <ArrowRight size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty">表示できる案件はありません。</p>
                )}
              </div>
            </section>
            {caseForm && (
              <section className="surface p-5" id="case-editor">
                <div className="section-head">
                  <h2 className="section-title">
                    {caseForm.id ? '案件を編集' : '案件を登録'}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setCaseForm(null)}
                  >
                    閉じる
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="営業先リストから選択（任意）">
                    <select
                      className="form-control"
                      value=""
                      onChange={(event) => {
                        const account = data.salesAccounts.find(
                          (item) => item.id === Number(event.target.value),
                        );
                        if (account)
                          setCaseForm({
                            ...caseForm,
                            accountName: account.name,
                            accountKind: account.kind,
                          });
                      }}
                    >
                      <option value="">営業先を選択</option>
                      {data.salesAccounts
                        .filter((item) => item.teamId === me.teamId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="営業先の種類">
                    <select
                      className="form-control"
                      value={caseForm.accountKind}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          accountKind: event.target
                            .value as CaseForm['accountKind'],
                        })
                      }
                    >
                      <option value="university">大学</option>
                      <option value="company">企業</option>
                    </select>
                  </Field>
                  <Field label="営業先名（必須）">
                    <input
                      className="form-control"
                      value={caseForm.accountName}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          accountName: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="部署名">
                    <input
                      className="form-control"
                      value={caseForm.department}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          department: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="営業ステータス">
                    <select
                      className="form-control"
                      value={caseForm.status}
                      onChange={(event) =>
                        setCaseForm({ ...caseForm, status: event.target.value })
                      }
                    >
                      <option value="">未設定</option>
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="売上金額（円）">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="1"
                      value={caseForm.amount}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          amount: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </Field>
                  <Field label="売上計上時期">
                    <select
                      className="form-control"
                      value={caseForm.revenuePeriod}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          revenuePeriod: event.target
                            .value as CaseForm['revenuePeriod'],
                        })
                      }
                    >
                      <option value="current">今期</option>
                      <option value="next">来期</option>
                    </select>
                  </Field>
                  <Field label="課題概要">
                    <textarea
                      className="form-control textarea"
                      value={caseForm.issueSummary}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          issueSummary: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="次のアクション">
                    <input
                      className="form-control"
                      value={caseForm.nextAction}
                      onChange={(event) =>
                        setCaseForm({
                          ...caseForm,
                          nextAction: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <h3 className="mt-6 font-bold">頭出し・提案済み商材</h3>
                <p className="section-sub">
                  商材名のチェックボックスを選び、進捗を指定します。
                </p>
                <div className="product-checks">
                  {data.products.map((product) => {
                    const selected = caseForm.selectedProducts.find(
                      (item) => item.productId === product.id,
                    );
                    return (
                      <div className="product-check" key={product.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(event) =>
                              setCaseForm({
                                ...caseForm,
                                selectedProducts: event.target.checked
                                  ? [
                                      ...caseForm.selectedProducts,
                                      {
                                        productId: product.id,
                                        stage: 'mentioned',
                                      },
                                    ]
                                  : caseForm.selectedProducts.filter(
                                      (item) => item.productId !== product.id,
                                    ),
                              })
                            }
                          />{' '}
                          {product.name} <small>· {product.teamName}</small>
                        </label>
                        {selected && (
                          <select
                            aria-label={`${product.name}の進捗`}
                            value={selected.stage}
                            onChange={(event) =>
                              setCaseForm({
                                ...caseForm,
                                selectedProducts: caseForm.selectedProducts.map(
                                  (item) =>
                                    item.productId === product.id
                                      ? {
                                          ...item,
                                          stage: event.target
                                            .value as SelectedProduct['stage'],
                                        }
                                      : item,
                                ),
                              })
                            }
                          >
                            <option value="mentioned">頭出し</option>
                            <option value="proposed">提案済み</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                  {!data.products.length && (
                    <p className="empty">
                      商材台帳に商材を登録すると選択できます。
                    </p>
                  )}
                </div>
                <div className="switch-grid">
                  <Switch
                    label="一覧に公開"
                    hint="OFFでは作成者だけが閲覧できます"
                    checked={caseForm.listVisible}
                    onChange={(value) =>
                      setCaseForm({ ...caseForm, listVisible: value })
                    }
                  />
                  <Switch
                    label="部署名を表示"
                    checked={caseForm.showDepartment}
                    onChange={(value) =>
                      setCaseForm({ ...caseForm, showDepartment: value })
                    }
                  />
                  <Switch
                    label="課題概要を表示"
                    checked={caseForm.showIssue}
                    onChange={(value) =>
                      setCaseForm({ ...caseForm, showIssue: value })
                    }
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    disabled={busy || !caseForm.accountName.trim()}
                    className="outline-button"
                    onClick={async () => {
                      const result = await act(
                        'saveCase',
                        { ...caseForm, isDraft: true },
                        '下書きを保存しました。',
                      );
                      if (result) setCaseForm(null);
                    }}
                  >
                    下書き保存
                  </button>
                  <button
                    disabled={busy || !caseForm.accountName.trim()}
                    className="primary-button"
                    onClick={async () => {
                      const result = await act(
                        'saveCase',
                        { ...caseForm, isDraft: false },
                        '案件を公開しました。',
                      );
                      if (result) setCaseForm(null);
                    }}
                  >
                    公開して保存
                  </button>
                </div>
              </section>
            )}
            {consultForm && (
              <section className="surface p-5">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">部隊に個別相談</h2>
                    <p className="section-sub">
                      一覧非公開の案件も、ここで選んだ項目だけ送信できます。
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setConsultForm(null)}
                  >
                    閉じる
                  </button>
                </div>
                <h3 className="font-bold">送信先</h3>
                <div className="product-checks">
                  {data.teams
                    .filter(
                      (team) =>
                        team.id !== me.teamId && !blockedTargets.has(team.id),
                    )
                    .map((team) => (
                      <label className="product-check" key={team.id}>
                        <input
                          type="checkbox"
                          checked={consultForm.teamIds.includes(team.id)}
                          onChange={(event) =>
                            setConsultForm({
                              ...consultForm,
                              teamIds: event.target.checked
                                ? [...consultForm.teamIds, team.id]
                                : consultForm.teamIds.filter(
                                    (id) => id !== team.id,
                                  ),
                            })
                          }
                        />{' '}
                        {team.name} <small>· {team.companyName}</small>
                      </label>
                    ))}
                </div>
                <h3 className="mt-5 font-bold">送る項目</h3>
                <div className="switch-grid">
                  <Switch
                    label="営業先名"
                    checked={consultForm.includeAccount}
                    onChange={(value) =>
                      setConsultForm({ ...consultForm, includeAccount: value })
                    }
                  />
                  <Switch
                    label="部署名"
                    checked={consultForm.includeDepartment}
                    onChange={(value) =>
                      setConsultForm({
                        ...consultForm,
                        includeDepartment: value,
                      })
                    }
                  />
                  <Switch
                    label="課題概要"
                    checked={consultForm.includeIssue}
                    onChange={(value) =>
                      setConsultForm({ ...consultForm, includeIssue: value })
                    }
                  />
                  <Switch
                    label="頭出し・提案済み商材"
                    checked={consultForm.includeProducts}
                    onChange={(value) =>
                      setConsultForm({ ...consultForm, includeProducts: value })
                    }
                  />
                </div>
                <Field label="補足メモ">
                  <textarea
                    className="form-control textarea"
                    value={consultForm.note}
                    onChange={(event) =>
                      setConsultForm({
                        ...consultForm,
                        note: event.target.value,
                      })
                    }
                  />
                </Field>
                <button
                  disabled={busy || !consultForm.teamIds.length}
                  className="primary-button mt-4"
                  onClick={async () => {
                    const result = await act(
                      'sendConsultation',
                      consultForm,
                      '相談を送信しました。',
                    );
                    if (result) setConsultForm(null);
                  }}
                >
                  <Send size={16} />
                  送信
                </button>
              </section>
            )}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-5">
            <section className="surface p-5">
              <div className="section-head">
                <div>
                  <h2 className="section-title">営業先リスト</h2>
                  <p className="section-sub">
                    優先度と規模感を整理し、案件の最新ステータスを確認できます。
                  </p>
                </div>
                {me.teamId && (
                  <button
                    className="primary-button"
                    onClick={() => setAccountForm(blankSalesAccount())}
                  >
                    <Plus size={16} />
                    営業先を登録
                  </button>
                )}
              </div>
              <div className="accounts-table-wrap">
                <table className="accounts-table">
                  <thead>
                    <tr>
                      <th>営業先</th>
                      <th>優先度</th>
                      <th>規模感</th>
                      <th>営業ステータス</th>
                      <th>案件数</th>
                      <th aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.salesAccounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {account.kind === 'university' ? (
                              <GraduationCap size={17} />
                            ) : (
                              <Building2 size={17} />
                            )}
                            <div>
                              <strong>{account.name}</strong>
                              <small>{account.teamName}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`priority-badge ${account.priority}`}
                          >
                            {account.priority === 'high'
                              ? '高'
                              : account.priority === 'medium'
                                ? '中'
                                : '低'}
                          </span>
                        </td>
                        <td>
                          {account.scale === 'large'
                            ? '大'
                            : account.scale === 'medium'
                              ? '中'
                              : '小'}
                        </td>
                        <td>
                          {account.status ? (
                            <span className="badge">{account.status}</span>
                          ) : (
                            <span className="muted text-sm">案件未登録</span>
                          )}
                        </td>
                        <td>{account.caseCount}</td>
                        <td>
                          {account.teamId === me.teamId && (
                            <button
                              className="outline-button"
                              onClick={() =>
                                setAccountForm({
                                  id: account.id,
                                  kind: account.kind,
                                  name: account.name,
                                  priority: account.priority,
                                  scale: account.scale,
                                })
                              }
                            >
                              編集
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.salesAccounts.length && (
                  <p className="empty">営業先はまだ登録されていません。</p>
                )}
              </div>
            </section>
            {accountForm && (
              <section className="surface p-5">
                <div className="section-head">
                  <h2 className="section-title">
                    {accountForm.id ? '営業先を編集' : '営業先を登録'}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setAccountForm(null)}
                  >
                    閉じる
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="営業先の種類">
                    <select
                      className="form-control"
                      value={accountForm.kind}
                      onChange={(event) =>
                        setAccountForm({
                          ...accountForm,
                          kind: event.target.value as SalesAccountForm['kind'],
                        })
                      }
                    >
                      <option value="university">大学</option>
                      <option value="company">企業</option>
                    </select>
                  </Field>
                  <Field label="営業先名（必須）">
                    <input
                      className="form-control"
                      value={accountForm.name}
                      onChange={(event) =>
                        setAccountForm({
                          ...accountForm,
                          name: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="優先度">
                    <select
                      className="form-control"
                      value={accountForm.priority}
                      onChange={(event) =>
                        setAccountForm({
                          ...accountForm,
                          priority: event.target
                            .value as SalesAccountForm['priority'],
                        })
                      }
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </Field>
                  <Field label="規模感">
                    <select
                      className="form-control"
                      value={accountForm.scale}
                      onChange={(event) =>
                        setAccountForm({
                          ...accountForm,
                          scale: event.target
                            .value as SalesAccountForm['scale'],
                        })
                      }
                    >
                      <option value="large">大</option>
                      <option value="medium">中</option>
                      <option value="small">小</option>
                    </select>
                  </Field>
                </div>
                <button
                  className="primary-button mt-5"
                  disabled={busy || !accountForm.name.trim()}
                  onClick={async () => {
                    const result = await act(
                      'saveSalesAccount',
                      accountForm,
                      '営業先を保存しました。',
                    );
                    if (result) setAccountForm(null);
                  }}
                >
                  保存
                </button>
              </section>
            )}
          </div>
        )}

        {tab === 'dashboard' && (
          <div className="space-y-5">
            <section className="surface dashboard-hero p-5">
              <div className="section-head">
                <div>
                  <h2 className="section-title">進行中ダッシュボード</h2>
                  <p className="section-sub">
                    案件金額に営業ステータスの確度を掛け、目標への進捗を表示します。
                  </p>
                </div>
                <div className="period-switch" aria-label="対象期間">
                  <button
                    className={dashboardPeriod === 'current' ? 'active' : ''}
                    onClick={() => setDashboardPeriod('current')}
                  >
                    今期
                  </button>
                  <button
                    className={dashboardPeriod === 'next' ? 'active' : ''}
                    onClick={() => setDashboardPeriod('next')}
                  >
                    来期
                  </button>
                </div>
              </div>
              <div className="dashboard-metrics">
                <div className="kpi-card">
                  <Target size={19} />
                  <span>目標売上</span>
                  <strong>{formatYen(dashboard.revenueTarget)}</strong>
                </div>
                <div className="kpi-card accent-card">
                  <CircleDollarSign size={19} />
                  <span>確度加重後の見込み</span>
                  <strong>{formatYen(dashboard.expectedRevenue)}</strong>
                </div>
                <div className="kpi-card">
                  <BarChart3 size={19} />
                  <span>目標達成度</span>
                  <strong>{dashboard.progress}%</strong>
                </div>
                <div className="kpi-card">
                  <ClipboardList size={19} />
                  <span>案件数</span>
                  <strong>
                    {dashboard.chart.length}
                    {dashboard.caseTarget > 0 && ` / ${dashboard.caseTarget}`}
                  </strong>
                </div>
              </div>
              <div className="progress-block">
                <div>
                  <span>目標に対する見込み売上</span>
                  <strong>
                    {formatYen(dashboard.expectedRevenue)} /{' '}
                    {formatYen(dashboard.revenueTarget)}
                  </strong>
                </div>
                <div
                  className="revenue-progress"
                  aria-label={`達成度${dashboard.progress}%`}
                >
                  <span style={{ width: `${dashboard.progress}%` }} />
                </div>
                <p>
                  受注済 {formatYen(dashboard.bookedRevenue)} · 案件総額{' '}
                  {formatYen(dashboard.pipelineRevenue)}
                </p>
              </div>
            </section>

            {me.teamId && (
              <section className="surface p-5">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">目標KPI</h2>
                    <p className="section-sub">
                      {dashboardPeriod === 'current' ? '今期' : '来期'}
                      の部隊目標を設定します。
                    </p>
                  </div>
                </div>
                <div className="target-editor">
                  <Field label="目標売上（円）">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      value={editableTarget.revenueTarget}
                      onChange={(event) =>
                        setTargetDraft({
                          ...editableTarget,
                          revenueTarget: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="目標案件数">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      value={editableTarget.caseTarget}
                      onChange={(event) =>
                        setTargetDraft({
                          ...editableTarget,
                          caseTarget: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        })
                      }
                    />
                  </Field>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={async () => {
                      const result = await act(
                        'saveSalesTarget',
                        editableTarget,
                        '目標KPIを保存しました。',
                      );
                      if (result) setTargetDraft(null);
                    }}
                  >
                    目標を保存
                  </button>
                </div>
              </section>
            )}

            <section className="surface p-5">
              <div className="section-head">
                <div>
                  <h2 className="section-title">案件別 見込み売上</h2>
                  <p className="section-sub">
                    横軸は「売上金額 × ステータス確度」、縦軸は案件です。
                  </p>
                </div>
              </div>
              {dashboard.chart.length ? (
                <div
                  className="chart-wrap"
                  style={{ height: Math.max(300, dashboard.chart.length * 54) }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.chart}
                      layout="vertical"
                      margin={{ top: 8, right: 28, bottom: 8, left: 12 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          `${Math.round(Number(value) / 10000)}万`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={180}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatYen(Number(value)),
                          '見込み売上',
                        ]}
                      />
                      <Bar dataKey="expectedRevenue" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="empty">対象期間の案件はまだありません。</p>
              )}
              <div className="probability-legend">
                {statuses.map((status) => (
                  <span key={status}>
                    <i style={{ background: statusColor[status] }} />
                    {status.slice(0, 1)} {statusProbability[status]}%
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'inbox' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface p-5">
              <h2 className="section-title">受信一覧</h2>
              <p className="section-sub">
                自部隊宛ての相談。対応済みは部隊内で共有します。
              </p>
              <div className="mt-4 space-y-3">
                {data.received.length ? (
                  data.received.map((item) => (
                    <article className="inbox-card" key={item.id}>
                      <div className="flex items-start justify-between gap-2">
                        <strong>{item.accountName || '営業先名非公開'}</strong>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      {item.department && (
                        <p className="mt-1 text-sm">{item.department}</p>
                      )}
                      {item.issueSummary && (
                        <p className="mt-2 text-sm">{item.issueSummary}</p>
                      )}
                      {item.productSummary && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          商材: {item.productSummary}
                        </p>
                      )}
                      {item.note && <p className="note-box">{item.note}</p>}
                      <p className="mt-3 text-xs">
                        送信者: {item.senderName} ·{' '}
                        <a
                          className="underline"
                          href={`mailto:${item.senderEmail}`}
                        >
                          {item.senderEmail}
                        </a>
                      </p>
                      <div className="mt-3">
                        <Switch
                          label="対応済み"
                          checked={!!item.handled}
                          onChange={(value) =>
                            void act(
                              'setHandled',
                              { id: item.id, handled: value },
                              '対応状況を更新しました。',
                            )
                          }
                        />
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty">受信した相談はありません。</p>
                )}
              </div>
            </section>
            <section className="surface p-5">
              <h2 className="section-title">送信履歴</h2>
              <p className="section-sub">撤回した相談も履歴に残ります。</p>
              <div className="mt-4 space-y-3">
                {data.sent.length ? (
                  data.sent.map((item) => (
                    <article className="inbox-card" key={item.id}>
                      <div className="flex items-start justify-between gap-2">
                        <strong>{item.accountName || '営業先名非公開'}</strong>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        送信先: {item.recipientNames}
                      </p>
                      {item.department && (
                        <p className="mt-2 text-sm">{item.department}</p>
                      )}
                      {item.issueSummary && (
                        <p className="mt-2 text-sm">{item.issueSummary}</p>
                      )}
                      {item.productSummary && (
                        <p className="mt-2 text-xs">{item.productSummary}</p>
                      )}
                      {item.note && <p className="note-box">{item.note}</p>}
                      {item.withdrawnAt ? (
                        <span className="badge muted-badge mt-3">撤回済み</span>
                      ) : (
                        <button
                          className="outline-button mt-3"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              'withdrawConsultation',
                              { id: item.id },
                              '相談を撤回しました。',
                            )
                          }
                        >
                          撤回
                        </button>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="empty">送信履歴はありません。</p>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-5">
            <section className="surface p-5">
              <div className="section-head">
                <div>
                  <h2 className="section-title">商材台帳</h2>
                  <p className="section-sub">
                    全参加部隊の商材を確認できます。
                  </p>
                </div>
                {me.teamId && (
                  <button
                    className="primary-button"
                    onClick={() => setProductForm(blankProduct())}
                  >
                    <Plus size={16} />
                    商材を登録
                  </button>
                )}
              </div>
              <div className="product-grid">
                {data.products.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="case-icon">
                      <PackageOpen size={19} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {product.teamName}
                    </p>
                    <h3 className="mt-1 font-bold">{product.name}</h3>
                    {product.description && (
                      <p className="mt-2 text-sm">{product.description}</p>
                    )}
                    {product.targetCustomer && (
                      <p className="mt-2 text-xs">
                        対象: {product.targetCustomer}
                      </p>
                    )}
                    {product.outcome && (
                      <p className="mt-1 text-xs">効果: {product.outcome}</p>
                    )}
                    {product.contact && (
                      <p className="mt-2 text-xs">連絡先: {product.contact}</p>
                    )}
                    {product.teamId === me.teamId && (
                      <button
                        className="outline-button mt-4"
                        onClick={() =>
                          setProductForm({
                            id: product.id,
                            name: product.name,
                            description: product.description ?? '',
                            targetCustomer: product.targetCustomer ?? '',
                            outcome: product.outcome ?? '',
                            contact: product.contact ?? '',
                          })
                        }
                      >
                        編集
                      </button>
                    )}
                  </article>
                ))}
                {!data.products.length && (
                  <p className="empty">商材はまだ登録されていません。</p>
                )}
              </div>
            </section>
            {productForm && (
              <section className="surface p-5">
                <div className="section-head">
                  <h2 className="section-title">
                    {productForm.id ? '商材を編集' : '商材を登録'}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setProductForm(null)}
                  >
                    閉じる
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="商材名（必須）">
                    <input
                      className="form-control"
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          name: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="連絡先">
                    <input
                      className="form-control"
                      value={productForm.contact}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          contact: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="説明">
                    <textarea
                      className="form-control textarea"
                      value={productForm.description}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          description: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="対象顧客">
                    <textarea
                      className="form-control textarea"
                      value={productForm.targetCustomer}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          targetCustomer: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="効果">
                    <textarea
                      className="form-control textarea"
                      value={productForm.outcome}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          outcome: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <button
                  className="primary-button mt-5"
                  disabled={busy || !productForm.name.trim()}
                  onClick={async () => {
                    const result = await act(
                      'saveProduct',
                      productForm,
                      '商材を保存しました。',
                    );
                    if (result) setProductForm(null);
                  }}
                >
                  保存
                </button>
              </section>
            )}
          </div>
        )}

        {tab === 'admin' && isAdmin && (
          <AdminPanel
            data={data}
            busy={busy}
            inviteUrl={inviteUrl}
            setInviteUrl={setInviteUrl}
            act={act}
          />
        )}
      </div>
    </main>
  );
}

function AdminPanel({
  data,
  busy,
  inviteUrl,
  setInviteUrl,
  act,
}: {
  data: AppData;
  busy: boolean;
  inviteUrl: string;
  setInviteUrl: (value: string) => void;
  act: (
    action: string,
    values?: Record<string, unknown>,
    message?: string,
  ) => Promise<Record<string, unknown> | null>;
}) {
  const [companyName, setCompanyName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<
    'global_admin' | 'team_admin' | 'member'
  >(data.user.role === 'global_admin' ? 'team_admin' : 'member');
  const [inviteTeamId, setInviteTeamId] = useState<number | ''>(
    data.user.teamId ?? '',
  );
  const shareMap = new Map(
    data.shares.map((item) => [
      `${item.fromTeamId}:${item.toTeamId}`,
      !!item.enabled,
    ]),
  );
  const fromTeams =
    data.user.role === 'global_admin'
      ? data.teams
      : data.teams.filter((team) => team.id === data.user.teamId);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {data.user.role === 'global_admin' && (
          <section className="surface p-5">
            <h2 className="section-title">会社・部隊を登録</h2>
            <div className="mt-4 flex gap-2">
              <input
                className="form-control"
                placeholder="会社名"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <button
                className="primary-button"
                disabled={busy || !companyName.trim()}
                onClick={async () => {
                  if (
                    await act(
                      'createCompany',
                      { name: companyName },
                      '会社を登録しました。',
                    )
                  )
                    setCompanyName('');
                }}
              >
                登録
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                className="form-control flex-1"
                value={companyId}
                onChange={(event) =>
                  setCompanyId(Number(event.target.value) || '')
                }
              >
                <option value="">会社を選択</option>
                {data.companies.map((company) => (
                  <option value={company.id} key={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <input
                className="form-control flex-1"
                placeholder="部隊名"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
              <button
                className="primary-button"
                disabled={busy || !companyId || !teamName.trim()}
                onClick={async () => {
                  if (
                    await act(
                      'createTeam',
                      { companyId, name: teamName },
                      '部隊を登録しました。',
                    )
                  )
                    setTeamName('');
                }}
              >
                登録
              </button>
            </div>
          </section>
        )}
        <section className="surface p-5">
          <h2 className="section-title">利用者を招待</h2>
          <p className="section-sub">
            招待リンクを対象者に個別に共有してください。有効期限は7日です。
          </p>
          <div className="mt-4 space-y-3">
            <Field label="メールアドレス">
              <input
                className="form-control"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </Field>
            {data.user.role === 'global_admin' && (
              <Field label="権限">
                <select
                  className="form-control"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as typeof inviteRole)
                  }
                >
                  <option value="team_admin">部隊管理者</option>
                  <option value="member">営業担当</option>
                  <option value="global_admin">全体管理者</option>
                </select>
              </Field>
            )}
            {inviteRole !== 'global_admin' && (
              <Field label="部隊">
                <select
                  className="form-control"
                  value={inviteTeamId}
                  onChange={(event) =>
                    setInviteTeamId(Number(event.target.value) || '')
                  }
                  disabled={data.user.role === 'team_admin'}
                >
                  <option value="">部隊を選択</option>
                  {data.teams
                    .filter(
                      (team) =>
                        data.user.role === 'global_admin' ||
                        team.id === data.user.teamId,
                    )
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.companyName} · {team.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <button
              className="primary-button"
              disabled={
                busy ||
                !inviteEmail.trim() ||
                (inviteRole !== 'global_admin' && !inviteTeamId)
              }
              onClick={async () => {
                const result = await act(
                  'createInvite',
                  {
                    email: inviteEmail,
                    role: inviteRole,
                    teamId: inviteRole === 'global_admin' ? null : inviteTeamId,
                  },
                  '招待リンクを作成しました。',
                );
                if (result && typeof result.inviteUrl === 'string') {
                  setInviteUrl(result.inviteUrl);
                  setInviteEmail('');
                }
              }}
            >
              招待リンクを作成
            </button>
            {inviteUrl && (
              <div className="note-box break-all">
                <strong>招待リンク:</strong> {inviteUrl}
                <button
                  className="outline-button mt-2"
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                >
                  コピー
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="surface p-5">
        <h2 className="section-title">部隊間の一覧共有</h2>
        <p className="section-sub">
          自部隊の案件を見せる部隊を設定します。新しい部隊は初期状態でONです。
        </p>
        <div className="share-grid">
          {fromTeams.map((from) => (
            <div className="share-card" key={from.id}>
              <h3 className="font-bold">{from.name} から公開</h3>
              {data.teams
                .filter((to) => to.id !== from.id)
                .map((to) => (
                  <Switch
                    key={to.id}
                    label={to.name}
                    hint={to.companyName}
                    checked={shareMap.get(`${from.id}:${to.id}`) ?? true}
                    onChange={(enabled) =>
                      void act(
                        'setShare',
                        { fromTeamId: from.id, toTeamId: to.id, enabled },
                        '共有範囲を更新しました。',
                      )
                    }
                  />
                ))}
            </div>
          ))}
        </div>
      </section>
      <section className="surface p-5">
        <h2 className="section-title">登録済み利用者</h2>
        <div className="mt-4 space-y-2">
          {data.members.map((member) => (
            <div className="member-row" key={member.id}>
              <ShieldCheck size={16} />
              <strong>{member.name}</strong>
              <span>{member.email}</span>
              <small>
                {member.role === 'global_admin'
                  ? '全体管理者'
                  : member.role === 'team_admin'
                    ? '部隊管理者'
                    : '営業担当'}
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
