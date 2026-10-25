/// <reference types="vitest/config" />

import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const version = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

// GitHub Pages のサブパス（/visit-route-demo/）でも動くよう相対パス。画面の移動は HashRouter
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // 公開リポジトリなのでソースマップも出す（エラーの場所を元のコードで追うため）
  build: { sourcemap: true },
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['src/**/*.test.ts'],
    // test の前にイベントループを1回まわし、worker が親からの返事を読めるようにする（src/testSetup.ts。PRD D254）
    setupFiles: ['src/testSetup.ts'],
    // 重い計算（焼きなまし・Excel）は負荷のあるとき既定の 5秒を超える。CPU の取り合いで遅れるだけなので待つ（PRD D254）。
    // 1つの test の同期の塊が 60秒を超えても worker の連絡（onTaskUpdate）が時間切れになるので、重い test は分ける。
    // 重いファイルは worker 1つで直列になり全体の時間を決めるので、ファイルも分けて並列に回す（evaluate/naive.seed*.test.ts・excel/excel.sheets.test.ts）
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
  },
});
