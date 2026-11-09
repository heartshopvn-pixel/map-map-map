import React, { useState } from 'react';
import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FileJson,
  ImagePlus,
  Layout,
  Move,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_GIFT_GUIDE_ITEMS,
  DEFAULT_HOW_TO_PLAY_CONFIG,
  DEFAULT_LAYOUT_POSITIONS,
  DEFAULT_LAYOUT_VISIBILITY,
  HOW_TO_PLAY_BRIGHT_COLORS,
  HOW_TO_PLAY_FONTS,
} from '../../config/constants';
import {
  GameConfig,
  GiftGuideItem,
  HowToPlayBoardConfig,
  LayoutElementKey,
} from '../../types/game';

interface TabLayoutProps {
  config: GameConfig;
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  onSaveBackupJson: () => void;
  onLoadBackupJson: (rawJsonText: string) => { ok: boolean; message: string };
}

const LAYOUT_ELEMENT_LABELS: {
  key: LayoutElementKey;
  title: string;
  desc: string;
}[] = [
  {
    key: 'howToPlayBoard',
    title: 'Bảng Hướng Dẫn Chơi Game (Nền tối)',
    desc: 'Bảng hướng dẫn luật chơi với 5 màu chữ sáng',
  },
  {
    key: 'headerBar',
    title: 'Tiêu đề Vòng gặp gỡ & Đồng hồ',
    desc: 'Thanh tiêu đề trên cùng màn hình',
  },
  {
    key: 'giftGuideIcons',
    title: 'Nút Gửi lời chào & Icon hướng dẫn quà',
    desc: 'Cụm icon Hoa hồng, Bình luận tên tỉnh...',
  },
  {
    key: 'visitingBar',
    title: 'Thanh Đang Ghé Thăm Tỉnh',
    desc: 'Hiện tên tỉnh đang zoom & tích lũy các live',
  },
  {
    key: 'sessionTimerCard',
    title: 'Thẻ Giờ Đếm Ngược Phiên',
    desc: 'Đồng hồ đếm ngược khi chọn chế độ Gửi quà theo phiên',
  },
  {
    key: 'sessionBarChartCard',
    title: 'Thẻ Xếp Hạng Biểu Đồ Cột Top 5',
    desc: 'Biểu đồ cột đơn giản có số điểm trên mỗi cột',
  },
  {
    key: 'bigAvatarZone',
    title: 'Vị trí Avatar To (Căn phải ➔ trái)',
    desc: 'Avatar lớn của người gửi quà xếp từ phải sang trái',
  },
  {
    key: 'giftToastBanner',
    title: 'Banner Bình luận & Quà vừa gửi',
    desc: 'Thông báo người chơi vừa bình luận / tặng hoa',
  },
  {
    key: 'bottomPodium',
    title: 'Bục Vinh Danh Top 3 Tỉnh (01, 02, 03)',
    desc: 'Khung 3 thẻ hạng Nhất, Nhì, Ba dưới đáy màn hình',
  },
];

async function resizeIconImageFile(
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

export const TabLayout: React.FC<TabLayoutProps> = ({
  config,
  onUpdateConfig,
  onSaveBackupJson,
  onLoadBackupJson,
}) => {
  const [newLabel, setNewLabel] = useState('Tặng Hoa Hồng');
  const [newIconUrl, setNewIconUrl] = useState('🌹');
  const [newStatType, setNewStatType] =
    useState<GiftGuideItem['statType']>('roses');
  const [newCustomBadge, setNewCustomBadge] = useState('+5đ');
  const [jsonToast, setJsonToast] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const guideItems =
    Array.isArray(config.giftGuideItems) && config.giftGuideItems.length > 0
      ? config.giftGuideItems
      : DEFAULT_GIFT_GUIDE_ITEMS;

  const howToPlay: HowToPlayBoardConfig = {
    ...DEFAULT_HOW_TO_PLAY_CONFIG,
    ...(config.howToPlayConfig || {}),
  };

  const visibilityMap = {
    ...DEFAULT_LAYOUT_VISIBILITY,
    ...(config.layoutVisibility || {}),
  };

  const handleUploadJsonFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const result = onLoadBackupJson(rawText);
      setJsonToast(result);
    } catch {
      setJsonToast({
        ok: false,
        message: 'Không thể đọc file JSON đã chọn!',
      });
    }
    e.target.value = '';
    setTimeout(() => setJsonToast(null), 4000);
  };

  const updateHowToPlay = (patch: Partial<HowToPlayBoardConfig>) => {
    onUpdateConfig({
      howToPlayConfig: {
        ...howToPlay,
        ...patch,
      },
    });
  };

  const handleToggleElementVisibility = (key: LayoutElementKey) => {
    const nextVal = !visibilityMap[key];
    const extraPatch: Partial<GameConfig> = {};
    if (key === 'bottomPodium') extraPatch.showBottomPodium = nextVal;
    if (key === 'giftToastBanner') extraPatch.showGiftToastBanner = nextVal;
    onUpdateConfig({
      ...extraPatch,
      layoutVisibility: {
        ...visibilityMap,
        [key]: nextVal,
      },
    });
  };

  const handleUpdateElementScale = (key: LayoutElementKey, scale: number) => {
    const cur = config.layoutPositions?.[key] || { x: 0, y: 0, scale: 1 };
    onUpdateConfig({
      layoutPositions: {
        ...DEFAULT_LAYOUT_POSITIONS,
        ...(config.layoutPositions || {}),
        [key]: {
          ...cur,
          ...{ scale },
        },
      },
    });
  };

  const handleResetAllPositions = () => {
    onUpdateConfig({
      layoutPositions: { ...DEFAULT_LAYOUT_POSITIONS },
      layoutVisibility: { ...DEFAULT_LAYOUT_VISIBILITY },
      showBottomPodium: true,
      showGiftToastBanner: true,
    });
  };

  const handleResetSinglePosition = (key: LayoutElementKey) => {
    onUpdateConfig({
      layoutPositions: {
        ...DEFAULT_LAYOUT_POSITIONS,
        ...(config.layoutPositions || {}),
        [key]: { x: 0, y: 0, scale: 1 },
      },
    });
  };

  const handleAddGuideItem = () => {
    if (!newLabel.trim()) return;
    const item: GiftGuideItem = {
      id: `guide_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: newLabel.trim(),
      iconUrl: newIconUrl.trim() || '🎁',
      statType: newStatType,
      customBadgeText: newCustomBadge.trim() || '+5đ',
      enabled: true,
    };
    onUpdateConfig({
      giftGuideItems: [...guideItems, item],
    });
    setNewLabel('');
  };

  const handleRemoveGuideItem = (id: string) => {
    const next = guideItems.filter((it) => it.id !== id);
    onUpdateConfig({
      giftGuideItems: next,
    });
  };

  const handleToggleGuideItem = (id: string) => {
    const next = guideItems.map((it) =>
      it.id === id ? { ...it, enabled: !it.enabled } : it
    );
    onUpdateConfig({
      giftGuideItems: next,
    });
  };

  const handleUpdateGuideItemField = (
    id: string,
    patch: Partial<GiftGuideItem>
  ) => {
    const next = guideItems.map((it) =>
      it.id === id ? { ...it, ...patch } : it
    );
    onUpdateConfig({
      giftGuideItems: next,
    });
  };

  const handleUploadNewGuideIcon = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeIconImageFile(file, 128);
      setNewIconUrl(dataUrl);
    } catch {
      // Ignore
    }
    e.target.value = '';
  };

  const handleUploadExistingGuideIcon = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeIconImageFile(file, 128);
      handleUpdateGuideItemField(id, { iconUrl: dataUrl });
    } catch {
      // Ignore
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 0. LƯU / TẢI FILE JSON (TẤT CẢ THIẾT LẬP + VỊ TRÍ LAYOUT) */}
      <section className="p-3.5 rounded-xl bg-stone-900/95 border border-emerald-500/45 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileJson className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
              Lưu / Tải JSON (Tất Cả Thiết Lập + Vị Trí Layout)
            </h2>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">.json</span>
        </div>

        <p className="text-[10.5px] text-stone-300 leading-relaxed">
          Lưu toàn bộ vị trí các bảng, tỉ lệ thu phóng (scale), trạng thái ẩn/hiện, bảng hướng dẫn, icon quà tặng và cấu hình phiên chơi ra file <strong>.json</strong> để nạp lại bất cứ lúc nào.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onSaveBackupJson();
              setJsonToast({
                ok: true,
                message:
                  'Đã tải xuống file JSON lưu toàn bộ thiết lập & vị trí Layout!',
              });
              setTimeout(() => setJsonToast(null), 3500);
            }}
            className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải Lưu File JSON</span>
          </button>

          <label className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow">
            <Upload className="w-3.5 h-3.5" />
            <span>Load File JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleUploadJsonFile}
              className="hidden"
            />
          </label>
        </div>

        {jsonToast && (
          <div
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
              jsonToast.ok
                ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
            }`}
          >
            {jsonToast.message}
          </div>
        )}
      </section>

      {/* 1. Chế độ Kéo Thả & Kéo Góc Thu Phóng Layout */}
      <section className="p-3.5 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layout className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              Chỉnh Layout (Kéo Thả & Kéo Góc Scale)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleResetAllPositions}
            className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset tất cả</span>
          </button>
        </div>

        {/* Nút Bật/Tắt Kéo Thả trên màn hình */}
        <button
          type="button"
          onClick={() =>
            onUpdateConfig({ layoutEditMode: !config.layoutEditMode })
          }
          className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow ${
            config.layoutEditMode
              ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-200'
              : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/40'
          }`}
        >
          <Move className="w-4 h-4" />
          <span>
            {config.layoutEditMode
              ? 'ĐANG BẬT CHỈNH LAYOUT (Kéo giữa để di chuyển • Kéo góc xanh ⤡ để thu phóng)'
              : 'BẬT CHỈNH LAYOUT (Cho phép kéo thả & bấm góc chỉnh kích thước)'}
          </span>
        </button>

        <p className="text-[10.5px] text-stone-400 leading-relaxed">
          Khi bật chỉnh Layout, mỗi bảng trên màn hình có <strong>4 chấm tròn màu xanh ở 4 góc (⤡)</strong>. Khi bấm vào góc kéo nhỏ hoặc phóng to, <strong>toàn bộ chữ, icon và nội dung bên trong bảng sẽ tự động scale theo tỉ lệ</strong>.
        </p>

        <button
          type="button"
          onClick={() =>
            onUpdateConfig({
              showSafeSquareGuide: !config.showSafeSquareGuide,
            })
          }
          className={`w-full px-2.5 py-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
            config.showSafeSquareGuide
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-800'
          }`}
        >
          <Square className="w-3.5 h-3.5" />
          <span>
            {config.showSafeSquareGuide
              ? 'Đang Hiện Khung Vuông An Toàn 540×540'
              : 'Hiện Khung Vuông An Toàn 540×540 Giữa Màn Hình'}
          </span>
        </button>
      </section>

      {/* 2. Ẩn / Hiện & Chỉnh Tỉ Lệ Scale Từng Bảng Trên Màn Hình */}
      <section className="p-3.5 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
            Ẩn / Hiện & Kích Thước Các Bảng ({LAYOUT_ELEMENT_LABELS.length})
          </h2>
          <span className="text-[10px] text-stone-400">
            Bấm Mắt để Ẩn/Hiện
          </span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {LAYOUT_ELEMENT_LABELS.map((el) => {
            const pos = config.layoutPositions?.[el.key] || {
              x: 0,
              y: 0,
              scale: 1,
            };
            const scaleVal = pos.scale ?? 1;
            const visible = visibilityMap[el.key] !== false;

            return (
              <div
                key={el.key}
                className={`p-2.5 rounded-lg border transition space-y-1.5 ${
                  visible
                    ? 'bg-stone-950 border-stone-800'
                    : 'bg-stone-950/40 border-stone-900 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-100 truncate">
                      {el.title}
                    </div>
                    <div className="text-[10px] text-stone-400 truncate">
                      X: <strong className="text-amber-300">{pos.x}px</strong> •
                      Y: <strong className="text-amber-300">{pos.y}px</strong> •
                      Scale:{' '}
                      <strong className="text-emerald-300">
                        {Math.round(scaleVal * 100)}%
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleElementVisibility(el.key)}
                      className={`px-2 py-1 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition ${
                        visible
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {visible ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Hiện</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Đang Ẩn</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResetSinglePosition(el.key)}
                      title="Đưa vị trí & kích thước về mặc định"
                      className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-semibold text-stone-300 cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Thanh trượt thu phóng nhanh (Scale nội dung bên trong) */}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] text-stone-400 shrink-0">
                    Thu phóng:
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.05}
                    value={scaleVal}
                    onChange={(e) =>
                      handleUpdateElementScale(
                        el.key,
                        parseFloat(e.target.value)
                      )
                    }
                    className="flex-1 accent-emerald-400 h-1 bg-stone-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] font-mono font-bold text-emerald-300 w-9 text-right">
                    {Math.round(scaleVal * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Bảng Hướng Dẫn Chơi Game (Nền tối + Chỉnh Size, Font, FontSize, 5 Màu Sáng) */}
      <section className="p-3.5 rounded-xl bg-stone-900/90 border border-cyan-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              Bảng Hướng Dẫn Chơi Game (Bảng Nền Tối)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleToggleElementVisibility('howToPlayBoard')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
              visibilityMap.howToPlayBoard !== false
                ? 'bg-emerald-500 text-stone-950'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {visibilityMap.howToPlayBoard !== false ? 'ĐANG HIỆN' : 'ĐANG ẨN'}
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Tiêu đề bảng hướng dẫn:
            </label>
            <input
              type="text"
              value={howToPlay.title}
              onChange={(e) => updateHowToPlay({ title: e.target.value })}
              placeholder="HƯỚNG DẪN CHƠI GAME..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
            />
          </div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Nội dung hướng dẫn:
            </label>
            <textarea
              rows={2}
              value={howToPlay.content}
              onChange={(e) => updateHowToPlay({ content: e.target.value })}
              placeholder="Nhập hướng dẫn chơi game..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
            />
          </div>

          {/* Chọn 5 màu sáng nổi bật trên nền tối */}
          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Chọn 5 Màu Sáng (Trên nền bảng tối):
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {HOW_TO_PLAY_BRIGHT_COLORS.map((col) => {
                const selected =
                  (howToPlay.textColor || '#FDE047').toUpperCase() ===
                  col.hex.toUpperCase();
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateHowToPlay({ textColor: col.hex })}
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-1 cursor-pointer transition ${
                      selected
                        ? 'bg-stone-800 border-white ring-1 ring-white'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-900'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/40 shadow"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span
                      className="truncate max-w-full text-[9px]"
                      style={{ color: col.hex }}
                    >
                      {col.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chọn Font chữ */}
          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Kiểu Font chữ:
            </label>
            <select
              value={howToPlay.fontFamily}
              onChange={(e) => updateHowToPlay({ fontFamily: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-amber-200"
            >
              {HOW_TO_PLAY_FONTS.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chỉnh Size bảng (Width) & FontSize */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-stone-950 border border-stone-800">
              <div className="flex justify-between text-[10.5px] mb-1">
                <span className="text-stone-400">Độ rộng bảng (Size):</span>
                <span className="font-mono font-bold text-cyan-300">
                  {howToPlay.widthPx}px
                </span>
              </div>
              <input
                type="range"
                min={160}
                max={500}
                step={5}
                value={howToPlay.widthPx || 250}
                onChange={(e) =>
                  updateHowToPlay({ widthPx: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded-lg bg-stone-950 border border-stone-800">
              <div className="flex justify-between text-[10.5px] mb-1">
                <span className="text-stone-400">Cỡ chữ (FontSize):</span>
                <span className="font-mono font-bold text-amber-300">
                  {howToPlay.fontSizePx}px
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={22}
                step={1}
                value={howToPlay.fontSizePx || 11}
                onChange={(e) =>
                  updateHowToPlay({ fontSizePx: Number(e.target.value) })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Thêm / Bớt Icon Hướng Dẫn Quà Tặng */}
      <section className="p-3.5 rounded-xl bg-stone-900/80 border border-stone-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
              Thêm / Bớt Icon Hướng Dẫn Quà Tặng ({guideItems.length})
            </h2>
            <p className="text-[10px] text-stone-400 mt-0.5">
              Khuyên dùng icon kích thước <strong>128×128 px</strong> (PNG/WebP trong suốt)
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ giftGuideItems: DEFAULT_GIFT_GUIDE_ITEMS })
            }
            className="text-[10.5px] text-stone-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {guideItems.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-stone-900 border border-stone-700 flex items-center justify-center overflow-hidden shrink-0 text-base">
                    {item.iconUrl.startsWith('http') ||
                    item.iconUrl.startsWith('data:image') ||
                    item.iconUrl.startsWith('/') ? (
                      <img
                        src={item.iconUrl}
                        alt={item.label}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span>{item.iconUrl}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      handleUpdateGuideItemField(item.id, {
                        label: e.target.value,
                      })
                    }
                    className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100 font-semibold"
                    placeholder="Tên hướng dẫn..."
                  />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <label className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-semibold text-amber-300 cursor-pointer flex items-center gap-1">
                    <ImagePlus className="w-3 h-3" />
                    <span>Ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleUploadExistingGuideIcon(item.id, e)
                      }
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleToggleGuideItem(item.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                      item.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {item.enabled ? 'Hiện' : 'Ẩn'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveGuideItem(item.id)}
                    className="p-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 cursor-pointer"
                    title="Xóa icon hướng dẫn này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                <input
                  type="text"
                  value={item.iconUrl}
                  onChange={(e) =>
                    handleUpdateGuideItemField(item.id, {
                      iconUrl: e.target.value,
                    })
                  }
                  placeholder="Emoji (🌹) hoặc URL ảnh..."
                  className="px-2 py-1 rounded bg-stone-900 border border-stone-800 text-stone-300 font-mono text-[10px]"
                />
                <select
                  value={item.statType}
                  onChange={(e) =>
                    handleUpdateGuideItemField(item.id, {
                      statType: e.target.value as GiftGuideItem['statType'],
                    })
                  }
                  className="px-2 py-1 rounded bg-stone-900 border border-stone-800 text-amber-200 text-[10px]"
                >
                  <option value="roses">Đếm tổng Hoa Hồng</option>
                  <option value="comments">Đếm tổng Bình Luận</option>
                  <option value="total_gifts">Đếm tổng Lượt Quà</option>
                  <option value="custom">Nhãn tùy chỉnh (+5đ...)</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Form thêm mới 1 icon hướng dẫn quà tặng */}
        <div className="p-2.5 rounded-lg bg-stone-950/90 border border-amber-500/30 space-y-2">
          <div className="text-[11px] font-bold text-amber-300">
            + Thêm Icon Hướng Dẫn Quà Tặng Mới
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Tên (VD: Gửi Tim +10đ)"
              className="px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100"
            />
            <div className="flex gap-1">
              <input
                type="text"
                value={newIconUrl}
                onChange={(e) => setNewIconUrl(e.target.value)}
                placeholder="Emoji hoặc URL..."
                className="flex-1 min-w-0 px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100"
              />
              <label className="px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] font-bold text-amber-300 flex items-center cursor-pointer shrink-0">
                <ImagePlus className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadNewGuideIcon}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={newStatType}
              onChange={(e) =>
                setNewStatType(e.target.value as GiftGuideItem['statType'])
              }
              className="px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-xs text-amber-200"
            >
              <option value="roses">Hiển thị số Hoa Hồng</option>
              <option value="comments">Hiển thị số Bình Luận</option>
              <option value="total_gifts">Hiển thị Tổng Lượt</option>
              <option value="custom">Hiển thị chữ tùy ý</option>
            </select>

            {newStatType === 'custom' ? (
              <input
                type="text"
                value={newCustomBadge}
                onChange={(e) => setNewCustomBadge(e.target.value)}
                placeholder="VD: +10đ"
                className="px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100"
              />
            ) : (
              <button
                type="button"
                onClick={handleAddGuideItem}
                className="py-1.5 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Icon</span>
              </button>
            )}
          </div>

          {newStatType === 'custom' && (
            <button
              type="button"
              onClick={handleAddGuideItem}
              className="w-full py-1.5 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Icon Hướng Dẫn</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
