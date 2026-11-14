// ご意見を残す画面の状態を記録する（PRD D449。あとで AI・人が直す・再現するときの手がかり）。DOM と環境を読むだけで、書き換えない。
// データの中身（〈利用者さん〉・スタッフの一覧の行・住所）と入力欄の中身は入れず、一覧は件数だけ。
// 見出し・操作中の部品の文字は画面に出ている文をそのまま写すので、名前が入りうる（画像と同じく、パスワードで閉じたファイルの中だけに入る）

import type { DemoData } from '../contracts/data';
import type { FeedbackMeta } from '../contracts/feedback';
import { NO_CAPTURE_ATTR } from './captureScreen';
import { errorLog } from './errorLog';

const clip = (s: string | null | undefined, n: number): string => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

const visible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

/** 配列の一覧の件数（キーの名前 → 件数）。入れ子の record は件数だけ */
export function dataCounts(data: DemoData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) out[k] = v.length;
    else if (v && typeof v === 'object' && k !== 'org' && k !== 'compat' && k !== 'roads')
      out[k] = Object.keys(v).length;
  }
  return out;
}

function describeActive(): string | null {
  const el = document.activeElement;
  if (!el || el === document.body || el.closest(`[${NO_CAPTURE_ATTR}]`)) return null;
  const parts = [el.tagName.toLowerCase()];
  const testId = el.getAttribute('data-testid');
  if (testId) parts.push(`[data-testid=${testId}]`);
  if (el.id) parts.push(`#${el.id}`);
  const label = el.getAttribute('aria-label');
  if (label) parts.push(`aria-label=${clip(label, 40)}`);
  // 入力欄の中身は入れない（個人情報が入りうる）
  const isField =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
  if (!isField) parts.push(`"${clip(el.textContent, 40)}"`);
  return parts.join(' ');
}

/** 撮る前に呼ぶ（撮っているあいだに画面が変わっても、押したときの状態を残す） */
export function collectFeedbackMeta(data: DemoData, space: string | null): FeedbackMeta {
  const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const testIds = [...document.querySelectorAll('[data-testid]')]
    .filter((el) => !el.closest(`[${NO_CAPTURE_ATTR}]`) && visible(el))
    .map((el) => el.getAttribute('data-testid') ?? '')
    .filter((id, i, all) => id !== '' && all.indexOf(id) === i)
    .slice(0, 40);
  return {
    url: window.location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1, h2')]
      .filter((el) => !el.closest(`[${NO_CAPTURE_ATTR}]`))
      .map((el) => clip(el.textContent, 60))
      .filter((t) => t !== '')
      .slice(0, 12),
    testIds,
    activeElement: describeActive(),
    openDialogs: [...document.querySelectorAll('[role="dialog"]')].filter((el) => !el.closest(`[${NO_CAPTURE_ATTR}]`))
      .length,
    scroll: {
      x: Math.round(window.scrollX),
      y: Math.round(window.scrollY),
      docHeight: Math.round(document.documentElement.scrollHeight),
    },
    env: {
      language: navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      devicePixelRatio: window.devicePixelRatio,
      screen: { width: window.screen.width, height: window.screen.height },
      colorScheme: isDark ? 'dark' : 'light',
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      maxTouchPoints: navigator.maxTouchPoints,
      online: navigator.onLine,
      standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      mode: import.meta.env.MODE,
      space,
    },
    data: { version: data.version, baseDate: data.baseDate, counts: dataCounts(data) },
    recentErrors: errorLog.recent(),
  };
}
