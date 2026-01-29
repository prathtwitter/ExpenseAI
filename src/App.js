import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  FileText,
  MapPin,
  CreditCard,
  Share2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Wallet,
  Calendar,
  PieChart,
  ScanLine,
  Download,
  Tag,
  Upload,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  BarChart3,
  File,
  Layers,
  Trash2,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Gem,
  Send,
  Microscope,
  Settings,
  Target,
  Skull,
  ShoppingBag,
  Utensils,
  Copy,
  FileJson,
  Search,
  MessageSquare,
  Menu,
  X,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  RefreshCw,
  Quote,
  Plus,
  PenTool,
  Repeat,
  ShieldAlert,
  Zap,
  Store,
  Clock,
  Globe,
  Wrench,
  Cloud,
} from "lucide-react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

// ==========================================
// 1. CONFIGURATION & FIREBASE
// ==========================================

const GEMINI_API_KEY = "AIzaSyC9yedQIgK_BOEUrdRRqUVpTSAVKAiokSk";
const SHARED_APP_ID = "expense-ai-household-v1";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCAfE8ppYRgQV-_cQ46sdMWhwJx5Qkh9D4",
  authDomain: "expenseai-32956.firebaseapp.com",
  projectId: "expenseai-32956",
  storageBucket: "expenseai-32956.firebasestorage.app",
  messagingSenderId: "641707698674",
  appId: "1:641707698674:web:e20f4ba930660bb9b9636b",
  measurementId: "G-N8MXQVWN01",
};

// --- ROBUST FIREBASE INITIALIZATION ---
// This ensures 'db' is always defined, even if the app re-renders.
let app, auth, db;
try {
  if (getApps().length === 0) {
    app = initializeApp(FIREBASE_CONFIG);
  } else {
    app = getApps()[0]; // Use existing app instance
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase Init Critical Error:", e);
}

// Standard Categories
const STANDARD_CATEGORIES = [
  "Groceries",
  "Dining",
  "Electronics",
  "Subscriptions",
  "Health",
  "Home",
  "Apparel",
  "Transport",
  "Entertainment",
  "Phone",
  "Internet",
  "Utilities",
  "Insurance",
  "Cosmetics",
  "Other",
];

// Currencies for correction
const SUPPORTED_CURRENCIES = ["CAD", "USD", "INR", "EUR", "GBP"];

const SUBSCRIPTION_KEYWORDS = [
  "netflix",
  "spotify",
  "apple",
  "google",
  "prime",
  "rogers",
  "bell",
  "telus",
  "hydro",
  "enbridge",
  "insurance",
  "fitness",
  "gym",
];

// ==========================================
// 2. UTILITIES (Helpers)
// ==========================================

const cleanAndParseJSON = (text) => {
  if (typeof text !== "string") return {};
  try {
    let clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(clean);
  } catch (e) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e2) {
      console.error("JSON Parse Failed:", text);
      return null;
    }
    return null;
  }
};

const calculateGrowth = (current, previous) => {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

// INTELLIGENT MERCHANT NORMALIZATION (Updated V2)
const normalizeMerchantName = (rawName) => {
  if (!rawName) return "Unknown";
  let lower = rawName.toLowerCase().trim();
  lower = lower.replace(/(\.ca|\.com|\.org|\.net|\.co\.uk)/g, "");
  lower = lower.replace(/['’]/g, "");
  lower = lower.replace(/\s+/g, " ");

  if (lower.includes("amazon")) return "Amazon";
  if (lower.includes("temu")) return "Temu";
  if (lower.includes("netflix")) return "Netflix";
  if (lower.includes("spotify")) return "Spotify";
  if (lower.includes("apple") || lower.includes("itunes")) return "Apple";
  if (lower.includes("google")) return "Google";
  if (
    lower.includes("freshco") ||
    (lower.includes("fresh") && lower.includes("co"))
  )
    return "FreshCo";
  if (lower.includes("costco")) return "Costco";
  if (lower.includes("walmart")) return "Walmart";
  if (lower.includes("no frills")) return "No Frills";
  if (lower.includes("loblaws")) return "Loblaws";
  if (lower.includes("metro") && !lower.includes("metrolinx")) return "Metro";
  if (lower.includes("shoppers drug")) return "Shoppers Drug Mart";
  if (lower.includes("longo")) return "Longo's";
  if (lower.includes("sobeys")) return "Sobeys";
  if (lower.includes("dollarama")) return "Dollarama";
  if (lower.includes("lcbo")) return "LCBO";
  if (
    /\bgap\b/.test(lower) ||
    lower.includes("gap factory") ||
    lower.includes("gap outlet")
  )
    return "Gap";
  if (lower.includes("uniqlo")) return "Uniqlo";
  if (lower.includes("h&m") || lower.includes("h & m")) return "H&M";
  if (lower.includes("zara")) return "Zara";
  if (lower.includes("winners")) return "Winners";
  if (lower.includes("homesense")) return "HomeSense";
  if (lower.includes("canadian tire")) return "Canadian Tire";
  if (lower.includes("uber") && lower.includes("eats")) return "Uber Eats";
  if (lower.includes("uber")) return "Uber";
  if (lower.includes("mcdonald")) return "McDonald's";
  if (lower.includes("starbucks")) return "Starbucks";
  if (lower.includes("tim horton")) return "Tim Hortons";
  if (lower.includes("subway")) return "Subway";
  if (lower.includes("chipotle")) return "Chipotle";

  return lower
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getMonthlyDataHelper = (receipts) => {
  const groups = {};
  receipts.forEach((r) => {
    // FIX: Parse YYYY-MM-DD manually to prevent timezone shifts
    let dateObj;
    if (r.date && typeof r.date === "string" && r.date.includes("-")) {
      const [y, m, d] = r.date.split("-").map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(r.date || Date.now());
    }

    const monthKey = `${dateObj.getFullYear()}-${String(
      dateObj.getMonth() + 1
    ).padStart(2, "0")}`;
    const monthLabel = dateObj.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    if (!groups[monthKey])
      groups[monthKey] = {
        label: monthLabel,
        total: 0,
        categories: {},
        date: dateObj,
        monthKey,
      };

    const items =
      r.items && r.items.length > 0
        ? r.items
        : [{ name: "Total Bill", price: r.total, category: "General" }];
    items.forEach((item) => {
      const cat = item.category || "General";
      if (!groups[monthKey].categories[cat])
        groups[monthKey].categories[cat] = { total: 0, items: [] };
      const price = item.price || (item.name === "Total Bill" ? r.total : 0);
      groups[monthKey].categories[cat].total += price;
      groups[monthKey].categories[cat].items.push({
        ...item,
        merchant: r.merchant,
        date: r.date,
        price: price,
        qty: item.qty,
      });
      groups[monthKey].total += price;
    });
  });
  return Object.values(groups).sort((a, b) => b.date - a.date);
};

const getVendorDataHelper = (receipts) => {
  const vendors = {};
  receipts.forEach((r) => {
    const name = normalizeMerchantName(r.merchant);
    if (!vendors[name]) vendors[name] = { name, total: 0, months: {} };
    vendors[name].total += r.total;

    // FIX: Parse YYYY-MM-DD manually
    let dateObj;
    if (r.date && typeof r.date === "string" && r.date.includes("-")) {
      const [y, m, d] = r.date.split("-").map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(r.date || Date.now());
    }

    const monthKey = `${dateObj.getFullYear()}-${String(
      dateObj.getMonth() + 1
    ).padStart(2, "0")}`;
    const monthLabel = dateObj.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    if (!vendors[name].months[monthKey]) {
      vendors[name].months[monthKey] = {
        label: monthLabel,
        total: 0,
        categories: {},
        dateObj,
      };
    }
    vendors[name].months[monthKey].total += r.total;

    const items =
      r.items && r.items.length > 0
        ? r.items
        : [{ category: "General", price: r.total }];
    items.forEach((i) => {
      const cat = i.category || "General";
      const price = i.price || 0;
      if (!vendors[name].months[monthKey].categories[cat]) {
        vendors[name].months[monthKey].categories[cat] = 0;
      }
      vendors[name].months[monthKey].categories[cat] += price;
    });
  });
  return Object.values(vendors).sort((a, b) => b.total - a.total);
};

const detectVampires = (receipts) => {
  const merchantMap = {};
  receipts.forEach((r) => {
    const name = normalizeMerchantName(r.merchant);
    if (!merchantMap[name])
      merchantMap[name] = { count: 0, total: 0, merchant: name, dates: [] };
    merchantMap[name].count += 1;
    merchantMap[name].total += r.total;
    merchantMap[name].dates.push(r.date);
  });

  const vampires = [];
  Object.values(merchantMap).forEach((m) => {
    const isKeywordMatch = SUBSCRIPTION_KEYWORDS.some((k) =>
      m.merchant.toLowerCase().includes(k)
    );
    if (isKeywordMatch || m.count > 1) {
      const avg = m.total / m.count;
      vampires.push({
        name: m.merchant,
        avgCost: avg,
        frequency: m.count,
        isSuspect: !isKeywordMatch,
      });
    }
  });
  return vampires.sort((a, b) => b.avgCost - a.avgCost);
};

// ==========================================
// 3. SERVICES (Gemini AI Logic)
// ==========================================

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

const callGemini = async (prompt, imagePart = null) => {
  const body = {
    contents: [
      {
        parts: imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }],
      },
    ],
  };
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const analyzeReceiptService = async (base64Data, mimeType) => {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `
      Today is ${today}.
      Analyze this receipt (image or PDF). Return JSON ONLY.
      
      CRITICAL:
      1. If year is ambiguous (e.g. "25"), assume current year 2025.
      2. Format date strictly as YYYY-MM-DD.

      Classify items into exactly one of these categories: 
      [${STANDARD_CATEGORIES.join(", ")}].
      *Note: Combs, hair dryers, shampoos, makeup go to 'Cosmetics'.
      *Note: ALL Alcohol (Beer, Wine, LCBO, Liquor) and Cannabis products MUST be categorized as 'Entertainment'.
      
      Structure: { 
        "merchant": "Store Name", 
        "location": "City/Addr", 
        "date": "YYYY-MM-DD", 
        "paymentMethod": "Card/Cash", 
        "total": 0.00, 
        "items": [{ "name": "Item Name", "category": "CategoryFromList", "price": 0.00, "qty": 1 }] 
      }
      Prioritize accuracy on the Total and Date. If qty is missing, assume 1.
    `;
  const text = await callGemini(prompt, {
    inlineData: { mimeType, data: base64Data },
  });
  return cleanAndParseJSON(text);
};

const runForensicAuditService = async (
  summaryStr,
  income,
  fixedCosts,
  currentTotal
) => {
  const prompt = `
        Act as "Prath's Ruthless Financial Strategist".
        CONTEXT:
        - Monthly Income: $${income}
        - Fixed Costs: $${fixedCosts}
        - Current Month Spend: $${currentTotal}
        
        DATA TO ANALYZE:
        ${summaryStr}

        GOAL: Find the "Smoking Gun" destroying the budget. Help Prath save aggressively.
        DO NOT COMPROMISE ON FOOD QUALITY (Protein/Health is vital).
        
        RETURN JSON ONLY. Structure:
        {
          "summary": "Brief 2-sentence executive summary.",
          "health_score": 75, // Integer 0-100 based on financial discipline
          "leaks": [{ "title": "Leak Name", "amount": 0.00, "insight": "Why bad", "action": "Rule" }],
          "dopamine": [{ "item": "Item Name", "cost": 0.00, "verdict": "Why unnecessary" }],
          "grocery_audit": { "good": ["Item"], "bad": ["Item"] },
          "next_month_plan": [{ "category": "Cat", "limit": 0, "strategy": "Strat" }],
          "immediate_step": "Confirmation phrase."
        }
      `;
  const text = await callGemini(prompt);
  return cleanAndParseJSON(text);
};

const generateStrategicInsightService = async (summaryData, periodTitle) => {
  const prompt = `
        Act as a financial strategist for Prath & Devashree.
        Analyze these expenses for the ${periodTitle} period: ${summaryData}.
        Format for WhatsApp. Structure:
        1. 📅 *${periodTitle} Insight*
        2. 💰 *Total:* $Amount
        3. 📊 *Top Categories:* (List top 3)
        4. 🧠 *Strategic Insight:* (One sharp sentence).
      `;
  return await callGemini(prompt);
};

const runChatAgentService = async (
  userMsg,
  contextData,
  income,
  fixedCosts
) => {
  const prompt = `
          System: You are an AI financial assistant embedded in an expense tracker app for Prath & Devashree.
          Budget Context: Income $${income}, Fixed Costs $${fixedCosts}.
          Recent Transaction Data: ${contextData}
          User Query: "${userMsg}"
          Task: Answer the user's question accurately.
        `;
  return await callGemini(prompt);
};

// ==========================================
// 4. UI COMPONENTS
// ==========================================

const Sidebar = ({
  activeView,
  onViewChange,
  exchangeRate,
  exchangeRateLoading,
  onDownloadBackup, // Prop for manual download
}) => {
  const menuItems = [
    { id: "scan", icon: <Camera size={20} />, label: "Scan" },
    { id: "list", icon: <FileText size={20} />, label: "History" },
    { id: "analytics", icon: <BarChart3 size={20} />, label: "Analytics" },
    { id: "summary", icon: <PieChart size={20} />, label: "Summary" },
    { id: "advisor", icon: <Microscope size={20} />, label: "Advisor" },
    { id: "chat", icon: <MessageSquare size={20} />, label: "Ask AI" },
  ];

  const getNextPayDetails = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let payDate = new Date("2025-11-28T00:00:00");
    while (payDate < today) {
      payDate.setDate(payDate.getDate() + 14);
    }
    const diffTime = payDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      dateStr: payDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      daysLeft: diffDays,
    };
  };

  const nextPay = getNextPayDetails();

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <Wallet className="text-white" size={20} />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Expense<span className="text-indigo-400">AI</span>
        </h1>
      </div>
      <div className="flex-1 py-6 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-200 border-l-4 ${
              activeView === item.id
                ? "bg-slate-800 text-white border-indigo-500"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        {/* MANUAL BACKUP BUTTON */}
        <button
          onClick={onDownloadBackup}
          className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-200 border-l-4 border-transparent text-emerald-400 hover:bg-slate-800/50 hover:text-emerald-300"
        >
          <Download size={20} />
          Backup Data
        </button>
      </div>
      <div className="p-6 border-t border-slate-800 space-y-4">
        {/* CAD to INR Exchange Rate Box */}
        <div className="bg-indigo-900/10 rounded-xl p-4 border border-indigo-500/20 relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 text-indigo-400">
            <RefreshCw size={14} />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              CAD to INR
            </h4>
          </div>
          <div className="flex justify-between items-end">
            {exchangeRateLoading ? (
              <span className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> ...
              </span>
            ) : exchangeRate ? (
              <>
                <span className="text-lg font-bold text-white font-mono">
                  ₹{exchangeRate.toFixed(2)}
                </span>
                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded flex items-center gap-1">
                  Live
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-red-400 font-mono">
                N/A
              </span>
            )}
          </div>
        </div>

        {/* Next Pay Box */}
        <div className="bg-emerald-900/10 rounded-xl p-4 border border-emerald-500/20 relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <DollarSign size={14} />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Next Pay
            </h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-lg font-bold text-white font-mono">
              {nextPay.dateStr}
            </span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded">
              {nextPay.daysLeft === 0
                ? "Today!"
                : `${nextPay.daysLeft} days left`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileNav = ({ activeView, onViewChange }) => {
  const menuItems = [
    { id: "scan", icon: <Camera size={18} />, label: "Scan" },
    { id: "list", icon: <FileText size={18} />, label: "History" },
    { id: "analytics", icon: <BarChart3 size={18} />, label: "Data" },
    { id: "advisor", icon: <Microscope size={18} />, label: "Advisor" },
    { id: "chat", icon: <MessageSquare size={18} />, label: "Ask AI" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe-area z-50">
      <div className="flex justify-around items-center h-16">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              activeView === item.id ? "text-indigo-400" : "text-slate-500"
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ReceiptCard = ({ data, onDelete, onShare, onConvert }) => {
  const [expanded, setExpanded] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState("CAD");

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 mb-3 group hover:bg-slate-800/60 transition-all">
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer flex justify-between items-start"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
            <FileText size={14} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              {data.merchant}
            </h3>
            {data.currencyNote && (
              <span className="text-[10px] text-amber-400 font-medium block">
                {data.currencyNote}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-white text-lg">
            ${data.total?.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500">{data.date}</div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 animate-in slide-in-from-top-2">
          <div className="space-y-2 mb-3">
            {data.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm text-slate-300"
              >
                <div>
                  <span className="block">{item.name}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                    {item.category || "General"}
                  </span>
                </div>
                <span className="font-mono text-slate-400">
                  ${item.price?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* CURRENCY CORRECTION TOOL */}
          <div className="bg-slate-900/50 p-3 rounded-lg mb-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-indigo-300">
              <Globe size={12} /> Correct Currency
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs p-2 rounded border border-slate-600 focus:border-indigo-500 outline-none appearance-none"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c} className="text-black">
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={12}
                />
              </div>
              <button
                onClick={() => onConvert(data, targetCurrency)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded flex items-center gap-1"
              >
                <RefreshCw size={12} /> Update
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Converts face value to CAD.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onDelete(data.id)}
              className="flex-1 p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-xs flex justify-center items-center gap-2"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              onClick={() => onShare(data)}
              className="flex-1 p-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 text-xs flex justify-center items-center gap-2"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MonthlyPulse = ({ receipts }) => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthName = now.toLocaleString("default", { month: "long" });

  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(
    prevDate.getMonth() + 1
  ).padStart(2, "0")}`;

  let currentTotal = 0;
  let prevTotal = 0;
  let topCategory = { name: "None", amount: 0 };
  const categoryMap = {};
  const allItems = [];

  receipts.forEach((r) => {
    // FIX: Date parsing consistency
    let dateObj;
    if (r.date && typeof r.date === "string" && r.date.includes("-")) {
      const [y, m, d] = r.date.split("-").map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(r.date);
    }

    const monthKey = `${dateObj.getFullYear()}-${String(
      dateObj.getMonth() + 1
    ).padStart(2, "0")}`;

    if (monthKey === currentMonthKey) {
      currentTotal += r.total || 0;
      const rItems = r.items || [
        { name: "Total Bill", price: r.total, category: "General" },
      ];
      rItems.forEach((i) => {
        const price = i.price || 0;
        const cat = i.category || "General";
        if (!categoryMap[cat]) categoryMap[cat] = 0;
        categoryMap[cat] += price;
        allItems.push({
          name: i.name,
          price: price,
          merchant: r.merchant,
          category: cat,
        });
      });
    } else if (monthKey === prevMonthKey) {
      prevTotal += r.total || 0;
    }
  });

  Object.entries(categoryMap).forEach(([cat, amt]) => {
    if (amt > topCategory.amount) topCategory = { name: cat, amount: amt };
  });

  allItems.sort((a, b) => b.price - a.price);
  const top3 = allItems.slice(0, 3);
  const isPositive = currentTotal <= prevTotal && prevTotal > 0;
  let diffStory = "";

  if (prevTotal === 0) {
    diffStory = "Initial baseline established.";
  } else {
    const diff = ((currentTotal - prevTotal) / prevTotal) * 100;
    const diffAbs = Math.abs(diff).toFixed(0) + "%";
    diffStory = diff > 0 ? `up ${diffAbs}` : `down ${diffAbs}`;
  }

  let narrative = "";
  if (currentTotal === 0) {
    narrative =
      "No expenses logged for this month yet. Start scanning to see your pulse.";
  } else if (prevTotal === 0) {
    narrative = `Baseline Month: High spend in ${
      topCategory.name
    } ($${topCategory.amount.toFixed(0)}).`;
  } else if (isPositive) {
    narrative = `Great job! Spending is ${diffStory} vs last month. You kept ${topCategory.name} in check.`;
  } else {
    narrative = `Warning: Spending is ${diffStory} vs last month. The surge is driven by ${
      topCategory.name
    } ($${topCategory.amount.toFixed(0)}).`;
  }

  const isAlert = currentTotal > prevTotal || prevTotal === 0;

  return (
    <div
      className={`rounded-xl p-5 border relative overflow-hidden transition-all ${
        !isAlert
          ? "bg-emerald-900/20 border-emerald-500/30"
          : "bg-red-900/10 border-red-500/30"
      }`}
    >
      <div className="flex items-start gap-4 relative z-10">
        <div
          className={`p-3 rounded-xl shrink-0 ${
            !isAlert
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {!isAlert ? <ThumbsUp size={24} /> : <AlertCircle size={24} />}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3
              className={`text-sm font-bold uppercase tracking-wider ${
                !isAlert ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {!isAlert ? "On Track" : "Spending Alert"}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {monthName}
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-medium mb-4">
            {narrative}
          </p>

          {top3.length > 0 && (
            <div className="bg-black/20 rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Top Drivers
              </p>
              {top3.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-[11px] text-slate-300 border-b border-white/5 pb-1 last:border-0 last:pb-0"
                >
                  <span className="truncate max-w-[180px]">{item.name}</span>
                  <span className="font-mono font-bold">
                    ${item.price.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. VIEW COMPONENTS
// ==========================================

const ScanHomeView = ({
  analyzing,
  progressText,
  handleFileUpload,
  cameraInputRef,
  galleryInputRef,
  receipts,
  onManualEntry,
}) => {
  const [reportLoading, setReportLoading] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({
    merchant: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "Other",
    description: "",
  });

  const handleManualSubmit = () => {
    if (!manualData.merchant || !manualData.amount) {
      alert("Please enter Merchant and Amount.");
      return;
    }
    onManualEntry(manualData);
    setManualData({
      merchant: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      category: "Other",
      description: "",
    });
    setShowManualModal(false);
  };

  const handleGenerateInsight = async (type) => {
    setReportLoading(type);
    try {
      const summaryData = JSON.stringify(
        receipts.slice(0, 20).map((r) => ({
          merchant: r.merchant,
          total: r.total,
          category: r.items?.[0]?.category || "General",
        }))
      );
      const text = await generateStrategicInsightService(summaryData, type);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    } catch (err) {
      alert("Report failed.");
    } finally {
      setReportLoading(null);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      {/* SCANNING AREA */}
      <div className="relative aspect-[3/4] w-full rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden group shadow-2xl mb-6">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          disabled={analyzing}
        />
        <div className="absolute inset-0 pointer-events-none z-10 p-8 flex flex-col items-center justify-center">
          {analyzing ? (
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="text-indigo-400 animate-spin" />
              {progressText && (
                <p className="text-xs text-indigo-300 mt-4 font-mono">
                  {progressText}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 text-indigo-400">
                <Camera size={32} />
              </div>
              <p className="text-slate-400 text-sm text-center">Tap to Scan</p>
            </>
          )}
        </div>
      </div>

      {/* ACTIONS ROW */}
      <div className="flex gap-2 mb-6">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          ref={galleryInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => galleryInputRef.current.click()}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl flex items-center justify-center gap-2 text-slate-300 text-xs font-semibold hover:bg-slate-800"
        >
          <Layers size={16} className="text-emerald-400" /> Batch Upload
        </button>
        <button
          onClick={() => setShowManualModal(true)}
          className="flex-1 bg-indigo-600/20 border border-indigo-500/30 p-3 rounded-xl flex items-center justify-center gap-2 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30"
        >
          <PenTool size={16} /> Manual Entry
        </button>
      </div>

      {/* MONTHLY PULSE */}
      <div className="mt-6">
        <MonthlyPulse receipts={receipts} />
      </div>

      {/* STRATEGIC INSIGHTS */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-200">
            Strategic Insights
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              type: "weekly",
              title: "Weekly Check",
              quote: '"Wealth is what you don\'t see."',
            },
            {
              type: "monthly",
              title: "Monthly Review",
              quote: '"Savings is the gap between your ego and your income."',
            },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => handleGenerateInsight(item.type)}
              disabled={reportLoading !== null}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3 text-left group transition-all relative overflow-hidden"
            >
              <div className="p-2 bg-slate-900 rounded-lg text-indigo-400 shrink-0 group-hover:text-emerald-400 transition-colors">
                {reportLoading === item.type ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Quote size={16} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {item.title}
                  </span>
                  <MessageCircle size={10} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-300 font-serif italic mb-1">
                  {item.quote}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MANUAL ENTRY MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                <PenTool size={18} className="text-indigo-400" /> Manual Entry
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Merchant */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Merchant / Store
                </label>
                <input
                  type="text"
                  value={manualData.merchant}
                  onChange={(e) =>
                    setManualData({ ...manualData, merchant: e.target.value })
                  }
                  placeholder="e.g. Starbucks, Uber, Walmart"
                  className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Total ($)
                  </label>
                  <input
                    type="number"
                    value={manualData.amount}
                    onChange={(e) =>
                      setManualData({ ...manualData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none font-mono"
                  />
                </div>
                {/* Date */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={manualData.date}
                    onChange={(e) =>
                      setManualData({ ...manualData, date: e.target.value })
                    }
                    className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={manualData.category}
                    onChange={(e) =>
                      setManualData({ ...manualData, category: e.target.value })
                    }
                    className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none appearance-none"
                  >
                    {STANDARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="text-black">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    size={16}
                  />
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Item Description (Optional)
                </label>
                <input
                  type="text"
                  value={manualData.description}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      description: e.target.value,
                    })
                  }
                  placeholder="What did you buy?"
                  className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:border-indigo-500 outline-none"
                />
              </div>

              <button
                onClick={handleManualSubmit}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 mt-2 transition-all"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdvisorView = ({
  receipts,
  budgetConfig,
  setBudgetConfig,
  showBudgetSettings,
  setShowBudgetSettings,
  forensicData,
  setForensicData,
  reportLoading,
  setReportLoading,
  copySuccess,
  setCopySuccess,
}) => {
  const months = getMonthlyDataHelper(receipts);
  const [selectedMonth, setSelectedMonth] = useState(
    months.length > 0 ? months[0].monthKey : ""
  );

  useEffect(() => {
    if (!selectedMonth && months.length > 0) {
      setSelectedMonth(months[0].monthKey);
    }
  }, [months, selectedMonth]);

  const vampires = detectVampires(receipts);

  const handleRunAudit = async () => {
    setReportLoading(true);
    setForensicData(null);
    setCopySuccess(false);

    const monthData = months.find((m) => m.monthKey === selectedMonth);
    if (!monthData) {
      alert("No data for selected month");
      setReportLoading(false);
      return;
    }

    try {
      const allItems = [];
      Object.values(monthData.categories).forEach((cat) => {
        cat.items.forEach((item) =>
          allItems.push(
            `${item.name} ($${item.price}, ${item.merchant}, Category: ${item.category})`
          )
        );
      });

      const summaryStr = allItems.join("\n");
      const monthlyIncome = budgetConfig.income * 2;
      const totalFixed =
        parseFloat(budgetConfig.rent) +
        parseFloat(budgetConfig.utilities) +
        parseFloat(budgetConfig.internet) +
        parseFloat(budgetConfig.phone);

      const result = await runForensicAuditService(
        summaryStr,
        monthlyIncome,
        totalFixed,
        monthData.total
      );
      setForensicData(result);
    } catch (e) {
      console.error(e);
      alert("Audit Failed");
    } finally {
      setReportLoading(false);
    }
  };

  const handleFixCategories = async () => {
    if (
      !confirm(
        "This will find all 'LCBO', 'Beer Store', 'Cannabis', 'Wine' etc. transactions and move them to 'Entertainment'. This cannot be undone. Continue?"
      )
    )
      return;

    setReportLoading(true);
    try {
      const keywords = [
        "lcbo",
        "beer store",
        "wine rack",
        "canna",
        "tokyo smoke",
        "value buds",
        "ocs",
        "liquor",
        "dispensary",
        "wine shop",
      ];
      let count = 0;

      for (const r of receipts) {
        const lowerMerchant = r.merchant.toLowerCase();
        const shouldFix = keywords.some((k) => lowerMerchant.includes(k));

        if (shouldFix) {
          const newItems = r.items.map((i) => ({
            ...i,
            category: "Entertainment",
          }));
          await updateDoc(
            doc(
              db,
              "artifacts",
              SHARED_APP_ID,
              "public",
              "data",
              "household_ledger",
              r.id
            ),
            {
              items: newItems,
              category: "Entertainment", // Optional top-level
            }
          );
          count++;
        }
      }
      alert(`Success! Updated ${count} receipts to Entertainment.`);
    } catch (e) {
      console.error(e);
      alert("Update failed.");
    } finally {
      setReportLoading(false);
    }
  };

  const copyReport = () => {
    if (!forensicData) return;
    const reportText = `🕵️‍♂️ Prath Forensic Audit\n\nSUMMARY: ${
      forensicData.summary
    }\n\nLEAKS: ${forensicData.leaks
      .map((l) => `${l.title} (-$${l.amount})`)
      .join(", ")}`;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="animate-in fade-in pb-20">
      {/* 1. FINANCIAL HEALTH GAUGE */}
      {forensicData && forensicData.health_score && (
        <div className="mb-6 animate-in slide-in-from-top-4">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden">
            <div
              className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 ${
                forensicData.health_score > 70 ? "bg-emerald-500" : "bg-red-500"
              }`}
            ></div>
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Financial Health
                </h3>
                <div
                  className={`text-4xl font-bold ${
                    forensicData.health_score > 70
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {forensicData.health_score}/100
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Based on monthly efficiency
                </p>
              </div>
              <div className="h-16 w-16 rounded-full border-4 border-slate-700 flex items-center justify-center relative">
                <Target
                  size={24}
                  className={
                    forensicData.health_score > 70
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. RECURRING BILLS (VAMPIRES) */}
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-yellow-400" />
          <h3 className="text-sm font-bold text-slate-200">
            Vampire Costs (Recurring)
          </h3>
        </div>
        {vampires.length > 0 ? (
          <div className="space-y-2">
            {vampires.slice(0, 3).map((v, i) => (
              <div
                key={i}
                className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-800 rounded text-slate-400">
                    <Repeat size={12} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {v.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {v.frequency} transactions detected
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-white">
                    ${v.avgCost.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">avg. cost</div>
                </div>
              </div>
            ))}
            <div className="text-center text-[10px] text-slate-500 mt-2">
              These act as fixed costs. Review if essential.
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            No recurring bills detected yet.
          </div>
        )}
      </div>

      {/* 3. BUDGET CONFIG */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 mb-4 overflow-hidden">
        <button
          onClick={() => setShowBudgetSettings(!showBudgetSettings)}
          className="w-full p-4 flex justify-between items-center bg-slate-800"
        >
          <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
            <Settings size={16} className="text-indigo-400" /> Fixed Costs
            Config
          </div>
          {showBudgetSettings ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>
        {showBudgetSettings && (
          <div className="p-4 grid grid-cols-2 gap-3 text-xs bg-slate-900">
            {Object.keys(budgetConfig).map((key) => (
              <div key={key}>
                <label className="text-slate-500 block mb-1 capitalize">
                  {key}
                </label>
                <input
                  type="number"
                  value={budgetConfig[key]}
                  onChange={(e) =>
                    setBudgetConfig({
                      ...budgetConfig,
                      [key]: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 p-2 rounded border border-slate-600 text-white"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mb-6">
        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2 block">
          Select Audit Month
        </label>
        {months.length > 0 ? (
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setForensicData(null);
            }}
            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-600 focus:border-indigo-500 outline-none"
          >
            {months.map((m) => (
              <option key={m.monthKey} value={m.monthKey}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-slate-500 text-sm italic">
            No history available.
          </div>
        )}

        <button
          onClick={handleRunAudit}
          disabled={reportLoading || months.length === 0}
          className={`mt-4 w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            months.length === 0
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          {reportLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Microscope size={18} />
          )}
          Run Forensic Audit
        </button>

        {/* --- MAINTENANCE SECTION --- */}
        <button
          onClick={handleFixCategories}
          disabled={reportLoading || months.length === 0}
          className="mt-3 w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700/50 transition-all text-xs"
        >
          {reportLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Wrench size={14} />
          )}
          Fix Categories (Move Alcohol/Cannabis to Ent.)
        </button>
      </div>

      {forensicData && (
        <div className="space-y-4 animate-in slide-in-from-bottom-10">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Target className="text-red-500" /> Executive Summary
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {forensicData.summary}
            </p>
          </div>

          {/* VISUAL LEAK CARDS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Active Leaks (Bleeding)
            </h4>
            {(forensicData.leaks || []).map((item, idx) => (
              <div
                key={idx}
                className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-1 relative z-10">
                  <span className="font-bold text-red-200 text-sm flex items-center gap-2">
                    <ShieldAlert size={14} /> {item.title}
                  </span>
                  <span className="font-mono text-white font-bold bg-red-600 px-2 py-1 rounded text-xs">
                    -${item.amount}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-2 relative z-10">
                  {item.insight}
                </p>
                <div className="text-red-300 text-[10px] font-bold uppercase tracking-wide">
                  Action: {item.action}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-indigo-600 p-4 rounded-xl shadow-lg text-center">
            <p className="text-indigo-200 text-xs uppercase font-bold mb-2">
              Immediate Step
            </p>
            <div className="bg-white/10 p-3 rounded-lg text-white font-bold text-sm italic">
              "{forensicData.immediate_step}"
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyReport}
              className={`flex-1 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                copySuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {copySuccess ? <Sparkles size={14} /> : <Copy size={14} />}{" "}
              {copySuccess ? "Copied!" : "Copy Report"}
            </button>
            <button
              onClick={() => setForensicData(null)}
              className="flex-1 py-3 bg-slate-800 text-slate-500 hover:text-white text-xs rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AnalyticsView = ({
  receipts,
  showDataExtractModal,
  setShowDataExtractModal,
  copySuccess,
  setCopySuccess,
}) => {
  const [viewMode, setViewMode] = useState("monthly"); // 'monthly' | 'vendors'
  const months = getMonthlyDataHelper(receipts);
  const vendors = getVendorDataHelper(receipts);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const copyMonthDataForAI = (monthKey) => {
    const monthData = months.find((m) => m.monthKey === monthKey);
    if (!monthData) return;
    const extract = `EXPENSE DATA ${
      monthData.label
    }: Total $${monthData.total.toFixed(2)}`;
    navigator.clipboard.writeText(extract).then(() => {
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setShowDataExtractModal(false);
      }, 2000);
    });
  };

  if (months.length === 0)
    return <div className="text-center text-slate-500 py-10">No data</div>;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER ACTIONS */}
      <div className="flex justify-between items-center mb-4">
        {/* Toggle Switch */}
        <div className="bg-slate-800 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "monthly"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock size={14} className="inline mr-1" /> Monthly
          </button>
          <button
            onClick={() => setViewMode("vendors")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "vendors"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Store size={14} className="inline mr-1" /> Vendors
          </button>
        </div>

        <button
          onClick={() => setShowDataExtractModal(true)}
          className="text-xs bg-slate-700 text-slate-300 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-600"
        >
          <FileJson size={14} /> Extract
        </button>
      </div>

      {showDataExtractModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700">
            <h3 className="text-white font-bold mb-4">Select Month</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {months.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => copyMonthDataForAI(m.monthKey)}
                  className="w-full text-left p-3 bg-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-600 text-sm"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDataExtractModal(false)}
              className="mt-4 w-full py-2 text-slate-400 text-sm"
            >
              Cancel
            </button>
            {copySuccess && (
              <p className="text-center text-emerald-400 text-xs mt-2 font-bold">
                Copied!
              </p>
            )}
          </div>
        </div>
      )}

      {/* ======================= */}
      {/* MODE: MONTHLY OVERVIEW  */}
      {/* ======================= */}
      {viewMode === "monthly" &&
        months.map((month, idx) => {
          const prevMonth = months[idx + 1];
          const growth = prevMonth
            ? calculateGrowth(month.total, prevMonth.total)
            : null;
          const isUp = growth > 0;
          return (
            <div
              key={idx}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden"
            >
              <div
                onClick={() =>
                  setExpandedMonth(expandedMonth === idx ? null : idx)
                }
                className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${
                  expandedMonth === idx
                    ? "bg-slate-700/40"
                    : "hover:bg-slate-700/20"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="text-indigo-400" size={16} />
                    <span className="font-bold text-slate-200">
                      {month.label}
                    </span>
                  </div>
                  {growth !== null && (
                    <div
                      className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${
                        isUp ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {isUp ? (
                        <TrendingUp size={10} />
                      ) : (
                        <TrendingDown size={10} />
                      )}
                      {Math.abs(growth).toFixed(1)}% vs prev
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white text-lg">
                    ${month.total.toFixed(2)}
                  </span>
                  {expandedMonth === idx ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </div>
              </div>

              {/* CSS BAR CHART BREAKDOWN */}
              {expandedMonth === idx && (
                <div className="bg-slate-900/30 border-t border-slate-700/50 p-4 space-y-3">
                  {Object.entries(month.categories)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([catName, catData], cIdx) => {
                      const percent = Math.min(
                        (catData.total / month.total) * 100,
                        100
                      );
                      const isCatExpanded =
                        expandedCategory === `${idx}-${catName}`;

                      return (
                        <div key={cIdx}>
                          {/* Clickable Header */}
                          <div
                            className="cursor-pointer group"
                            onClick={() =>
                              setExpandedCategory(
                                isCatExpanded ? null : `${idx}-${catName}`
                              )
                            }
                          >
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <div className="flex items-center gap-1">
                                <span className="group-hover:text-white transition-colors">
                                  {catName}
                                </span>
                                {isCatExpanded ? (
                                  <ChevronUp size={10} />
                                ) : (
                                  <ChevronDown size={10} />
                                )}
                              </div>
                              <span className="font-mono">
                                ${catData.total.toFixed(0)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full rounded-full"
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Expanded List */}
                          {isCatExpanded && (
                            <div className="mt-2 pl-2 border-l-2 border-slate-700 space-y-1 mb-3 animate-in slide-in-from-top-1">
                              {catData.items
                                .sort((a, b) => b.price - a.price)
                                .map((item, iIdx) => (
                                  <div
                                    key={iIdx}
                                    className="flex justify-between text-[10px] text-slate-400"
                                  >
                                    <span className="truncate max-w-[200px]">
                                      {item.name}{" "}
                                      <span className="opacity-50 text-[9px]">
                                        ({item.merchant})
                                      </span>
                                    </span>
                                    <span className="font-mono text-slate-300">
                                      ${item.price.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}

      {/* ======================= */}
      {/* MODE: VENDOR BREAKDOWN  */}
      {/* ======================= */}
      {viewMode === "vendors" &&
        vendors.map((vendor, idx) => (
          <div
            key={idx}
            className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden"
          >
            <div
              onClick={() =>
                setExpandedVendor(expandedVendor === idx ? null : idx)
              }
              className={`p-4 flex justify-between items-center cursor-pointer ${
                expandedVendor === idx
                  ? "bg-slate-700/40"
                  : "hover:bg-slate-700/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                  {vendor.name.substring(0, 2)}
                </div>
                <div>
                  <span className="font-bold text-slate-200 block text-sm">
                    {vendor.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {Object.keys(vendor.months).length} months active
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-sm">
                  ${vendor.total.toFixed(2)}
                </span>
                {expandedVendor === idx ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </div>
            </div>

            {expandedVendor === idx && (
              <div className="bg-slate-900/30 border-t border-slate-700/50">
                {Object.values(vendor.months)
                  .sort((a, b) => b.dateObj - a.dateObj)
                  .map((m, mIdx) => (
                    <div
                      key={mIdx}
                      className="border-b border-slate-800/50 last:border-0 p-3 pl-4"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-300">
                          {m.label}
                        </span>
                        <span className="text-xs font-mono text-slate-300">
                          ${m.total.toFixed(2)}
                        </span>
                      </div>
                      {/* Categories Badge List */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(m.categories).map(
                          ([cat, amount], cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1"
                            >
                              {cat}:{" "}
                              <span className="text-slate-200">
                                ${amount.toFixed(0)}
                              </span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
};

const SummaryView = ({
  receipts,
  showExportModal,
  setShowExportModal,
  exportMonthToEmail,
}) => {
  const months = getMonthlyDataHelper(receipts);
  const categoryBreakdown = {};
  months.forEach((monthData) => {
    Object.entries(monthData.categories).forEach(([catName, catData]) => {
      if (!categoryBreakdown[catName])
        categoryBreakdown[catName] = { total: 0, months: {} };
      categoryBreakdown[catName].total += catData.total;
      categoryBreakdown[catName].months[monthData.label] = {
        total: catData.total,
        sortDate: monthData.date,
        items: catData.items,
      };
    });
  });
  const sortedCats = Object.entries(categoryBreakdown).sort(
    (a, b) => b[1].total - a[1].total
  );
  const [expandedSummaryCat, setExpandedSummaryCat] = useState(null);

  const handleExport = (monthKey, label) => {
    const monthData = months.find((m) => m.monthKey === monthKey);
    const body = `Expense Report for ${label}\nTotal: $${monthData.total}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      "Expenses"
    )}&body=${encodeURIComponent(body)}`;
    setShowExportModal(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-end">
        <button
          onClick={() => setShowExportModal(true)}
          className="text-xs bg-slate-700 text-slate-300 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-600"
        >
          <Send size={14} /> Export
        </button>
      </div>
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700">
            <h3 className="text-white font-bold mb-4">Select Month</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {months.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExport(m.monthKey, m.label)}
                  className="w-full text-left p-3 bg-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-600 text-sm"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              className="mt-4 w-full py-2 text-slate-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {sortedCats.map(([cat, data], idx) => (
        <div
          key={idx}
          className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden"
        >
          <div
            onClick={() =>
              setExpandedSummaryCat(expandedSummaryCat === cat ? null : cat)
            }
            className={`flex items-center justify-between p-4 cursor-pointer ${
              expandedSummaryCat === cat
                ? "bg-slate-700/40"
                : "hover:bg-slate-700/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
              <span className="text-slate-200 font-bold">{cat}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-white font-bold">
                ${data.total.toFixed(2)}
              </span>
              {expandedSummaryCat === cat ? (
                <ChevronUp size={16} className="text-slate-400" />
              ) : (
                <ChevronDown size={16} className="text-slate-400" />
              )}
            </div>
          </div>
          {expandedSummaryCat === cat && (
            <div className="bg-black/20 border-t border-slate-700/50 p-4 space-y-3">
              {Object.entries(data.months)
                .sort((a, b) => b[1].sortDate - a[1].sortDate)
                .map(([mLabel, mData], mIdx) => (
                  <div
                    key={mIdx}
                    className="border-b border-slate-800/50 last:border-0 pb-2 last:pb-0"
                  >
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{mLabel}</span>
                      <div className="font-mono text-slate-200">
                        ${mData.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ChatView = ({ receipts, budgetConfig }) => {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello Prath! I have access to your ledger. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const monthlyIncome = budgetConfig.income * 2;
      const totalFixed =
        parseFloat(budgetConfig.rent) +
        parseFloat(budgetConfig.utilities) +
        parseFloat(budgetConfig.internet) +
        parseFloat(budgetConfig.phone);

      const recentReceipts = receipts.slice(0, 50);
      const contextData = JSON.stringify(
        recentReceipts.map((r) => ({
          date: r.date,
          merchant: r.merchant,
          total: r.total,
          items: r.items?.map((i) => `${i.name} ($${i.price})`).join(", "),
          category: r.items?.[0]?.category || "General",
        }))
      );

      const aiText = await runChatAgentService(
        userMsg,
        contextData,
        monthlyIncome,
        totalFixed
      );
      setMessages((prev) => [...prev, { role: "ai", text: aiText }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Error connecting to AI." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-xl text-sm ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-200 border border-slate-700"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-xl text-sm text-slate-400 flex gap-2 items-center">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 bg-slate-900 border-t border-slate-800 absolute bottom-0 left-0 right-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask..."
            className="flex-1 bg-slate-800 text-white p-3 rounded-lg border border-slate-700 focus:border-indigo-500 outline-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-indigo-600 p-3 rounded-lg text-white hover:bg-indigo-700"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. MAIN APP COMPONENT
// ==========================================

export default function App() {
  const [user, setUser] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState("scan");
  const [forensicData, setForensicData] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDataExtractModal, setShowDataExtractModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [exchangeRate, setExchangeRate] = useState(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({}); // New State for all rates
  const [reportLoading, setReportLoading] = useState(false); // Shared loading state for reports
  const [backupPerformed, setBackupPerformed] = useState(false);
  const [backupStatus, setBackupStatus] = useState(""); // Feedback for auto-backup

  const [budgetConfig, setBudgetConfig] = useState({
    income: 2887,
    rent: 3224,
    utilities: 130,
    internet: 74,
    phone: 170,
  });
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // 1. Force Tailwind
  useEffect(() => {
    if (!document.getElementById("tailwind-script")) {
      const script = document.createElement("script");
      script.id = "tailwind-script";
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // 2. Auth & Data
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch((e) => console.error("Auth", e));
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const q = collection(
      db,
      "artifacts",
      SHARED_APP_ID,
      "public",
      "data",
      "household_ledger"
    );
    const unsub = onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      loaded.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setReceipts(loaded);
    });
    return () => unsub();
  }, [user]);

  // 3. Exchange Rate Fetcher
  useEffect(() => {
    const fetchRate = async () => {
      setExchangeRateLoading(true);
      try {
        const res = await fetch(
          "https://api.exchangerate-api.com/v4/latest/CAD"
        );
        const data = await res.json();
        // Store full rates object for correction
        setExchangeRates(data.rates);
        // Set INR rate for display
        setExchangeRate(data.rates.INR);
      } catch (e) {
        console.error(e);
      } finally {
        setExchangeRateLoading(false);
      }
    };
    fetchRate();
  }, []);

  // --- NEW: AUTO BACKUP LOGIC ---
  useEffect(() => {
    const performAutoBackup = async () => {
      if (user && db && receipts.length > 0 && !backupPerformed) {
        try {
          const backupData = {
            timestamp: Timestamp.now(),
            receiptCount: receipts.length,
            totalValue: receipts.reduce((sum, r) => sum + (r.total || 0), 0),
            data: JSON.stringify(receipts), // Serialize data to store in one field
            userId: user.uid,
          };

          await addDoc(
            collection(
              db,
              "artifacts",
              SHARED_APP_ID,
              "public",
              "data",
              "backups"
            ),
            backupData
          );
          setBackupPerformed(true);
          setBackupStatus("Auto-backup secure.");
          setTimeout(() => setBackupStatus(""), 3000);
        } catch (e) {
          console.error("Auto Backup Failed:", e);
        }
      }
    };

    // Slight delay to ensure data is stable
    const timer = setTimeout(() => {
      performAutoBackup();
    }, 5000);

    return () => clearTimeout(timer);
  }, [user, receipts, backupPerformed]);

  // --- NEW: MANUAL DOWNLOAD HANDLER ---
  const handleDownloadBackup = () => {
    try {
      const dataStr = JSON.stringify(receipts, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `expense_backup_${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Download failed.");
    }
  };

  // 4. File Upload Handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setAnalyzing(true);
    setError("");
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      setProgressText(`Analyzing ${i + 1} of ${files.length}...`);
      try {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(files[i]);
          reader.onload = () => resolve(reader.result.split(",")[1]);
        });

        // Call Service
        const parsedData = await analyzeReceiptService(base64, files[i].type);
        if (parsedData && user) {
          await addDoc(
            collection(
              db,
              "artifacts",
              SHARED_APP_ID,
              "public",
              "data",
              "household_ledger"
            ),
            {
              ...parsedData,
              createdAt: Timestamp.now(),
              addedBy: user.uid,
            }
          );
        }
      } catch (err) {
        console.error(err);
        failCount++;
      }
    }
    setAnalyzing(false);
    setProgressText("");
    if (failCount > 0) setError(`Failed: ${failCount} files.`);
    else setView("list");
  };

  const handleManualEntry = async (entryData) => {
    if (!user || !db) return;
    try {
      const newItem = {
        name: entryData.description || "Manual Entry",
        category: entryData.category,
        price: parseFloat(entryData.amount),
        qty: 1,
      };

      const newDoc = {
        merchant: entryData.merchant,
        date: entryData.date,
        total: parseFloat(entryData.amount),
        items: [newItem],
        paymentMethod: "Manual",
        createdAt: Timestamp.now(),
        addedBy: user.uid,
      };

      await addDoc(
        collection(
          db,
          "artifacts",
          SHARED_APP_ID,
          "public",
          "data",
          "household_ledger"
        ),
        newDoc
      );
      setView("list");
    } catch (e) {
      console.error("Manual Entry Error:", e);
      setError("Failed to save manual entry.");
    }
  };

  const deleteReceipt = async (id) => {
    if (db && user)
      await deleteDoc(
        doc(
          db,
          "artifacts",
          SHARED_APP_ID,
          "public",
          "data",
          "household_ledger",
          id
        )
      );
  };

  // 5. Currency Correction Handler
  const handleCurrencyCorrection = async (receipt, targetCurrency) => {
    if (!db || !user || !exchangeRates) return;

    // Safety: If rates aren't loaded or currency invalid
    if (!exchangeRates[targetCurrency]) {
      alert("Exchange rate unavailable.");
      return;
    }

    try {
      const rate = exchangeRates[targetCurrency];
      // Logic: The CURRENT total is actually in 'targetCurrency'.
      // Convert it TO CAD.
      // Rate is CAD base: 1 CAD = rate * Target
      // So, Target / rate = CAD
      const originalFaceValue = receipt.total;
      const newTotalCAD = originalFaceValue / rate;

      // NEW: Update individual item prices
      const newItems = receipt.items.map((item) => ({
        ...item,
        price: item.price / rate,
      }));

      await updateDoc(
        doc(
          db,
          "artifacts",
          SHARED_APP_ID,
          "public",
          "data",
          "household_ledger",
          receipt.id
        ),
        {
          total: newTotalCAD,
          items: newItems, // Save updated items
          currencyNote: `${targetCurrency} ${originalFaceValue.toFixed(2)}`,
        }
      );
    } catch (e) {
      console.error("Update failed", e);
      setError("Failed to update currency.");
    }
  };

  // Render Stats
  const months = getMonthlyDataHelper(receipts);
  const currentMonth = months[0];
  const prevMonth = months[1];
  const headerGrowth =
    currentMonth && prevMonth
      ? calculateGrowth(currentMonth.total, prevMonth.total)
      : null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans flex">
      <Sidebar
        activeView={view}
        onViewChange={setView}
        exchangeRate={exchangeRate}
        exchangeRateLoading={exchangeRateLoading}
        onDownloadBackup={handleDownloadBackup}
      />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden mb-6 p-5 pb-0 flex justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <h1 className="text-xl font-bold">
              Expense<span className="text-indigo-400">AI</span>
            </h1>
          </div>
        </div>

        <div className="flex-1 p-5 md:p-10 max-w-4xl mx-auto w-full pb-24 md:pb-10">
          {/* Header Stats - Hidden on Chat */}
          {view !== "chat" && (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <p className="opacity-90 text-sm">
                    {currentMonth?.label || "Current Month"}
                  </p>
                  <div className="text-4xl font-bold">
                    ${currentMonth?.total.toFixed(2) || "0.00"}
                  </div>
                </div>
                {headerGrowth !== null && (
                  <div
                    className={`text-xs font-bold px-3 py-2 rounded bg-black/20 ${
                      headerGrowth > 0 ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {headerGrowth > 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {Math.abs(headerGrowth).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Backup Status Toast */}
          {backupStatus && (
            <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 text-xs font-bold flex items-center gap-2">
              <Cloud size={14} /> {backupStatus}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border-red-500/20 rounded-xl text-red-200 flex gap-2">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {/* VIEW ROUTING */}
          {view === "scan" && (
            <ScanHomeView
              analyzing={analyzing}
              progressText={progressText}
              handleFileUpload={handleFileUpload}
              cameraInputRef={cameraInputRef}
              galleryInputRef={galleryInputRef}
              receipts={receipts}
              onManualEntry={handleManualEntry}
            />
          )}

          {view === "list" && (
            <div className="space-y-4">
              <div className="relative mb-4">
                <input
                  className="w-full bg-slate-800 p-4 pl-12 rounded-xl text-sm"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search
                  className="absolute left-4 top-4 text-slate-500"
                  size={18}
                />
              </div>
              {receipts
                .filter(
                  (r) =>
                    !searchTerm ||
                    r.merchant.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((r) => (
                  <ReceiptCard
                    key={r.id}
                    data={r}
                    onDelete={deleteReceipt}
                    onShare={() => {}}
                    onConvert={handleCurrencyCorrection}
                  />
                ))}
            </div>
          )}

          {view === "analytics" && (
            <AnalyticsView
              receipts={receipts}
              showDataExtractModal={showDataExtractModal}
              setShowDataExtractModal={setShowDataExtractModal}
              copySuccess={copySuccess}
              setCopySuccess={setCopySuccess}
            />
          )}

          {view === "summary" && (
            <SummaryView
              receipts={receipts}
              showExportModal={showExportModal}
              setShowExportModal={setShowExportModal}
              exportMonthToEmail={() => {}}
            />
          )}

          {view === "advisor" && (
            <AdvisorView
              receipts={receipts}
              budgetConfig={budgetConfig}
              setBudgetConfig={setBudgetConfig}
              showBudgetSettings={showBudgetSettings}
              setShowBudgetSettings={setShowBudgetSettings}
              forensicData={forensicData}
              setForensicData={setForensicData}
              reportLoading={reportLoading}
              setReportLoading={setReportLoading}
              copySuccess={copySuccess}
              setCopySuccess={setCopySuccess}
            />
          )}

          {view === "chat" && (
            <ChatView receipts={receipts} budgetConfig={budgetConfig} />
          )}
        </div>
      </div>
      <MobileNav activeView={view} onViewChange={setView} />
    </div>
  );
}
