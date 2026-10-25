// 全体のブックの読み込み（importWorkbook）の共通の状態と、名前 → ID の引き方。
// シートごとの readXxx(ctx) が ctx に読んだ名前の対応を足し、あとのシートがそれで参照を引く（シートの読み込み順が要る）
import type ExcelJS from 'exceljs';
import type { DemoData } from '../contracts/data';
import type { Terms } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import type { Errors, Row } from './reader';
import { FIXED_SHEETS, type personSheetNames } from './text';

/** 全体のブックの読み込みの状態（ブック・エラーの蓄積・いまある ID・読んだ名前 → ID の対応） */
export interface BookCtx {
  wb: ExcelJS.Workbook;
  base: DemoData;
  errors: Errors;
  terms: Terms;
  /** 〈スタッフ〉・〈利用者さん〉のシート名（呼び方から決まる） */
  names: ReturnType<typeof personSheetNames>;
  /** いまある ID（新しい ID と重ならないように。新しく採った ID も足す） */
  used: Set<string>;
  /** 読んだ項目（〈スタッフ〉・〈利用者さん〉・種類の列を結びつける） */
  items: Item[];
  /** 〈スタッフ〉の名前 → ID */
  staffByName: Map<string, string>;
  /** 〈利用者さん〉の表示名 → ID */
  clientByName: Map<string, string>;
  /** 種類の名前 → ID */
  typeByName: Map<string, string>;
  /** 種類のシートがあるか（無い古いブックは種類なし） */
  hasTypes: boolean;
  /** 定期パターンのシートがあるか（無い古いブックはパターンなし） */
  hasPatterns: boolean;
  /** 読めたパターンの ID（訪問の参照を確かめる） */
  patternIds: Set<string>;
}

/** 〈スタッフ〉の名前 → ID（空は required なら エラーにして undefined、でなければ null。いない名前はエラーにして undefined） */
export function staffId(ctx: BookCtx, r: Row, h: string, required: boolean): string | null | undefined {
  const t = r.text(h);
  if (t === '') {
    if (required) r.err(h, `${ctx.terms.staff}の名前を書いてください`);
    return required ? undefined : null;
  }
  const id = ctx.staffByName.get(t);
  if (id === undefined) {
    r.err(h, `「${t}」という${ctx.terms.staff}は、シート『${ctx.names.staff}』にいません`);
    return undefined;
  }
  return id;
}

/** 〈利用者さん〉の表示名 → ID（空・いない名前はエラーにして undefined） */
export function clientId(ctx: BookCtx, r: Row, h: string): string | undefined {
  const t = r.text(h);
  if (t === '') {
    r.err(h, `${ctx.terms.client}の表示名を書いてください`);
    return undefined;
  }
  const id = ctx.clientByName.get(t);
  if (id === undefined) r.err(h, `「${t}」という${ctx.terms.client}は、シート『${ctx.names.client}』にいません`);
  return id;
}

/** 種類の名前 → ID（空＝null。いない名前はエラーにして undefined） */
export function typeId(ctx: BookCtx, r: Row, h: string): string | null | undefined {
  const t = r.text(h);
  if (t === '') return null;
  const id = ctx.typeByName.get(t);
  if (id === undefined) {
    r.err(
      h,
      ctx.hasTypes
        ? `「${t}」という種類は、シート『${FIXED_SHEETS.visitTypes}』にありません`
        : `「${t}」という種類はありません（シート『${FIXED_SHEETS.visitTypes}』がありません）`,
    );
    return undefined;
  }
  return id;
}
