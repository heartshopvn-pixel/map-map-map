export type TTSEngineType = 'node_edge';

export type SafetyActionMode = 'purify' | 'block' | 'mask';

export type CameraFocusReason = 'comment' | 'gift' | 'special_gift' | 'manual' | 'host_live';

export type CameraMode = 'continuous' | 'alternating_overview';

export type GamePlayMode = 'session_top5' | 'free_endless';

export type MapIdleMode = 'sway' | 'pan_north_south';

export type BgmPlayMode = 'loop_one' | 'next_all';

export interface BgmTrackItem {
  id: string;
  name: string;
  url: string;
}

export type ProvinceUnitType = 'city' | 'province';

export interface ProvinceContributor {
  id: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  pointsAdded: number;
  isRose: boolean;
  isNpc?: boolean;
  roseCount?: number;
  timestamp: number;
}

export interface ProvinceCell {
  id: string;
  code: number;
  name: string;
  unitType: ProvinceUnitType;
  aliases: string[];
  /** Tọa độ chuẩn hóa (0..1) trên khung bản đồ Việt Nam */
  mapX: number;
  mapY: number;
  labelSide: 'left' | 'right' | 'center';
  points: number;
  giftCount: number;
  roseCount: number;
  /** Số lần tỉnh đạt Top 1 qua các phiên chơi */
  top1WinCount: number;
  recentContributors: ProvinceContributor[];
  lastUpdatedAt: number;
}

export interface ThrownAvatarFX {
  id: string;
  provinceId: string;
  provinceName: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  pointsAdded: number;
  isRose: boolean;
  startXPercent: number;
  startYPercent: number;
  createdAt: number;
  durationMs: number;
}

export interface CameraQueueItem {
  id: string;
  provinceId: string;
  provinceName: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  pointsAdded: number;
  isRose: boolean;
  isNpc?: boolean;
  addedAt: number;
  /** Danh sách người gửi được gom chung trong 1 lượt zoom tỉnh */
  senders: ProvinceContributor[];
  totalRoses: number;
  totalGifts: number;
}

export interface CameraFocusState {
  provinceId: string | null;
  provinceName?: string;
  username?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  pointsAdded?: number;
  isRose?: boolean;
  senders?: ProvinceContributor[];
  totalRoses?: number;
  totalGifts?: number;
  startedAt?: number;
  isTurboPan?: boolean;
  until: number;
}

export interface SafetyCategory {
  key: string;
  name: string;
  enabled: boolean;
  words: string[];
}

export interface SafetyLogEntry {
  id: string;
  time: string;
  user: string;
  detail: string;
}

export type DevTabId =
  | 'control'
  | 'audio'
  | 'event'
  | 'camera'
  | 'npc'
  | 'safety'
  | 'map'
  | 'layout'
  | 'vfx'
  | 'tiktok';

export interface GiftGuideItem {
  id: string;
  label: string;
  /** Emoji hoặc URL / Data URI ảnh icon quà tặng */
  iconUrl: string;
  statType: 'roses' | 'comments' | 'total_gifts' | 'custom';
  customBadgeText?: string;
  enabled: boolean;
}

export interface TtsRandomPhraseItem {
  id: string;
  text: string;
  /** Xác suất kích hoạt câu này (0 - 100%) */
  chancePercent: number;
  enabled: boolean;
}

export type LayoutElementKey =
  | 'headerBar'
  | 'visitingBar'
  | 'giftGuideIcons'
  | 'howToPlayBoard'
  | 'sessionTimerCard'
  | 'sessionBarChartCard'
  | 'bigAvatarZone'
  | 'giftToastBanner'
  | 'bottomPodium';

export interface LayoutPosition {
  x: number;
  y: number;
  /** Tỉ lệ thu phóng đồng đều ở góc (mặc định 1.0), khi kéo góc nhỏ lại nội dung bên trong scale theo */
  scale?: number;
  /** Kéo cạnh ngang để điều chỉnh chiều dài (mặc định 1.0) */
  scaleX?: number;
  /** Kéo cạnh dọc để điều chỉnh chiều dọc (mặc định 1.0) */
  scaleY?: number;
}

export interface HowToPlayBoardConfig {
  title: string;
  content: string;
  widthPx: number;
  fontFamily: string;
  fontSizePx: number;
  textColor: string;
}

export interface GameConfig {
  // Chế độ chơi (1: Gửi quà theo phiên X giây chốt Top 5, 2: Tự do tích lũy)
  gamePlayMode: GamePlayMode;
  sessionDurationSec: number;
  sessionTitle: string;
  sessionAutoResetPoints: boolean;
  sessionResultHoldSec: number;
  /** Tiêu đề bảng Danh sách tỉnh đạt Top 1 nhiều nhất */
  podiumTitle: string;

  // Nhạc nền (BGM) trong Dev Âm Thanh
  bgmEnabled: boolean;
  bgmPlayMode: BgmPlayMode;
  bgmVolume: number;

  // Chế độ chào người vào phòng Live
  welcomeJoinEnabled: boolean;
  welcomeJoinPhrases: string[];

  // Giọng đọc AI #3 (Node.js Local TTS + Fallback Cloud Stream)
  ttsEnabled: boolean;
  ttsEngine: TTSEngineType;
  nodeVoice: string;
  nodeTtsEndpoint: string;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  maxTtsWords: number;
  maxTtsQueueSize: number;
  commentGiftTtsTemplate: string;
  roseGiftTtsTemplate: string;
  /** Câu đọc cảm ơn nhiệt tình khi người chơi gửi nhiều hoa hồng cùng lúc */
  multiRoseGiftTtsTemplate: string;
  batchGiftTtsTemplate: string;
  /** Mẫu câu an toàn khi NPC gửi hoa hồng / quà coin hỗ trợ điểm (không nói NPC tặng quà) */
  npcSupportTtsTemplate: string;
  /** Bật/tắt đọc thông báo khi bắt đầu vòng mới */
  roundStartTtsEnabled: boolean;
  /** Mẫu câu đọc khi vòng X bắt đầu */
  roundStartTtsTemplate: string;
  /** Xác suất tổng (%) đọc kèm câu chào / câu vu vơ sau câu đọc sự kiện */
  ttsRandomPhraseChancePercent: number;
  /** Danh sách các mẫu câu chào / vu vơ kèm % kích hoạt từng câu */
  ttsRandomPhrases: TtsRandomPhraseItem[];
  /** Thỉnh thoảng chèn câu nói mời người chơi gửi hoa hồng (Format + % tỉ lệ xuất hiện) */
  rosePromptEnabled: boolean;
  rosePromptChancePercent: number;
  rosePromptTemplate: string;
  sfxEnabled: boolean;
  sfxVolume: number;

  // Điểm thưởng sự kiện & Gom hàng chờ (Batching)
  commentPoints: number;
  rosePoints: number;
  batchWindowMs: number;
  maxBatchSenders: number;

  // Camera Zoom vào tỉnh & Chế độ Camera (1: Phản ứng liên tục, 2: Xen kẽ zoom tổng)
  cameraAutoZoom: boolean;
  cameraMode: CameraMode;
  cameraOverviewHoldMs: number;
  cameraZoomScale: number;
  cameraHoldDurationSec: number;
  cameraSmoothSpeed: number;

  // Bản đồ Việt Nam 28 tỉnh & 6 thành phố + Hoàng Sa & Trường Sa
  mapCols: number;
  showZeroPointProvinceNames: boolean;
  tileFontSize: number;
  tileGapPx: number;
  showTopHeader: boolean;
  roundNumber: number;
  roundDurationSec: number;
  /** Độ mảnh & độ mờ viền giữa các tỉnh trên bản đồ mặc định */
  mapInternalBorderWidth: number;
  mapInternalBorderOpacity: number;

  // Icon quà tặng tùy chỉnh & Layout kéo thả + thu phóng góc/cạnh + ẩn/hiện từng bảng
  roseIconUrl: string;
  commentIconUrl: string;
  giftGuideItems: GiftGuideItem[];
  howToPlayConfig: HowToPlayBoardConfig;
  layoutEditMode: boolean;
  showSafeSquareGuide: boolean;
  showBottomPodium: boolean;
  showGiftToastBanner: boolean;
  layoutPositions: Record<LayoutElementKey, LayoutPosition>;
  layoutVisibility: Record<LayoutElementKey, boolean>;

  // Hiệu ứng ném Avatar (VFX) & Chế độ chờ bản đồ mặc định khi không có sự kiện
  throwDurationMs: number;
  avatarSizePx: number;
  maxContributorsPerTile: number;
  mapIdleMode: MapIdleMode;
  mapIdleSwayAmplitudePx: number;
  mapIdleSwaySpeed: number;
  mapIdlePanZoom: number;
  mapIdlePanCycleSec: number;

  // Giả lập NPC tự động
  npcAutoEnabled: boolean;
  npcIntervalSec: number;
  npcRoseChancePercent: number;
}

export interface StudioBackupData {
  version?: number;
  exportedAt?: string;
  config?: Partial<GameConfig>;
  provinces?: Array<{
    id: string;
    name?: string;
    points: number;
    giftCount: number;
    roseCount: number;
    top1WinCount?: number;
    recentContributors?: ProvinceContributor[];
  }>;
  npcNames?: string[];
  npcAvatars?: string[];
  safetyActionMode?: SafetyActionMode;
  safetyCategories?: SafetyCategory[];
  customWords?: string[];
}

export interface SyncPacket {
  type: 'ADMIN_SYNC';
  action:
    | 'SEND_PROVINCE_GIFT'
    | 'SEND_PROVINCE_BATCH_GIFT'
    | 'RESET_ALL_PROVINCES'
    | 'UPDATE_PROVINCES_STATE'
    | 'UPDATE_CONFIG'
    | 'UPDATE_SAFETY'
    | 'UPDATE_NPC_LISTS'
    | 'CAMERA_CMD'
    | 'PANIC_MUTE'
    | 'TEST_TTS'
    | 'CLEAR_TTS_QUEUE'
    | 'SYNC_LIVE_TTS_SNAPSHOT'
    | 'REQUEST_FULL_SYNC'
    | 'RESTORE_BACKUP'
    | 'SYNC_BGM_STATE';
  payload: Record<string, any>;
  ts: number;
}
