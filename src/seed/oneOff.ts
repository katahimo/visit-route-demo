// 単発のデモデータ（PRD D380。ADR-0073）：ベビーシッター型の架空の事業所。今日から2週間分の単発の予約（繰り返しは無い）と、
// 架空のお客様・シッター。担当は seed の手作業らしい割当（generateDay）で決め、乱数・現在時刻は使わない（同じ日付なら同じデータ）。
// 位置は仙台市の公共施設のおおよその場所。実在の人・住所は使わない
import type { DemoData } from '../contracts/data';
import type { Client, Staff, Visit } from '../contracts/documents';
import { EMPTY_REFERRER } from '../contracts/documents';
import { DEFAULT_TERMS } from '../domain/terms';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { createBlankData, ONE_OFF_VISIT_TYPES } from './blank';
import { datesFrom, generateDay } from './generate';

/** 単発のデモの日数（今日から） */
export const ONE_OFF_DEMO_DAYS = 14;
/** 単発のデモの事業所名 */
export const ONE_OFF_DEMO_NAME = 'デモのシッター事業所（架空）';

type SitterSeed = { id: string; name: string; address: string; lat: number; lng: number; workDays: number[] };
type FamilySeed = { id: string; name: string; kana: string; address: string; lat: number; lng: number; note: string };

const SITTERS: SitterSeed[] = [
  {
    id: 'b1',
    name: '駅前 ひなた',
    address: '仙台市青葉区中央1丁目（仙台駅）',
    lat: 38.2601,
    lng: 140.8824,
    workDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'b2',
    name: '公園 こはる',
    address: '仙台市青葉区桜ケ丘（桜ケ丘公園）',
    lat: 38.2965,
    lng: 140.8466,
    workDays: [0, 1, 2, 3, 6],
  },
  {
    id: 'b3',
    name: '水族館 いるか',
    address: '仙台市宮城野区中野（うみの杜水族館）',
    lat: 38.2681,
    lng: 140.9611,
    workDays: [2, 3, 4, 5, 6],
  },
  {
    id: 'b4',
    name: '科学館 まなぶ',
    address: '仙台市青葉区台原（仙台市科学館）',
    lat: 38.2846,
    lng: 140.8961,
    workDays: [0, 1, 2, 4, 5, 6],
  },
];

const FAMILIES: FamilySeed[] = [
  {
    id: 'k1',
    name: '桜ケ丘 そら',
    kana: 'さくらがおか そら',
    address: '仙台市青葉区桜ケ丘（桜ケ丘公園の近く）',
    lat: 38.2958,
    lng: 140.8479,
    note: '3歳。昼寝は13時ごろ',
  },
  {
    id: 'k2',
    name: '錦町 あおい',
    kana: 'にしきまち あおい',
    address: '仙台市青葉区錦町（錦町公園の近く）',
    lat: 38.2715,
    lng: 140.8742,
    note: '',
  },
  {
    id: 'k3',
    name: '五橋 りく',
    kana: 'いつつばし りく',
    address: '仙台市青葉区五橋（五橋駅の近く）',
    lat: 38.2549,
    lng: 140.8791,
    note: '食物アレルギーあり（卵）',
  },
  {
    id: 'k4',
    name: '北山 ひまり',
    kana: 'きたやま ひまり',
    address: '仙台市青葉区北山（輪王寺の近く）',
    lat: 38.2791,
    lng: 140.8504,
    note: '',
  },
  {
    id: 'k5',
    name: '南光台 かなた',
    kana: 'なんこうだい かなた',
    address: '仙台市泉区南光台（南光台駅の近く）',
    lat: 38.3012,
    lng: 140.9008,
    note: '2歳と5歳の兄弟',
  },
  {
    id: 'k6',
    name: '八幡 めい',
    kana: 'はちまん めい',
    address: '仙台市青葉区八幡（大崎八幡宮の近く）',
    lat: 38.2693,
    lng: 140.8543,
    note: '',
  },
];

/** その日の予約の数（日の番号を7で割った余りで決める。1〜3件） */
const PER_DAY = [2, 3, 2, 3, 2, 2, 1];
/** 1日の中の開始時刻（j 番目の予約）と所要（分）の並び */
const STARTS = ['09:00', '12:30', '15:00'];
const MINUTES = [90, 120, 150];
/** 開始（遅）は開始（早）の30分後（幅の中で開始する予約） */
const WINDOW_MINUTES = 30;

const sitters = (): Staff[] =>
  SITTERS.map((s) => ({
    id: s.id,
    name: s.name,
    home: { address: s.address, lat: s.lat, lng: s.lng },
    travelMode: 'DRIVE' as const,
    workDays: s.workDays,
    shiftStart: '08:00',
    shiftEnd: '18:00',
    active: true,
    traits: { qualification: ['保育士'], specialty: ['子ども'], smoker: false, petOk: true },
    requirements: [],
    preferences: [],
    lastDay: null,
    email: '',
    icon: '',
  }));

const families = (): Client[] =>
  FAMILIES.map((f, i) => ({
    id: f.id,
    displayName: f.name,
    kana: f.kana,
    place: { address: f.address, lat: f.lat, lng: f.lng, postalCode: '' },
    note: f.note,
    color: i % 8,
    active: true,
    traits: { pet: false, smoking: false, target: '子ども' },
    requirements: [],
    preferences: [],
    tentative: false,
    entryNote: '',
    keyNote: '',
    parkingNote: '',
    cautionNote: '',
    allowedStaffIds: [],
    stage: 'active' as const,
    referrer: { ...EMPTY_REFERRER },
  }));

/** 今日から14日分の単発の予約（担当はまだ無い）。i 日目の j 番目は 家族 (i + 2j) 番（同じ日に同じお客様は重ならない） */
function bookings(today: string): Visit[] {
  const typeId = ONE_OFF_VISIT_TYPES[0]!.id;
  return datesFrom(today, ONE_OFF_DEMO_DAYS).flatMap((date, i) =>
    Array.from({ length: PER_DAY[i % PER_DAY.length]! }, (_, j): Visit => {
      const start = STARTS[j]!;
      return {
        id: `${date}_o${j + 1}`,
        date,
        clientId: FAMILIES[(i + 2 * j) % FAMILIES.length]!.id,
        windowKind: 'window',
        earliestStart: start,
        latestStart: minutesToHhmm(hhmmToMinutes(start) + WINDOW_MINUTES),
        durationMinutes: MINUTES[(i + j) % MINUTES.length]!,
        staffId: null,
        start: null,
        pinned: false,
        cancelled: false,
        note: '',
        typeId,
        pattern: null,
        cancelKind: null,
      };
    }),
  );
}

/**
 * 単発のデモデータ（呼び名はお客様／シッター）。今日から14日分の単発の予約を、seed の割当で担当付きにしたもの。
 * 繰り返し・伝えた記録は無い。features は機能の入り切り（既定は呼ぶ側の「単発のみ」）
 */
export function createOneOffDemoData(today: string, features: DemoData['org']['features']): DemoData {
  const base = createBlankData(
    today,
    { industry: 'sitter', terms: DEFAULT_TERMS.sitter, features, name: ONE_OFF_DEMO_NAME },
    ONE_OFF_VISIT_TYPES,
  );
  const staff = sitters();
  const clients = families();
  const all = bookings(today);
  const visits = datesFrom(today, ONE_OFF_DEMO_DAYS).flatMap((date) => {
    const day = generateDay(
      date,
      all.filter((v) => v.date === date),
      staff,
      clients,
      base.compat,
    );
    return day.visits;
  });
  return { ...base, staff, clients, visits, availability: [] };
}
