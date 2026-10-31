// 入口（実装は store 担当）。画面はここだけを import する。保存・検査の本体は persist.ts、React の Provider は react.tsx
// 循環を避けるため、react.tsx は ./persist を import し、この index は両方を再 export するだけにする

export { ARRANGE_BASIS_KEY, arrangeBasisMemory } from './arrangeBasis';
export { BACKUP_LAST_KEY, BACKUP_REMINDED_KEY, backupMemory, type ExportKind, type LastExport } from './backup';
export { MAIL_SCHEDULE_KEY, type MailScheduleState, mailScheduleMemory } from './mailSchedule';
export { detailsOpenKey, navOpenMemory } from './navOpen';
export * from './persist';
export { DemoDataProvider, type UpdateOptions, useDemoData } from './react';
export { repair } from './repair';
export { FEATURES_START_ALL, FEATURES_START_KEY, startsWithAll } from './start';
export { cancelTentative } from './tentative';
