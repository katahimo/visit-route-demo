// 意見の報告（HTML）をパスワードで閉じる（PRD D450。ADR-0114）。出すのは1つの HTML で、ブラウザで開いてパスワードを入れると中身が出る。
// 鍵は PBKDF2（SHA-256）で作り、AES-GCM（256ビット）で暗号にする（ブラウザの Web Crypto だけ。外へは何も送らない）。
// salt・iv は呼ぶ側が乱数で作って渡す（ここでは乱数を作らない）

/** 鍵を作る繰り返しの回数 */
export const SEAL_ITERATIONS = 310000;

const toBase64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** 開く側のスクリプト（閉じたファイルの中に入れる。D は salt・iv・回数・暗号文） */
const OPEN_SCRIPT = `
const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
const msg = document.getElementById('msg');
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.crypto || !crypto.subtle) {
    msg.textContent = 'このファイルを保存してから、ブラウザ（Chrome・Edge・Safari など）で開いてください。';
    return;
  }
  msg.textContent = '開いています…';
  try {
    const pw = new TextEncoder().encode(document.getElementById('pw').value);
    const base = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b(D.s), iterations: D.n, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(D.i) }, key, b(D.c));
    const html = new TextDecoder().decode(plain);
    document.open();
    document.write(html);
    document.close();
  } catch {
    msg.textContent = 'パスワードが違います。';
  }
});`;

/**
 * html をパスワードで閉じた HTML を返す。salt は16バイト、iv は12バイトの乱数（呼ぶたびに新しく作る）
 */
export async function sealHtml(
  html: string,
  password: string,
  x: { salt: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; title: string },
): Promise<string> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: x.salt, iterations: SEAL_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: x.iv }, key, enc.encode(html)));
  const data = JSON.stringify({ s: toBase64(x.salt), i: toBase64(x.iv), n: SEAL_ITERATIONS, c: toBase64(cipher) });
  const title = x.title.replace(/[<>&"]/g, '');
  return [
    '<!doctype html>',
    '<html lang="ja"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:16px;line-height:1.7}',
    'input,button{font-size:1rem;padding:8px 10px}input{width:100%;box-sizing:border-box;margin:6px 0 10px}</style></head><body>',
    `<h1 style="font-size:1.2rem">${title}</h1>`,
    '<p>パスワードを入れて開きます。</p>',
    '<form id="f"><label for="pw">パスワード</label><input id="pw" type="password" autofocus>',
    '<button type="submit">開く</button></form><p id="msg" role="status"></p>',
    `<script>const D = ${data};${OPEN_SCRIPT}</script>`,
    '</body></html>',
  ].join('\n');
}
