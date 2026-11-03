// 〈利用者さん〉の画面の基本情報のタブ（PRD D308・D311。ADR-0016・0052）：節「基本」「段階と紹介元」「住所」「特性」
// 「訪問先の決まりごと」。新しい人は「基本」の節に基本と段階の入力をまとめて開く
import { BadgeCheck, DoorOpen, House, Route, UserRound } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { ClientTravelFields } from '../components/clientTravel';
import { TraitsEditor } from '../components/conditions';
import { DetailsFold } from '../components/DetailsFold';
import type { FormErr } from '../components/FieldError';
import { ClientAreaRow, DlRow } from '../components/personDetail';
import { EditSection } from '../components/personPage';
import { placeText } from '../components/personView';
import { ClientPlaceEditor } from '../components/placeLookup';
import { RouteMap } from '../components/RouteMap';
import { Hint, WithIcon } from '../components/ui';
import { VISIT_RULE_FIELDS } from '../components/VisitRules';
import type { Client } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import { jstDate } from '../domain/time';
import { travelNote, withTravel } from '../lib/clientTravel';
import { colorOf } from '../lib/colors';
import { hasLocation } from '../lib/common';
import { traitText } from '../lib/compatView';
import {
  type ClientPart,
  clientFolded,
  editInFold,
  newClientHint,
  newClientShowsStage,
  splitFolded,
} from '../lib/peopleView';
import { formatPostalCode } from '../lib/postalCode';
import { orDash } from '../lib/viewMode';
import {
  ClientBasicFields,
  ClientBasicView,
  type ClientFormCtx,
  type ClientSecOf,
  ClientStageFields,
  ClientStageView,
} from './clientBasicSections';

function ClientPlaceView({ c }: { c: Client }) {
  const points = hasLocation(c.place)
    ? [{ lat: c.place.lat!, lng: c.place.lng!, label: '●', color: colorOf(c.color) }]
    : [];
  return (
    <>
      <dl>
        <DlRow term="郵便番号" value={c.place.postalCode ? `〒${formatPostalCode(c.place.postalCode)}` : '—'} />
        <DlRow term="住所" value={orDash(c.place.address)} />
        <ClientAreaRow client={c} />
        <DlRow term="緯度・経度" value={placeText(c.place)} />
        <DlRow term="移動" value={travelNote(c.place) || '距離から見積もる'} />
      </dl>
      {points.length > 0 && <PlaceMap lat={points[0]!.lat} lng={points[0]!.lng} color={points[0]!.color} />}
    </>
  );
}

/** 住所の小さな地図（点は位置か色が変わったときだけ作り直す。点の配列が替わると地図が寄せ直すため） */
function PlaceMap({ lat, lng, color }: { lat: number; lng: number; color: string }) {
  const points = useMemo(() => [{ lat, lng, label: '●', color }], [lat, lng, color]);
  return <RouteMap height={180} points={points} />;
}

function ClientRulesView({ c }: { c: Client }) {
  return (
    <dl>
      {VISIT_RULE_FIELDS.map((f) => (
        <DlRow key={f.key} term={f.label} value={orDash(c[f.key])} />
      ))}
    </dl>
  );
}

function ClientRulesFields({ form, setForm, terms }: ClientFormCtx) {
  return (
    <>
      <Hint>
        入り方・鍵・駐車場・注意を書くと、{terms.staff}の画面と日の予定の訪問に出ます（各200文字まで）。
        実在の人の名前・住所などの個人情報は入れないでください。
      </Hint>
      <div className="form-grid" data-testid="visit-rules-form">
        {VISIT_RULE_FIELDS.map((f) => (
          <label key={f.key}>
            <WithIcon icon={f.icon} size={14}>
              {f.label}
            </WithIcon>
            <input
              value={form[f.key]}
              maxLength={200}
              placeholder={f.placeholder}
              data-testid={`client-${f.key}`}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </>
  );
}

type BasicSectionsArgs = Pick<
  Parameters<typeof ClientBasicTab>[0],
  'c' | 'saved' | 'sec' | 'clientItems' | 'stageOn' | 'notesOn' | 'onConfirmTentative' | 'onCancelTentative' | 'ctx'
>;

/** 基本情報のタブの節（欄の種類つき。切は畳む欄を分ける。lib/peopleView の splitFolded） */
function basicSections(a: BasicSectionsArgs): { part: ClientPart; node: ReactNode }[] {
  const { c, saved, sec, clientItems, stageOn, notesOn, onConfirmTentative, onCancelTentative, ctx } = a;
  const { form, setForm, bad, terms } = ctx;
  const f = form && { form, setForm, bad, terms };
  const basicFields = f && <ClientBasicFields {...f} />;
  const stageFields = f && <ClientStageFields {...f} stageOn={stageOn} />;
  const today = jstDate(Date.now());
  const section = (part: ClientPart, node: ReactNode) => ({ part, node });
  return [
    section(
      'basic',
      <EditSection key="basic" {...sec('basic')} icon={UserRound} title="基本" view={<ClientBasicView c={c} />}>
        {basicFields}
      </EditSection>,
    ),
    section(
      'stage',
      <EditSection
        key="stage"
        {...sec('stage')}
        icon={Route}
        title={stageOn ? '段階と紹介元' : '段階'}
        view={
          <ClientStageView
            c={c}
            saved={saved}
            stageOn={stageOn}
            terms={terms}
            onConfirmTentative={onConfirmTentative}
            onCancelTentative={onCancelTentative}
          />
        }
      >
        {stageFields}
      </EditSection>,
    ),
    section(
      'place',
      <EditSection key="place" {...sec('place')} icon={House} title="住所" view={<ClientPlaceView c={c} />}>
        {form && (
          <ClientPlaceEditor
            value={form.place}
            // 移動時間・遠方（出張）は下の欄の値を残す（住所の検索の結果で戻さない）
            onChange={(place) =>
              setForm((x) => ({
                ...x,
                place: withTravel(place, x.place.travelMinutes ?? null, x.place.farTrip === true),
              }))
            }
          />
        )}
        {form && (
          <ClientTravelFields
            value={form.place}
            onChange={(f) => setForm((x) => ({ ...x, place: f(x.place) }))}
            bad={bad}
          />
        )}
      </EditSection>,
    ),
    section(
      'traits',
      <EditSection
        key="traits"
        {...sec('traits')}
        icon={BadgeCheck}
        title="特性"
        view={
          <dl>
            {clientItems.map((it) => (
              <DlRow key={it.id} term={it.name} value={traitText(it, c.traits[it.id], today)} />
            ))}
          </dl>
        }
      >
        {form && (
          <TraitsEditor items={clientItems} value={form.traits} onChange={(traits) => setForm({ ...form, traits })} />
        )}
      </EditSection>,
    ),
    ...(notesOn
      ? [
          section(
            'rules',
            <EditSection
              key="rules"
              {...sec('rules')}
              icon={DoorOpen}
              title="訪問先の決まりごと"
              view={<ClientRulesView c={c} />}
            >
              {f && <ClientRulesFields {...f} />}
            </EditSection>,
          ),
        ]
      : []),
  ];
}

export function ClientBasicTab({
  c,
  saved,
  newEdit,
  ctx,
  sec,
  onSave,
  onCancel,
  error,
  errorId,
  clientItems,
  stageOn,
  notesOn,
  only,
  more,
  editKey,
  onConfirmTentative,
  onCancelTentative,
}: {
  c: Client;
  saved: Client | undefined;
  /** 新しい人の節を開いている */
  newEdit: boolean;
  /** 直している入力（直していなければ null） */
  ctx: Omit<ClientFormCtx, 'form'> & { form: Client | null };
  sec: ClientSecOf;
  onSave: () => void;
  onCancel: () => void;
  error: FormErr;
  errorId: string;
  clientItems: Item[];
  stageOn: boolean;
  notesOn: boolean;
  /** エキスパート機能が切か（切は欄を「詳しく ▾」へ畳み、新しい人に段階を聞かない。lib/peopleView） */
  only: boolean;
  /** 「詳しく ▾」の中に足す担当・相性の節（切のとき。担当・相性のタブを出さないので） */
  more: ReactNode;
  /** 直している節の鍵（「詳しく」の中なら開いて始める） */
  editKey: string | undefined;
  onConfirmTentative: (c: Client) => void;
  onCancelTentative: (c: Client) => void;
}) {
  const { form, setForm, bad, terms } = ctx;
  const folded = clientFolded(only);
  const showStage = newClientShowsStage(only);
  if (newEdit) {
    const f = form && { form, setForm, bad, terms };
    return (
      <div className="person-sections">
        <EditSection
          name="new"
          icon={UserRound}
          title="基本"
          editing
          onEdit={() => {}}
          onSave={onSave}
          onCancel={onCancel}
          error={error}
          errorId={errorId}
          view={null}
        >
          {f && <ClientBasicFields {...f} />}
          {f && showStage && <ClientStageFields {...f} stageOn={stageOn} />}
          <Hint label="ほかの項目">{newClientHint(!showStage)}</Hint>
        </EditSection>
      </div>
    );
  }
  // 切は段階・特性・決まりごと（と担当・相性）を「詳しく ▾」へ畳み、名前（基本）・住所を出す（PRD D385）
  const parts = splitFolded(
    basicSections({ c, saved, sec, clientItems, stageOn, notesOn, onConfirmTentative, onCancelTentative, ctx }),
    folded,
  );
  return (
    <>
      <div className="person-sections">{parts.shown}</div>
      {(parts.folded.length > 0 || more) && (
        <DetailsFold testId="person-details" forceOpen={editInFold(folded, editKey)}>
          {parts.folded.length > 0 && <div className="person-sections">{parts.folded}</div>}
          {more}
        </DetailsFold>
      )}
    </>
  );
}
