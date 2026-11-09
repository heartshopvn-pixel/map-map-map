import React from 'react';
import { Flower2, Gift, Sparkles } from 'lucide-react';
import { GameConfig } from '../../types/game';

interface TabEventProps {
  config: GameConfig;
  onUpdateConfig: (patch: Partial<GameConfig>) => void;
  onTriggerRandomGift: (isRose: boolean) => void;
}

export const TabEvent: React.FC<TabEventProps> = ({
  config,
  onUpdateConfig,
  onTriggerRandomGift,
}) => {
  return (
    <div className="space-y-3.5">
      <section className="p-3 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thiết Lập Điểm Sự Kiện Gửi Quà & Hoa Hồng</span>
          </h2>
        </div>

        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" />
                <span>1. Bình luận tên tỉnh (Gửi quà thường)</span>
              </div>
              <p className="text-[10.5px] text-stone-400 mt-0.5">
                Khi người xem bình luận tên tỉnh, cộng điểm về tỉnh đó
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={1}
                max={100}
                value={config.commentPoints}
                onChange={(e) =>
                  onUpdateConfig({
                    commentPoints: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="w-16 px-2 py-1 rounded bg-stone-900 border border-emerald-500/50 text-xs font-mono font-bold text-emerald-300 text-center"
              />
              <span className="text-xs text-stone-400">điểm</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTriggerRandomGift(false)}
            className="w-full py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 cursor-pointer transition"
          >
            Test Gửi Quà Thường (+{config.commentPoints} điểm)
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-rose-300 flex items-center gap-1">
                <Flower2 className="w-3.5 h-3.5" />
                <span>2. Gửi Hoa Hồng (Quà tặng TikTok Live)</span>
              </div>
              <p className="text-[10.5px] text-stone-400 mt-0.5">
                Khi người xem gửi Hoa hồng, đọc gửi hoa hồng và cộng điểm lớn
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={1}
                max={500}
                value={config.rosePoints}
                onChange={(e) =>
                  onUpdateConfig({
                    rosePoints: Math.max(1, parseInt(e.target.value, 10) || 5),
                  })
                }
                className="w-16 px-2 py-1 rounded bg-stone-900 border border-rose-500/50 text-xs font-mono font-bold text-rose-300 text-center"
              />
              <span className="text-xs text-stone-400">điểm</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTriggerRandomGift(true)}
            className="w-full py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-300 cursor-pointer transition"
          >
            Test Gửi Hoa Hồng (+{config.rosePoints} điểm)
          </button>
        </div>
      </section>
    </div>
  );
};
