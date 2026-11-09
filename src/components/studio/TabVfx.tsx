import React, { useRef, useState } from 'react';
import { Compass, Download, Move, Sparkles, Upload, Volume2 } from 'lucide-react';
import { GameConfig } from '../../types/game';

interface TabVfxProps {
  config: GameConfig;
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  onTriggerRandomGift: (isRose: boolean) => void;
  onSaveBackupJson: () => void;
  onLoadBackupJson: (rawJsonText: string) => { ok: boolean; message: string };
}

export const TabVfx: React.FC<TabVfxProps> = ({
  config,
  onUpdateConfig,
  onTriggerRandomGift,
  onSaveBackupJson,
  onLoadBackupJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const idleMode = config.mapIdleMode || 'sway';
  const swayAmp = config.mapIdleSwayAmplitudePx ?? 8;
  const swaySpeed = config.mapIdleSwaySpeed ?? 1.0;
  const panZoom = config.mapIdlePanZoom ?? 1.65;
  const panCycleSec = config.mapIdlePanCycleSec ?? 18;

  return (
    <div className="space-y-4">
      {/* Section 0: Chế Độ Chờ Bản Đồ Mặc Định Khi Không Có Sự Kiện */}
      <section className="rounded-xl bg-stone-900/70 border border-amber-500/30 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Chế Độ Chờ Bản Đồ Mặc Định (Khi Không Có Sự Kiện)
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/40 text-[10px] font-bold text-pink-200">
            Nhãn tỉnh: Hồng nhạt
          </span>
        </div>

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
              Bản đồ tổng thể đung đưa nhẹ nhàng theo biên độ tùy chỉnh bên dưới.
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
              Zoom lại gần Mũi Bắc / Mũi Nam 1 chút rồi rê dần tới đầu kia của Map.
            </p>
          </button>
        </div>

        {idleMode === 'sway' ? (
          <div className="space-y-2.5 pt-1 border-t border-stone-800/80">
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
                <span className="text-stone-300 font-medium">
                  Độ phóng đại khi rê Mũi Bắc ⇄ Mũi Nam
                </span>
                <span className="text-cyan-300 font-mono font-bold">
                  {panZoom.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={1.25}
                max={2.8}
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

      {/* Section 1: Avatar Throw & Tile Contributors VFX */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Hiệu Ứng Ném Avatar Vào Tỉnh
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onTriggerRandomGift(true)}
            className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold text-rose-300 cursor-pointer"
          >
            Thử Ném Hoa Hồng
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Thời gian hiệu ứng ném Avatar</span>
              <span className="text-amber-300 font-mono font-bold">
                {(config.throwDurationMs / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={3000}
              step={100}
              value={config.throwDurationMs}
              onChange={(e) =>
                onUpdateConfig({ throwDurationMs: Number(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Kích thước Avatar bay vào ô tỉnh</span>
              <span className="text-amber-300 font-mono font-bold">
                {config.avatarSizePx}px
              </span>
            </div>
            <input
              type="range"
              min={28}
              max={84}
              step={2}
              value={config.avatarSizePx}
              onChange={(e) =>
                onUpdateConfig({ avatarSizePx: Number(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Số Avatar lưu lại trong mỗi ô tỉnh</span>
              <span className="text-amber-300 font-mono font-bold">
                {config.maxContributorsPerTile} người
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={24}
              step={1}
              value={config.maxContributorsPerTile}
              onChange={(e) =>
                onUpdateConfig({ maxContributorsPerTile: Number(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Sound Effect Volume */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Âm Lượng Tiếng Ném Quà (SFX)
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {Math.round(config.sfxVolume * 100)}%
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.sfxVolume}
          onChange={(e) => onUpdateConfig({ sfxVolume: Number(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />
      </section>

      {/* Section 3: Backup & Restore JSON */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-2.5">
        <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
          Sao Lưu & Khôi Phục Dữ Liệu Điểm Tỉnh (.JSON)
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSaveBackupJson}
            className="py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Tải file Backup</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nạp file Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  const res = onLoadBackupJson(String(reader.result || ''));
                  setBackupNotice(res.message);
                  setTimeout(() => setBackupNotice(null), 3000);
                };
                reader.readAsText(file);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </div>
        {backupNotice && (
          <div className="text-[11px] text-amber-300 font-medium">
            {backupNotice}
          </div>
        )}
      </section>
    </div>
  );
};
