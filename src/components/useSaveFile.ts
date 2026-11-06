// ファイルを作って保存し、知らせを出す（書き出せなければ誤りの文）。予定の CSV のテンプレート・書き出しで使う（ADR-0090）
import { useState } from 'react';
import { formError } from '../lib/common';
import { saveBlob } from '../lib/download';
import { useToast } from './Toast';

export function useSaveFile() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const save = (make: () => Blob, name: string, done: string) => {
    setError(null);
    try {
      saveBlob(make(), name);
      toast(done);
    } catch (e) {
      setError(`書き出せませんでした（${formError(e)}）`);
    }
  };
  return { save, error, setError };
}
