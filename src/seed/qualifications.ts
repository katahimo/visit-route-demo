// 〈スタッフ〉の初期の項目「資格」の選択肢（PRD D422 を置き換え）。
// 職員台帳（excel/staffLedgerCsv）のほかの資格・研修は、台帳を読み込んだとき値のある列だけを選択肢に足す（excel/staffLedgerItems）

/** 資格（7）。理学療法士・作業療法士・言語聴覚士は訪問の種類「リハビリ」の担当に必要（ADR-0012） */
export const QUALIFICATION_OPTIONS: readonly string[] = [
  '介護福祉士',
  '看護師',
  '保育士',
  '初任者研修',
  '理学療法士',
  '作業療法士',
  '言語聴覚士',
];
