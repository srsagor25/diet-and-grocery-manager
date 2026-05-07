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
} from "lucide-react";

/* ============================================================
   CONSTANTS
============================================================ */

const WORKOUT_APP_URL = "https://workout-cyan-tau.vercel.app/";

const FOODS = {
  chicken_thigh:      { key: "chicken_thigh",      display: "Chicken Thigh (skinless)", unit: "g",      kcal: 1.45, protein: 0.21,  groceryKey: "chicken_thigh" },
  chicken_legs:       { key: "chicken_legs",       display: "Chicken Legs (skinless)",  unit: "g",      kcal: 1.20, protein: 0.20,  groceryKey: "chicken_legs" },
  chicken_breast:     { key: "chicken_breast",     display: "Chicken Breast",           unit: "g",      kcal: 1.65, protein: 0.31,  groceryKey: "chicken_breast" },
  beef_lean:          { key: "beef_lean",          display: "Lean Beef (pur cut)",      unit: "g",      kcal: 1.70, protein: 0.21,  groceryKey: "beef" },
  fish:               { key: "fish",               display: "Fish (Tilapia/Rui)",       unit: "g",      kcal: 0.96, protein: 0.20,  groceryKey: "fish" },
  egg:                { key: "egg",                display: "Egg (large)",              unit: "pc",     kcal: 72,   protein: 6.3,   groceryKey: "egg" },
  rice:               { key: "rice",               display: "Steamed Rice (cooked)",    unit: "g",      kcal: 1.30, protein: 0.027, groceryKey: "rice" },
  khichuri_mix:       { key: "khichuri_mix",       display: "Khichuri (cooked)",        unit: "g",      kcal: 1.30, protein: 0.040, groceryKey: null }, // compound — handled in decrement
  tehari_rice:        { key: "tehari_rice",        display: "Tehari Rice",              unit: "g",      kcal: 1.50, protein: 0.030, groceryKey: null }, // compound — handled in decrement
  pizza_regular:      { key: "pizza_regular",      display: "Pizza Slice (regular)",    unit: "slice",  kcal: 250,  protein: 10,    groceryKey: null },
  pizza_chicken_thin: { key: "pizza_chicken_thin", display: "Pizza Slice (chicken thin)",unit: "slice", kcal: 183,  protein: 13,    groceryKey: null },
  cucumber:           { key: "cucumber",           display: "Cucumber",                 unit: "g",      kcal: 0.15, protein: 0.007, groceryKey: "cucumber" },
  bhuna_oil:          { key: "bhuna_oil",          display: "Bhuna Oil (cooking)",      unit: "tbsp",   kcal: 120,  protein: 0,     groceryKey: "oil" },
  ghee:               { key: "ghee",               display: "Ghee",                     unit: "tbsp",   kcal: 120,  protein: 0,     groceryKey: "ghee" },
  oil_spray:          { key: "oil_spray",          display: "Oil Spray (air fry)",      unit: "tsp",    kcal: 40,   protein: 0,     groceryKey: "oil_spray" },
  fruit_mixed:        { key: "fruit_mixed",        display: "Mixed Fruits",             unit: "g",      kcal: 0.60, protein: 0.008, groceryKey: "fruits" },
  milk:               { key: "milk",               display: "Milk",                     unit: "ml",     kcal: 0.60, protein: 0.033, groceryKey: "milk" },
  cashew:             { key: "cashew",             display: "Cashew (Kaju)",            unit: "g",      kcal: 5.53, protein: 0.18,  groceryKey: "cashew" },
  dates:              { key: "dates",              display: "Dates (Khejur)",           unit: "g",      kcal: 2.77, protein: 0.018, groceryKey: "dates" },
  peanut:             { key: "peanut",             display: "Peanut/Mixed Nuts",        unit: "g",      kcal: 5.85, protein: 0.26,  groceryKey: "peanut" },
  sauce:              { key: "sauce",              display: "Sauce",                    unit: "cup",    kcal: 48,   protein: 2,     groceryKey: "sauce" },
};

const LUNCH_PRESETS = {
  lunch_chicken_thigh: {
    key: "lunch_chicken_thigh",
    name: "Chicken Thigh Bhuna + Rice",
    icon: "🍗",
    items: [
      { food: "chicken_thigh", amount: 333 },
      { food: "rice", amount: 200 },
      { food: "egg", amount: 2 },
      { food: "cucumber", amount: 200 },
      { food: "bhuna_oil", amount: 2 },
    ],
  },
  lunch_chicken_legs: {
    key: "lunch_chicken_legs",
    name: "Chicken Legs + Rice",
    icon: "🍗",
    items: [
      { food: "chicken_legs", amount: 500 },
      { food: "rice", amount: 200 },
      { food: "cucumber", amount: 200 },
      { food: "oil_spray", amount: 1 },
    ],
  },
  lunch_fish: {
    key: "lunch_fish",
    name: "Fish Bhuna + Rice",
    icon: "🐟",
    items: [
      { food: "fish", amount: 333 },
      { food: "rice", amount: 200 },
      { food: "egg", amount: 2 },
      { food: "cucumber", amount: 200 },
      { food: "bhuna_oil", amount: 2 },
    ],
  },
  lunch_beef: {
    key: "lunch_beef",
    name: "Beef Bhuna + Rice",
    icon: "🥩",
    note: "Pair with light fish dinner",
    items: [
      { food: "beef_lean", amount: 250 },
      { food: "rice", amount: 200 },
      { food: "egg", amount: 2 },
      { food: "cucumber", amount: 200 },
      { food: "bhuna_oil", amount: 2 },
    ],
  },
};

const CHEAT_PRESETS = {
  cheat_khichuri: {
    key: "cheat_khichuri",
    name: "Beef Khichuri",
    icon: "🍲",
    versions: {
      original: {
        label: "Original",
        items: [
          { food: "khichuri_mix", amount: 300 },
          { food: "beef_lean", amount: 150 },
          { food: "bhuna_oil", amount: 2 },
        ],
      },
      healthy: {
        label: "Healthy",
        note: "More beef, less oil, +eggs",
        items: [
          { food: "khichuri_mix", amount: 250 },
          { food: "beef_lean", amount: 250 },
          { food: "bhuna_oil", amount: 1 },
          { food: "egg", amount: 2 },
        ],
      },
    },
  },
  cheat_tehari: {
    key: "cheat_tehari",
    name: "Tehari (Beef)",
    icon: "🍛",
    versions: {
      original: {
        label: "Original",
        items: [
          { food: "tehari_rice", amount: 350 },
          { food: "beef_lean", amount: 150 },
          { food: "ghee", amount: 2 },
        ],
      },
      healthy: {
        label: "Healthy",
        note: "More beef, less rice, +eggs",
        items: [
          { food: "tehari_rice", amount: 200 },
          { food: "beef_lean", amount: 300 },
          { food: "ghee", amount: 1 },
          { food: "egg", amount: 2 },
        ],
      },
    },
  },
  cheat_pizza: {
    key: "cheat_pizza",
    name: "Pizza",
    icon: "🍕",
    versions: {
      original: {
        label: "Original (3 slices regular)",
        items: [{ food: "pizza_regular", amount: 3 }],
      },
      healthy: {
        label: "Healthy (3 slices chicken thin)",
        note: "Higher protein, lower fat",
        items: [{ food: "pizza_chicken_thin", amount: 3 }],
      },
    },
  },
  cheat_family_big_lunch: {
    key: "cheat_family_big_lunch",
    name: "Family Big Lunch",
    icon: "👨‍👩‍👧‍👦",
    note: "4 items + rice. Auto-suggests light fish dinner.",
    versions: {
      original: {
        label: "As served",
        items: [
          { food: "chicken_thigh", amount: 200 },
          { food: "beef_lean", amount: 150 },
          { food: "rice", amount: 200 },
          { food: "egg", amount: 1 },
          { food: "bhuna_oil", amount: 2 },
        ],
      },
      healthy: {
        label: "Lighter portions",
        items: [
          { food: "chicken_thigh", amount: 200 },
          { food: "beef_lean", amount: 100 },
          { food: "rice", amount: 150 },
          { food: "egg", amount: 1 },
          { food: "bhuna_oil", amount: 1 },
        ],
      },
    },
  },
};

const SHAKE_PRESETS = {
  shake_standard: {
    key: "shake_standard",
    name: "Standard Shake",
    icon: "🥤",
    items: [
      { food: "milk", amount: 250 },
      { food: "cashew", amount: 15 },
      { food: "dates", amount: 30 },
    ],
  },
  shake_power: {
    key: "shake_power",
    name: "Power Shake",
    icon: "💪",
    note: "Auto-suggested on training/football days",
    items: [
      { food: "milk", amount: 250 },
      { food: "cashew", amount: 30 },
      { food: "dates", amount: 30 },
      { food: "peanut", amount: 30 },
    ],
  },
};

const DINNER_PRESETS = {
  dinner_fish: {
    key: "dinner_fish",
    name: "Fish Dinner",
    icon: "🐟",
    items: [
      { food: "fish", amount: 333 },
      { food: "egg", amount: 2 },
      { food: "fruit_mixed", amount: 250 },
      { food: "oil_spray", amount: 1 },
      { food: "sauce", amount: 1 },
    ],
  },
  dinner_beef: {
    key: "dinner_beef",
    name: "Beef Dinner",
    icon: "🥩",
    items: [
      { food: "beef_lean", amount: 250 },
      { food: "egg", amount: 2 },
      { food: "fruit_mixed", amount: 250 },
      { food: "oil_spray", amount: 1 },
      { food: "sauce", amount: 1 },
    ],
  },
  dinner_fish_light: {
    key: "dinner_fish_light",
    name: "Fish Light",
    icon: "🐟",
    note: "Auto-suggested after beef/cheat/family lunch",
    items: [
      { food: "fish", amount: 333 },
      { food: "egg", amount: 2 },
      { food: "oil_spray", amount: 1 },
      { food: "sauce", amount: 1 },
    ],
  },
};

const TRAINING_DAY_TYPES = [
  { id: "rest",     label: "Rest Day",     icon: "🛏️", color: "#6b5a3e", target: 2400 },
  { id: "push",     label: "Push Day",     icon: "💪", color: "#c44827", target: 2700 },
  { id: "pull",     label: "Pull Day",     icon: "🎯", color: "#c44827", target: 2700 },
  { id: "legs",     label: "Leg Day",      icon: "🦵", color: "#c44827", target: 2700 },
  { id: "football", label: "Football Day", icon: "⚽", color: "#4a6b3e", target: 2750 },
];

const COFFEE_SCHEDULE = [
  { time: "9:00 AM",        label: "1st cup" },
  { time: "11:00 AM",       label: "2nd cup" },
  { time: "2:00 PM",        label: "3rd cup" },
  { time: "4:00 PM",        label: "4th cup" },
  { time: "5:30–6:00 PM",   label: "Last cup", note: "After this: tea without sugar only" },
];

const HEALTHY_FAST_FOOD_TIPS = [
  { craving: "Pizza",    swap: "Thin crust, chicken topping, no extra cheese",     why: "Saves ~200 kcal, +9g protein per 3 slices" },
  { craving: "Pasta",    swap: "Whole grain pasta + grilled chicken + tomato sauce",why: "Complex carbs, lean protein, ~600 kcal" },
  { craving: "Burger",   swap: "Grilled chicken burger, no mayo, lettuce wrap",     why: "Saves 250 kcal, doubles protein ratio" },
  { craving: "Soup",     swap: "Clear chicken/beef broth with vegetables, no cream",why: "High volume, 25g protein, ~250 kcal" },
  { craving: "Khichuri", swap: "More beef + dal, less oil, add eggs",               why: "Doubles protein" },
  { craving: "Tehari",   swap: "Less rice, more beef, less ghee",                   why: "Hits 80g protein vs 43g original" },
];

const GROCERY_TEMPLATE = [
  // Protein
  { key: "chicken_thigh",  name: "Chicken Thigh (skinless)", category: "Protein",         unit: "g",      initialQty: 1000, packetSize: 333,  lowThreshold: 333, icon: "🍗" },
  { key: "chicken_legs",   name: "Chicken Legs (skinless)",  category: "Protein",         unit: "g",      initialQty: 1000, packetSize: 500,  lowThreshold: 500, icon: "🍗" },
  { key: "chicken_breast", name: "Chicken Breast",           category: "Protein",         unit: "g",      initialQty: 0,    packetSize: 333,  lowThreshold: 333, icon: "🍗", optional: true },
  { key: "beef",           name: "Lean Beef (pur cut)",      category: "Protein",         unit: "g",      initialQty: 3000, packetSize: 250,  lowThreshold: 500, icon: "🥩" },
  { key: "fish",           name: "Fish (Tilapia/Rui)",       category: "Protein",         unit: "g",      initialQty: 1000, packetSize: 333,  lowThreshold: 333, icon: "🐟" },
  { key: "egg",            name: "Eggs",                     category: "Protein",         unit: "pc",     initialQty: 30,   packetSize: 12,   lowThreshold: 6,   icon: "🥚" },

  // Dairy & Shake
  { key: "milk",           name: "Milk",                     category: "Dairy & Shake",   unit: "ml",     initialQty: 1000, packetSize: 1000, lowThreshold: 250, icon: "🥛" },
  { key: "cashew",         name: "Cashew (Kaju)",            category: "Dairy & Shake",   unit: "g",      initialQty: 250,  packetSize: 250,  lowThreshold: 50,  icon: "🥜" },
  { key: "dates",          name: "Dates (Khejur)",           category: "Dairy & Shake",   unit: "g",      initialQty: 250,  packetSize: 250,  lowThreshold: 60,  icon: "🌴" },
  { key: "peanut",         name: "Peanut/Mixed Nuts",        category: "Dairy & Shake",   unit: "g",      initialQty: 250,  packetSize: 250,  lowThreshold: 60,  icon: "🥜" },

  // Aromatics
  { key: "onion",          name: "Onion (Peyaj)",            category: "Aromatics",       unit: "g",      initialQty: 1000, packetSize: 1000, lowThreshold: 200, icon: "🧅" },
  { key: "garlic",         name: "Garlic (Roshun)",          category: "Aromatics",       unit: "g",      initialQty: 250,  packetSize: 250,  lowThreshold: 50,  icon: "🧄" },
  { key: "ginger",         name: "Ginger (Ada)",             category: "Aromatics",       unit: "g",      initialQty: 200,  packetSize: 200,  lowThreshold: 50,  icon: "🫚" },

  // Moshla
  { key: "holoud",         name: "Holoud (Turmeric)",        category: "Moshla",          unit: "g",      initialQty: 100,  packetSize: 100,  lowThreshold: 20,  icon: "🌶️" },
  { key: "morich",         name: "Morich (Chili)",           category: "Moshla",          unit: "g",      initialQty: 100,  packetSize: 100,  lowThreshold: 20,  icon: "🌶️" },
  { key: "zira",           name: "Zira (Cumin)",             category: "Moshla",          unit: "g",      initialQty: 100,  packetSize: 100,  lowThreshold: 20,  icon: "🌿" },
  { key: "dhonia",         name: "Dhonia (Coriander)",       category: "Moshla",          unit: "g",      initialQty: 100,  packetSize: 100,  lowThreshold: 20,  icon: "🌿" },
  { key: "gorom_moshla",   name: "Gorom Moshla",             category: "Moshla",          unit: "g",      initialQty: 50,   packetSize: 50,   lowThreshold: 15,  icon: "✨" },

  // Fresh
  { key: "cucumber",       name: "Cucumber",                 category: "Fresh",           unit: "g",      initialQty: 1000, packetSize: 200,  lowThreshold: 400, icon: "🥒" },
  { key: "fruits",         name: "Mixed Fruits",             category: "Fresh",           unit: "g",      initialQty: 1500, packetSize: 250,  lowThreshold: 500, icon: "🍎" },

  // Pantry
  { key: "rice",           name: "Rice (raw)",               category: "Pantry",          unit: "g",      initialQty: 5000, packetSize: 1000, lowThreshold: 1000,icon: "🍚" },
  { key: "dal",            name: "Dal/Lentils",              category: "Pantry",          unit: "g",      initialQty: 1000, packetSize: 500,  lowThreshold: 250, icon: "🥣" },
  { key: "oil",            name: "Cooking Oil",              category: "Pantry",          unit: "ml",     initialQty: 1000, packetSize: 500,  lowThreshold: 200, icon: "🫗" },
  { key: "ghee",           name: "Ghee",                     category: "Pantry",          unit: "g",      initialQty: 250,  packetSize: 250,  lowThreshold: 50,  icon: "🧈" },
  { key: "oil_spray",      name: "Oil Spray",                category: "Pantry",          unit: "bottle", initialQty: 1,    packetSize: 1,    lowThreshold: 1,   icon: "🫧" },
  { key: "sauce",          name: "Sauce",                    category: "Pantry",          unit: "cup",    initialQty: 14,   packetSize: 14,   lowThreshold: 4,   icon: "🌶️" },
];

const GROCERY_CATEGORIES = ["Protein", "Dairy & Shake", "Aromatics", "Moshla", "Fresh", "Pantry"];

const CHEAT_BASELINE_KCAL = 1019;

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
  for (const it of items || []) {
    const f = FOODS[it.food];
    if (!f) continue;
    kcal += f.kcal * it.amount;
    protein += f.protein * it.amount;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
}

function calcDayTotals(meals) {
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
      surplus += Math.max(0, c.kcal - CHEAT_BASELINE_KCAL);
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

function targetForDay(dayType, steps) {
  const base = TRAINING_DAY_TYPES.find((d) => d.id === dayType)?.target ?? 2400;
  let adj = 0;
  if (steps != null && steps !== "") {
    const n = Number(steps);
    if (!Number.isNaN(n)) {
      if (n < 8000) adj = -100;
      else if (n > 12000) adj = +100;
    }
  }
  return { kcal: base + adj, protein: 180 };
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

function freshGrocery() {
  return GROCERY_TEMPLATE.map((g) => ({ ...g, currentQty: g.initialQty }));
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

function Masthead({ date }) {
  const d = new Date(date);
  const dateLong = d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <header className="border-b-2 border-ink pb-3 mb-6">
      <div className="flex items-end justify-between text-[10px] tracking-[0.2em] font-mono uppercase text-ink-muted">
        <div>No. {date}</div>
        <div>Vol. I</div>
      </div>
      <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-none mt-1">
        The Daily Plate
      </h1>
      <div className="flex items-center justify-between mt-2 text-[10px] tracking-[0.2em] font-mono uppercase text-ink-muted">
        <div className="italic font-display">A kitchen journal · 5'11" / 86kg</div>
        <div>{dateLong}</div>
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
    { id: "build",   label: "Build" },
  ];
  return (
    <nav className="border-y border-ink mb-6">
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              onClick={() => setTab(t.id)}
              className={`w-full py-3 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors ${
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

function TrainingDayBadge({ trainingDay, onChange }) {
  const types = TRAINING_DAY_TYPES;
  const current = types.find((t) => t.id === trainingDay) || null;
  const cycle = () => {
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
        <a
          href={WORKOUT_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] uppercase tracking-[0.2em] flex items-center gap-1 hover:text-accent"
        >
          Workout app <ExternalLink size={11} />
        </a>
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

function CoffeeTracker({ coffee, setCoffee }) {
  const toggle = (i) => {
    const next = [...coffee];
    next[i] = !next[i];
    setCoffee(next);
  };
  return (
    <div className="border border-ink p-4">
      <div className="flex items-center gap-2 mb-3">
        <Coffee size={14} />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Coffee schedule</span>
      </div>
      <ul className="space-y-2">
        {COFFEE_SCHEDULE.map((c, i) => (
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
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mt-3 italic">
        {COFFEE_SCHEDULE[4].note}
      </div>
    </div>
  );
}

function MealSlot({
  slot,
  label,
  meal,
  presets,
  trainingDay,
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
        </div>
      ) : (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
            Quick add
          </div>
          <div className="space-y-2">
            {Object.values(presets).map((p) => {
              const c = calcMeal(p.items);
              const recommended =
                slot === "shake" &&
                ((p.key === "shake_power" &&
                  ["push", "pull", "legs", "football"].includes(trainingDay)) ||
                  (p.key === "shake_standard" && trainingDay === "rest"));
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

function CheatMealCard({ preset, onLog }) {
  const [version, setVersion] = useState("original");
  const v = preset.versions[version];
  const totals = calcMeal(v.items);
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

      <ul className="text-sm space-y-1 mb-3">
        {v.items.map((it, i) => {
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

      <div className="border-t border-ink/20 pt-2 mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
        <span style={{ color: "#c44827" }}>{totals.kcal} kcal</span>
        <span>{totals.protein}g protein</span>
      </div>

      <button
        onClick={() => onLog(preset, version)}
        className="w-full py-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-accent"
      >
        Log as lunch
      </button>
    </div>
  );
}

function GroceryRow({ item, onAdjust, onRestock }) {
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
        <div className="flex items-center gap-1">
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
            className="ml-1 px-2 py-1 border border-ink font-mono text-[9px] uppercase tracking-[0.2em] hover:bg-ink hover:text-paper"
          >
            Restock
          </button>
        </div>
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
  const [trainingDay, setTrainingDay] = useState(null);
  const [steps, setSteps] = useState(null);
  const [meals, setMeals] = useState({ lunch: null, shake: null, dinner: null });
  const [coffee, setCoffee] = useState([false, false, false, false, false]);
  const [grocery, setGrocery] = useState(freshGrocery());
  const [weekDays, setWeekDays] = useState([]);
  const [plannedWeek, setPlannedWeek] = useState({});
  const [loading, setLoading] = useState(true);

  /* ----- Initial load ----- */
  useEffect(() => {
    (async () => {
      const todayMeals = await loadKey(`meals:${date}`, { meals: { lunch: null, shake: null, dinner: null } });
      const todayCoffee = await loadKey(`coffee:${date}`, [false, false, false, false, false]);
      const todayTraining = await loadKey(`training:${date}`, null);
      const todaySteps = await loadKey(`steps:${date}`, null);
      const groceryStored = await loadKey("grocery:current", null);
      const planStored = await loadKey("plan:current_week", null);

      if (todayMeals?.meals) setMeals(todayMeals.meals);
      if (Array.isArray(todayCoffee) && todayCoffee.length === 5) setCoffee(todayCoffee);
      setTrainingDay(todayTraining);
      setSteps(todaySteps);
      setGrocery(Array.isArray(groceryStored) && groceryStored.length ? groceryStored : freshGrocery());
      if (planStored) setPlannedWeek(planStored);

      // Load last 7 days for week tab
      await reloadWeek();

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- Save effects ----- */
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

  /* ----- Cheat day surplus persistence ----- */
  useEffect(() => {
    if (loading) return;
    const totals = calcDayTotals(meals);
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
  }, [meals, date, loading]);

  /* ----- Week loader ----- */
  async function reloadWeek() {
    const days = weekDateKeys();
    const out = [];
    for (const k of days) {
      const m = await loadKey(`meals:${k}`, null);
      const t = await loadKey(`training:${k}`, null);
      const s = await loadKey(`steps:${k}`, null);
      const totals = m?.meals ? calcDayTotals(m.meals) : { kcal: 0, protein: 0, cheats: 0, surplus: 0 };
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
  }, [meals, trainingDay, steps]);

  /* ----- Meal logging ----- */
  function logMeal(slot, mealObj) {
    setMeals((prev) => {
      const next = { ...prev, [slot]: mealObj };
      // Auto-suggest light fish dinner after beef / cheat / family lunch.
      if (slot === "lunch" && !prev.dinner) {
        const triggersLight =
          mealObj?.key === "lunch_beef" ||
          mealObj?.isCheat ||
          mealObj?.key === "cheat_family_big_lunch";
        if (triggersLight) {
          const fl = DINNER_PRESETS.dinner_fish_light;
          next.dinner = { ...fl, items: fl.items.map((i) => ({ ...i })) };
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

  function logCheat(preset, version) {
    const v = preset.versions[version];
    const meal = {
      key: preset.key,
      name: `${preset.name} (${v.label})`,
      icon: preset.icon,
      note: v.note,
      items: v.items.map((i) => ({ ...i })),
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
    setGrocery(freshGrocery());
  }
  function clearShoppingPlan() {
    if (!confirm("Clear the planned week / shopping list?")) return;
    setPlannedWeek({});
  }

  /* ----- Reset today ----- */
  function resetToday() {
    if (!confirm("Reset today's meals, coffee, training, and steps?")) return;
    setMeals({ lunch: null, shake: null, dinner: null });
    setCoffee([false, false, false, false, false]);
    setTrainingDay(null);
    setSteps(null);
  }

  /* ----- Derived ----- */
  const target = useMemo(() => targetForDay(trainingDay, steps), [trainingDay, steps]);
  const totals = useMemo(() => calcDayTotals(meals), [meals]);
  const lowItems = useMemo(() => lowStockItems(grocery), [grocery]);

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
        <Masthead date={date} />
        <TabBar tab={tab} setTab={setTab} />

        {tab === "today" && (
          <TodayTab
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
            onSelectPreset={logPreset}
            onClearSlot={clearMeal}
            onCheatPrompt={() => setTab("cheat")}
            onViewGrocery={() => setTab("grocery")}
            onResetToday={resetToday}
          />
        )}

        {tab === "week" && <WeekTab weekDays={weekDays} />}

        {tab === "cheat" && (
          <CheatTab onLogCheat={logCheat} weekDays={weekDays} />
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
          />
        )}

        {tab === "build" && <BuildTab onLogMeal={logMeal} />}

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
  onSelectPreset,
  onClearSlot,
  onCheatPrompt,
  onViewGrocery,
  onResetToday,
}) {
  return (
    <div className="space-y-5">
      <TrainingDayBadge trainingDay={trainingDay} onChange={setTrainingDay} />
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

      <CoffeeTracker coffee={coffee} setCoffee={setCoffee} />

      <div className="grid grid-cols-1 gap-4">
        <MealSlot
          slot="lunch"
          label="Lunch · ~1 PM"
          meal={meals.lunch}
          presets={LUNCH_PRESETS}
          trainingDay={trainingDay}
          onSelect={(p) => onSelectPreset("lunch", p)}
          onClear={() => onClearSlot("lunch")}
          onCheatPrompt={onCheatPrompt}
        />
        <MealSlot
          slot="shake"
          label="Shake · ~4-5 PM"
          meal={meals.shake}
          presets={SHAKE_PRESETS}
          trainingDay={trainingDay}
          onSelect={(p) => onSelectPreset("shake", p)}
          onClear={() => onClearSlot("shake")}
        />
        <MealSlot
          slot="dinner"
          label="Dinner · ~9 PM"
          meal={meals.dinner}
          presets={DINNER_PRESETS}
          trainingDay={trainingDay}
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

function WeekTab({ weekDays }) {
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
          const tdy = TRAINING_DAY_TYPES.find((t) => t.id === d.training);
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

function CheatTab({ onLogCheat, weekDays }) {
  const totals = useMemo(() => calcWeekTotals(weekDays), [weekDays]);
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

      <div>
        <h3 className="font-display text-2xl font-black tracking-tight mb-3">Favorite cheat meals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(CHEAT_PRESETS).map((p) => (
            <CheatMealCard key={p.key} preset={p} onLog={onLogCheat} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-2xl font-black tracking-tight mb-1">
          Healthy fast-food swaps
        </h3>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-3">
          Reference only · not auto-logged
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HEALTHY_FAST_FOOD_TIPS.map((t, i) => (
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
}) {
  const [view, setView] = useState("inventory"); // inventory | shopping | reset
  const [plannerOpen, setPlannerOpen] = useState(false);

  const groupedByCategory = useMemo(() => {
    const out = {};
    for (const cat of GROCERY_CATEGORIES) out[cat] = [];
    for (const g of grocery) {
      if (!out[g.category]) out[g.category] = [];
      out[g.category].push(g);
    }
    return out;
  }, [grocery]);

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
          {GROCERY_CATEGORIES.map((cat) => {
            const items = groupedByCategory[cat] || [];
            if (!items.length) return null;
            return (
              <section key={cat}>
                <h3 className="font-display text-2xl font-black tracking-tight mb-2">{cat}</h3>
                <div className="space-y-2">
                  {items.map((it) => (
                    <GroceryRow key={it.key} item={it} onAdjust={onAdjust} onRestock={onRestock} />
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
        />
      )}
    </div>
  );
}

function WeekPlannerModal({ plannedWeek, setPlannedWeek, onClose }) {
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
    if (slot === "lunch") return Object.values(LUNCH_PRESETS);
    if (slot === "shake") return Object.values(SHAKE_PRESETS);
    if (slot === "dinner") return Object.values(DINNER_PRESETS);
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

function BuildTab({ onLogMeal }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("Custom meal");
  const totals = useMemo(() => calcMeal(items), [items]);

  function addItem(item) {
    if (!item.amount) return;
    setItems((prev) => [...prev, item]);
  }
  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function saveAs(slot) {
    if (!items.length) return;
    onLogMeal(slot, {
      key: "custom",
      name,
      icon: "✍",
      items: items.map((i) => ({ ...i })),
      isCheat: false,
    });
    setItems([]);
    setName("Custom meal");
  }

  return (
    <div className="space-y-5">
      <div className="border-b-2 border-ink pb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          Compose your own
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Build a meal</h2>
      </div>

      <div className="border-2 border-ink p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full font-display text-2xl font-bold bg-paper border-b border-ink py-1 mb-3 focus:outline-none"
          placeholder="Meal name"
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

      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "lunch", label: "Save as Lunch" },
          { id: "shake", label: "Save as Shake" },
          { id: "dinner", label: "Save as Dinner" },
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
  );
}
