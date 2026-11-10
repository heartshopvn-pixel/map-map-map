import React from 'react';
import { Camera, Compass, Layers, Move, RotateCcw, SkipForward, Trash2, ZoomIn } from 'lucide-react';
import {
  CameraFocusState,
  CameraMode,
  CameraQueueItem,
  GameConfig,
  ProvinceCell,
} from '../../types/game';

interface TabCameraProps {
  config: GameConfig;
  cameraFocus: CameraFocusState;
  cameraQueue: CameraQueueItem[];
  provinces: ProvinceCell[];
  onUpdateConfig: (patch: Partial<GameConfig>) => void;
  onSkipCameraTarget: () => void;
  onResetCameraView: () => void;
  onClearCameraQueue: () => void;
  onRemoveCameraQueueItem: (queueId: string) => void;
  onFocusProvince: (provinceId: string) => void;
}

export const TabCamera: React.FC<TabCameraProps> = ({
  config,
  cameraFocus,
  cameraQueue,
  provinces,
  onUpdateConfig,
  onSkipCameraTarget,
  onResetCameraView,
  onClearCameraQueue,
  onRemoveCameraQueueItem,
  onFocusProvince,
}) => {
  const idleMode = config.mapIdleMode || 'sway';
  const idleZoom = config.mapIdleZoom ?? 1.0;
  const swayAmp = config.mapIdleSwayAmplitudePx ?? 8;
  const swaySpeed = config.mapIdleSwaySpeed ?? 1.0;
  const panZoom = config.mapIdlePanZoom ?? 1.65;
  const panCycleSec = config.mapIdlePanCycleSec ?? 18;

  return (
    <div className="space-y-3.5">
      {/* 0. Chế Độ Chờ Bản Đồ Mặc Định (Tự động vào sau khi hoàn thành sự kiện) */}
      <section className="rounded-xl bg-stone-900/90 border border-amber-500/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Chế Độ Chờ Bản Đồ Mặc Định (Camera Chờ)
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-200 shrink-0">
            Tự vào sau sự kiện
          </span>
        </div>

        <p className="text-[10.5px] text-stone-400 leading-snug">
          Sau khi hoàn thành 1 sự kiện Zoom tỉnh, Camera tự động quay về Chế độ chờ như Map mặc định bên dưới.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onUpdateConfig({ mapIdleMode: 'sway' })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              idleMode === 'sway'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-extrabold uppercase">
                1. Đung Đưa Nhẹ
              </span>
              <Move className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[10px] text-stone-400 leading-snug">
              Bản đồ tổng thể đung đưa nhẹ nhàng theo độ Zoom &amp; biên độ tùy chỉnh.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateConfig({ mapIdleMode: 'pan_north_south' })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              idleMode === 'pan_north_south'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-extrabold uppercase">
                2. Rê Dọc Bắc ⇄ Nam
              </span>
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-[10px] text-stone-400 leading-snug">
              Zoom lại gần Mũi Bắc / Mũi Nam rồi rê dần dọc theo dáng chữ S.
            </p>
          </button>
        </div>

        {idleMode === 'sway' ? (
          <div className="space-y-2.5 pt-1 border-t border-stone-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-200 font-semibold">
                  Độ Zoom Camera chế độ chờ
                </span>
                <span className="text-amber-300 font-mono font-bold">
                  {idleZoom.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.65}
                max={3.0}
                step={0.05}
                value={idleZoom}
                onChange={(e) =>
                  onUpdateConfig({
                    mapIdleZoom: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-300 font-medium">
                  Biên độ đung đưa bản đồ
                </span>
                <span className="text-amber-300 font-mono font-bold">
                  {swayAmp}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={swayAmp}
                onChange={(e) =>
                  onUpdateConfig({
                    mapIdleSwayAmplitudePx: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-400">Tốc độ nhịp đung đưa</span>
                <span className="text-amber-300 font-mono font-bold">
                  {swaySpeed.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.1}
                value={swaySpeed}
                onChange={(e) =>
                  onUpdateConfig({
                    mapIdleSwaySpeed: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1 border-t border-stone-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-200 font-semibold">
                  Độ Zoom Camera chế độ chờ (Rê Bắc ⇄ Nam)
                </span>
                <span className="text-cyan-300 font-mono font-bold">
                  {panZoom.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.8}
                max={3.2}
                step={0.05}
                value={panZoom}
                onChange={(e) =>
                  onUpdateConfig({
                    mapIdlePanZoom: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-400">
                  Thời gian rê dọc 1 chiều (Bắc → Nam)
                </span>
                <span className="text-cyan-300 font-mono font-bold">
                  {panCycleSec}s
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={36}
                step={1}
                value={panCycleSec}
                onChange={(e) =>
                  onUpdateConfig({
                    mapIdlePanCycleSec: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </section>

      {/* 1. Chế độ Camera: 1. Phản ứng liên tục | 2. Xen kẽ zoom tổng */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            <span>Chế Độ Camera & Chuyển Tỉnh</span>
          </h2>
          <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cameraAutoZoom}
              onChange={(e) =>
                onUpdateConfig({ cameraAutoZoom: e.target.checked })
              }
              className="accent-emerald-500 rounded cursor-pointer"
            />
            <span>Tự động Zoom</span>
          </label>
        </div>

        {/* Selector 2 chế độ Camera */}
        <div className="grid grid-cols-1 gap-1.5">
          {(
            [
              {
                id: 'continuous' as CameraMode,
                title: '1. Phản ứng liên tục (Mặc định)',
                desc: 'Camera nhảy thẳng từ tỉnh này sang tỉnh kế tiếp, chỉ về Map tổng khi hết hàng chờ',
              },
              {
                id: 'alternating_overview' as CameraMode,
                title: '2. Xen kẽ zoom tổng (Ra Map tổng rồi mới vào tỉnh mới)',
                desc: 'Sau mỗi lượt quà & nhảy tỉnh sẽ zoom nhanh ra Map tổng cả nước rồi mới zoom vào tỉnh mới',
              },
            ] as const
          ).map((mode) => {
            const active = (config.cameraMode || 'continuous') === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onUpdateConfig({ cameraMode: mode.id })}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  active
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-stone-950/80 hover:bg-stone-900 border-stone-800 text-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">{mode.title}</span>
                  {active && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-stone-950 text-[9.5px] font-black">
                      ĐANG CHỌN
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-stone-400 mt-0.5 leading-snug">
                  {mode.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Nếu chọn chế độ 2 (Xen kẽ zoom tổng), cho phép chỉnh thời gian dừng ở Map tổng */}
        {config.cameraMode === 'alternating_overview' && (
          <div className="p-2 rounded-lg bg-stone-950/90 border border-amber-500/30">
            <div className="flex justify-between text-[11px] text-amber-200 mb-1">
              <span>Thời gian lướt qua Map tổng giữa 2 tỉnh:</span>
              <span className="font-mono font-bold">
                {((config.cameraOverviewHoldMs || 650) / 1000).toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min={350}
              max={2000}
              step={50}
              value={config.cameraOverviewHoldMs || 650}
              onChange={(e) =>
                onUpdateConfig({
                  cameraOverviewHoldMs: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>
        )}

        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-stone-400">Đang hiển thị:</div>
            <div className="text-xs font-extrabold text-amber-200">
              {cameraFocus.provinceId
                ? `Đang Zoom: ${cameraFocus.provinceName} (${
                    cameraFocus.senders?.length || 1
                  } người)`
                : 'Map Mặc Định (Toàn cảnh Việt Nam + Hoàng Sa, Trường Sa)'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSkipCameraTarget}
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <SkipForward className="w-3 h-3" />
              <span>Bỏ qua</span>
            </button>

            <button
              type="button"
              onClick={onResetCameraView}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Về Map Tổng</span>
            </button>
          </div>
        </div>

        {/* Thông số Zoom, Thời gian giữ & Độ mượt */}
        <div className="space-y-2 pt-1">
          <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
            <div className="flex justify-between text-[11px] text-stone-300 mb-1">
              <span>Độ phóng đại khi Zoom vào tỉnh (tối đa 15x):</span>
              <span className="font-mono font-bold text-amber-300">
                {config.cameraZoomScale.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={1.5}
              max={15.0}
              step={0.1}
              value={config.cameraZoomScale}
              onChange={(e) =>
                onUpdateConfig({ cameraZoomScale: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
            <div className="flex justify-between text-[11px] text-stone-300 mb-1">
              <span>Thời gian giữ Camera ở tỉnh:</span>
              <span className="font-mono font-bold text-emerald-300">
                {config.cameraHoldDurationSec.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={1.2}
              max={6.0}
              step={0.2}
              value={config.cameraHoldDurationSec}
              onChange={(e) =>
                onUpdateConfig({
                  cameraHoldDurationSec: parseFloat(e.target.value),
                })
              }
              className="w-full accent-emerald-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
            <div className="flex justify-between text-[11px] text-stone-300 mb-1">
              <span>Tốc độ chuyển cảnh Zoom In / Zoom Out:</span>
              <span className="font-mono font-bold text-cyan-300">
                {config.cameraSmoothSpeed.toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min={0.25}
              max={1.5}
              step={0.05}
              value={config.cameraSmoothSpeed}
              onChange={(e) =>
                onUpdateConfig({
                  cameraSmoothSpeed: parseFloat(e.target.value),
                })
              }
              className="w-full accent-cyan-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
            <div className="flex justify-between text-[11px] text-stone-300 mb-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" />
                <span>Số Avatar tối đa gom chung 1 lượt Zoom tỉnh:</span>
              </span>
              <span className="font-mono font-bold text-amber-300">
                {config.maxBatchSenders || 4} người
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={4}
              step={1}
              value={config.maxBatchSenders || 4}
              onChange={(e) =>
                onUpdateConfig({
                  maxBatchSenders: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 2. Hàng chờ Camera (Đã tự động gom theo tỉnh) */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200">
            Hàng Chờ Camera Đã Gom ({cameraQueue.length} tỉnh chờ)
          </h2>
          {cameraQueue.length > 0 && (
            <button
              type="button"
              onClick={onClearCameraQueue}
              className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-[10px] font-bold text-rose-200 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa hàng chờ</span>
            </button>
          )}
        </div>

        {cameraQueue.length === 0 ? (
          <div className="text-[11px] text-stone-500 italic py-2 text-center">
            Hàng chờ trống. Nhiều người gửi cùng tỉnh sẽ tự động gom vào 1 lượt!
          </div>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {cameraQueue.map((item, idx) => (
              <div
                key={item.id}
                className="px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 flex items-center justify-between text-[11px]"
              >
                <div className="truncate pr-2">
                  <span className="text-amber-400 font-mono mr-1">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-emerald-300">
                    {item.provinceName}
                  </span>
                  <span className="text-stone-400"> • </span>
                  <span className="font-semibold text-stone-200">
                    {item.senders.length} người ({item.username})
                  </span>
                  <span className="text-amber-300 font-mono ml-1">
                    +{item.pointsAdded}đ
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveCameraQueueItem(item.id)}
                  className="text-stone-400 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Bấm chọn tỉnh để Zoom thử */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
            <span>Zoom Thử Vào Từng Tỉnh (34 Tỉnh/Thành)</span>
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {provinces.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onFocusProvince(p.id)}
              className={`px-2 py-1.5 rounded text-[10.5px] font-semibold truncate cursor-pointer border transition ${
                cameraFocus.provinceId === p.id
                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                  : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
              }`}
            >
              {p.name.replace(/^TP\.\s*/i, '')}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
