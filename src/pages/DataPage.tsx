import { Database, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useDemoData } from '../store';
import './settings.css';
import '../components/features.css';
import { SettingsTabs } from '../components/SettingsTabs';
import { BookingCard } from './dataBookings';
import { ExcelCard } from './dataExcel';
import { BackupCard, PrevCard, SaveErrorCard, TermsCard, TidyCard } from './dataParts';
import { RestartCard } from './RestartCard';
import { useDataBackup, useDataRestore, useLastExport } from './useDataBackup';
import { useDataExcel } from './useDataExcel';
import { useDataTidy } from './useDataTidy';

/**
 * データ：書き出し・読み込み（控えの JSON・Excel）・初期状態に戻す（D2・D3・D23）。
 * 区画ごとの部品（dataParts・dataExcel）と、状態と処理の画面専用フック（useData*）に分けている
 */
export default function DataPage() {
  const { data, saveError, previous } = useDemoData();
  const lastExport = useLastExport();
  const excel = useDataExcel({ markExported: lastExport.mark });
  const backup = useDataBackup({ markExported: lastExport.mark });
  const restore = useDataRestore();
  const tidy = useDataTidy();

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <PageHeader
        nav={<SettingsTabs />}
        icon={Database}
        title="データ"
        lead="データの書き出し・読み込み（Excel も）・最初の設定をやり直す"
      />
      <div className="warn-box">
        <TriangleAlert size={20} strokeWidth={2.2} aria-hidden="true" />
        <p>
          データは<strong>このブラウザの中だけ</strong>に保存し、サーバーには送りません。
          実在の人の名前・住所などの個人情報は入れないでください。
        </p>
      </div>
      {saveError && <SaveErrorCard saveError={saveError} onTidy={tidy.goToCard} />}

      {/* 直前の状態に戻す（PRD D227。1世代の控えがあるときだけ） */}
      {previous && <PrevCard previous={previous} onRestore={() => void restore.doRestore()} />}

      <TermsCard />

      <BackupCard
        lastExport={lastExport.last}
        error={backup.error}
        onDownload={backup.download}
        onPick={(f) => void backup.load(f)}
      />

      {/* Excel の入出力の欄はいつも出す（ADR-0106） */}
      <ExcelCard excel={excel} t={data.org.terms} />

      {/* ほかのソフトの予約の CSV（ADR-0075）。Excel・CSV の入出力と一緒にいつも出す */}
      <BookingCard t={data.org.terms} />

      <TidyCard tidy={tidy} />

      {/* 最初の設定をやり直す（ADR-0092） */}
      <RestartCard />
    </div>
  );
}
