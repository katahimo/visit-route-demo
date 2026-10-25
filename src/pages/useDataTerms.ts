// データの画面の「呼び方」（PRD D250・D251）：入力欄の状態と、変えるときの書き換え
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { termsCheck } from '../lib/dataScreen';
import { useDemoData } from '../store';

export function useDataTerms() {
  const { data, update } = useDemoData();
  const toast = useToast();
  const [terms, setTerms] = useState(data.org.terms);
  // 読み込み・初期化で呼び方が変わったら入力欄も合わせる
  useEffect(() => {
    setTerms(data.org.terms);
  }, [data.org.terms]);
  const check = termsCheck(terms, data.org.terms);
  const save = () => {
    const next = { client: terms.client.trim(), staff: terms.staff.trim() };
    update((d) => ({ ...d, org: { ...d.org, terms: next } }), '呼び方');
    toast('呼び方を変えました');
  };
  return { terms, setTerms, check, save };
}
