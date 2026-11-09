import {
  DEFAULT_TTS_RANDOM_PHRASES,
  DEFAULT_WELCOME_JOIN_PHRASES,
} from '../config/constants';
import {
  BgmPlayMode,
  BgmTrackItem,
  CameraFocusReason,
  GameConfig,
} from '../types/game';

export type TTSStatusListener = (
  statusText: string,
  active: boolean,
  spokenText?: string
) => void;

export interface TTSQueueItemMeta {
  provinceId?: string;
  provinceName?: string;
  username?: string;
  usernamesList?: string[];
  reason?: CameraFocusReason;
  isRose?: boolean;
  isNpc?: boolean;
  pointsAdded?: number;
  totalRoses?: number;
}

export interface TTSQueueItem {
  id: string;
  text: string;
  isPriority: boolean;
  addedAt: number;
  meta?: TTSQueueItemMeta;
  onDone?: () => void;
}

export interface BgmStateSnapshot {
  tracks: BgmTrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  playMode: BgmPlayMode;
  volume: number;
}

export type BgmStateListener = (snapshot: BgmStateSnapshot) => void;

export interface TtsVoiceDiagnosticIncident {
  id: string;
  timestamp: number;
  type: 'fallback' | 'server_switch' | 'disconnected' | 'interrupted';
  fromSource: string;
  toSource: string;
  reason: string;
  textSample?: string;
}

export interface TtsVoiceDiagnosticSnapshot {
  health: 'healthy' | 'server_switched' | 'fallback' | 'disconnected';
  configuredEngineLabel: string;
  activeServerLabel: string;
  statusHeadline: string;
  statusDetail: string;
  lastLatencyMs: number | null;
  lastUpdatedAt: number;
  totalFallbacks: number;
  totalServerSwitches: number;
  totalDisconnects: number;
  recentIncidents: TtsVoiceDiagnosticIncident[];
}

export interface EventTtsQueueSnapshot {
  waitingCount: number;
  isPlayingEvent: boolean;
  currentEventText: string;
  queueItems: string[];
  activeItem: TTSQueueItem | null;
  detailedQueue: TTSQueueItem[];
  diagnostic: TtsVoiceDiagnosticSnapshot;
}

export type EventTtsQueueListener = (snapshot: EventTtsQueueSnapshot) => void;

export function sanitizeAndLimitSpeechText(
  rawText: string,
  maxWords = 45
): string {
  if (!rawText) return '';
  const cleaned = String(rawText)
    .replace(
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u2600-\u27BF\uFE00-\uFE0F\u200D]/gu,
      ' '
    )
    .replace(/[~`!@#$%^&*()_+={}[\]|\\:;"'<>/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  const limit = Math.max(5, Math.min(220, Number(maxWords) || 45));
  return words.slice(0, limit).join(' ');
}

/**
 * Tách câu văn dài thành các đoạn ngắn <= maxChars ký tự theo dấu chấm, phẩy hoặc khoảng trắng
 * để Google TTS / Node TTS không bao giờ cắt cụt câu ở giới hạn 200 ký tự.
 */
function splitSpeechIntoChunks(text: string, maxChars = 165): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const rawSentences = clean
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= maxChars) {
      if (
        chunks.length > 0 &&
        chunks[chunks.length - 1].length + 1 + sentence.length <= maxChars
      ) {
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${sentence}`;
      } else {
        chunks.push(sentence);
      }
      continue;
    }

    // Nếu 1 câu vẫn dài hơn maxChars, tách tiếp theo dấu phẩy hoặc khoảng trắng
    const clauses = sentence
      .split(/(?<=,)\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
    let current = '';
    for (const clause of clauses) {
      if (clause.length <= maxChars) {
        if (current && current.length + 1 + clause.length <= maxChars) {
          current = `${current} ${clause}`;
        } else {
          if (current) chunks.push(current);
          current = clause;
        }
      } else {
        if (current) {
          chunks.push(current);
          current = '';
        }
        const words = clause.split(/\s+/);
        let wordBuf = '';
        for (const w of words) {
          if (wordBuf && wordBuf.length + 1 + w.length > maxChars) {
            chunks.push(wordBuf);
            wordBuf = w;
          } else {
            wordBuf = wordBuf ? `${wordBuf} ${w}` : w;
          }
        }
        if (wordBuf) current = wordBuf;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [clean.slice(0, maxChars)];
}

const STORAGE_BGM_TRACKS_KEY = 'province_gift_bgm_tracks_v1';

class SoundService {
  private ctx: AudioContext | null = null;
  private ttsQueue: TTSQueueItem[] = [];
  private activeEventItem: TTSQueueItem | null = null;
  private isSpeaking = false;
  private currentEventText = '';
  private currentAudio: HTMLAudioElement | null = null;
  private speechTokenSeq = 0;
  private mutedSimTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<TTSStatusListener>();
  private queueListeners = new Set<EventTtsQueueListener>();
  private bgmListeners = new Set<BgmStateListener>();
  private latestConfig: GameConfig | null = null;
  private lastWelcomeJoinAt = 0;

  // Trình phát Nhạc Nền (BGM) trong Dev Âm Thanh
  private bgmTracks: BgmTrackItem[] = [];
  private currentBgmIndex = 0;
  private isBgmPlaying = false;
  private bgmPlayMode: BgmPlayMode = 'next_all';
  private bgmVolume = 0.35;
  private bgmAudio: HTMLAudioElement | null = null;

  private audioBlobCache = new Map<string, string>();
  private audioBlobMetaCache = new Map<
    string,
    {
      source: string;
      switchedMirror: boolean;
      failReason?: string;
      latencyMs: number;
    }
  >();
  private inFlightPrefetches = new Map<string, Promise<string | null>>();
  private readonly MAX_BLOB_CACHE = 50;

  private localTabMuted = (() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('obs') === '1' || p.get('view') === 'live') {
        return false;
      }
    }
    return sessionStorage.getItem('chua_silent_admin_tab') === 'true';
  })();

  private remoteSlaveMode = false;
  private remoteMasterQueueSnapshot: EventTtsQueueSnapshot | null = null;

  private ttsDiagnostic: TtsVoiceDiagnosticSnapshot = {
    health: 'healthy',
    configuredEngineLabel: '#3 Node.js Local (Edge/GTX)',
    activeServerLabel: 'Giọng đọc AI #3 (Sẵn sàng)',
    statusHeadline: 'Ổn định • Sẵn sàng phát Giọng đọc AI #3',
    statusDetail: 'Tự động kết nối Node.js (#3) & dự phòng /api/tts',
    lastLatencyMs: null,
    lastUpdatedAt: Date.now(),
    totalFallbacks: 0,
    totalServerSwitches: 0,
    totalDisconnects: 0,
    recentIncidents: [],
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedTracks = localStorage.getItem(STORAGE_BGM_TRACKS_KEY);
        if (savedTracks) {
          const parsed = JSON.parse(savedTracks);
          if (Array.isArray(parsed)) {
            this.bgmTracks = parsed.filter(
              (t) => t && typeof t.name === 'string' && typeof t.url === 'string'
            );
          }
        }
      } catch {
        // Ignore
      }

      const unlockAudio = () => {
        try {
          if (this.ctx && this.ctx.state === 'suspended') {
            void this.ctx.resume();
          }
        } catch {
          // Ignore
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  private saveBgmTracksToStorage() {
    try {
      // Lưu các bài nhạc (ưu tiên URL và Data URL vừa phải) để giữ danh sách nhạc nền
      const serializable = this.bgmTracks.filter(
        (t) => !t.url.startsWith('blob:') && t.url.length < 4 * 1024 * 1024
      );
      localStorage.setItem(
        STORAGE_BGM_TRACKS_KEY,
        JSON.stringify(serializable)
      );
    } catch {
      // Ignore quota errors for large files
    }
  }

  public getBgmSnapshot(): BgmStateSnapshot {
    return {
      tracks: [...this.bgmTracks],
      currentIndex: this.currentBgmIndex,
      isPlaying: this.isBgmPlaying,
      playMode: this.bgmPlayMode,
      volume: this.bgmVolume,
    };
  }

  public subscribeBgmState(fn: BgmStateListener) {
    this.bgmListeners.add(fn);
    fn(this.getBgmSnapshot());
    return () => this.bgmListeners.delete(fn);
  }

  private emitBgmState() {
    const snap = this.getBgmSnapshot();
    this.bgmListeners.forEach((fn) => fn(snap));
  }

  public addBgmFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const added: BgmTrackItem[] = files.map((file) => {
      const blobUrl = URL.createObjectURL(file);
      return {
        id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: blobUrl,
      };
    });

    const wasEmpty = this.bgmTracks.length === 0;
    this.bgmTracks = [...this.bgmTracks, ...added];
    if (wasEmpty) {
      this.currentBgmIndex = 0;
      this.playBgmTrackAt(0);
    } else {
      this.emitBgmState();
    }
  }

  public addBgmUrl(name: string, url: string) {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    const item: BgmTrackItem = {
      id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `Nhạc nền #${this.bgmTracks.length + 1}`,
      url: cleanUrl,
    };
    const wasEmpty = this.bgmTracks.length === 0;
    this.bgmTracks = [...this.bgmTracks, item];
    this.saveBgmTracksToStorage();
    if (wasEmpty) {
      this.currentBgmIndex = 0;
      this.playBgmTrackAt(0);
    } else {
      this.emitBgmState();
    }
  }

  public removeBgmTrack(id: string) {
    const idx = this.bgmTracks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const removed = this.bgmTracks[idx];
    if (removed.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed.url);
      } catch {
        // Ignore
      }
    }
    const nextTracks = this.bgmTracks.filter((t) => t.id !== id);
    this.bgmTracks = nextTracks;
    this.saveBgmTracksToStorage();

    if (nextTracks.length === 0) {
      this.stopBgmAudio();
      this.currentBgmIndex = 0;
      this.emitBgmState();
      return;
    }

    if (idx === this.currentBgmIndex) {
      const nextIdx = idx % nextTracks.length;
      this.currentBgmIndex = nextIdx;
      if (this.isBgmPlaying) {
        this.playBgmTrackAt(nextIdx);
      } else {
        this.emitBgmState();
      }
    } else if (idx < this.currentBgmIndex) {
      this.currentBgmIndex = Math.max(0, this.currentBgmIndex - 1);
      this.emitBgmState();
    } else {
      this.emitBgmState();
    }
  }

  public clearAllBgmTracks() {
    for (const t of this.bgmTracks) {
      if (t.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(t.url);
        } catch {
          // Ignore
        }
      }
    }
    this.bgmTracks = [];
    this.currentBgmIndex = 0;
    this.stopBgmAudio();
    this.saveBgmTracksToStorage();
    this.emitBgmState();
  }

  private stopBgmAudio() {
    this.isBgmPlaying = false;
    if (this.bgmAudio) {
      try {
        this.bgmAudio.onended = null;
        this.bgmAudio.onerror = null;
        this.bgmAudio.pause();
        this.bgmAudio.removeAttribute('src');
        this.bgmAudio = null;
      } catch {
        // Ignore
      }
    }
  }

  public playBgmTrackAt(index: number) {
    if (this.bgmTracks.length === 0) {
      this.stopBgmAudio();
      this.emitBgmState();
      return;
    }
    const safeIdx =
      ((index % this.bgmTracks.length) + this.bgmTracks.length) %
      this.bgmTracks.length;
    this.currentBgmIndex = safeIdx;
    const track = this.bgmTracks[safeIdx];

    if (this.bgmAudio) {
      try {
        this.bgmAudio.onended = null;
        this.bgmAudio.onerror = null;
        this.bgmAudio.pause();
      } catch {
        // Ignore
      }
    }

    const audio = new Audio(track.url);
    audio.volume = this.isTabMuted()
      ? 0
      : Math.max(0, Math.min(1, this.bgmVolume));
    audio.loop = this.bgmPlayMode === 'loop_one';

    audio.onended = () => {
      if (this.bgmTracks.length === 0) return;
      if (this.bgmPlayMode === 'loop_one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        // Chế độ Next: Chuyển sang bài kế tiếp, tới bài cuối thì tự động quay lại bài đầu tiên (index 0)
        const nextIdx = (this.currentBgmIndex + 1) % this.bgmTracks.length;
        this.playBgmTrackAt(nextIdx);
      }
    };

    audio.onerror = () => {
      if (this.bgmTracks.length > 1) {
        const nextIdx = (this.currentBgmIndex + 1) % this.bgmTracks.length;
        this.playBgmTrackAt(nextIdx);
      } else {
        this.isBgmPlaying = false;
        this.emitBgmState();
      }
    };

    this.bgmAudio = audio;
    this.isBgmPlaying = true;
    this.emitBgmState();

    audio.play().catch(() => {
      this.isBgmPlaying = false;
      this.emitBgmState();
    });
  }

  public toggleBgmPlay() {
    if (this.bgmTracks.length === 0) return;
    if (this.isBgmPlaying && this.bgmAudio) {
      this.bgmAudio.pause();
      this.isBgmPlaying = false;
      this.emitBgmState();
      return;
    }
    if (this.bgmAudio && this.bgmAudio.src) {
      this.bgmAudio.volume = this.isTabMuted()
        ? 0
        : Math.max(0, Math.min(1, this.bgmVolume));
      this.bgmAudio
        .play()
        .then(() => {
          this.isBgmPlaying = true;
          this.emitBgmState();
        })
        .catch(() => {
          this.playBgmTrackAt(this.currentBgmIndex);
        });
    } else {
      this.playBgmTrackAt(this.currentBgmIndex);
    }
  }

  public playNextBgmTrack() {
    if (this.bgmTracks.length === 0) return;
    const nextIdx = (this.currentBgmIndex + 1) % this.bgmTracks.length;
    this.playBgmTrackAt(nextIdx);
  }

  public playPrevBgmTrack() {
    if (this.bgmTracks.length === 0) return;
    const prevIdx =
      (this.currentBgmIndex - 1 + this.bgmTracks.length) %
      this.bgmTracks.length;
    this.playBgmTrackAt(prevIdx);
  }

  public setBgmPlayMode(mode: BgmPlayMode) {
    this.bgmPlayMode = mode;
    if (this.bgmAudio) {
      this.bgmAudio.loop = mode === 'loop_one';
    }
    this.emitBgmState();
  }

  public setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isTabMuted() ? 0 : this.bgmVolume;
    }
    this.emitBgmState();
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public isRemoteSlaveMode(): boolean {
    return this.remoteSlaveMode;
  }

  public setRemoteSlaveMode(active: boolean) {
    if (this.remoteSlaveMode === active) return;
    this.remoteSlaveMode = active;
    if (active) {
      this.stopImmediate();
      if (this.bgmAudio) {
        this.bgmAudio.volume = 0;
      }
    } else {
      this.remoteMasterQueueSnapshot = null;
      if (this.bgmAudio && !this.localTabMuted) {
        this.bgmAudio.volume = this.bgmVolume;
      }
    }
    this.emitEventQueue();
  }

  public applyMasterQueueSnapshot(
    snapshot: EventTtsQueueSnapshot,
    status?: { text: string; active: boolean }
  ) {
    if (!snapshot) return;
    this.remoteMasterQueueSnapshot = snapshot;
    if (snapshot.diagnostic) {
      this.ttsDiagnostic = snapshot.diagnostic;
    }
    if (status) {
      this.emitStatus(
        status.text,
        status.active,
        snapshot.currentEventText || ''
      );
    }
    const snap = this.getEventQueueSnapshot();
    this.queueListeners.forEach((fn) => fn(snap));
  }

  public isTabMuted(): boolean {
    return this.localTabMuted || this.remoteSlaveMode;
  }

  public setTabMuted(muted: boolean) {
    this.localTabMuted = muted;
    try {
      sessionStorage.setItem('chua_silent_admin_tab', muted ? 'true' : 'false');
    } catch {
      // Ignore
    }
    if (muted && this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {
        // Ignore
      }
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isTabMuted() ? 0 : this.bgmVolume;
    }
  }

  public subscribeStatus(fn: TTSStatusListener) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  public subscribeEventQueue(fn: EventTtsQueueListener) {
    this.queueListeners.add(fn);
    fn(this.getEventQueueSnapshot());
    return () => this.queueListeners.delete(fn);
  }

  private emitStatus(text: string, active: boolean, spokenText?: string) {
    this.statusListeners.forEach((fn) => fn(text, active, spokenText));
  }

  public getEventQueueSnapshot(): EventTtsQueueSnapshot {
    if (this.remoteSlaveMode && this.remoteMasterQueueSnapshot) {
      return this.remoteMasterQueueSnapshot;
    }
    return {
      waitingCount: this.ttsQueue.length,
      isPlayingEvent: this.isSpeaking,
      currentEventText: this.isSpeaking ? this.currentEventText : '',
      queueItems: this.ttsQueue.map((item) => item.text),
      activeItem: this.isSpeaking ? this.activeEventItem : null,
      detailedQueue: [...this.ttsQueue],
      diagnostic: {
        ...this.ttsDiagnostic,
        configuredEngineLabel: '#3 Node.js Local (Edge/GTX)',
        recentIncidents: [...this.ttsDiagnostic.recentIncidents],
      },
    };
  }

  private emitEventQueue() {
    const snap = this.getEventQueueSnapshot();
    this.queueListeners.forEach((fn) => fn(snap));
  }

  public clearTtsDiagnosticHistory() {
    this.ttsDiagnostic = {
      ...this.ttsDiagnostic,
      health: 'healthy',
      statusHeadline: 'Ổn định • Đã làm mới bộ đếm Giọng đọc AI #3',
      statusDetail: 'Đang giám sát kết nối máy chủ giọng đọc theo thời gian thực',
      lastUpdatedAt: Date.now(),
      totalFallbacks: 0,
      totalServerSwitches: 0,
      totalDisconnects: 0,
      recentIncidents: [],
    };
    this.emitEventQueue();
  }

  public syncConfig(config: GameConfig) {
    this.latestConfig = config;
    if (config.bgmPlayMode && config.bgmPlayMode !== this.bgmPlayMode) {
      this.setBgmPlayMode(config.bgmPlayMode);
    }
    if (
      typeof config.bgmVolume === 'number' &&
      Math.abs(config.bgmVolume - this.bgmVolume) > 0.005
    ) {
      this.setBgmVolume(config.bgmVolume);
    }
    if (this.currentAudio) {
      try {
        const { effectiveRate, preservePitch } =
          this.computeStreamPlaybackRateAndPitch(
            config.nodeVoice || 'google-vi-gtx',
            config
          );
        this.applyAudioPlaybackParams(
          this.currentAudio,
          effectiveRate,
          preservePitch,
          config.ttsVolume
        );
      } catch {
        // Ignore
      }
    }
  }

  public isBusySpeakingOrQueued(): boolean {
    return this.isSpeaking || this.ttsQueue.length > 0;
  }

  public clearEventQueue() {
    const callbacks = [
      this.activeEventItem?.onDone,
      ...this.ttsQueue.map((q) => q.onDone),
    ].filter(Boolean) as Array<() => void>;
    this.ttsQueue = [];
    this.stopCurrentUtteranceOnly();
    this.emitEventQueue();
    for (const cb of callbacks) {
      try {
        cb();
      } catch {
        // Ignore
      }
    }
  }

  public stopImmediate() {
    const callbacks = [
      this.activeEventItem?.onDone,
      ...this.ttsQueue.map((q) => q.onDone),
    ].filter(Boolean) as Array<() => void>;
    this.ttsQueue = [];
    this.stopCurrentUtteranceOnly();
    this.emitStatus('Đã ngắt đọc', false, '');
    this.emitEventQueue();
    for (const cb of callbacks) {
      try {
        cb();
      } catch {
        // Ignore
      }
    }
  }

  private stopCurrentUtteranceOnly() {
    this.speechTokenSeq++;
    this.isSpeaking = false;
    this.currentEventText = '';
    this.activeEventItem = null;
    if (this.mutedSimTimer) {
      clearTimeout(this.mutedSimTimer);
      this.mutedSimTimer = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.removeAttribute('src');
        this.currentAudio.load();
        this.currentAudio = null;
      } catch {
        // Ignore
      }
    }
    this.emitStatus('Sẵn sàng', false, '');
    this.emitEventQueue();
  }

  /**
   * Âm thanh hiệu ứng khi ném Avatar vào tỉnh (+1đ hoặc Hoa hồng +5đ)
   */
  public playGiftThrowSfx(isRose: boolean, volume = 0.7) {
    if (this.isTabMuted()) return;
    const cfg = this.latestConfig;
    if (cfg && cfg.sfxEnabled === false) return;

    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const safeVol = Math.max(0.05, Math.min(1, cfg?.sfxVolume ?? volume));

      const notes = isRose
        ? [523.25, 659.25, 783.99, 1046.5] // Hợp âm tươi sáng khi gửi Hoa hồng (+5đ)
        : [440, 587.33]; // Chime nhẹ nhàng khi bình luận đến tỉnh (+1đ)

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const start = now + idx * 0.065;
        const dur = idx === notes.length - 1 ? 0.32 : 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isRose ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.22 * safeVol, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Nhạc hiệu bắt đầu vòng chơi mới
   */
  public playRoundStartChimeSfx(volume = 0.75) {
    if (this.isTabMuted()) return;
    const cfg = this.latestConfig;
    if (cfg && cfg.sfxEnabled === false) return;

    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const safeVol = Math.max(0.05, Math.min(1, cfg?.sfxVolume ?? volume));
      const startNotes = [392.0, 523.25, 659.25, 783.99];

      startNotes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const start = now + idx * 0.085;
        const dur = idx === startNotes.length - 1 ? 0.42 : 0.15;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.24 * safeVol, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Nhạc hiệu vinh danh khi kết thúc phiên chơi (Chốt Top 3 tỉnh cao nhất)
   */
  public playSessionEndFanfareSfx(volume = 0.8) {
    if (this.isTabMuted()) return;
    const cfg = this.latestConfig;
    if (cfg && cfg.sfxEnabled === false) return;

    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const safeVol = Math.max(0.05, Math.min(1, cfg?.sfxVolume ?? volume));
      const fanfareNotes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];

      fanfareNotes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const start = now + idx * 0.11;
        const dur = idx === fanfareNotes.length - 1 ? 0.55 : 0.16;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.26 * safeVol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.03);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Chế độ chào người vào phòng Live:
   * "Hữu duyên gặp [Tên], bạn ở đâu đến đây thế?" (hoặc các mẫu câu khác do người dùng thêm)
   */
  public enqueueWelcomeJoin(
    username: string,
    config: GameConfig,
    force = false
  ): boolean {
    this.latestConfig = config;
    if (!config.ttsEnabled) return false;
    if (!force && config.welcomeJoinEnabled === false) return false;

    const now = Date.now();
    // Chống spam khi có quá nhiều người vào phòng cùng lúc hoặc hàng chờ đọc quà đang dài
    if (!force) {
      if (now - this.lastWelcomeJoinAt < 4000) return false;
      if (this.ttsQueue.length >= 4) return false;
    }
    this.lastWelcomeJoinAt = now;

    const phrases =
      Array.isArray(config.welcomeJoinPhrases) &&
      config.welcomeJoinPhrases.length > 0
        ? config.welcomeJoinPhrases.filter((p) => p && p.trim().length > 0)
        : DEFAULT_WELCOME_JOIN_PHRASES;

    if (phrases.length === 0) return false;
    const chosen = phrases[Math.floor(Math.random() * phrases.length)];
    const cleanUser = (username || 'Bạn mới').replace(/^@+/, '').trim();
    const formatted = chosen
      .replace(/\[Tên\]|\[tên\]|\{name\}|\bA\b/g, cleanUser)
      .replace(/\s+/g, ' ')
      .trim();

    const clean = sanitizeAndLimitSpeechText(formatted, 45);
    if (!clean) return false;

    this.ttsQueue.push({
      id: `welcome_join_${now}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      isPriority: false,
      addedAt: now,
    });
    this.emitEventQueue();
    this.processQueue(config);
    return true;
  }

  /**
   * Đọc luồng âm thanh khi Vòng X bắt đầu:
   * "Vòng X bắt đầu, mời các bạn tham gia giao lưu với nhau!"
   */
  public announceRoundStart(
    roundNumber: number,
    config: GameConfig,
    onDone?: () => void
  ) {
    this.latestConfig = config;
    if (config.roundStartTtsEnabled === false || !config.ttsEnabled) {
      if (onDone) onDone();
      return;
    }

    this.playRoundStartChimeSfx(config.sfxVolume);

    const rawTemplate =
      config.roundStartTtsTemplate ||
      'Vòng [Vòng] bắt đầu, mời các bạn tham gia giao lưu với nhau!';
    const sessionName = config.sessionTitle || 'Vòng';
    const formatted = rawTemplate
      .replace(
        /\[Vòng\]|\[vòng\]|\[Phiên\]|\[phiên\]|\{round\}/gi,
        String(roundNumber)
      )
      .replace(/\[TênPhiên\]|\[tênphiên\]/gi, sessionName)
      .replace(/\s+/g, ' ')
      .trim();

    const clean = sanitizeAndLimitSpeechText(formatted, 45);
    if (!clean) {
      if (onDone) onDone();
      return;
    }

    this.ttsQueue.unshift({
      id: `round_start_${roundNumber}_${Date.now()}`,
      text: clean,
      isPriority: true,
      addedAt: Date.now(),
      onDone,
    });
    this.emitEventQueue();
    this.processQueue(config);
  }

  /**
   * Đọc thông báo Tổng kết Top 3 tỉnh dẫn đầu phiên:
   * - Nếu người đọc đang đọc dở câu sự kiện cuối cùng của phiên thì đợi đọc nốt câu đó xong rồi đọc tiếp ngay phần tổng kết (không cắt ngang giọng đọc).
   * - Đọc lần lượt đầy đủ tất cả các câu trong bản tổng kết (Hạng 1, Hạng 2, Hạng 3 kèm tên người tặng điểm nhiều nhất).
   * - Chỉ khi người đọc ĐỌC XONG HẾT toàn bộ câu cuối cùng của bản tổng kết mới gọi `onDone()` để chuyển sang phiên game mới!
   */
  public announceSessionResultNow(
    summaryInput: string | string[],
    config: GameConfig,
    onDone?: () => void
  ) {
    this.latestConfig = config;
    // Xóa các câu sự kiện chưa đọc trong hàng chờ âm thanh (các lượt quà chưa zoom đã được bảo lưu ở cameraQueue sang phiên sau)
    // nhưng KHÔNG ngắt câu đang phát dở để người đọc đọc trọn vẹn câu hiện tại rồi đọc luôn tổng kết.
    this.ttsQueue = [];
    this.playSessionEndFanfareSfx(config.sfxVolume);

    if (!config.ttsEnabled) {
      if (onDone) {
        setTimeout(onDone, 3000);
      }
      return;
    }

    const rawList = Array.isArray(summaryInput) ? summaryInput : [summaryInput];
    const cleanSentences: string[] = [];
    for (const part of rawList) {
      const sanitized = sanitizeAndLimitSpeechText(part, 180);
      if (sanitized) {
        const subChunks = splitSpeechIntoChunks(sanitized, 165);
        cleanSentences.push(...subChunks);
      }
    }

    if (cleanSentences.length === 0) {
      if (onDone) {
        setTimeout(onDone, 2000);
      }
      return;
    }

    const now = Date.now();
    cleanSentences.forEach((sentence, idx) => {
      const isLast = idx === cleanSentences.length - 1;
      this.ttsQueue.push({
        id: `session_end_${now}_${idx}`,
        text: sentence,
        isPriority: true,
        addedAt: now + idx,
        onDone: isLast ? onDone : undefined,
      });
    });

    this.emitEventQueue();
    this.processQueue(config);
  }

  /**
   * Thỉnh thoảng chèn câu nói mời người chơi gửi hoa hồng theo format và tỉ lệ % xuất hiện
   */
  private pickRosePromptSuffix(
    username: string,
    cleanProvince: string,
    config: GameConfig
  ): string {
    if (config.rosePromptEnabled === false) return '';
    const chance = Math.max(
      0,
      Math.min(100, config.rosePromptChancePercent ?? 25)
    );
    if (chance <= 0) return '';
    if (Math.random() * 100 > chance) return '';

    const rawPrompt = (
      config.rosePromptTemplate ||
      'Mời các bạn thả hoa hồng để cộng thật nhiều điểm giúp tỉnh quê mình bứt phá lên top 1 nào!'
    ).trim();
    if (!rawPrompt) return '';

    return rawPrompt
      .replace(/\[Tên\]|\[tên\]|\{name\}/gi, username)
      .replace(/\[Tỉnh\]|\[tỉnh\]|\{province\}/gi, cleanProvince)
      .trim();
  }

  /**
   * Chọn ngẫu nhiên 1 câu chào / câu vu vơ theo % xác suất kích hoạt trong Tab Âm Thanh
   */
  private pickRandomGreetingSuffix(
    username: string,
    cleanProvince: string,
    config: GameConfig
  ): string {
    const masterChance = Math.max(
      0,
      Math.min(100, config.ttsRandomPhraseChancePercent ?? 35)
    );
    if (masterChance <= 0) return '';
    if (Math.random() * 100 > masterChance) return '';

    const phrases =
      Array.isArray(config.ttsRandomPhrases) &&
      config.ttsRandomPhrases.length > 0
        ? config.ttsRandomPhrases
        : DEFAULT_TTS_RANDOM_PHRASES;

    const activePool = phrases.filter(
      (p) => p.enabled && p.text.trim().length > 0 && (p.chancePercent ?? 50) > 0
    );
    if (activePool.length === 0) return '';

    const triggeredPool = activePool.filter(
      (p) => Math.random() * 100 <= Math.max(1, Math.min(100, p.chancePercent))
    );
    const poolToUse = triggeredPool.length > 0 ? triggeredPool : activePool;

    const totalWeight = poolToUse.reduce(
      (sum, item) => sum + Math.max(1, item.chancePercent || 50),
      0
    );
    let roll = Math.random() * totalWeight;
    let chosen = poolToUse[0];
    for (const item of poolToUse) {
      roll -= Math.max(1, item.chancePercent || 50);
      if (roll <= 0) {
        chosen = item;
        break;
      }
    }

    return chosen.text
      .replace(/\[Tên\]|\[tên\]|\{name\}/gi, username)
      .replace(/\[Tỉnh\]|\[tỉnh\]|\{province\}/gi, cleanProvince)
      .trim();
  }

  /**
   * Kiểm tra xem sự kiện của tỉnh `provinceId` có đang được Giọng đọc AI #3 đọc dở
   * hoặc vẫn còn nằm trong hàng đợi đọc (ttsQueue) hay không.
   * Giúp Camera ưu tiên giữ nguyên Zoom ở tỉnh đó cho tới khi đọc xong sự kiện!
   */
  public isSpeakingOrQueuedForProvince(provinceId: string): boolean {
    if (!provinceId) return false;
    if (this.remoteSlaveMode && this.remoteMasterQueueSnapshot) {
      const activeMatch =
        this.remoteMasterQueueSnapshot.isPlayingEvent &&
        this.remoteMasterQueueSnapshot.activeItem?.meta?.provinceId ===
          provinceId;
      const queuedMatch =
        Array.isArray(this.remoteMasterQueueSnapshot.detailedQueue) &&
        this.remoteMasterQueueSnapshot.detailedQueue.some(
          (q) => q.meta?.provinceId === provinceId
        );
      return Boolean(activeMatch || queuedMatch);
    }
    if (
      this.isSpeaking &&
      this.activeEventItem?.meta?.provinceId === provinceId
    ) {
      return true;
    }
    return this.ttsQueue.some((q) => q.meta?.provinceId === provinceId);
  }

  /**
   * Tạo câu đọc cho sự kiện:
   * - Nếu là NPC gửi hoa hồng / quà coin (isNpc && isRose): "NPC [Tên] đã hỗ trợ [Điểm] điểm về tỉnh [Tỉnh]" (tuyệt đối không nói NPC tặng quà kẻo vi phạm)
   * - Nếu NPC chỉ hỗ trợ 1 điểm (!isRose): Coi như người chơi bình thường, KHÔNG đọc từ "NPC" ("Bạn [Tên] đã đến tỉnh [Tỉnh] và gửi 1 điểm")
   * - Nếu người chơi tặng NHIỀU hoa hồng (roseCount > 1 hoặc points >= 2x rosePoints): Đọc mẫu câu cảm ơn nhiệt tình (`multiRoseGiftTtsTemplate`)
   * - Nếu người chơi tặng 1 Hoa hồng: "[Tên] đã gửi hoa hồng kèm [Điểm] điểm về [Tỉnh]"
   * - Nếu người chơi bình luận tên tỉnh: "Bạn [Tên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm"
   * - Có % xác suất nối thêm câu chào / vu vơ hoặc lời mời thả hoa hồng phía sau!
   */
  public formatProvinceGiftSpeech(
    username: string,
    provinceName: string,
    points: number,
    isRose: boolean,
    config: GameConfig,
    includeRandomPhrase = true,
    isNpc = false,
    roseCount = 1
  ): string {
    const cleanProvince = provinceName.replace(/^TP\.\s*/i, '').trim();
    const cleanUsername = username.replace(/^NPC\s+/i, '').trim();
    const effectiveRoses = isRose
      ? Math.max(
          1,
          roseCount || Math.round(points / Math.max(1, config.rosePoints || 5))
        )
      : 0;
    // Chỉ coi là NPC khi gửi gói Hoa hồng / Quà coin (> 1 điểm). Nếu hỗ trợ 1 điểm thì coi như người bình thường!
    const isNpcGiftSupport = Boolean(isNpc && isRose);
    const isMultiRose =
      !isNpcGiftSupport &&
      isRose &&
      (effectiveRoses >= 2 || points >= Math.max(1, config.rosePoints || 5) * 2);

    let rawTpl = '';
    if (isNpcGiftSupport) {
      rawTpl =
        config.npcSupportTtsTemplate ||
        'NPC [Tên] đã hỗ trợ [Điểm] điểm về tỉnh [Tỉnh]';
    } else if (isMultiRose) {
      rawTpl =
        config.multiRoseGiftTtsTemplate ||
        'Wow! Cảm ơn [Tên] rất nhiều đã gửi [SốHoa] bông hoa hồng kèm [Điểm] điểm siêu khủng về tỉnh [Tỉnh]! Yêu [Tên] quá trời luôn!';
    } else if (isRose) {
      rawTpl =
        config.roseGiftTtsTemplate ||
        '[Tên] đã gửi hoa hồng kèm [Điểm] điểm về [Tỉnh]';
    } else {
      rawTpl =
        config.commentGiftTtsTemplate ||
        'Bạn [Tên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm';
    }

    let formatted = rawTpl
      .replace(/\[Tên\]|\[tên\]|\{name\}/gi, cleanUsername)
      .replace(
        /\[SốHoa\]|\[sốhoa\]|\[TổngHoa\]|\[Hoa\]|\{roses\}/gi,
        String(Math.max(2, effectiveRoses))
      )
      .replace(/\[Điểm\]|\[điểm\]|\{points\}/gi, String(points))
      .replace(/\[Tỉnh\]|\[tỉnh\]|\{province\}/gi, cleanProvince)
      .replace(/\s+/g, ' ')
      .trim();

    if (includeRandomPhrase) {
      const rosePrompt = !isMultiRose
        ? this.pickRosePromptSuffix(cleanUsername, cleanProvince, config)
        : '';
      if (rosePrompt) {
        formatted = `${formatted}. ${rosePrompt}`;
      } else {
        const suffix = this.pickRandomGreetingSuffix(
          cleanUsername,
          cleanProvince,
          config
        );
        if (suffix) {
          formatted = `${formatted}. ${suffix}`;
        }
      }
    }

    return sanitizeAndLimitSpeechText(
      formatted,
      Math.max(65, config.maxTtsWords || 65)
    );
  }

  /**
   * Tạo câu đọc gộp TẤT CẢ những người cùng vào 1 tỉnh trong hàng chờ để giải phóng nhanh hàng chờ:
   * - Nếu có NPC gửi hoa hồng / quà coin (isNpc && totalRoses > 0): "NPC A, B đã hỗ trợ N điểm về tỉnh X" (không nói tặng quà)
   * - Nếu chỉ hỗ trợ 1 điểm (totalRoses === 0): Coi như người bình thường, không đọc từ NPC ("Các bạn A, B, C đã đến tỉnh X và gửi N điểm")
   * - Nếu người thật gửi nhiều hoa hồng: Cảm ơn nhiệt tình danh sách người chơi kèm tổng số hoa & điểm
   */
  public formatBatchedProvinceGiftSpeech(
    usernames: string[],
    provinceName: string,
    totalPoints: number,
    totalRoses: number,
    config: GameConfig,
    includeRandomPhrase = true,
    isNpc = false
  ): string {
    const uniqueNames = Array.from(
      new Set(usernames.map((u) => u.trim()).filter(Boolean))
    );
    const isNpcGiftSupport = Boolean(isNpc && totalRoses > 0);
    if (uniqueNames.length <= 1) {
      return this.formatProvinceGiftSpeech(
        uniqueNames[0] || 'Người chơi',
        provinceName,
        totalPoints,
        totalRoses > 0,
        config,
        includeRandomPhrase,
        isNpcGiftSupport,
        Math.max(1, totalRoses)
      );
    }

    const cleanProvince = provinceName.replace(/^TP\.\s*/i, '').trim();
    const namesJoined = uniqueNames
      .map((n) => n.replace(/^NPC\s+/i, '').trim())
      .join(', ');
    const flowerText =
      totalRoses > 0 ? `${totalRoses} hoa hồng` : 'quà giao lưu';

    let formatted = '';
    if (isNpcGiftSupport) {
      formatted = `NPC ${namesJoined} đã hỗ trợ ${totalPoints} điểm về tỉnh ${cleanProvince}`;
    } else if (totalRoses >= 2) {
      formatted = `Wow! Cảm ơn ${namesJoined} rất nhiều đã gửi tổng cộng ${totalRoses} bông hoa hồng kèm ${totalPoints} điểm về tỉnh ${cleanProvince}! Tuyệt vời quá!`;
    } else if (totalRoses > 0) {
      formatted = `${namesJoined} đã gửi hoa hồng kèm ${totalPoints} điểm về ${cleanProvince}`;
    } else {
      const rawTpl =
        config.batchGiftTtsTemplate ||
        'Các bạn [DanhSáchTên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm';
      formatted = rawTpl
        .replace(/\[DanhSáchTên\]|\[Tên\]|\{names\}/gi, namesJoined)
        .replace(/\[TổngHoa\]|\[Hoa\]|\{flowers\}/gi, flowerText)
        .replace(/\[Điểm\]|\[điểm\]|\{points\}/gi, String(totalPoints))
        .replace(/\[Tỉnh\]|\[tỉnh\]|\{province\}/gi, cleanProvince)
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (includeRandomPhrase) {
      const rosePrompt =
        totalRoses === 0
          ? this.pickRosePromptSuffix(namesJoined, cleanProvince, config)
          : '';
      if (rosePrompt) {
        formatted = `${formatted}. ${rosePrompt}`;
      } else {
        const suffix = this.pickRandomGreetingSuffix(
          namesJoined,
          cleanProvince,
          config
        );
        if (suffix) {
          formatted = `${formatted}. ${suffix}`;
        }
      }
    }

    return sanitizeAndLimitSpeechText(
      formatted,
      Math.max(75, config.maxTtsWords || 75)
    );
  }

  /**
   * Đưa câu đọc vào hàng chờ, tự động gom gộp TẤT CẢ người vào cùng tỉnh đang chờ trong hàng đợi
   */
  public enqueueTTS(
    text: string,
    isPriority: boolean,
    config: GameConfig,
    meta?: TTSQueueItemMeta
  ): boolean {
    this.latestConfig = config;
    if (!config.ttsEnabled) return false;
    const cleanText = sanitizeAndLimitSpeechText(
      text,
      Math.max(75, config.maxTtsWords || 75)
    );
    if (!cleanText) return false;

    const now = Date.now();

    // Nếu tỉnh này đã có mục đang chờ trong hàng đợi TTS -> Gom gộp tất cả tên người chơi vào đọc chung 1 lần!
    if (meta?.provinceId && meta?.provinceName) {
      const incomingNames =
        meta.usernamesList && meta.usernamesList.length > 0
          ? meta.usernamesList
          : meta.username
          ? [meta.username]
          : [];

      const existingIdx = this.ttsQueue.findIndex(
        (q) => q.meta?.provinceId === meta.provinceId
      );

      if (existingIdx !== -1 && incomingNames.length > 0) {
        const existing = this.ttsQueue[existingIdx];
        const prevNames: string[] = existing.meta?.usernamesList || [
          existing.meta?.username || 'Người chơi',
        ];
        const nextNames = Array.from(new Set([...prevNames, ...incomingNames]));
        const prevPoints = Number(existing.meta?.pointsAdded || 1);
        const nextPoints = prevPoints + Number(meta.pointsAdded || 1);
        const prevRoses = Number(
          existing.meta?.totalRoses ?? (existing.meta?.isRose ? 1 : 0)
        );
        const nextRoses =
          prevRoses + Number(meta.totalRoses ?? (meta.isRose ? 1 : 0));
        const mergedIsNpc = Boolean(existing.meta?.isNpc || meta.isNpc);

        const mergedText = this.formatBatchedProvinceGiftSpeech(
          nextNames,
          meta.provinceName,
          nextPoints,
          nextRoses,
          config,
          true,
          mergedIsNpc
        );

        this.ttsQueue[existingIdx] = {
          ...existing,
          text: mergedText,
          isPriority: existing.isPriority || isPriority,
          meta: {
            ...existing.meta,
            username: nextNames.join(', '),
            usernamesList: nextNames,
            pointsAdded: nextPoints,
            isRose: nextRoses > 0,
            isNpc: mergedIsNpc,
            totalRoses: nextRoses,
          },
        };
        this.emitEventQueue();
        this.processQueue(config);
        return true;
      }
    }

    const queueItem: TTSQueueItem = {
      id: `tts_${now}_${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      isPriority,
      addedAt: now,
      meta: meta
        ? {
            ...meta,
            usernamesList:
              meta.usernamesList || (meta.username ? [meta.username] : []),
            totalRoses: meta.totalRoses ?? (meta.isRose ? 1 : 0),
          }
        : undefined,
    };

    const maxQueueSize = Math.max(
      1,
      Math.min(200, config.maxTtsQueueSize ?? 40)
    );
    if (this.ttsQueue.length >= maxQueueSize) {
      this.ttsQueue = this.ttsQueue.slice(-Math.floor(maxQueueSize / 2));
    }

    if (isPriority) {
      const firstNonPriority = this.ttsQueue.findIndex((q) => !q.isPriority);
      if (firstNonPriority === -1) {
        this.ttsQueue.push(queueItem);
      } else {
        this.ttsQueue.splice(firstNonPriority, 0, queueItem);
      }
    } else {
      this.ttsQueue.push(queueItem);
    }

    this.emitEventQueue();
    this.processQueue(config);
    return true;
  }

  private getOrFetchAudioBlobUrl(
    url: string,
    timeoutMs = 2200
  ): Promise<string | null> {
    const cached = this.audioBlobCache.get(url);
    if (cached) {
      this.audioBlobCache.delete(url);
      this.audioBlobCache.set(url, cached);
      this.audioBlobMetaCache.set(url, {
        source: 'ram-cache',
        switchedMirror: false,
        latencyMs: 0,
      });
      return Promise.resolve(cached);
    }
    const existing = this.inFlightPrefetches.get(url);
    if (existing) return existing;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startMs = Date.now();

    const p = fetch(url, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timer);
        const latencyMs = Math.max(1, Date.now() - startMs);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size < 128) return null;
        const blobUrl = URL.createObjectURL(blob);
        if (this.audioBlobCache.size >= this.MAX_BLOB_CACHE) {
          const oldestKey = this.audioBlobCache.keys().next().value;
          if (oldestKey) {
            const oldUrl = this.audioBlobCache.get(oldestKey);
            if (oldUrl) {
              try {
                URL.revokeObjectURL(oldUrl);
              } catch {
                // Ignore
              }
            }
            this.audioBlobCache.delete(oldestKey);
            this.audioBlobMetaCache.delete(oldestKey);
          }
        }
        this.audioBlobCache.set(url, blobUrl);
        this.audioBlobMetaCache.set(url, {
          source: url.includes('/api/tts') ? 'cloud-stream' : 'node-local',
          switchedMirror: false,
          latencyMs,
        });
        return blobUrl;
      })
      .catch(() => {
        clearTimeout(timer);
        return null;
      })
      .finally(() => {
        this.inFlightPrefetches.delete(url);
      });

    this.inFlightPrefetches.set(url, p);
    return p;
  }

  private applyAudioPlaybackParams(
    audio: HTMLAudioElement,
    effectiveRate: number,
    preservePitch: boolean,
    volume: number
  ) {
    const safeRate = Math.max(0.5, Math.min(2.0, Number(effectiveRate) || 1));
    audio.volume = Math.max(0.05, Math.min(1, Number(volume) || 1));
    audio.preservesPitch = preservePitch;
    audio.defaultPlaybackRate = safeRate;
    audio.playbackRate = safeRate;
  }

  private computeStreamPlaybackRateAndPitch(
    voice: string,
    config: GameConfig
  ): { effectiveRate: number; preservePitch: boolean } {
    const baseRate = Math.max(0.5, Math.min(2.0, config.ttsRate || 1));
    const pitch = config.ttsPitch ?? 1;

    if (baseRate > 1.15) {
      return { effectiveRate: baseRate, preservePitch: true };
    }
    if (voice === 'google-vi-male-deep') {
      const pitchFactor = pitch < 1 ? Math.max(0.85, pitch) : 0.92;
      return {
        effectiveRate: Math.max(0.65, Math.min(2.0, baseRate * pitchFactor)),
        preservePitch: false,
      };
    }
    if (voice === 'google-vi-warm') {
      return {
        effectiveRate: Math.max(0.65, Math.min(2.0, baseRate * 0.95)),
        preservePitch: false,
      };
    }
    if (voice === 'google-vi-bright') {
      const brightFactor = pitch > 1 ? Math.min(1.15, pitch) : 1.06;
      return {
        effectiveRate: Math.max(0.75, Math.min(2.0, baseRate * brightFactor)),
        preservePitch: false,
      };
    }
    return { effectiveRate: baseRate, preservePitch: true };
  }

  private processQueue(config: GameConfig) {
    if (this.isSpeaking) return;
    if (this.ttsQueue.length === 0) {
      this.activeEventItem = null;
      this.emitEventQueue();
      return;
    }

    let nextItem = this.ttsQueue.shift()!;

    // Mỗi lần bắt đầu đọc: kiểm tra toàn bộ hàng chờ TTS xem còn ai vào CÙNG TỈNH này không,
    // nếu có thì rút hết ra đọc 1 lúc tất cả các tên cho hết nhanh hàng chờ!
    if (nextItem.meta?.provinceId && nextItem.meta?.provinceName) {
      const targetProvId = nextItem.meta.provinceId;
      const sameProvItems = this.ttsQueue.filter(
        (q) => q.meta?.provinceId === targetProvId
      );
      if (sameProvItems.length > 0) {
        this.ttsQueue = this.ttsQueue.filter(
          (q) => q.meta?.provinceId !== targetProvId
        );
        const allNames = new Set<string>(
          nextItem.meta.usernamesList ||
            (nextItem.meta.username ? [nextItem.meta.username] : [])
        );
        let totalPts = Number(nextItem.meta.pointsAdded || 1);
        let totalRoses = Number(
          nextItem.meta.totalRoses ?? (nextItem.meta.isRose ? 1 : 0)
        );
        let anyNpc = Boolean(nextItem.meta.isNpc);

        for (const extra of sameProvItems) {
          const extraNames =
            extra.meta?.usernamesList ||
            (extra.meta?.username ? [extra.meta.username] : []);
          for (const n of extraNames) {
            allNames.add(n);
          }
          totalPts += Number(extra.meta?.pointsAdded || 1);
          totalRoses += Number(
            extra.meta?.totalRoses ?? (extra.meta?.isRose ? 1 : 0)
          );
          if (extra.meta?.isNpc) anyNpc = true;
        }

        const mergedList = Array.from(allNames);
        const combinedSpeech = this.formatBatchedProvinceGiftSpeech(
          mergedList,
          nextItem.meta.provinceName,
          totalPts,
          totalRoses,
          config,
          true,
          anyNpc
        );

        nextItem = {
          ...nextItem,
          text: combinedSpeech,
          meta: {
            ...nextItem.meta,
            username: mergedList.join(', '),
            usernamesList: mergedList,
            pointsAdded: totalPts,
            totalRoses,
            isRose: totalRoses > 0,
            isNpc: anyNpc,
          },
        };
      }
    }

    const nextText = nextItem.text;
    const itemCallback = nextItem.onDone;
    const token = ++this.speechTokenSeq;
    let finishedOnce = false;

    if (this.mutedSimTimer) {
      clearTimeout(this.mutedSimTimer);
      this.mutedSimTimer = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.removeAttribute('src');
        this.currentAudio = null;
      } catch {
        // Ignore
      }
    }

    this.isSpeaking = true;
    this.activeEventItem = nextItem;
    this.currentEventText = nextText;
    this.emitStatus('Đang đọc Giọng AI #3...', true, nextText);
    this.emitEventQueue();

    const finish = () => {
      if (finishedOnce || token !== this.speechTokenSeq) return;
      finishedOnce = true;
      this.isSpeaking = false;
      this.currentEventText = '';
      this.activeEventItem = null;
      if (this.ttsQueue.length === 0) {
        this.emitStatus('Sẵn sàng', false, '');
      }
      this.emitEventQueue();
      if (itemCallback) {
        try {
          itemCallback();
        } catch {
          // Ignore callback error
        }
      }
      setTimeout(() => {
        if (this.latestConfig) {
          this.processQueue(this.latestConfig);
        }
      }, 80);
    };

    if (this.isTabMuted()) {
      const wordCount = nextText.split(/\s+/).filter(Boolean).length;
      const simDurationMs = Math.max(
        1200,
        Math.min(
          6500,
          Math.round((wordCount * 290) / Math.max(0.5, config.ttsRate || 1))
        )
      );
      this.mutedSimTimer = setTimeout(finish, simDurationMs);
      return;
    }

    this.playViaVoice3(nextText, config, token, finish);
  }

  /**
   * Giọng đọc AI #3: Ưu tiên phát qua Node.js TTS Endpoint (hoặc tự động dự phòng qua /api/tts tích hợp sẵn).
   * Tự động tách văn bản dài thành các đoạn <= 165 ký tự và phát nối tiếp nhau cho tới khi đọc hết 100% mới gọi `onDone()`.
   */
  private playViaVoice3(
    text: string,
    config: GameConfig,
    token: number,
    onDone: () => void
  ) {
    const chunks = splitSpeechIntoChunks(text, 165);
    if (chunks.length === 0) {
      onDone();
      return;
    }

    const voice = config.nodeVoice || 'google-vi-gtx';
    const endpoint = (
      config.nodeTtsEndpoint || 'http://localhost:8080/tts'
    ).trim();

    const buildUrls = (chunkText: string) => ({
      primaryUrl: `${endpoint}?voice=${encodeURIComponent(
        voice
      )}&text=${encodeURIComponent(chunkText)}`,
      cloudFallbackUrl: `/api/tts?lang=vi&voice=${encodeURIComponent(
        voice
      )}&text=${encodeURIComponent(chunkText)}`,
    });

    const playChunkAt = (chunkIdx: number) => {
      if (token !== this.speechTokenSeq) return;
      if (chunkIdx >= chunks.length) {
        onDone();
        return;
      }

      const currentChunkText = chunks[chunkIdx];
      const { primaryUrl, cloudFallbackUrl } = buildUrls(currentChunkText);

      // Prefetch đoạn tiếp theo trong lúc đang tải/phát đoạn hiện tại để nối câu mượt mà không trễ
      if (chunkIdx + 1 < chunks.length) {
        const nextUrls = buildUrls(chunks[chunkIdx + 1]);
        void this.getOrFetchAudioBlobUrl(nextUrls.cloudFallbackUrl, 2400);
      }

      const advanceToNextChunk = () => {
        if (token !== this.speechTokenSeq) return;
        this.currentAudio = null;
        if (chunkIdx + 1 < chunks.length) {
          playChunkAt(chunkIdx + 1);
        } else {
          onDone();
        }
      };

      const playBlobUrl = (
        blobUrl: string,
        sourceLabel: string,
        latencyMs: number
      ) => {
        if (token !== this.speechTokenSeq) return;
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        this.currentAudio = audio;
        const { effectiveRate, preservePitch } =
          this.computeStreamPlaybackRateAndPitch(voice, config);

        audio.src = blobUrl;
        this.applyAudioPlaybackParams(
          audio,
          effectiveRate,
          preservePitch,
          config.ttsVolume
        );

        audio.onloadedmetadata = () => {
          this.applyAudioPlaybackParams(
            audio,
            effectiveRate,
            preservePitch,
            config.ttsVolume
          );
        };

        audio.onplaying = () => {
          this.ttsDiagnostic = {
            ...this.ttsDiagnostic,
            health: 'healthy',
            activeServerLabel: sourceLabel,
            statusHeadline: `Ổn định • Đang phát từ ${sourceLabel}`,
            statusDetail: `Giọng: ${voice} (${latencyMs}ms)`,
            lastLatencyMs: latencyMs,
            lastUpdatedAt: Date.now(),
          };
          this.emitEventQueue();
        };

        audio.onended = () => {
          advanceToNextChunk();
        };

        audio.onerror = () => {
          advanceToNextChunk();
        };

        audio.play().catch(() => {
          advanceToNextChunk();
        });
      };

      void this.getOrFetchAudioBlobUrl(primaryUrl, 950).then((localBlob) => {
        if (token !== this.speechTokenSeq) return;
        if (localBlob) {
          const meta = this.audioBlobMetaCache.get(primaryUrl);
          playBlobUrl(
            localBlob,
            `Giọng đọc AI #3 (${voice})`,
            meta?.latencyMs ?? 0
          );
          return;
        }

        void this.getOrFetchAudioBlobUrl(cloudFallbackUrl, 2400).then(
          (cloudBlob) => {
            if (token !== this.speechTokenSeq) return;
            if (cloudBlob) {
              const meta = this.audioBlobMetaCache.get(cloudFallbackUrl);
              playBlobUrl(
                cloudBlob,
                `Giọng đọc AI #3 • Cloud (${voice})`,
                meta?.latencyMs ?? 0
              );
              return;
            }
            advanceToNextChunk();
          }
        );
      });
    };

    playChunkAt(0);
  }
}

export const soundEngine = new SoundService();
