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
  DEFAULT_WELCOME_JOIN_PHRASES,
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
  sessionTitle?: string;
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
          multiRoseGiftTtsTemplate:
            parsed.multiRoseGiftTtsTemplate ||
            DEFAULT_CONFIG.multiRoseGiftTtsTemplate,
          welcomeJoinEnabled:
            parsed.welcomeJoinEnabled !== undefined
              ? Boolean(parsed.welcomeJoinEnabled)
              : DEFAULT_CONFIG.welcomeJoinEnabled,
          welcomeJoinPhrases:
            Array.isArray(parsed.welcomeJoinPhrases) &&
            parsed.welcomeJoinPhrases.length > 0
              ? parsed.welcomeJoinPhrases
              : DEFAULT_WELCOME_JOIN_PHRASES,
          rosePromptEnabled:
            parsed.rosePromptEnabled !== undefined
              ? Boolean(parsed.rosePromptEnabled)
              : DEFAULT_CONFIG.rosePromptEnabled,
          rosePromptChancePercent:
            parsed.rosePromptChancePercent !== undefined
              ? Number(parsed.rosePromptChancePercent)
              : DEFAULT_CONFIG.rosePromptChancePercent,
          rosePromptTemplate:
            parsed.rosePromptTemplate || DEFAULT_CONFIG.rosePromptTemplate,
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
              top1WinCount: Number(found.top1WinCount) || 0,
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

  const npcNamesRef = useRef(npcNames);
  npcNamesRef.current = npcNames;

  const cameraFocusRef = useRef(cameraFocus);
  cameraFocusRef.current = cameraFocus;

  const cameraQueueRef = useRef(cameraQueue);
  cameraQueueRef.current = cameraQueue;

  const isSessionEndingRef = useRef<boolean>(false);
  const sessionEndTimeoutRef = useRef<number | null>(null);
  const initialRoundAnnouncedRef = useRef<boolean>(false);

  // Chống nhân đôi sự kiện quà tặng / bình luận khi đồng bộ đa luồng hoặc bấm đúp
  const processedGiftEventIdsRef = useRef<Set<string>>(new Set());
  const recentGiftFingerprintMapRef = useRef<Map<string, number>>(new Map());

  // Lưu mốc thời gian nghỉ ở Map tổng giữa 2 lượt khi ở chế độ 2 (alternating_overview)
  const overviewPauseUntilRef = useRef<number>(0);

  const userProvinceMemoryRef = useRef<Map<string, string>>(new Map());
  const userAvatarMemoryRef = useRef<Map<string, string>>(new Map());
  // Trong mỗi phiên, mỗi người chơi chỉ được bình luận 1 lần để +1 điểm (nhưng được tặng hoa hồng không giới hạn)
  const sessionCommentedUsersRef = useRef<Set<string>>(new Set());

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
   * Cộng điểm + lưu người đóng góp + ghi lịch sử cho tỉnh (tách riêng để dùng cho cả chế độ thường và Đọc Siêu Tốc)
   */
  const commitPointsOnlyToProvince = useCallback(
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

      const nextProvinces = provincesRef.current.map((p) => {
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
        ]
          .sort((a, b) => b.pointsAdded - a.pointsAdded)
          .slice(0, sessionContributorCap);

        return {
          ...p,
          points: p.points + totalPointsAdded,
          giftCount: p.giftCount + totalGiftsAdded,
          roseCount: p.roseCount + totalRosesAdded,
          recentContributors: mergedContribs,
          lastUpdatedAt: now,
        };
      });

      provincesRef.current = nextProvinces;
      setProvinces(nextProvinces);

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
    },
    []
  );

  /**
   * Ghi nhận điểm số + lưu toàn bộ người chơi đóng góp trong phiên (tối đa 24 người/tỉnh) + đọc AI #3
   * Đọc gộp TẤT CẢ tên người chơi trong lượt tỉnh đó cùng lúc kèm % câu chào / vu vơ hoặc lời cảm ơn nhiều hoa hồng!
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
      commitPointsOnlyToProvince(
        provinceId,
        provinceName,
        senders,
        totalPointsAdded,
        totalRosesAdded,
        totalGiftsAdded
      );

      const anyRose = totalRosesAdded > 0 || senders.some((s) => s.isRose);
      const anyFromNpc = senders.some((s) => Boolean(s.isNpc));
      // NPC hỗ trợ 1 điểm (!isRose) được coi là người chơi bình thường về danh xưng (không đọc từ "NPC"),
      // nhưng tuyệt đối không đọc câu chào phòng / gợi ý gửi hoa cho NPC
      const readNpcPrefix = senders.some((s) => Boolean(s.isNpc && s.isRose));
      const uniqueNames = Array.from(new Set(senders.map((s) => s.username)));

      const speechText =
        uniqueNames.length > 1
          ? soundEngine.formatBatchedProvinceGiftSpeech(
              uniqueNames,
              provinceName,
              totalPointsAdded,
              totalRosesAdded,
              cfg,
              !anyFromNpc,
              readNpcPrefix
            )
          : soundEngine.formatProvinceGiftSpeech(
              uniqueNames[0] || 'Người chơi',
              provinceName,
              totalPointsAdded,
              anyRose,
              cfg,
              !anyFromNpc,
              readNpcPrefix,
              Math.max(1, totalRosesAdded)
            );

      soundEngine.enqueueTTS(speechText, anyRose, cfg, {
        provinceId,
        provinceName,
        username: uniqueNames.join(', '),
        usernamesList: uniqueNames,
        reason: anyRose ? 'gift' : 'comment',
        isRose: anyRose,
        isNpc: anyFromNpc,
        pointsAdded: totalPointsAdded,
        totalRoses: totalRosesAdded,
      });
    },
    [commitPointsOnlyToProvince]
  );

  /**
   * Gộp danh sách người gửi theo tên (không phân biệt hoa/thường),
   * giữ nguyên ID đầu tiên để Avatar to không bị tạo mới hay nhảy lại lần 2 khi cộng dồn bình luận +1đ và hoa hồng!
   */
  const mergeContributorsByUser = useCallback(
    (
      existingList: ProvinceContributor[],
      incomingList: ProvinceContributor[]
    ): ProvinceContributor[] => {
      const map = new Map<string, ProvinceContributor>();
      for (const item of [...existingList, ...incomingList]) {
        const key = item.username.toLowerCase();
        const prev = map.get(key);
        if (prev) {
          map.set(key, {
            ...prev,
            avatarUrl: item.avatarUrl || prev.avatarUrl,
            pointsAdded: prev.pointsAdded + item.pointsAdded,
            roseCount: (prev.roseCount || 0) + (item.roseCount || 0),
            isRose: Boolean(prev.isRose || item.isRose),
            isNpc: Boolean(prev.isNpc || item.isNpc),
            timestamp: item.timestamp,
          });
        } else {
          map.set(key, { ...item });
        }
      }
      return Array.from(map.values());
    },
    []
  );

  /**
   * Bộ điều phối Camera hỗ trợ 2 chế độ:
   * 1. 'continuous' (Phản ứng liên tục - mặc định): Nhảy thẳng sang tỉnh kế tiếp trong hàng chờ
   * 2. 'alternating_overview' (Xen kẽ zoom tổng): Sau mỗi lượt tỉnh, zoom nhanh ra Map tổng rồi mới zoom vào tỉnh mới
   * ĐẶC BIỆT:
   * - ƯU TIÊN GIỮ ZOOM TỈNH nếu Giọng đọc AI #3 vẫn còn đang đọc chưa xong sự kiện của tỉnh đó!
   * - Với người thật: tự động quét hàng chờ `cameraQueue`, rút những người thật vào cùng tỉnh ra đọc 1 lúc.
   * - Với NPC: mỗi lần chỉ xử lý đúng 1 NPC duy nhất (không gộp nhiều NPC làm 1 lượt).
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSessionEndingRef.current || soundEngine.isTurboBatchActive()) {
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

        // - Nếu mục đầu là NPC hoặc là Quà tặng / Hoa hồng (isRose): xử lý độc lập từng mục để đọc chính xác số bông hoa và số điểm của từng lượt tặng!
        // - Nếu là bình luận 1 điểm của người chơi thật (!isNpc && !isRose): gom các bình luận 1 điểm có cùng `provinceId` để đọc nhanh
        const sameProvinceItems =
          headItem.isNpc || headItem.isRose
            ? [headItem]
            : queue.filter(
                (item) =>
                  item.provinceId === targetProvId &&
                  !item.isNpc &&
                  !item.isRose
              );
        const pickedIds = new Set(sameProvinceItems.map((item) => item.id));
        const remainingQueue = queue.filter((item) => !pickedIds.has(item.id));

        cameraQueueRef.current = remainingQueue;
        setCameraQueue(remainingQueue);

        const rawSenders: ProvinceContributor[] = [];
        let mergedPoints = 0;
        let mergedRoses = 0;
        let mergedGifts = 0;
        let anyRose = false;

        for (const item of sameProvinceItems) {
          rawSenders.push(...item.senders);
          mergedPoints += item.pointsAdded;
          mergedRoses += item.totalRoses;
          mergedGifts += item.totalGifts;
          if (item.isRose) anyRose = true;
        }

        const mergedSenders = mergeContributorsByUser([], rawSenders);

        const uniqueSenderNames = Array.from(
          new Set(mergedSenders.map((s) => s.username))
        );

        // Cộng điểm, lưu Avatar vào tỉnh và đọc tên người chơi của tỉnh này
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
          totalGifts: anyRose ? Math.max(1, mergedRoses) : mergedGifts,
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
  }, [commitGiftTurnToProvinceAndTTS, mergeContributorsByUser, spawnThrowAvatarFX]);

  /**
   * Luồng Kết Thúc Phiên Chơi & Chuyển Sang Vòng Mới:
   * - Xóa toàn bộ hàng chờ 1 điểm (comment trong hàng chờ), CHỈ GIỮ LẠI hàng chờ tặng quà (isRose = true) sang phiên mới
   * - Đưa Camera về Map tổng
   * - Cộng +1 lần đạt Top 1 (`top1WinCount`) cho tỉnh dẫn đầu phiên (nếu có điểm > 0)
   * - Thông báo Kết Quả Phiên & đọc vinh danh Top 1, 2, 3 tỉnh bằng Giọng đọc AI #3
   * - ƯU TIÊN THEO NGƯỜI ĐỌC: Ngay khi Giọng đọc AI #3 đọc xong câu tổng kết -> lập tức chuyển luồng sang vòng mới,
   *   reset điểm phiên (giữ nguyên `top1WinCount`), reset danh sách 1-bình-luận/phiên, đọc lời chào Vòng mới và chạy tiếp hàng chờ tặng quà!
   */
  const handleSessionTimeUp = useCallback((sessionNum: number) => {
    if (isSessionEndingRef.current) return;
    isSessionEndingRef.current = true;

    // Khi kết thúc phiên chơi: xóa các hàng chờ 1 điểm (comment trong hàng chờ), chỉ giữ lại hàng chờ tặng quà (isRose = true)
    const giftOnlyQueue = cameraQueueRef.current.filter((q) =>
      Boolean(q.isRose)
    );
    cameraQueueRef.current = giftOnlyQueue;
    setCameraQueue(giftOnlyQueue);

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
    const top1WinnerId = scoredTop3.length > 0 ? scoredTop3[0].id : null;
    const deferredCount = giftOnlyQueue.length;
    const sessionName = configRef.current.sessionTitle || 'Vòng';

    // Cập nhật ngay số lần đạt Top 1 cho tỉnh hạng nhất phiên này
    if (top1WinnerId) {
      const updatedWithWin = provincesRef.current.map((p) =>
        p.id === top1WinnerId
          ? { ...p, top1WinCount: (p.top1WinCount || 0) + 1 }
          : p
      );
      provincesRef.current = updatedWithWin;
      setProvinces(updatedWithWin);
    }

    // Bảng tổng kết chỉ đọc ngắn gọn Top 1, 2, 3 tỉnh + điểm (không đọc tên người top để tránh quá dài khi hàng chờ nhiều)
    const summarySentences: string[] = [];
    if (scoredTop3.length === 0) {
      summarySentences.push(
        `Kết thúc ${sessionName} ${sessionNum}. Chưa có tỉnh nào ghi điểm.`
      );
    } else {
      const rankPhrases = scoredTop3.map((p, idx) => {
        const rankName =
          idx === 0 ? 'Top 1' : idx === 1 ? 'Top 2' : 'Top 3';
        return `${rankName} ${p.name.replace(/^TP\.\s*/i, '')} ${p.points} điểm`;
      });
      summarySentences.push(
        `Kết thúc ${sessionName} ${sessionNum}! Tổng kết dẫn đầu: ${rankPhrases.join(
          ', '
        )}.`
      );
    }

    const speechText = summarySentences.join(' ');

    setSessionEndSummary({
      sessionNum,
      sessionTitle: sessionName,
      top3,
      top5,
      deferredQueueCount: deferredCount,
      speechText,
    });

    let transitioned = false;
    const transitionToNextRound = () => {
      if (transitioned) return;
      transitioned = true;
      if (sessionEndTimeoutRef.current) {
        window.clearTimeout(sessionEndTimeoutRef.current);
        sessionEndTimeoutRef.current = null;
      }

      // Reset giới hạn bình luận 1 lần/phiên cho phiên mới
      sessionCommentedUsersRef.current.clear();

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
          top1WinCount: currentProv?.top1WinCount || 0,
          recentContributors: [],
          lastUpdatedAt: 0,
        };
      });

      const nextRoundNum = sessionNum + 1;
      provincesRef.current = freshProvinces;
      setProvinces(freshProvinces);
      setActivityLogs([]);
      setSessionEndSummary(null);
      setConfig((prev) => ({
        ...prev,
        roundNumber: nextRoundNum,
      }));
      isSessionEndingRef.current = false;

      // Đọc luồng âm thanh báo Vòng mới bắt đầu, mời các bạn tham gia giao lưu với nhau
      soundEngine.announceRoundStart(nextRoundNum, configRef.current);

      syncService.sendCommand('UPDATE_PROVINCES_STATE', {
        provinces: freshProvinces,
      });
    };

    // Đọc lần lượt đầy đủ tất cả các câu tổng kết Top 3 tỉnh.
    // CHỈ KHI NGƯỜI ĐỌC ĐỌC XONG HẾT toàn bộ phần tổng kết mới chuyển sang phiên game mới!
    soundEngine.announceSessionResultNow(
      summarySentences,
      configRef.current,
      () => {
        const waitUntilSummaryDone = () => {
          if (transitioned) return;
          if (soundEngine.isSessionSummarySpeakingOrQueued()) {
            window.setTimeout(waitUntilSummaryDone, 200);
            return;
          }
          window.setTimeout(transitionToNextRound, 300);
        };
        waitUntilSummaryDone();
      }
    );

    // Bộ kiểm tra an toàn: Nếu người đọc vẫn đang đọc phần tổng kết thì tiếp tục chờ,
    // tuyệt đối không ngắt ngang khi đang đọc tổng kết!
    const startedSummaryAt = Date.now();
    const checkSummarySafety = () => {
      if (transitioned) return;
      const elapsedMs = Date.now() - startedSummaryAt;
      if (
        soundEngine.isSessionSummarySpeakingOrQueued() &&
        elapsedMs < 90000
      ) {
        sessionEndTimeoutRef.current = window.setTimeout(
          checkSummarySafety,
          1000
        );
        return;
      }
      transitionToNextRound();
    };
    if (sessionEndTimeoutRef.current) {
      window.clearTimeout(sessionEndTimeoutRef.current);
    }
    sessionEndTimeoutRef.current = window.setTimeout(checkSummarySafety, 8000);
  }, []);

  /**
   * Hàm trung tâm xử lý khi người chơi bình luận đến tỉnh (+1đ) hoặc gửi hoa hồng (+5đ)
   * - Trong mỗi phiên: người chơi chỉ được bình luận 1 lần để +1 điểm (nhưng có thể tặng nhiều hoa hồng & nhiều điểm không giới hạn!)
   * - Gửi quà / gửi hoa (isRose = true) luôn được ưu tiên đẩy lên ĐẦU hàng chờ đọc (trước các bình luận 1 điểm)
   * - Mỗi lượt tặng hoa được giữ nguyên số lượng hoa và số điểm chính xác, không tự động gộp làm sai lệch số bông hoa
   */
  const executeProvinceGift = useCallback(
    (
      payload: {
        eventId?: string;
        provinceId: string;
        username: string;
        avatarUrl?: string | null;
        isRose: boolean;
        isNpc?: boolean;
        pointsOverride?: number;
        roseCountOverride?: number;
        bypassCommentLimit?: boolean;
      },
      broadcastSync = true
    ): { ok: boolean; reason?: string } => {
      const cfg = configRef.current;
      const targetProv = provincesRef.current.find(
        (p) => p.id === payload.provinceId
      );
      if (!targetProv) return { ok: false, reason: 'province_not_found' };

      const cleanUser = (payload.username || 'Người Chơi').trim();
      const userKey = cleanUser.toLowerCase();
      const isFromNpc = Boolean(payload.isNpc);
      const now = Date.now();

      // 1. Chống thực thi trùng lặp theo eventId
      const eventId =
        payload.eventId ||
        `gift_${now}_${Math.random().toString(36).slice(2, 8)}`;
      if (processedGiftEventIdsRef.current.has(eventId)) {
        return { ok: false, reason: 'duplicate_event_id' };
      }
      processedGiftEventIdsRef.current.add(eventId);
      if (processedGiftEventIdsRef.current.size > 300) {
        const firstKey = processedGiftEventIdsRef.current.values().next().value;
        if (firstKey) processedGiftEventIdsRef.current.delete(firstKey);
      }

      const roseCount = payload.isRose
        ? Math.max(1, Number(payload.roseCountOverride) || 1)
        : 0;
      const pointsAdded =
        payload.pointsOverride !== undefined
          ? Math.max(1, Number(payload.pointsOverride) || 1)
          : payload.isRose
          ? Math.max(1, (cfg.rosePoints || 5) * roseCount)
          : Math.max(1, cfg.commentPoints || 1);

      // 2. Chống bị bắn đúp cùng 1 gói quà / bình luận (chặn 5000ms đối với gói đồng bộ chéo giữa 2 tab để tuyệt đối không bị x2 quà khi mở 2 cửa sổ)
      const fingerprint = `${userKey}:${targetProv.id}:${payload.isRose ? 'R' : 'C'}:${pointsAdded}:${roseCount}:${isFromNpc ? 'N' : 'U'}`;
      const lastExecAt =
        recentGiftFingerprintMapRef.current.get(fingerprint) || 0;
      const throttleWindowMs = broadcastSync ? 380 : 5000;
      if (now - lastExecAt < throttleWindowMs) {
        return { ok: false, reason: 'duplicate_gift_throttled' };
      }
      recentGiftFingerprintMapRef.current.set(fingerprint, now);

      // Luôn ghi nhớ tỉnh người chơi chọn để khi họ tặng hoa hồng sẽ cộng về đúng tỉnh đó
      userProvinceMemoryRef.current.set(userKey, targetProv.id);

      // Kiểm tra giới hạn: Trong mỗi phiên, người chơi thật chỉ được comment 1 lần để +1 điểm
      if (
        !payload.isRose &&
        !isFromNpc &&
        !payload.bypassCommentLimit &&
        sessionCommentedUsersRef.current.has(userKey)
      ) {
        return { ok: false, reason: 'already_commented_in_session' };
      }

      if (!payload.isRose && !isFromNpc) {
        sessionCommentedUsersRef.current.add(userKey);
      }

      const avatarColor = pickColorForUser(cleanUser);
      const rememberedAvatar = userAvatarMemoryRef.current.get(userKey);
      const avatarUrl = resolveAvatarForUsername(
        cleanUser,
        payload.avatarUrl || rememberedAvatar,
        npcAvatarsRef.current
      );
      userAvatarMemoryRef.current.set(userKey, avatarUrl);

      const contributor: ProvinceContributor = {
        id: `contrib_${now}_${Math.random().toString(36).slice(2, 6)}`,
        username: cleanUser,
        avatarUrl,
        avatarColor,
        pointsAdded,
        isRose: payload.isRose,
        isNpc: isFromNpc,
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
        isNpc: isFromNpc,
        addedAt: now,
        senders: [contributor],
        totalRoses: roseCount,
        totalGifts: payload.isRose ? Math.max(1, roseCount) : 1,
      };

      // Hàm phụ trợ: Đưa vào hàng chờ Camera đồng bộ qua `cameraQueueRef.current`
      // - Nếu là Quà tặng / Hoa hồng (payload.isRose = true): ƯU TIÊN ĐẨY LÊN ĐẦU HÀNG CHỜ (trước toàn bộ các bình luận 1 điểm)
      //   và giữ nguyên từng lượt quà độc lập để đọc chính xác số lượng hoa tặng!
      // - Nếu là bình luận 1 điểm (!payload.isRose && !isFromNpc): gom chung các bình luận 1 điểm cùng tỉnh.
      const enqueueAndMergeSameProvince = () => {
        const prev = cameraQueueRef.current;

        if (payload.isRose) {
          const firstCommentIdx = prev.findIndex((q) => !q.isRose);
          const next =
            firstCommentIdx === -1
              ? [...prev.slice(-40), singleQueueItem]
              : [
                  ...prev.slice(0, firstCommentIdx),
                  singleQueueItem,
                  ...prev.slice(firstCommentIdx),
                ].slice(0, 45);
          cameraQueueRef.current = next;
          setCameraQueue(next);
          return;
        }

        if (!isFromNpc) {
          const existingIdx = prev.findIndex(
            (q) => q.provinceId === targetProv.id && !q.isNpc && !q.isRose
          );
          if (existingIdx !== -1) {
            const next = [...prev];
            const targetItem = next[existingIdx];
            const mergedSenders = mergeContributorsByUser(targetItem.senders, [
              contributor,
            ]);
            const uniqueNames = Array.from(
              new Set(mergedSenders.map((s) => s.username))
            );
            next[existingIdx] = {
              ...targetItem,
              username: uniqueNames.join(', '),
              pointsAdded: targetItem.pointsAdded + pointsAdded,
              isRose: false,
              isNpc: false,
              senders: mergedSenders,
              totalRoses: 0,
              totalGifts: targetItem.totalGifts + 1,
            };
            cameraQueueRef.current = next;
            setCameraQueue(next);
            return;
          }
        }
        const appended = [...prev.slice(-40), singleQueueItem];
        cameraQueueRef.current = appended;
        setCameraQueue(appended);
      };

      // Nếu đang trong luồng tổng kết cuối phiên: bỏ qua bình luận 1 điểm, chỉ giữ lại hàng chờ tặng quà (isRose = true) cho phiên sau!
      if (isSessionEndingRef.current) {
        if (!payload.isRose) {
          return { ok: false, reason: 'session_ending_comment_ignored' };
        }
        enqueueAndMergeSameProvince();
        if (broadcastSync) {
          syncService.sendCommand('SEND_PROVINCE_GIFT', {
            eventId,
            provinceId: targetProv.id,
            username: cleanUser,
            avatarUrl,
            isRose: payload.isRose,
            isNpc: isFromNpc,
            pointsOverride: pointsAdded,
            roseCountOverride: roseCount,
            bypassCommentLimit: true,
          });
        }
        return { ok: true };
      }

      if (cfg.cameraAutoZoom) {
        const curFocus = cameraFocusRef.current;
        const inOverviewPause =
          curFocus.provinceId === null && now < overviewPauseUntilRef.current;
        const curProvinceStillActive =
          Boolean(curFocus.provinceId) &&
          (now < curFocus.until ||
            soundEngine.isSpeakingOrQueuedForProvince(curFocus.provinceId!));

        const activeFocusHasNpc = Boolean(
          curFocus.senders?.some((s) => Boolean(s.isNpc))
        );
        const prevSenders = curFocus.senders || [];
        const alreadyHadThisUser = prevSenders.some(
          (s) => s.username.toLowerCase() === userKey
        );

        // Trường hợp 1: Camera ĐANG đứng ở đúng tỉnh này và đang active:
        // - Khi cùng 1 người chơi vừa comment +1đ (!curFocus.isRose) và tặng hoa ngay tiếp theo (payload.isRose):
        //   cộng dồn vào chung 1 Avatar to duy nhất (không nhảy Avatar 2 lần) và giữ đúng số bông hoa vừa tặng (roseCount)!
        // - Hoặc khi có thêm bình luận 1 điểm (!payload.isRose && !curFocus.isRose) vào tỉnh đang đứng.
        // - Tuyệt đối KHÔNG gộp 2 lượt tặng hoa (curFocus.isRose && payload.isRose) vào nhau để không bao giờ bị x2 số hoa hay x2 điểm trên màn hình!
        const canMergeIntoActiveFocus =
          !isFromNpc &&
          !activeFocusHasNpc &&
          curProvinceStillActive &&
          curFocus.provinceId === targetProv.id &&
          ((!curFocus.isRose && !payload.isRose) ||
            (!curFocus.isRose && payload.isRose && alreadyHadThisUser));

        if (canMergeIntoActiveFocus) {
          commitGiftTurnToProvinceAndTTS(
            targetProv.id,
            targetProv.name,
            [contributor],
            pointsAdded,
            roseCount,
            1
          );

          const nextSenders = mergeContributorsByUser(prevSenders, [
            contributor,
          ]);
          const nextPoints = payload.isRose
            ? pointsAdded
            : (curFocus.pointsAdded || 0) + pointsAdded;
          const nextRoses = payload.isRose
            ? roseCount
            : curFocus.totalRoses || 0;
          const nextGifts = payload.isRose
            ? Math.max(1, roseCount)
            : (curFocus.totalGifts || 1) + 1;

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

          if (!alreadyHadThisUser) {
            spawnThrowAvatarFX({
              provinceId: targetProv.id,
              provinceName: targetProv.name,
              senders: [contributor],
            });
          } else {
            soundEngine.playGiftThrowSfx(
              payload.isRose,
              configRef.current.sfxVolume
            );
          }
        } else if (
          !inOverviewPause &&
          !curProvinceStillActive &&
          cameraQueueRef.current.length === 0
        ) {
          // Trường hợp 2: Camera đang rảnh -> Cộng điểm + đọc TTS + Zoom vào ngay với số hoa và số điểm chính xác
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
            totalGifts: payload.isRose ? Math.max(1, roseCount) : 1,
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
        } else {
          // Trường hợp 3: Đưa vào hàng chờ Camera (nếu là quà/hoa hồng sẽ tự động nhảy lên đầu hàng chờ!)
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
          eventId,
          provinceId: targetProv.id,
          username: cleanUser,
          avatarUrl,
          isRose: payload.isRose,
          isNpc: isFromNpc,
          pointsOverride: pointsAdded,
          roseCountOverride: roseCount,
          bypassCommentLimit: true,
        });
      }
      return { ok: true };
    },
    [commitGiftTurnToProvinceAndTTS, mergeContributorsByUser, spawnThrowAvatarFX]
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

      const res = executeProvinceGift(
        {
          provinceId: matchedProvince.id,
          username: inspection.safeUsername,
          avatarUrl: avatarUrl || null,
          isRose,
          isNpc: false,
        },
        true
      );
      return res.ok;
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

      const flowerCount = Math.max(1, Number(repeatCount) || 1);
      const coinUnits = Math.max(flowerCount, Number(coins) || flowerCount);
      const baseRosePoints = Math.max(1, configRef.current.rosePoints || 5);
      const totalPoints = baseRosePoints * coinUnits;
      const deterministicEventId = `tiktok_gift_${safeName.toLowerCase()}_${targetProvinceId}_${flowerCount}_${totalPoints}_${Math.floor(
        Date.now() / 4200
      )}`;

      executeProvinceGift(
        {
          eventId: deterministicEventId,
          provinceId: targetProvinceId,
          username: safeName,
          avatarUrl: avatarUrl || null,
          isRose: true,
          isNpc: false,
          pointsOverride: totalPoints,
          roseCountOverride: flowerCount,
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
        if (counts.obsPeers > 0) {
          soundEngine.broadcastBgmSync(true);
        }
      }
    });

    const unsubTikTok = syncService.onTikTokEvent((ev) => {
      // Nếu đang ở màn hình Live (OBS Slave), nhận lệnh đồng bộ từ Studio Master qua SEND_PROVINCE_GIFT để tránh chạy đúp 2 lần
      if (isObsView) return;

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
      } else if (ev.type === 'member') {
        const rawUser = (ev.username || '').trim();
        if (!rawUser) return;
        const isMatchesNpcName = npcNamesRef.current.some(
          (n) => n.trim().toLowerCase() === rawUser.toLowerCase()
        );
        if (isMatchesNpcName || /^npc\s+/i.test(rawUser)) {
          return;
        }
        const inspection = inspectUserInteraction(
          rawUser,
          '',
          safetyActionMode,
          safetyCategories,
          customWords
        );
        if (inspection.allowed) {
          soundEngine.enqueueWelcomeJoin(
            inspection.safeUsername,
            configRef.current,
            false
          );
        }
      }
    });

    const unsubSync = syncService.onSync((packet) => {
      const { action, payload } = packet;
      if (action === 'SEND_PROVINCE_GIFT') {
        executeProvinceGift(
          {
            eventId: payload.eventId,
            provinceId: payload.provinceId,
            username: payload.username,
            avatarUrl: payload.avatarUrl,
            isRose: Boolean(payload.isRose),
            isNpc: Boolean(payload.isNpc),
            pointsOverride: payload.pointsOverride,
            roseCountOverride: payload.roseCountOverride,
            bypassCommentLimit: true,
          },
          false
        );
      } else if (action === 'RESET_ALL_PROVINCES') {
        sessionCommentedUsersRef.current.clear();
        const fresh = createInitialProvinces().map((baseProv) => {
          const cur = provincesRef.current.find((p) => p.id === baseProv.id);
          return {
            ...baseProv,
            top1WinCount: payload?.resetTop1Wins
              ? 0
              : cur?.top1WinCount || 0,
          };
        });
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
      } else if (action === 'SYNC_BGM_STATE') {
        soundEngine.applyRemoteBgmSnapshot(payload);
      } else if (action === 'REQUEST_FULL_SYNC' && !isObsView) {
        syncService.sendCommand('UPDATE_CONFIG', { patch: configRef.current });
        syncService.sendCommand('UPDATE_PROVINCES_STATE', {
          provinces: provincesRef.current,
        });
        soundEngine.broadcastBgmSync(true);
      }
    });

    return () => {
      unsubStatus();
      unsubPeers();
      unsubTikTok();
      unsubSync();
    };
  }, [
    customWords,
    executeProvinceGift,
    handleUserComment,
    handleUserGift,
    isObsView,
    safetyActionMode,
    safetyCategories,
  ]);

  // Giả lập NPC tự động hỗ trợ điểm tỉnh:
  // - Chỉ chạy duy nhất trên Studio Master (!isObsView) để không bị sinh đúp 2 NPC từ 2 tab
  // - Mỗi chu kỳ chỉ kích hoạt đúng 1 NPC duy nhất
  useEffect(() => {
    if (!config.npcAutoEnabled || isObsView) return;
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
        if (!isSessionEndingRef.current && configRef.current.npcAutoEnabled) {
          const list = provincesRef.current;
          if (list.length > 0) {
            const randomProv = list[Math.floor(Math.random() * list.length)];
            const names =
              npcNamesRef.current.length > 0
                ? npcNamesRef.current
                : SAMPLE_NAMES;
            const avatars =
              npcAvatarsRef.current.length > 0
                ? npcAvatarsRef.current
                : DEFAULT_NPC_AVATARS;
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
  }, [config.npcAutoEnabled, executeProvinceGift, isObsView]);

  const handleUpdateConfig = useCallback((patch: Partial<GameConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      syncService.sendCommand('UPDATE_CONFIG', { patch });
      return next;
    });
  }, []);

  const handleResetAllProvinces = useCallback((resetTop1Wins = false) => {
    sessionCommentedUsersRef.current.clear();
    const fresh = createInitialProvinces().map((baseProv) => {
      const cur = provincesRef.current.find((p) => p.id === baseProv.id);
      return {
        ...baseProv,
        top1WinCount: resetTop1Wins ? 0 : cur?.top1WinCount || 0,
      };
    });
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
    syncService.sendCommand('RESET_ALL_PROVINCES', { resetTop1Wins });
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
      isNpc = false,
      roseCountOverride = 1
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
      const cleanCount = isRose ? Math.max(1, roseCountOverride || 1) : 1;

      executeProvinceGift(
        {
          provinceId: target.id,
          username,
          avatarUrl,
          isRose,
          isNpc,
          roseCountOverride: cleanCount,
          pointsOverride: isRose
            ? Math.max(1, (configRef.current.rosePoints || 5) * cleanCount)
            : undefined,
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

  /**
   * ĐỌC SIÊU TỐC (Turbo Batch Read):
   * - Chụp lại TẤT CẢ hàng chờ hiện tại tại thời điểm bấm nút (`ttsQueue` + `cameraQueue`).
   * - Giải phóng `cameraQueue` hiện tại để trong lúc đang đọc siêu tốc, hàng chờ mới cứ thêm vào bình thường!
   * - Đọc câu mở đầu: "Do hàng chờ quá nhiều, tui sẽ đọc hàng loạt để rút gọn nhé"
   * - Tiếp theo đọc lần lượt từng mục: "[Tên] gửi điểm về [Tỉnh]" đồng thời pan camera siêu nhanh (150ms) tới từng tỉnh đó cho tới khi hết số hàng chờ đã chọn!
   */
  const handleTriggerTurboBatchRead = useCallback((): {
    ok: boolean;
    count: number;
  } => {
    const pendingTtsItems = soundEngine.extractPendingProvinceQueueItems();
    const pendingCamItems = [...cameraQueueRef.current];

    if (pendingTtsItems.length === 0 && pendingCamItems.length === 0) {
      return { ok: false, count: 0 };
    }

    // Giải phóng cameraQueue hiện tại để các sự kiện mới phát sinh trong lúc đang đọc Siêu Tốc cứ xếp hàng bình thường
    cameraQueueRef.current = [];
    setCameraQueue([]);

    const batchSteps: Array<{
      text: string;
      provinceId?: string;
      provinceName?: string;
      username?: string;
      pointsAdded?: number;
      isRose?: boolean;
      onStart?: () => void;
      onDone?: () => void;
    }> = [
      {
        text: 'Do hàng chờ quá nhiều, tui sẽ đọc hàng loạt để rút gọn nhé!',
      },
    ];

    // 1. Các mục đã cộng điểm và đang nằm chờ trong ttsQueue
    for (const ttsItem of pendingTtsItems) {
      const provId = ttsItem.meta?.provinceId;
      const rawProvName = ttsItem.meta?.provinceName || 'Tỉnh';
      const cleanProv = rawProvName.replace(/^TP\.\s*/i, '').trim();
      const rawNames =
        ttsItem.meta?.usernamesList && ttsItem.meta.usernamesList.length > 0
          ? ttsItem.meta.usernamesList
          : [ttsItem.meta?.username || 'Người chơi'];
      const cleanNames = Array.from(
        new Set(rawNames.map((n) => n.replace(/^NPC\s+/i, '').trim()))
      ).join(', ');
      const pts = Number(ttsItem.meta?.pointsAdded || 1);
      const isRose = Boolean(ttsItem.meta?.isRose);

      batchSteps.push({
        text: `${cleanNames} gửi điểm về ${cleanProv}`,
        provinceId: provId,
        provinceName: rawProvName,
        username: cleanNames,
        pointsAdded: pts,
        isRose,
        onStart: () => {
          if (!provId) return;
          const now = Date.now();
          const targetProv = provincesRef.current.find((p) => p.id === provId);
          const turboFocus: CameraFocusState = {
            provinceId: provId,
            provinceName: rawProvName,
            username: cleanNames,
            pointsAdded: pts,
            isRose,
            senders: targetProv?.recentContributors?.slice(0, 4) || [],
            startedAt: now,
            isTurboPan: true,
            until: now + 950,
          };
          cameraFocusRef.current = turboFocus;
          setCameraFocus(turboFocus);
        },
      });
    }

    // 2. Các mục đang nằm chờ trong cameraQueue (chưa cộng điểm vào tỉnh)
    for (const camItem of pendingCamItems) {
      const mergedSenders = mergeContributorsByUser([], camItem.senders);
      const cleanNames = Array.from(
        new Set(
          mergedSenders.map((s) => s.username.replace(/^NPC\s+/i, '').trim())
        )
      ).join(', ');
      const cleanProv = camItem.provinceName.replace(/^TP\.\s*/i, '').trim();
      const lastSender = mergedSenders[mergedSenders.length - 1];

      batchSteps.push({
        text: `${cleanNames} gửi điểm về ${cleanProv}`,
        provinceId: camItem.provinceId,
        provinceName: camItem.provinceName,
        username: cleanNames,
        pointsAdded: camItem.pointsAdded,
        isRose: camItem.isRose,
        onStart: () => {
          const now = Date.now();
          commitPointsOnlyToProvince(
            camItem.provinceId,
            camItem.provinceName,
            mergedSenders,
            camItem.pointsAdded,
            camItem.totalRoses,
            camItem.totalGifts
          );
          const turboFocus: CameraFocusState = {
            provinceId: camItem.provinceId,
            provinceName: camItem.provinceName,
            username: cleanNames,
            avatarUrl: lastSender?.avatarUrl || camItem.avatarUrl,
            avatarColor: lastSender?.avatarColor || camItem.avatarColor,
            pointsAdded: camItem.pointsAdded,
            isRose: camItem.isRose,
            senders: mergedSenders,
            totalRoses: camItem.totalRoses,
            totalGifts: camItem.totalGifts,
            startedAt: now,
            isTurboPan: true,
            until: now + 950,
          };
          cameraFocusRef.current = turboFocus;
          setCameraFocus(turboFocus);
          spawnThrowAvatarFX({
            provinceId: camItem.provinceId,
            provinceName: camItem.provinceName,
            senders: mergedSenders,
          });
        },
      });
    }

    soundEngine.enqueueTurboBatchItems(batchSteps, configRef.current);
    return {
      ok: true,
      count: pendingTtsItems.length + pendingCamItems.length,
    };
  }, [commitPointsOnlyToProvince, mergeContributorsByUser, spawnThrowAvatarFX]);

  const handlePushFullSyncToLive = useCallback(() => {
    syncService.sendCommand('UPDATE_CONFIG', { patch: configRef.current });
    syncService.sendCommand('UPDATE_PROVINCES_STATE', {
      provinces: provincesRef.current,
    });
    soundEngine.broadcastBgmSync(true);
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
        top1WinCount: p.top1WinCount || 0,
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
                top1WinCount:
                  typeof found.top1WinCount === 'number'
                    ? found.top1WinCount
                    : item.top1WinCount || 0,
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
    handleTriggerTurboBatchRead,
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
