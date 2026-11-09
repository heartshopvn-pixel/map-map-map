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
            isSpecialGift: Boolean(prev.isSpecialGift || item.isSpecialGift),
            giftCoins: (prev.giftCoins || 0) + (item.giftCoins || 0),
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
   * Quy định Game: Camera chạy theo Giọng đọc AI (Lấy giọng đọc làm chuẩn 100%):
   * - Khi giọng đọc AI bắt đầu đọc câu của tỉnh nào (`onStart`), Camera lập tức zoom tới tỉnh đó và ném Avatar.
   * - Khi giọng đọc AI đọc xong câu của tỉnh đó (`onDone`) và không còn đang đọc tỉnh đó nữa, Camera tự động nhả về Map tổng (hoặc nhảy sang tỉnh của câu đọc kế tiếp).
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSessionEndingRef.current || soundEngine.isTurboBatchActive()) {
        return;
      }

      const now = Date.now();
      const curFocus = cameraFocusRef.current;

      if (curFocus.provinceId !== null) {
        const activeSpokenProvinceId = soundEngine.getActiveSpokenProvinceId();
        // Giữ zoom tỉnh nếu giọng đọc đang đọc chính tỉnh này hoặc chưa hết nhịp giữ ngắn sau khi đọc xong
        if (
          activeSpokenProvinceId === curFocus.provinceId ||
          now < curFocus.until
        ) {
          return;
        }

        // Giọng đọc tỉnh đã kết thúc -> trả Camera về Map tổng (hoặc chờ câu tỉnh kế tiếp tự kích hoạt onStart)
        const resetFocus: CameraFocusState = {
          provinceId: null,
          until: 0,
        };
        cameraFocusRef.current = resetFocus;
        setCameraFocus(resetFocus);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  /**
   * Luồng Kết Thúc Phiên Chơi & Chuyển Sang Vòng Mới:
   * - Xóa toàn bộ hàng chờ 1 điểm (comment trong hàng chờ), CHỈ GIỮ LẠI hàng chờ tặng quà (isRose = true) sang phiên mới
   * - Đưa Camera về Map tổng
   * - Cộng +1 lần đạt Top 1 (`top1WinCount`) cho tỉnh dẫn đầu phiên (nếu có điểm > 0)
   * - Thông báo Kết Quả Phiên & đọc vinh danh Top 1, 2, 3 tỉnh bằng Giọng đọc AI #3
   * - CHỈ ĐỌC HẾT NỘI DUNG BÁO KẾT QUẢ THÔI THÌ CHUYỂN SANG CÂU MỚI NGAY (không bị kẹt bởi các sự kiện đọc liên tục thêm mới trong lúc tổng kết!)
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
    const deferredGiftCount = soundEngine
      .getEventQueueSnapshot()
      .detailedQueue.filter((q) => Boolean(q.meta?.isRose)).length;

    setSessionEndSummary({
      sessionNum,
      sessionTitle: sessionName,
      top3,
      top5,
      deferredQueueCount: deferredGiftCount,
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

    // CHỈ ĐỌC HẾT NỘI DUNG BÁO KẾT QUẢ THÔI THÌ CHUYỂN SANG CÂU MỚI NGAY!
    // Tuyệt đối không chờ các sự kiện khác trong hàng chờ để bảng tổng kết không bao giờ bị kẹt.
    soundEngine.announceSessionResultNow(
      summarySentences,
      configRef.current,
      () => {
        window.setTimeout(transitionToNextRound, 180);
      }
    );

    // Bộ bảo vệ an toàn cứng (tối đa 9.5 giây chắc chắn chuyển sang vòng mới kể cả khi mạng lag)
    if (sessionEndTimeoutRef.current) {
      window.clearTimeout(sessionEndTimeoutRef.current);
    }
    sessionEndTimeoutRef.current = window.setTimeout(() => {
      transitionToNextRound();
    }, 9500);
  }, []);

  /**
   * Hàm trung tâm xử lý khi người chơi bình luận đến tỉnh (+1đ), tặng hoa / quà 1 coin (+5đ) hoặc tặng quà đặc biệt >1 coin (coin * 5đ)
   * - Lấy Giọng Đọc AI làm chuẩn 100%: Mọi sự kiện được đưa vào hàng chờ đọc `soundEngine.enqueueTTS`,
   *   khi giọng đọc bắt đầu phát câu của tỉnh nào (`onStart`) thì Camera mới chạy tới tỉnh đó và cộng điểm + ném Avatar!
   * - Quà tặng / hoa hồng (isRose = true) luôn được ưu tiên đẩy lên ĐẦU hàng chờ đọc.
   * - Khi cùng 1 người chơi vừa comment +1đ và tặng hoa ngay tiếp theo ở tỉnh đang zoom: gộp làm 1 Avatar to duy nhất (không nhảy 2 lần).
   */
  const executeProvinceGift = useCallback(
    (
      payload: {
        eventId?: string;
        provinceId: string;
        username: string;
        avatarUrl?: string | null;
        isRose: boolean;
        isSpecialGift?: boolean;
        giftCoins?: number;
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
      const isSpecialGift = Boolean(payload.isSpecialGift);
      const now = Date.now();

      // Luôn ghi nhớ tỉnh người chơi chọn để khi họ tặng quà sẽ cộng về đúng tỉnh đó
      userProvinceMemoryRef.current.set(userKey, targetProv.id);

      // Nếu đang ở bảng tổng kết cuối phiên: bỏ qua bình luận 1 điểm (không khóa lượt comment của họ ở vòng mới),
      // chỉ giữ lại quà tặng (isRose = true) trong hàng chờ cho vòng mới!
      if (isSessionEndingRef.current && !payload.isRose) {
        return { ok: false, reason: 'session_ending_comment_ignored' };
      }

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
      const giftCoins =
        payload.giftCoins !== undefined
          ? Math.max(1, Number(payload.giftCoins) || 1)
          : roseCount;
      const pointsAdded =
        payload.pointsOverride !== undefined
          ? Math.max(1, Number(payload.pointsOverride) || 1)
          : payload.isRose
          ? Math.max(
              1,
              (cfg.rosePoints || 5) *
                (isSpecialGift ? Math.max(2, giftCoins) : roseCount)
            )
          : Math.max(1, cfg.commentPoints || 1);

      // 2. Chống bị bắn đúp cùng 1 gói quà / bình luận
      const fingerprint = `${userKey}:${targetProv.id}:${payload.isRose ? 'R' : 'C'}:${isSpecialGift ? 'S' : 'N'}:${pointsAdded}:${roseCount}:${isFromNpc ? 'N' : 'U'}`;
      const lastExecAt =
        recentGiftFingerprintMapRef.current.get(fingerprint) || 0;
      const throttleWindowMs = broadcastSync ? 380 : 5000;
      if (now - lastExecAt < throttleWindowMs) {
        return { ok: false, reason: 'duplicate_gift_throttled' };
      }
      recentGiftFingerprintMapRef.current.set(fingerprint, now);

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
        isSpecialGift,
        giftCoins,
        isNpc: isFromNpc,
        roseCount,
        timestamp: now,
      };

      const readNpcPrefix = Boolean(isFromNpc && payload.isRose);
      const speechText = soundEngine.formatProvinceGiftSpeech(
        cleanUser,
        targetProv.name,
        pointsAdded,
        payload.isRose,
        cfg,
        !isFromNpc,
        readNpcPrefix,
        Math.max(1, roseCount),
        isSpecialGift
      );

      // Khi giọng đọc AI bắt đầu đọc mục này -> Cộng điểm + điều khiển Camera chạy theo giọng đọc!
      const handleVoiceStart = () => {
        const startNow = Date.now();
        commitPointsOnlyToProvince(
          targetProv.id,
          targetProv.name,
          [contributor],
          pointsAdded,
          roseCount,
          1
        );

        if (configRef.current.cameraAutoZoom) {
          const curFocus = cameraFocusRef.current;
          const holdMs = Math.max(
            1500,
            Math.round((configRef.current.cameraHoldDurationSec || 2.5) * 1000)
          );

          const prevSenders = curFocus.senders || [];
          const alreadyHadThisUser = prevSenders.some(
            (s) => s.username.toLowerCase() === userKey
          );

          // Gộp chung làm 1 Avatar to nếu:
          // 1) Nhiều bình luận 1 điểm cùng tỉnh được gom đọc chung trong cùng 1 lượt (startNow - curFocus.startedAt < 350ms), HOẶC
          // 2) Cùng 1 người chơi vừa comment +1đ ở tỉnh này xong lại tặng hoa/quà ngay lập tức (không nhảy Avatar 2 lần!)
          const shouldMergeFocus =
            curFocus.provinceId === targetProv.id &&
            ((!curFocus.isRose &&
              !payload.isRose &&
              startNow - (curFocus.startedAt || 0) < 350) ||
              (!curFocus.isRose && payload.isRose && alreadyHadThisUser));

          if (shouldMergeFocus) {
            const nextSenders = mergeContributorsByUser(prevSenders, [
              contributor,
            ]);
            const uniqueSenderNames = Array.from(
              new Set(nextSenders.map((s) => s.username))
            );
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
              provinceId: targetProv.id,
              provinceName: targetProv.name,
              username: uniqueSenderNames.join(', '),
              avatarUrl,
              avatarColor,
              pointsAdded: nextPoints,
              isRose: Boolean(curFocus.isRose || payload.isRose),
              isSpecialGift: Boolean(curFocus.isSpecialGift || isSpecialGift),
              giftCoins: isSpecialGift ? giftCoins : curFocus.giftCoins,
              senders: nextSenders,
              totalRoses: nextRoses,
              totalGifts: nextGifts,
              isTurboPan: Boolean(configRef.current.turboReadMode),
              until: startNow + holdMs,
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
          } else {
            const nextFocus: CameraFocusState = {
              provinceId: targetProv.id,
              provinceName: targetProv.name,
              username: cleanUser,
              avatarUrl,
              avatarColor,
              pointsAdded,
              isRose: payload.isRose,
              isSpecialGift,
              giftCoins,
              senders: [contributor],
              totalRoses: roseCount,
              totalGifts: payload.isRose ? Math.max(1, roseCount) : 1,
              startedAt: startNow,
              isTurboPan: Boolean(configRef.current.turboReadMode),
              until: startNow + holdMs,
            };
            cameraFocusRef.current = nextFocus;
            setCameraFocus(nextFocus);
            spawnThrowAvatarFX({
              provinceId: targetProv.id,
              provinceName: targetProv.name,
              senders: [contributor],
            });
          }
        } else {
          spawnThrowAvatarFX({
            provinceId: targetProv.id,
            provinceName: targetProv.name,
            senders: [contributor],
          });
        }
      };

      const handleVoiceDone = () => {
        if (cameraFocusRef.current.provinceId === targetProv.id) {
          const tailHoldMs =
            configRef.current.cameraMode === 'alternating_overview' ? 180 : 420;
          const updated: CameraFocusState = {
            ...cameraFocusRef.current,
            until: Date.now() + tailHoldMs,
          };
          cameraFocusRef.current = updated;
          setCameraFocus(updated);
        }
      };

      const shortLabel = isSpecialGift
        ? `🎁 ${cleanUser}`
        : payload.isRose
        ? `🌹 ${cleanUser}`
        : cleanUser;

      soundEngine.enqueueTTS(
        speechText,
        payload.isRose,
        cfg,
        {
          provinceId: targetProv.id,
          provinceName: targetProv.name,
          username: cleanUser,
          usernamesList: [cleanUser],
          shortLabel,
          reason: payload.isRose ? 'gift' : 'comment',
          isRose: payload.isRose,
          isSpecialGift,
          giftCoins,
          isNpc: isFromNpc,
          pointsAdded,
          totalRoses: roseCount,
        },
        handleVoiceStart,
        handleVoiceDone
      );

      // Nếu là bình luận +1đ của người chơi thật: có tỉ lệ thêm sự kiện âm thanh "Khích lệ hoa" hoặc "Nói vu vơ" tách riêng trong hàng chờ
      if (!isFromNpc && !payload.isRose) {
        soundEngine.maybeEnqueueFollowUpChatter(
          cleanUser,
          targetProv.name,
          cfg,
          false
        );
      }

      if (broadcastSync) {
        syncService.sendCommand('SEND_PROVINCE_GIFT', {
          eventId,
          provinceId: targetProv.id,
          username: cleanUser,
          avatarUrl,
          isRose: payload.isRose,
          isSpecialGift,
          giftCoins,
          isNpc: isFromNpc,
          pointsOverride: pointsAdded,
          roseCountOverride: roseCount,
          bypassCommentLimit: true,
        });
      }
      return { ok: true };
    },
    [commitPointsOnlyToProvince, mergeContributorsByUser, spawnThrowAvatarFX]
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

  /**
   * Xử lý khi người chơi tặng quà trên TikTok Live:
   * - Khi tặng các món quà khác hoa hồng nhưng cùng 1 coin thì vẫn coi như hoa hồng.
   * - Nếu món quà trị giá nhiều hơn 1 coin (>1 coin):
   *   + Đọc: "[Tên] là tặng 1 món quà đặc biệt kèm [Điểm] điểm về [Tỉnh]"
   *   + Số điểm lấy tổng số coin nhân với hệ số 5 (hoặc rosePoints mặc định = 5).
   */
  const handleUserGift = useCallback(
    (
      rawUsername: string,
      giftName: string,
      coins: number,
      repeatCount = 1,
      avatarUrl?: string | null,
      diamondCount?: number
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

      const cleanRepeat = Math.max(1, Number(repeatCount) || 1);
      const totalCoins = Math.max(cleanRepeat, Number(coins) || cleanRepeat);
      const unitCoinValue =
        diamondCount !== undefined && Number(diamondCount) > 0
          ? Number(diamondCount)
          : Math.max(1, Math.round(totalCoins / cleanRepeat));

      // Món quà trị giá > 1 coin được tính là Quà Đặc Biệt; món quà 1 coin được coi như Hoa Hồng
      const isSpecialGift = unitCoinValue > 1;
      const flowerCount = isSpecialGift ? 1 : cleanRepeat;
      const baseRosePoints = Math.max(1, configRef.current.rosePoints || 5);
      const totalPoints = totalCoins * baseRosePoints;
      const deterministicEventId = `tiktok_gift_${safeName.toLowerCase()}_${targetProvinceId}_${totalCoins}_${totalPoints}_${Math.floor(
        Date.now() / 4200
      )}`;

      executeProvinceGift(
        {
          eventId: deterministicEventId,
          provinceId: targetProvinceId,
          username: safeName,
          avatarUrl: avatarUrl || null,
          isRose: true,
          isSpecialGift,
          giftCoins: totalCoins,
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
      if (!isObsView && counts.obsPeers > 0) {
        soundEngine.broadcastBgmSync(true);
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
          ev.avatarUrl || ev.profilePictureUrl || null,
          ev.diamondCount
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
            isSpecialGift: Boolean(payload.isSpecialGift),
            giftCoins: payload.giftCoins,
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
      } else if (action === 'CLEAR_COMMENT_TTS_QUEUE') {
        soundEngine.clearCommentOnlyEventQueue();
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
      roseCountOverride = 1,
      isSpecialGift = false,
      giftCoinsOverride?: number
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
      const coinCount = isSpecialGift
        ? Math.max(2, giftCoinsOverride || cleanCount)
        : cleanCount;

      executeProvinceGift(
        {
          provinceId: target.id,
          username,
          avatarUrl,
          isRose,
          isSpecialGift,
          giftCoins: coinCount,
          isNpc,
          roseCountOverride: isSpecialGift ? 1 : cleanCount,
          pointsOverride: isRose
            ? Math.max(1, (configRef.current.rosePoints || 5) * coinCount)
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
   * Xóa hàng chờ +1 (xóa những hàng chờ comment, giữ nguyên hàng chờ tặng quà)
   */
  const handleClearCommentOnlyQueue = useCallback((): { removedCount: number } => {
    const removedTts = soundEngine.clearCommentOnlyEventQueue();
    const prevCamLen = cameraQueueRef.current.length;
    const giftOnlyCam = cameraQueueRef.current.filter((item) =>
      Boolean(item.isRose)
    );
    const removedCam = Math.max(0, prevCamLen - giftOnlyCam.length);
    cameraQueueRef.current = giftOnlyCam;
    setCameraQueue(giftOnlyCam);
    syncService.sendCommand('CLEAR_COMMENT_TTS_QUEUE', {});
    return { removedCount: removedTts + removedCam };
  }, []);

  /**
   * Bật / Tắt chế độ Đọc Siêu Tốc:
   * - Khi BẬT: đẩy max tốc độ đọc lên 2.0x và khóa thanh chỉnh tốc độ bên Dev Âm Thanh.
   * - Khi TẮT: khôi phục tốc độ đọc trước đó và mở khóa thanh chỉnh tốc độ.
   */
  const handleToggleTurboReadMode = useCallback((): { enabled: boolean } => {
    const cur = configRef.current;
    const nextTurbo = !cur.turboReadMode;
    if (nextTurbo) {
      const savedRate =
        cur.ttsRate < 2.0
          ? cur.ttsRate
          : cur.savedNormalTtsRate && cur.savedNormalTtsRate < 2.0
          ? cur.savedNormalTtsRate
          : 1.08;
      handleUpdateConfig({
        turboReadMode: true,
        savedNormalTtsRate: savedRate,
        ttsRate: 2.0,
      });
    } else {
      const restoredRate =
        cur.savedNormalTtsRate && cur.savedNormalTtsRate < 2.0
          ? cur.savedNormalTtsRate
          : 1.08;
      handleUpdateConfig({
        turboReadMode: false,
        ttsRate: restoredRate,
      });
    }
    return { enabled: nextTurbo };
  }, [handleUpdateConfig]);

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

    // 1. Các mục đang nằm chờ trong ttsQueue
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
      const origOnStart = ttsItem.onStart;

      batchSteps.push({
        text: `${cleanNames} gửi điểm về ${cleanProv}`,
        provinceId: provId,
        provinceName: rawProvName,
        username: cleanNames,
        pointsAdded: pts,
        isRose,
        onStart: () => {
          if (origOnStart) {
            try {
              origOnStart();
            } catch {
              // Ignore
            }
          }
          if (!provId) return;
          const now = Date.now();
          const targetProv = provincesRef.current.find((p) => p.id === provId);
          const turboFocus: CameraFocusState = {
            ...cameraFocusRef.current,
            provinceId: provId,
            provinceName: rawProvName,
            username: cleanNames,
            pointsAdded: pts,
            isRose,
            senders:
              cameraFocusRef.current.provinceId === provId &&
              cameraFocusRef.current.senders?.length
                ? cameraFocusRef.current.senders
                : targetProv?.recentContributors?.slice(0, 4) || [],
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
    handleClearCommentOnlyQueue,
    handleToggleTurboReadMode,
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
