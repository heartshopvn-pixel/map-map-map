import React, { useEffect, useState } from 'react';
import {
  Flower2,
  MessageSquareQuote,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_TTS_RANDOM_PHRASES,
  DEFAULT_WELCOME_JOIN_PHRASES,
} from '../../config/constants';
import { soundEngine } from '../../services/soundEngine';
import {
  BgmPlayMode,
  GameConfig,
  TtsRandomPhraseItem,
} from '../../types/game';

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
  const [bgmSnap, setBgmSnap] = useState(() => soundEngine.getBgmSnapshot());
  const [bgmUrlInput, setBgmUrlInput] = useState('');
  const [bgmUrlTitle, setBgmUrlTitle] = useState('');

  const [newWelcomeText, setNewWelcomeText] = useState('');
  const [testJoinName, setTestJoinName] = useState('Minh Khang');

  const [newPhraseText, setNewPhraseText] = useState('');
  const [newPhraseChance, setNewPhraseChance] = useState<number>(50);

  useEffect(() => {
    const unsub = soundEngine.subscribeEventQueue((snap) => {
      setLiveDiagnostic(snap.diagnostic);
    });
    const unsubBgm = soundEngine.subscribeBgmState((snap) => {
      setBgmSnap(snap);
    });
    return () => {
      unsub();
      unsubBgm();
    };
  }, []);

  const waitingCount = eventTtsQueue.waitingCount;
  const isPlayingEvent = eventTtsQueue.isPlayingEvent;
  const currentEventText = eventTtsQueue.currentEventText;
  const queueItems = eventTtsQueue.queueItems;

  const welcomePhrases: string[] =
    Array.isArray(config.welcomeJoinPhrases) &&
    config.welcomeJoinPhrases.length > 0
      ? config.welcomeJoinPhrases
      : DEFAULT_WELCOME_JOIN_PHRASES;

  const randomPhrases: TtsRandomPhraseItem[] =
    Array.isArray(config.ttsRandomPhrases) && config.ttsRandomPhrases.length > 0
      ? config.ttsRandomPhrases
      : DEFAULT_TTS_RANDOM_PHRASES;

  const handleUploadBgmFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    soundEngine.addBgmFiles(files);
    onUpdateConfig({ bgmEnabled: true });
    e.target.value = '';
  };

  const handleAddBgmByUrl = () => {
    const clean = bgmUrlInput.trim();
    if (!clean) return;
    soundEngine.addBgmUrl(bgmUrlTitle.trim() || '', clean);
    onUpdateConfig({ bgmEnabled: true });
    setBgmUrlInput('');
    setBgmUrlTitle('');
  };

  const handleChangeBgmPlayMode = (mode: BgmPlayMode) => {
    soundEngine.setBgmPlayMode(mode);
    onUpdateConfig({ bgmPlayMode: mode });
  };

  const handleChangeBgmVolume = (vol: number) => {
    soundEngine.setBgmVolume(vol);
    onUpdateConfig({ bgmVolume: vol });
  };

  const handleAddWelcomePhrase = () => {
    const clean = newWelcomeText.trim();
    if (!clean) return;
    onUpdateConfig({
      welcomeJoinPhrases: [...welcomePhrases, clean],
    });
    setNewWelcomeText('');
  };

  const handleUpdateWelcomePhrase = (idx: number, text: string) => {
    const next = welcomePhrases.map((item, i) => (i === idx ? text : item));
    onUpdateConfig({ welcomeJoinPhrases: next });
  };

  const handleRemoveWelcomePhrase = (idx: number) => {
    const next = welcomePhrases.filter((_, i) => i !== idx);
    onUpdateConfig({
      welcomeJoinPhrases:
        next.length > 0
          ? next
          : ['Hữu duyên gặp [Tên], bạn ở đâu đến đây thế?'],
    });
  };

  const handleTestWelcomeJoin = () => {
    soundEngine.enqueueWelcomeJoin(testJoinName.trim() || 'Minh Khang', {
      ...config,
      welcomeJoinEnabled: true,
    });
  };

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

  const handleTestMultiRoseTTS = () => {
    const sample = soundEngine.formatProvinceGiftSpeech(
      'Minh Khang',
      'Lạng Sơn',
      (config.rosePoints || 5) * 5,
      true,
      config,
      false,
      false,
      5
    );
    soundEngine.enqueueTTS(sample, true, config);
  };

  return (
    <div className="space-y-3.5">
      {/* 0. TRÌNH PHÁT NHẠC NỀN (BGM) - LẶP 1 BÀI HOẶC NEXT TỚI BÀI CUỐI QUAY LẠI BÀI ĐẦU */}
      <section className="p-3 rounded-xl bg-stone-900/95 border border-amber-500/45 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Music className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold text-amber-200 uppercase tracking-wide">
              Nhạc Nền (BGM) ({bgmSnap.tracks.length} bài)
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {bgmSnap.tracks.length > 0 && (
              <button
                type="button"
                onClick={() => soundEngine.broadcastBgmSync(true)}
                title="Đẩy đồng bộ danh sách nhạc nền và trạng thái phát sang màn hình Live ngay lập tức"
                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <span>📡 Đồng bộ Live</span>
              </button>
            )}
            <label className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition shadow">
              <Upload className="w-3 h-3" />
              <span>Load Nhạc Nền</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                multiple
                onChange={handleUploadBgmFiles}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Chế độ phát: Lặp 1 bài vs Next liên tục (hết bài cuối quay lại bài đầu) */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleChangeBgmPlayMode('loop_one')}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              bgmSnap.playMode === 'loop_one'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900'
            }`}
          >
            <Repeat1 className="w-3.5 h-3.5" />
            <span>Chế độ: Lặp 1 Bài</span>
          </button>

          <button
            type="button"
            onClick={() => handleChangeBgmPlayMode('next_all')}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              bgmSnap.playMode === 'next_all'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Next (Cuối ➔ Đầu)</span>
          </button>
        </div>

        {/* Bộ điều khiển Play / Pause / Prev / Next + Âm lượng nhạc nền */}
        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => soundEngine.playPrevBgmTrack()}
                disabled={bgmSnap.tracks.length === 0}
                className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 border border-stone-700 text-stone-200 cursor-pointer"
                title="Bài trước"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => soundEngine.toggleBgmPlay()}
                disabled={bgmSnap.tracks.length === 0}
                className={`px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1 cursor-pointer transition disabled:opacity-40 ${
                  bgmSnap.isPlaying
                    ? 'bg-emerald-400 text-stone-950'
                    : 'bg-amber-400 text-stone-950'
                }`}
              >
                {bgmSnap.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Phát nhạc</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => soundEngine.playNextBgmTrack()}
                disabled={bgmSnap.tracks.length === 0}
                className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 border border-stone-700 text-stone-200 cursor-pointer"
                title="Next sang bài kế tiếp (tới bài cuối tự về bài đầu)"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {bgmSnap.tracks.length > 0 && (
              <button
                type="button"
                onClick={() => soundEngine.clearAllBgmTracks()}
                className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-[10px] font-bold text-rose-200 cursor-pointer"
              >
                Xóa DS
              </button>
            )}
          </div>

          {/* Thanh chỉnh âm lượng nhạc nền */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-stone-400 shrink-0">
              Âm lượng BGM:
            </span>
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.02}
              value={bgmSnap.volume}
              onChange={(e) => handleChangeBgmVolume(parseFloat(e.target.value))}
              className="flex-1 accent-amber-400 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono font-bold text-amber-300 w-9 text-right">
              {Math.round(bgmSnap.volume * 100)}%
            </span>
          </div>

          {/* Danh sách bài nhạc nền đã load */}
          {bgmSnap.tracks.length === 0 ? (
            <div className="text-[10.5px] text-stone-400 italic text-center py-1">
              Chưa có bài nhạc nền nào. Bấm <strong>Load Nhạc Nền</strong> để
              chọn 1 hoặc nhiều file .mp3/.wav từ máy tính!
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {bgmSnap.tracks.map((track, idx) => {
                const isCurrent = idx === bgmSnap.currentIndex;
                return (
                  <div
                    key={track.id}
                    className={`px-2 py-1 rounded flex items-center justify-between gap-2 text-[11px] border ${
                      isCurrent
                        ? 'bg-emerald-950/70 border-emerald-400/60 text-emerald-200 font-bold'
                        : 'bg-stone-900/80 border-stone-800 text-stone-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => soundEngine.playBgmTrackAt(idx)}
                      className="flex-1 min-w-0 text-left truncate cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="font-mono text-[10px] text-amber-400">
                        #{idx + 1}
                      </span>
                      <span className="truncate">{track.name}</span>
                      {isCurrent && bgmSnap.isPlaying && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-400 text-stone-950 font-black shrink-0">
                          ĐANG PHÁT
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => soundEngine.removeBgmTrack(track.id)}
                      className="p-1 rounded hover:bg-rose-900/70 text-rose-300 cursor-pointer shrink-0"
                      title="Xóa bài này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Thêm link nhạc nền trực tiếp nếu muốn */}
          <div className="flex gap-1 pt-1 border-t border-stone-800/80">
            <input
              type="text"
              value={bgmUrlTitle}
              onChange={(e) => setBgmUrlTitle(e.target.value)}
              placeholder="Tên bài (tùy chọn)..."
              className="w-28 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-[10.5px] text-stone-200"
            />
            <input
              type="text"
              value={bgmUrlInput}
              onChange={(e) => setBgmUrlInput(e.target.value)}
              placeholder="Hoặc dán URL file nhạc .mp3..."
              className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-[10.5px] text-stone-200"
            />
            <button
              type="button"
              onClick={handleAddBgmByUrl}
              className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10.5px] font-bold text-amber-300 cursor-pointer shrink-0"
            >
              + Thêm
            </button>
          </div>
        </div>
      </section>

      {/* 1. CHẾ ĐỘ CHÀO NGƯỜI VÀO PHÒNG LIVE (BẬT / TẮT + THÊM MẪU CÂU KHÁC) */}
      <section className="p-3 rounded-xl bg-stone-900/95 border border-emerald-500/45 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
              Chế Độ Chào Người Vào Phòng ({welcomePhrases.length} mẫu)
            </h2>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(config.welcomeJoinEnabled)}
              onChange={(e) =>
                onUpdateConfig({ welcomeJoinEnabled: e.target.checked })
              }
              className="accent-emerald-500 rounded cursor-pointer"
            />
            <span>{config.welcomeJoinEnabled ? 'Đang Bật' : 'Đang Tắt'}</span>
          </label>
        </div>

        <p className="text-[10.5px] text-stone-300 leading-snug">
          Khi người xem vừa vào phòng TikTok Live, giọng đọc sẽ chào tự động
          (Biến: <strong className="text-amber-300">[Tên]</strong>). Mặc định:{' '}
          <em>“Hữu duyên gặp [Tên], bạn ở đâu đến đây thế?”</em>
        </p>

        {/* Thanh test đọc thử chào người vào phòng */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={testJoinName}
            onChange={(e) => setTestJoinName(e.target.value)}
            placeholder="Tên người vào phòng..."
            className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
          />
          <button
            type="button"
            onClick={handleTestWelcomeJoin}
            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Play className="w-3 h-3" />
            <span>Đọc thử câu chào</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                welcomeJoinPhrases: DEFAULT_WELCOME_JOIN_PHRASES,
              })
            }
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 cursor-pointer shrink-0"
            title="Khôi phục mẫu câu mặc định"
          >
            Mặc định
          </button>
        </div>

        {/* Danh sách các mẫu câu chào người vào phòng */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {welcomePhrases.map((phrase, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-emerald-400 w-5">
                #{idx + 1}
              </span>
              <input
                type="text"
                value={phrase}
                onChange={(e) => handleUpdateWelcomePhrase(idx, e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-950 border border-stone-700 text-xs text-stone-100"
              />
              <button
                type="button"
                onClick={() => handleRemoveWelcomePhrase(idx)}
                className="p-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 cursor-pointer shrink-0"
                title="Xóa mẫu câu này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Thêm mẫu câu chào mới */}
        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={newWelcomeText}
            onChange={(e) => setNewWelcomeText(e.target.value)}
            placeholder="Thêm mẫu câu khác (VD: Hữu duyên gặp [Tên], quê bạn ở tỉnh nào thế?)..."
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
          />
          <button
            type="button"
            onClick={handleAddWelcomePhrase}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </div>
      </section>

      {/* 2. Hàng chờ đọc sự kiện & Trạng thái Giọng Đọc AI #3 */}
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

      {/* 3. Luồng Âm Thanh Khi Vòng X Bắt Đầu */}
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

      {/* 4. Mẫu câu đọc AI khi người chơi đến tỉnh, tặng 1 hoa & gửi NHIỀU hoa hồng */}
      <section className="p-3 rounded-xl bg-stone-900/85 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200">
            Mẫu Câu Đọc Sự Kiện & Cảm Ơn Nhiệt Tình
          </h2>
          <span className="text-[10px] font-mono text-amber-300">
            [Tên], [SốHoa], [Điểm], [Tỉnh]
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-semibold text-emerald-300">
            1. Khi người chơi bình luận tên tỉnh (+{config.commentPoints} điểm, tối đa 1 lần/phiên):
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
            2. Khi người chơi tặng 1 Hoa Hồng (+{config.rosePoints} điểm):
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

        <div className="space-y-1.5 p-2 rounded-lg bg-rose-950/35 border border-rose-500/40">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-[10.5px] font-extrabold text-rose-200">
              3. Khi người chơi gửi NHIỀU Hoa Hồng (Lời cảm ơn nhiệt tình):
            </label>
            <button
              type="button"
              onClick={handleTestMultiRoseTTS}
              className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Đọc thử Combo Hoa</span>
            </button>
          </div>
          <input
            type="text"
            value={
              config.multiRoseGiftTtsTemplate ||
              'Tuyệt vời quá! Cảm ơn [Tên] thật nhiều đã gửi liền [SốHoa] bông hoa hồng kèm [Điểm] điểm rực rỡ về cho [Tỉnh]!'
            }
            onChange={(e) =>
              onUpdateConfig({ multiRoseGiftTtsTemplate: e.target.value })
            }
            placeholder="Tuyệt vời quá! Cảm ơn [Tên] thật nhiều đã gửi liền [SốHoa] bông hoa hồng kèm [Điểm] điểm về cho [Tỉnh]!"
            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-rose-500/50 text-xs text-stone-100 focus:outline-none focus:border-rose-400"
          />
          <p className="text-[10px] text-rose-200/80">
            Trong mỗi phiên, người chơi chỉ bình luận +1 điểm được 1 lần nhưng có
            thể tặng không giới hạn số lượng hoa hồng và điểm!
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-semibold text-amber-300">
            4. Khi gom toàn bộ người vào cùng tỉnh trong hàng chờ đọc 1 lúc:
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
        </div>
      </section>

      {/* 5. CÂU NÓI MỜI NGƯỜI CHƠI GỬI HOA HỒNG (CHÈN NGẪU NHIÊN THEO TỈ LỆ %) */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-rose-500/45 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Flower2 className="w-4 h-4 text-rose-400 shrink-0" />
            <h2 className="text-xs font-bold text-rose-300 uppercase tracking-wide">
              Câu Mời Người Chơi Gửi Hoa Hồng
            </h2>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-bold text-rose-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.rosePromptEnabled !== false}
              onChange={(e) =>
                onUpdateConfig({ rosePromptEnabled: e.target.checked })
              }
              className="accent-rose-500 rounded cursor-pointer"
            />
            <span>{config.rosePromptEnabled !== false ? 'Đang Bật' : 'Tắt'}</span>
          </label>
        </div>

        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-stone-200">
              Tỉ lệ xuất hiện câu mời gửi hoa hồng:
            </span>
            <span className="font-mono font-black text-rose-300">
              {config.rosePromptChancePercent ?? 25}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.rosePromptChancePercent ?? 25}
            onChange={(e) =>
              onUpdateConfig({
                rosePromptChancePercent: Number(e.target.value),
              })
            }
            className="w-full accent-rose-400 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
          />

          <div>
            <label className="block text-[10px] text-stone-400 mb-1">
              Format câu mời gửi hoa hồng (Biến hỗ trợ:{' '}
              <strong className="text-emerald-300">[Tỉnh]</strong>,{' '}
              <strong className="text-amber-300">[Tên]</strong>):
            </label>
            <input
              type="text"
              value={
                config.rosePromptTemplate ||
                'Các bạn ơi, hãy gửi hoa hồng ủng hộ cho tỉnh [Tỉnh] quê hương mình vươn lên dẫn đầu nhé!'
              }
              onChange={(e) =>
                onUpdateConfig({ rosePromptTemplate: e.target.value })
              }
              placeholder="Các bạn ơi, hãy gửi hoa hồng ủng hộ cho tỉnh quê hương mình nhé!"
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-rose-400"
            />
          </div>
        </div>
      </section>

      {/* 6. Mẫu Câu Chào / Câu Vu Vơ Đọc Kèm Sự Kiện + % Kích Hoạt */}
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

      {/* 7. Cấu hình Giọng đọc AI #3 (Node.js TTS / Google GTX / Edge AI) */}
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
