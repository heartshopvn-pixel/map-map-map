import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AVATAR_COLORS,
  createInitialProvinces,
  DEFAULT_CONFIG,
  DEFAULT_GIFT_GUIDE_ITEMS,
  DEFAULT_HOW_TO_PLAY_CONFIG,
  DEFAULT_LAYOUT_POSITIONS,
  DEFAULT_LAYOUT_VISIBILITY,
  DEFAULT_NPC_AVATARS,
  DEFAULT_TTS_RANDOM_PHRASES,
  isRoseKeywordInText,
  matchProvinceFromComment,
  SAMPLE_NAMES,
} from '../config/constants';
import {
  getDefaultCustomWords,
  INITIAL_SAFETY_CATEGORIES,
  inspectUserInteraction,
  loadSavedCustomWords,
  saveCustomWordsToStorage,
} from '../services/safetyFilter';
import { EventTtsQueueSnapshot, soundEngine } from '../services/soundEngine';
import { syncService, WsConnectionStatus } from '../services/syncService';
import {
  CameraFocusState,
  CameraQueueItem,
  GameConfig,
  ProvinceCell,
  ProvinceContributor,
  SafetyActionMode,
  SafetyCategory,
  SafetyLogEntry,
  StudioBackupData,
  ThrownAvatarFX,
} from '../types/game';

const STORAGE_CONFIG_KEY = 'province_gift_game_config_v2';
const STORAGE_PROVINCES_KEY = 'province_gift_game_provinces_v2';
const STORAGE_NPC_NAMES_KEY = 'province_gift_game_npc_names_v1';
const STORAGE_NPC_AVATARS_KEY = 'province_gift_game_npc_avatars_v1';

export interface ActivityLogItem {
  id: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  provinceId: string;
  provinceName: string;
  pointsAdded: number;
  isRose: boolean;
  roseCount: number;
  time: string;
}

export interface SessionEndSummaryState {
  sessionNum: number;
  top3: ProvinceCell[];
  top5: ProvinceCell[];
  deferredQueueCount: number;
  speechText: string;
}

function pickColorForUser(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function resolveAvatarForUsername(
  username: string,
  providedUrl: string | null | undefined,
  avatarPool: string[]
): string {
  if (
    providedUrl &&
    (providedUrl.startsWith('http') ||
      providedUrl.startsWith('data:image') ||
      providedUrl.startsWith('/'))
  ) {
    return providedUrl;
  }
  const pool =
    Array.isArray(avatarPool) && avatarPool.length > 0
      ? avatarPool
      : DEFAULT_NPC_AVATARS;
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 33 + username.charCodeAt(i)) | 0;
  }
  return (
    pool[Math.abs(hash) % pool.length] ||
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
      username || 'Player'
    )}`
  );
}

const LEGACY_COMMENT_TEMPLATES = new Set([
  '[Tên] gửi quà kèm [Điểm] điểm về [Tỉnh]',
  '[Tên] gửi quà và [Điểm] điểm về [Tỉnh]',
]);

const LEGACY_ROSE_TEMPLATES = new Set([
  '[Tên] gửi hoa hồng và [Điểm] điểm về [Tỉnh]',
]);

const LEGACY_BATCH_TEMPLATES = new Set([
  '[DanhSáchTên] gửi [TổngHoa] và [Điểm] điểm về [Tỉnh]',
]);

export function useClassroomEngine() {
  const isObsView =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('obs') === '1' ||
      new URLSearchParams(window.location.search).get('view') === 'live' ||
      new URLSearchParams(window.location.search).get('mode') === 'live');

  const [config, setConfig] = useState<GameConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const commentTpl =
          !parsed.commentGiftTtsTemplate ||
          LEGACY_COMMENT_TEMPLATES.has(parsed.commentGiftTtsTemplate)
            ? DEFAULT_CONFIG.commentGiftTtsTemplate
            : parsed.commentGiftTtsTemplate;
        const roseTpl =
          !parsed.roseGiftTtsTemplate ||
          LEGACY_ROSE_TEMPLATES.has(parsed.roseGiftTtsTemplate)
            ? DEFAULT_CONFIG.roseGiftTtsTemplate
            : parsed.roseGiftTtsTemplate;
        const batchTpl =
          !parsed.batchGiftTtsTemplate ||
          LEGACY_BATCH_TEMPLATES.has(parsed.batchGiftTtsTemplate)
            ? DEFAULT_CONFIG.batchGiftTtsTemplate
            : parsed.batchGiftTtsTemplate;

        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          ttsEngine: 'node_edge',
          commentGiftTtsTemplate: commentTpl,
          roseGiftTtsTemplate: roseTpl,
          batchGiftTtsTemplate: batchTpl,
          roundStartTtsEnabled:
            parsed.roundStartTtsEnabled !== undefined
              ? Boolean(parsed.roundStartTtsEnabled)
              : DEFAULT_CONFIG.roundStartTtsEnabled,
          roundStartTtsTemplate:
            parsed.roundStartTtsTemplate ||
            DEFAULT_CONFIG.roundStartTtsTemplate,
          ttsRandomPhraseChancePercent:
            parsed.ttsRandomPhraseChancePercent !== undefined
              ? Number(parsed.ttsRandomPhraseChancePercent)
              : DEFAULT_CONFIG.ttsRandomPhraseChancePercent,
          ttsRandomPhrases:
            Array.isArray(parsed.ttsRandomPhrases) &&
            parsed.ttsRandomPhrases.length > 0
              ? parsed.ttsRandomPhrases
              : DEFAULT_TTS_RANDOM_PHRASES,
          howToPlayConfig: {
            ...DEFAULT_HOW_TO_PLAY_CONFIG,
            ...(parsed.howToPlayConfig || {}),
          },
          layoutPositions: {
            ...DEFAULT_LAYOUT_POSITIONS,
            ...(parsed.layoutPositions || {}),
          },
          layoutVisibility: {
            ...DEFAULT_LAYOUT_VISIBILITY,
            ...(parsed.layoutVisibility || {}),
          },
          giftGuideItems:
            Array.isArray(parsed.giftGuideItems) &&
            parsed.giftGuideItems.length > 0
              ? parsed.giftGuideItems
              : DEFAULT_GIFT_GUIDE_ITEMS,
        };
      }
    } catch {
      // Ignore
    }
    return { ...DEFAULT_CONFIG };
  });

  const [provinces, setProvinces] = useState<ProvinceCell[]>(() => {
    const initial = createInitialProvinces();
    try {
      const saved = localStorage.getItem(STORAGE_PROVINCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Partial<ProvinceCell>>;
        if (Array.isArray(parsed)) {
          const byId = new Map(parsed.map((p) => [p.id, p]));
          return initial.map((item) => {
            const found = byId.get(item.id);
            if (!found) return item;
            return {
              ...item,
              name: found.name || item.name,
              points: Number(found.points) || 0,
              giftCount: Number(found.giftCount) || 0,
              roseCount: Number(found.roseCount) || 0,
              recentContributors: Array.isArray(found.recentContributors)
                ? found.recentContributors.slice(0, 24)
                : [],
              lastUpdatedAt: Number(found.lastUpdatedAt) || 0,
            };
          });
        }
      }
    } catch {
      // Ignore
    }
    return initial;
  });

  const [thrownAvatars, setThrownAvatars] = useState<ThrownAvatarFX[]>([]);
  const [cameraFocus, setCameraFocus] = useState<CameraFocusState>({
    provinceId: null,
    until: 0,
  });
  const [cameraQueue, setCameraQueue] = useState<CameraQueueItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [sessionEndSummary, setSessionEndSummary] =
    useState<SessionEndSummaryState | null>(null);

  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>(() =>
    syncService.getStatus()
  );
  const [peerCounts, setPeerCounts] = useState<{
    totalPeers: number;
    obsPeers: number;
  }>({ totalPeers: 1, obsPeers: 0 });

  const [isLocalTabMuted, setIsLocalTabMuted] = useState<boolean>(() =>
    soundEngine.isTabMuted()
  );
  const [ttsStatus, setTtsStatus] = useState<{ text: string; active: boolean }>({
    text: 'Sẵn sàng',
    active: false,
  });
  const [eventTtsQueue, setEventTtsQueue] = useState<EventTtsQueueSnapshot>(() =>
    soundEngine.getEventQueueSnapshot()
  );

  const [npcNames, setNpcNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_NPC_NAMES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return [...SAMPLE_NAMES];
  });

  const [npcAvatars, setNpcAvatars] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_NPC_AVATARS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return [...DEFAULT_NPC_AVATARS];
  });

  const [safetyActionMode, setSafetyActionMode] =
    useState<SafetyActionMode>('purify');
  const [safetyCategories, setSafetyCategories] = useState<SafetyCategory[]>(
    () => INITIAL_SAFETY_CATEGORIES
  );
  const [customWords, setCustomWords] = useState<string[]>(() =>
    loadSavedCustomWords()
  );
  const [safetyLogs, setSafetyLogs] = useState<SafetyLogEntry[]>([]);

  const configRef = useRef(config);
  configRef.current = config;

  const provincesRef = useRef(provinces);
  provincesRef.current = provinces;

  const npcAvatarsRef = useRef(npcAvatars);
  npcAvatarsRef.current = npcAvatars;

  const cameraFocusRef = useRef(cameraFocus);
  cameraFocusRef.current = cameraFocus;

  const cameraQueueRef = useRef(cameraQueue);
  cameraQueueRef.current = cameraQueue;

  const isSessionEndingRef = useRef<boolean>(false);
  const sessionEndTimeoutRef = useRef<number | null>(null);
  const initialRoundAnnouncedRef = useRef<boolean>(false);

  // Lưu mốc thời gian nghỉ ở Map tổng giữa 2 lượt khi ở chế độ 2 (alternating_overview)
  const overviewPauseUntilRef = useRef<number>(0);

  const userProvinceMemoryRef = useRef<Map<string, string>>(new Map());
  const userAvatarMemoryRef = useRef<Map<string, string>>(new Map());

  // Persist config & provinces
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch {
      // Ignore
    }
    soundEngine.syncConfig(config);
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROVINCES_KEY, JSON.stringify(provinces));
    } catch {
      // Ignore
    }
  }, [provinces]);

  // Subscribe to soundEngine status & queue
  useEffect(() => {
    const unsubStatus = soundEngine.subscribeStatus((text, active) => {
      setTtsStatus({ text, active });
    });
    const unsubQueue = soundEngine.subscribeEventQueue((snap) => {
      setEventTtsQueue(snap);
    });
    return () => {
      unsubStatus();
      unsubQueue();
    };
  }, []);

  // Đọc lời chào bắt đầu vòng ngay khi vào game / tương tác đầu tiên
  useEffect(() => {
    if (initialRoundAnnouncedRef.current) return;
    const triggerInitialRoundStart = () => {
      if (initialRoundAnnouncedRef.current) return;
      initialRoundAnnouncedRef.current = true;
      soundEngine.announceRoundStart(
        configRef.current.roundNumber || 69,
        configRef.current
      );
    };
    const timer = window.setTimeout(triggerInitialRoundStart, 650);
    return () => window.clearTimeout(timer);
  }, []);

  // Ném 1 hoặc nhiều Avatar vào tỉnh khi Camera Zoom
  const spawnThrowAvatarFX = useCallback(
    (item: {
      provinceId: string;
      provinceName: string;
      senders: ProvinceContributor[];
    }) => {
      const now = Date.now();
      const durationMs = Math.max(400, configRef.current.throwDurationMs || 850);
      const visibleSenders = item.senders.slice(0, 8);
      const count = visibleSenders.length;

      const fxList: ThrownAvatarFX[] = visibleSenders.map((sender, idx) => {
        const spreadOffset =
          count === 1 ? 0 : (idx - (count - 1) / 2) * 20;
        return {
          id: `fx_${now}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          provinceId: item.provinceId,
          provinceName: item.provinceName,
          username: sender.username,
          avatarUrl: sender.avatarUrl,
          avatarColor: sender.avatarColor,
          pointsAdded: sender.pointsAdded,
          isRose: sender.isRose,
          startXPercent: 50 + spreadOffset,
          startYPercent: 86,
          createdAt: now + idx * 65,
          durationMs,
        };
      });

      setThrownAvatars((prev) => [...prev.slice(-12), ...fxList]);
      const anyRose = item.senders.some((s) => s.isRose);
      soundEngine.playGiftThrowSfx(anyRose, configRef.current.sfxVolume);

      setTimeout(() => {
        const ids = new Set(fxList.map((f) => f.id));
        setThrownAvatars((prev) => prev.filter((x) => !ids.has(x.id)));
      }, durationMs + 550);
    },
    []
  );

  /**
   * Ghi nhận điểm số + lưu toàn bộ người chơi đóng góp trong phiên (tối đa 24 người/tỉnh) + đọc AI #3
   * Đọc gộp TẤT CẢ tên người chơi trong lượt tỉnh đó cùng lúc kèm % câu chào / vu vơ!
   */
  const commitGiftTurnToProvinceAndTTS = useCallback(
    (
      provinceId: string,
      provinceName: string,
      senders: ProvinceContributor[],
      totalPointsAdded: number,
      totalRosesAdded: number,
      totalGiftsAdded: number
    ) => {
      const cfg = configRef.current;
      const now = Date.now();
      const sessionContributorCap = Math.max(
        18,
        cfg.maxContributorsPerTile || 24
      );

      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id !== provinceId) return p;

          const existingMap = new Map<string, ProvinceContributor>();
          for (const oldC of p.recentContributors) {
            existingMap.set(oldC.username.toLowerCase(), oldC);
          }

          const newEntries: ProvinceContributor[] = [];
          for (const sender of senders) {
            const key = sender.username.toLowerCase();
            const prevEntry = existingMap.get(key);
            if (prevEntry) {
              existingMap.delete(key);
              newEntries.push({
                ...sender,
                pointsAdded: prevEntry.pointsAdded + sender.pointsAdded,
                roseCount: (prevEntry.roseCount || 0) + (sender.roseCount || 0),
                isRose: Boolean(prevEntry.isRose || sender.isRose),
                timestamp: now,
              });
            } else {
              newEntries.push(sender);
            }
          }

          const mergedContribs = [
            ...newEntries,
            ...Array.from(existingMap.values()),
          ].slice(0, sessionContributorCap);

          return {
            ...p,
            points: p.points + totalPointsAdded,
            giftCount: p.giftCount + totalGiftsAdded,
            roseCount: p.roseCount + totalRosesAdded,
            recentContributors: mergedContribs,
            lastUpdatedAt: now,
          };
        })
      );

      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      const newLogs: ActivityLogItem[] = senders.map((s) => ({
        id: s.id,
        username: s.username,
        avatarUrl: s.avatarUrl,
        avatarColor: s.avatarColor,
        provinceId,
        provinceName,
        pointsAdded: s.pointsAdded,
        isRose: s.isRose,
        roseCount: s.roseCount || (s.isRose ? 1 : 0),
        time: timeStr,
      }));
      setActivityLogs((prev) => [...newLogs, ...prev].slice(0, 40));

      const anyRose = totalRosesAdded > 0 || senders.some((s) => s.isRose);
      const anyNpc = senders.some((s) => Boolean(s.isNpc));
      const uniqueNames = Array.from(new Set(senders.map((s) => s.username)));

      const speechText =
        uniqueNames.length > 1
          ? soundEngine.formatBatchedProvinceGiftSpeech(
              uniqueNames,
              provinceName,
              totalPointsAdded,
              totalRosesAdded,
              cfg,
              true,
              anyNpc
            )
          : soundEngine.formatProvinceGiftSpeech(
              uniqueNames[0] || 'Người chơi',
              provinceName,
              totalPointsAdded,
              anyRose,
              cfg,
              true,
              anyNpc
            );

      soundEngine.enqueueTTS(speechText, anyRose, cfg, {
        provinceId,
        provinceName,
        username: uniqueNames.join(', '),
        usernamesList: uniqueNames,
        reason: anyRose ? 'gift' : 'comment',
        isRose: anyRose,
        isNpc: anyNpc,
        pointsAdded: totalPointsAdded,
        totalRoses: totalRosesAdded,
      });
    },
    []
  );

  /**
   * Bộ điều phối Camera hỗ trợ 2 chế độ:
   * 1. 'continuous' (Phản ứng liên tục - mặc định): Nhảy thẳng sang tỉnh kế tiếp trong hàng chờ
   * 2. 'alternating_overview' (Xen kẽ zoom tổng): Sau mỗi lượt tỉnh, zoom nhanh ra Map tổng rồi mới zoom vào tỉnh mới
   * ĐẶC BIỆT:
   * - ƯU TIÊN GIỮ ZOOM TỈNH nếu Giọng đọc AI #3 vẫn còn đang đọc chưa xong sự kiện của tỉnh đó!
   * - Mỗi lần lấy 1 tỉnh ra đọc, tự động quét toàn bộ hàng chờ `cameraQueue`,
   *   rút TẤT CẢ những người vào cùng tỉnh đó ra đọc 1 lúc để giải phóng nhanh hàng chờ!
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSessionEndingRef.current) {
        return;
      }

      const now = Date.now();
      const curFocus = cameraFocusRef.current;
      const queue = cameraQueueRef.current;
      const cfg = configRef.current;

      // Ưu tiên giữ nguyên Camera Zoom ở tỉnh nếu:
      // 1) Chưa hết thời gian giữ tối thiểu (now < curFocus.until), HOẶC
      // 2) Giọng đọc AI #3 vẫn còn đang đọc / chờ đọc chưa xong sự kiện của tỉnh đó!
      if (
        curFocus.provinceId &&
        (now < curFocus.until ||
          soundEngine.isSpeakingOrQueuedForProvince(curFocus.provinceId))
      ) {
        return;
      }

      // Nếu vừa kết thúc 1 lượt tỉnh và đang bật chế độ 2 (Xen kẽ zoom tổng) mà vẫn còn tỉnh mới trong hàng chờ:
      if (
        curFocus.provinceId !== null &&
        cfg.cameraMode === 'alternating_overview' &&
        queue.length > 0
      ) {
        const overviewHold = Math.max(350, cfg.cameraOverviewHoldMs || 650);
        overviewPauseUntilRef.current = now + overviewHold;
        const overviewFocus: CameraFocusState = {
          provinceId: null,
          until: now + overviewHold,
        };
        cameraFocusRef.current = overviewFocus;
        setCameraFocus(overviewFocus);
        return;
      }

      // Nếu đang trong nhịp dừng ở Map tổng (chế độ 2) thì đợi hết nhịp dừng rồi mới zoom vào tỉnh tiếp theo
      if (
        curFocus.provinceId === null &&
        now < overviewPauseUntilRef.current
      ) {
        return;
      }

      if (queue.length > 0) {
        const headItem = queue[0];
        const targetProvId = headItem.provinceId;

        // Quét toàn bộ hàng chờ để gom TẤT CẢ các mục có cùng `provinceId` đọc 1 lần!
        const sameProvinceItems = queue.filter(
          (item) => item.provinceId === targetProvId
        );
        const remainingQueue = queue.filter(
          (item) => item.provinceId !== targetProvId
        );

        cameraQueueRef.current = remainingQueue;
        setCameraQueue(remainingQueue);

        const mergedSenders: ProvinceContributor[] = [];
        let mergedPoints = 0;
        let mergedRoses = 0;
        let mergedGifts = 0;
        let anyRose = false;

        for (const item of sameProvinceItems) {
          mergedSenders.push(...item.senders);
          mergedPoints += item.pointsAdded;
          mergedRoses += item.totalRoses;
          mergedGifts += item.totalGifts;
          if (item.isRose) anyRose = true;
        }

        const uniqueSenderNames = Array.from(
          new Set(mergedSenders.map((s) => s.username))
        );

        // Cộng điểm, lưu Avatar vào tỉnh và đọc 1 lúc tất cả tên người chơi của tỉnh này
        commitGiftTurnToProvinceAndTTS(
          targetProvId,
          headItem.provinceName,
          mergedSenders,
          mergedPoints,
          mergedRoses,
          mergedGifts
        );

        const holdMs = Math.max(
          1200,
          Math.round((cfg.cameraHoldDurationSec || 2.5) * 1000)
        );
        const lastSender =
          mergedSenders[mergedSenders.length - 1] || headItem.senders[0];
        const nextFocus: CameraFocusState = {
          provinceId: targetProvId,
          provinceName: headItem.provinceName,
          username: uniqueSenderNames.join(', '),
          avatarUrl: lastSender?.avatarUrl || headItem.avatarUrl,
          avatarColor: lastSender?.avatarColor || headItem.avatarColor,
          pointsAdded: mergedPoints,
          isRose: anyRose,
          senders: mergedSenders,
          totalRoses: mergedRoses,
          totalGifts: mergedGifts,
          startedAt: now,
          until: now + holdMs,
        };
        cameraFocusRef.current = nextFocus;
        setCameraFocus(nextFocus);

        setTimeout(() => {
          spawnThrowAvatarFX({
            provinceId: targetProvId,
            provinceName: headItem.provinceName,
            senders: mergedSenders,
          });
        }, 120);
      } else if (curFocus.provinceId !== null) {
        // Hàng chờ trống và sự kiện tỉnh đã đọc xong -> Zoom out về Map mặc định (chế độ chờ)
        const resetFocus: CameraFocusState = {
          provinceId: null,
          until: 0,
        };
        cameraFocusRef.current = resetFocus;
        setCameraFocus(resetFocus);
      }
    }, 85);

    return () => clearInterval(timer);
  }, [commitGiftTurnToProvinceAndTTS, spawnThrowAvatarFX]);

  /**
   * Luồng Kết Thúc Phiên Chơi & Chuyển Sang Vòng Mới:
   * - Ngắt ngay việc đọc quà thường, dừng lấy thêm hàng chờ Camera
   * - Đưa Camera về Map tổng
   * - Thông báo Kết Quả Phiên & đọc vinh danh Top 3 tỉnh điểm cao nhất bằng Giọng đọc AI #3
   * - Bảo toàn toàn bộ hàng chờ quà còn tồn đọng chưa đọc (cameraQueue) để đẩy sang phiên tiếp theo
   * - Sau khi thông báo xong -> Reset tất cả dữ liệu tỉnh, đọc lời chào "Vòng X+1 bắt đầu, mời các bạn tham gia giao lưu với nhau!"
   *   và tự động chạy tiếp hàng chờ tồn đọng ở vòng mới!
   */
  const handleSessionTimeUp = useCallback((sessionNum: number) => {
    if (isSessionEndingRef.current) return;
    isSessionEndingRef.current = true;

    overviewPauseUntilRef.current = 0;
    const resetFocus: CameraFocusState = { provinceId: null, until: 0 };
    cameraFocusRef.current = resetFocus;
    setCameraFocus(resetFocus);

    const sorted = [...provincesRef.current].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.code - b.code;
    });

    const top5 = sorted.slice(0, 5);
    const top3 = sorted.slice(0, 3);
    const scoredTop3 = top3.filter((p) => p.points > 0);
    const deferredCount = cameraQueueRef.current.length;

    let speechText = '';
    if (scoredTop3.length === 0) {
      speechText = `Kết thúc vòng ${sessionNum}. Chưa có tỉnh nào ghi điểm trong vòng này.`;
    } else {
      const rankPhrases = scoredTop3.map((p, idx) => {
        const rankName =
          idx === 0 ? 'Hạng nhất' : idx === 1 ? 'Hạng nhì' : 'Hạng ba';
        return `${rankName} thuộc về ${p.name} với ${p.points} điểm`;
      });
      const deferNote =
        deferredCount > 0
          ? ` Còn ${deferredCount} lượt trong hàng chờ sẽ được chuyển sang vòng tiếp theo.`
          : '';
      speechText = `Kết thúc vòng ${sessionNum}! Tổng kết 3 tỉnh dẫn đầu: ${rankPhrases.join(
        '. '
      )}. Xin chúc mừng!${deferNote}`;
    }

    setSessionEndSummary({
      sessionNum,
      top3,
      top5,
      deferredQueueCount: deferredCount,
      speechText,
    });

    // Ngắt hàng đợi đọc quà cũ và đọc ngay thông báo tổng kết Top 3 tỉnh của phiên
    soundEngine.announceSessionResultNow(speechText, configRef.current);

    const holdMs =
      Math.max(4, configRef.current.sessionResultHoldSec || 7) * 1000;
    if (sessionEndTimeoutRef.current) {
      window.clearTimeout(sessionEndTimeoutRef.current);
    }

    sessionEndTimeoutRef.current = window.setTimeout(() => {
      const freshProvinces = createInitialProvinces().map((baseProv) => {
        const currentProv = provincesRef.current.find(
          (p) => p.id === baseProv.id
        );
        return {
          ...baseProv,
          name: currentProv?.name || baseProv.name,
          points: 0,
          giftCount: 0,
          roseCount: 0,
          recentContributors: [],
          lastUpdatedAt: 0,
        };
      });

      const nextRoundNum = sessionNum + 1;
      provincesRef.current = freshProvinces;
      setProvinces(freshProvinces);
      setActivityLogs([]);
      setSessionEndSummary(null);
      isSessionEndingRef.current = false;

      // Đọc luồng âm thanh báo Vòng mới bắt đầu, mời các bạn tham gia giao lưu với nhau
      soundEngine.announceRoundStart(nextRoundNum, configRef.current);

      syncService.sendCommand('UPDATE_PROVINCES_STATE', {
        provinces: freshProvinces,
      });
    }, holdMs);
  }, []);

  /**
   * Hàm trung tâm xử lý khi người chơi bình luận đến tỉnh (+1đ) hoặc gửi hoa hồng (+5đ)
   * - Khi đang chờ trong `cameraQueue`, nếu có người mới vào cùng tỉnh -> gom tất cả vào chung 1 mục của tỉnh đó
   *   để khi tới lượt sẽ đọc 1 lúc tất cả các tên cho hết nhanh hàng chờ!
   */
  const executeProvinceGift = useCallback(
    (
      payload: {
        provinceId: string;
        username: string;
        avatarUrl?: string | null;
        isRose: boolean;
        isNpc?: boolean;
        pointsOverride?: number;
        roseCountOverride?: number;
      },
      broadcastSync = true
    ) => {
      const cfg = configRef.current;
      const targetProv = provincesRef.current.find(
        (p) => p.id === payload.provinceId
      );
      if (!targetProv) return;

      const roseCount = payload.isRose
        ? Math.max(1, payload.roseCountOverride || 1)
        : 0;
      const pointsAdded =
        payload.pointsOverride !== undefined
          ? Math.max(1, payload.pointsOverride)
          : payload.isRose
          ? Math.max(1, (cfg.rosePoints || 5) * roseCount)
          : Math.max(1, cfg.commentPoints || 1);

      const cleanUser = (payload.username || 'Người Chơi').trim();
      const userKey = cleanUser.toLowerCase();
      const avatarColor = pickColorForUser(cleanUser);
      const rememberedAvatar = userAvatarMemoryRef.current.get(userKey);
      const avatarUrl = resolveAvatarForUsername(
        cleanUser,
        payload.avatarUrl || rememberedAvatar,
        npcAvatarsRef.current
      );
      userAvatarMemoryRef.current.set(userKey, avatarUrl);
      const now = Date.now();
      const isNpcSender = Boolean(payload.isNpc);

      userProvinceMemoryRef.current.set(userKey, targetProv.id);

      const contributor: ProvinceContributor = {
        id: `contrib_${now}_${Math.random().toString(36).slice(2, 6)}`,
        username: cleanUser,
        avatarUrl,
        avatarColor,
        pointsAdded,
        isRose: payload.isRose,
        isNpc: isNpcSender,
        roseCount,
        timestamp: now,
      };

      const singleQueueItem: CameraQueueItem = {
        id: `cam_${now}_${Math.random().toString(36).slice(2, 6)}`,
        provinceId: targetProv.id,
        provinceName: targetProv.name,
        username: cleanUser,
        avatarUrl,
        avatarColor,
        pointsAdded,
        isRose: payload.isRose,
        isNpc: isNpcSender,
        addedAt: now,
        senders: [contributor],
        totalRoses: roseCount,
        totalGifts: 1,
      };

      // Hàm phụ trợ: Đưa vào hàng chờ Camera và TỰ ĐỘNG GOM TẤT CẢ NGƯỜI CÙNG TỈNH vào 1 lượt
      const enqueueAndMergeSameProvince = () => {
        setCameraQueue((prev) => {
          const existingIdx = prev.findIndex(
            (q) => q.provinceId === targetProv.id
          );
          if (existingIdx !== -1) {
            const next = [...prev];
            const targetItem = next[existingIdx];
            const mergedSenders = [...targetItem.senders, contributor];
            const uniqueNames = Array.from(
              new Set(mergedSenders.map((s) => s.username))
            );
            next[existingIdx] = {
              ...targetItem,
              username: uniqueNames.join(', '),
              pointsAdded: targetItem.pointsAdded + pointsAdded,
              isRose: targetItem.isRose || payload.isRose,
              isNpc: Boolean(targetItem.isNpc || isNpcSender),
              senders: mergedSenders,
              totalRoses: targetItem.totalRoses + roseCount,
              totalGifts: targetItem.totalGifts + 1,
            };
            cameraQueueRef.current = next;
            return next;
          }
          const appended = [...prev.slice(-40), singleQueueItem];
          cameraQueueRef.current = appended;
          return appended;
        });
      };

      // Nếu đang trong luồng tổng kết cuối phiên -> Đẩy toàn bộ quà phát sinh vào hàng chờ cho phiên sau!
      if (isSessionEndingRef.current) {
        enqueueAndMergeSameProvince();
        return;
      }

      if (cfg.cameraAutoZoom) {
        const curFocus = cameraFocusRef.current;
        const inOverviewPause =
          curFocus.provinceId === null && now < overviewPauseUntilRef.current;
        const curProvinceStillActive =
          Boolean(curFocus.provinceId) &&
          (now < curFocus.until ||
            soundEngine.isSpeakingOrQueuedForProvince(curFocus.provinceId!));

        // Trường hợp 1: Camera đang rảnh ở Map tổng -> Cộng điểm + đọc TTS + Zoom vào ngay
        if (
          !inOverviewPause &&
          !curProvinceStillActive &&
          cameraQueueRef.current.length === 0
        ) {
          commitGiftTurnToProvinceAndTTS(
            targetProv.id,
            targetProv.name,
            [contributor],
            pointsAdded,
            roseCount,
            1
          );

          const holdMs = Math.max(
            1200,
            Math.round((cfg.cameraHoldDurationSec || 2.5) * 1000)
          );
          const nextFocus: CameraFocusState = {
            provinceId: targetProv.id,
            provinceName: targetProv.name,
            username: cleanUser,
            avatarUrl,
            avatarColor,
            pointsAdded,
            isRose: payload.isRose,
            senders: [contributor],
            totalRoses: roseCount,
            totalGifts: 1,
            startedAt: now,
            until: now + holdMs,
          };
          cameraFocusRef.current = nextFocus;
          setCameraFocus(nextFocus);
          setTimeout(() => {
            spawnThrowAvatarFX({
              provinceId: targetProv.id,
              provinceName: targetProv.name,
              senders: [contributor],
            });
          }, 120);
        } else if (
          curFocus.provinceId === targetProv.id &&
          curProvinceStillActive
        ) {
          // Trường hợp 2: Camera đang Zoom đúng tỉnh này (hoặc vẫn đang đọc sự kiện tỉnh này) -> Gom thêm người chơi vào cùng tỉnh ngay lập tức!
          commitGiftTurnToProvinceAndTTS(
            targetProv.id,
            targetProv.name,
            [contributor],
            pointsAdded,
            roseCount,
            1
          );

          const prevSenders = curFocus.senders || [];
          const nextSenders = [...prevSenders, contributor];
          const nextPoints = (curFocus.pointsAdded || 0) + pointsAdded;
          const nextRoses = (curFocus.totalRoses || 0) + roseCount;
          const nextGifts = (curFocus.totalGifts || 1) + 1;

          const extendedFocus: CameraFocusState = {
            ...curFocus,
            username: cleanUser,
            avatarUrl,
            avatarColor,
            pointsAdded: nextPoints,
            isRose: Boolean(curFocus.isRose || payload.isRose),
            senders: nextSenders,
            totalRoses: nextRoses,
            totalGifts: nextGifts,
            until: Math.max(curFocus.until, now + 1350),
          };
          cameraFocusRef.current = extendedFocus;
          setCameraFocus(extendedFocus);
          spawnThrowAvatarFX({
            provinceId: targetProv.id,
            provinceName: targetProv.name,
            senders: [contributor],
          });
        } else {
          // Trường hợp 3: Đưa vào hàng chờ Camera & tự động gộp tất cả người cùng tỉnh để khi tới lượt đọc 1 lần hết sạch!
          enqueueAndMergeSameProvince();
        }
      } else {
        commitGiftTurnToProvinceAndTTS(
          targetProv.id,
          targetProv.name,
          [contributor],
          pointsAdded,
          roseCount,
          1
        );
        spawnThrowAvatarFX({
          provinceId: targetProv.id,
          provinceName: targetProv.name,
          senders: [contributor],
        });
      }

      if (broadcastSync) {
        syncService.sendCommand('SEND_PROVINCE_GIFT', {
          provinceId: targetProv.id,
          username: cleanUser,
          avatarUrl,
          isRose: payload.isRose,
          isNpc: isNpcSender,
          pointsOverride: pointsAdded,
          roseCountOverride: roseCount,
        });
      }
    },
    [commitGiftTurnToProvinceAndTTS, spawnThrowAvatarFX]
  );

  // Xử lý bình luận từ người chơi (TikTok Live hoặc Test)
  const handleUserComment = useCallback(
    (
      rawUsername: string,
      rawComment: string,
      avatarUrl?: string | null,
      forceProvinceId?: string,
      forceIsRose?: boolean
    ) => {
      const inspection = inspectUserInteraction(
        rawUsername || 'Người Chơi',
        rawComment || '',
        safetyActionMode,
        safetyCategories,
        customWords
      );

      if (inspection.logEntries.length > 0) {
        setSafetyLogs((prev) => [...inspection.logEntries, ...prev].slice(0, 60));
      }
      if (!inspection.allowed) return false;

      const matchedProvince = forceProvinceId
        ? provincesRef.current.find((p) => p.id === forceProvinceId) || null
        : matchProvinceFromComment(rawComment, provincesRef.current);

      if (!matchedProvince) return false;

      const isRose =
        forceIsRose !== undefined
          ? forceIsRose
          : isRoseKeywordInText(rawComment);

      executeProvinceGift(
        {
          provinceId: matchedProvince.id,
          username: inspection.safeUsername,
          avatarUrl: avatarUrl || null,
          isRose,
          isNpc: false,
        },
        true
      );
      return true;
    },
    [customWords, executeProvinceGift, safetyActionMode, safetyCategories]
  );

  // Xử lý khi người chơi tặng quà trên TikTok Live
  const handleUserGift = useCallback(
    (
      rawUsername: string,
      giftName: string,
      coins: number,
      repeatCount = 1,
      avatarUrl?: string | null
    ) => {
      const inspection = inspectUserInteraction(
        rawUsername || 'Người Chơi',
        giftName || '',
        safetyActionMode,
        safetyCategories,
        customWords
      );
      const safeName = inspection.safeUsername;

      let targetProvinceId =
        userProvinceMemoryRef.current.get(safeName.toLowerCase()) ||
        matchProvinceFromComment(safeName, provincesRef.current)?.id ||
        null;

      if (!targetProvinceId) {
        const activeProvinces = provincesRef.current.filter((p) => p.points > 0);
        const pool =
          activeProvinces.length > 0 ? activeProvinces : provincesRef.current;
        const randomPick = pool[Math.floor(Math.random() * pool.length)];
        targetProvinceId = randomPick?.id || provincesRef.current[0]?.id;
      }

      if (!targetProvinceId) return;

      const baseRosePoints = Math.max(1, configRef.current.rosePoints || 5);
      const multiplier = Math.max(1, repeatCount || 1);
      const totalPoints = baseRosePoints * multiplier;

      executeProvinceGift(
        {
          provinceId: targetProvinceId,
          username: safeName,
          avatarUrl: avatarUrl || null,
          isRose: true,
          isNpc: false,
          pointsOverride: totalPoints,
          roseCountOverride: multiplier,
        },
        true
      );
    },
    [customWords, executeProvinceGift, safetyActionMode, safetyCategories]
  );

  // Lắng nghe sự kiện TikTok Live & đồng bộ nhiều tab / OBS
  useEffect(() => {
    const unsubStatus = syncService.onStatusChange((st) => setWsStatus(st));
    const unsubPeers = syncService.onPeerCountChange((counts) => {
      setPeerCounts(counts);
      if (!isObsView) {
        soundEngine.setRemoteSlaveMode(counts.obsPeers > 0);
      }
    });

    const unsubTikTok = syncService.onTikTokEvent((ev) => {
      if (ev.type === 'chat' && ev.comment) {
        handleUserComment(
          ev.username,
          ev.comment,
          ev.avatarUrl || ev.profilePictureUrl || null
        );
      } else if (ev.type === 'gift') {
        handleUserGift(
          ev.username,
          ev.giftName || 'Hoa hồng',
          ev.coins || 1,
          ev.repeatCount || ev.comboCount || 1,
          ev.avatarUrl || ev.profilePictureUrl || null
        );
      }
    });

    const unsubSync = syncService.onSync((packet) => {
      const { action, payload } = packet;
      if (action === 'SEND_PROVINCE_GIFT') {
        executeProvinceGift(
          {
            provinceId: payload.provinceId,
            username: payload.username,
            avatarUrl: payload.avatarUrl,
            isRose: Boolean(payload.isRose),
            isNpc: Boolean(payload.isNpc),
            pointsOverride: payload.pointsOverride,
            roseCountOverride: payload.roseCountOverride,
          },
          false
        );
      } else if (action === 'RESET_ALL_PROVINCES') {
        const fresh = createInitialProvinces();
        provincesRef.current = fresh;
        setProvinces(fresh);
        setActivityLogs([]);
        setCameraQueue([]);
        cameraQueueRef.current = [];
        cameraFocusRef.current = { provinceId: null, until: 0 };
        setCameraFocus({ provinceId: null, until: 0 });
      } else if (
        action === 'UPDATE_PROVINCES_STATE' &&
        Array.isArray(payload.provinces)
      ) {
        provincesRef.current = payload.provinces;
        setProvinces(payload.provinces);
      } else if (action === 'UPDATE_CONFIG' && payload.patch) {
        setConfig((prev) => ({ ...prev, ...payload.patch }));
      } else if (action === 'CAMERA_CMD') {
        if (payload.cmd === 'RESET') {
          cameraQueueRef.current = [];
          setCameraQueue([]);
          cameraFocusRef.current = { provinceId: null, until: 0 };
          setCameraFocus({ provinceId: null, until: 0 });
        } else if (payload.cmd === 'SKIP') {
          cameraFocusRef.current = { provinceId: null, until: 0 };
          setCameraFocus({ provinceId: null, until: 0 });
        } else if (payload.cmd === 'FOCUS_PROVINCE' && payload.provinceId) {
          const found = provincesRef.current.find(
            (p) => p.id === payload.provinceId
          );
          if (found) {
            const now = Date.now();
            const holdMs = Math.max(
              1500,
              Math.round(
                (configRef.current.cameraHoldDurationSec || 2.5) * 1000
              )
            );
            const focusState: CameraFocusState = {
              provinceId: found.id,
              provinceName: found.name,
              senders: found.recentContributors.slice(0, 4),
              pointsAdded: found.points,
              until: now + holdMs,
            };
            cameraFocusRef.current = focusState;
            setCameraFocus(focusState);
          }
        }
      } else if (action === 'PANIC_MUTE') {
        soundEngine.stopImmediate();
      } else if (action === 'CLEAR_TTS_QUEUE') {
        soundEngine.clearEventQueue();
      } else if (action === 'REQUEST_FULL_SYNC' && !isObsView) {
        syncService.sendCommand('UPDATE_CONFIG', { patch: configRef.current });
        syncService.sendCommand('UPDATE_PROVINCES_STATE', {
          provinces: provincesRef.current,
        });
      }
    });

    return () => {
      unsubStatus();
      unsubPeers();
      unsubTikTok();
      unsubSync();
    };
  }, [executeProvinceGift, handleUserComment, handleUserGift, isObsView]);

  // Giả lập NPC tự động hỗ trợ điểm tỉnh với chu kỳ cộng trừ ngẫu nhiên ±1..2s để tạo độ tự nhiên
  useEffect(() => {
    if (!config.npcAutoEnabled) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleNextNpcAction = () => {
      if (cancelled) return;
      const baseSec = Math.max(1.5, configRef.current.npcIntervalSec || 4);
      // Dao động ngẫu nhiên ±1s đến ±2s tạo nhịp tự nhiên như người xem thật
      const maxJitter = baseSec <= 2.5 ? 1.0 : 2.0;
      const randomJitterSec = (Math.random() * 2 - 1) * maxJitter;
      const nextDelayMs = Math.max(
        800,
        Math.round((baseSec + randomJitterSec) * 1000)
      );

      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        if (!isSessionEndingRef.current) {
          const list = provincesRef.current;
          if (list.length > 0) {
            const randomProv = list[Math.floor(Math.random() * list.length)];
            const names = npcNames.length > 0 ? npcNames : SAMPLE_NAMES;
            const avatars =
              npcAvatars.length > 0 ? npcAvatars : DEFAULT_NPC_AVATARS;
            const randomName = names[Math.floor(Math.random() * names.length)];
            const randomAvatar =
              avatars[Math.floor(Math.random() * avatars.length)];
            const isRose =
              Math.random() * 100 <
              (configRef.current.npcRoseChancePercent ?? 35);

            executeProvinceGift(
              {
                provinceId: randomProv.id,
                username: randomName,
                avatarUrl: randomAvatar,
                isRose,
                isNpc: true,
              },
              true
            );
          }
        }
        scheduleNextNpcAction();
      }, nextDelayMs);
    };

    scheduleNextNpcAction();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    config.npcAutoEnabled,
    config.npcIntervalSec,
    config.npcRoseChancePercent,
    executeProvinceGift,
    npcAvatars,
    npcNames,
  ]);

  const handleUpdateConfig = useCallback((patch: Partial<GameConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      syncService.sendCommand('UPDATE_CONFIG', { patch });
      return next;
    });
  }, []);

  const handleResetAllProvinces = useCallback(() => {
    const fresh = createInitialProvinces();
    provincesRef.current = fresh;
    setProvinces(fresh);
    setActivityLogs([]);
    cameraQueueRef.current = [];
    setCameraQueue([]);
    cameraFocusRef.current = { provinceId: null, until: 0 };
    setCameraFocus({ provinceId: null, until: 0 });
    setSessionEndSummary(null);
    isSessionEndingRef.current = false;
    soundEngine.announceRoundStart(
      configRef.current.roundNumber || 69,
      configRef.current
    );
    syncService.sendCommand('RESET_ALL_PROVINCES', {});
  }, []);

  const handleRenameProvince = useCallback(
    (provinceId: string, newName: string) => {
      setProvinces((prev) => {
        const next = prev.map((p) =>
          p.id === provinceId ? { ...p, name: newName } : p
        );
        provincesRef.current = next;
        syncService.sendCommand('UPDATE_PROVINCES_STATE', { provinces: next });
        return next;
      });
    },
    []
  );

  const handleSetProvincePoints = useCallback(
    (provinceId: string, points: number) => {
      setProvinces((prev) => {
        const next = prev.map((p) =>
          p.id === provinceId ? { ...p, points: Math.max(0, points) } : p
        );
        provincesRef.current = next;
        syncService.sendCommand('UPDATE_PROVINCES_STATE', { provinces: next });
        return next;
      });
    },
    []
  );

  const handleTriggerRandomGift = useCallback(
    (
      isRose: boolean,
      specificProvinceId?: string,
      customUsername?: string,
      isNpc = false
    ) => {
      const list = provincesRef.current;
      if (list.length === 0) return;
      const target =
        (specificProvinceId && list.find((p) => p.id === specificProvinceId)) ||
        list[Math.floor(Math.random() * list.length)];
      const names = npcNames.length > 0 ? npcNames : SAMPLE_NAMES;
      const avatars = npcAvatars.length > 0 ? npcAvatars : DEFAULT_NPC_AVATARS;
      const username =
        customUsername && customUsername.trim()
          ? customUsername.trim()
          : names[Math.floor(Math.random() * names.length)];
      const avatarUrl = avatars[Math.floor(Math.random() * avatars.length)];

      executeProvinceGift(
        {
          provinceId: target.id,
          username,
          avatarUrl,
          isRose,
          isNpc,
        },
        true
      );
    },
    [executeProvinceGift, npcAvatars, npcNames]
  );

  /**
   * Test nhiều người cùng lúc gửi quà / hoa hồng về cùng 1 tỉnh (Gom nhiều Avatar + đọc tên liên tiếp)
   */
  const handleTriggerBatchSameProvince = useCallback(
    (provinceId?: string, senderCount = 3, isRose = true) => {
      const list = provincesRef.current;
      if (list.length === 0) return;
      const target =
        (provinceId && list.find((p) => p.id === provinceId)) ||
        list.find((p) => p.id === 'lang-son') ||
        list[0];
      const names = npcNames.length > 0 ? npcNames : SAMPLE_NAMES;
      const avatars = npcAvatars.length > 0 ? npcAvatars : DEFAULT_NPC_AVATARS;

      const count = Math.max(2, Math.min(8, senderCount));
      const startIndex = Math.floor(Math.random() * names.length);

      for (let i = 0; i < count; i++) {
        const uname = names[(startIndex + i) % names.length];
        const uavatar = avatars[(startIndex + i) % avatars.length];
        executeProvinceGift(
          {
            provinceId: target.id,
            username: uname,
            avatarUrl: uavatar,
            isRose,
          },
          true
        );
      }
    },
    [executeProvinceGift, npcAvatars, npcNames]
  );

  const handleFocusProvinceManual = useCallback((provinceId: string) => {
    const found = provincesRef.current.find((p) => p.id === provinceId);
    if (!found) return;
    const now = Date.now();
    const holdMs = Math.max(
      1800,
      Math.round((configRef.current.cameraHoldDurationSec || 2.5) * 1000)
    );
    const nextFocus: CameraFocusState = {
      provinceId: found.id,
      provinceName: found.name,
      senders: found.recentContributors.slice(0, 4),
      pointsAdded: found.points,
      startedAt: now,
      until: now + holdMs,
    };
    cameraFocusRef.current = nextFocus;
    setCameraFocus(nextFocus);
    syncService.sendCommand('CAMERA_CMD', {
      cmd: 'FOCUS_PROVINCE',
      provinceId: found.id,
    });
  }, []);

  const handleSkipCameraTarget = useCallback(() => {
    cameraFocusRef.current = { provinceId: null, until: 0 };
    setCameraFocus({ provinceId: null, until: 0 });
    syncService.sendCommand('CAMERA_CMD', { cmd: 'SKIP' });
  }, []);

  const handleResetCameraView = useCallback(() => {
    cameraQueueRef.current = [];
    setCameraQueue([]);
    overviewPauseUntilRef.current = 0;
    cameraFocusRef.current = { provinceId: null, until: 0 };
    setCameraFocus({ provinceId: null, until: 0 });
    syncService.sendCommand('CAMERA_CMD', { cmd: 'RESET' });
  }, []);

  const handleClearCameraQueue = useCallback(() => {
    cameraQueueRef.current = [];
    setCameraQueue([]);
  }, []);

  const handleRemoveCameraQueueItem = useCallback((queueId: string) => {
    setCameraQueue((prev) => {
      const next = prev.filter((item) => item.id !== queueId);
      cameraQueueRef.current = next;
      return next;
    });
  }, []);

  const handleToggleLocalMute = useCallback(() => {
    const next = !soundEngine.isTabMuted();
    soundEngine.setTabMuted(next);
    setIsLocalTabMuted(next);
  }, []);

  const handlePanicMute = useCallback(() => {
    soundEngine.stopImmediate();
    syncService.sendCommand('PANIC_MUTE', {});
  }, []);

  const handleTestTTS = useCallback(() => {
    const sample = soundEngine.formatProvinceGiftSpeech(
      'Minh Khang',
      'Lạng Sơn',
      1,
      false,
      configRef.current,
      true
    );
    soundEngine.enqueueTTS(sample, true, configRef.current);
  }, []);

  const handleClearEventTtsQueue = useCallback(() => {
    soundEngine.clearEventQueue();
    syncService.sendCommand('CLEAR_TTS_QUEUE', {});
  }, []);

  const handlePushFullSyncToLive = useCallback(() => {
    syncService.sendCommand('UPDATE_CONFIG', { patch: configRef.current });
    syncService.sendCommand('UPDATE_PROVINCES_STATE', {
      provinces: provincesRef.current,
    });
  }, []);

  const handleSaveBackupJson = useCallback(() => {
    const backup: StudioBackupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      config: configRef.current,
      provinces: provincesRef.current.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.points,
        giftCount: p.giftCount,
        roseCount: p.roseCount,
        recentContributors: p.recentContributors,
      })),
      npcNames,
      npcAvatars,
      safetyActionMode,
      safetyCategories,
      customWords,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gui-qua-ve-tinh-layout-config-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [customWords, npcAvatars, npcNames, safetyActionMode, safetyCategories]);

  const handleLoadBackupJson = useCallback(
    (rawJsonText: string): { ok: boolean; message: string } => {
      try {
        const parsed = JSON.parse(rawJsonText) as Partial<StudioBackupData> & {
          layoutPositions?: GameConfig['layoutPositions'];
          layoutVisibility?: GameConfig['layoutVisibility'];
          howToPlayConfig?: GameConfig['howToPlayConfig'];
          giftGuideItems?: GameConfig['giftGuideItems'];
        };

        const incomingConfig: Partial<GameConfig> | undefined =
          parsed.config && typeof parsed.config === 'object'
            ? parsed.config
            : parsed.layoutPositions || parsed.howToPlayConfig
            ? (parsed as unknown as Partial<GameConfig>)
            : undefined;

        if (incomingConfig) {
          setConfig((prev) => {
            const next: GameConfig = {
              ...prev,
              ...incomingConfig,
              ttsEngine: 'node_edge',
              howToPlayConfig: {
                ...DEFAULT_HOW_TO_PLAY_CONFIG,
                ...(prev.howToPlayConfig || {}),
                ...(incomingConfig.howToPlayConfig || {}),
              },
              layoutPositions: {
                ...DEFAULT_LAYOUT_POSITIONS,
                ...(prev.layoutPositions || {}),
                ...(incomingConfig.layoutPositions || {}),
              },
              layoutVisibility: {
                ...DEFAULT_LAYOUT_VISIBILITY,
                ...(prev.layoutVisibility || {}),
                ...(incomingConfig.layoutVisibility || {}),
              },
              giftGuideItems:
                Array.isArray(incomingConfig.giftGuideItems) &&
                incomingConfig.giftGuideItems.length > 0
                  ? incomingConfig.giftGuideItems
                  : prev.giftGuideItems,
              ttsRandomPhrases:
                Array.isArray(incomingConfig.ttsRandomPhrases) &&
                incomingConfig.ttsRandomPhrases.length > 0
                  ? incomingConfig.ttsRandomPhrases
                  : prev.ttsRandomPhrases,
            };
            syncService.sendCommand('UPDATE_CONFIG', { patch: next });
            return next;
          });
        }

        if (Array.isArray(parsed.provinces)) {
          const byId = new Map(parsed.provinces.map((p) => [p.id, p]));
          setProvinces((prev) => {
            const next = prev.map((item) => {
              const found = byId.get(item.id);
              if (!found) return item;
              return {
                ...item,
                name: found.name || item.name,
                points: Number(found.points) || 0,
                giftCount: Number(found.giftCount) || 0,
                roseCount: Number(found.roseCount) || 0,
                recentContributors: Array.isArray(found.recentContributors)
                  ? found.recentContributors
                  : [],
              };
            });
            provincesRef.current = next;
            syncService.sendCommand('UPDATE_PROVINCES_STATE', {
              provinces: next,
            });
            return next;
          });
        }
        if (Array.isArray(parsed.npcNames)) setNpcNames(parsed.npcNames);
        if (Array.isArray(parsed.npcAvatars)) setNpcAvatars(parsed.npcAvatars);
        if (parsed.safetyActionMode) setSafetyActionMode(parsed.safetyActionMode);
        if (Array.isArray(parsed.safetyCategories)) {
          setSafetyCategories(parsed.safetyCategories);
        }
        if (Array.isArray(parsed.customWords)) {
          setCustomWords(parsed.customWords);
          saveCustomWordsToStorage(parsed.customWords);
        }
        return {
          ok: true,
          message:
            'Đã nạp thành công toàn bộ thiết lập & vị trí Layout từ file JSON!',
        };
      } catch {
        return { ok: false, message: 'File JSON không hợp lệ!' };
      }
    },
    []
  );

  return {
    config,
    provinces,
    thrownAvatars,
    cameraFocus,
    cameraQueue,
    activityLogs,
    sessionEndSummary,
    wsStatus,
    peerCounts,
    isLocalTabMuted,
    ttsStatus,
    eventTtsQueue,
    npcNames,
    npcAvatars,
    safetyActionMode,
    safetyCategories,
    customWords,
    safetyLogs,
    handleUpdateConfig,
    handleUserComment,
    handleUserGift,
    handleTriggerRandomGift,
    handleTriggerBatchSameProvince,
    handleResetAllProvinces,
    handleRenameProvince,
    handleSetProvincePoints,
    handleFocusProvinceManual,
    handleSkipCameraTarget,
    handleResetCameraView,
    handleClearCameraQueue,
    handleRemoveCameraQueueItem,
    handleToggleLocalMute,
    handlePanicMute,
    handleTestTTS,
    handleClearEventTtsQueue,
    handlePushFullSyncToLive,
    handleSaveBackupJson,
    handleLoadBackupJson,
    handleSessionTimeUp,
    onConnectWs: (url: string) => syncService.connectWebSocket(url),
    onUpdateNpcNames: (names: string[]) => {
      setNpcNames(names);
      try {
        localStorage.setItem(STORAGE_NPC_NAMES_KEY, JSON.stringify(names));
      } catch {
        // Ignore
      }
    },
    onResetNpcNames: () => {
      setNpcNames([...SAMPLE_NAMES]);
      try {
        localStorage.removeItem(STORAGE_NPC_NAMES_KEY);
      } catch {
        // Ignore
      }
    },
    onUpdateNpcAvatars: (avatars: string[]) => {
      setNpcAvatars(avatars);
      try {
        localStorage.setItem(STORAGE_NPC_AVATARS_KEY, JSON.stringify(avatars));
      } catch {
        // Ignore
      }
    },
    onResetNpcAvatars: () => {
      setNpcAvatars([...DEFAULT_NPC_AVATARS]);
      try {
        localStorage.removeItem(STORAGE_NPC_AVATARS_KEY);
      } catch {
        // Ignore
      }
    },
    onChangeSafetyMode: (mode: SafetyActionMode) => setSafetyActionMode(mode),
    onToggleSafetyCategory: (key: string, enabled: boolean) => {
      setSafetyCategories((prev) =>
        prev.map((c) => (c.key === key ? { ...c, enabled } : c))
      );
    },
    onAddCustomWords: (raw: string) => {
      const added = raw
        .split(/[,;\n]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (added.length === 0) return;
      setCustomWords((prev) => {
        const next = Array.from(new Set([...prev, ...added]));
        saveCustomWordsToStorage(next);
        return next;
      });
    },
    onRemoveCustomWord: (word: string) => {
      setCustomWords((prev) => {
        const next = prev.filter((w) => w !== word);
        saveCustomWordsToStorage(next);
        return next;
      });
    },
    onResetCustomWords: () => {
      const def = getDefaultCustomWords();
      setCustomWords(def);
      saveCustomWordsToStorage(def);
    },
    onClearSafetyLogs: () => setSafetyLogs([]),
  };
}
