// 〈利用者さん〉の画面の基本情報のタブ（PRD D308・D311。ADR-0016・0052）：節「基本」「段階と紹介元」「住所」「特性」
// 「訪問先の決まりごと」。新しい人は「基本」の節に基本と段階の入力をまとめて開く
import { BadgeCheck, DoorOpen, House, Route, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { TraitsEditor } from '../components/conditions';
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
import { colorOf } from '../lib/colors';
import { hasLocation } from '../lib/common';
import { traitText } from '../lib/compatView';
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
        <DlRow term="地図の位置" value={placeText(c.place)} />
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
  onConfirmTentative: (c: Client) => void;
  onCancelTentative: (c: Client) => void;
}) {
  const { form, setForm, bad, terms } = ctx;
  const f = form && { form, setForm, bad, terms };
  const basicFields = f && <ClientBasicFields {...f} />;
  const stageFields = f && <ClientStageFields {...f} stageOn={stageOn} />;
  const today = jstDate(Date.now());
  return (
    <div className="person-sections">
      {newEdit ? (
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
          {basicFields}
          {stageFields}
          <Hint label="ほかの項目">
            住所・特性・担当・繰り返し（決まった曜日の訪問）・休みは、保存してから入れられます。
          </Hint>
        </EditSection>
      ) : (
        <>
          <EditSection {...sec('basic')} icon={UserRound} title="基本" view={<ClientBasicView c={c} />}>
            {basicFields}
          </EditSection>
          <EditSection
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
          </EditSection>
          <EditSection {...sec('place')} icon={House} title="住所" view={<ClientPlaceView c={c} />}>
            {form && <ClientPlaceEditor value={form.place} onChange={(place) => setForm((x) => ({ ...x, place }))} />}
          </EditSection>
          <EditSection
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
              <TraitsEditor
                items={clientItems}
                value={form.traits}
                onChange={(traits) => setForm({ ...form, traits })}
              />
            )}
          </EditSection>
          {notesOn && (
            <EditSection {...sec('rules')} icon={DoorOpen} title="訪問先の決まりごと" view={<ClientRulesView c={c} />}>
              {f && <ClientRulesFields {...f} />}
            </EditSection>
          )}
        </>
      )}
    </div>
  );
}
