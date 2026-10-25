import { describe, expect, it } from 'vitest';
import { clientSchema, EMPTY_REFERRER } from '../contracts/documents';
import { newClient } from './newClient';

describe('newClient', () => {
  it('既定の項目で作り、契約の形に合う', () => {
    const c = newClient();
    expect(c.id).toMatch(/^c-/);
    expect(c.stage).toBe('active');
    expect(c.tentative).toBe(false);
    expect(c.referrer).toEqual(EMPTY_REFERRER);
    expect(c.referrer).not.toBe(EMPTY_REFERRER);
    // 表示名は人が入れる（空のままでは契約に合わない）
    expect(clientSchema.safeParse({ ...c, displayName: '山田' }).success).toBe(true);
  });
  it('overrides で上書きし、毎回新しい id を振る', () => {
    const c = newClient({ displayName: '山田', tentative: true, stage: 'inquiry', color: 3 });
    expect(c).toMatchObject({ displayName: '山田', tentative: true, stage: 'inquiry', color: 3 });
    expect(newClient().id).not.toBe(newClient().id);
  });
});
