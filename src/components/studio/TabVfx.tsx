import React, { useRef, useState } from 'react';
import { Download, Sparkles, Upload, Volume2 } from 'lucide-react';
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

  return (
    <div className="space-y-4">
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
