// 全体のブックの、〈スタッフ〉・〈利用者さん〉・相性のシートを読む（importWorkbook から。ADR-0006）
import { type Client, type Staff, stageOfLegacy } from '../contracts/documents';
import type { Compat } from '../contracts/rules';
import { STAGE_LABELS } from '../lib/clientStage';
import { withTravel } from '../lib/clientTravel';
import type { BookCtx } from './bookContext';
import {
  CLIENT_ALLOWED_COL,
  CLIENT_COLS,
  CLIENT_KANA_COL,
  CLIENT_PLACE2_COLS,
  CLIENT_POSTAL_COL,
  CLIENT_RULE_COLS,
  CLIENT_STAGE_COLS,
  CLIENT_TENTATIVE_COL,
  CLIENT_TRAVEL_COLS,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_ICON_COL,
  STAFF_LAST_DAY_COL,
} from './layout';
import { readPlace2 } from './place2Cols';
import {
  idOf,
  personCols,
  Row,
  readEmail,
  readPerson,
  readPostal,
  readStaffIcon,
  readTravelMinutes,
  type Sheet,
  sheetMsg,
  textOf,
  uniqueName,
} from './reader';
import { FIXED_SHEETS, lookup, nfkc, parseWorkDays, splitList, travelModeLabels } from './text';

const COMPAT_SYMBOLS: Record<string, 2 | 1 | -1 | -2> = {
  '◎': 2,
  '○': 1,
  '◯': 1,
  〇: 1,
  '△': -1,
  '×': -2,
  '✕': -2,
  x: -2,
  X: -2,
};

/** 〈スタッフ〉のシート。名前 → ID を ctx.staffByName に足す（読めない行の名前も足す） */
export function readStaff(ctx: BookCtx, staffSheet: Sheet): Staff[] {
  const staff: Staff[] = [];
  const cols = personCols(staffSheet, ctx.items, 'staff', [
    ...Object.values(STAFF_COLS),
    STAFF_LAST_DAY_COL,
    STAFF_EMAIL_COL,
    STAFF_ICON_COL,
  ]);
  const ids = new Map<string, number>();
  const seen = new Map<string, number>();
  const C = STAFF_COLS;
  for (const r of staffSheet.rows()) {
    const id = idOf(r, C.id, ids, 's', ctx.used, 100);
    const name = r.required(C.name, 50);
    if (name !== null) {
      uniqueName(r, C.name, name, seen);
      ctx.staffByName.set(name, id);
    }
    const mText = r.required(C.travelMode);
    const travelMode = mText === null ? null : lookup(travelModeLabels, mText);
    if (mText !== null && travelMode === null)
      r.err(C.travelMode, `「${Object.values(travelModeLabels).join('」「')}」のどれかで書いてください`);
    const workDays = parseWorkDays(r.text(C.workDays));
    if (workDays === null) r.err(C.workDays, '曜日は「月火水木金」のように書いてください');
    const shiftStart = r.time(C.shiftStart);
    const shiftEnd = r.time(C.shiftEnd);
    const active = r.yes(C.active);
    const address = r.optional(C.address, 200);
    const lat = r.num(C.lat, { min: -90, max: 90 });
    const lng = r.num(C.lng, { min: -180, max: 180 });
    // 最終勤務日（ADR-0015）：列が無い古いブック・空はなし
    const lastDay = r.text(STAFF_LAST_DAY_COL) === '' ? null : r.date(STAFF_LAST_DAY_COL);
    // メールアドレス（ADR-0017）：列が無い古いブック・空は ''。全角は直し、形の合わない値は止める
    const email = readEmail(r, STAFF_EMAIL_COL);
    // アイコン（ADR-0050）：列が無い古いブック・空は ''。前後の空白は落とし、2文字を超えれば止める
    const icon = readStaffIcon(r, STAFF_ICON_COL);
    const p = readPerson(r, cols);
    if (
      email !== null &&
      icon !== null &&
      name !== null &&
      travelMode &&
      workDays &&
      shiftStart &&
      shiftEnd &&
      lat !== undefined &&
      lng !== undefined &&
      (lastDay !== null || r.text(STAFF_LAST_DAY_COL) === '')
    ) {
      staff.push({
        id,
        name,
        home: { address, lat, lng },
        travelMode,
        workDays,
        shiftStart,
        shiftEnd,
        active,
        ...p,
        lastDay,
        email,
        icon,
      });
    }
  }
  return staff;
}

/** 担当できる人（ADR-0014）：列が無い古いブック・空は限らない。いない名前は止める（ok が false） */
function readAllowedStaff(ctx: BookCtx, r: Row): { ids: string[]; ok: boolean } {
  const ids: string[] = [];
  let ok = true;
  for (const name of splitList(r.text(CLIENT_ALLOWED_COL))) {
    const sid = ctx.staffByName.get(name);
    if (sid === undefined) {
      r.err(CLIENT_ALLOWED_COL, `「${name}」という${ctx.terms.staff}は、シート『${ctx.names.staff}』にいません`);
      ok = false;
    } else if (!ids.includes(sid)) ids.push(sid);
  }
  return { ids, ok };
}

/** 〈利用者さん〉のシート。表示名 → ID を ctx.clientByName に足す（読めない行の名前も足す） */
export function readClients(ctx: BookCtx, clientSheet: Sheet): Client[] {
  const clients: Client[] = [];
  const cols = personCols(clientSheet, ctx.items, 'client', [
    ...Object.values(CLIENT_COLS),
    CLIENT_TENTATIVE_COL,
    CLIENT_KANA_COL,
    CLIENT_POSTAL_COL,
    ...Object.values(CLIENT_TRAVEL_COLS),
    ...Object.values(CLIENT_PLACE2_COLS),
    CLIENT_ALLOWED_COL,
    ...Object.values(CLIENT_RULE_COLS),
    ...Object.values(CLIENT_STAGE_COLS),
  ]);
  const ids = new Map<string, number>();
  const seen = new Map<string, number>();
  const C = CLIENT_COLS;
  for (const r of clientSheet.rows()) {
    const id = idOf(r, C.id, ids, 'c', ctx.used, 100);
    const displayName = r.required(C.name, 50);
    if (displayName !== null) {
      uniqueName(r, C.name, displayName, seen);
      ctx.clientByName.set(displayName, id);
    }
    // よみ（PRD D61）：列が無い古いブックは空
    const kana = r.optional(CLIENT_KANA_COL, 50);
    const color = r.num(C.color, { int: true, min: 1, max: 8, required: true });
    const active = r.yes(C.active);
    // 仮押さえ（ADR-0012）：列が無い古いブックは false
    const tentative = r.yes(CLIENT_TENTATIVE_COL);
    // 郵便番号（ADR-0016。readPostal）
    const postalCode = readPostal(r);
    const address = r.optional(C.address, 200);
    const lat = r.num(C.lat, { min: -90, max: 90 });
    const lng = r.num(C.lng, { min: -180, max: 180 });
    // 移動時間（片道・分）・遠方（出張）（ADR-0096）：列が無い古いブック・空は無し
    const travelMinutes = readTravelMinutes(r);
    const farTrip = r.yes(CLIENT_TRAVEL_COLS.farTrip);
    // 期間つきの訪問先（住所2。ADR-0105）：列が無い古いブック・空は無し
    const place2 = readPlace2(r);
    const allowed = readAllowedStaff(ctx, r);
    const note = r.optional(C.note, 500);
    // 訪問先の決まりごと（ADR-0013）：列が無い古いブックは空
    const entryNote = r.optional(CLIENT_RULE_COLS.entry, 200);
    const keyNote = r.optional(CLIENT_RULE_COLS.key, 200);
    const parkingNote = r.optional(CLIENT_RULE_COLS.parking, 200);
    const cautionNote = r.optional(CLIENT_RULE_COLS.caution, 200);
    // 段階（ADR-0015）：列が無い古いブック・空は「利用中」「仮押さえ」から読み替える。active・tentative は repair が段階に合わせる
    const stageText = r.text(CLIENT_STAGE_COLS.stage);
    const stage = stageText === '' ? stageOfLegacy({ active, tentative }) : lookup(STAGE_LABELS, stageText);
    if (stage === null)
      r.err(CLIENT_STAGE_COLS.stage, `「${Object.values(STAGE_LABELS).join('」「')}」のどれかで書いてください`);
    const referrer = {
      name: r.optional(CLIENT_STAGE_COLS.referrer, 50),
      contact: r.optional(CLIENT_STAGE_COLS.referrerContact, 100),
      note: r.optional(CLIENT_STAGE_COLS.referrerNote, 200),
    };
    // 紹介元のメールアドレス（ADR-0017）：列が無い古いブック・空は ''
    const referrerEmail = readEmail(r, CLIENT_STAGE_COLS.referrerEmail);
    const p = readPerson(r, cols);
    if (
      referrerEmail !== null &&
      stage !== null &&
      postalCode !== null &&
      displayName !== null &&
      typeof color === 'number' &&
      lat !== undefined &&
      lng !== undefined &&
      travelMinutes !== undefined &&
      place2 !== null &&
      allowed.ok
    ) {
      clients.push({
        id,
        displayName,
        kana,
        place: withTravel({ address, lat, lng, postalCode }, travelMinutes, farTrip),
        ...(place2 ? { place2 } : {}),
        note,
        color: color - 1,
        active,
        ...p,
        tentative,
        entryNote,
        keyNote,
        parkingNote,
        cautionNote,
        allowedStaffIds: allowed.ids,
        stage,
        referrer: { ...referrer, email: referrerEmail ?? '' },
      });
    }
  }
  return clients;
}

/** 相性のシート（行＝〈利用者さん〉、列＝〈スタッフ〉） */
export function readCompat(ctx: BookCtx, compatSheet: Sheet): Compat {
  const { terms, names } = ctx;
  const compat = new Map<string, Compat[string]>();
  const staffCols: { col: number; id: string; name: string }[] = [];
  for (const h of compatSheet.headers) {
    if (h.col === 1) continue;
    const id = ctx.staffByName.get(h.name);
    if (id === undefined)
      ctx.errors.add(
        sheetMsg(
          FIXED_SHEETS.compat,
          `見出しの「${h.name}」という${terms.staff}は、シート『${names.staff}』にいません`,
        ),
      );
    else staffCols.push({ col: h.col, id, name: h.name });
  }
  const firstHeader = compatSheet.headers.find((h) => h.col === 1)?.name ?? `${terms.client}`;
  const seen = new Map<string, number>();
  for (const n of compatSheet.rowNumbers) {
    const name = textOf(compatSheet.read(n, 1, firstHeader));
    const cells = staffCols.map((s) => ({ s, v: textOf(compatSheet.read(n, s.col, s.name)) }));
    if (name === '' && cells.every((c) => c.v === '')) continue;
    const row = new Row(compatSheet, n);
    if (name === '') {
      row.err(firstHeader, `${terms.client}の表示名を書いてください`);
      continue;
    }
    const cid = ctx.clientByName.get(name);
    if (cid === undefined) {
      row.err(firstHeader, `「${name}」という${terms.client}は、シート『${names.client}』にいません`);
      continue;
    }
    uniqueName(row, firstHeader, name, seen);
    const out = new Map<string, 2 | 1 | -1 | -2>();
    for (const { s, v } of cells) {
      if (v === '') continue;
      const level = COMPAT_SYMBOLS[v] ?? COMPAT_SYMBOLS[nfkc(v)];
      if (level === undefined) row.err(s.name, '◎・○・△・× か空で書いてください');
      else out.set(s.id, level);
    }
    if (out.size > 0) compat.set(cid, Object.fromEntries(out));
  }
  return Object.fromEntries(compat);
}
