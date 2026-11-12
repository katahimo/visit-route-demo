import { describe, expect, it } from 'vitest';
import { SEAL_ITERATIONS, sealHtml } from './feedbackSeal';

const fromBase64 = (x: string) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));

/** 閉じたファイルの中の D（salt・iv・回数・暗号文）を取り出して、開く側と同じ手順で開く */
async function open(sealed: string, password: string): Promise<string> {
  const m = /const D = (\{.*?\});/.exec(sealed);
  if (!m) throw new Error('D が無い');
  const d = JSON.parse(m[1]!) as { s: string; i: string; n: number; c: string };
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(d.s), iterations: d.n, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(d.i) }, key, fromBase64(d.c));
  return new TextDecoder().decode(plain);
}

describe('sealHtml（意見の報告をパスワードで閉じる）', () => {
  const salt = new Uint8Array(16).fill(7);
  const iv = new Uint8Array(12).fill(9);
  const html = `<html><body>利用者さんの名前 ${'あ'.repeat(50000)}</body></html>`;

  it('中身は読めず、同じパスワードで元の HTML に戻る', async () => {
    const sealed = await sealHtml(html, 'あいことば-1234', { salt, iv, title: '意見' });
    expect(sealed).not.toContain('利用者さんの名前');
    expect(sealed).toContain(`"n":${SEAL_ITERATIONS}`);
    expect(await open(sealed, 'あいことば-1234')).toBe(html);
  });
  it('違うパスワードでは開けない', async () => {
    const sealed = await sealHtml(html, 'あいことば-1234', { salt, iv, title: '意見' });
    await expect(open(sealed, 'あいことば-1235')).rejects.toThrow();
  });
  it('見出しにタグを入れない', async () => {
    const sealed = await sealHtml('x', 'password', { salt, iv, title: '<script>意見</script>' });
    expect(sealed).toContain('<title>script意見/script</title>');
  });
});
