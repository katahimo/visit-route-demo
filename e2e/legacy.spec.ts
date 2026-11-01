// e2e の包み（ADR-0029・ADR-0041）：scripts/e2e-*.cjs を同じプロセスで読み、出している段（steps）を test.step で回す。
// 確かめ（check）の1つずつを expect.soft に写す（名前はそのまま）。ページのエラー（pageerror）も expect.soft。
// Playwright は @playwright/test と同じもの（playwright-core）なので、スクリプトが開いた文脈にも trace が付く。動画は env.cjs の hooks で足す
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
// require.cache の鍵は実際の場所（シンボリックリンクを解いた道）なので、消すときに合うよう実際の場所にそろえる
const SCRIPTS_DIR = realpathSync(path.resolve(import.meta.dirname, '../scripts'));
/** 速さの上限を見るスクリプト（perf の project で1本ずつ走らせる） */
const PERF = new Set(['compat', 'nav', 'progress', 'vacancy-steps', 'details']);
/** 確かめの名前に添える情報の長さの上限（報告が読めなくならないように） */
const INFO_MAX = 400;

const files = readdirSync(SCRIPTS_DIR)
  .filter((f) => /^e2e-.+\.cjs$/.test(f))
  .sort();

type Step = [string, () => Promise<unknown> | unknown];
type Lib = {
  hooks: {
    onCheck: ((ok: boolean, name: string, info: string) => void) | null;
    onNote: ((text: string) => void) | null;
    videoDir: string;
  };
  pageErrors: string[];
  closeBrowsers: () => Promise<void>;
};

/** scripts/ の読み込みを消す（スクリプトと共通の部品は test ごとに読み直し、数え・状態を持ち越さない） */
function forgetScripts() {
  for (const k of Object.keys(require.cache)) if (k.startsWith(SCRIPTS_DIR + path.sep)) delete require.cache[k];
}

/** 今の test の後始末（時間切れでも afterEach で必ず閉じる） */
let current: { lib: Lib | null; log: string[]; restore: () => void; name: string; videoDir: string } | null = null;

/** console.log・console.error を記録に移す（並列の list の報告に何千行も流さない） */
function captureConsole(log: string[]) {
  const orig = { log: console.log, error: console.error };
  const put = (...a: unknown[]) => {
    log.push(
      a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? (x.stack ?? String(x)) : String(x))).join(' '),
    );
  };
  console.log = put;
  console.error = put;
  return () => {
    console.log = orig.log;
    console.error = orig.error;
  };
}

/** 動画を残すか（config の use.video） */
function videoMode(): string {
  const v = test.info().project.use.video as unknown;
  if (!v) return 'off';
  return typeof v === 'string' ? v : ((v as { mode?: string }).mode ?? 'off');
}

async function runInProcess(file: string, name: string, base: string) {
  const testInfo = test.info();
  forgetScripts();
  process.env.BASE = base;
  process.env.OUT_DIR = testInfo.outputPath('shots');
  process.env.E2E_SCRIPT = `e2e-${name}`;
  const log: string[] = [];
  const videoDir = videoMode() === 'off' ? '' : testInfo.outputPath('videos');
  current = { lib: null, log, restore: captureConsole(log), name, videoDir };
  const { steps } = require(path.join(SCRIPTS_DIR, file)) as { steps: Step[] };
  const lib = require(path.join(SCRIPTS_DIR, 'lib/env.cjs')) as Lib;
  current.lib = lib;
  lib.hooks.onNote = (text) => testInfo.annotations.push({ type: '注記', description: text });
  lib.hooks.videoDir = videoDir;
  lib.hooks.onCheck = (ok, checkName, info) => {
    const more = info.length > INFO_MAX ? `${info.slice(0, INFO_MAX)}…` : info;
    expect.soft(ok, more ? `${checkName}  ${more}` : checkName).toBe(true);
  };
  for (const [stepName, fn] of steps) {
    await test.step(stepName, async () => {
      await fn();
    });
  }
  expect.soft(lib.pageErrors, 'ページのエラー（pageerror）が無い').toEqual([]);
}

/** 後始末：ブラウザを閉じ、記録・失敗のスクリーンショット・動画を添付する */
test.afterEach(async () => {
  const c = current;
  current = null;
  if (!c) return;
  const testInfo = test.info();
  try {
    await c.lib?.closeBrowsers();
  } finally {
    c.restore();
    if (c.lib) {
      c.lib.hooks.onCheck = null;
      c.lib.hooks.onNote = null;
    }
  }
  const logPath = testInfo.outputPath(`${c.name}.log`);
  mkdirSync(path.dirname(logPath), { recursive: true });
  writeFileSync(logPath, `${c.log.join('\n')}\n`);
  await testInfo.attach(`${c.name}.log`, { path: logPath, contentType: 'text/plain' });
  const failed = testInfo.status !== testInfo.expectedStatus;
  const shots = testInfo.outputPath('shots');
  if (failed && existsSync(shots)) {
    for (const f of readdirSync(shots).filter((f) => f.includes('-fail-')))
      await testInfo.attach(f, { path: path.join(shots, f), contentType: 'image/png' });
  }
  if (c.videoDir && existsSync(c.videoDir)) {
    const keep = failed || videoMode() === 'on';
    if (keep) {
      for (const f of readdirSync(c.videoDir))
        await testInfo.attach(`video-${f}`, { path: path.join(c.videoDir, f), contentType: 'video/webm' });
    } else rmSync(c.videoDir, { recursive: true, force: true });
  }
});

for (const file of files) {
  const name = file.replace(/^e2e-/, '').replace(/\.cjs$/, '');
  test(`${file}${PERF.has(name) ? ' @perf' : ''}`, async () => {
    const base = test.info().project.use.baseURL;
    if (!base) throw new Error('baseURL がありません（playwright.config.ts の use.baseURL）');
    // 初期データから AI で組んだ結果（scripts/lib/plan.cjs の planDays の cache）を、同じ実行のスクリプトで分け合う。
    // test-results の下なので実行のたびに消える
    process.env.E2E_PLAN_CACHE_DIR = path.join(test.info().project.outputDir, '.plan-cache');
    await runInProcess(file, name, base);
  });
}
