// カレンダーのファイルを読む（PRD D440。ADR-0107）：Google カレンダーの書き出しの zip（中に〈スタッフ〉ごとの .ics）か、
// .ics 1つ。zip の中の .ics でないファイルは読まない。読んだものはこの端末の中だけで使い、外へ送らない
import { type IcsCalendar, parseIcs } from './icsRead';
import { isZip, readZip, ZipReadError } from './zipRead';

/** 読めない理由 */
export const CAL_FILE_ERRORS = {
  noIcs: 'カレンダー（.ics）が入っていません',
  notIcs: 'カレンダーのファイル（.ics か、それをまとめた .zip）を選んでください',
} as const;

/** 読んだ結果：カレンダーの一覧か、読めない理由 */
export type CalendarFileRead = { calendars: IcsCalendar[]; error: null } | { calendars: []; error: string };

const isIcsText = (text: string) => /BEGIN:VCALENDAR/i.test(text.slice(0, 2000));

/** ファイルの中身（バイト）からカレンダーを読む。名前の無いカレンダーは .ics のファイル名を名前にする */
export async function readCalendarFile(bytes: Uint8Array): Promise<CalendarFileRead> {
  const utf8 = new TextDecoder('utf-8');
  if (!isZip(bytes)) {
    const text = utf8.decode(bytes);
    return isIcsText(text)
      ? { calendars: [parseIcs(text)], error: null }
      : { calendars: [], error: CAL_FILE_ERRORS.notIcs };
  }
  try {
    const entries = (await readZip(bytes)).filter((e) => /\.ics$/i.test(e.name));
    const calendars = entries
      .map((e) => {
        const text = utf8.decode(e.bytes);
        if (!isIcsText(text)) return null;
        const cal = parseIcs(text);
        return cal.name === '' ? { ...cal, name: (e.name.split('/').pop() ?? '').replace(/\.ics$/i, '') } : cal;
      })
      .filter((c): c is IcsCalendar => c !== null);
    return calendars.length === 0 ? { calendars: [], error: CAL_FILE_ERRORS.noIcs } : { calendars, error: null };
  } catch (e) {
    if (e instanceof ZipReadError) return { calendars: [], error: e.message };
    throw e;
  }
}
