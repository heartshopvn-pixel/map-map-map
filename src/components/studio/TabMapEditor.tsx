import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Grid,
  ImagePlus,
  Info,
  MapPin,
  RotateCcw,
  Search,
} from 'lucide-react';
import { GameConfig, ProvinceCell } from '../../types/game';

interface TabMapEditorProps {
  config: GameConfig;
  provinces: ProvinceCell[];
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  onSetProvincePoints: (provinceId: string, points: number) => void;
  onRenameProvince: (provinceId: string, newName: string) => void;
  onResetAllProvinces: () => void;
  onFocusProvince: (provinceId: string) => void;
}

async function compressGiftIconFile(
  file: File,
  maxSize = 128
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.88));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const TabMapEditor: React.FC<TabMapEditorProps> = ({
  config,
  provinces,
  onUpdateConfig,
  onSetProvincePoints,
  onRenameProvince,
  onResetAllProvinces,
  onFocusProvince,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const filteredProvinces = provinces.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q))
    );
  });

  const cityCount = provinces.filter((p) => p.unitType === 'city').length;
  const provCount = provinces.filter((p) => p.unitType === 'province').length;
  const activeCount = provinces.filter((p) => p.points > 0).length;

  const startEditing = (p: ProvinceCell) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEditing = (provinceId: string) => {
    if (editName.trim()) {
      onRenameProvince(provinceId, editName.trim());
    }
    setEditingId(null);
  };

  const handleUploadGiftIcon = async (
    targetKey: 'roseIconUrl' | 'commentIconUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressGiftIconFile(file, 128);
      onUpdateConfig({ [targetKey]: dataUrl });
    } catch {
      // Ignore
    }
    e.target.value = '';
  };

  const renderIconPreview = (val: string | undefined, fallback: string) => {
    const src = val || fallback;
    if (
      src.startsWith('http') ||
      src.startsWith('data:image') ||
      src.startsWith('/')
    ) {
      return (
        <img
          src={src}
          alt="icon"
          className="w-8 h-8 object-contain rounded"
        />
      );
    }
    return <span className="text-xl">{src}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Section 0: Load Ảnh Icon Quà Tặng (Hoa Hồng, Quà Bình Luận...) */}
      <section className="rounded-xl bg-stone-900/90 border border-amber-500/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              Tải Ảnh Icon Quà Tặng (Hoa Hồng / Lời Chào)
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ roseIconUrl: '🌹', commentIconUrl: '👑' })
            }
            className="text-[10.5px] text-stone-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>

        {/* Tư vấn kích thước Icon tối ưu cho màn hình 1080x1920 */}
        <div className="p-2.5 rounded-lg bg-stone-950/95 border border-emerald-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[10.5px] text-stone-300 leading-relaxed">
            <strong className="text-emerald-300">
              Kích thước Icon chuẩn nhẹ & đẹp nhất cho màn 1080×1920:
            </strong>{' '}
            Nên dùng ảnh vuông <strong>128×128 px</strong> (hoặc tối đa{' '}
            <strong>256×256 px</strong>), định dạng{' '}
            <strong>PNG / WebP nền trong suốt</strong> (~10–25KB/ảnh). Khi tải
            ảnh lên tại đây, hệ thống tự động thu chuẩn 128×128px siêu nhẹ!
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {/* Icon Hoa Hồng */}
          <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                {renderIconPreview(config.roseIconUrl, '🌹')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-rose-300">
                  Icon Hoa Hồng (Quà Tặng)
                </div>
                <input
                  type="text"
                  value={config.roseIconUrl || '🌹'}
                  onChange={(e) =>
                    onUpdateConfig({ roseIconUrl: e.target.value })
                  }
                  placeholder="Dán link ảnh PNG hoặc Emoji 🌹..."
                  className="mt-1 w-full px-2 py-1 rounded bg-stone-900 border border-stone-800 text-[10.5px] text-stone-300 font-mono"
                />
              </div>
            </div>

            <label className="px-2.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold text-rose-200 flex items-center gap-1 cursor-pointer shrink-0">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Tải Ảnh</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadGiftIcon('roseIconUrl', e)}
                className="hidden"
              />
            </label>
          </div>

          {/* Icon Bình Luận / Quà Mặc Định */}
          <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                {renderIconPreview(config.commentIconUrl, '👑')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-amber-300">
                  Icon Bình Luận Tên Tỉnh
                </div>
                <input
                  type="text"
                  value={config.commentIconUrl || '👑'}
                  onChange={(e) =>
                    onUpdateConfig({ commentIconUrl: e.target.value })
                  }
                  placeholder="Dán link ảnh PNG hoặc Emoji 👑..."
                  className="mt-1 w-full px-2 py-1 rounded bg-stone-900 border border-stone-800 text-[10.5px] text-stone-300 font-mono"
                />
              </div>
            </div>

            <label className="px-2.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-200 flex items-center gap-1 cursor-pointer shrink-0">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Tải Ảnh</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadGiftIcon('commentIconUrl', e)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Section 1: Map Layout & Default Visibility Rules */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Bố Cục Bản Đồ ({provCount} Tỉnh + {cityCount} TP)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">
            {activeCount}/34 tỉnh có quà
          </span>
        </div>

        {/* Toggle Default Map Rule: Hide 0-point names */}
        <div className="p-2.5 rounded-lg bg-stone-950/90 border border-stone-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
              {config.showZeroPointProvinceNames ? (
                <Eye className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Ẩn tên tỉnh 0 điểm ở Map mặc định</span>
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">
              {config.showZeroPointProvinceNames
                ? 'Đang hiện tên tất cả 34 tỉnh/thành kể cả khi 0 điểm'
                : 'Chuẩn mặc định: Chỉ hiện tên + điểm của tỉnh đã có quà (> 0 điểm)'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                showZeroPointProvinceNames: !config.showZeroPointProvinceNames,
              })
            }
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition ${
              !config.showZeroPointProvinceNames
                ? 'bg-emerald-500 text-stone-950'
                : 'bg-stone-800 text-stone-300 border border-stone-700'
            }`}
          >
            {!config.showZeroPointProvinceNames ? 'ĐANG ẨN Ô 0Đ' : 'HIỆN TẤT CẢ'}
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Cỡ chữ Tên Tỉnh & Điểm</span>
              <span className="text-amber-300 font-mono font-bold">
                {config.tileFontSize}px
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={16}
              step={1}
              value={config.tileFontSize}
              onChange={(e) =>
                onUpdateConfig({ tileFontSize: Number(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Độ mảnh viền giữa các tỉnh</span>
              <span className="text-emerald-300 font-mono font-bold">
                {(config.mapInternalBorderWidth ?? 0.65).toFixed(2)}px
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.05}
              value={config.mapInternalBorderWidth ?? 0.65}
              onChange={(e) =>
                onUpdateConfig({
                  mapInternalBorderWidth: parseFloat(e.target.value),
                })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-400">Độ đậm viền giữa các tỉnh</span>
              <span className="text-cyan-300 font-mono font-bold">
                {Math.round((config.mapInternalBorderOpacity ?? 0.25) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={config.mapInternalBorderOpacity ?? 0.25}
              onChange={(e) =>
                onUpdateConfig({
                  mapInternalBorderOpacity: parseFloat(e.target.value),
                })
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Section 2: 34 Provinces & Cities List */}
      <section className="rounded-xl bg-stone-900/70 border border-stone-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Danh sách 28 Tỉnh & 6 Thành Phố
            </h2>
          </div>
          <button
            type="button"
            onClick={onResetAllProvinces}
            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset 0đ</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tỉnh/thành phố hoặc từ khóa..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-stone-800/70 rounded-lg border border-stone-800 bg-stone-950/60">
          {filteredProvinces.map((p, idx) => (
            <div key={p.id} className="p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono text-stone-500">
                    #{idx + 1}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      p.unitType === 'city'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {p.unitType === 'city' ? 'TP' : 'Tỉnh'}
                  </span>
                  <span className="font-bold text-stone-100 truncate">
                    {p.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onSetProvincePoints(p.id, Math.max(0, p.points - 1))
                    }
                    className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[11px] cursor-pointer"
                  >
                    -1
                  </button>
                  <span className="min-w-[36px] text-center font-mono font-bold text-emerald-400">
                    {p.points}đ
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetProvincePoints(p.id, p.points + 1)}
                    className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-emerald-300 font-mono text-[11px] cursor-pointer"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => onFocusProvince(p.id)}
                    className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-semibold cursor-pointer"
                  >
                    Zoom
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editingId === p.id ? setEditingId(null) : startEditing(p)
                    }
                    className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] cursor-pointer"
                  >
                    Sửa
                  </button>
                </div>
              </div>

              {editingId === p.id && (
                <div className="pt-1.5 space-y-1.5 border-t border-stone-800/80">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Tên hiển thị..."
                    className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(p.id)}
                    className="w-full py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-[11px] cursor-pointer"
                  >
                    Lưu cập nhật tên tỉnh
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
