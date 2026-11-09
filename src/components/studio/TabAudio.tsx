import React, { useEffect, useState } from 'react';
import {
  MessageSquareQuote,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DEFAULT_TTS_RANDOM_PHRASES } from '../../config/constants';
import { soundEngine } from '../../services/soundEngine';
import { GameConfig, TtsRandomPhraseItem } from '../../types/game';

interface TabAudioProps {
  config: GameConfig;
  ttsStatus: { text: string; active: boolean };
  eventTtsQueue: {
    waitingCount: number;
    isPlayingEvent: boolean;
    currentEventText: string | null;
    queueItems: string[];
  };
  onClearEventTtsQueue: () => void;
  onUpdateConfig: (patch: Partial<GameConfig>) => void;
  onPanicMute: () => void;
  onTestTTS: () => void;
}

export const TabAudio: React.FC<TabAudioProps> = ({
  config,
  ttsStatus,
  eventTtsQueue,
  onClearEventTtsQueue,
  onUpdateConfig,
  onPanicMute,
  onTestTTS,
}) => {
  const [liveDiagnostic, setLiveDiagnostic] = useState(() =>
    soundEngine.getEventQueueSnapshot().diagnostic
  );
  const [newPhraseText, setNewPhraseText] = useState('');
  const [newPhraseChance, setNewPhraseChance] = useState<number>(50);

  useEffect(() => {
    const unsub = soundEngine.subscribeEventQueue((snap) => {
      setLiveDiagnostic(snap.diagnostic);
    });
    return () => {
      unsub();
    };
  }, []);

  const waitingCount = eventTtsQueue.waitingCount;
  const isPlayingEvent = eventTtsQueue.isPlayingEvent;
  const currentEventText = eventTtsQueue.currentEventText;
  const queueItems = eventTtsQueue.queueItems;

  const randomPhrases: TtsRandomPhraseItem[] =
    Array.isArray(config.ttsRandomPhrases) && config.ttsRandomPhrases.length > 0
      ? config.ttsRandomPhrases
      : DEFAULT_TTS_RANDOM_PHRASES;

  const handleAddPhrase = () => {
    const clean = newPhraseText.trim();
    if (!clean) return;
    const item: TtsRandomPhraseItem = {
      id: `phrase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      chancePercent: Math.max(1, Math.min(100, Number(newPhraseChance) || 50)),
      enabled: true,
    };
    onUpdateConfig({
      ttsRandomPhrases: [...randomPhrases, item],
    });
    setNewPhraseText('');
  };

  const handleUpdatePhrase = (
    id: string,
    patch: Partial<TtsRandomPhraseItem>
  ) => {
    const next = randomPhrases.map((p) =>
      p.id === id ? { ...p, ...patch } : p
    );
    onUpdateConfig({ ttsRandomPhrases: next });
  };

  const handleRemovePhrase = (id: string) => {
    const next = randomPhrases.filter((p) => p.id !== id);
    onUpdateConfig({ ttsRandomPhrases: next });
  };

  const handleTestRoundStartTTS = () => {
    soundEngine.announceRoundStart(config.roundNumber || 69, config);
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Hàng chờ đọc sự kiện & Trạng thái Giọng Đọc AI #3 */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MessageSquareQuote className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold text-amber-200">
              Giọng Đọc AI #3 ({waitingCount}/{config.maxTtsQueueSize ?? 40})
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTestTTS}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3 h-3" />
              <span>Đọc thử</span>
            </button>
            <button
              type="button"
              onClick={onPanicMute}
              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <VolumeX className="w-3 h-3" />
              <span>Ngắt đọc</span>
            </button>
            {waitingCount > 0 && (
              <button
                type="button"
                onClick={onClearEventTtsQueue}
                className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-[10px] font-bold text-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa ({waitingCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Trạng thái Server Giọng đọc AI #3 */}
        <div className="p-2.5 rounded-lg bg-stone-950 border border-emerald-500/40 space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-emerald-300">
              {liveDiagnostic.configuredEngineLabel}
            </span>
            <span className="font-mono text-amber-300">
              {liveDiagnostic.activeServerLabel}
            </span>
          </div>
          <div className="text-[11px] text-stone-200 font-medium">
            {isPlayingEvent && currentEventText
              ? `Đang đọc: “${currentEventText}”`
              : ttsStatus.active
              ? ttsStatus.text
              : 'Sẵn sàng đọc sự kiện người chơi đến tỉnh & tặng quà'}
          </div>
        </div>

        {queueItems.length > 0 && (
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {queueItems.slice(0, 8).map((item, idx) => (
              <div
                key={`${idx}-${item.slice(0, 12)}`}
                className="text-[10px] text-stone-300 bg-stone-950 border border-stone-800 rounded px-2 py-1 truncate"
              >
                <span className="text-amber-400 font-bold mr-1">
                  #{idx + 1}:
                </span>
                {item}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Luồng Âm Thanh Khi Vòng X Bắt Đầu */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-emerald-500/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
            Luồng Âm Thanh Khi Vòng X Bắt Đầu
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestRoundStartTTS}
              className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[10px] font-bold text-emerald-200 flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Đọc thử</span>
            </button>
            <label className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.roundStartTtsEnabled !== false}
                onChange={(e) =>
                  onUpdateConfig({ roundStartTtsEnabled: e.target.checked })
                }
                className="accent-emerald-500 rounded cursor-pointer"
              />
              <span>Bật</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-stone-400 mb-1">
            Mẫu câu đọc khi bắt đầu vòng mới (Biến:{' '}
            <strong className="text-amber-300">[Vòng]</strong>):
          </label>
          <input
            type="text"
            value={
              config.roundStartTtsTemplate ||
              'Vòng [Vòng] bắt đầu, mời các bạn tham gia giao lưu với nhau!'
            }
            onChange={(e) =>
              onUpdateConfig({ roundStartTtsTemplate: e.target.value })
            }
            placeholder="Vòng [Vòng] bắt đầu, mời các bạn tham gia giao lưu với nhau!"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-emerald-400"
          />
        </div>
      </section>

      {/* 3. Mẫu câu đọc AI khi người chơi đến tỉnh & tặng quà */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200">
            Mẫu Câu Đọc Sự Kiện (Đến Tỉnh & Tặng Quà)
          </h2>
          <span className="text-[10px] font-mono text-amber-300">
            [Tên], [Điểm], [Tỉnh]
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-semibold text-emerald-300">
            1. Khi người chơi bình luận tên tỉnh (+{config.commentPoints} điểm):
          </label>
          <input
            type="text"
            value={config.commentGiftTtsTemplate}
            onChange={(e) =>
              onUpdateConfig({ commentGiftTtsTemplate: e.target.value })
            }
            placeholder="Bạn [Tên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-semibold text-rose-300">
            2. Khi người chơi tặng quà Hoa Hồng (+{config.rosePoints} điểm):
          </label>
          <input
            type="text"
            value={config.roseGiftTtsTemplate}
            onChange={(e) =>
              onUpdateConfig({ roseGiftTtsTemplate: e.target.value })
            }
            placeholder="[Tên] đã gửi hoa hồng kèm [Điểm] điểm về [Tỉnh]"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-rose-400"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-semibold text-amber-300">
            3. Khi gom toàn bộ người vào cùng tỉnh trong hàng chờ đọc 1 lúc:
          </label>
          <input
            type="text"
            value={
              config.batchGiftTtsTemplate ||
              'Các bạn [DanhSáchTên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm'
            }
            onChange={(e) =>
              onUpdateConfig({ batchGiftTtsTemplate: e.target.value })
            }
            placeholder="Các bạn [DanhSáchTên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-400"
          />
          <p className="text-[10px] text-stone-400 leading-snug">
            Mỗi lần đọc, hệ thống tự động kiểm tra toàn bộ hàng chờ có những ai vào cùng tỉnh và rút hết ra đọc 1 lúc tất cả các tên để giải phóng nhanh hàng chờ.
          </p>
        </div>
      </section>

      {/* 4. Mẫu Câu Chào / Câu Vu Vơ Đọc Kèm Sự Kiện + % Kích Hoạt */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-cyan-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              Câu Chào / Vu Vơ Đọc Kèm Sự Kiện ({randomPhrases.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                ttsRandomPhrases: DEFAULT_TTS_RANDOM_PHRASES,
                ttsRandomPhraseChancePercent: 35,
              })
            }
            className="text-[10.5px] text-stone-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>

        {/* Thanh trượt % xác suất tổng đọc kèm câu chào / vu vơ */}
        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-stone-200">
              Xác suất đọc thêm câu chào / vu vơ sau sự kiện:
            </span>
            <span className="font-mono font-black text-cyan-300">
              {config.ttsRandomPhraseChancePercent ?? 35}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.ttsRandomPhraseChancePercent ?? 35}
            onChange={(e) =>
              onUpdateConfig({
                ttsRandomPhraseChancePercent: Number(e.target.value),
              })
            }
            className="w-full accent-cyan-400 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
          />
          <p className="text-[10px] text-stone-400">
            Hỗ trợ biến <strong className="text-amber-300">[Tên]</strong> và{' '}
            <strong className="text-emerald-300">[Tỉnh]</strong> ngay trong mẫu câu.
          </p>
        </div>

        {/* Danh sách các mẫu câu kèm % kích hoạt của từng câu */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {randomPhrases.map((phrase) => (
            <div
              key={phrase.id}
              className="p-2 rounded-lg bg-stone-950 border border-stone-800 space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={phrase.enabled}
                  onChange={(e) =>
                    handleUpdatePhrase(phrase.id, { enabled: e.target.checked })
                  }
                  className="accent-cyan-400 rounded cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={phrase.text}
                  onChange={(e) =>
                    handleUpdatePhrase(phrase.id, { text: e.target.value })
                  }
                  className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs text-stone-100"
                  placeholder="Nhập mẫu câu chào / vu vơ..."
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhrase(phrase.id)}
                  className="p-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 cursor-pointer shrink-0"
                  title="Xóa mẫu câu này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <span className="text-[10px] text-stone-400 shrink-0">
                  % Kích hoạt câu này:
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={phrase.chancePercent ?? 50}
                  onChange={(e) =>
                    handleUpdatePhrase(phrase.id, {
                      chancePercent: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-amber-400 h-1 bg-stone-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] font-mono font-bold text-amber-300 w-9 text-right">
                  {phrase.chancePercent ?? 50}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Thêm mới mẫu câu kèm % kích hoạt */}
        <div className="p-2.5 rounded-lg bg-stone-950/90 border border-cyan-500/30 space-y-2">
          <div className="text-[11px] font-bold text-cyan-300">
            + Thêm Mẫu Câu Chào / Vu Vơ Mới
          </div>
          <input
            type="text"
            value={newPhraseText}
            onChange={(e) => setNewPhraseText(e.target.value)}
            placeholder="VD: Chào mừng [Tên] đã ghé thăm [Tỉnh] thân yêu nhé!"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10.5px] text-stone-400 shrink-0">
                % Kích hoạt:
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={newPhraseChance}
                onChange={(e) =>
                  setNewPhraseChance(
                    Math.max(1, Math.min(100, Number(e.target.value) || 50))
                  )
                }
                className="w-16 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs font-mono font-bold text-amber-300 text-center"
              />
              <span className="text-xs text-stone-400">%</span>
            </div>

            <button
              type="button"
              onClick={handleAddPhrase}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Mẫu Câu</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. Cấu hình Giọng đọc AI #3 (Node.js TTS / Google GTX / Edge AI) */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-200">
            Cấu Hình Giọng Đọc AI #3 (Node.js Local / GTX)
          </h2>
          <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.ttsEnabled}
              onChange={(e) => onUpdateConfig({ ttsEnabled: e.target.checked })}
              className="accent-emerald-500 rounded cursor-pointer"
            />
            <span>{config.ttsEnabled ? 'Đang Bật' : 'Đã Tắt'}</span>
          </label>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Chọn màu giọng AI #3:
            </label>
            <select
              value={config.nodeVoice}
              onChange={(e) => onUpdateConfig({ nodeVoice: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-amber-200 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="google-vi-gtx">
                1. Google Cloud GTX (Ổn định #1 - Nữ chuẩn)
              </option>
              <option value="google-vi-twob">
                2. Google Translate TW-OB (Ổn định #2 - Nữ dịu)
              </option>
              <option value="google-vi-bright">
                3. Google Nữ Cao Trong Trẻo (Sáng tiếng)
              </option>
              <option value="google-vi-slow">
                4. Google Nữ Trang Nghiêm (Nhịp chậm)
              </option>
              <option value="google-vi-warm">
                5. Google Trầm Ấm (Dày tiếng)
              </option>
              <option value="google-vi-male-deep">
                6. Google Nam Trầm (Giọng trầm sâu)
              </option>
              <option value="vi-VN-HoaiMyNeural">
                7. Edge AI - Hoài My Neural (Nữ truyền cảm)
              </option>
              <option value="vi-VN-NamMinhNeural">
                8. Edge AI - Nam Minh Neural (Nam trầm ấm)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Đường dẫn Server TTS #3 (tự động dự phòng Cloud nếu chưa bật CMD):
            </label>
            <input
              type="text"
              value={config.nodeTtsEndpoint}
              onChange={(e) =>
                onUpdateConfig({ nodeTtsEndpoint: e.target.value })
              }
              placeholder="http://localhost:8080/tts"
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs font-mono text-amber-300"
            />
          </div>
        </div>

        {/* Tốc độ, Cao độ, Âm lượng */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2 rounded-lg bg-stone-950 border border-stone-800">
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>Tốc độ</span>
              <span className="font-mono text-stone-200">
                {config.ttsRate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={2.0}
              step={0.05}
              value={config.ttsRate}
              onChange={(e) =>
                onUpdateConfig({ ttsRate: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-lg bg-stone-950 border border-stone-800">
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>Cao độ</span>
              <span className="font-mono text-stone-200">
                {config.ttsPitch.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={config.ttsPitch}
              onChange={(e) =>
                onUpdateConfig({ ttsPitch: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-lg bg-stone-950 border border-stone-800">
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>Âm lượng</span>
              <span className="font-mono text-stone-200">
                {Math.round(config.ttsVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={config.ttsVolume}
              onChange={(e) =>
                onUpdateConfig({ ttsVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
