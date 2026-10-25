import { ClipboardList, Plus } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { DemoData } from '../contracts/data';
import { jstDate } from '../domain/time';
import { typeOf } from '../lib/patternText';
import { scopeTexts, type VisitDraft, visitInfo } from '../lib/visitDraft';
import { useDemoData } from '../store';
import { FieldError } from './FieldError';
import { SidePanel } from './ui';
import { useFeature } from './useFeature';
import { COMPACT_QUERY, useMedia } from './useMedia';
import {
  useOpenDay,
  useStaffChoices,
  useVisitActions,
  useVisitForm,
  useVisitRoute,
  useVisitSave,
  useVisitWriter,
} from './useVisitPanel';
import { VisitScopeFields, VisitStaffFields, VisitTimeFields } from './visitPanelForm';
import {
  type VisitAct,
  VisitBigButtons,
  VisitCancelArea,
  VisitFooter,
  VisitRulesSection,
  VisitSummary,
} from './visitPanelParts';
import './visitPanel.css';

/**
 * 訪問の詳細の欄（PRD D301〜D304。ADR-0051）：どの画面から開いても同じ右の欄（スマホ幅は下から出る今の右の欄の形）。
 * 見る（〈利用者さん〉・日時・所要・種類・担当・繰り返し・この回の変更・決まりごと・道順）、日時と担当を同時に変える、取り消す・取り消しをやめる、
 * 新しい訪問を足す。繰り返しの回は保存のときに範囲（この回だけ／これ以降／すべて）を選ぶ。データは lib/visitOps 越しに読み書きし、
 * 書くのは store の update だけ。狭い画面（600px 以下）は下から出る欄（ボトムシート）で、見る・取り消す・担当を替えるだけ
 * （大きな4つのボタン：担当を替える・取り消す・道順・日の予定で見る。日時の変更・範囲・追加は出さない。ADR-0051 の決定5・ADR-0055）
 */

/** 保存したことを開いた画面へ知らせる中身 */
export type VisitSaved = {
  visitId: string;
  date: string;
  /** 日時・所要・種類を変えた */
  moved: boolean;
  /** 担当を選んだ */
  staffSet: boolean;
  isNew: boolean;
  /** 「〈利用者さん〉 M/D HH:MM」（開いた画面の知らせに使う） */
  label: string;
};

/** 欄を開く頼み。visitId か newVisit のどちらか */
export type VisitPanelRequest = {
  /** 開く訪問（新しい訪問なら無し） */
  visitId?: string;
  /** 新しい訪問の日付・〈利用者さん〉・開始 */
  newVisit?: { date: string; clientId?: string; start?: string };
  /** はじめの入力を差し替える（週のドラッグで落とした日時） */
  draft?: Partial<VisitDraft>;
  /** はじめに選んでおく担当（週の〈スタッフ〉×曜日の表へ落とした人。候補に無い・選べなければ「変えない」） */
  staff?: string;
  /** 保存・取り消しのあと（開いた画面の知らせ。週の「空き時間に入れる」など） */
  onSaved?: (r: VisitSaved) => void;
  /** 保存・閉じたあとのフォーカス先（開いた帯。無ければ開く前の要素） */
  returnFocus?: (visitId: string | null) => HTMLElement | null | undefined;
};

type OpenFn = (req: VisitPanelRequest) => void;
const Ctx = createContext<OpenFn | null>(null);

/** 欄を開く関数（App の殻の VisitPanelProvider の中。どの画面・コマンドパレットからでも開ける） */
export function useOpenVisit(): OpenFn {
  const v = useContext(Ctx);
  if (!v) throw new Error('VisitPanelProvider の外で useOpenVisit を使っています');
  return v;
}

/** 欄を画面全体で1つ持つ（App の殻に置く。開いている訪問は画面を移っても残す） */
export function VisitPanelProvider({ children }: { children: ReactNode }) {
  // トーストの「元に戻す」は欄を閉じたあとに押すので、今のデータを殻で追う
  const { data } = useDemoData();
  const latest = useRef(data);
  latest.current = data;
  const [req, setReq] = useState<(VisitPanelRequest & { key: number }) | null>(null);
  const seq = useRef(0);
  const open = useCallback((r: VisitPanelRequest) => {
    seq.current += 1;
    setReq({ ...r, key: seq.current });
  }, []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {req && <VisitPanel key={req.key} req={req} latest={latest} onClose={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

function VisitPanel({
  req,
  latest,
  onClose,
}: {
  req: VisitPanelRequest;
  latest: { readonly current: DemoData };
  onClose: () => void;
}) {
  const { data } = useDemoData();
  const narrow = useMedia(COMPACT_QUERY);
  const today = jstDate(Date.now());
  const isNew = !req.visitId;
  /** 開いている訪問の ID（欄を開いている間は変えない。保存で作り直した回の ID は savedRef で閉じたあとのフォーカスに使う） */
  const [visitId] = useState<string | null>(req.visitId ?? null);
  const info = useMemo(() => (visitId ? visitInfo(data, visitId, today) : null), [data, visitId, today]);
  const v = info?.visit ?? null;
  const form = useVisitForm(req, data, today);
  const { draft, set, error, errorId, bad } = form;
  /** スマホの下から出る欄で開いている操作（大きな4つのボタンの「担当を替える」「取り消す」。PRD D334） */
  const [act, setAct] = useState<VisitAct>(null);
  const mapsOn = useFeature('mapsLink');
  const savedRef = useRef<string | null>(null);

  const client = data.clients.find((c) => c.id === (v?.clientId ?? draft.clientId));
  const staffById = useMemo(() => new Map(data.staff.map((s) => [s.id, s])), [data.staff]);
  const cancelled = !!v?.cancelled;
  const editable = isNew || (!!info?.editable && !cancelled);
  /** 日時を変えられる（狭い画面は出さない） */
  const timeOn = editable && !narrow;
  /** 新しい訪問は狭い画面では足さない */
  const newBlocked = isNew && narrow;
  const scopes = useMemo(
    () => (visitId && editable && info?.pattern ? scopeTexts(data, visitId, today) : null),
    [data, visitId, editable, info?.pattern, today],
  );
  const choices = useStaffChoices(data, visitId, draft, editable && !newBlocked, form.pick, form.setPick);

  /** 閉じたあとのフォーカス（開いた帯へ。無ければ開く前の要素） */
  const returnFocus = () => req.returnFocus?.(savedRef.current ?? visitId) ?? null;
  const writer = useVisitWriter(visitId, isNew, latest);
  const save = useVisitSave({
    req,
    writer,
    form,
    visitId,
    info,
    isNew,
    savable: editable && !newBlocked,
    clientName: client?.displayName ?? '',
    today,
    savedRef,
    onClose,
  });
  const { doCancel, doUncancel, doRestore } = useVisitActions(req, writer, form, v, today);

  const { showDayLink, openDay } = useOpenDay(isNew, v, draft.date, onClose);
  const { route, routeHref } = useVisitRoute(data, v, client, mapsOn);

  const owner = info?.assignment.staffId ?? null;
  /** スマホは「担当を替える」を開いたときだけ保存（ほかは閉じるだけ） */
  const saveShown = editable && !newBlocked && (!narrow || act === 'staff');

  return (
    <SidePanel
      icon={isNew ? Plus : ClipboardList}
      title={isNew ? '訪問を追加' : '訪問の詳細'}
      narrow
      onClose={onClose}
      onSubmit={save}
      sheet={narrow}
      returnFocus={returnFocus}
      fallbackFocus={headingOfPage}
      focusPanel={!isNew}
      footer={<VisitFooter saveShown={saveShown} isNew={isNew} onClose={onClose} />}
    >
      <div
        className="visit-panel stack"
        data-testid="visit-panel"
        data-visit={visitId ?? ''}
        data-new={isNew || undefined}
      >
        {!isNew && !v && (
          <p className="warn-text" data-testid="vp-gone">
            この訪問は見つかりません（消されたか、繰り返しを直して作り直されました）。
          </p>
        )}
        {newBlocked && (
          <p className="sub" data-testid="vp-narrow-new">
            訪問の追加はパソコン・タブレットの幅で行います（スマホでは見る・取り消す・担当を替えるまで）。
          </p>
        )}
        {v && info && (
          <VisitSummary
            v={v}
            info={info}
            client={client}
            type={typeOf(data.visitTypes, v?.typeId ?? draft.typeId)}
            ownerStaff={owner ? staffById.get(owner) : undefined}
            restorable={timeOn}
            onRestore={doRestore}
            onOpenDay={showDayLink && !narrow ? openDay : null}
          />
        )}

        {narrow && v && info && (
          <VisitBigButtons
            info={info}
            editable={editable}
            act={act}
            setAct={setAct}
            onUncancel={doUncancel}
            mapsOn={mapsOn}
            routeHref={routeHref}
            clientName={client?.displayName ?? ''}
            onDay={showDayLink ? openDay : onClose}
          />
        )}

        {timeOn && !newBlocked && (
          <VisitTimeFields data={data} draft={draft} set={set} bad={bad} isNew={isNew} today={today} />
        )}

        {editable && !newBlocked && choices && (!narrow || act === 'staff') && (
          <VisitStaffFields
            isNew={isNew}
            draftDate={draft.date}
            visitDate={v?.date}
            choices={choices}
            pick={form.pick}
            setPick={form.setPick}
            staffById={staffById}
          />
        )}

        {scopes && !narrow && <VisitScopeFields scopes={scopes} scope={form.scope} setScope={form.setScope} />}

        <FieldError id={errorId} token={error}>
          {error?.text}
        </FieldError>

        {v && info?.editable && (!narrow || (act === 'cancel' && !cancelled)) && (
          <VisitCancelArea info={info} onCancel={doCancel} onUncancel={doUncancel} />
        )}

        {v && client && <VisitRulesSection client={client} route={route} narrow={narrow} />}
      </div>
    </SidePanel>
  );
}

/** 閉じたときに戻り先が消えていたら、画面の見出しへ（フォーカスを body に落とさない） */
function headingOfPage(): HTMLElement | null {
  const h = document.querySelector<HTMLElement>('.app-main h1');
  if (h && !h.hasAttribute('tabindex')) h.tabIndex = -1;
  return h;
}
