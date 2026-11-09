import React, { useEffect, useState } from 'react';
import {
  Bot,
  FileText,
  ImagePlus,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { GameConfig } from '../../types/game';

interface TabNpcProps {
  config: GameConfig;
  npcNames: string[];
  npcAvatars: string[];
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  onUpdateNpcNames: (names: string[]) => void;
  onResetNpcNames: () => void;
  onUpdateNpcAvatars: (avatars: string[]) => void;
  onResetNpcAvatars: () => void;
  onTriggerRandomGift: (
    isRose: boolean,
    specificProvinceId?: string,
    customUsername?: string,
    isNpc?: boolean
  ) => void;
}

/**
 * Tự động cắt vuông chính giữa (center-crop) và nén ảnh Avatar về 128x128px WebP (~5KB/ảnh)
 */
async function compressAvatarFileTo128(
  file: File,
  targetSize = 128
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        // Center crop hình vuông
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.drawImage(
          img,
          sx,
          sy,
          minSide,
          minSide,
          0,
          0,
          targetSize,
          targetSize
        );
        resolve(canvas.toDataURL('image/webp', 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const TabNpc: React.FC<TabNpcProps> = ({
  config,
  npcNames,
  npcAvatars,
  onUpdateConfig,
  onUpdateNpcNames,
  onResetNpcNames,
  onUpdateNpcAvatars,
  onResetNpcAvatars,
  onTriggerRandomGift,
}) => {
  const [namesDraft, setNamesDraft] = useState(npcNames.join('\n'));
  const [avatarsDraft, setAvatarsDraft] = useState(npcAvatars.join('\n'));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploadingAvatars, setIsUploadingAvatars] = useState(false);

  useEffect(() => {
    setNamesDraft(npcNames.join('\n'));
  }, [npcNames]);

  useEffect(() => {
    setAvatarsDraft(npcAvatars.join('\n'));
  }, [npcAvatars]);

  const showTempStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Nhập file .txt danh sách tên NPC
  const handleImportTxtNames = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = text
        .split(/\r?\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsed.length > 0) {
        onUpdateNpcNames(parsed);
        setNamesDraft(parsed.join('\n'));
        showTempStatus(
          `Đã nạp ${parsed.length} tên NPC từ file "${file.name}"!`
        );
      } else {
        showTempStatus('File .txt trống hoặc không có tên hợp lệ.');
      }
    } catch {
      showTempStatus('Không đọc được file .txt!');
    }
    e.target.value = '';
  };

  // Tải ảnh Avatar hàng loạt (tự động nén về 128x128px WebP siêu nhẹ)
  const handleBulkUploadAvatars = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploadingAvatars(true);
    try {
      const files: File[] = Array.from(fileList);
      const compressedList: string[] = [];
      for (const file of files) {
        try {
          const dataUri = await compressAvatarFileTo128(file, 128);
          compressedList.push(dataUri);
        } catch {
          // Bỏ qua file lỗi
        }
      }

      if (compressedList.length > 0) {
        const merged = [...compressedList, ...npcAvatars].slice(0, 120);
        onUpdateNpcAvatars(merged);
        setAvatarsDraft(merged.join('\n'));
        showTempStatus(
          `Đã tải & nén siêu nhẹ (128×128px) thành công ${compressedList.length} ảnh Avatar!`
        );
      }
    } finally {
      setIsUploadingAvatars(false);
      e.target.value = '';
    }
  };

  const handleRemoveSingleAvatar = (idxToRemove: number) => {
    const next = npcAvatars.filter((_, idx) => idx !== idxToRemove);
    onUpdateNpcAvatars(next);
    setAvatarsDraft(next.join('\n'));
  };

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs font-bold text-emerald-200">
          {statusMessage}
        </div>
      )}

      {/* Section 1: Auto Bot Simulation */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              NPC Tự Động Hỗ Trợ Điểm Về Tỉnh
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ npcAutoEnabled: !config.npcAutoEnabled })
            }
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              config.npcAutoEnabled
                ? 'bg-emerald-500 text-stone-950'
                : 'bg-stone-800 text-stone-300 border border-stone-700'
            }`}
          >
            {config.npcAutoEnabled ? 'ĐANG BẬT AUTO' : 'ĐANG TẮT'}
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">
                Chu kỳ NPC (tự nhiên ±1s đến ±2s)
              </span>
              <span className="text-amber-300 font-mono font-bold">
                {config.npcIntervalSec.toFixed(1)}s (±1~2s) / lượt
              </span>
            </div>
            <input
              type="range"
              min={1.5}
              max={20}
              step={0.5}
              value={config.npcIntervalSec}
              onChange={(e) =>
                onUpdateConfig({ npcIntervalSec: Number(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">
                Tỉ lệ NPC hỗ trợ gói Hoa Hồng (+{config.rosePoints}đ)
              </span>
              <span className="text-rose-300 font-mono font-bold">
                {Math.round(config.npcRoseChancePercent)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={config.npcRoseChancePercent}
              onChange={(e) =>
                onUpdateConfig({
                  npcRoseChancePercent: Number(e.target.value),
                })
              }
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          <div className="pt-1">
            <label className="block text-[11px] font-bold text-emerald-300 mb-1">
              Mẫu câu đọc an toàn khi NPC hỗ trợ Hoa Hồng / Quà Coin (Tránh vi phạm):
            </label>
            <input
              type="text"
              value={
                config.npcSupportTtsTemplate ||
                'NPC [Tên] đã hỗ trợ [Điểm] điểm về tỉnh [Tỉnh]'
              }
              onChange={(e) =>
                onUpdateConfig({ npcSupportTtsTemplate: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-emerald-500/40 text-xs text-stone-100 focus:outline-none focus:border-emerald-400"
            />
            <p className="mt-1 text-[10px] text-stone-400 leading-relaxed">
              * Khi NPC hỗ trợ <strong>1 điểm (+1đ)</strong>: Coi như người chơi
              bình thường, <strong>không đọc từ NPC</strong> (VD:{' '}
              <em>&quot;Bạn A đã đến tỉnh B và gửi 1 điểm&quot;</em>).
              <br />* Khi NPC gửi <strong>Hoa Hồng / Quà Coin (+5đ)</strong>:
              Đọc{' '}
              <strong className="text-emerald-300">
                &quot;NPC + Tên đã hỗ trợ số điểm về tỉnh&quot;
              </strong>{' '}
              (không nói NPC tặng quà).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onTriggerRandomGift(false, undefined, undefined, true)}
            className="py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-stone-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Play className="w-3 h-3 text-cyan-400" />
            <span>NPC +1đ (Như người thường)</span>
          </button>
          <button
            type="button"
            onClick={() => onTriggerRandomGift(true, undefined, undefined, true)}
            className="py-1.5 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-semibold text-rose-200 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-rose-400" />
            <span>NPC Hỗ Trợ (+{config.rosePoints}đ)</span>
          </button>
        </div>
      </section>

      {/* Section 2: NPC Names + Import .TXT */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-200">
            Danh sách Tên NPC ({npcNames.length})
          </span>
          <div className="flex items-center gap-1.5">
            <label className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-200 flex items-center gap-1 cursor-pointer">
              <FileText className="w-3.5 h-3.5" />
              <span>Nhập file .TXT</span>
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={handleImportTxtNames}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onResetNpcNames}
              className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mặc định</span>
            </button>
          </div>
        </div>

        <textarea
          rows={4}
          value={namesDraft}
          onChange={(e) => setNamesDraft(e.target.value)}
          placeholder="Mỗi dòng 1 tên người chơi (hoặc bấm Nhập file .TXT ở trên)..."
          className="w-full px-2.5 py-2 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
        />

        <button
          type="button"
          onClick={() => {
            const list = namesDraft
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (list.length > 0) {
              onUpdateNpcNames(list);
              showTempStatus(`Đã lưu ${list.length} tên NPC!`);
            }
          }}
          className="w-full py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-bold text-amber-300 border border-stone-700 cursor-pointer"
        >
          Lưu danh sách tên NPC
        </button>
      </section>

      {/* Section 3: NPC Avatars + Bulk Image Upload */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-200">
            Danh sách Avatar NPC ({npcAvatars.length} ảnh)
          </span>
          <div className="flex items-center gap-1.5">
            <label className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>
                {isUploadingAvatars ? 'Đang nén...' : 'Tải Ảnh Hàng Loạt'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkUploadAvatars}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onResetNpcAvatars}
              className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mặc định</span>
            </button>
          </div>
        </div>

        {/* Gợi ý kích cỡ ảnh Avatar nhẹ nhất */}
        <div className="p-2.5 rounded-lg bg-stone-950 border border-cyan-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-[10.5px] text-stone-300 leading-relaxed">
            <strong className="text-cyan-300">
              Kích cỡ ảnh Avatar nhẹ nhất nên dùng:
            </strong>{' '}
            <strong>128×128 px</strong> (hoặc 150×150 px), định dạng{' '}
            <strong>WebP / JPG</strong> (~5KB – 12KB/ảnh). Khi bấm{' '}
            <strong>Tải Ảnh Hàng Loạt</strong>, hệ thống tự động cắt vuông và
            nén về đúng <strong>128×128 px WebP</strong> nên tải hàng chục ảnh
            cùng lúc vẫn cực nhẹ!
          </div>
        </div>

        {/* Lưới xem trước các Avatar đã nạp */}
        {npcAvatars.length > 0 && (
          <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-stone-950 border border-stone-800">
            {npcAvatars.map((url, idx) => (
              <div
                key={`${idx}_${url.slice(0, 18)}`}
                className="relative group aspect-square rounded-full overflow-hidden border border-stone-700 bg-stone-900"
              >
                <img
                  src={url}
                  alt={`npc-${idx}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSingleAvatar(idx)}
                  title="Xóa ảnh này"
                  className="absolute inset-0 bg-stone-950/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          rows={2}
          value={avatarsDraft}
          onChange={(e) => setAvatarsDraft(e.target.value)}
          placeholder="Hoặc dán mỗi dòng 1 URL ảnh avatar..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[10.5px] text-stone-300 font-mono focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={() => {
            const list = avatarsDraft
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (list.length > 0) {
              onUpdateNpcAvatars(list);
              showTempStatus(`Đã lưu ${list.length} Avatar NPC!`);
            }
          }}
          className="w-full py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-bold text-amber-300 border border-stone-700 cursor-pointer"
        >
          Lưu danh sách Link Avatar
        </button>
      </section>
    </div>
  );
};
