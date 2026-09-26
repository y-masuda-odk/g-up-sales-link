'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, Building2, Check, ChevronRight, CircleDot, Clock3, GraduationCap, Handshake, Lightbulb, PackageOpen, Plus, Search, Send, Sparkles, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Account = { id: number; kind: '大学' | '企業'; name: string; department: string; owner: string; status: string; issue: string; next: string; updated: string };

const accounts: Account[] = [
  { id: 1, kind: '大学', name: 'A大学', department: '企画・IR部門', owner: '営業担当A', status: '課題把握', issue: '学生の学修成果が部署ごとに分散し、教学改善に使い切れていない', next: 'IR担当を交えた要件整理', updated: '今日 10:40' },
  { id: 2, kind: '企業', name: 'A社', department: '人材開発部門', owner: '営業担当B', status: '提案準備', issue: '若手社員の育成状況を定量的に把握したい', next: '共同提案資料の作成', updated: '昨日 16:20' },
  { id: 3, kind: '大学', name: 'B大学', department: 'キャリア支援部門', owner: '営業担当C', status: '初回訪問', issue: '低学年からのキャリア支援が学部単位でばらついている', next: '学部別の利用状況を確認', updated: '9月5日' },
  { id: 4, kind: '企業', name: 'B社', department: '新規事業部門', owner: '営業担当D', status: '検討中', issue: '大学との産学連携テーマを継続的に発掘したい', next: '連携候補3大学を共有', updated: '9月3日' },
];

const products = [
  { name: '学修成果アセスメント', owner: '教育サービス企業A', category: 'アセスメント', tags: ['学修成果', 'IR', '教学改善'], lead: '商材担当A' },
  { name: 'キャリア形成支援プログラム', owner: '教育パートナーA', category: '教育プログラム', tags: ['低学年', 'キャリア教育', 'PBL'], lead: '商材担当B' },
  { name: 'データ統合ダッシュボード', owner: 'データ企業A', category: 'データ活用', tags: ['データ統合', '可視化', '意思決定'], lead: '商材担当C' },
  { name: '産学連携テーマバンク', owner: '連携事務局', category: 'マッチング', tags: ['産学連携', '共同研究', '企業課題'], lead: '商材担当D' },
];

const matches = [
  { score: 94, account: 'A大学', product: 'データ統合ダッシュボード', provider: 'データ企業A', contact: '商材担当C', reason: '「データ分散」「教学改善」と商材の導入目的が強く一致' },
  { score: 88, account: 'B大学', product: 'キャリア形成支援プログラム', provider: '教育パートナーA', contact: '商材担当B', reason: '対象学年とPBL型プログラムの活用場面が一致' },
];

const statusStyle: Record<string, string> = { 初回訪問: 'bg-slate-100 text-slate-700', 課題把握: 'bg-amber-100 text-amber-800', 提案準備: 'bg-cyan-100 text-cyan-800', 検討中: 'bg-violet-100 text-violet-800' };

export default function Home() {
  const [query, setQuery] = useState('');
  const [shared, setShared] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? accounts.filter((item) => [item.name, item.department, item.owner, item.issue].some((value) => value.toLowerCase().includes(q))) : accounts }, [query]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'share_match_suggestion',
      title: 'AIマッチ候補を担当者に共有',
      description: '表示中のAIマッチ候補を商材担当者へ共有済みの状態にします。候補番号は0または1です。',
      inputSchema: { type: 'object', properties: { matchIndex: { type: 'integer', minimum: 0, maximum: matches.length - 1 } }, required: ['matchIndex'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        const index = typeof input === 'object' && input !== null && 'matchIndex' in input ? Number((input as { matchIndex: unknown }).matchIndex) : -1;
        if (!Number.isInteger(index) || !matches[index]) throw new Error('matchIndexには0または1を指定してください。');
        setShared((current) => [...new Set([...current, index])]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { status: 'shared', account: matches[index].account, product: matches[index].product };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(5,35,64,.2)]"><Handshake className="size-5" /></div><div><p className="text-[15px] font-bold leading-none tracking-tight">G-UP Sales Link</p><p className="mt-1 text-[11px] font-medium text-muted-foreground">課題を、次の提案へ。</p></div></div>
      <label className="ml-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-muted/45 px-3 md:flex"><Search className="size-4 text-muted-foreground" /><span className="sr-only">営業先を検索</span><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="大学・企業・部署・担当者を検索" /></label>
      <button className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground" aria-label="通知"><Bell className="size-4" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" /></button><div className="grid size-9 place-items-center rounded-full bg-[#d9e7f2] text-xs font-bold text-primary">担当A</div>
    </div></header>

    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7"><Tabs defaultValue="overview">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span>営業連携センター</span><ChevronRight className="size-3" /><span>全体</span></div><h1 className="text-2xl font-bold tracking-[-.03em] sm:text-[30px]">営業状況とAI提案</h1><p className="mt-1 text-sm text-muted-foreground">グループで課題を共有し、提案機会を逃さないためのワークスペース</p></div>
        <div className="flex flex-wrap items-center gap-2"><TabsList className="h-10 rounded-xl bg-muted/70 p-1"><TabsTrigger value="overview" className="px-3">ホーム</TabsTrigger><TabsTrigger value="accounts" className="px-3">営業先</TabsTrigger><TabsTrigger value="products" className="px-3">商材台帳</TabsTrigger></TabsList><IssueSheet saved={saved} setSaved={setSaved} /></div>
      </div>

      <TabsContent value="overview" className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Target />} label="進行中の営業" value="18" note="今週 4件更新" color="navy" /><Metric icon={<Lightbulb />} label="共有された課題" value="31" note="未確認 6件" color="amber" /><Metric icon={<Sparkles />} label="AIマッチ候補" value="7" note="高確度 3件" color="cyan" /><Metric icon={<Send />} label="パートナー連携" value="12" note="返信待ち 2件" color="green" /></section>
        {saved && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><Check className="size-4" />課題を共有しました。AIが商材台帳とのマッチングを開始しています。</div>}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="section-title">最近更新された営業先</h2><p className="section-sub">担当・ステータス・次のアクションを横断確認</p></div><Button variant="ghost" size="sm">すべて見る<ArrowRight /></Button></div><div className="divide-y divide-border">{filtered.slice(0, 4).map((account) => <AccountRow key={account.id} account={account} />)}</div></div>
          <div className="surface overflow-hidden border-primary/15"><div className="ai-header px-5 py-4 text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles className="size-4 text-cyan-300" /><h2 className="text-base font-bold">AIマッチ提案</h2></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">7件</span></div><p className="mt-1 text-xs text-slate-300">課題と商材の意味・実績・対象を照合</p></div><div className="divide-y divide-border">{matches.map((match, index) => <div key={match.account} className="p-5"><div className="flex items-start gap-3"><div className="score-ring"><strong>{match.score}</strong><span>%</span></div><div className="min-w-0 flex-1"><p className="text-[11px] font-bold tracking-wide text-muted-foreground">{match.account}</p><p className="mt-1 text-sm font-bold leading-snug">{match.product}</p><p className="mt-1 text-xs text-muted-foreground">{match.provider}・{match.contact}</p></div></div><p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-foreground/80">{match.reason}</p><Button onClick={() => setShared((s) => [...new Set([...s, index])])} variant={shared.includes(index) ? 'secondary' : 'outline'} size="sm" className="mt-3 w-full">{shared.includes(index) ? <><Check />共有済み</> : <><Send />担当者に共有</>}</Button></div>)}</div></div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="surface p-5"><div className="mb-5 flex items-start justify-between"><div><h2 className="section-title">営業パイプライン</h2><p className="section-sub">今月の案件ステータス</p></div><span className="text-xs font-semibold text-muted-foreground">合計 18件</span></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{[['初回接点', 5, 28], ['課題把握', 4, 22], ['提案準備', 3, 17], ['提案中', 4, 22], ['契約調整', 2, 11]].map(([label, count, width]) => <div key={String(label)}><div className="mb-2 flex items-end justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><strong className="text-xl">{count}</strong></div><Progress value={Number(width)} className="pipeline-progress" /></div>)}</div></div>
          <div className="surface p-5"><h2 className="section-title">次のアクション</h2><div className="mt-4 space-y-3"><Action time="今日 14:00" title="A大学 要件整理" owner="営業担当A・商材担当C" /><Action time="明日 10:30" title="A社 提案レビュー" owner="営業担当B・商材担当A" /></div></div></section>
      </TabsContent>

      <TabsContent value="accounts"><div className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="section-title">営業先一覧</h2><p className="section-sub">大学・企業・部署単位で活動状況を確認</p></div><label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-64 max-w-full bg-transparent text-sm outline-none" placeholder="絞り込み" /></label></div><div className="divide-y divide-border">{filtered.map((account) => <AccountRow key={account.id} account={account} detailed />)}</div></div></TabsContent>
      <TabsContent value="products"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{products.map((product) => <div className="surface flex min-h-56 flex-col p-5" key={product.name}><div className="mb-5 grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><PackageOpen className="size-5" /></div><p className="text-xs font-semibold text-muted-foreground">{product.category}</p><h3 className="mt-1 text-lg font-bold">{product.name}</h3><p className="mt-1 text-xs text-muted-foreground">{product.owner}</p><div className="mt-4 flex flex-wrap gap-1.5">{product.tags.map((tag) => <span key={tag} className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground/70">{tag}</span>)}</div><div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs"><span>担当：{product.lead}</span><Button variant="ghost" size="icon-sm" aria-label="商材詳細"><ChevronRight /></Button></div></div>)}</div></TabsContent>
    </Tabs></div>
  </main>;
}

function Metric({ icon, label, value, note, color }: { icon: React.ReactNode; label: string; value: string; note: string; color: string }) { return <div className="surface metric-card"><div className={`metric-icon ${color}`}>{icon}</div><div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground">{note}</p></div></div> }

function AccountRow({ account, detailed = false }: { account: Account; detailed?: boolean }) { return <div className="group grid gap-4 px-5 py-4 transition-colors hover:bg-muted/35 md:grid-cols-[minmax(180px,1fr)_minmax(170px,1fr)_120px] md:items-center"><div className="flex min-w-0 items-start gap-3"><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${account.kind === '大学' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{account.kind === '大学' ? <GraduationCap className="size-4" /> : <Building2 className="size-4" />}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{account.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{account.department}</p>{detailed && <p className="mt-2 text-xs leading-relaxed text-foreground/70">課題：{account.issue}</p>}</div></div><div><div className="flex items-center gap-2"><Users className="size-3.5 text-muted-foreground" /><span className="text-xs font-semibold">{account.owner}</span></div><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><CircleDot className="size-3" />次：{account.next}</p></div><div className="flex items-center justify-between gap-2 md:justify-end"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[account.status]}`}>{account.status}</span><span className="text-[11px] text-muted-foreground md:hidden xl:inline">{account.updated}</span><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div></div> }

function Action({ time, title, owner }: { time: string; title: string; owner: string }) { return <div className="flex gap-3 rounded-xl bg-muted/45 p-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-sm"><Clock3 className="size-4" /></div><div><p className="text-[11px] font-bold text-cyan-700">{time}</p><p className="mt-0.5 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">参加：{owner}</p></div></div> }

function IssueSheet({ saved, setSaved }: { saved: boolean; setSaved: (value: boolean) => void }) { return <Sheet><SheetTrigger render={<Button className="h-10 rounded-xl px-4" />}><Plus />課題を登録</SheetTrigger><SheetContent className="w-full sm:max-w-lg"><SheetHeader className="border-b border-border p-6"><SheetTitle className="text-xl font-bold">営業先の課題を共有</SheetTitle><SheetDescription>訪問で得た事実を登録すると、AIが商材台帳から候補を提案します。</SheetDescription></SheetHeader><form className="flex flex-1 flex-col overflow-y-auto" onSubmit={(e) => { e.preventDefault(); setSaved(true) }}><div className="space-y-5 p-6"><Field label="営業先"><input required className="form-control" placeholder="大学・会社名" /></Field><Field label="部署"><input required className="form-control" placeholder="例：企画・IR部門" /></Field><Field label="営業担当"><input required className="form-control" defaultValue="営業担当A" /></Field><Field label="ステータス"><select className="form-control" defaultValue="課題把握"><option>初回訪問</option><option>課題把握</option><option>提案準備</option><option>提案中</option></select></Field><Field label="課題・ニーズ"><textarea required className="form-control min-h-32 resize-y" placeholder="相手の発言や背景、解決したい状態を記録" /></Field><Field label="次のアクション"><input className="form-control" placeholder="例：IR担当を交えた要件整理" /></Field><div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="flex items-center gap-2 text-xs font-bold text-cyan-900"><Sparkles className="size-4" />登録後にAIが行うこと</p><p className="mt-2 text-xs leading-relaxed text-cyan-900/70">課題文から対象・目的・緊急度を抽出し、商材の対象顧客・導入効果・実績と照合します。</p></div></div><SheetFooter className="border-t border-border p-5"><Button type="submit" className="h-10">{saved ? <><Check />登録済み</> : <><Sparkles />共有してAI分析</>}</Button></SheetFooter></form></SheetContent></Sheet> }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label> }
