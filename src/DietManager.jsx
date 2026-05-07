import { useEffect, useMemo, useState } from "react";
import {
  Coffee,
  ExternalLink,
  Footprints,
  Plus,
  Minus,
  RotateCcw,
  ShoppingCart,
  Package,
  AlertTriangle,
  Calendar,
  Trash2,
  ChefHat,
  Trophy,
  ArrowRight,
  X,
  Check,
  Camera,
  Sparkles,
  Loader2,
  Pencil,
  PlusCircle,
} from "lucide-react";

import { FOODS, GROCERY_CATEGORIES, TEMPLATES, SAIDUR_PROFILE, cloneTemplate } from "./profiles.js";
import { analyzeFoodPhoto, fileToResizedBase64 } from "./aiVision.js";


/* ============================================================
   HELPERS
============================================================ */

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartKey(ref = new Date()) {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function weekDateKeys() {
  const start = new Date(weekStartKey());
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function calcMeal(items) {
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let hasDirect = false;
  for (const it of items || []) {
    if (it.direct) {
      hasDirect = true;
      const a = it.amount ?? 1;
      kcal += (it.direct.kcal || 0) * a;
      protein += (it.direct.protein || 0) * a;
      fat += (it.direct.fat || 0) * a;
      carbs += (it.direct.carbs || 0) * a;
      continue;
    }
    const f = FOODS[it.food];
    if (!f) continue;
    kcal += f.kcal * it.amount;
    protein += f.protein * it.amount;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    hasDirect,
  };
}

function calcDayTotals(meals, baselineKcal = 1019) {
  let kcal = 0;
  let protein = 0;
  let cheats = 0;
  let surplus = 0;
  for (const m of Object.values(meals || {})) {
    if (!m?.items) continue;
    const c = calcMeal(m.items);
    kcal += c.kcal;
    protein += c.protein;
    if (m.isCheat) {
      cheats += 1;
      surplus += Math.max(0, c.kcal - baselineKcal);
    }
  }
  return { kcal, protein: Math.round(protein * 10) / 10, cheats, surplus };
}

function calcWeekTotals(allDays) {
  return allDays.reduce(
    (acc, day) => ({
      cheatCount: acc.cheatCount + (day.cheats || 0),
      weeklySurplus: acc.weeklySurplus + (day.surplus || 0),
      trainingsCompleted:
        acc.trainingsCompleted + (["push", "pull", "legs"].includes(day.training) ? 1 : 0),
      footballCount: acc.footballCount + (day.training === "football" ? 1 : 0),
      totalKcal: acc.totalKcal + (day.kcal || 0),
      totalProtein: acc.totalProtein + (day.protein || 0),
      totalSteps: acc.totalSteps + (day.steps || 0),
      daysWithSteps: acc.daysWithSteps + (day.steps != null ? 1 : 0),
      daysLogged: acc.daysLogged + (day.kcal > 0 ? 1 : 0),
    }),
    {
      cheatCount: 0,
      weeklySurplus: 0,
      trainingsCompleted: 0,
      footballCount: 0,
      totalKcal: 0,
      totalProtein: 0,
      totalSteps: 0,
      daysWithSteps: 0,
      daysLogged: 0,
    },
  );
}

function targetForDay(profile, dayType, steps) {
  const dayTypes = profile?.dayTypes || [];
  const proteinTarget = profile?.proteinTarget ?? 150;
  const sa = profile?.stepAdjust || {};
  const lowT = sa.lowThreshold ?? 8000;
  const highT = sa.highThreshold ?? 12000;
  const lowD = sa.lowDelta ?? -100;
  const highD = sa.highDelta ?? 100;

  const base = dayTypes.find((d) => d.id === dayType)?.target ?? (dayTypes[0]?.target ?? 2400);
  let adj = 0;
  if (steps != null && steps !== "") {
    const n = Number(steps);
    if (!Number.isNaN(n)) {
      if (n < lowT) adj = lowD;
      else if (n > highT) adj = highD;
    }
  }
  return { kcal: base + adj, protein: proteinTarget };
}

function weeklyCompensation(weekData) {
  const { cheatCount, weeklySurplus, trainingsCompleted, footballCount } = weekData;
  const totalActive = trainingsCompleted + footballCount;

  if (cheatCount === 0 && weeklySurplus <= 0) {
    return { status: "perfect", message: "Clean week. Keep going." };
  }
  if (cheatCount <= 1 && weeklySurplus < 700) {
    return { status: "fine", message: "1 cheat is sustainable. No action needed." };
  }
  if (cheatCount <= 3 && weeklySurplus < 1500) {
    return {
      status: "watch",
      message: `${weeklySurplus} kcal weekly surplus. Cut 200 kcal/day next week OR add cardio.`,
      actions: [
        "Skip rice on 2 lunches next week",
        "Skip shake on 2 days",
        "Add 30 min cardio after one PPL session",
        "Play one extra football session",
      ],
    };
  }
  if (cheatCount > 3 || weeklySurplus >= 1500) {
    return {
      status: "off-track",
      message: "Off-plan week. Reset Monday with a clean slate.",
      actions: [
        "All standard meals next week",
        "Hit 3/3 PPL training",
        "Play 3 football sessions",
        "No cheat meals next week",
      ],
    };
  }
  if (totalActive < 3) {
    return {
      status: "training-low",
      message: `Only ${totalActive} active days. Aim for 3 PPL + 2 football next week.`,
    };
  }
  return { status: "default", message: "On track." };
}

function decBy(grocery, key, amount) {
  const item = grocery.find((g) => g.key === key);
  if (!item) return;
  item.currentQty = Math.max(0, item.currentQty - amount);
}

// Convert (foodKey, amount) into per-grocery-item deltas.
function ingredientDeltas(item) {
  const food = FOODS[item.food];
  if (!food) return [];
  const a = item.amount;
  switch (food.key) {
    case "rice":          return [{ key: "rice", amount: a / 3 }];                         // cooked → raw
    case "khichuri_mix":  return [{ key: "rice", amount: a * 0.32 }, { key: "dal", amount: a * 0.16 }];
    case "tehari_rice":   return [{ key: "rice", amount: a / 3 }, { key: "ghee", amount: a * 0.04 }];
    case "bhuna_oil":     return [{ key: "oil", amount: a * 15 }];                         // tbsp → ml
    case "ghee":          return [{ key: "ghee", amount: a * 14 }];                        // tbsp → g
    default:
      return food.groceryKey ? [{ key: food.groceryKey, amount: a }] : [];
  }
}

function applyMealDecrement(grocery, items) {
  const updated = grocery.map((g) => ({ ...g }));
  for (const it of items || []) {
    for (const d of ingredientDeltas(it)) {
      decBy(updated, d.key, d.amount);
    }
  }
  return updated;
}

function lowStockItems(grocery) {
  return grocery.filter((g) => g.currentQty <= g.lowThreshold && !g.optional);
}

function generateShoppingList(plannedMeals, currentInventory) {
  const needed = {};
  for (const day of Object.values(plannedMeals || {})) {
    if (!day) continue;
    for (const slot of Object.values(day)) {
      if (!slot?.items) continue;
      for (const it of slot.items) {
        for (const d of ingredientDeltas(it)) {
          needed[d.key] = (needed[d.key] || 0) + d.amount;
        }
      }
    }
  }
  const shopping = [];
  for (const item of currentInventory) {
    const need = needed[item.key] || 0;
    const shortage = need - item.currentQty;
    if (shortage > 0) {
      const packets = Math.ceil(shortage / item.packetSize);
      shopping.push({
        ...item,
        needed: Math.round(need),
        haveCurrently: Math.round(item.currentQty),
        toBuy: packets * item.packetSize,
        packets,
      });
    }
  }
  return shopping;
}

function freshGrocery(template = []) {
  return template.map((g) => ({ ...g, currentQty: g.initialQty }));
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtDate(key) {
  const d = new Date(key);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDay(key) {
  return new Date(key).toLocaleDateString(undefined, { weekday: "short" });
}

/* ============================================================
   STORAGE WRAPPERS (always try/catch; .get throws on miss)
============================================================ */

async function loadKey(key, fallback = null) {
  try {
    return await window.storage.get(key);
  } catch {
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    await window.storage.set(key, value);
  } catch {
    /* silent */
  }
}

async function removeKey(key) {
  try {
    await window.storage.remove(key);
  } catch {
    /* silent */
  }
}

/* ============================================================
   SUB-COMPONENTS
============================================================ */

function Masthead({ date, profile }) {
  const d = new Date(date);
  const dateLong = d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const stats = profile?.stats || {};
  const statBits = [stats.heightDisplay, stats.weightKg ? `${stats.weightKg}kg` : null].filter(Boolean);
  const subtitle =
    [`A kitchen journal`, profile?.name, statBits.join(" / ")].filter(Boolean).join(" · ");
  return (
    <header className="border-b-2 border-ink pb-3 mb-6">
      <div className="flex items-end justify-between text-[10px] tracking-[0.2em] font-mono uppercase text-ink-muted">
        <div>No. {date}</div>
        <div>Vol. I</div>
      </div>
      <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-none mt-1">
        The Daily Plate
      </h1>
      <div className="flex items-center justify-between mt-2 text-[10px] tracking-[0.2em] font-mono uppercase text-ink-muted gap-3">
        <div className="italic font-display truncate">{subtitle}</div>
        <div className="shrink-0">{dateLong}</div>
      </div>
      <div className="border-t border-ink/40 mt-3" />
      <div className="border-t border-ink/40 mt-[2px]" />
    </header>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "today",   label: "Today" },
    { id: "week",    label: "Week" },
    { id: "cheat",   label: "Cheat" },
    { id: "grocery", label: "Grocery" },
    { id: "profile", label: "Profile" },
    { id: "build",   label: "Build" },
  ];
  return (
    <nav className="border-y border-ink mb-6">
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              onClick={() => setTab(t.id)}
              className={`w-full py-3 px-1 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.25em] transition-colors ${
                tab === t.id
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-ink/5"
              }`}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TrainingDayBadge({ trainingDay, onChange, dayTypes = [], workoutAppUrl }) {
  const types = dayTypes;
  const current = types.find((t) => t.id === trainingDay) || null;
  const cycle = () => {
    if (!types.length) return;
    if (!current) return onChange(types[0].id);
    const idx = types.findIndex((t) => t.id === trainingDay);
    onChange(types[(idx + 1) % types.length].id);
  };
  return (
    <div className="border-2 border-ink p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Today's training
        </span>
        {workoutAppUrl ? (
          <a
            href={workoutAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.2em] flex items-center gap-1 hover:text-accent"
          >
            Workout app <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
      <button
        onClick={cycle}
        className="w-full text-left flex items-center gap-4 group"
      >
        <span className="text-5xl md:text-6xl select-none">
          {current ? current.icon : "·"}
        </span>
        <span className="flex-1">
          <span
            className="block font-display text-3xl md:text-4xl font-black tracking-tight leading-none"
            style={{ color: current?.color || "#2a2419" }}
          >
            {current ? current.label : "Pick a day type"}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-1">
            {current ? `${current.target} kcal base · tap to cycle` : "Tap to set"}
          </span>
        </span>
      </button>
      <div className="flex flex-wrap gap-2 mt-4">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] border ${
              trainingDay === t.id
                ? "bg-ink text-paper border-ink"
                : "border-ink/30 hover:border-ink"
            }`}
            style={
              trainingDay === t.id
                ? { backgroundColor: t.color, borderColor: t.color, color: "#f4ede0" }
                : undefined
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepCounter({ steps, setSteps }) {
  const adjust = (delta) => {
    const cur = Number(steps) || 0;
    setSteps(Math.max(0, cur + delta));
  };
  const n = steps == null || steps === "" ? null : Number(steps);
  let badge = "—";
  let badgeColor = "#6b5a3e";
  if (n != null) {
    if (n < 8000) {
      badge = "−100";
      badgeColor = "#c44827";
    } else if (n > 12000) {
      badge = "+100";
      badgeColor = "#4a6b3e";
    } else {
      badge = "±0";
      badgeColor = "#6b5a3e";
    }
  }
  return (
    <div className="border border-ink p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted flex items-center gap-2">
          <Footprints size={12} /> Steps today
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: badgeColor }}>
          target {badge} kcal
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => adjust(-1000)}
          className="px-3 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
        >
          −1k
        </button>
        <input
          type="number"
          value={steps ?? ""}
          onChange={(e) => setSteps(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="0"
          className="flex-1 font-display text-3xl font-black bg-paper border-b-2 border-ink py-1 px-2 focus:outline-none"
        />
        <button
          onClick={() => adjust(1000)}
          className="px-3 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
        >
          +1k
        </button>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-2">
        baseline 10,000 · {n != null ? n.toLocaleString() : "—"} logged
      </div>
    </div>
  );
}

function MacroCard({ label, value, target, unit, accent }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target && value > target;
  return (
    <div className="border-2 border-ink p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          / {fmtNum(target)} {unit}
        </span>
      </div>
      <div className="font-display text-5xl md:text-6xl font-black leading-none" style={{ color: accent }}>
        {fmtNum(value)}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-1">
        {unit}
      </div>
      <div className="mt-3 h-px bg-ink/20 relative">
        <div
          className="absolute left-0 top-0 h-px transition-all"
          style={{ width: `${pct}%`, backgroundColor: over ? "#c44827" : accent }}
        />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] mt-1 flex justify-between">
        <span style={{ color: accent }}>{Math.round(pct)}%</span>
        <span className="text-ink-muted">
          {target ? (over ? `+${fmtNum(value - target)} over` : `${fmtNum(target - value)} to go`) : "—"}
        </span>
      </div>
    </div>
  );
}

function CoffeeTracker({ coffee, setCoffee, schedule = [] }) {
  if (!schedule.length) return null;
  const toggle = (i) => {
    const next = [...coffee];
    next[i] = !next[i];
    setCoffee(next);
  };
  const lastNote = schedule[schedule.length - 1]?.note;
  return (
    <div className="border border-ink p-4">
      <div className="flex items-center gap-2 mb-3">
        <Coffee size={14} />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Coffee schedule</span>
      </div>
      <ul className="space-y-2">
        {schedule.map((c, i) => (
          <li key={i} className="flex items-center gap-3">
            <button
              onClick={() => toggle(i)}
              className={`w-5 h-5 border-2 border-ink flex items-center justify-center ${
                coffee[i] ? "bg-ink text-paper" : "bg-paper"
              }`}
              aria-label={c.label}
            >
              {coffee[i] ? <Check size={12} strokeWidth={3} /> : null}
            </button>
            <div className="flex-1 flex items-baseline justify-between">
              <span className={`font-display text-lg ${coffee[i] ? "line-through text-ink-muted" : ""}`}>
                {c.label}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                {c.time}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {lastNote ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-3 italic">
          {lastNote}
        </div>
      ) : null}
    </div>
  );
}

function MealSlot({
  slot,
  label,
  meal,
  presets,
  suggestedPresetKey,
  onSelect,
  onClear,
  onCheatPrompt,
}) {
  const totals = meal ? calcMeal(meal.items) : null;
  const showCheatLink = slot === "lunch" && !meal;

  return (
    <div className="border-2 border-ink p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-2xl font-black tracking-tight">{label}</h3>
        {showCheatLink ? (
          <button
            onClick={onCheatPrompt}
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent hover:underline"
          >
            🍕 Cheat?
          </button>
        ) : meal ? (
          <button
            onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted hover:text-accent flex items-center gap-1"
          >
            <X size={11} /> Clear
          </button>
        ) : null}
      </div>

      {meal ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl select-none">{meal.icon || "·"}</span>
            <div className="flex-1">
              <div className="font-display text-xl font-bold leading-tight">
                {meal.name}
                {meal.isCheat ? (
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.2em] text-accent border border-accent px-1.5 py-0.5">
                    Cheat
                  </span>
                ) : null}
              </div>
              {meal.note ? (
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                  {meal.note}
                </div>
              ) : null}
            </div>
          </div>
          <ul className="text-sm space-y-1 mb-3">
            {meal.items.map((it, i) => {
              if (it.direct) {
                const a = it.amount ?? 1;
                const display = it.direct.displayName || "Custom item";
                return (
                  <li key={i} className="flex justify-between font-body">
                    <span>
                      {display}
                      {it.direct.confidence ? (
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                          ai · {it.direct.confidence}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[11px]">
                      {a} {it.direct.unit || "serving"}
                    </span>
                  </li>
                );
              }
              const f = FOODS[it.food];
              return (
                <li key={i} className="flex justify-between font-body">
                  <span>{f?.display || it.food}</span>
                  <span className="font-mono text-[11px]">
                    {it.amount} {f?.unit}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-ink/20 pt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
            <span style={{ color: "#c44827" }}>{totals.kcal} kcal</span>
            <span>{totals.protein}g protein</span>
          </div>
          {totals.hasDirect && (totals.fat || totals.carbs) ? (
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-1">
              <span>{totals.fat}g fat</span>
              <span>{totals.carbs}g carbs</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
            Quick add
          </div>
          {Object.values(presets || {}).length === 0 ? (
            <div className="font-body italic text-sm text-ink-muted">
              No presets yet — use the Build tab to create one.
            </div>
          ) : null}
          <div className="space-y-2">
            {Object.values(presets || {}).map((p) => {
              const c = calcMeal(p.items);
              const recommended = suggestedPresetKey && p.key === suggestedPresetKey;
              return (
                <button
                  key={p.key}
                  onClick={() => onSelect(p)}
                  className={`w-full text-left border p-3 hover:bg-ink hover:text-paper transition-colors group ${
                    recommended ? "border-accent bg-accent/5" : "border-ink/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div className="flex-1">
                      <div className="font-display text-base font-bold flex items-center gap-2">
                        {p.name}
                        {recommended ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent group-hover:text-paper">
                            ★ Suggested
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted group-hover:text-paper/70">
                        {c.kcal} kcal · {c.protein}g protein
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LowStockBanner({ items, onView }) {
  if (!items.length) return null;
  const top = items.slice(0, 3);
  return (
    <div className="border-2 border-accent bg-accent/5 p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertTriangle size={16} className="text-accent shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
            Running low
          </div>
          <div className="font-display text-base truncate">
            {top.map((i) => i.name).join(", ")}
            {items.length > 3 ? ` · +${items.length - 3} more` : ""}
          </div>
        </div>
      </div>
      <button
        onClick={onView}
        className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent hover:underline flex items-center gap-1 shrink-0"
      >
        View grocery <ArrowRight size={11} />
      </button>
    </div>
  );
}

function stepFor(unit) {
  switch (unit) {
    case "g":
    case "ml":
      return 25;
    case "pc":
    case "slice":
      return 1;
    case "tbsp":
    case "tsp":
    case "cup":
      return 0.5;
    default:
      return 1;
  }
}

function CheatMealCard({ preset, onLog }) {
  const [version, setVersion] = useState("original");
  const [customByVersion, setCustomByVersion] = useState({});
  const v = preset.versions[version];

  const customAmounts = customByVersion[version] || {};
  const items = v.items.map((it, i) => ({
    ...it,
    amount: customAmounts[i] != null ? customAmounts[i] : it.amount,
  }));
  const isCustomized = Object.keys(customAmounts).length > 0;
  const totals = calcMeal(items);

  function setAmount(idx, value) {
    const n = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setCustomByVersion((prev) => ({
      ...prev,
      [version]: { ...(prev[version] || {}), [idx]: n },
    }));
  }
  function adjust(idx, delta) {
    const cur = items[idx].amount;
    setAmount(idx, cur + delta);
  }
  function resetVersion() {
    setCustomByVersion((prev) => ({ ...prev, [version]: {} }));
  }

  return (
    <div className="border-2 border-ink p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl select-none">{preset.icon}</span>
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight leading-tight">
            {preset.name}
          </h3>
          {preset.note ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              {preset.note}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex border border-ink mb-3">
        {Object.entries(preset.versions).map(([k, val]) => (
          <button
            key={k}
            onClick={() => setVersion(k)}
            className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${
              version === k ? "bg-ink text-paper" : "hover:bg-ink/5"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {v.note ? (
        <div className="font-body italic text-sm text-ink-muted mb-2">{v.note}</div>
      ) : null}

      <ul className="text-sm space-y-2 mb-3">
        {items.map((it, i) => {
          const f = FOODS[it.food];
          const step = stepFor(f?.unit);
          return (
            <li key={i} className="flex items-center gap-2 font-body">
              <span className="flex-1 min-w-0 truncate">{f?.display || it.food}</span>
              <button
                type="button"
                onClick={() => adjust(i, -step)}
                className="w-6 h-6 border border-ink/40 flex items-center justify-center hover:bg-ink hover:text-paper"
                aria-label="Decrease"
              >
                <Minus size={11} />
              </button>
              <input
                type="number"
                value={it.amount}
                min={0}
                step={step}
                onChange={(e) => setAmount(i, e.target.value)}
                className="w-16 border border-ink/40 bg-paper px-1 py-0.5 font-mono text-[11px] text-right focus:outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() => adjust(i, step)}
                className="w-6 h-6 border border-ink/40 flex items-center justify-center hover:bg-ink hover:text-paper"
                aria-label="Increase"
              >
                <Plus size={11} />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted w-9">
                {f?.unit}
              </span>
            </li>
          );
        })}
      </ul>

      {isCustomized ? (
        <button
          onClick={resetVersion}
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted hover:text-accent flex items-center gap-1 mb-2"
        >
          <RotateCcw size={11} /> Reset to original portions
        </button>
      ) : null}

      <div className="border-t border-ink/20 pt-2 mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
        <span style={{ color: "#c44827" }}>{totals.kcal} kcal</span>
        <span>{totals.protein}g protein</span>
      </div>

      <button
        onClick={() => onLog(preset, version, items)}
        className="w-full py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent"
      >
        Log as lunch{isCustomized ? " (customized)" : ""}
      </button>
    </div>
  );
}

function GroceryRow({ item, onAdjust, onRestock, onEdit, onDelete }) {
  const low = item.currentQty <= item.lowThreshold;
  const out = item.currentQty <= 0;
  const max = Math.max(item.initialQty, item.currentQty, item.packetSize);
  const pct = max > 0 ? Math.min(100, (item.currentQty / max) * 100) : 0;
  return (
    <div
      className={`border p-3 ${
        out ? "border-accent bg-accent/10" : low ? "border-accent" : "border-ink/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl select-none">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base font-bold leading-tight flex items-center gap-2">
            {item.name}
            {out ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper bg-accent px-1.5 py-0.5">
                Out
              </span>
            ) : low ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent border border-accent px-1.5 py-0.5">
                Low
              </span>
            ) : null}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
            {Math.round(item.currentQty)} {item.unit} · low at {item.lowThreshold} · packet {item.packetSize}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <button
          onClick={() => onAdjust(item.key, -item.packetSize)}
          className="w-7 h-7 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
          title={`-${item.packetSize}`}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => onAdjust(item.key, item.packetSize)}
          className="w-7 h-7 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
          title={`+${item.packetSize}`}
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => onRestock(item.key)}
          className="px-2 py-1 border border-ink font-mono text-[9px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
        >
          Restock
        </button>
        <span className="flex-1" />
        {onEdit ? (
          <button
            onClick={() => onEdit(item)}
            className="w-7 h-7 border border-ink/40 flex items-center justify-center hover:bg-ink hover:text-paper"
            title="Edit"
            aria-label="Edit"
          >
            <Pencil size={12} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            onClick={() => onDelete(item)}
            className="w-7 h-7 border border-ink/40 flex items-center justify-center hover:bg-accent hover:text-paper hover:border-accent"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
      <div className="mt-2 h-px bg-ink/20 relative">
        <div
          className="absolute left-0 top-0 h-px transition-all"
          style={{ width: `${pct}%`, backgroundColor: low ? "#c44827" : "#2a2419" }}
        />
      </div>
    </div>
  );
}

function FoodPicker({ onAdd }) {
  const [foodKey, setFoodKey] = useState(Object.keys(FOODS)[0]);
  const [amount, setAmount] = useState(100);
  const preview = calcMeal([{ food: foodKey, amount: Number(amount) || 0 }]);
  return (
    <div className="border border-ink p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
        Add ingredient
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={foodKey}
          onChange={(e) => setFoodKey(e.target.value)}
          className="border border-ink bg-paper px-2 py-2 font-body text-base md:col-span-2"
        >
          {Object.values(FOODS).map((f) => (
            <option key={f.key} value={f.key}>
              {f.display} ({f.unit})
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
          className="border border-ink bg-paper px-2 py-2 font-display text-lg"
        />
      </div>
      <div className="flex justify-between items-center mt-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          {preview.kcal} kcal · {preview.protein}g protein
        </div>
        <button
          onClick={() => onAdd({ food: foodKey, amount: Math.max(0, Number(amount) || 0) })}
          disabled={!Number(amount)}
          className="px-3 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function DietManager() {
  const [tab, setTab] = useState("today");
  const [date] = useState(todayKey());
  const [profile, setProfile] = useState(SAIDUR_PROFILE);
  const [apiKey, setApiKey] = useState("");
  const [trainingDay, setTrainingDay] = useState(null);
  const [steps, setSteps] = useState(null);
  const [meals, setMeals] = useState({ lunch: null, shake: null, dinner: null });
  const [coffee, setCoffee] = useState(() =>
    new Array(SAIDUR_PROFILE.coffeeSchedule.length).fill(false),
  );
  const [grocery, setGrocery] = useState(() => freshGrocery(SAIDUR_PROFILE.groceryTemplate));
  const [weekDays, setWeekDays] = useState([]);
  const [plannedWeek, setPlannedWeek] = useState({});
  const [manualShopping, setManualShopping] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ----- Initial load ----- */
  useEffect(() => {
    (async () => {
      const profileStored = await loadKey("profile:current", null);
      const activeProfile = profileStored && typeof profileStored === "object"
        ? profileStored
        : SAIDUR_PROFILE;
      setProfile(activeProfile);

      const storedKey = await loadKey("apiKey:anthropic", "");
      if (typeof storedKey === "string") setApiKey(storedKey);

      const coffeeLen = (activeProfile.coffeeSchedule || []).length;
      const todayMeals = await loadKey(`meals:${date}`, { meals: { lunch: null, shake: null, dinner: null } });
      const todayCoffee = await loadKey(`coffee:${date}`, new Array(coffeeLen).fill(false));
      const todayTraining = await loadKey(`training:${date}`, null);
      const todaySteps = await loadKey(`steps:${date}`, null);
      const groceryStored = await loadKey("grocery:current", null);
      const planStored = await loadKey("plan:current_week", null);
      const manualStored = await loadKey("shopping:manual", []);

      if (todayMeals?.meals) setMeals(todayMeals.meals);
      if (Array.isArray(todayCoffee) && todayCoffee.length === coffeeLen) {
        setCoffee(todayCoffee);
      } else {
        setCoffee(new Array(coffeeLen).fill(false));
      }
      setTrainingDay(todayTraining);
      setSteps(todaySteps);
      setGrocery(
        Array.isArray(groceryStored) && groceryStored.length
          ? groceryStored
          : freshGrocery(activeProfile.groceryTemplate),
      );
      if (planStored) setPlannedWeek(planStored);
      if (Array.isArray(manualStored)) setManualShopping(manualStored);

      // Load last 7 days for week tab
      await reloadWeek(activeProfile);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- Save effects ----- */
  useEffect(() => {
    if (!loading) saveKey("profile:current", profile);
  }, [profile, loading]);
  useEffect(() => {
    if (!loading) saveKey("apiKey:anthropic", apiKey);
  }, [apiKey, loading]);
  useEffect(() => {
    if (!loading) saveKey(`meals:${date}`, { meals });
  }, [meals, date, loading]);
  useEffect(() => {
    if (!loading) saveKey(`coffee:${date}`, coffee);
  }, [coffee, date, loading]);
  useEffect(() => {
    if (!loading) saveKey(`training:${date}`, trainingDay);
  }, [trainingDay, date, loading]);
  useEffect(() => {
    if (!loading) saveKey(`steps:${date}`, steps);
  }, [steps, date, loading]);
  useEffect(() => {
    if (!loading) saveKey("grocery:current", grocery);
  }, [grocery, loading]);
  useEffect(() => {
    if (!loading) saveKey("plan:current_week", plannedWeek);
  }, [plannedWeek, loading]);
  useEffect(() => {
    if (!loading) saveKey("shopping:manual", manualShopping);
  }, [manualShopping, loading]);

  /* ----- Cheat day surplus persistence ----- */
  useEffect(() => {
    if (loading) return;
    const totals = calcDayTotals(meals, profile.cheatBaselineKcal);
    if (totals.cheats > 0) {
      saveKey(`cheat:${date}`, {
        count: totals.cheats,
        surplus: totals.surplus,
        meals: Object.entries(meals)
          .filter(([, m]) => m?.isCheat)
          .map(([slot, m]) => ({ slot, name: m.name })),
      });
    } else {
      removeKey(`cheat:${date}`);
    }
  }, [meals, date, loading, profile.cheatBaselineKcal]);

  /* ----- Week loader ----- */
  async function reloadWeek(activeProfile = profile) {
    const days = weekDateKeys();
    const baseline = activeProfile?.cheatBaselineKcal ?? 1019;
    const out = [];
    for (const k of days) {
      const m = await loadKey(`meals:${k}`, null);
      const t = await loadKey(`training:${k}`, null);
      const s = await loadKey(`steps:${k}`, null);
      const totals = m?.meals
        ? calcDayTotals(m.meals, baseline)
        : { kcal: 0, protein: 0, cheats: 0, surplus: 0 };
      out.push({
        date: k,
        meals: m?.meals || null,
        training: t,
        steps: s,
        kcal: totals.kcal,
        protein: totals.protein,
        cheats: totals.cheats,
        surplus: totals.surplus,
      });
    }
    setWeekDays(out);
  }

  // Reload week whenever meals change (so today's slice is fresh).
  useEffect(() => {
    if (!loading) reloadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, trainingDay, steps, profile.cheatBaselineKcal]);

  /* ----- Meal logging ----- */
  function logMeal(slot, mealObj) {
    setMeals((prev) => {
      const next = { ...prev, [slot]: mealObj };
      // Auto-suggest light dinner after configured trigger lunches.
      if (slot === "lunch" && !prev.dinner) {
        const triggers = profile.lightDinnerTriggers || [];
        const lightKey = profile.lightDinnerKey;
        const triggersLight =
          (mealObj?.key && triggers.includes(mealObj.key)) || mealObj?.isCheat;
        if (triggersLight && lightKey) {
          const fl = profile.dinnerPresets?.[lightKey];
          if (fl) next.dinner = { ...fl, items: fl.items.map((i) => ({ ...i })) };
        }
      }
      return next;
    });
    // Decrement inventory.
    if (mealObj?.items) {
      setGrocery((g) => applyMealDecrement(g, mealObj.items));
    }
  }

  function clearMeal(slot) {
    setMeals((prev) => ({ ...prev, [slot]: null }));
    // (No inventory restore — keep simple; user can manually adjust.)
  }

  function logPreset(slot, preset) {
    const meal = {
      key: preset.key,
      name: preset.name,
      icon: preset.icon,
      note: preset.note,
      items: preset.items.map((i) => ({ ...i })),
      isCheat: false,
    };
    logMeal(slot, meal);
  }

  function logCheat(preset, version, customItems = null) {
    const v = preset.versions[version];
    const sourceItems = (customItems && customItems.length ? customItems : v.items).filter(
      (it) => it.amount > 0,
    );
    const customized =
      customItems &&
      v.items.some((orig, i) => {
        const c = customItems[i];
        return !c || c.amount !== orig.amount;
      });
    const meal = {
      key: preset.key,
      name: `${preset.name} (${v.label})${customized ? " · custom" : ""}`,
      icon: preset.icon,
      note: v.note,
      items: sourceItems.map((i) => ({ ...i })),
      isCheat: true,
      cheatVersion: version,
    };
    logMeal("lunch", meal);
    setTab("today");
  }

  /* ----- Grocery actions ----- */
  function adjustGrocery(key, delta) {
    setGrocery((prev) =>
      prev.map((g) => (g.key === key ? { ...g, currentQty: Math.max(0, g.currentQty + delta) } : g)),
    );
  }
  function restockGrocery(key) {
    setGrocery((prev) =>
      prev.map((g) => (g.key === key ? { ...g, currentQty: g.currentQty + g.packetSize } : g)),
    );
  }
  function resetGroceryToTemplate() {
    if (!confirm("Reset all inventory to template values?")) return;
    setGrocery(freshGrocery(profile.groceryTemplate));
  }
  function addGroceryItem(input) {
    // input: { name, category, unit, initialQty, packetSize, lowThreshold, icon }
    const baseSlug = slugify(input.name) || "item";
    setProfile((prev) => {
      const existingTpl = prev.groceryTemplate || [];
      let key = baseSlug;
      let i = 1;
      while (existingTpl.some((g) => g.key === key)) key = `${baseSlug}_${i++}`;
      const item = {
        key,
        name: input.name,
        category: input.category || "Pantry",
        unit: input.unit || "g",
        initialQty: Number(input.initialQty) || 0,
        packetSize: Number(input.packetSize) || 1,
        lowThreshold: Number(input.lowThreshold) || 0,
        icon: input.icon || "📦",
      };
      // Append to live grocery as well.
      setGrocery((prevG) => [...prevG, { ...item, currentQty: item.initialQty }]);
      return { ...prev, groceryTemplate: [...existingTpl, item] };
    });
  }
  function updateGroceryItem(key, updates) {
    const cleaned = { ...updates };
    ["initialQty", "packetSize", "lowThreshold"].forEach((k) => {
      if (cleaned[k] !== undefined) cleaned[k] = Number(cleaned[k]) || 0;
    });
    setProfile((prev) => ({
      ...prev,
      groceryTemplate: (prev.groceryTemplate || []).map((g) =>
        g.key === key ? { ...g, ...cleaned } : g,
      ),
    }));
    setGrocery((prev) => prev.map((g) => (g.key === key ? { ...g, ...cleaned } : g)));
  }
  function deleteGroceryItem(key) {
    setProfile((prev) => ({
      ...prev,
      groceryTemplate: (prev.groceryTemplate || []).filter((g) => g.key !== key),
    }));
    setGrocery((prev) => prev.filter((g) => g.key !== key));
  }
  function clearShoppingPlan() {
    if (!confirm("Clear the planned week / shopping list?")) return;
    setPlannedWeek({});
  }
  function addManualShopping(input) {
    const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    setManualShopping((prev) => [
      ...prev,
      {
        id,
        name: input.name,
        qty: Number(input.qty) || 0,
        unit: input.unit || "",
        note: input.note || "",
      },
    ]);
  }
  function updateManualShopping(id, updates) {
    setManualShopping((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }
  function deleteManualShopping(id) {
    setManualShopping((prev) => prev.filter((item) => item.id !== id));
  }

  /* ----- Reset today ----- */
  function resetToday() {
    if (!confirm("Reset today's meals, coffee, training, and steps?")) return;
    setMeals({ lunch: null, shake: null, dinner: null });
    setCoffee(new Array((profile.coffeeSchedule || []).length).fill(false));
    setTrainingDay(null);
    setSteps(null);
  }

  /* ----- Preset management (lunch / shake / dinner) ----- */
  function addPreset(slot, preset) {
    const slotKey = `${slot}Presets`;
    setProfile((prev) => {
      const existing = prev[slotKey] || {};
      const baseSlug = slugify(preset.name) || slot;
      let key = preset.key || baseSlug;
      let i = 1;
      while (existing[key]) key = `${baseSlug}_${i++}`;
      return {
        ...prev,
        [slotKey]: { ...existing, [key]: { ...preset, key } },
      };
    });
  }

  function removePreset(slot, key) {
    const slotKey = `${slot}Presets`;
    setProfile((prev) => {
      const existing = { ...(prev[slotKey] || {}) };
      delete existing[key];
      return { ...prev, [slotKey]: existing };
    });
  }

  /* ----- Apply a profile template (Saidur / Blank / imported JSON) ----- */
  function applyProfile(nextProfile, { resetGrocery = true } = {}) {
    const cloned = cloneTemplate(nextProfile);
    setProfile(cloned);
    setCoffee(new Array((cloned.coffeeSchedule || []).length).fill(false));
    if (resetGrocery) setGrocery(freshGrocery(cloned.groceryTemplate));
    setTrainingDay(null);
  }

  /* ----- Derived ----- */
  const target = useMemo(
    () => targetForDay(profile, trainingDay, steps),
    [profile, trainingDay, steps],
  );
  const totals = useMemo(
    () => calcDayTotals(meals, profile.cheatBaselineKcal),
    [meals, profile.cheatBaselineKcal],
  );
  const lowItems = useMemo(() => lowStockItems(grocery), [grocery]);
  const suggestedShakeKey = useMemo(() => {
    const dt = profile.dayTypes?.find((d) => d.id === trainingDay);
    return dt?.suggestShake || null;
  }, [profile.dayTypes, trainingDay]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="font-display text-2xl italic text-ink-muted">Loading kitchen…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <Masthead date={date} profile={profile} />
        <TabBar tab={tab} setTab={setTab} />

        {tab === "today" && (
          <TodayTab
            profile={profile}
            trainingDay={trainingDay}
            setTrainingDay={setTrainingDay}
            steps={steps}
            setSteps={setSteps}
            target={target}
            totals={totals}
            meals={meals}
            coffee={coffee}
            setCoffee={setCoffee}
            lowItems={lowItems}
            suggestedShakeKey={suggestedShakeKey}
            onSelectPreset={logPreset}
            onClearSlot={clearMeal}
            onCheatPrompt={() => setTab("cheat")}
            onViewGrocery={() => setTab("grocery")}
            onResetToday={resetToday}
          />
        )}

        {tab === "week" && <WeekTab weekDays={weekDays} dayTypes={profile.dayTypes} />}

        {tab === "cheat" && (
          <CheatTab
            onLogCheat={logCheat}
            weekDays={weekDays}
            cheatPresets={profile.cheatPresets}
            fastFoodTips={profile.fastFoodTips}
            cheatBaselineKcal={profile.cheatBaselineKcal}
          />
        )}

        {tab === "grocery" && (
          <GroceryTab
            grocery={grocery}
            onAdjust={adjustGrocery}
            onRestock={restockGrocery}
            onResetTemplate={resetGroceryToTemplate}
            plannedWeek={plannedWeek}
            setPlannedWeek={setPlannedWeek}
            onClearPlan={clearShoppingPlan}
            profile={profile}
            onAddItem={addGroceryItem}
            onUpdateItem={updateGroceryItem}
            onDeleteItem={deleteGroceryItem}
            manualShopping={manualShopping}
            onAddManual={addManualShopping}
            onUpdateManual={updateManualShopping}
            onDeleteManual={deleteManualShopping}
          />
        )}

        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            setProfile={setProfile}
            applyProfile={applyProfile}
            apiKey={apiKey}
            setApiKey={setApiKey}
            removePreset={removePreset}
          />
        )}

        {tab === "build" && (
          <BuildTab
            onLogMeal={logMeal}
            onSavePreset={addPreset}
            apiKey={apiKey}
          />
        )}

        <footer className="mt-10 pt-6 border-t-2 border-ink">
          <p className="font-display italic text-center text-lg md:text-xl text-ink-muted">
            "Always hit protein. Adjust carbs and oil, never protein."
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-center text-ink-muted mt-2">
            The golden rule
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: TODAY
============================================================ */

function TodayTab({
  profile,
  trainingDay,
  setTrainingDay,
  steps,
  setSteps,
  target,
  totals,
  meals,
  coffee,
  setCoffee,
  lowItems,
  suggestedShakeKey,
  onSelectPreset,
  onClearSlot,
  onCheatPrompt,
  onViewGrocery,
  onResetToday,
}) {
  const eatingWindow = profile.eatingWindow ? ` · ${profile.eatingWindow}` : "";
  return (
    <div className="space-y-5">
      <TrainingDayBadge
        trainingDay={trainingDay}
        onChange={setTrainingDay}
        dayTypes={profile.dayTypes}
        workoutAppUrl={profile.workoutAppUrl}
      />
      <StepCounter steps={steps} setSteps={setSteps} />
      <LowStockBanner items={lowItems} onView={onViewGrocery} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MacroCard
          label="kcal"
          value={totals.kcal}
          target={target.kcal}
          unit="kcal"
          accent="#c44827"
        />
        <MacroCard
          label="protein"
          value={totals.protein}
          target={target.protein}
          unit="g"
          accent="#2a2419"
        />
      </div>

      <CoffeeTracker coffee={coffee} setCoffee={setCoffee} schedule={profile.coffeeSchedule} />

      <div className="grid grid-cols-1 gap-4">
        <MealSlot
          slot="lunch"
          label={`Lunch${eatingWindow}`}
          meal={meals.lunch}
          presets={profile.lunchPresets}
          suggestedPresetKey={null}
          onSelect={(p) => onSelectPreset("lunch", p)}
          onClear={() => onClearSlot("lunch")}
          onCheatPrompt={onCheatPrompt}
        />
        <MealSlot
          slot="shake"
          label="Shake"
          meal={meals.shake}
          presets={profile.shakePresets}
          suggestedPresetKey={suggestedShakeKey}
          onSelect={(p) => onSelectPreset("shake", p)}
          onClear={() => onClearSlot("shake")}
        />
        <MealSlot
          slot="dinner"
          label="Dinner"
          meal={meals.dinner}
          presets={profile.dinnerPresets}
          suggestedPresetKey={null}
          onSelect={(p) => onSelectPreset("dinner", p)}
          onClear={() => onClearSlot("dinner")}
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onResetToday}
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted hover:text-accent flex items-center gap-1"
        >
          <RotateCcw size={11} /> Reset today
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: WEEK
============================================================ */

function WeekTab({ weekDays, dayTypes = [] }) {
  const totals = useMemo(() => calcWeekTotals(weekDays), [weekDays]);
  const comp = useMemo(() => weeklyCompensation(totals), [totals]);
  const monday = weekDays[0]?.date;

  const best = weekDays.filter((d) => d.kcal > 0).sort((a, b) => b.protein - a.protein)[0];
  const worst = weekDays.find((d) => d.cheats > 0 || d.surplus > 0) || null;

  const statusColor = {
    perfect: "#4a6b3e",
    fine: "#4a6b3e",
    watch: "#c44827",
    "off-track": "#c44827",
    "training-low": "#6b5a3e",
    default: "#6b5a3e",
  }[comp.status];

  const avg = (n, d) => (d > 0 ? Math.round(n / d) : 0);

  return (
    <div className="space-y-5">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Weekly review
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">
          Week of {monday ? fmtDate(monday) : "—"}
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryCell label="Cheats" value={totals.cheatCount} accent={totals.cheatCount > 1 ? "#c44827" : "#2a2419"} />
        <SummaryCell label="PPL" value={`${totals.trainingsCompleted}/3`} />
        <SummaryCell label="Football" value={totals.footballCount} accent="#4a6b3e" />
        <SummaryCell label="Avg kcal" value={fmtNum(avg(totals.totalKcal, totals.daysLogged))} />
        <SummaryCell label="Avg protein" value={`${avg(totals.totalProtein, totals.daysLogged)}g`} />
        <SummaryCell label="Avg steps" value={fmtNum(avg(totals.totalSteps, totals.daysWithSteps))} />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => {
          const tdy = dayTypes.find((t) => t.id === d.training);
          const isToday = d.date === todayKey();
          return (
            <div
              key={d.date}
              className={`border p-2 ${
                isToday ? "border-ink border-2" : "border-ink/30"
              }`}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                {shortDay(d.date)}
              </div>
              <div className="text-xl select-none leading-none my-1">
                {tdy?.icon || "·"}
              </div>
              <div className="font-display text-base font-bold leading-none">
                {fmtNum(d.kcal)}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                kcal
              </div>
              {d.cheats > 0 ? (
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-accent mt-1">
                  cheat
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-2 p-4" style={{ borderColor: statusColor }}>
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={14} style={{ color: statusColor }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: statusColor }}
          >
            {comp.status.replace("-", " ")}
          </span>
        </div>
        <p className="font-display text-xl md:text-2xl font-bold leading-snug">{comp.message}</p>
        {comp.actions ? (
          <ul className="mt-3 space-y-1">
            {comp.actions.map((a, i) => (
              <li key={i} className="font-body flex gap-2">
                <span className="text-ink-muted font-mono text-xs">{(i + 1).toString().padStart(2, "0")}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {best ? (
          <div className="border border-ink p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
              Best protein day
            </div>
            <div className="font-display text-xl font-bold">{shortDay(best.date)} · {best.protein}g</div>
          </div>
        ) : null}
        {worst ? (
          <div className="border border-accent p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
              Watch day
            </div>
            <div className="font-display text-xl font-bold">
              {shortDay(worst.date)} · {worst.surplus > 0 ? `+${worst.surplus} kcal surplus` : `${worst.cheats} cheat`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, accent }) {
  return (
    <div className="border border-ink p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">{label}</div>
      <div className="font-display text-3xl font-black leading-none mt-1" style={{ color: accent || "#2a2419" }}>
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   TAB: CHEAT
============================================================ */

function CheatTab({ onLogCheat, weekDays, cheatPresets = {}, fastFoodTips = [] }) {
  const totals = useMemo(() => calcWeekTotals(weekDays), [weekDays]);
  const cheatList = Object.values(cheatPresets);
  return (
    <div className="space-y-6">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          When the craving hits
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">
          Cheat Day Manager
        </h2>
      </div>

      <div className="border border-ink p-3 flex justify-between items-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
            This week
          </div>
          <div className="font-display text-xl font-bold">
            {totals.cheatCount} cheat{totals.cheatCount === 1 ? "" : "s"} · +{totals.weeklySurplus} kcal surplus
          </div>
        </div>
        <ChefHat size={28} className="text-ink-muted" />
      </div>

      {cheatList.length > 0 ? (
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight mb-3">Favorite cheat meals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cheatList.map((p) => (
              <CheatMealCard key={p.key} preset={p} onLog={onLogCheat} />
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-ink/30 p-6 text-center font-body italic text-ink-muted">
          No cheat presets in this profile.
        </div>
      )}

      {fastFoodTips.length > 0 ? (
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight mb-1">
            Healthy fast-food swaps
          </h3>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-3">
            Reference only · not auto-logged
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fastFoodTips.map((t, i) => (
              <div key={i} className="border border-ink p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
                  {t.craving}
                </div>
                <div className="font-display text-lg font-bold leading-snug">{t.swap}</div>
                <div className="font-body italic text-sm text-ink-muted mt-1">{t.why}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   TAB: GROCERY
============================================================ */

function GroceryTab({
  grocery,
  onAdjust,
  onRestock,
  onResetTemplate,
  plannedWeek,
  setPlannedWeek,
  onClearPlan,
  profile,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  manualShopping = [],
  onAddManual,
  onUpdateManual,
  onDeleteManual,
}) {
  const [view, setView] = useState("inventory"); // inventory | shopping | reset
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [itemModal, setItemModal] = useState(null); // { mode: 'add'|'edit', item? }
  const [manualForm, setManualForm] = useState({ name: "", qty: "", unit: "", note: "" });
  const [editingManualId, setEditingManualId] = useState(null);

  const orderedCategories = useMemo(() => {
    const fromItems = Array.from(new Set(grocery.map((g) => g.category)));
    const merged = [...GROCERY_CATEGORIES];
    for (const c of fromItems) if (!merged.includes(c)) merged.push(c);
    return merged;
  }, [grocery]);

  const groupedByCategory = useMemo(() => {
    const out = {};
    for (const cat of orderedCategories) out[cat] = [];
    for (const g of grocery) {
      if (!out[g.category]) out[g.category] = [];
      out[g.category].push(g);
    }
    return out;
  }, [grocery, orderedCategories]);

  function handleEdit(item) {
    setItemModal({ mode: "edit", item });
  }
  function handleDelete(item) {
    if (confirm(`Delete "${item.name}" from your inventory? This also removes it from the template.`)) {
      onDeleteItem(item.key);
    }
  }
  function handleSaveItem(input) {
    if (itemModal?.mode === "edit") {
      onUpdateItem(itemModal.item.key, input);
    } else {
      onAddItem(input);
    }
    setItemModal(null);
  }

  function submitManual(e) {
    e?.preventDefault();
    if (!manualForm.name.trim()) return;
    if (editingManualId) {
      onUpdateManual(editingManualId, {
        name: manualForm.name,
        qty: Number(manualForm.qty) || 0,
        unit: manualForm.unit,
        note: manualForm.note,
      });
      setEditingManualId(null);
    } else {
      onAddManual(manualForm);
    }
    setManualForm({ name: "", qty: "", unit: "", note: "" });
  }
  function startEditManual(item) {
    setEditingManualId(item.id);
    setManualForm({
      name: item.name || "",
      qty: item.qty != null ? String(item.qty) : "",
      unit: item.unit || "",
      note: item.note || "",
    });
  }
  function cancelEditManual() {
    setEditingManualId(null);
    setManualForm({ name: "", qty: "", unit: "", note: "" });
  }

  const shoppingList = useMemo(
    () => generateShoppingList(plannedWeek, grocery),
    [plannedWeek, grocery],
  );

  function markPurchased(key, toBuy) {
    onAdjust(key, toBuy);
  }

  return (
    <div className="space-y-5">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          The pantry
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Grocery</h2>
      </div>

      <div className="flex border border-ink">
        {[
          { id: "inventory", label: "Inventory", icon: <Package size={12} /> },
          { id: "shopping",  label: "Shopping list", icon: <ShoppingCart size={12} /> },
          { id: "reset",     label: "Reset",     icon: <RotateCcw size={12} /> },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 ${
              view === v.id ? "bg-ink text-paper" : "hover:bg-ink/5"
            }`}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {view === "inventory" && (
        <div className="space-y-5">
          <button
            onClick={() => setItemModal({ mode: "add" })}
            className="w-full py-2 border-2 border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper flex items-center justify-center gap-2"
          >
            <PlusCircle size={14} /> Add inventory item
          </button>
          {grocery.length === 0 ? (
            <div className="border border-ink/30 p-6 text-center font-display italic text-ink-muted">
              No inventory items yet. Tap "Add inventory item" to start.
            </div>
          ) : null}
          {orderedCategories.map((cat) => {
            const items = groupedByCategory[cat] || [];
            if (!items.length) return null;
            return (
              <section key={cat}>
                <h3 className="font-display text-2xl font-black tracking-tight mb-2">{cat}</h3>
                <div className="space-y-2">
                  {items.map((it) => (
                    <GroceryRow
                      key={it.key}
                      item={it}
                      onAdjust={onAdjust}
                      onRestock={onRestock}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "shopping" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                Shopping list
              </div>
              <div className="font-display text-xl font-bold">
                {shoppingList.length
                  ? `${shoppingList.length} item${shoppingList.length === 1 ? "" : "s"} to buy`
                  : "Plan a week to generate"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPlannerOpen(true)}
                className="px-3 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent flex items-center gap-2"
              >
                <Calendar size={12} /> Plan this week
              </button>
              {Object.keys(plannedWeek).length ? (
                <button
                  onClick={onClearPlan}
                  className="px-3 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper flex items-center gap-2"
                >
                  <Trash2 size={12} /> Clear plan
                </button>
              ) : null}
            </div>
          </div>

          {/* Auto-generated section */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
              Auto from week plan
            </div>
            {shoppingList.length === 0 ? (
              <div className="border border-ink/30 p-6 text-center">
                <div className="font-display italic text-ink-muted">
                  {Object.keys(plannedWeek).length
                    ? "All planned ingredients are in stock. ✨"
                    : "No plan yet. Tap 'Plan this week' to assign meals to days."}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {shoppingList.map((s) => (
                  <div key={s.key} className="border border-ink p-3 flex items-center gap-3">
                    <span className="text-2xl select-none">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base font-bold leading-tight">
                        {s.name}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                        have {s.haveCurrently} · need {s.needed} · buy {s.packets}× {s.packetSize} {s.unit}
                      </div>
                    </div>
                    <button
                      onClick={() => markPurchased(s.key, s.toBuy)}
                      className="px-2 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper flex items-center gap-1"
                    >
                      <Check size={11} /> Bought
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual additions */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
              Manual additions
            </div>

            <form
              onSubmit={submitManual}
              className="border border-ink p-3 space-y-2 mb-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <input
                  value={manualForm.name}
                  onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Item name (e.g. dish soap)"
                  className="md:col-span-5 border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                />
                <input
                  type="number"
                  value={manualForm.qty}
                  onChange={(e) => setManualForm((f) => ({ ...f, qty: e.target.value }))}
                  placeholder="qty"
                  className="md:col-span-2 border border-ink bg-paper px-2 py-1 font-display text-base focus:outline-none"
                />
                <input
                  value={manualForm.unit}
                  onChange={(e) => setManualForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="unit"
                  className="md:col-span-2 border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                />
                <input
                  value={manualForm.note}
                  onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="note"
                  className="md:col-span-3 border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!manualForm.name.trim()}
                  className="px-3 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
                >
                  {editingManualId ? "Save" : "+ Add to list"}
                </button>
                {editingManualId ? (
                  <button
                    type="button"
                    onClick={cancelEditManual}
                    className="px-3 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            {manualShopping.length === 0 ? (
              <div className="border border-ink/30 p-4 text-center font-display italic text-ink-muted">
                No manual items yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {manualShopping.map((m) => (
                  <li
                    key={m.id}
                    className="border border-ink p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base font-bold leading-tight">
                        {m.name}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                        {m.qty || "—"} {m.unit}
                        {m.note ? ` · ${m.note}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => startEditManual(m)}
                      className="w-7 h-7 border border-ink/40 flex items-center justify-center hover:bg-ink hover:text-paper"
                      aria-label="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteManual(m.id)}
                      className="w-7 h-7 border border-ink/40 flex items-center justify-center hover:bg-accent hover:text-paper hover:border-accent"
                      aria-label="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "reset" && (
        <div className="space-y-3">
          <div className="border border-ink p-4">
            <div className="font-display text-lg font-bold">Reset inventory to template</div>
            <div className="font-body text-sm text-ink-muted mb-3">
              Restores all initial quantities. Won't touch your shopping plan.
            </div>
            <button
              onClick={onResetTemplate}
              className="px-3 py-2 border border-accent text-accent font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent hover:text-paper"
            >
              Reset inventory
            </button>
          </div>
          <div className="border border-ink p-4">
            <div className="font-display text-lg font-bold">Clear shopping plan</div>
            <div className="font-body text-sm text-ink-muted mb-3">
              Forgets all planned meals for the week.
            </div>
            <button
              onClick={onClearPlan}
              className="px-3 py-2 border border-accent text-accent font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent hover:text-paper"
            >
              Clear plan
            </button>
          </div>
        </div>
      )}

      {plannerOpen && (
        <WeekPlannerModal
          plannedWeek={plannedWeek}
          setPlannedWeek={setPlannedWeek}
          onClose={() => setPlannerOpen(false)}
          profile={profile}
        />
      )}

      {itemModal && (
        <InventoryItemModal
          mode={itemModal.mode}
          item={itemModal.item}
          existingCategories={orderedCategories}
          onClose={() => setItemModal(null)}
          onSave={handleSaveItem}
        />
      )}
    </div>
  );
}

function InventoryItemModal({ mode, item, existingCategories = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  const [draft, setDraft] = useState(() => ({
    icon: item?.icon || "📦",
    name: item?.name || "",
    category: item?.category || existingCategories[0] || "Pantry",
    unit: item?.unit || "g",
    initialQty: item?.initialQty != null ? String(item.initialQty) : "0",
    packetSize: item?.packetSize != null ? String(item.packetSize) : "1",
    lowThreshold: item?.lowThreshold != null ? String(item.lowThreshold) : "0",
  }));
  const [customCategory, setCustomCategory] = useState(false);

  function set(k, v) {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }
  function submit(e) {
    e?.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      icon: draft.icon || "📦",
      name: draft.name.trim(),
      category: draft.category.trim() || "Pantry",
      unit: draft.unit.trim() || "g",
      initialQty: Number(draft.initialQty) || 0,
      packetSize: Number(draft.packetSize) || 1,
      lowThreshold: Number(draft.lowThreshold) || 0,
    });
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end md:items-center justify-center p-2 md:p-6">
      <form
        onSubmit={submit}
        className="bg-paper border-2 border-ink w-full max-w-lg max-h-[95vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-paper border-b-2 border-ink px-4 py-3 flex items-center justify-between">
          <h3 className="font-display text-2xl font-black tracking-tight">
            {isEdit ? "Edit item" : "Add item"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={draft.icon}
              onChange={(e) => set("icon", e.target.value)}
              maxLength={4}
              className="w-12 text-center text-2xl bg-paper border border-ink py-1 focus:outline-none"
              aria-label="Icon"
            />
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Item name"
              autoFocus
              className="flex-1 font-display text-2xl font-bold bg-paper border-b border-ink py-1 focus:outline-none"
            />
          </div>

          <Field label="Category">
            {customCategory ? (
              <input
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Custom category"
                className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
              />
            ) : (
              <select
                value={draft.category}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    setCustomCategory(true);
                  } else {
                    set("category", v);
                  }
                }}
                className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">+ Custom category…</option>
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <input
                value={draft.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="g / ml / pc / cup"
                className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
              />
            </Field>
            <Field label={isEdit ? "Reset qty (template)" : "Initial qty"}>
              <input
                type="number"
                value={draft.initialQty}
                onChange={(e) => set("initialQty", e.target.value)}
                className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
              />
            </Field>
            <Field label="Packet size">
              <input
                type="number"
                value={draft.packetSize}
                onChange={(e) => set("packetSize", e.target.value)}
                className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
              />
            </Field>
            <Field label="Low threshold">
              <input
                type="number"
                value={draft.lowThreshold}
                onChange={(e) => set("lowThreshold", e.target.value)}
                className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
              />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 bg-paper border-t-2 border-ink p-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!draft.name.trim()}
            className="px-4 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
          >
            {isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WeekPlannerModal({ plannedWeek, setPlannedWeek, onClose, profile }) {
  const days = weekDateKeys();
  const [draft, setDraft] = useState(() => {
    const seed = {};
    for (const d of days) seed[d] = plannedWeek[d] || { lunch: null, shake: null, dinner: null };
    return seed;
  });

  function setSlot(day, slot, preset) {
    setDraft((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slot]: preset
          ? { name: preset.name, items: preset.items.map((i) => ({ ...i })) }
          : null,
      },
    }));
  }

  function repeatToAll(day) {
    setDraft((prev) => {
      const src = prev[day];
      const next = { ...prev };
      for (const d of days) next[d] = { ...src };
      return next;
    });
  }

  function save() {
    setPlannedWeek(draft);
    onClose();
  }

  const allOptions = (slot) => {
    if (slot === "lunch") return Object.values(profile?.lunchPresets || {});
    if (slot === "shake") return Object.values(profile?.shakePresets || {});
    if (slot === "dinner") return Object.values(profile?.dinnerPresets || {});
    return [];
  };

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end md:items-center justify-center p-2 md:p-6">
      <div className="bg-paper border-2 border-ink w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper border-b-2 border-ink px-4 py-3 flex items-center justify-between">
          <h3 className="font-display text-2xl font-black tracking-tight">Plan this week</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {days.map((d) => (
            <div key={d} className="border border-ink p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-display text-lg font-bold">{fmtDate(d)}</div>
                <button
                  onClick={() => repeatToAll(d)}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted hover:text-accent"
                >
                  Repeat to all 7 days
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {["lunch", "shake", "dinner"].map((slot) => {
                  const options = allOptions(slot);
                  const cur = draft[d]?.[slot];
                  return (
                    <div key={slot} className="border border-ink/30 p-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-1">
                        {slot}
                      </div>
                      <select
                        value={cur ? options.find((o) => o.name === cur.name)?.key || "" : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return setSlot(d, slot, null);
                          const p = options.find((o) => o.key === v);
                          setSlot(d, slot, p);
                        }}
                        className="w-full border border-ink bg-paper px-2 py-1 text-sm"
                      >
                        <option value="">— none —</option>
                        {options.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-paper border-t-2 border-ink p-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent"
          >
            Save plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: BUILD
============================================================ */

function BuildTab({ onLogMeal, onSavePreset, apiKey }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("Custom meal");
  const [icon, setIcon] = useState("🍽️");
  const [note, setNote] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [savedAs, setSavedAs] = useState(null); // small "saved!" toast
  const totals = useMemo(() => calcMeal(items), [items]);

  function addItem(item) {
    if (!item.amount) return;
    setItems((prev) => [...prev, item]);
  }
  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function reset() {
    setItems([]);
    setName("Custom meal");
    setIcon("🍽️");
    setNote("");
  }
  function saveAs(slot) {
    if (!items.length) return;
    onLogMeal(slot, {
      key: "custom",
      name,
      icon: icon || "🍽️",
      note: note || null,
      items: items.map((i) => ({ ...i })),
      isCheat: false,
    });
    reset();
  }
  function savePreset(slot) {
    if (!items.length || !name.trim()) return;
    onSavePreset(slot, {
      name: name.trim(),
      icon: icon || "🍽️",
      note: note.trim() || undefined,
      items: items.map((i) => ({ ...i })),
    });
    setSavedAs(`${slot} preset saved`);
    setTimeout(() => setSavedAs(null), 2200);
  }

  function logFromAi(slot, ai, quantity) {
    const meal = {
      key: "ai_photo",
      name: ai.name || "Photo meal",
      icon: "📷",
      note: ai.notes || null,
      items: [
        {
          food: "ai_photo",
          amount: 1,
          direct: {
            kcal: ai.kcal,
            protein: ai.protein_g,
            fat: ai.fat_g,
            carbs: ai.carbs_g,
            displayName: `${ai.name}${quantity ? ` · ${quantity}` : ""}`,
            unit: "serving",
            confidence: ai.confidence,
          },
        },
      ],
      isCheat: false,
    };
    onLogMeal(slot, meal);
  }

  return (
    <div className="space-y-5">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Compose your own
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Build a meal</h2>
      </div>

      <div className="border-2 border-accent p-4 bg-accent/5">
        <div className="flex items-center gap-3 mb-2">
          <Camera size={20} className="text-accent" />
          <div className="flex-1">
            <div className="font-display text-xl font-bold leading-tight">Photo meal (AI)</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Snap a plate, state the quantity, get macros
            </div>
          </div>
        </div>
        <button
          onClick={() => setPhotoOpen(true)}
          className="w-full py-2 bg-accent text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink flex items-center justify-center gap-2"
        >
          <Sparkles size={12} /> Analyze a food photo
        </button>
        {!apiKey ? (
          <p className="font-body italic text-xs text-ink-muted mt-2">
            Set your Anthropic API key in the Profile tab first.
          </p>
        ) : null}
      </div>

      <div className="border-2 border-ink p-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={4}
            placeholder="🍽️"
            aria-label="Icon"
            className="w-12 text-center text-2xl bg-paper border border-ink py-1 focus:outline-none"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 font-display text-2xl font-bold bg-paper border-b border-ink py-1 focus:outline-none"
            placeholder="Meal name"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. 'air fry only')"
          className="w-full font-body text-sm bg-paper border-b border-ink/30 py-1 mb-3 focus:outline-none"
        />
        <ul className="text-sm space-y-1 mb-3">
          {items.length === 0 ? (
            <li className="font-body italic text-ink-muted">No ingredients yet.</li>
          ) : (
            items.map((it, i) => {
              const f = FOODS[it.food];
              return (
                <li key={i} className="flex justify-between items-center font-body">
                  <span>{f?.display || it.food}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px]">{it.amount} {f?.unit}</span>
                    <button
                      onClick={() => removeItem(i)}
                      className="text-ink-muted hover:text-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-ink/20 pt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
          <span style={{ color: "#c44827" }}>{totals.kcal} kcal</span>
          <span>{totals.protein}g protein</span>
        </div>
      </div>

      <FoodPicker onAdd={addItem} />

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Log just for today
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "lunch", label: "Log Lunch" },
            { id: "shake", label: "Log Shake" },
            { id: "dinner", label: "Log Dinner" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => saveAs(b.id)}
              disabled={!items.length}
              className="py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Save as a reusable preset
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "lunch", label: "+ Lunch preset" },
            { id: "shake", label: "+ Shake preset" },
            { id: "dinner", label: "+ Dinner preset" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => savePreset(b.id)}
              disabled={!items.length || !name.trim()}
              className="py-2 border-2 border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper disabled:opacity-30"
            >
              {b.label}
            </button>
          ))}
        </div>
        {savedAs ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-good">
            ✓ {savedAs} — appears in Today tab and Profile → Presets
          </div>
        ) : null}
      </div>

      {photoOpen && (
        <PhotoMealModal
          apiKey={apiKey}
          onClose={() => setPhotoOpen(false)}
          onLog={(slot, ai, qty) => {
            logFromAi(slot, ai, qty);
            setPhotoOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   PhotoMealModal — upload, analyze, edit, save
============================================================ */

function PhotoMealModal({ apiKey, onClose, onLog }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function pickFile(f) {
    if (!f) return;
    setFile(f);
    setError(null);
    try {
      const { dataUrl } = await fileToResizedBase64(f, 1568);
      setPreviewUrl(dataUrl);
    } catch (e) {
      setError(e.message || "Could not read file.");
    }
  }

  async function analyze() {
    if (!file) {
      setError("Pick a photo first.");
      return;
    }
    if (!apiKey) {
      setError("Set your Anthropic API key in the Profile tab.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const { base64, mediaType } = await fileToResizedBase64(file, 1568);
      const ai = await analyzeFoodPhoto({ apiKey, base64, mediaType, quantity });
      setResult(ai);
    } catch (e) {
      setError(e.message || "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateField(key, value) {
    setResult((prev) => ({ ...prev, [key]: value }));
  }

  const confColor = result
    ? { low: "#c44827", medium: "#6b5a3e", high: "#4a6b3e" }[result.confidence] || "#6b5a3e"
    : "#6b5a3e";

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end md:items-center justify-center p-2 md:p-6">
      <div className="bg-paper border-2 border-ink w-full max-w-xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper border-b-2 border-ink px-4 py-3 flex items-center justify-between">
          <h3 className="font-display text-2xl font-black tracking-tight flex items-center gap-2">
            <Camera size={18} /> Photo meal
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
              Photo
            </div>
            <label className="block border-2 border-dashed border-ink/40 hover:border-ink p-4 text-center cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => pickFile(e.target.files?.[0])}
                className="hidden"
              />
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected food"
                  className="max-h-64 mx-auto"
                />
              ) : (
                <span className="font-display italic text-ink-muted">
                  Tap to choose / take photo
                </span>
              )}
            </label>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
              Quantity (optional but improves accuracy)
            </div>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 1 plate, 300g, 2 cups, 1 large piece"
              className="w-full border border-ink bg-paper px-2 py-2 font-body text-base focus:outline-none"
            />
          </div>

          {error ? (
            <div className="border border-accent bg-accent/5 p-2 font-mono text-[11px] text-accent">
              {error}
            </div>
          ) : null}

          <button
            onClick={analyze}
            disabled={!file || analyzing}
            className="w-full py-3 bg-accent text-paper font-mono text-[11px] uppercase tracking-[0.25em] hover:bg-ink disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Analyze with Claude
              </>
            )}
          </button>

          {result ? (
            <div className="border-2 border-ink p-3 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                  Estimated macros
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.25em]"
                  style={{ color: confColor }}
                >
                  confidence: {result.confidence}
                </span>
              </div>
              <Field label="Name">
                <input
                  value={result.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="kcal">
                  <input
                    type="number"
                    value={result.kcal}
                    onChange={(e) => updateField("kcal", Number(e.target.value) || 0)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
                  />
                </Field>
                <Field label="protein (g)">
                  <input
                    type="number"
                    value={result.protein_g}
                    onChange={(e) => updateField("protein_g", Number(e.target.value) || 0)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
                  />
                </Field>
                <Field label="fat (g)">
                  <input
                    type="number"
                    value={result.fat_g}
                    onChange={(e) => updateField("fat_g", Number(e.target.value) || 0)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
                  />
                </Field>
                <Field label="carbs (g)">
                  <input
                    type="number"
                    value={result.carbs_g}
                    onChange={(e) => updateField("carbs_g", Number(e.target.value) || 0)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
                  />
                </Field>
              </div>
              {result.notes ? (
                <div className="font-body italic text-sm text-ink-muted">{result.notes}</div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "lunch", label: "Log lunch" },
                  { id: "shake", label: "Log shake" },
                  { id: "dinner", label: "Log dinner" },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onLog(b.id, result, quantity)}
                    className="py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: PROFILE (settings)
============================================================ */

function ProfileTab({ profile, setProfile, applyProfile, apiKey, setApiKey, removePreset }) {
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState(null);
  const [keyDraft, setKeyDraft] = useState(apiKey || "");
  const [keyVisible, setKeyVisible] = useState(false);

  function update(path, value) {
    setProfile((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (cur[path[i]] == null) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  function loadTemplate(id) {
    const tpl = TEMPLATES[id];
    if (!tpl) return;
    if (
      !confirm(
        `Load the "${tpl.name}" template? Your personal info, targets, presets, grocery list, and coffee schedule will be replaced. Logged days/meals are kept.`,
      )
    ) {
      return;
    }
    applyProfile(tpl);
  }

  function exportJson() {
    const blob = JSON.stringify(profile, null, 2);
    navigator.clipboard?.writeText(blob).catch(() => {});
    return blob;
  }

  function tryImport() {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Not an object");
      }
      if (!Array.isArray(parsed.dayTypes)) {
        throw new Error("Missing dayTypes array");
      }
      applyProfile(parsed);
      setImportText("");
    } catch (e) {
      setImportError(e.message || "Invalid JSON");
    }
  }

  const shakeKeys = Object.keys(profile.shakePresets || {});

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Settings
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Profile</h2>
        <div className="font-body italic text-ink-muted text-sm mt-1">
          Active template: <span className="font-bold not-italic">{profile.name || "—"}</span>
          {profile.publicLabel ? ` · ${profile.publicLabel}` : ""}
        </div>
      </div>

      {/* Templates */}
      <Section title="Templates">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(TEMPLATES).map(([id, tpl]) => (
            <button
              key={id}
              onClick={() => loadTemplate(id)}
              className={`text-left border-2 p-3 hover:bg-ink hover:text-paper transition-colors ${
                profile.id === id ? "border-accent" : "border-ink"
              }`}
            >
              <div className="font-display text-xl font-bold">{tpl.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted group-hover:text-paper/70">
                {tpl.publicLabel}
              </div>
            </button>
          ))}
        </div>
        <p className="font-body italic text-sm text-ink-muted mt-2">
          Loading a template replaces personal info, targets, presets, grocery items, and coffee
          schedule. Your logged days and meals stay put.
        </p>
      </Section>

      {/* Personal */}
      <Section title="Personal info">
        <Field label="Name">
          <input
            value={profile.name || ""}
            onChange={(e) => update(["name"], e.target.value)}
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Height (display)">
          <input
            value={profile.stats?.heightDisplay || ""}
            onChange={(e) => update(["stats", "heightDisplay"], e.target.value)}
            placeholder={'e.g. 5\'11"'}
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            type="number"
            value={profile.stats?.weightKg ?? ""}
            onChange={(e) =>
              update(
                ["stats", "weightKg"],
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Sex">
          <input
            value={profile.stats?.sex || ""}
            onChange={(e) => update(["stats", "sex"], e.target.value)}
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Goal">
          <input
            value={profile.goal || ""}
            onChange={(e) => update(["goal"], e.target.value)}
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Eating window">
          <input
            value={profile.eatingWindow || ""}
            onChange={(e) => update(["eatingWindow"], e.target.value)}
            placeholder="e.g. 1 PM – 9 PM (16:8)"
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
        <Field label="Workout app URL">
          <input
            value={profile.workoutAppUrl || ""}
            onChange={(e) => update(["workoutAppUrl"], e.target.value)}
            placeholder="https://…"
            className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
          />
        </Field>
      </Section>

      {/* Targets */}
      <Section title="Targets">
        <Field label="Protein target (g/day)">
          <input
            type="number"
            value={profile.proteinTarget ?? 0}
            onChange={(e) => update(["proteinTarget"], Number(e.target.value) || 0)}
            className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
          />
        </Field>
        <Field label="Cheat baseline kcal">
          <input
            type="number"
            value={profile.cheatBaselineKcal ?? 0}
            onChange={(e) => update(["cheatBaselineKcal"], Number(e.target.value) || 0)}
            className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
          />
        </Field>
      </Section>

      {/* Step adjustment */}
      <Section title="Step adjustment">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Low threshold (steps)">
            <input
              type="number"
              value={profile.stepAdjust?.lowThreshold ?? 0}
              onChange={(e) => update(["stepAdjust", "lowThreshold"], Number(e.target.value) || 0)}
              className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
            />
          </Field>
          <Field label="High threshold (steps)">
            <input
              type="number"
              value={profile.stepAdjust?.highThreshold ?? 0}
              onChange={(e) => update(["stepAdjust", "highThreshold"], Number(e.target.value) || 0)}
              className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
            />
          </Field>
          <Field label="Below-low kcal delta">
            <input
              type="number"
              value={profile.stepAdjust?.lowDelta ?? 0}
              onChange={(e) => update(["stepAdjust", "lowDelta"], Number(e.target.value) || 0)}
              className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
            />
          </Field>
          <Field label="Above-high kcal delta">
            <input
              type="number"
              value={profile.stepAdjust?.highDelta ?? 0}
              onChange={(e) => update(["stepAdjust", "highDelta"], Number(e.target.value) || 0)}
              className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
            />
          </Field>
        </div>
      </Section>

      {/* Day types */}
      <Section title="Day types">
        <div className="space-y-2">
          {(profile.dayTypes || []).map((dt, idx) => (
            <div key={dt.id} className="border border-ink p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{dt.icon}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                  id: {dt.id}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Field label="Label">
                  <input
                    value={dt.label}
                    onChange={(e) => update(["dayTypes", idx, "label"], e.target.value)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                  />
                </Field>
                <Field label="kcal target">
                  <input
                    type="number"
                    value={dt.target}
                    onChange={(e) => update(["dayTypes", idx, "target"], Number(e.target.value) || 0)}
                    className="w-full border border-ink bg-paper px-2 py-1 font-display text-lg focus:outline-none"
                  />
                </Field>
                <Field label="Suggested shake">
                  <select
                    value={dt.suggestShake || ""}
                    onChange={(e) =>
                      update(["dayTypes", idx, "suggestShake"], e.target.value || null)
                    }
                    className="w-full border border-ink bg-paper px-2 py-1 font-body text-base focus:outline-none"
                  >
                    <option value="">— none —</option>
                    {shakeKeys.map((k) => (
                      <option key={k} value={k}>
                        {profile.shakePresets[k]?.name || k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ))}
        </div>
        <p className="font-body italic text-sm text-ink-muted mt-2">
          Adding/removing day types or editing presets, grocery, and cheat meals is JSON-only for
          now — see the import/export panel below.
        </p>
      </Section>

      {/* Presets */}
      <Section title="Meal presets">
        <p className="font-body text-sm text-ink-muted">
          These appear as quick-add cards on the Today tab. Compose new ones in the Build tab and
          tap "+ Lunch / Shake / Dinner preset".
        </p>
        {[
          { slot: "lunch", label: "Lunch", presets: profile.lunchPresets },
          { slot: "shake", label: "Shake", presets: profile.shakePresets },
          { slot: "dinner", label: "Dinner", presets: profile.dinnerPresets },
        ].map(({ slot, label, presets }) => {
          const list = Object.values(presets || {});
          return (
            <div key={slot} className="border border-ink p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display text-lg font-bold">{label}</h4>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                  {list.length} preset{list.length === 1 ? "" : "s"}
                </span>
              </div>
              {list.length === 0 ? (
                <div className="font-body italic text-sm text-ink-muted">
                  No {label.toLowerCase()} presets yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {list.map((p) => {
                    const c = calcMeal(p.items);
                    return (
                      <li
                        key={p.key}
                        className="flex items-center gap-3 border border-ink/30 p-2"
                      >
                        <span className="text-2xl select-none">{p.icon || "🍽️"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-base font-bold leading-tight">
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                            {c.kcal} kcal · {c.protein}g protein
                            {p.note ? ` · ${p.note}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (
                              confirm(`Delete "${p.name}" from ${label.toLowerCase()} presets?`)
                            ) {
                              removePreset(slot, p.key);
                            }
                          }}
                          className="text-ink-muted hover:text-accent"
                          aria-label="Delete preset"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </Section>

      {/* AI photo analysis */}
      <Section title="AI photo analysis (optional)">
        <p className="font-body text-sm text-ink-muted">
          Used by the photo-meal feature on the Build tab. Your Anthropic API key is stored only
          in this browser's localStorage and is sent direct to api.anthropic.com when you analyze
          a photo. Don't enable this on a shared device.{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            Get a key →
          </a>
        </p>
        <Field label="Anthropic API key">
          <div className="flex gap-2">
            <input
              type={keyVisible ? "text" : "password"}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-…"
              className="flex-1 border border-ink bg-paper px-2 py-1 font-mono text-xs focus:outline-none"
            />
            <button
              onClick={() => setKeyVisible((v) => !v)}
              className="px-3 py-1 border border-ink font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
            >
              {keyVisible ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <div className="flex gap-2">
          <button
            onClick={() => setApiKey(keyDraft.trim())}
            disabled={keyDraft.trim() === (apiKey || "")}
            className="px-3 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
          >
            Save key
          </button>
          {apiKey ? (
            <button
              onClick={() => {
                if (confirm("Remove the saved API key from this browser?")) {
                  setApiKey("");
                  setKeyDraft("");
                }
              }}
              className="px-3 py-2 border border-accent text-accent font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent hover:text-paper"
            >
              Remove
            </button>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] self-center text-ink-muted">
            {apiKey ? `Saved · …${apiKey.slice(-6)}` : "Not set"}
          </span>
        </div>
      </Section>

      {/* Advanced */}
      <Section title="Advanced — full profile JSON">
        <div className="space-y-2">
          <button
            onClick={exportJson}
            className="px-3 py-2 border border-ink font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-paper"
          >
            Copy current profile to clipboard
          </button>
          <textarea
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste a profile JSON here, then "Apply"'
            className="w-full border border-ink bg-paper p-2 font-mono text-xs focus:outline-none"
          />
          {importError ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {importError}
            </div>
          ) : null}
          <button
            onClick={tryImport}
            disabled={!importText.trim()}
            className="px-3 py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent disabled:opacity-30"
          >
            Apply imported JSON
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-2xl font-black tracking-tight border-b border-ink/30 pb-1">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
