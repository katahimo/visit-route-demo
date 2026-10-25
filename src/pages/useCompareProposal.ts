// 提案を比べるの「提案を作る」（PRD D159）：考え方（プリセット）を選び、ピンの訪問はそのままで AI で組む。
// 作っている提案の進み具合・止める・日付を変えたら止めて捨てる・画面を離れたら止める
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import { attempt, formError, newId } from '../lib/common';
import type { CompareChoice } from '../lib/compareChoices';
import { aiPinsOf } from '../lib/dayPlan';
import { compile } from '../matching';
import { applyPreset } from '../seed';
import { defaultIterations, runSolve } from '../solver';

/** 作っている提案（名前・進み具合） */
export type Making = { date: string; name: string; iteration: number; total: number };

export type CompareProposal = {
  /** 選んでいる考え方（無ければ undefined） */
  preset: DemoData['presets'][number] | undefined;
  setPresetId: (id: string) => void;
  /** 作っている提案（作っていなければ null） */
  making: Making | null;
  makeError: string | null;
  /** 選んだ考え方で提案を作る。できたら onMade へ */
  makeProposal: () => void;
  /** 作っている計算を止める（途中までの最良で提案を作る） */
  stop: () => void;
  /** 作れないときの理由（作れるなら null） */
  makeWhy: string | null;
};

/**
 * 提案を作る状態と処理。onMade は作った提案と作った日を受け取る（比べる案に足し、A＝今の担当・B＝作った提案に並べる）。
 * 計算の世代：画面を離れる・日付を変えると進め、前の世代の結果は捨てる（日の画面と同じ）
 */
export function useCompareProposal(
  data: DemoData,
  date: string,
  allVisits: readonly Visit[],
  problem: Problem | null,
  onMade: (c: CompareChoice, forDate: string) => void,
): CompareProposal {
  const toast = useToast();
  const terms = data.org.terms;
  const [presetId, setPresetId] = useState('');
  const preset = data.presets.find((p) => p.id === presetId) ?? data.presets[0];
  const [making, setMaking] = useState<Making | null>(null);
  const [makeError, setMakeError] = useState<string | null>(null);
  const makeRef = useRef<{ stop(): void } | null>(null);
  const makeGen = useRef(0);
  useEffect(
    () => () => {
      makeGen.current++;
      makeRef.current?.stop();
      makeRef.current = null;
    },
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら前の日の知らせを消し、作っている計算は止めて捨てる
  useEffect(() => {
    setMakeError(null);
    if (makeRef.current) {
      makeGen.current++;
      makeRef.current.stop();
      makeRef.current = null;
      setMaking(null);
      toast('日付を変えたので、作っていた提案をやめました');
    }
  }, [date]);
  const makeProposal = () => {
    if (!preset || makeRef.current) return;
    setMakeError(null);
    const rules = applyPreset(data.rules, preset);
    const name = `「${preset.name}」`;
    const pins = aiPinsOf({ ...data, rules }, date, allVisits);
    const target = attempt(() => compile({ ...data, rules }, date, Object.keys(pins).length > 0 ? pins : undefined));
    const p = target.value;
    if (!p) {
      setMakeError(target.error ?? '問題を作れませんでした');
      return;
    }
    if (p.visits.length === 0) {
      setMakeError('この日に計算できる訪問がありません');
      return;
    }
    if (p.staff.length === 0) {
      setMakeError(`この日に働ける${terms.staff}がいません`);
      return;
    }
    const forDate = date;
    const startVisits = allVisits;
    const gen = makeGen.current;
    const live = () => gen === makeGen.current;
    const started = attempt(() =>
      runSolve(p, { seed: data.seed, iterations: defaultIterations(p) }, (x) => {
        if (live()) setMaking((v) => (v ? { ...v, iteration: x.iteration, total: x.total } : v));
      }),
    );
    if (!started.value) {
      setMakeError(started.error ?? '提案を作れませんでした');
      return;
    }
    makeRef.current = started.value;
    setMaking({ date: forDate, name, iteration: 0, total: 0 });
    started.value.promise
      .then((result) => {
        if (!live()) return;
        const c: CompareChoice = {
          id: newId('pr'),
          title: `${name}の提案`,
          kind: 'proposal',
          rules,
          routes: result.routes,
          unassigned: result.unassigned,
          visits: startVisits,
          stopped: result.stopped,
        };
        onMade(c, forDate);
        toast(
          result.stopped ? `途中までの最良で${c.title}を作りました` : `${c.title}を作りました。A と B に並べています`,
        );
      })
      .catch((e) => {
        if (live()) setMakeError(`提案を作れませんでした（${formError(e)}）`);
      })
      .finally(() => {
        if (!live()) return;
        makeRef.current = null;
        setMaking(null);
      });
  };
  const makeWhy = !problem
    ? 'この日に計算できる訪問がありません'
    : data.presets.length === 0
      ? '考え方（プリセット）がありません。条件の画面で作ってください'
      : null;
  return {
    preset,
    setPresetId,
    making,
    makeError,
    makeProposal,
    stop: () => makeRef.current?.stop(),
    makeWhy,
  };
}
