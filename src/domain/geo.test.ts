// 写した元：katahimo-dev/visit-route-poc @ a46e7db packages/shared/src/domain/geo.test.ts
import { describe, expect, it } from 'vitest';
import { distanceMeters } from './geo';

const center = { lat: 38.2682, lng: 140.8694 };

describe('distanceMeters', () => {
  it('同じ点は 0、約133m ずれた点は 100m より大きい', () => {
    expect(distanceMeters(center, center)).toBe(0);
    const p = { lat: center.lat + 0.0012, lng: center.lng };
    expect(distanceMeters(p, center)).toBeGreaterThan(100);
  });
});
