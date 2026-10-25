import { useState } from 'react';
import { useToast } from '../components/Toast';
import type { Absence, Availability, Staff } from '../contracts/documents';
import { afterLastDay, availabilityOf, type Slot, slotsError, toHalfHours } from '../domain/availability';
import { linkIfOn, suddenHref } from '../lib/links';
import { useDemoData } from '../store';

/** 選んでいるセル（スタッフ×日） */
export type Picked = { staffId: string; date: string };

/**
 * 勤務時間の画面の「セルを選んで直す」状態と処理（選んだセル・下書き・保存・基本に戻す）。
 * staff は在籍中の人、overrides・absences は「スタッフID_日付」をキーにした表
 */
export function useAvailabilityEdit(
  staff: Staff[],
  overrides: Map<string, Availability>,
  absences: Map<string, Absence>,
) {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const toast = useToast();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [draft, setDraft] = useState<Slot[]>([]);
  const pickedStaff = picked ? staff.find((s) => s.id === picked.staffId) : undefined;
  const pickedOverride = picked ? overrides.get(`${picked.staffId}_${picked.date}`) : undefined;
  const pickedAbsence = picked ? absences.get(`${picked.staffId}_${picked.date}`) : undefined;

  /** 最終勤務日の後（ADR-0015）：勤務なしなので上書きを入れても効かない。理由を出して保存させない */
  const retiredWhy =
    picked && pickedStaff && afterLastDay(pickedStaff, picked.date)
      ? `最終勤務日（${pickedStaff.lastDay?.slice(5).replace('-', '/')}）の後は勤務なしです。時間帯を入れても予定に入りません（${terms.staff}の画面で最終勤務日を変えてください）`
      : null;
  /** その日に働くか（保存した時間帯がある・最終勤務日の後でない）。欠勤・キャンセルの欄へのリンクを出すか（PRD D203） */
  const pickedWorks =
    !!picked &&
    !!pickedStaff &&
    !retiredWhy &&
    availabilityOf(pickedStaff, picked.date, pickedOverride).slots.length > 0;
  /** 欠勤・キャンセルの欄を開く URL（欠勤・キャンセルを切っていれば null でリンクを出さない。PRD D213） */
  const absenceHref = picked ? linkIfOn(data.org.features, suddenHref(picked.date, picked.staffId)) : null;
  const pick = (staffId: string, date: string) => {
    const s = staff.find((x) => x.id === staffId);
    if (!s) return;
    setPicked({ staffId, date });
    setDraft(toHalfHours(availabilityOf(s, date, overrides.get(`${staffId}_${date}`)).slots));
  };
  const save = (slots: Slot[]) => {
    if (!picked || slotsError(slots) || retiredWhy) return;
    const a: Availability = { staffId: picked.staffId, date: picked.date, slots };
    update(
      (d) => ({
        ...d,
        availability: [...d.availability.filter((x) => !(x.staffId === a.staffId && x.date === a.date)), a],
      }),
      '勤務時間を変える',
    );
    setDraft(slots);
    toast(slots.length === 0 ? '休みにしました' : '時間帯を保存しました');
  };
  const reset = () => {
    if (!picked || !pickedStaff) return;
    update(
      (d) => ({
        ...d,
        availability: d.availability.filter((x) => !(x.staffId === picked.staffId && x.date === picked.date)),
      }),
      '基本の時間に戻す',
    );
    setDraft(toHalfHours(availabilityOf(pickedStaff, picked.date, null).slots));
    toast('基本の時間に戻しました');
  };

  return {
    picked,
    setPicked,
    draft,
    setDraft,
    pickedStaff,
    pickedOverride,
    pickedAbsence,
    retiredWhy,
    pickedWorks,
    absenceHref,
    pick,
    save,
    reset,
  };
}
