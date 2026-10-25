import { Plus, Repeat } from 'lucide-react';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Client } from '../contracts/documents';
import { patternFormOf } from '../lib/patternForm';
import { PatternEditForm } from './patternsForm';
import { PatternsList } from './patternsList';
import { usePatternsFlow } from './usePatternsFlow';

/**
 * 〈利用者さん〉の画面の予定のタブの「繰り返し」（定期パターン。ADR-0012・0052。PRD D37・D38・D308）：一覧と 足す・直す・終わらせる・消す。
 * どれも「直す（足す・終わらせる）→ 保存」の形で、保存を押すまでデータを変えない（取り消しで捨てる）。
 * 回は見るときに計算する（版2。ADR-0053）。直すときは「いつから」で分け（splitPattern。その日からの、担当を組んだ回は繰り返しのとおりに戻る）、
 * 終わらせるときは最後の日より後の回を無くし（visitOps の endPatternOp）、消すときは繰り返しごと消す（removePattern）。
 * 直す・終わらせる・消すは件数と確定した日を確認してから入れる。行を押すとその回をカレンダーで強調する（onSelect）。
 * 状態と処理は usePatternsFlow、一覧は patternsList、足す・直す欄は patternsForm
 */
export function PatternsSection({
  client,
  selected = null,
  onSelect,
  onDirty,
  readOnly = false,
}: {
  client: Client;
  /** カレンダーで強調している繰り返し */
  selected?: string | null;
  /** 行を押したとき（同じ行をもう一度押すと null） */
  onSelect?: (id: string | null) => void;
  /** 入力中の変更の有無（画面を離れる前の確認に使う） */
  onDirty?: (dirty: boolean) => void;
  /** 読むだけ（狭い画面。足す・直す・終わらせるを出さない） */
  readOnly?: boolean;
}) {
  const flow = usePatternsFlow({ clientId: client.id, selected, onSelect, onDirty });
  const { data, today, form, open, errorState, error } = flow;
  const terms = data.org.terms;

  return (
    <div className="stack" data-testid="patterns-section">
      <SectionTitle
        icon={Repeat}
        aside={
          !form &&
          !readOnly && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => open(patternFormOf(null, today, 60))}
              data-testid="pattern-add"
            >
              <WithIcon icon={Plus} size={14}>
                繰り返しを足す
              </WithIcon>
            </button>
          )
        }
      >
        繰り返し
      </SectionTitle>
      <Hint>
        <ul className="hint-list">
          <li>決まった曜日・時刻の訪問です。押すと、その回をカレンダーで目立たせます。</li>
          <li>足すと、今日から作ってある最後の日まで訪問を作ります。その先の月は「月の予定」で作ります。</li>
          {!client.active && <li>この{terms.client}は利用中でないので、訪問は作りません。</li>}
        </ul>
      </Hint>
      <PatternsList
        patterns={flow.patterns}
        visitTypes={data.visitTypes}
        staffName={flow.staffName}
        selected={selected}
        onSelect={onSelect}
        readOnly={readOnly}
        today={today}
        onEdit={(p) => open(patternFormOf(p, today, p.durationMinutes))}
        onStartEnd={flow.startEnd}
        end={{
          ending: flow.ending,
          onChange: flow.setEnding,
          onSave: flow.end,
          onCancel: flow.cancelEnd,
          errorState,
          error,
        }}
      />

      {form && (
        <PatternEditForm
          form={form}
          setForm={flow.setForm}
          visitTypes={data.visitTypes}
          staff={flow.staff}
          today={today}
          monthlyOn={flow.monthlyOn}
          monthlyOffId={flow.monthlyOffId}
          daysLocked={flow.daysLocked}
          errorState={errorState}
          error={error}
          onSave={flow.save}
          onCancel={() => open(null)}
          onRemove={() => {
            const p = data.patterns.find((x) => x.id === form.id);
            if (p) void flow.remove(p);
          }}
        />
      )}
    </div>
  );
}
