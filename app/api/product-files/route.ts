import { env } from 'cloudflare:workers';

import { ApiError } from '@/lib/app-api';
import { currentUser, database, randomToken } from '@/lib/auth';

export const runtime = 'edge';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function failure(error: unknown): Response {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  console.error('Product file API error:', error);
  return json(
    { error: '資料を処理できませんでした。時間をおいて再試行してください。' },
    500,
  );
}

function filesBucket(): R2Bucket {
  if (!env.FILES) throw new Error('R2 binding FILES is unavailable.');
  return env.FILES;
}

function verifyOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError('不正な送信元です。', 403);
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[\\/\r\n]/g, '_')
      .trim()
      .slice(0, 240) || 'document.pdf'
  );
}

function encodedFileName(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function POST(request: Request): Promise<Response> {
  let objectKey: string | null = null;
  try {
    verifyOrigin(request);
    const user = await currentUser(request);
    if (!user) throw new ApiError('ログインしてください。', 401);
    if (!user.teamId)
      throw new ApiError('部隊に所属する利用者のみ資料を追加できます。', 403);
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_FILE_SIZE + 256 * 1024)
      throw new ApiError('PDFは10MB以内にしてください。', 413);

    const form = await request.formData();
    const productId = Number(form.get('productId'));
    const file = form.get('file');
    if (!Number.isSafeInteger(productId) || productId <= 0)
      throw new ApiError('商材を確認してください。');
    if (!(file instanceof File) || file.size === 0)
      throw new ApiError('PDFを選択してください。');
    if (file.size > MAX_FILE_SIZE)
      throw new ApiError('PDFは10MB以内にしてください。', 413);
    if (!file.name.toLocaleLowerCase('ja-JP').endsWith('.pdf'))
      throw new ApiError('PDFファイルを選択してください。');
    const signature = new TextDecoder().decode(
      await file.slice(0, 5).arrayBuffer(),
    );
    if (signature !== '%PDF-')
      throw new ApiError('PDFファイルの内容を確認してください。');

    const product = await database()
      .prepare('SELECT team_id AS teamId FROM catalog_products WHERE id = ?')
      .bind(productId)
      .first<{ teamId: number }>();
    if (!product) throw new ApiError('商材が見つかりません。', 404);
    if (product.teamId !== user.teamId)
      throw new ApiError('他部隊の商材には資料を追加できません。', 403);

    const fileName = safeFileName(file.name);
    objectKey = `product-materials/${productId}/${randomToken()}.pdf`;
    await filesBucket().put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { fileName },
    });
    const inserted = await database()
      .prepare(
        'INSERT INTO product_attachments (product_id, uploaded_by, file_name, content_type, size_bytes, object_key) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(
        productId,
        user.id,
        fileName,
        'application/pdf',
        file.size,
        objectKey,
      )
      .first<{ id: number }>();
    if (!inserted) throw new Error('Attachment metadata was not saved.');
    return json({ ok: true, id: inserted.id });
  } catch (error) {
    if (objectKey && env.FILES)
      await env.FILES.delete(objectKey).catch(() => undefined);
    return failure(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await currentUser(request);
    if (!user) throw new ApiError('ログインしてください。', 401);
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new ApiError('資料を確認してください。');
    const attachment = await database()
      .prepare(
        'SELECT file_name AS fileName, content_type AS contentType, object_key AS objectKey FROM product_attachments WHERE id = ?',
      )
      .bind(id)
      .first<{
        fileName: string;
        contentType: string;
        objectKey: string;
      }>();
    if (!attachment) throw new ApiError('資料が見つかりません。', 404);
    const object = await filesBucket().get(attachment.objectKey);
    if (!object) throw new ApiError('資料が見つかりません。', 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': attachment.contentType,
        'Content-Length': String(object.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName(attachment.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return failure(error);
  }
}
