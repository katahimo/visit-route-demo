// 直前のエラーの控え（ご意見に付けて、あとで直すときの手がかりにする。PRD D449）。このタブを開いてからの最大 MAX 件を覚え、外へは送らない。
// window と console に手を入れるので lib ではなくここに置く
import type { FeedbackError } from '../contracts/feedback';

const MAX = 10;
const MESSAGE_MAX = 300;
const STACK_MAX = 600;

const text = (v: unknown): string => (v instanceof Error ? v.message : String(v));

/** 控えを1つ作る（画面全体では下の errorLog を使う） */
export function createErrorLog() {
  const log: FeedbackError[] = [];
  /** 1件覚える（古いものから捨てる。長い文は切る） */
  const record = (kind: FeedbackError['kind'], error: unknown, at: number = Date.now()): void => {
    const stack = error instanceof Error ? error.stack : undefined;
    log.push({
      at,
      kind,
      message: text(error).slice(0, MESSAGE_MAX),
      ...(stack ? { stack: stack.slice(0, STACK_MAX) } : {}),
    });
    if (log.length > MAX) log.shift();
  };
  return {
    record,
    /** 新しい順の控え */
    recent: (): FeedbackError[] => [...log].reverse(),
    /** window の error・unhandledrejection と console.error を覚え始める（起動時に1回） */
    install(target: Window & typeof globalThis = window): void {
      target.addEventListener('error', (e) => record('error', e.error ?? e.message));
      target.addEventListener('unhandledrejection', (e) => record('unhandledrejection', e.reason));
      const original = target.console.error.bind(target.console);
      target.console.error = (...args: unknown[]) => {
        record('console', args.map(text).join(' '));
        original(...args);
      };
    },
  };
}

/** 画面全体で1つ */
export const errorLog = createErrorLog();
