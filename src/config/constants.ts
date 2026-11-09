import { GameConfig, ProvinceCell } from '../types/game';

export const AVATAR_COLORS = [
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#3b82f6',
  '#ef4444',
];

export const DEFAULT_NPC_AVATARS: string[] = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=MinhKhang',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=BaoNgoc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=GiaHuy',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=ThaoVy',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=TuanKiet',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=KhanhLinh',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=HaiDang',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=MyDuyen',
];

export const SAMPLE_NAMES: string[] = [
  'Minh Khang',
  'Bảo Ngọc',
  'Gia Huy',
  'Thảo Vy',
  'Tuấn Kiệt',
  'Khánh Linh',
  'Hải Đăng',
  'Mỹ Duyên',
  'Quốc Anh',
  'Thanh Trúc',
  'Hoàng Nam',
  'Phương Thảo',
  'Đức Phúc',
  'Ngọc Hân',
  'Văn Tùng',
  'Thu Hà',
];

/**
 * Danh sách 34 đơn vị hành chính Việt Nam: 6 Thành phố trực thuộc TW & 28 Tỉnh
 * Kèm bộ từ khóa (aliases) hỗ trợ nhận diện cả tên viết tắt và tên tỉnh truyền thống
 */
export const INITIAL_PROVINCES_DATA: Omit<
  ProvinceCell,
  'points' | 'giftCount' | 'roseCount' | 'top1WinCount' | 'recentContributors' | 'lastUpdatedAt'
>[] = [
  // === 6 THÀNH PHỐ TRỰC THUỘC TRUNG ƯƠNG ===
  {
    id: 'tp-ha-noi',
    code: 1,
    name: 'Hà Nội',
    unitType: 'city',
    mapX: 0.43,
    mapY: 0.21,
    labelSide: 'left',
    aliases: ['hà nội', 'ha noi', 'hanoi', 'thủ đô', 'thu do', 'hn', '29', '30'],
  },
  {
    id: 'tp-hai-phong',
    code: 2,
    name: 'Hải Phòng',
    unitType: 'city',
    mapX: 0.51,
    mapY: 0.215,
    labelSide: 'right',
    aliases: ['hải phòng', 'hai phong', 'haiphong', 'hải dương', 'hai duong', 'haiduong', 'chí linh', 'hp', '15', '16', '34'],
  },
  {
    id: 'tp-hue',
    code: 3,
    name: 'TP. Huế',
    unitType: 'city',
    mapX: 0.54,
    mapY: 0.455,
    labelSide: 'right',
    aliases: ['huế', 'hue', 'thừa thiên huế', 'thua thien hue', 'thuathienhue', 'tp huế', '75'],
  },
  {
    id: 'tp-da-nang',
    code: 4,
    name: 'Đà Nẵng',
    unitType: 'city',
    mapX: 0.585,
    mapY: 0.495,
    labelSide: 'right',
    aliases: ['đà nẵng', 'da nang', 'danang', 'quảng nam', 'quang nam', 'quangnam', 'hội an', 'hoi an', 'tam kỳ', '43', '92'],
  },
  {
    id: 'tp-ho-chi-minh',
    code: 5,
    name: 'TP. Hồ Chí Minh',
    unitType: 'city',
    mapX: 0.505,
    mapY: 0.785,
    labelSide: 'right',
    aliases: [
      'hồ chí minh',
      'ho chi minh',
      'hochiminh',
      'sài gòn',
      'sai gon',
      'saigon',
      'tphcm',
      'hcm',
      'sg',
      'bình dương',
      'binh duong',
      'binhduong',
      'thủ dầu một',
      'dĩ an',
      'thuận an',
      'bà rịa - vũng tàu',
      'bà rịa vũng tàu',
      'ba ria vung tau',
      'bariavungtau',
      'brvt',
      'vũng tàu',
      'vung tau',
      'vungtau',
      'bà rịa',
      'ba ria',
      'baria',
      '50',
      '59',
      '61',
      '72',
    ],
  },
  {
    id: 'tp-can-tho',
    code: 6,
    name: 'Cần Thơ',
    unitType: 'city',
    mapX: 0.415,
    mapY: 0.855,
    labelSide: 'left',
    aliases: [
      'cần thơ',
      'can tho',
      'cantho',
      'sóc trăng',
      'soc trang',
      'soctrang',
      'hậu giang',
      'hau giang',
      'haugiang',
      'vị thanh',
      '65',
      '83',
      '95',
    ],
  },

  // === 28 TỈNH (TỪ BẮC VÀO NAM) ===
  {
    id: 'dien-bien',
    code: 7,
    name: 'Điện Biên',
    unitType: 'province',
    mapX: 0.22,
    mapY: 0.165,
    labelSide: 'left',
    aliases: ['điện biên', 'dien bien', 'dienbien', '27'],
  },
  {
    id: 'lai-chau',
    code: 8,
    name: 'Lai Châu',
    unitType: 'province',
    mapX: 0.255,
    mapY: 0.115,
    labelSide: 'left',
    aliases: ['lai châu', 'lai chau', 'laichau', '25'],
  },
  {
    id: 'son-la',
    code: 9,
    name: 'Sơn La',
    unitType: 'province',
    mapX: 0.30,
    mapY: 0.195,
    labelSide: 'left',
    aliases: ['sơn la', 'son la', 'sonla', '26'],
  },
  {
    id: 'lao-cai',
    code: 10,
    name: 'Lào Cai',
    unitType: 'province',
    mapX: 0.33,
    mapY: 0.125,
    labelSide: 'left',
    aliases: ['lào cai', 'lao cai', 'laocai', 'yên bái', 'yen bai', 'yenbai', 'sapa', 'sa pa', '24', '21'],
  },
  {
    id: 'tuyen-quang',
    code: 11,
    name: 'Tuyên Quang',
    unitType: 'province',
    mapX: 0.39,
    mapY: 0.11,
    labelSide: 'left',
    aliases: ['tuyên quang', 'tuyen quang', 'tuyenquang', 'hà giang', 'ha giang', 'hagiang', '22', '23'],
  },
  {
    id: 'cao-bang',
    code: 12,
    name: 'Cao Bằng',
    unitType: 'province',
    mapX: 0.47,
    mapY: 0.105,
    labelSide: 'right',
    aliases: ['cao bằng', 'cao bang', 'caobang', '11'],
  },
  {
    id: 'lang-son',
    code: 13,
    name: 'Lạng Sơn',
    unitType: 'province',
    mapX: 0.505,
    mapY: 0.15,
    labelSide: 'right',
    aliases: ['lạng sơn', 'lang son', 'langson', '12'],
  },
  {
    id: 'thai-nguyen',
    code: 14,
    name: 'Thái Nguyên',
    unitType: 'province',
    mapX: 0.445,
    mapY: 0.155,
    labelSide: 'right',
    aliases: ['thái nguyên', 'thai nguyen', 'thainguyen', 'bắc kạn', 'bac kan', 'backan', 'bắc cạn', 'bac can', 'baccan', '20', '97'],
  },
  {
    id: 'phu-tho',
    code: 15,
    name: 'Phú Thọ',
    unitType: 'province',
    mapX: 0.385,
    mapY: 0.18,
    labelSide: 'left',
    aliases: [
      'phú thọ',
      'phu tho',
      'phutho',
      'việt trì',
      'vĩnh phúc',
      'vinh phuc',
      'vinhphuc',
      'vĩnh yên',
      'hòa bình',
      'hoa binh',
      'hoabinh',
      '19',
      '88',
      '28',
    ],
  },
  {
    id: 'quang-ninh',
    code: 16,
    name: 'Quảng Ninh',
    unitType: 'province',
    mapX: 0.565,
    mapY: 0.185,
    labelSide: 'right',
    aliases: ['quảng ninh', 'quang ninh', 'quangninh', 'hạ long', 'ha long', '14'],
  },
  {
    id: 'bac-ninh',
    code: 17,
    name: 'Bắc Ninh',
    unitType: 'province',
    mapX: 0.475,
    mapY: 0.19,
    labelSide: 'right',
    aliases: ['bắc ninh', 'bac ninh', 'bacninh', 'bắc giang', 'bac giang', 'bacgiang', '99', '98'],
  },
  {
    id: 'hung-yen',
    code: 18,
    name: 'Hưng Yên',
    unitType: 'province',
    mapX: 0.47,
    mapY: 0.23,
    labelSide: 'right',
    aliases: ['hưng yên', 'hung yen', 'hungyen', 'thái bình', 'thai binh', 'thaibinh', '89', '17'],
  },
  {
    id: 'ninh-binh',
    code: 19,
    name: 'Ninh Bình',
    unitType: 'province',
    mapX: 0.445,
    mapY: 0.255,
    labelSide: 'right',
    aliases: [
      'ninh bình',
      'ninh binh',
      'ninhbinh',
      'nam định',
      'nam dinh',
      'namdinh',
      'hà nam',
      'ha nam',
      'hanam',
      'phủ lý',
      '35',
      '18',
      '90',
    ],
  },
  {
    id: 'thanh-hoa',
    code: 20,
    name: 'Thanh Hóa',
    unitType: 'province',
    mapX: 0.405,
    mapY: 0.29,
    labelSide: 'left',
    aliases: ['thanh hóa', 'thanh hoa', 'thanhhoa', '36'],
  },
  {
    id: 'nghe-an',
    code: 21,
    name: 'Nghệ An',
    unitType: 'province',
    mapX: 0.385,
    mapY: 0.34,
    labelSide: 'left',
    aliases: ['nghệ an', 'nghe an', 'nghean', 'vinh', '37'],
  },
  {
    id: 'ha-tinh',
    code: 22,
    name: 'Hà Tĩnh',
    unitType: 'province',
    mapX: 0.435,
    mapY: 0.385,
    labelSide: 'left',
    aliases: ['hà tĩnh', 'ha tinh', 'hatinh', '38'],
  },
  {
    id: 'quang-tri',
    code: 23,
    name: 'Quảng Trị',
    unitType: 'province',
    mapX: 0.49,
    mapY: 0.425,
    labelSide: 'left',
    aliases: ['quảng trị', 'quang tri', 'quangtri', 'đông hà', 'quảng bình', 'quang binh', 'quangbinh', 'đồng hới', '73', '74'],
  },
  {
    id: 'quang-ngai',
    code: 24,
    name: 'Quảng Ngãi',
    unitType: 'province',
    mapX: 0.60,
    mapY: 0.545,
    labelSide: 'right',
    aliases: ['quảng ngãi', 'quang ngai', 'quangngai', 'kon tum', 'kontum', '76', '82'],
  },
  {
    id: 'gia-lai',
    code: 25,
    name: 'Gia Lai',
    unitType: 'province',
    mapX: 0.605,
    mapY: 0.60,
    labelSide: 'right',
    aliases: ['gia lai', 'gialai', 'pleiku', 'bình định', 'binh dinh', 'binhdinh', 'quy nhơn', 'quynhon', '81', '77'],
  },
  {
    id: 'dak-lak',
    code: 26,
    name: 'Đắk Lắk',
    unitType: 'province',
    mapX: 0.615,
    mapY: 0.66,
    labelSide: 'right',
    aliases: ['đắk lắk', 'dak lak', 'daklak', 'đăk lăk', 'đắc lắc', 'dac lac', 'daclac', 'buôn ma thuột', 'bmt', 'phú yên', 'phu yen', 'phuyen', 'tuy hòa', '47', '78'],
  },
  {
    id: 'khanh-hoa',
    code: 27,
    name: 'Khánh Hòa',
    unitType: 'province',
    mapX: 0.645,
    mapY: 0.715,
    labelSide: 'right',
    aliases: ['khánh hòa', 'khanh hoa', 'khanhhoa', 'nha trang', 'nhatrang', 'ninh thuận', 'ninh thuan', 'ninhthuan', 'phan rang', '79', '85'],
  },
  {
    id: 'lam-dong',
    code: 28,
    name: 'Lâm Đồng',
    unitType: 'province',
    mapX: 0.575,
    mapY: 0.74,
    labelSide: 'right',
    aliases: [
      'lâm đồng',
      'lam dong',
      'lamdong',
      'đà lạt',
      'da lat',
      'dalat',
      'đắk nông',
      'dak nong',
      'daknong',
      'đắc nông',
      'dac nong',
      'dacnong',
      'gia nghĩa',
      'bình thuận',
      'binh thuan',
      'binhthuan',
      'phan thiết',
      'phanthiet',
      '49',
      '48',
      '86',
    ],
  },
  {
    id: 'tay-ninh',
    code: 29,
    name: 'Tây Ninh',
    unitType: 'province',
    mapX: 0.46,
    mapY: 0.765,
    labelSide: 'left',
    aliases: ['tây ninh', 'tay ninh', 'tayninh', 'long an', 'longan', 'tân an', '70', '62'],
  },
  {
    id: 'dong-nai',
    code: 30,
    name: 'Đồng Nai',
    unitType: 'province',
    mapX: 0.53,
    mapY: 0.745,
    labelSide: 'left',
    aliases: ['đồng nai', 'dong nai', 'dongnai', 'biên hòa', 'bien hoa', 'bình phước', 'binh phuoc', 'binhphuoc', 'đồng xoài', '60', '93'],
  },
  {
    id: 'dong-thap',
    code: 31,
    name: 'Đồng Tháp',
    unitType: 'province',
    mapX: 0.435,
    mapY: 0.81,
    labelSide: 'left',
    aliases: ['đồng tháp', 'dong thap', 'dongthap', 'cao lãnh', 'sa đéc', 'tiền giang', 'tien giang', 'tiengiang', 'mỹ tho', 'mytho', '66', '63'],
  },
  {
    id: 'vinh-long',
    code: 32,
    name: 'Vĩnh Long',
    unitType: 'province',
    mapX: 0.465,
    mapY: 0.84,
    labelSide: 'right',
    aliases: [
      'vĩnh long',
      'vinh long',
      'vinhlong',
      'bến tre',
      'ben tre',
      'bentre',
      'trà vinh',
      'tra vinh',
      'travinh',
      '64',
      '71',
      '84',
    ],
  },
  {
    id: 'an-giang',
    code: 33,
    name: 'An Giang',
    unitType: 'province',
    mapX: 0.375,
    mapY: 0.835,
    labelSide: 'left',
    aliases: ['an giang', 'angiang', 'long xuyên', 'châu đốc', 'kiên giang', 'kien giang', 'kiengiang', 'rạch giá', 'hà tiên', 'phú quốc', 'phu quoc', 'phuquoc', '67', '68'],
  },
  {
    id: 'ca-mau',
    code: 34,
    name: 'Cà Mau',
    unitType: 'province',
    mapX: 0.385,
    mapY: 0.905,
    labelSide: 'left',
    aliases: ['cà mau', 'ca mau', 'camau', 'bạc liêu', 'bac lieu', 'baclieu', '69', '94'],
  },
];

export function createInitialProvinces(): ProvinceCell[] {
  return INITIAL_PROVINCES_DATA.map((item) => ({
    ...item,
    points: 0,
    giftCount: 0,
    roseCount: 0,
    top1WinCount: 0,
    recentContributors: [],
    lastUpdatedAt: 0,
  }));
}

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Tìm tỉnh/thành phố khớp với nội dung bình luận của người chơi
 */
export function matchProvinceFromComment(
  rawComment: string,
  provinces: ProvinceCell[]
): ProvinceCell | null {
  if (!rawComment || !rawComment.trim()) return null;
  const lower = rawComment.toLowerCase().trim();
  const cleanText = ` ${lower.replace(/[.,!?;\-_/()[\]{}'"]+/g, ' ')} `.replace(/\s+/g, ' ');
  const noAccentText = ` ${removeAccents(cleanText)} `.replace(/\s+/g, ' ');

  // 1. Ưu tiên khớp tên chính xác có dấu trước
  for (const prov of provinces) {
    const cleanName = prov.name.replace(/^TP\.\s*/i, '').toLowerCase().trim();
    if (cleanText.includes(` ${cleanName} `)) {
      return prov;
    }
    for (const alias of prov.aliases) {
      if (alias.length >= 3 && cleanText.includes(` ${alias.toLowerCase()} `)) {
        return prov;
      }
    }
  }

  // 2. Khớp không dấu (ví dụ người xem gõ "nghe an", "da nang", "ha noi", "ca mau")
  for (const prov of provinces) {
    const cleanNameNoAccent = removeAccents(prov.name.replace(/^TP\.\s*/i, '').trim());
    if (cleanNameNoAccent.length >= 3 && noAccentText.includes(` ${cleanNameNoAccent} `)) {
      return prov;
    }
    for (const alias of prov.aliases) {
      const aliasNoAccent = removeAccents(alias.trim());
      if (aliasNoAccent.length >= 2 && noAccentText.includes(` ${aliasNoAccent} `)) {
        return prov;
      }
    }
  }

  // 3. Khớp chuỗi con nếu người chơi viết liền (VD: "hanoi", "danang", "tphcm", "camau", "binhduong", "haiduong", "bacgiang")
  const squashed = removeAccents(lower).replace(/[^a-z0-9]/g, '');
  for (const prov of provinces) {
    const nameSquashed = removeAccents(prov.name.replace(/^TP\.\s*/i, '')).replace(/[^a-z0-9]/g, '');
    if (nameSquashed.length >= 4 && squashed.includes(nameSquashed)) {
      return prov;
    }
    for (const alias of prov.aliases) {
      const aliasSquashed = removeAccents(alias).replace(/[^a-z0-9]/g, '');
      if (aliasSquashed.length >= 5 && squashed.includes(aliasSquashed)) {
        return prov;
      }
    }
  }

  return null;
}

/**
 * Kiểm tra xem bình luận có kèm từ khóa gửi hoa hồng không
 */
export function isRoseKeywordInText(rawText: string): boolean {
  if (!rawText) return false;
  const lower = rawText.toLowerCase();
  return (
    lower.includes('hoa hồng') ||
    lower.includes('hoa hong') ||
    lower.includes('tặng hoa') ||
    lower.includes('tang hoa') ||
    lower.includes('gửi hoa') ||
    lower.includes('gui hoa') ||
    lower.includes('rose') ||
    lower.includes('🌹')
  );
}

export const DEFAULT_GIFT_GUIDE_ITEMS = [
  {
    id: 'guide-rose',
    label: 'Gửi lời chào',
    iconUrl: '🌹',
    statType: 'roses' as const,
    enabled: true,
  },
  {
    id: 'guide-comment',
    label: 'Bình luận tên tỉnh',
    iconUrl: '👑',
    statType: 'comments' as const,
    enabled: true,
  },
];

export const HOW_TO_PLAY_BRIGHT_COLORS = [
  { id: 'white', label: 'Trắng Sáng', hex: '#FFFFFF' },
  { id: 'gold', label: 'Vàng Kim Sáng', hex: '#FDE047' },
  { id: 'cyan', label: 'Xanh Ngọc Sáng', hex: '#67E8F9' },
  { id: 'mint', label: 'Xanh Lá Neon', hex: '#86EFAC' },
  { id: 'coral', label: 'Hồng San Hô Sáng', hex: '#FDA4AF' },
] as const;

export const HOW_TO_PLAY_FONTS = [
  { id: 'sans-serif', label: 'Mặc định (Hiện đại)', family: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'montserrat', label: 'Đậm Thể Thao (Arial Black)', family: '"Arial Black", Montserrat, sans-serif' },
  { id: 'mono', label: 'Điện Tử (Monospace)', family: 'ui-monospace, SFMono-Regular, monospace' },
  { id: 'serif', label: 'Cổ Điển (Serif)', family: 'Georgia, Cambria, "Times New Roman", serif' },
  { id: 'rounded', label: 'Bo Tròn Mềm Mại', family: '"Trebuchet MS", Verdana, sans-serif' },
] as const;

export const DEFAULT_HOW_TO_PLAY_CONFIG = {
  title: 'HƯỚNG DẪN CHƠI GAME',
  content: '💬 Bình luận Tên Tỉnh (1 lần/phiên): +1 điểm\n🌹 Tặng Hoa Hồng (không giới hạn): +5 điểm/hoa',
  widthPx: 250,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSizePx: 11,
  textColor: '#FDE047',
};

export const DEFAULT_LAYOUT_POSITIONS = {
  headerBar: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  visitingBar: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  giftGuideIcons: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  howToPlayBoard: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  eventQueueBoard: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  sessionTimerCard: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  sessionBarChartCard: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  bigAvatarZone: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  giftToastBanner: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
  bottomPodium: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
};

export const DEFAULT_LAYOUT_VISIBILITY = {
  headerBar: true,
  visitingBar: true,
  giftGuideIcons: true,
  howToPlayBoard: true,
  eventQueueBoard: true,
  sessionTimerCard: true,
  sessionBarChartCard: true,
  bigAvatarZone: true,
  giftToastBanner: true,
  bottomPodium: true,
};

export const DEFAULT_WELCOME_JOIN_PHRASES: string[] = [
  'Hữu duyên gặp [Tên], bạn ở đâu đến đây thế?',
  'Chào mừng [Tên] mới vào phòng giao lưu, bạn quê ở tỉnh nào thế?',
  'Xin chào [Tên] nha, hãy bình luận tên tỉnh quê mình để cùng giao lưu nhé!',
];

export const DEFAULT_TTS_RANDOM_PHRASES = [
  {
    id: 'phrase_welcome_1',
    text: 'Chào mừng bạn nhé, chúc bạn buổi tối vui vẻ!',
    chancePercent: 60,
    enabled: true,
  },
  {
    id: 'phrase_hometown_2',
    text: 'Quê hương [Tỉnh] hôm nay đông vui quá trời luôn!',
    chancePercent: 50,
    enabled: true,
  },
  {
    id: 'phrase_thanks_3',
    text: 'Cảm ơn [Tên] đã ghé thăm và tiếp sức cho tỉnh nhà nha!',
    chancePercent: 45,
    enabled: true,
  },
  {
    id: 'phrase_cheer_4',
    text: 'Mọi người ơi cùng bình luận tên tỉnh quê mình để đua top nào!',
    chancePercent: 35,
    enabled: true,
  },
  {
    id: 'phrase_casual_5',
    text: 'Tỉnh [Tỉnh] đang bứt phá rất nhanh, cố lên nhé các bạn ơi!',
    chancePercent: 40,
    enabled: true,
  },
];

export const DEFAULT_CONFIG: GameConfig = {
  // Chế độ chơi mặc định
  gamePlayMode: 'session_top5',
  sessionDurationSec: 180,
  sessionTitle: 'Đua Top Phiên',
  sessionAutoResetPoints: true,
  sessionResultHoldSec: 7,
  podiumTitle: 'DANH SÁCH TỈNH ĐẠT TOP 1 NHIỀU NHẤT',

  // Nhạc nền (BGM) trong Dev Âm Thanh
  bgmEnabled: true,
  bgmPlayMode: 'next_all',
  bgmVolume: 0.35,

  // Chế độ chào người vào phòng Live
  welcomeJoinEnabled: true,
  welcomeJoinPhrases: DEFAULT_WELCOME_JOIN_PHRASES,

  // Giọng đọc AI #3 mặc định
  ttsEnabled: true,
  ttsEngine: 'node_edge',
  nodeVoice: 'google-vi-gtx',
  nodeTtsEndpoint: 'http://localhost:8080/tts',
  ttsRate: 1.08,
  ttsPitch: 1.0,
  ttsVolume: 1.0,
  maxTtsWords: 45,
  maxTtsQueueSize: 40,
  commentGiftTtsTemplate: 'Bạn [Tên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm',
  roseGiftTtsTemplate: '[Tên] đã gửi hoa hồng kèm [Điểm] điểm về [Tỉnh]',
  specialGiftTtsTemplate:
    '[Tên] là tặng 1 món quà đặc biệt kèm [Điểm] điểm về [Tỉnh]',
  multiRoseGiftTtsTemplate:
    'Wow! Cảm ơn [Tên] rất nhiều đã gửi [SốHoa] bông hoa hồng kèm [Điểm] điểm siêu khủng về tỉnh [Tỉnh]! Yêu [Tên] quá trời luôn!',
  batchGiftTtsTemplate:
    'Các bạn [DanhSáchTên] đã đến tỉnh [Tỉnh] và gửi [Điểm] điểm',
  npcSupportTtsTemplate:
    'NPC [Tên] đã hỗ trợ [Điểm] điểm về tỉnh [Tỉnh]',
  roundStartTtsEnabled: true,
  roundStartTtsTemplate:
    'Vòng [Vòng] bắt đầu, mời các bạn tham gia giao lưu với nhau!',
  ttsRandomPhraseChancePercent: 35,
  ttsRandomPhrases: DEFAULT_TTS_RANDOM_PHRASES,
  rosePromptEnabled: true,
  rosePromptChancePercent: 25,
  rosePromptTemplate:
    'Mời các bạn thả hoa hồng để cộng thật nhiều điểm giúp tỉnh quê mình bứt phá lên top 1 nào!',
  sfxEnabled: true,
  sfxVolume: 0.7,

  // Điểm thưởng & Gom hàng chờ (Batching)
  commentPoints: 1,
  rosePoints: 5,
  batchWindowMs: 1200,
  maxBatchSenders: 12,

  // Camera
  cameraAutoZoom: true,
  cameraMode: 'continuous',
  cameraOverviewHoldMs: 650,
  cameraZoomScale: 3.2,
  cameraHoldDurationSec: 2.5,
  cameraSmoothSpeed: 0.55,

  // Map 28 tỉnh & 6 thành phố + Hoàng Sa & Trường Sa
  mapCols: 6,
  showZeroPointProvinceNames: false,
  tileFontSize: 10,
  tileGapPx: 6,
  showTopHeader: true,
  roundNumber: 69,
  roundDurationSec: 180,
  mapInternalBorderWidth: 0.65,
  mapInternalBorderOpacity: 0.25,

  // Icon quà tặng tùy chỉnh & Layout kéo thả
  roseIconUrl: '🌹',
  commentIconUrl: '👑',
  giftGuideItems: DEFAULT_GIFT_GUIDE_ITEMS,
  howToPlayConfig: { ...DEFAULT_HOW_TO_PLAY_CONFIG },
  layoutEditMode: false,
  showSafeSquareGuide: false,
  showBottomPodium: true,
  showGiftToastBanner: true,
  layoutPositions: { ...DEFAULT_LAYOUT_POSITIONS },
  layoutVisibility: { ...DEFAULT_LAYOUT_VISIBILITY },

  // VFX ném Avatar & Chế độ chờ Map mặc định
  throwDurationMs: 850,
  avatarSizePx: 46,
  maxContributorsPerTile: 20,
  mapIdleMode: 'sway',
  mapIdleSwayAmplitudePx: 8,
  mapIdleSwaySpeed: 1.0,
  mapIdlePanZoom: 1.65,
  mapIdlePanCycleSec: 18,

  // NPC giả lập
  npcAutoEnabled: false,
  npcIntervalSec: 4,
  npcRoseChancePercent: 35,
};

export const NODE_SERVER_CODE = `// File: server.js (Bridge TikTok Live + Giọng đọc AI #3 cho Game Gửi Quà Về Tỉnh Của Tôi)
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

// Chặn mọi lỗi ngầm không làm sập cửa sổ CMD
process.on('uncaughtException', err => {
  console.warn('⚠️ [BỎ QUA LỖI NGẦM]:', err?.message || err);
});
process.on('unhandledRejection', err => {
  console.warn('⚠️ [BỎ QUA PROMISE LỖI]:', err?.message || err);
});

let MsEdgeTTS, OUTPUT_FORMAT;
try {
  ({ MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts'));
} catch (e) {}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let cachedBgmStatePayload = null;
let cachedBgmUpdatedAt = 0;

app.get('/bgm-state', (req, res) => {
  res.json({
    ok: true,
    payload: cachedBgmStatePayload,
    updatedAt: cachedBgmUpdatedAt
  });
});

app.post('/bgm-state', (req, res) => {
  const payload = req.body?.payload || req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false });
  }
  cachedBgmStatePayload = payload;
  cachedBgmUpdatedAt = Date.now();
  const packet = {
    type: 'ADMIN_SYNC',
    action: 'SYNC_BGM_STATE',
    payload,
    timestamp: cachedBgmUpdatedAt
  };
  latestSyncCache['SYNC_BGM_STATE'] = packet;
  broadcast(packet);
  res.json({ ok: true });
});

const ttsCache = new Map();
const MAX_TTS_CACHE = 180;

async function fetchGoogleMirrorBuffer(text, voiceVariant) {
  const isSlow = voiceVariant === 'google-vi-slow';
  const speedParam = isSlow ? '0.24' : '1';
  const encoded = encodeURIComponent(text);
  const gtxUrl = \`https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=vi&client=gtx&ttsspeed=\${speedParam}&q=\${encoded}\`;
  const twObUrl = \`https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&ttsspeed=\${speedParam}&q=\${encoded}\`;
  const urls = voiceVariant === 'google-vi-twob' ? [twObUrl, gtxUrl] : [gtxUrl, twObUrl];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 128) return buf;
    } catch (e) {}
  }
  throw new Error('Google TTS mirrors unreachable');
}

app.get('/tts', async (req, res) => {
  try {
    const text = String(req.query.text || 'Xin chào').trim().slice(0, 220);
    const voice = String(req.query.voice || 'google-vi-gtx').trim();
    const cacheKey = \`\${voice}:\${text}\`;

    if (ttsCache.has(cacheKey)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(ttsCache.get(cacheKey));
    }

    if (voice.startsWith('google-') || !MsEdgeTTS) {
      const buf = await fetchGoogleMirrorBuffer(text, voice);
      if (ttsCache.size >= MAX_TTS_CACHE) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, buf);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buf);
    }

    const edgeVoice = voice.includes('NamMinh') ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
    const tts = new MsEdgeTTS();
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_Mono_MP3);
    res.setHeader('Content-Type', 'audio/mpeg');
    const readable = tts.toStream(text);
    const chunks = [];
    readable.on('data', chunk => chunks.push(Buffer.from(chunk)));
    readable.on('error', () => {
      try { res.end(); } catch (e) {}
    });
    readable.on('end', () => {
      const fullBuf = Buffer.concat(chunks);
      if (fullBuf.length > 128) {
        if (ttsCache.size >= MAX_TTS_CACHE) {
          const firstKey = ttsCache.keys().next().value;
          if (firstKey) ttsCache.delete(firstKey);
        }
        ttsCache.set(cacheKey, fullBuf);
      }
    });
    readable.pipe(res);
  } catch (err) {
    res.status(500).end();
  }
});

// ================= CẤU HÌNH KẾT NỐI TIKTOK LIVE =================
let TIKTOK_USERNAME = (process.argv[2] || "ten_id_tiktok_cua_ban").replace(/^@+/, '').trim();
const CLOUD_RELAY_URL = "__CLOUD_RELAY_URL__";

let lastStatusPayload = {
  type: 'status',
  status: 'idle',
  username: TIKTOK_USERNAME !== 'ten_id_tiktok_cua_ban' ? TIKTOK_USERNAME : '',
  roomId: '',
  message: 'Chờ kết nối phòng Live...'
};

const sseClients = new Set();
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  sseClients.add(res);
  try {
    res.write(\`data: \${JSON.stringify(lastStatusPayload)}\\n\\n\`);
  } catch (e) {}
  req.on('close', () => sseClients.delete(res));
});

app.get('/status', (req, res) => {
  res.json({ ok: true, ...lastStatusPayload });
});

app.post('/connect', async (req, res) => {
  const user = String(req.body?.username || req.query?.username || '').replace(/^@+/, '').trim();
  if (!user) return res.status(400).json({ ok: false, error: 'Thiếu ID TikTok' });
  const result = await connectTikTok(user);
  if (result.ok) {
    res.json({ ok: true, roomId: result.roomId, username: user });
  } else {
    res.status(500).json({ ok: false, error: result.error || 'Không kết nối được phòng Live' });
  }
});

app.get('/connect', async (req, res) => {
  const user = String(req.query?.username || '').replace(/^@+/, '').trim();
  if (!user) return res.status(400).json({ ok: false, error: 'Thiếu ID TikTok' });
  const result = await connectTikTok(user);
  res.json(result);
});

app.post('/disconnect', async (req, res) => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeTiktok) {
    try {
      activeTiktok.removeAllListeners?.();
      await activeTiktok.disconnect?.();
    } catch (e) {}
    activeTiktok = null;
  }
  lastStatusPayload = {
    type: 'status',
    status: 'simulated',
    username: TIKTOK_USERNAME,
    roomId: '',
    message: 'Đã ngắt kết nối phiên Live'
  };
  broadcast(lastStatusPayload);
  res.json({ ok: true });
});

const httpServer8080 = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer8080, maxPayload: 100 * 1024 * 1024 });

httpServer8080.listen(8080, '0.0.0.0', () => {
  console.log('==========================================================');
  console.log('🚀 Bridge WebSocket TikTok Live: ws://localhost:8080 (hoặc ws://127.0.0.1:8080)');
  console.log('🔊 Server Giọng Đọc AI #3:       http://localhost:8080/tts');
  console.log('==========================================================');
});

const ttsServer3000 = http.createServer(app);
ttsServer3000.on('error', () => {});
ttsServer3000.listen(3000, '0.0.0.0');

function broadcast(data, excludeWs = null) {
  if (data && data.type === 'status') {
    lastStatusPayload = data;
  }
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === 1) {
      try { client.send(json); } catch (e) {}
    }
  });
  sseClients.forEach(res => {
    try { res.write(\`data: \${json}\\n\\n\`); } catch (e) {}
  });
  if (CLOUD_RELAY_URL && CLOUD_RELAY_URL.startsWith('http') && data.type !== 'ADMIN_SYNC') {
    fetch(\`\${CLOUD_RELAY_URL}/api/tiktok-webhook\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json
    }).catch(() => {});
  }
}

function getUserName(data) {
  const u = data?.user || data?.userDetails || data || {};
  return (
    u.nickname ||
    u.displayId ||
    u.uniqueId ||
    data?.nickname ||
    data?.displayId ||
    data?.uniqueId ||
    'Người Chơi'
  );
}

function getCommentText(data) {
  return (
    data?.content ||
    data?.comment ||
    data?.text ||
    data?.message ||
    data?.common?.displayText?.defaultPattern ||
    ''
  );
}

function getUserAvatar(data) {
  const u = data?.user || data?.userDetails || data || {};
  const candidates = [
    u.profilePictureUrl,
    u.avatarUrl,
    u.avatarThumb?.urlList?.[0],
    u.avatarThumb?.url?.[0],
    u.avatarThumb?.urls?.[0],
    u.avatarLarge?.urlList?.[0],
    u.avatarLarge?.url?.[0],
    u.avatarLarge?.urls?.[0],
    u.profilePicture?.urlList?.[0],
    u.profilePicture?.url?.[0],
    u.profilePicture?.urls?.[0],
    data?.profilePictureUrl,
    data?.avatarUrl,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c;
  }
  return null;
}

let activeTiktok = null;
let reconnectTimer = null;
let connectSeqId = 0;

async function loadTikTokConnectorPkg() {
  try {
    return require('tiktok-live-connector');
  } catch (e) {
    return await import('tiktok-live-connector');
  }
}

async function connectTikTok(customUser) {
  if (customUser) {
    TIKTOK_USERNAME = String(customUser).replace(/^@+/, '').trim();
  }
  if (!TIKTOK_USERNAME || TIKTOK_USERNAME === 'ten_id_tiktok_cua_ban') {
    console.log('ℹ️ [CHỜ ID TIKTOK] Hãy sửa TIKTOK_USERNAME trong server.js hoặc nhập ID TikTok trên Web Game rồi bấm Kết nối!');
    return { ok: false, error: 'Chưa nhập ID TikTok' };
  }

  const mySeq = ++connectSeqId;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeTiktok) {
    try {
      activeTiktok.removeAllListeners?.();
      await activeTiktok.disconnect?.();
    } catch (e) {}
    activeTiktok = null;
  }

  if (mySeq !== connectSeqId) {
    return { ok: true, roomId: 'SUPERSEDED' };
  }

  const targetUser = TIKTOK_USERNAME;

  try {
    const pkg = await loadTikTokConnectorPkg();
    if (mySeq !== connectSeqId) {
      return { ok: true, roomId: 'SUPERSEDED' };
    }
    if (pkg.RoomIdRouteConfig) {
      pkg.RoomIdRouteConfig.skipFetchRoomInfoFromHtmlRoute = true;
    } else if (pkg.default?.RoomIdRouteConfig) {
      pkg.default.RoomIdRouteConfig.skipFetchRoomInfoFromHtmlRoute = true;
    }

    const TikTokConnector =
      pkg.TikTokLiveConnection ||
      pkg.default?.TikTokLiveConnection ||
      pkg.WebcastPushConnection ||
      pkg.default?.WebcastPushConnection;

    console.log(\`⏳ [ĐANG KẾT NỐI] Đang vào phòng Live TikTok: @\${targetUser}...\`);
    broadcast({
      type: 'status',
      status: 'connecting',
      username: targetUser,
      roomId: '',
      message: \`Đang kết nối @\${targetUser}...\`
    });

    const tiktok = new TikTokConnector(targetUser, {
      processInitialData: false,
      enableExtendedGiftInfo: false,
      fetchRoomInfoOnConnect: false,
    });

    if (typeof tiktok.fetchAvailableGifts === 'function') {
      tiktok.fetchAvailableGifts = async () => [];
    }

    if (typeof tiktok.processProtoMessageFetchResult === 'function') {
      const origProcess = tiktok.processProtoMessageFetchResult.bind(tiktok);
      tiktok.processProtoMessageFetchResult = async function (fetchResult) {
        try {
          if (fetchResult && Array.isArray(fetchResult.messages)) {
            for (const m of fetchResult.messages) {
              const d = m?.decodedData?.data;
              if (d && typeof d === 'object') {
                if (!Array.isArray(d.ranksList)) d.ranksList = [];
                if (!Array.isArray(d.emotes)) d.emotes = [];
                if (!Array.isArray(d.emoteList)) d.emoteList = [];
                if (d.user && !Array.isArray(d.user.badgeList)) d.user.badgeList = [];
              }
            }
          }
          return await origProcess(fetchResult);
        } catch (err) {}
      };
    }

    activeTiktok = tiktok;

    const GIFT_ID_FALLBACK = {
      5655: { name: 'Rose', coins: 1 },
      5827: { name: 'Ice Cream Cone', coins: 1 },
      5269: { name: 'TikTok', coins: 1 },
      7934: { name: 'GG', coins: 1 },
      5487: { name: 'Finger Heart', coins: 5 },
      5658: { name: 'Perfume', coins: 20 },
      5660: { name: 'Doughnut', coins: 30 },
    };

    tiktok.on('chat', data => {
      if (activeTiktok !== tiktok) return;
      try {
        const username = getUserName(data);
        const comment = String(getCommentText(data) || '').trim();
        if (!comment) return;
        console.log(\`💬 [COMMENT] \${username}: \${comment}\`);
        broadcast({ type: 'chat', username, avatarUrl: getUserAvatar(data), comment });
      } catch (e) {}
    });

    tiktok.on('gift', data => {
      if (activeTiktok !== tiktok) return;
      try {
        const giftType =
          data?.gift?.type ??
          data?.giftType ??
          data?.gift?.giftType ??
          data?.giftDetails?.giftType;
        const rawRepeatEnd = data?.repeatEnd ?? data?.gift?.repeatEnd;
        const repeatEnd = Boolean(rawRepeatEnd);
        if (
          rawRepeatEnd === false ||
          rawRepeatEnd === 0 ||
          (giftType === 1 && !repeatEnd)
        ) {
          return;
        }

        const username = getUserName(data);
        const fallbackGift = GIFT_ID_FALLBACK[Number(data?.giftId)] || null;
        const diamondCount = Number(
          data?.gift?.diamondCount ??
          data?.giftDetails?.diamondCount ??
          data?.extendedGiftInfo?.diamond_count ??
          data?.diamondCount ??
          fallbackGift?.coins ??
          1
        ) || 1;
        const repeatCount = Math.max(1, Number(data?.repeatCount ?? data?.comboCount ?? 1) || 1);
        const giftName =
          data?.gift?.name ||
          data?.giftDetails?.giftName ||
          data?.extendedGiftInfo?.name ||
          data?.giftName ||
          fallbackGift?.name ||
          'Rose';
        const coins = Math.max(1, diamondCount * repeatCount);
        console.log(\`🎁 [QUÀ TẶNG] \${username} tặng \${giftName} x\${repeatCount} (\${coins} xu)\`);
        broadcast({
          type: 'gift',
          username,
          avatarUrl: getUserAvatar(data),
          giftName,
          diamondCount,
          coins,
          repeatCount,
          repeatEnd: true
        });
      } catch (e) {}
    });

    tiktok.on('like', data => {
      try {
        const username = getUserName(data);
        const likeCount = Math.max(1, Number(data?.count ?? data?.likeCount ?? data?.unmergedLikeCount ?? 1) || 1);
        broadcast({ type: 'like', username, avatarUrl: getUserAvatar(data), likeCount });
      } catch (e) {}
    });

    tiktok.on('member', data => {
      try {
        const username = getUserName(data);
        console.log(\`👋 [VÀO PHÒNG] \${username} đã vào phòng Live\`);
        broadcast({ type: 'member', username, avatarUrl: getUserAvatar(data) });
      } catch (e) {}
    });

    tiktok.on('error', err => {
      const msg = err?.exception?.message || err?.message || err?.info || String(err);
      console.warn('⚠️ [CẢNH BÁO TIKTOK]:', msg);
    });

    tiktok.on('disconnected', () => {
      if (activeTiktok !== tiktok) return;
      console.warn('🔄 [MẤT KẾT NỐI LIVE] Tự động kết nối lại sau 5 giây...');
      reconnectTimer = setTimeout(() => connectTikTok(), 5000);
    });

    const state = await tiktok.connect();
    const roomIdStr = String(state?.roomId || tiktok.roomId || 'OK');
    console.log(\`✅ [THÀNH CÔNG] Đã kết nối phòng Live @\${targetUser} (Room ID: \${roomIdStr})\`);
    broadcast({
      type: 'status',
      status: 'connected',
      username: targetUser,
      roomId: roomIdStr,
      message: \`Đã kết nối @\${targetUser} (Room: \${roomIdStr})\`
    });
    return { ok: true, roomId: roomIdStr };
  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error(\`❌ [LỖI KẾT NỐI @\${targetUser}]:\`, errMsg);
    broadcast({
      type: 'status',
      status: 'error',
      username: targetUser,
      roomId: '',
      message: \`Lỗi kết nối @\${targetUser}: \${errMsg}\`
    });
    reconnectTimer = setTimeout(() => connectTikTok(), 10000);
    return { ok: false, error: errMsg };
  }
}

const latestSyncCache = {};

wss.on('connection', ws => {
  try {
    ws.send(JSON.stringify(lastStatusPayload));
    for (const k of ['UPDATE_CONFIG', 'UPDATE_PROVINCES_STATE', 'SYNC_BGM_STATE']) {
      if (latestSyncCache[k]) {
        ws.send(JSON.stringify(latestSyncCache[k]));
      }
    }
  } catch (e) {}
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ADMIN_SYNC') {
        if (
          msg.action === 'UPDATE_CONFIG' ||
          msg.action === 'UPDATE_PROVINCES_STATE' ||
          msg.action === 'SYNC_BGM_STATE'
        ) {
          latestSyncCache[msg.action] = msg;
        }
        broadcast(msg, ws);
      } else if (msg.type === 'CONNECT_TIKTOK' && msg.username) {
        connectTikTok(msg.username);
      }
    } catch (e) {}
  });
});

connectTikTok();`;
