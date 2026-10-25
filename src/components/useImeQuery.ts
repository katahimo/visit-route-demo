// 絞り込みの欄の検索の文字（ClientFilter・StaffFilter で同じ扱い）：部品の中にも文字を持ち、日本語の変換中は呼ぶ側へ渡さず
// 確定（compositionend）で渡す。ふつうの入力は少し遅らせて渡す（打つたびに URL を書かない）。呼ぶ側の値が外から変わったら入力欄を合わせる
import { type ChangeEvent, type CompositionEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

/** 検索の文字を呼ぶ側へ渡すまでの待ち（ミリ秒。打つたびに URL を書かない） */
export const QUERY_DELAY_MS = 300;

/**
 * 検索の文字を持つフック。state.query が呼ぶ側の値。
 * text・setLocalText：入力欄の文字、send：呼ぶ側へ渡す（待っている書き込みは取り消す）、
 * change：チップなどの変更（入力欄の文字もいっしょに渡す。変換中なら渡し済みの文字のまま）、inputProps：検索の input に付ける
 */
export function useImeQuery<S extends { query: string }>(state: S, onChange: (next: S) => void) {
  const [text, setText] = useState(state.query);
  const textRef = useRef(state.query);
  /** 最後に呼ぶ側へ渡した文字（呼ぶ側の値がこれと違えば、外から変わった） */
  const sent = useRef(state.query);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ state, onChange });
  latest.current = { state, onChange };
  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  // 外すときは、待っている書き込みを取り消す
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);
  // 呼ぶ側の値が外から変わったら入力欄を合わせる（変換中は触らない）
  useEffect(() => {
    if (state.query === sent.current || composing.current) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    sent.current = state.query;
    textRef.current = state.query;
    setText(state.query);
  }, [state.query]);
  const setLocalText = (q: string) => {
    textRef.current = q;
    setText(q);
  };
  /** 呼ぶ側へ渡す（待っている文字の書き込みは取り消す） */
  const send = (next: S) => {
    clearTimer();
    sent.current = next.query;
    latest.current.onChange(next);
  };
  /** 入力欄の文字を渡す */
  const flushQuery = () => {
    if (textRef.current !== latest.current.state.query) send({ ...latest.current.state, query: textRef.current });
    else clearTimer();
  };
  /** チップなどの変更：入力欄の文字もいっしょに渡す（変換中なら渡し済みの文字のまま） */
  const change = (next: S) => send({ ...next, query: composing.current ? sent.current : textRef.current });
  const inputProps = {
    value: text,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setLocalText(e.target.value);
      // 変換中は渡さない（確定の compositionend で渡す）。ふつうの入力は少し待ってから
      if (composing.current || (e.nativeEvent as InputEvent).isComposing) return;
      clearTimer();
      timer.current = setTimeout(flushQuery, QUERY_DELAY_MS);
    },
    onCompositionStart: () => {
      composing.current = true;
      clearTimer();
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      setLocalText(e.currentTarget.value);
      flushQuery();
    },
    onBlur: () => !composing.current && flushQuery(),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape' && text !== '') {
        e.preventDefault();
        setLocalText('');
        flushQuery();
      } else if (e.key === 'Enter') flushQuery();
    },
  };
  return { text, setLocalText, send, change, inputProps };
}
