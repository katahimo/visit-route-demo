import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { ConfirmProvider } from './components/ConfirmDialog';
import { errorLog } from './components/errorLog';
import { FeedbackButton } from './components/FeedbackButton';
import { FirstRunGate } from './components/FirstRunPage';
import { ToastProvider } from './components/Toast';
import { DemoDataProvider, reset } from './store';

// 直前のエラーを控え、ご意見に付ける（PRD D449。外へは送らない）
errorLog.install();

/** データの読み込みそのものが失敗したとき：初期状態に戻して読み直す（デモを組む印は store が sessionStorage に置き、読み直したあとの起動で読む。PRD D409） */
function resetAndReload() {
  try {
    reset();
  } catch (e) {
    console.error(e);
  }
  // 保存は間引いているので、書き終わるのを少し待ってから読み直す
  setTimeout(() => location.reload(), 500);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onReset={resetAndReload}>
      <DemoDataProvider>
        <HashRouter>
          <ToastProvider>
            {/* 独自の確認ダイアログ（PRD D146。ブラウザの confirm の代わり） */}
            <ConfirmProvider>
              {/* 最初の2問（PRD D379）：保存データが無い初回・設定からのやり直しのあいだは、本体の代わりに2問を出す */}
              <FirstRunGate>
                <App />
              </FirstRunGate>
              {/* 画面への意見のボタン（PRD D449。ADR-0114）：最初の2問の画面でも出す */}
              <FeedbackButton />
            </ConfirmProvider>
          </ToastProvider>
        </HashRouter>
      </DemoDataProvider>
    </ErrorBoundary>
  </StrictMode>,
);
