import { Component, type ReactNode, Suspense } from 'react';
import { isChunkLoadError } from '../lib/chunkLoad';
import { reloadPage } from '../lib/reloadPage';
import type { MapLine, MapPoint } from '../lib/routeView';
import { flushSave } from '../store';
import { lazyComponent } from './lazyComponent';

/**
 * 地図（国土地理院の淡色地図。APIキー不要）。
 * 線は順番どおりに結ぶ。dashed は点線（比較の A）、実線は今の担当・比較の B。
 * 本体（Leaflet）は別のチャンク（LeafletMap）で、地図を出すときに読む（PRD D248。ADR-0039）
 */
export type RouteMapProps = {
  points: MapPoint[];
  lines?: MapLine[];
  height?: number;
  /** 指定すると地図をクリックした位置を返す（位置の訂正用） */
  onPick?: (p: { lat: number; lng: number }) => void;
};

const LeafletMap = lazyComponent('LeafletMap', () => import('./LeafletMap'));

/**
 * 地図の本体を読めなかったとき（新しい版の公開・通信の切れ。PRD D248）：画面全体をエラーにせず、
 * 同じ高さの枠に「地図を読み込めませんでした」と［再読み込み］を出す。ほかの例外は外の ErrorBoundary へ
 */
class MapErrorBoundary extends Component<{ height: number; children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    // 読み込みの失敗でないもの（地図の不具合）は画面の ErrorBoundary に任せる
    if (!isChunkLoadError(error)) throw error;
    return (
      <div className="map map-loading map-error" style={{ height: this.props.height }} data-testid="map-error">
        <span>地図を読み込めませんでした</span>
        <button type="button" className="btn btn-small" onClick={() => reloadPage(flushSave)}>
          再読み込み
        </button>
      </div>
    );
  }
}

function RouteMapView(props: RouteMapProps) {
  const height = props.height ?? 260;
  return (
    <MapErrorBoundary height={height}>
      {/* 読み込み中も同じ高さの枠を出す（地図が出るときに下が跳ねない） */}
      <Suspense
        fallback={
          <output className="map map-loading" style={{ height }} aria-busy="true">
            地図を読み込んでいます…
          </output>
        }
      >
        <LeafletMap {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}

/** 地図（読み込み中は同じ高さの枠）。`RouteMap.preload()` で本体のチャンクを先に読む */
export const RouteMap = Object.assign(RouteMapView, { preload: LeafletMap.preload });
