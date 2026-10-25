// 新しい〈利用者さん〉の組み立て（空き状況の仮押さえ・〈利用者さん〉の画面の追加で同じ既定の項目）
import { type Client, EMPTY_REFERRER } from '../contracts/documents';
import { newId } from './common';

/** 既定の項目で新しい〈利用者さん〉を作る（id は新しく振る）。overrides の項目で上書きする */
export function newClient(overrides: Partial<Client> = {}): Client {
  return {
    id: newId('c'),
    displayName: '',
    kana: '',
    place: { address: '', lat: null, lng: null, postalCode: '' },
    note: '',
    color: 0,
    active: true,
    traits: {},
    requirements: [],
    preferences: [],
    tentative: false,
    entryNote: '',
    keyNote: '',
    parkingNote: '',
    cautionNote: '',
    allowedStaffIds: [],
    stage: 'active',
    referrer: { ...EMPTY_REFERRER },
    ...overrides,
  };
}
