import { SafetyActionMode, SafetyCategory, SafetyLogEntry } from '../types/game';

const DEFAULT_CUSTOM_WORDS = ['kênh rác', 'live giả', 'cúng tiền'];

const PURIFIED_PRAYERS = [
  'Nam Mô A Di Đà Phật, con xin thành tâm sám hối mọi lỗi lầm 🙏',
  'Nguyện đem công đức này hướng về khắp tất cả chúng sinh đều trọn thành Phật đạo',
  'Con xin giữ tâm thanh tịnh, khẩu nghiệp thiện lành nơi cửa Phật 🙏',
  'Nam Mô Quan Thế Âm Bồ Tát, xin độ cho tâm con luôn sáng suốt bình an',
];

export const INITIAL_SAFETY_CATEGORIES: SafetyCategory[] = [
  {
    key: 'profanity',
    name: 'Tục tĩu, chửi thề & 18+ (Có lách dấu)',
    enabled: true,
    words: [
      'đm', 'địt', 'đụ', 'lồn', 'cặc', 'buồi', 'đéo', 'vcl', 'vl', 'vkl', 'đkm', 'dkm',
      'clm', 'cc', 'cmm', 'đĩ', 'phò', 'cave', 'chịch', 'xoạc', 'nứng', 'dâm', 'hiếp dâm',
      'bú cu', 'vú', 'mông', 'sục cặc', 'thủ dâm', 'khiêu dâm', 'sex', 'jav', 'xnxx', 'pornhub',
      'con mẹ mày', 'mả cha', 'tổ sư', 'chó đẻ', 'súc vật', 'óc chó', 'ngu lồn', 'hãm lồn',
    ],
  },
  {
    key: 'tts_traps',
    name: 'Bẫy phát âm TTS (Tên nói lái nhạy cảm)',
    enabled: true,
    words: [
      'châu tinh trùng', 'tinh trùng', 'bành thị lồng', 'lê văn luyện', 'đụ má', 'bà nội cha',
      'con cật', 'củ cật', 'cái lồng', 'lồng đèn đứt', 'bú lồn', 'liếm lồn', 'địt cụ', 'cụ tổ',
    ],
  },
  {
    key: 'violence_drugs',
    name: 'Bạo lực, tự hại & chất cấm',
    enabled: true,
    words: [
      'giết người', 'chém chết', 'đâm chết', 'tự tử', 'tự sát', 'nhảy cầu', 'rạch tay', 'uống thuốc sâu',
      'treo cổ', 'bom', 'súng đạn', 'khủng bố', 'ma túy', 'cần sa', 'đập đá', 'ngáo đá', 'hàng trắng',
      'thuốc lắc', 'kẹo ke', 'hút cỏ', 'chích xì ke', 'heroin', 'máu me', 'chặt đầu',
    ],
  },
  {
    key: 'gambling_scam',
    name: 'Cờ bạc, cá độ & tài xỉu lừa đảo',
    enabled: true,
    words: [
      'tài xỉu', 'cá độ', 'cờ bạc', 'lô đề', 'xóc đĩa', 'nhà cái', 'kubet', 'sunwin', 'go88',
      'b52', 'rikvip', 'nổ hũ', 'bắn cá đổi thưởng', 'casino', 'vay nóng', 'bốc bát họ',
      'kéo tài xỉu', 'nhóm kéo', 'kiếm tiền tại nhà', 'tuyển cộng tác viên', 'lừa đảo',
    ],
  },
  {
    key: 'redirect_pii',
    name: 'Điều hướng nền tảng, SĐT & Link ngoài',
    enabled: true,
    words: [
      'zalo', 'facebook', 'phây búc', 'shopee', 'sóp pi', 'lazada', 'telegram', 'tele', 'youtube',
      'chuyển khoản', 'số tài khoản', 'stk', 'momo', 'rửa tiền', 'đô la', 'link bio', 'nhắn tin riêng',
    ],
  },
  {
    key: 'politics_religion',
    name: 'Chính trị cực đoan & xúc phạm tôn giáo',
    enabled: true,
    words: [
      'phản động', 'ba que', '3 que', 'cali', 'khát nước', 'cộng sản', 'biểu tình', 'lật đổ',
      'chùa lừa đảo', 'sư giả', 'phật giả', 'cúng tiền cho sư', 'sư thầy ăn thịt', 'buôn thần bán thánh',
    ],
  },
];

export function loadSavedCustomWords(): string[] {
  try {
    const raw = localStorage.getItem('chua_custom_banned_words');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore storage error
  }
  return [...DEFAULT_CUSTOM_WORDS];
}

export function saveCustomWordsToStorage(words: string[]) {
  try {
    localStorage.setItem('chua_custom_banned_words', JSON.stringify(words));
  } catch {
    // Ignore
  }
}

export function getDefaultCustomWords(): string[] {
  return [...DEFAULT_CUSTOM_WORDS];
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function normalizeForScan(rawText: string) {
  const lower = (rawText || '').toLowerCase().trim();
  const collapsed = lower.replace(/[.,\-_*+~|\s]+/g, ' ');
  const squashed = lower.replace(/[.,\-_*+~|\s]+/g, '');
  const noTone = removeVietnameseTones(collapsed);
  return { lower, collapsed, squashed, noTone };
}

export function scanTextViolation(
  rawText: string,
  categories: SafetyCategory[],
  customWords: string[]
): { violated: boolean; reason: string | null; matchedWord: string | null } {
  if (!rawText) return { violated: false, reason: null, matchedWord: null };
  const { lower, collapsed, squashed, noTone } = normalizeForScan(rawText);

  const redirectCat = categories.find((c) => c.key === 'redirect_pii');
  if (redirectCat?.enabled) {
    const digitsOnly = rawText.replace(/[.\-\s_]/g, '');
    if (/(0[35789][0-9]{8,9}|\+84[0-9]{8,9})/.test(digitsOnly)) {
      return { violated: true, reason: 'Số điện thoại (PII)', matchedWord: 'SĐT' };
    }
    if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|vn|net|org|me|vip|win|club|fun)\b)/i.test(lower)) {
      return { violated: true, reason: 'Link Web ngoài', matchedWord: 'URL' };
    }
  }

  const activeWords = [
    ...customWords,
    ...categories.filter((c) => c.enabled).flatMap((c) => c.words),
  ]
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  for (const word of activeWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word.includes(' ')) {
      if (collapsed.includes(word)) {
        return { violated: true, reason: 'Từ cấm', matchedWord: word };
      }
      const wordNoSpace = word.replace(/\s+/g, '');
      if (wordNoSpace.length >= 5 && squashed.includes(wordNoSpace)) {
        return { violated: true, reason: 'Từ cấm (viết liền)', matchedWord: word };
      }
    } else {
      const boundaryRegex = new RegExp(
        `(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`,
        'iu'
      );
      if (boundaryRegex.test(collapsed) || boundaryRegex.test(lower)) {
        return { violated: true, reason: 'Từ cấm', matchedWord: word };
      }
      const wordNoTone = removeVietnameseTones(word);
      if (wordNoTone.length >= 3) {
        const spacedPattern = wordNoTone.split('').join('[\\s.\\-_*]+');
        const bypassRegex = new RegExp(`(^|[^a-z0-9])${spacedPattern}([^a-z0-9]|$)`, 'i');
        if (bypassRegex.test(noTone)) {
          return { violated: true, reason: 'Cố tình lách ký tự', matchedWord: word };
        }
      }
    }
  }

  return { violated: false, reason: null, matchedWord: null };
}

export function maskBadWords(
  rawText: string,
  categories: SafetyCategory[],
  customWords: string[]
): string {
  let result = rawText;
  const activeWords = [
    ...customWords,
    ...categories.filter((c) => c.enabled).flatMap((c) => c.words),
  ];
  activeWords.forEach((w) => {
    if (!w) return;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '***');
  });
  return result.replace(/(0[35789][0-9.\-\s]{7,12})/g, '***');
}

export function inspectUserInteraction(
  username: string,
  prayer: string,
  actionMode: SafetyActionMode,
  categories: SafetyCategory[],
  customWords: string[]
): {
  allowed: boolean;
  allowTTS: boolean;
  safeUsername: string;
  safePrayer: string;
  nameViolated: boolean;
  prayerViolated: boolean;
  matchedWord: string | null;
  logEntries: SafetyLogEntry[];
} {
  const nameScan = scanTextViolation(username, categories, customWords);
  const prayerScan = scanTextViolation(prayer, categories, customWords);

  let safeUsername = username;
  let safePrayer = prayer;
  let allowTTS = true;
  let allowed = true;
  const logEntries: SafetyLogEntry[] = [];
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });

  if (nameScan.violated) {
    safeUsername = 'Học Sinh Chăm Ngoan';
    logEntries.push({
      id: `${Date.now()}-name-${Math.random()}`,
      time: timeStr,
      user: username,
      detail: `Tên nhạy cảm (${nameScan.matchedWord}) → Đổi tên ẩn danh`,
    });
  }

  if (prayerScan.violated) {
    if (actionMode === 'block') {
      allowed = false;
      allowTTS = false;
      logEntries.push({
        id: `${Date.now()}-block-${Math.random()}`,
        time: timeStr,
        user: username,
        detail: `Chặn hoàn toàn: "${prayer}" (${prayerScan.matchedWord})`,
      });
    } else if (actionMode === 'purify') {
      safePrayer = PURIFIED_PRAYERS[Math.floor(Math.random() * PURIFIED_PRAYERS.length)];
      logEntries.push({
        id: `${Date.now()}-purify-${Math.random()}`,
        time: timeStr,
        user: username,
        detail: `Thanh hóa câu: "${prayer}" (${prayerScan.matchedWord})`,
      });
    } else if (actionMode === 'mask') {
      safePrayer = maskBadWords(prayer, categories, customWords);
      allowTTS = false;
      logEntries.push({
        id: `${Date.now()}-mask-${Math.random()}`,
        time: timeStr,
        user: username,
        detail: `Che *** & Tắt TTS: "${prayer}" (${prayerScan.matchedWord})`,
      });
    }
  }

  return {
    allowed,
    allowTTS,
    safeUsername,
    safePrayer,
    nameViolated: nameScan.violated,
    prayerViolated: prayerScan.violated,
    matchedWord: prayerScan.matchedWord || nameScan.matchedWord,
    logEntries,
  };
}
