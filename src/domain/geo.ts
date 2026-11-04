// 写した元：katahimo-dev/visit-route-poc @ a46e7db packages/shared/src/domain/geo.ts
import { type LatLng, LINE_DRIVE_KMH_DEFAULT, LINE_TRAVEL_DEFAULT, type LineTravel } from '../contracts/documents';

/** 2点間の大円距離（m） */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 移動手段ごとの平均速度（km/h）。地図APIが使えないときの概算に使う（車は事業所の設定で変えられる。ADR-0101） */
export const SPEED_KMH: Record<'DRIVE' | 'BICYCLE' | 'WALK' | 'TRANSIT', number> = {
  DRIVE: LINE_DRIVE_KMH_DEFAULT,
  BICYCLE: 12,
  WALK: 4.5,
  TRANSIT: 15,
};

/**
 * 直線距離 × 道なり係数（既定 1.3）を平均速度で割った概算の移動時間。line は事業所の係数（ADR-0101。無ければ既定）。
 * 車の速さは line.driveKmh、ほかの手段は SPEED_KMH
 */
export function estimateLeg(
  a: LatLng,
  b: LatLng,
  mode: 'DRIVE' | 'BICYCLE' | 'WALK' | 'TRANSIT',
  line: LineTravel = LINE_TRAVEL_DEFAULT,
): { seconds: number; meters: number } {
  const meters = Math.round(distanceMeters(a, b) * line.detourFactor);
  const kmh = mode === 'DRIVE' ? line.driveKmh : SPEED_KMH[mode];
  return { seconds: Math.round((meters / 1000 / kmh) * 3600), meters };
}
