// 直前のエラーの控え（ご意見に付けて、あとで直すときの手がかりにする。PRD D449）。このタブを開いてからの最大 MAX 件を覚え、外へは送らない
import type { FeedbackError } from '../contracts/feedback';

const MAX = 10;
const MESSAGE_MAX = 300;
const STACK_MAX = 600;
const log: FeedbackError[] = [];

const text = (v: unknown): string => (v instanceof Error ? v.message : String(v));

/** 1件覚える（古いものから捨てる。長い文は切る） */
export function recordError(kind: FeedbackError['kind'], error: unknown, at: number = Date.now()): void {
  const stack = error instanceof Error ? error.stack : undefined;
  log.push({
    at,
    kind,
    message: text(error).slice(0, MESSAGE_MAX),
    ...(stack ? { stack: stack.slice(0, STACK_MAX) } : {}),
  });
  if (log.length > MAX) log.shift();
}

/** 新しい順の控え */
export const recentErrors = (): FeedbackError[] => [...log].reverse();

/** 控えを空にする（テスト用） */
export const clearErrors = (): void => {
  log.length = 0;
};

/** window の error・unhandledrejection と console.error を覚え始める（起動時に1回） */
export function installErrorLog(target: Window & typeof globalThis = window): void {
  target.addEventListener('error', (e) => recordError('error', e.error ?? e.message));
  target.addEventListener('unhandledrejection', (e) => recordError('unhandledrejection', e.reason));
  const original = target.console.error.bind(target.console);
  target.console.error = (...args: unknown[]) => {
    recordError('console', args.map(text).join(' '));
    original(...args);
  };
}
