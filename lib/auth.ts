import { env } from 'cloudflare:workers';

export type AppRole = 'global_admin' | 'team_admin' | 'member';
export type AppUser = {
  id: number;
  email: string;
  name: string;
  role: AppRole;
  teamId: number | null;
  disabled: number;
};

const encoder = new TextEncoder();
const SESSION_DAYS = 7;
// Cloudflare Workers Web Crypto accepts at most 100,000 PBKDF2 iterations.
const PASSWORD_ROUNDS = 100_000;

export function database(): D1Database {
  if (!env.DB)
    throw new Error(
      'D1 binding DB is unavailable. Apply migrations and configure DB before starting the app.',
    );
  return env.DB;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function tokenHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128)
    throw new Error('パスワードは12～128文字で入力してください。');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PASSWORD_ROUNDS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return `pbkdf2$${PASSWORD_ROUNDS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, roundsText, saltText, digestText] = stored.split('$');
  if (algorithm !== 'pbkdf2' || !roundsText || !saltText || !digestText)
    return false;
  const rounds = Number(roundsText);
  if (!Number.isInteger(rounds) || rounds !== PASSWORD_ROUNDS)
    return false;
  const salt = base64ToBytes(saltText);
  const expected = base64ToBytes(digestText);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as Uint8Array<ArrayBuffer>,
        iterations: rounds,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  );
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++)
    difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function sessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)gup_session=([^;]+)/);
  return match?.[1] ?? null;
}

export async function currentUser(request: Request): Promise<AppUser | null> {
  const token = sessionCookie(request);
  if (!token) return null;
  const hash = await tokenHash(token);
  const row = await database()
    .prepare(
      'SELECT u.id, u.email, u.name, u.role, u.team_id AS teamId, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1',
    )
    .bind(hash, new Date().toISOString())
    .first<AppUser>();
  return row && !row.disabled ? row : null;
}

export async function createSession(
  userId: number,
  request: Request,
): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86_400_000,
  ).toISOString();
  await database()
    .prepare(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    )
    .bind(userId, await tokenHash(token), expiresAt)
    .run();
  return `gup_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export async function deleteSession(request: Request): Promise<void> {
  const token = sessionCookie(request);
  if (token)
    await database()
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await tokenHash(token))
      .run();
}

export function expiredSessionCookie(request: Request): string {
  return `gup_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export function checkOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error('不正な送信元です。');
  if (
    !(request.headers.get('content-type') ?? '').startsWith('application/json')
  )
    throw new Error('JSON形式で送信してください。');
}

export function bootstrapTokenConfigured(): boolean {
  return !!env.BOOTSTRAP_TOKEN && env.BOOTSTRAP_TOKEN.length >= 24;
}

export async function validBootstrapToken(value: string): Promise<boolean> {
  const configured = env.BOOTSTRAP_TOKEN;
  if (!configured || configured.length < 24) return false;
  const provided = await tokenHash(value);
  const expected = await tokenHash(configured);
  return provided === expected;
}
