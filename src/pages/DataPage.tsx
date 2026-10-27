import { Database, TriangleAlert } from 'lucide-react';
import { useTour } from '../components/Tour';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { useDemoData } from '../store';
import './settings.css';
import { SettingsTabs } from '../components/SettingsTabs';
import { ExcelCard } from './dataExcel';
import { BackupCard, PrevCard, ResetCard, SaveErrorCard, TermsCard, TidyCard, TourCard } from './dataParts';
import { useDataBackup, useDataRestore, useLastExport } from './useDataBackup';
import { useDataExcel } from './useDataExcel';
import { useDataTidy } from './useDataTidy';

/**
 * データ：書き出し・読み込み（控えの JSON・Excel）・初期状態に戻す（D2・D3・D23）。
 * 区画ごとの部品（dataParts・dataExcel）と、状態と処理の画面専用フック（useData*）に分けている
 */
export default function DataPage() {
  const { data, saveError, previous } = useDemoData();
  const excelOn = useFeature('excel');
  const openTour = useTour();
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
        lead={`データの書き出し・読み込み${excelOn ? '（Excel も）' : ''}・初期状態に戻す・使い方の案内`}
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

      {/* Excel の入出力を切っていれば欄ごと出さない（控え（JSON）は残す。ADR-0028 の excel） */}
      {excelOn && <ExcelCard excel={excel} t={data.org.terms} />}

      <TidyCard tidy={tidy} />

      <TourCard onOpen={openTour} />

      <ResetCard onReset={restore.doReset} />
    </div>
  );
}
