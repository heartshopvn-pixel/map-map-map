import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Clock,
  Flower2,
  Gift,
  MessageSquare,
  RotateCcw,
  Send,
  Shuffle,
  Trash2,
  Trophy,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_HOW_TO_PLAY_CONFIG,
  DEFAULT_LAYOUT_VISIBILITY,
  HOW_TO_PLAY_BRIGHT_COLORS,
  HOW_TO_PLAY_FONTS,
} from '../../config/constants';
import { ActivityLogItem } from '../../hooks/useClassroomEngine';
import { EventTtsQueueSnapshot } from '../../services/soundEngine';
import {
  CameraQueueItem,
  GameConfig,
  GamePlayMode,
  HowToPlayBoardConfig,
  ProvinceCell,
} from '../../types/game';

interface TabControlProps {
  config: GameConfig;
  provinces: ProvinceCell[];
  activityLogs: ActivityLogItem[];
  ttsStatus: { text: string; active: boolean };
  eventTtsQueue: EventTtsQueueSnapshot;
  cameraQueue: CameraQueueItem[];
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  onSimulateComment: (
    username: string,
    comment: string,
    avatarUrl?: string | null,
    forceProvinceId?: string,
    forceIsRose?: boolean
  ) => boolean;
  onTriggerRandomGift: (
    isRose: boolean,
    specificProvinceId?: string,
    customUsername?: string,
    isNpc?: boolean,
    roseCountOverride?: number,
    isSpecialGift?: boolean,
    giftCoinsOverride?: number
  ) => void;
  onTriggerBatchSameProvince: (
    provinceId?: string,
    senderCount?: number,
    isRose?: boolean
  ) => void;
  onResetAllProvinces: () => void;
  onFocusProvince: (provinceId: string) => void;
  onTriggerTurboBatchRead: () => { ok: boolean; count: number };
  onClearEventTtsQueue: () => void;
  onClearCameraQueue: () => void;
  onTriggerSessionEndNow?: () => void;
}

export const TabControl: React.FC<TabControlProps> = ({
  config,
  provinces,
  activityLogs,
  ttsStatus,
  eventTtsQueue,
  cameraQueue,
  onUpdateConfig,
  onSimulateComment,
  onTriggerRandomGift,
  onTriggerBatchSameProvince,
  onResetAllProvinces,
  onFocusProvince,
  onTriggerTurboBatchRead,
  onClearEventTtsQueue,
  onClearCameraQueue,
  onTriggerSessionEndNow,
}) => {
  const [testUsername, setTestUsername] = useState('Minh Khang');
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>(
    provinces.find((p) => p.id === 'lang-son')?.id ||
      provinces[0]?.id ||
      'tp-ha-noi'
  );
  const [customComment, setCustomComment] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [turboToast, setTurboToast] = useState<string | null>(null);

  const howToPlay: HowToPlayBoardConfig = {
    ...DEFAULT_HOW_TO_PLAY_CONFIG,
    ...(config.howToPlayConfig || {}),
  };

  const visibilityMap = {
    ...DEFAULT_LAYOUT_VISIBILITY,
    ...(config.layoutVisibility || {}),
  };

  const updateHowToPlay = (patch: Partial<HowToPlayBoardConfig>) => {
    onUpdateConfig({
      howToPlayConfig: {
        ...howToPlay,
        ...patch,
      },
    });
  };

  const toggleHowToPlayVisibility = () => {
    const nextVal = !(visibilityMap.howToPlayBoard !== false);
    onUpdateConfig({
      layoutVisibility: {
        ...visibilityMap,
        howToPlayBoard: nextVal,
      },
    });
  };

  const rankedProvinces = useMemo(
    () =>
      [...provinces]
        .filter((p) => p.points > 0)
        .sort((a, b) => b.points - a.points),
    [provinces]
  );

  // Tổng hợp hàng chờ sự kiện âm thanh + hàng chờ camera tỉnh đang chờ đọc
  const combinedQueueDisplay = useMemo(() => {
    const items: Array<{
      id: string;
      badge: string;
      text: string;
      isTurbo?: boolean;
      isGift?: boolean;
    }> = [];

    for (const q of eventTtsQueue.detailedQueue) {
      const prov = q.meta?.provinceName?.replace(/^TP\.\s*/i, '');
      const user = q.meta?.username;
      const isSpecial = Boolean(q.meta?.isSpecialGift);
      const isGift = Boolean(q.meta?.isRose || isSpecial);
      items.push({
        id: q.id,
        badge: q.isTurboBatch
          ? '⚡ Siêu tốc'
          : isSpecial
          ? `🎁 ${prov || 'Quà ĐB'}`
          : isGift
          ? `🌹 ${prov || 'Hoa'}`
          : prov
          ? `🔊 ${prov}`
          : q.meta?.shortLabel || '🔊 Âm thanh',
        text:
          user && prov && !q.isTurboBatch
            ? `${user} ➔ ${prov} (+${q.meta?.pointsAdded || 1}đ)`
            : q.text,
        isTurbo: Boolean(q.isTurboBatch),
        isGift,
      });
    }

    for (const cam of cameraQueue) {
      const cleanProv = cam.provinceName.replace(/^TP\.\s*/i, '');
      items.push({
        id: cam.id,
        badge: `📍 ${cleanProv}`,
        text: `${cam.username} gửi +${cam.pointsAdded}đ về ${cleanProv}`,
        isGift: Boolean(cam.isRose),
      });
    }

    return items;
  }, [cameraQueue, eventTtsQueue.detailedQueue]);

  const selectablePendingCount = useMemo(() => {
    const nonTurboTtsProvinceCount = eventTtsQueue.detailedQueue.filter(
      (q) => !q.isTurboBatch && Boolean(q.meta?.provinceId)
    ).length;
    return nonTurboTtsProvinceCount + cameraQueue.length;
  }, [cameraQueue.length, eventTtsQueue.detailedQueue]);

  const handleClickTurboRead = () => {
    const res = onTriggerTurboBatchRead();
    if (res.ok) {
      setTurboToast(
        `⚡ Đã gom ${res.count} hàng chờ hiện tại để Đọc Siêu Tốc & Pan Camera nhanh! (Hàng chờ mới vẫn thêm bình thường)`
      );
    } else {
      setTurboToast(
        'ℹ️ Hiện chưa có hàng chờ tỉnh nào đang đợi. Bạn có thể bấm "+ Tạo 5 hàng chờ mẫu" để thử ngay!'
      );
    }
    setTimeout(() => setTurboToast(null), 4000);
  };

  const handleSpawn5QueueSamples = () => {
    for (let i = 0; i < 5; i++) {
      onTriggerRandomGift(i % 2 === 1, undefined, undefined, true, 1);
    }
    setTurboToast('✅ Đã đẩy nhanh 5 lượt vào hàng chờ! Bấm "⚡ Đọc Siêu Tốc" để rút gọn ngay.');
    setTimeout(() => setTurboToast(null), 3500);
  };

  const handleSendBySelect = (
    isRose: boolean,
    roseComboCount = 1,
    isSpecialGift = false,
    giftCoinsOverride?: number
  ) => {
    const prov = provinces.find((p) => p.id === selectedProvinceId);
    if (!prov) return;
    onTriggerRandomGift(
      isRose,
      prov.id,
      testUsername.trim() || 'Người Chơi',
      false,
      roseComboCount,
      isSpecialGift,
      giftCoinsOverride
    );
  };

  const handleSendFreeComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customComment.trim()) return;
    const uname = testUsername.trim() || 'Người Chơi';
    const matched = onSimulateComment(uname, customComment.trim());
    if (matched) {
      setFeedbackMsg(
        `✅ Đã cộng +${config.commentPoints}đ cho "${uname}" từ bình luận "${customComment}" (1 lần/phiên)`
      );
      setCustomComment('');
    } else {
      setFeedbackMsg(
        '⚠️ Không cộng điểm: Có thể bình luận chưa đúng tên tỉnh, hoặc người chơi này đã bình luận +1 điểm trong phiên rồi (hãy gửi Hoa Hồng để cộng không giới hạn điểm)!'
      );
    }
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const currentMode: GamePlayMode = config.gamePlayMode || 'session_top5';

  return (
    <div className="space-y-3.5">
      {/* 0. THẺ GIỌNG ĐỌC AI & HÀNG CHỜ SỰ KIỆN ÂM THANH (ĐẶT LÊN ĐẦU DEV ĐIỀU KHIỂN) + NÚT ĐỌC SIÊU TỐC */}
      <section className="p-3 rounded-xl bg-stone-900/95 border-2 border-amber-500/60 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Giọng Đọc AI & Hàng Chờ Sự Kiện Âm Thanh</span>
          </h2>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              eventTtsQueue.isPlayingEvent
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {eventTtsQueue.isPlayingEvent ? ttsStatus.text || 'Đang đọc' : 'Sẵn sàng'}
          </span>
        </div>

        {/* Câu đang phát hiện tại */}
        <div className="p-2 rounded-lg bg-stone-950 border border-stone-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-stone-400">
            <span>Đang phát trên Live:</span>
            <span className="font-mono font-bold text-amber-300">
              Đang chờ: {combinedQueueDisplay.length} mục (Có thể rút gọn:{' '}
              {selectablePendingCount})
            </span>
          </div>
          <div className="text-xs font-semibold text-stone-100 line-clamp-2 min-h-[32px] bg-stone-900/80 px-2.5 py-1.5 rounded border border-stone-800/80">
            {eventTtsQueue.currentEventText ||
              'Chưa có câu sự kiện nào đang phát...'}
          </div>
        </div>

        {/* Nút Bấm ĐỌC SIÊU TỐC (Chọn tất cả hàng chờ hiện tại để đọc hàng loạt + pan camera siêu nhanh) */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleClickTurboRead}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-md"
          >
            <Zap className="w-4 h-4 fill-stone-950" />
            <span>
              ⚡ ĐỌC SIÊU TỐC ({selectablePendingCount} HÀNG CHỜ HIỆN TẠI)
            </span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleSpawn5QueueSamples}
              className="py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10.5px] font-bold text-amber-200 flex items-center justify-center gap-1 cursor-pointer transition"
            >
              <Shuffle className="w-3 h-3 text-amber-400" />
              <span>+ Tạo 5 hàng chờ mẫu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClearEventTtsQueue();
                onClearCameraQueue();
              }}
              className="py-1.5 px-2 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-[10.5px] font-bold text-rose-200 flex items-center justify-center gap-1 cursor-pointer transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa sạch hàng chờ</span>
            </button>
          </div>
        </div>

        {turboToast && (
          <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/50 text-[10.5px] font-semibold text-amber-200">
            {turboToast}
          </div>
        )}

        {/* Danh sách chi tiết Hàng Chờ Các Sự Kiện Âm Thanh */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-stone-400">
            <span className="font-bold uppercase tracking-wider text-stone-300">
              Danh sách hàng chờ sự kiện âm thanh ({combinedQueueDisplay.length})
            </span>
            <span>Quà ưu tiên lên đầu</span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {combinedQueueDisplay.length === 0 ? (
              <div className="py-2.5 px-3 rounded-lg bg-stone-950 border border-stone-800/80 text-[10.5px] text-stone-500 text-center italic">
                Hàng chờ sự kiện âm thanh đang trống.
              </div>
            ) : (
              combinedQueueDisplay.map((item, idx) => (
                <div
                  key={item.id}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] ${
                    item.isTurbo
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-100'
                      : item.isGift
                      ? 'bg-gradient-to-r from-rose-950/70 to-amber-950/50 border-amber-400/70 text-amber-100'
                      : 'bg-stone-950 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-stone-500 shrink-0">
                      #{idx + 1}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold shrink-0 ${
                        item.isTurbo
                          ? 'bg-amber-400 text-stone-950'
                          : item.isGift
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-stone-800 text-amber-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                    <span className="truncate font-medium">{item.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 1. CHỌN CHẾ ĐỘ CHƠI ĐẦU TIÊN, ĐẶT TÊN PHIÊN CHƠI & TÙY CHỈNH NỘI DUNG */}
      <section className="p-3 rounded-xl bg-stone-900/95 border border-emerald-500/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>1. Chọn Chế Độ Chơi & Đặt Tên Phiên Chơi</span>
          </h2>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
            {currentMode === 'session_top5'
              ? 'Theo Phiên (Top 5)'
              : 'Tự Do Tích Lũy'}
          </span>
        </div>

        {/* Ô Đặt tên phiên chơi luôn hiển thị cho mọi chế độ */}
        <div className="p-2.5 rounded-lg bg-stone-950 border border-amber-500/35 space-y-1">
          <label className="block text-[10.5px] font-bold text-amber-300">
            ✏️ Đặt Tên Phiên Chơi (Hiển thị trên thanh tiêu đề & bảng tổng kết):
          </label>
          <input
            type="text"
            value={config.sessionTitle || 'Vòng gặp gỡ'}
            onChange={(e) => onUpdateConfig({ sessionTitle: e.target.value })}
            placeholder="VD: Vòng gặp gỡ / Đua Top Quê Hương / Phiên Giao Lưu..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs font-bold text-stone-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateConfig({ gamePlayMode: 'session_top5' })}
            className={`p-2 rounded-lg border text-left transition cursor-pointer ${
              currentMode === 'session_top5'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-900'
            }`}
          >
            <div className="text-xs font-extrabold flex items-center justify-between">
              <span>Gửi Quà Theo Phiên</span>
              {currentMode === 'session_top5' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5 leading-snug">
              Chia phiên theo thời gian X, hiện đồng hồ & biểu đồ cột Top 5 tỉnh
            </p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateConfig({ gamePlayMode: 'free_endless' })}
            className={`p-2 rounded-lg border text-left transition cursor-pointer ${
              currentMode === 'free_endless'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-900'
            }`}
          >
            <div className="text-xs font-extrabold flex items-center justify-between">
              <span>Tự Do Tích Lũy</span>
              {currentMode === 'free_endless' && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5 leading-snug">
              Cộng dồn điểm liên tục các vòng, chỉ hiện bản đồ & Top 1 nhiều nhất
            </p>
          </button>
        </div>

        {/* Tùy chỉnh chi tiết khi chọn Chế độ Gửi quà theo phiên */}
        {currentMode === 'session_top5' && (
          <div className="p-2.5 rounded-lg bg-stone-950 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10.5px] text-stone-300 font-semibold">
                Thời gian mỗi phiên X (giây):
              </label>
              <div className="flex items-center gap-1 w-28">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <input
                  type="number"
                  min={15}
                  max={3600}
                  value={config.sessionDurationSec || 180}
                  onChange={(e) =>
                    onUpdateConfig({
                      sessionDurationSec: Math.max(
                        15,
                        Number(e.target.value) || 60
                      ),
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Nút chọn nhanh thời gian X */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-stone-400 mr-1">
                Chọn nhanh X:
              </span>
              {[
                { label: '30 giây', sec: 30 },
                { label: '1 phút', sec: 60 },
                { label: '2 phút', sec: 120 },
                { label: '3 phút', sec: 180 },
                { label: '5 phút', sec: 300 },
              ].map((preset) => (
                <button
                  key={preset.sec}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ sessionDurationSec: preset.sec })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    (config.sessionDurationSec || 180) === preset.sec
                      ? 'bg-emerald-400 text-stone-950'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800">
              <label className="flex items-center gap-1.5 text-[11px] text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.sessionAutoResetPoints !== false}
                  onChange={(e) =>
                    onUpdateConfig({
                      sessionAutoResetPoints: e.target.checked,
                    })
                  }
                  className="accent-emerald-500 rounded cursor-pointer"
                />
                <span>Chỉ đọc xong tổng kết ➔ Chuyển sang phiên mới</span>
              </label>

              {onTriggerSessionEndNow && (
                <button
                  type="button"
                  onClick={onTriggerSessionEndNow}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10.5px] font-extrabold cursor-pointer transition shrink-0 shadow"
                >
                  🏆 Chốt Phiên Ngay
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 1. Test nhanh Đến Tỉnh (+1đ, 1 lần/phiên), Gửi Hoa Hồng (+5đ) & Quà Đặc Biệt (>1 coin) */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" />
            <span>2. Điều Khiển Đến Tỉnh, Hoa Hồng & Quà Đặc Biệt</span>
          </h2>
          <span className="text-[10px] font-mono text-emerald-300">
            1 coin = Hoa • &gt;1 coin = Quà ĐB (×5đ)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Tên người gửi thử:
            </label>
            <input
              type="text"
              value={testUsername}
              onChange={(e) => setTestUsername(e.target.value)}
              placeholder="Nhập tên người chơi..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Chọn Tỉnh / Thành phố:
            </label>
            <select
              value={selectedProvinceId}
              onChange={(e) => setSelectedProvinceId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-amber-200 focus:outline-none focus:border-amber-400"
            >
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.points}đ • Top1: {p.top1WinCount || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleSendBySelect(false, 1)}
            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Bình luận (+{config.commentPoints}đ • 1 lần)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendBySelect(true, 1, false, 1)}
            className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Flower2 className="w-3.5 h-3.5" />
            <span>Tặng Quà 1 Coin (+{config.rosePoints}đ)</span>
          </button>
        </div>

        {/* Nút Test Gửi Nhiều Hoa Hồng (Đọc câu cảm ơn nhiệt tình) & Quà Đặc Biệt (>1 coin) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSendBySelect(true, 5, false, 5)}
            className="py-2 px-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow"
          >
            <Flower2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              🌹×5 Combo 5 Hoa (+{(config.rosePoints || 5) * 5}đ)
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSendBySelect(true, 1, true, 10)}
            className="py-2 px-2.5 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-stone-950 font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow"
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              🎁 Quà Đặc Biệt 10 Coin (+{(config.rosePoints || 5) * 10}đ)
            </span>
          </button>
        </div>

        {/* Nút Test Gom Nhiều Người Cùng Tặng Về 1 Tỉnh */}
        <button
          type="button"
          onClick={() =>
            onTriggerBatchSameProvince(selectedProvinceId, 2, true)
          }
          className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-xs font-extrabold text-amber-200 flex items-center justify-center gap-1.5 cursor-pointer transition"
        >
          <Users className="w-3.5 h-3.5 text-amber-300" />
          <span>
            Test Gom 2 Người Cùng Tặng Hoa Về Tỉnh Này (Hiện 2 Avatar + Đọc Gộp)
          </span>
        </button>

        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onTriggerRandomGift(false)}
            className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
          >
            <Shuffle className="w-3 h-3" />
            <span>Ngẫu nhiên +{config.commentPoints}đ</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerRandomGift(true)}
            className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-rose-300 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
          >
            <Shuffle className="w-3 h-3" />
            <span>Ngẫu nhiên +{config.rosePoints}đ</span>
          </button>

          <button
            type="button"
            onClick={onResetAllProvinces}
            className="px-2 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-[11px] font-bold text-rose-200 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset 0đ</span>
          </button>
        </div>
      </section>

      {/* 2. Giả lập nhập Comment tên tỉnh như trên TikTok Live */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test Nhập Bình Luận Tên Tỉnh</span>
          </h2>
          <span className="text-[10px] text-stone-400">
            Tự động tách tên tỉnh
          </span>
        </div>

        <form onSubmit={handleSendFreeComment} className="flex gap-1.5">
          <input
            type="text"
            value={customComment}
            onChange={(e) => setCustomComment(e.target.value)}
            placeholder="VD: cho mình gửi quà về Lạng Sơn / tặng hoa Nghệ An..."
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer transition whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Bình luận</span>
          </button>
        </form>

        {feedbackMsg && (
          <div className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-amber-300">
            {feedbackMsg}
          </div>
        )}
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
            onClick={toggleHowToPlayVisibility}
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

      {/* 4. Bảng xếp hạng các Tỉnh đã có quà */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Các Tỉnh Đã Có Quà ({rankedProvinces.length}/34)</span>
          </h2>
          <span className="text-[10px] text-stone-400">
            Bấm vào tỉnh để Zoom Camera
          </span>
        </div>

        {rankedProvinces.length === 0 ? (
          <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-400 text-center">
            Chưa có tỉnh nào nhận quà. Khi điểm = 0, tên tỉnh sẽ ẩn trên map mặc định.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {rankedProvinces.map((prov, index) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => onFocusProvince(prov.id)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 flex items-center justify-between text-left cursor-pointer transition"
              >
                <div className="min-w-0 pr-1">
                  <span className="text-[10px] font-mono text-amber-400 mr-1">
                    #{index + 1}
                  </span>
                  <span className="text-xs font-bold text-stone-100 truncate">
                    {prov.name}
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-400 tabular-nums shrink-0">
                  {prov.points}đ
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 5. Lịch sử gửi quà gần đây */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200">
            Lịch Sử Gửi Quà Gần Nhất
          </h2>
          <span className="text-[10px] font-mono text-stone-400">
            {activityLogs.length} lượt
          </span>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
          {activityLogs.length === 0 ? (
            <div className="text-[11px] text-stone-500 italic py-2 text-center">
              Chưa có lượt gửi quà nào...
            </div>
          ) : (
            activityLogs.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800/80 flex items-center justify-between text-[11px]"
              >
                <div className="truncate pr-2">
                  <span className="font-mono text-[10px] text-stone-500 mr-1.5">
                    {item.time}
                  </span>
                  <span className="font-bold text-amber-200">
                    {item.username}
                  </span>
                  <span className="text-stone-400"> ➔ </span>
                  <span className="font-bold text-emerald-300">
                    {item.provinceName}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold shrink-0 ${
                    item.isRose ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {item.isRose
                    ? `🌹 +${item.pointsAdded}đ`
                    : `🎁 +${item.pointsAdded}đ`}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
