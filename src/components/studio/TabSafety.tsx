import React, { useState } from 'react';
import { Plus, RotateCcw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { SafetyActionMode, SafetyCategory, SafetyLogEntry } from '../../types/game';
import { inspectUserInteraction } from '../../services/safetyFilter';

interface TabSafetyProps {
  actionMode: SafetyActionMode;
  categories: SafetyCategory[];
  customWords: string[];
  logs: SafetyLogEntry[];
  onChangeActionMode: (mode: SafetyActionMode) => void;
  onToggleCategory: (key: string, enabled: boolean) => void;
  onAddCustomWords: (rawInput: string) => void;
  onRemoveCustomWord: (word: string) => void;
  onResetCustomWords: () => void;
  onClearLogs: () => void;
  onSpawnTrollTest: () => void;
}

export const TabSafety: React.FC<TabSafetyProps> = ({
  actionMode,
  categories,
  customWords,
  logs,
  onChangeActionMode,
  onToggleCategory,
  onAddCustomWords,
  onRemoveCustomWord,
  onResetCustomWords,
  onClearLogs,
  onSpawnTrollTest,
}) => {
  const [testName, setTestName] = useState('Châu Tinh Trùng');
  const [testPrayer, setTestPrayer] = useState(
    'v.c.l vào kubet đánh tài xỉu zalo 0987654321'
  );
  const [sandboxOutput, setSandboxOutput] = useState<string | null>(null);
  const [newWordInput, setNewWordInput] = useState('');

  const totalActivePatterns =
    customWords.length +
    categories.filter((c) => c.enabled).reduce((acc, c) => acc + c.words.length, 0);

  const handleRunSandbox = () => {
    const res = inspectUserInteraction(testName, testPrayer, actionMode, categories, customWords);
    if (res.nameViolated || res.prayerViolated) {
      setSandboxOutput(
        `Chặn từ "${res.matchedWord}" → Đổi thành: [${res.safeUsername}] ${
          res.allowed ? res.safePrayer : '(Không cho vào sân)'
        }`
      );
    } else {
      setSandboxOutput('An toàn 100% — Cho phép vào chùa & đọc TTS');
    }
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWordInput.trim()) return;
    onAddCustomWords(newWordInput);
    setNewWordInput('');
  };

  return (
    <div className="space-y-5">
      {/* Section 1: Action Mode Selector */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-stone-200">
            Chế độ xử lý vi phạm Tiêu chuẩn Cộng đồng
          </h2>
          <span className="text-[11px] text-emerald-400 font-mono tabular-nums">
            {totalActivePatterns} mẫu lọc
          </span>
        </div>

        <select
          value={actionMode}
          onChange={(e) => onChangeActionMode(e.target.value as SafetyActionMode)}
          className="w-full px-2.5 py-2 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-100 font-medium focus:outline-none focus:border-amber-500"
        >
          <option value="purify">
            1. Thanh hóa tâm linh (Đổi thành câu Sám Hối thiện lành - Khuyên dùng)
          </option>
          <option value="block">
            2. Chặn hoàn toàn (Không cho vào chùa + Không đọc TTS)
          </option>
          <option value="mask">
            3. Che dấu sao *** (Cho vào chùa nhưng che *** và tắt đọc TTS)
          </option>
        </select>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          Tên tài khoản chứa bẫy phát âm nhạy cảm sẽ tự động đổi thành{' '}
          <strong className="text-stone-200">Phật Tử Thiện Lành</strong> để bảo vệ luồng Live.
        </p>
      </section>

      <hr className="border-stone-800/80" />

      {/* Section 2: Sandbox Filter Tester */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-stone-200">Kiểm tra thử bộ lọc (Sandbox)</h2>
          <button
            type="button"
            onClick={onSpawnTrollTest}
            className="px-2.5 py-1 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-medium text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Thử thả 1 Troll vào sân</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Tên test..."
            className="col-span-1 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-200"
          />
          <input
            type="text"
            value={testPrayer}
            onChange={(e) => setTestPrayer(e.target.value)}
            placeholder="Câu bình luận test..."
            className="col-span-2 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-200"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleRunSandbox}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-100 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>Quét kiểm tra</span>
          </button>
          {sandboxOutput && (
            <div className="text-[11px] text-amber-300 truncate text-right">{sandboxOutput}</div>
          )}
        </div>
      </section>

      <hr className="border-stone-800/80" />

      {/* Section 3: 6 Default Dictionary Categories */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-stone-200">6 Nhóm từ điển cấm mặc định</h2>
        <div className="divide-y divide-stone-800/70 rounded-lg border border-stone-800 bg-stone-900/40">
          {categories.map((cat) => (
            <label
              key={cat.key}
              className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-stone-900/80 transition"
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={cat.enabled}
                  onChange={(e) => onToggleCategory(cat.key, e.target.checked)}
                  className="accent-emerald-500 w-3.5 h-3.5 rounded"
                />
                <span className="text-stone-200 font-medium">{cat.name}</span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono tabular-nums">
                {cat.words.length} từ
              </span>
            </label>
          ))}
        </div>
      </section>

      <hr className="border-stone-800/80" />

      {/* Section 4: Custom Banned Words */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-stone-200">Từ cấm bổ sung của riêng bạn</h2>
          <button
            type="button"
            onClick={onResetCustomWords}
            className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>

        <form onSubmit={handleAddWord} className="flex gap-2">
          <input
            type="text"
            value={newWordInput}
            onChange={(e) => setNewWordInput(e.target.value)}
            placeholder="Nhập từ cấm (cách nhau dấu phẩy)..."
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-white text-stone-950 font-semibold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {customWords.length === 0 ? (
            <span className="text-[11px] text-stone-500">Chưa có từ tùy chỉnh nào.</span>
          ) : (
            customWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300 text-[11px]"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCustomWord(word)}
                  className="text-stone-500 hover:text-rose-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </section>

      <hr className="border-stone-800/80" />

      {/* Section 5: Violation Logs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-stone-200">
            Nhật ký đã chặn / thanh hóa ({logs.length})
          </h2>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="text-[11px] text-stone-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa nhật ký</span>
            </button>
          )}
        </div>

        <div className="max-h-36 overflow-y-auto divide-y divide-stone-800/60 rounded-lg border border-stone-800 bg-stone-900/40 text-[11px]">
          {logs.length === 0 ? (
            <div className="py-4 text-center text-stone-500">
              Chưa có bình luận vi phạm nào trong phiên này.
            </div>
          ) : (
            logs.map((item) => (
              <div key={item.id} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="text-stone-300">
                  <strong className="text-amber-300 font-semibold">[{item.user}]</strong>{' '}
                  {item.detail}
                </div>
                <span className="text-stone-500 font-mono tabular-nums shrink-0">
                  {item.time}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
