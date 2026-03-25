import { useState, useEffect } from "react";
import { supabase } from "../supabase";

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

interface DaySummary {
  date: string;
  count: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Calendar({ selectedDate, onSelectDate }: Props) {
  const sel = new Date(selectedDate + "T12:00:00");
  const [viewYear, setViewYear] = useState(sel.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel.getMonth());
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});

  // Fetch change counts for the visible month
  useEffect(() => {
    async function fetchMonth() {
      const startDate = `${viewYear}-${pad(viewMonth + 1)}-01`;
      const endMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const endYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const endDate = `${endYear}-${pad(endMonth + 1)}-01`;

      const { data } = await supabase
        .from("code_changes")
        .select("date")
        .gte("date", startDate)
        .lt("date", endDate);

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((row: any) => {
          counts[row.date] = (counts[row.date] || 0) + 1;
        });
        setDayCounts(counts);
      }
    }
    fetchMonth();
  }, [viewYear, viewMonth]);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayStr();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  return (
    <div className="border border-white/[0.06] rounded-xl p-5 fade-in">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="text-white/20 hover:text-white/60 text-sm px-2 transition-colors"
        >
          ←
        </button>
        <span className="text-sm font-semibold text-white/60">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="text-white/20 hover:text-white/60 text-sm px-2 transition-colors"
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold text-white/20 uppercase tracking-wider py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-10" />;
          }

          const dateStr = toDateStr(viewYear, viewMonth, day);
          const count = dayCounts[dateStr] || 0;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const hasChanges = count > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`h-10 rounded-lg text-xs font-medium transition-all relative flex flex-col items-center justify-center gap-0.5
                ${isSelected
                  ? "bg-white/15 text-white border border-white/20"
                  : isToday
                  ? "bg-white/[0.04] text-white/70 border border-white/10"
                  : hasChanges
                  ? "text-white/60 hover:bg-white/[0.06]"
                  : "text-white/20 hover:bg-white/[0.03]"
                }`}
            >
              <span>{day}</span>
              {hasChanges && (
                <span
                  className={`text-[8px] font-bold font-mono leading-none ${
                    isSelected ? "text-white/70" : "text-white/30"
                  }`}
                >
                  {count}
                </span>
              )}
              {hasChanges && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-white/25" />
              )}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      {selectedDate !== today && (
        <button
          onClick={() => {
            onSelectDate(today);
            setViewYear(new Date().getFullYear());
            setViewMonth(new Date().getMonth());
          }}
          className="mt-3 w-full text-center text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors py-1"
        >
          Jump to Today
        </button>
      )}
    </div>
  );
}
