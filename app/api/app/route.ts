import {
  checkOrigin,
  createSession,
  currentUser,
  deleteSession,
  expiredSessionCookie,
} from '@/lib/auth';
import {
  acceptInvite,
  ApiError,
  bootstrap,
  loadApp,
  login,
  performAction,
  setupRequired,
} from '@/lib/app-api';

export const runtime = 'edge';

function json(data: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

function failure(error: unknown): Response {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  console.error('API error:', error);
  return json(
    { error: '処理に失敗しました。時間をおいて再試行してください。' },
    500,
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await currentUser(request);
    if (!user)
      return json({ user: null, setupRequired: await setupRequired() });
    return json(
      await loadApp(user, new URL(request.url).searchParams.get('q') ?? ''),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    checkOrigin(request);
    if (Number(request.headers.get('content-length') ?? 0) > 65_536)
      throw new ApiError('送信内容が大きすぎます。', 413);
    const body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || typeof body.action !== 'string')
      throw new ApiError('操作を確認してください。');
    if (
      body.action === 'bootstrap' ||
      body.action === 'login' ||
      body.action === 'acceptInvite'
    ) {
      const result =
        body.action === 'bootstrap'
          ? await bootstrap(body)
          : body.action === 'login'
            ? await login(body)
            : await acceptInvite(body);
      return json(
        { ok: true },
        200,
        await createSession(result.userId, request),
      );
    }
    if (body.action === 'logout') {
      await deleteSession(request);
      return json({ ok: true }, 200, expiredSessionCookie(request));
    }
    const user = await currentUser(request);
    if (!user) throw new ApiError('ログインしてください。', 401);
    const result = await performAction(
      user,
      body.action,
      body,
      new URL(request.url).origin,
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
