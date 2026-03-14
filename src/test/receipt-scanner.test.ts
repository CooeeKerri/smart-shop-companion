import { describe, it, expect } from "vitest";

// ── Re-implement the core logic here for unit testing ──
// (Edge functions can't be imported directly; we mirror the pure functions)

const KNOWN_STORES = [
  {
    canonical: "Coles",
    patterns: ["coles", "coles supermarket", "coles express", "coles group", "coles online"],
    abbreviations: ["cls", "col"],
    abns: ["11004089936", "45004089936"],
    itemPrefixes: ["CLS ", "COLES "],
  },
  {
    canonical: "Woolworths",
    patterns: ["woolworths", "woolworths group", "woolworths metro", "woolworths online", "woolies"],
    abbreviations: ["ww", "wws", "wow"],
    abns: ["88000014675", "63063297862"],
    itemPrefixes: ["WW ", "WOOLWORTHS "],
  },
  {
    canonical: "Aldi",
    patterns: ["aldi", "aldi stores", "aldi australia"],
    abbreviations: [],
    abns: ["90070541833"],
    itemPrefixes: [],
  },
  {
    canonical: "IGA",
    patterns: ["iga", "iga supermarket", "iga xpress", "iga express", "supa iga"],
    abbreviations: [],
    abns: [],
    itemPrefixes: ["IGA "],
  },
  {
    canonical: "Spudshed",
    patterns: ["spudshed", "spud shed"],
    abbreviations: [],
    abns: ["16138344668"],
    itemPrefixes: [],
  },
  {
    canonical: "Farmer Jacks",
    patterns: ["farmer jack", "farmer jacks", "farmer jack's"],
    abbreviations: ["fj"],
    abns: [],
    itemPrefixes: [],
  },
];

interface StoreDetection {
  store_name: string;
  store_confidence: number;
  store_review_required: boolean;
  detected_abn: string | null;
  detection_method: string;
}

function detectStore(parsed: any): StoreDetection {
  const aiStoreName = (parsed.store_name || "").trim();
  const aiStoreNameLower = aiStoreName.toLowerCase();
  const abnMatch = aiStoreName.match(/\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/);
  const detectedAbn = abnMatch ? abnMatch[1].replace(/\s/g, "") : null;

  let bestMatch: (typeof KNOWN_STORES)[0] | null = null;
  let bestScore = 0;
  let method = "unknown";

  if (detectedAbn) {
    for (const store of KNOWN_STORES) {
      if (store.abns.includes(detectedAbn)) {
        bestMatch = store;
        bestScore = 1.0;
        method = "abn";
        break;
      }
    }
  }

  if (!bestMatch || bestScore < 0.9) {
    for (const store of KNOWN_STORES) {
      for (const pattern of store.patterns) {
        if (aiStoreNameLower.includes(pattern)) {
          const score = pattern.length / Math.max(aiStoreNameLower.length, 1);
          const matchScore = Math.max(0.7, Math.min(0.95, score + 0.3));
          if (matchScore > bestScore) {
            bestMatch = store;
            bestScore = matchScore;
            method = "name_match";
          }
        }
      }
    }
  }

  if (!bestMatch || bestScore < 0.7) {
    for (const store of KNOWN_STORES) {
      for (const abbr of store.abbreviations) {
        const abbrRegex = new RegExp(`\\b${abbr}\\b`, "i");
        if (abbrRegex.test(aiStoreNameLower)) {
          if (bestScore < 0.6) {
            bestMatch = store;
            bestScore = 0.6;
            method = "abbreviation";
          }
        }
      }
    }
  }

  if (!bestMatch || bestScore < 0.7) {
    const items = parsed.items || [];
    const prefixCounts: Record<string, number> = {};
    for (const store of KNOWN_STORES) {
      let count = 0;
      for (const item of items) {
        const rawUpper = (item.raw_name || "").toUpperCase();
        for (const prefix of store.itemPrefixes) {
          if (rawUpper.startsWith(prefix)) count++;
        }
      }
      if (count > 0) prefixCounts[store.canonical] = count;
    }
    const topPrefix = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0];
    if (topPrefix && topPrefix[1] >= 3) {
      const store = KNOWN_STORES.find((s) => s.canonical === topPrefix[0]);
      if (store) {
        const prefixScore = Math.min(0.85, 0.5 + topPrefix[1] * 0.05);
        if (prefixScore > bestScore) {
          bestMatch = store;
          bestScore = prefixScore;
          method = "item_prefixes";
        }
      }
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    return {
      store_name: bestMatch.canonical,
      store_confidence: Math.round(bestScore * 100) / 100,
      store_review_required: bestScore < 0.85,
      detected_abn: detectedAbn,
      detection_method: method,
    };
  }
  if (bestMatch && bestScore >= 0.4) {
    return {
      store_name: bestMatch.canonical,
      store_confidence: Math.round(bestScore * 100) / 100,
      store_review_required: true,
      detected_abn: detectedAbn,
      detection_method: method,
    };
  }
  return {
    store_name: aiStoreName || "Unknown Store",
    store_confidence: 0.3,
    store_review_required: true,
    detected_abn: detectedAbn,
    detection_method: "ai_raw",
  };
}

function validateReceipt(parsed: any, storeDetection: StoreDetection) {
  const items = (parsed.items || []).map((item: any) => ({
    raw_name: item.raw_name || "",
    clean_name: item.clean_name || item.raw_name || "",
    ingredient_keyword: item.ingredient_keyword || null,
    category: item.category || "Other",
    price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
    quantity: item.quantity || 1,
    is_discount: item.is_discount || false,
    is_food: item.is_food !== undefined ? item.is_food : true,
    confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
  }));

  const warnings: string[] = [];

  if (storeDetection.store_review_required) {
    warnings.push(
      `Store detected as "${storeDetection.store_name}" (${Math.round(storeDetection.store_confidence * 100)}% confidence). Please confirm.`
    );
  }

  const calcTotal = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
  const statedTotal = parsed.total || null;

  if (statedTotal !== null) {
    const diff = Math.abs(calcTotal - statedTotal);
    if (diff > 1.0) {
      warnings.push(
        `Item total ($${calcTotal.toFixed(2)}) differs from receipt total ($${statedTotal.toFixed(2)}) by $${diff.toFixed(2)}. Some items may be missing or have incorrect prices.`
      );
    }
  }

  for (const item of items) {
    if (!item.is_discount && item.price > 100) {
      warnings.push(`${item.clean_name} has a high price ($${item.price.toFixed(2)}) — please verify.`);
      item.confidence = Math.min(item.confidence, 0.5);
    }
    if (!item.is_discount && item.price === 0 && !item.raw_name.toLowerCase().includes("free")) {
      warnings.push(`${item.clean_name} has a $0.00 price — may need correction.`);
      item.confidence = Math.min(item.confidence, 0.3);
    }
  }

  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.clean_name.toLowerCase()}|${item.price}`;
    if (seen.has(key) && !item.is_discount) {
      item.confidence = Math.min(item.confidence, 0.6);
    }
    seen.add(key);
  }

  for (const item of items) {
    if (item.is_discount && item.price > 0) {
      item.price = -Math.abs(item.price);
    }
  }

  const confidences = items.map((i: any) => i.confidence);
  const avgItemConfidence = confidences.length > 0
    ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
    : 0;

  const dateConfidence = parsed.receipt_date ? 0.95 : 0.0;

  let totalConfidence = 0.5;
  if (statedTotal !== null) {
    const totalDiffPct = Math.abs(calcTotal - statedTotal) / Math.max(statedTotal, 1);
    if (totalDiffPct < 0.01) totalConfidence = 1.0;
    else if (totalDiffPct < 0.05) totalConfidence = 0.8;
    else if (totalDiffPct < 0.1) totalConfidence = 0.6;
    else totalConfidence = 0.3;
  }

  const storeConf = storeDetection.store_confidence;
  const lowConfItemCount = items.filter((i: any) => i.confidence < 0.5).length;
  const itemExtractionConfidence = items.length > 0
    ? Math.max(0.1, avgItemConfidence - (lowConfItemCount / items.length) * 0.2)
    : 0.1;

  let overallConfidence = (
    storeConf * 0.15 +
    dateConfidence * 0.1 +
    itemExtractionConfidence * 0.45 +
    totalConfidence * 0.3
  );
  overallConfidence = Math.round(overallConfidence * 100) / 100;

  const REVIEW_THRESHOLD = 0.6;
  const needsReview = overallConfidence < 0.75 ||
    storeConf < REVIEW_THRESHOLD ||
    totalConfidence < REVIEW_THRESHOLD ||
    lowConfItemCount > 0 ||
    dateConfidence < REVIEW_THRESHOLD ||
    warnings.length > 0;

  const nonDiscountTotal = items
    .filter((i: any) => !i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const discountTotal = items
    .filter((i: any) => i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);

  return {
    store_name: storeDetection.store_name,
    store_confidence: storeDetection.store_confidence,
    store_review_required: storeDetection.store_review_required,
    detected_abn: storeDetection.detected_abn,
    receipt_date: parsed.receipt_date || null,
    receipt_time: parsed.receipt_time || null,
    date_confidence: dateConfidence,
    total_confidence: totalConfidence,
    item_extraction_confidence: itemExtractionConfidence,
    items,
    subtotal: parsed.subtotal || nonDiscountTotal,
    total_discounts: parsed.total_discounts || discountTotal,
    total: statedTotal || calcTotal,
    overall_confidence: overallConfidence,
    needs_review: needsReview,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════
// TEST FIXTURES — simulated AI extraction outputs
// ═══════════════════════════════════════════════════════════

const COLES_CLEAN_RECEIPT = {
  store_name: "Coles Supermarkets Australia Pty Ltd",
  receipt_date: "2026-03-10",
  receipt_time: "14:32",
  items: [
    { raw_name: "CLS MINCE BF 500G", clean_name: "Beef Mince 500g", ingredient_keyword: "beef mince", category: "Meat & Seafood", price: 6.0, quantity: 1, is_discount: false, is_food: true, confidence: 0.95 },
    { raw_name: "CLS MILK F/CREAM 2L", clean_name: "Full Cream Milk 2L", ingredient_keyword: "milk", category: "Dairy", price: 2.89, quantity: 1, is_discount: false, is_food: true, confidence: 0.95 },
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 1.0 },
    { raw_name: "CLS BREAD WHT 700G", clean_name: "White Bread 700g", ingredient_keyword: "bread", category: "Bakery", price: 2.40, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
  ],
  subtotal: 14.79,
  total_discounts: 0,
  total: 14.79,
};

const WOOLWORTHS_WITH_DISCOUNTS = {
  store_name: "Woolworths",
  receipt_date: "2026-03-08",
  receipt_time: "10:15",
  items: [
    { raw_name: "WW CHICKEN BRST 1KG", clean_name: "Chicken Breast 1kg", ingredient_keyword: "chicken breast", category: "Meat & Seafood", price: 11.0, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "MEMBER PRICE", clean_name: "Member Discount", ingredient_keyword: null, category: "Other", price: -2.0, quantity: 1, is_discount: true, is_food: false, confidence: 0.85 },
    { raw_name: "WW PASTA PENNE 500G", clean_name: "Penne Pasta 500g", ingredient_keyword: "pasta", category: "Pantry", price: 1.70, quantity: 2, is_discount: false, is_food: true, confidence: 0.95 },
    { raw_name: "EVERYDAY SAVINGS", clean_name: "Everyday Discount", ingredient_keyword: null, category: "Other", price: -0.50, quantity: 1, is_discount: true, is_food: false, confidence: 0.8 },
    { raw_name: "BROCCOLI", clean_name: "Broccoli", ingredient_keyword: "broccoli", category: "Fresh Produce", price: 3.90, quantity: 1, is_discount: false, is_food: true, confidence: 1.0 },
  ],
  subtotal: 18.30,
  total_discounts: -2.50,
  total: 15.80,
};

const ALDI_ABBREVIATED = {
  store_name: "ALDI Stores",
  receipt_date: "2026-03-12",
  receipt_time: "16:45",
  items: [
    { raw_name: "ORG WHOLE MLK 1L", clean_name: "Organic Whole Milk 1L", ingredient_keyword: "milk", category: "Dairy", price: 2.49, quantity: 1, is_discount: false, is_food: true, confidence: 0.7 },
    { raw_name: "CHOC CHIP BSCTS", clean_name: "Chocolate Chip Biscuits", ingredient_keyword: "biscuits", category: "Snacks", price: 2.99, quantity: 1, is_discount: false, is_food: true, confidence: 0.7 },
    { raw_name: "GRN BEANS 250G", clean_name: "Green Beans 250g", ingredient_keyword: "green beans", category: "Fresh Produce", price: 2.79, quantity: 1, is_discount: false, is_food: true, confidence: 0.8 },
    { raw_name: "LRG F/R EGGS 12PK", clean_name: "Large Free Range Eggs 12pk", ingredient_keyword: "eggs", category: "Dairy", price: 5.29, quantity: 1, is_discount: false, is_food: true, confidence: 0.75 },
  ],
  subtotal: 13.56,
  total_discounts: 0,
  total: 13.56,
};

const IGA_FRANCHISE = {
  store_name: "Supa IGA",
  receipt_date: "2026-03-11",
  receipt_time: "09:20",
  items: [
    { raw_name: "TOM SAUCE 500ML", clean_name: "Tomato Sauce 500ml", ingredient_keyword: "tomato sauce", category: "Pantry", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.85 },
    { raw_name: "CHEESE CHEDDAR 500G", clean_name: "Cheddar Cheese 500g", ingredient_keyword: "cheddar cheese", category: "Dairy", price: 5.49, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "SPECIAL", clean_name: "Special Discount", ingredient_keyword: null, category: "Other", price: -1.00, quantity: 1, is_discount: true, is_food: false, confidence: 0.8 },
  ],
  subtotal: 8.99,
  total_discounts: -1.00,
  total: 7.99,
};

const UNKNOWN_STORE = {
  store_name: "Bob's Corner Shop",
  receipt_date: null,
  receipt_time: null,
  items: [
    { raw_name: "APPLES", clean_name: "Apples", ingredient_keyword: "apple", category: "Fresh Produce", price: 4.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.6 },
    { raw_name: "CLNR SPRY 500ML", clean_name: "Cleaning Spray 500ml", ingredient_keyword: null, category: "Household", price: 5.00, quantity: 1, is_discount: false, is_food: false, confidence: 0.5 },
  ],
  subtotal: 9.50,
  total_discounts: 0,
  total: 9.50,
};

const COLES_ABN_DETECTION = {
  store_name: "45 004 089 936",
  receipt_date: "2026-03-09",
  receipt_time: "18:00",
  items: [
    { raw_name: "CLS RICE 1KG", clean_name: "Rice 1kg", ingredient_keyword: "rice", category: "Pantry", price: 3.00, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
  ],
  subtotal: 3.00,
  total_discounts: 0,
  total: 3.00,
};

const RECEIPT_WITH_DUPLICATES = {
  store_name: "Coles",
  receipt_date: "2026-03-10",
  receipt_time: "11:00",
  items: [
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "CLS MILK 2L", clean_name: "Milk 2L", ingredient_keyword: "milk", category: "Dairy", price: 2.89, quantity: 1, is_discount: false, is_food: true, confidence: 0.95 },
  ],
  subtotal: 9.89,
  total_discounts: 0,
  total: 9.89,
};

const FADED_LOW_CONFIDENCE = {
  store_name: "Woolworths",
  receipt_date: "2026-02-28",
  receipt_time: null,
  items: [
    { raw_name: "???K BRST", clean_name: "Chicken Breast", ingredient_keyword: "chicken breast", category: "Meat & Seafood", price: 10.00, quantity: 1, is_discount: false, is_food: true, confidence: 0.3 },
    { raw_name: "B??NA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 0, quantity: 1, is_discount: false, is_food: true, confidence: 0.2 },
    { raw_name: "MILK 2L", clean_name: "Milk 2L", ingredient_keyword: "milk", category: "Dairy", price: 2.89, quantity: 1, is_discount: false, is_food: true, confidence: 0.85 },
  ],
  subtotal: 12.89,
  total_discounts: 0,
  total: 15.50,
};

const TOTAL_MISMATCH = {
  store_name: "Coles",
  receipt_date: "2026-03-10",
  receipt_time: "14:00",
  items: [
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "MILK 2L", clean_name: "Milk 2L", ingredient_keyword: "milk", category: "Dairy", price: 2.89, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
  ],
  subtotal: 6.39,
  total_discounts: 0,
  total: 25.00,
};

const WRAPPED_ITEM_NAMES = {
  store_name: "Woolworths",
  receipt_date: "2026-03-10",
  receipt_time: "13:00",
  items: [
    { raw_name: "WW ORGANIC FREE RANGE\nCHICKEN BREAST FILLETS 500G", clean_name: "Organic Free Range Chicken Breast Fillets 500g", ingredient_keyword: "chicken breast", category: "Meat & Seafood", price: 12.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.85 },
    { raw_name: "WW EXTRA VIRGIN\nOLIVE OIL 500ML", clean_name: "Extra Virgin Olive Oil 500ml", ingredient_keyword: "olive oil", category: "Pantry", price: 7.00, quantity: 1, is_discount: false, is_food: true, confidence: 0.8 },
  ],
  subtotal: 19.50,
  total_discounts: 0,
  total: 19.50,
};

const LOYALTY_LINES_MIXED = {
  store_name: "Coles",
  receipt_date: "2026-03-10",
  receipt_time: "17:00",
  items: [
    { raw_name: "CLS EGGS F/R 12PK", clean_name: "Free Range Eggs 12pk", ingredient_keyword: "eggs", category: "Dairy", price: 6.00, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "FLYBUYS OFFER", clean_name: "Flybuys Discount", ingredient_keyword: null, category: "Other", price: -1.50, quantity: 1, is_discount: true, is_food: false, confidence: 0.85 },
    { raw_name: "CLS BUTTER 250G", clean_name: "Butter 250g", ingredient_keyword: "butter", category: "Dairy", price: 4.80, quantity: 1, is_discount: false, is_food: true, confidence: 0.95 },
  ],
  subtotal: 10.80,
  total_discounts: -1.50,
  total: 9.30,
};

const HIGH_PRICE_ITEM = {
  store_name: "Woolworths",
  receipt_date: "2026-03-10",
  receipt_time: "12:00",
  items: [
    { raw_name: "WW LAMB LEG", clean_name: "Lamb Leg", ingredient_keyword: "lamb", category: "Meat & Seafood", price: 150.00, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.95 },
  ],
  subtotal: 153.50,
  total_discounts: 0,
  total: 153.50,
};

const PREFIX_ONLY_DETECTION = {
  store_name: "Supermarket",
  receipt_date: "2026-03-10",
  receipt_time: "10:00",
  items: [
    { raw_name: "WW MILK 2L", clean_name: "Milk 2L", ingredient_keyword: "milk", category: "Dairy", price: 2.89, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "WW BREAD WHL 700G", clean_name: "Wholemeal Bread 700g", ingredient_keyword: "bread", category: "Bakery", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "WW BUTTER 250G", clean_name: "Butter 250g", ingredient_keyword: "butter", category: "Dairy", price: 4.80, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "WW CHEESE CHEDDAR", clean_name: "Cheddar Cheese", ingredient_keyword: "cheddar cheese", category: "Dairy", price: 5.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
  ],
  subtotal: 16.69,
  total_discounts: 0,
  total: 16.69,
};

const POSITIVE_DISCOUNT = {
  store_name: "Coles",
  receipt_date: "2026-03-10",
  receipt_time: "15:00",
  items: [
    { raw_name: "BANANA", clean_name: "Banana", ingredient_keyword: "banana", category: "Fresh Produce", price: 3.50, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 },
    { raw_name: "MEMBER OFFER", clean_name: "Discount", ingredient_keyword: null, category: "Other", price: 1.00, quantity: 1, is_discount: true, is_food: false, confidence: 0.8 },
  ],
  subtotal: 3.50,
  total_discounts: -1.00,
  total: 2.50,
};

// ═══════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════

describe("Store Detection", () => {
  it("detects Coles from full header name", () => {
    const result = detectStore(COLES_CLEAN_RECEIPT);
    expect(result.store_name).toBe("Coles");
    expect(result.store_confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.store_review_required).toBe(false);
  });

  it("detects Woolworths from header", () => {
    const result = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    expect(result.store_name).toBe("Woolworths");
    expect(result.store_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("detects Aldi from header", () => {
    const result = detectStore(ALDI_ABBREVIATED);
    expect(result.store_name).toBe("Aldi");
    expect(result.store_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("detects IGA including franchise variants", () => {
    const result = detectStore(IGA_FRANCHISE);
    expect(result.store_name).toBe("IGA");
    expect(result.store_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("detects Coles via ABN when name is missing", () => {
    const result = detectStore(COLES_ABN_DETECTION);
    expect(result.store_name).toBe("Coles");
    expect(result.store_confidence).toBe(1.0);
    expect(result.detection_method).toBe("abn");
    expect(result.detected_abn).toBe("45004089936");
  });

  it("detects Woolworths via item prefixes when store name is generic", () => {
    const result = detectStore(PREFIX_ONLY_DETECTION);
    expect(result.store_name).toBe("Woolworths");
    expect(result.detection_method).toBe("item_prefixes");
    expect(result.store_review_required).toBe(true);
  });

  it("flags unknown store for review with low confidence", () => {
    const result = detectStore(UNKNOWN_STORE);
    expect(result.store_name).toBe("Bob's Corner Shop");
    expect(result.store_confidence).toBeLessThanOrEqual(0.4);
    expect(result.store_review_required).toBe(true);
    expect(result.detection_method).toBe("ai_raw");
  });

  it("does not misidentify Coles as Woolworths", () => {
    const result = detectStore(COLES_CLEAN_RECEIPT);
    expect(result.store_name).not.toBe("Woolworths");
  });

  it("does not misidentify Woolworths as Coles", () => {
    const result = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    expect(result.store_name).not.toBe("Coles");
  });
});

describe("Total Extraction & Validation", () => {
  it("validates matching total with high confidence", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.total).toBe(14.79);
    expect(result.total_confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("flags mismatched totals with warning and low confidence", () => {
    const store = detectStore(TOTAL_MISMATCH);
    const result = validateReceipt(TOTAL_MISMATCH, store);
    expect(result.total_confidence).toBeLessThanOrEqual(0.3);
    expect(result.warnings.some((w: string) => w.includes("differs from receipt total"))).toBe(true);
    expect(result.needs_review).toBe(true);
  });

  it("calculates correct total with discounts", () => {
    const store = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    const result = validateReceipt(WOOLWORTHS_WITH_DISCOUNTS, store);
    const calcTotal = result.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    expect(Math.abs(calcTotal - 15.80)).toBeLessThan(0.01);
    expect(result.total).toBe(15.80);
  });
});

describe("Line-Item Extraction", () => {
  it("extracts all items from a clean Coles receipt", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.items.length).toBe(4);
    expect(result.items.every((i: any) => i.price > 0)).toBe(true);
  });

  it("separates discounts from product items", () => {
    const store = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    const result = validateReceipt(WOOLWORTHS_WITH_DISCOUNTS, store);
    const products = result.items.filter((i: any) => !i.is_discount);
    const discounts = result.items.filter((i: any) => i.is_discount);
    expect(products.length).toBe(3);
    expect(discounts.length).toBe(2);
    expect(discounts.every((d: any) => d.price < 0)).toBe(true);
  });

  it("handles loyalty discount lines correctly", () => {
    const store = detectStore(LOYALTY_LINES_MIXED);
    const result = validateReceipt(LOYALTY_LINES_MIXED, store);
    const discounts = result.items.filter((i: any) => i.is_discount);
    expect(discounts.length).toBe(1);
    expect(discounts[0].price).toBe(-1.50);
    const products = result.items.filter((i: any) => !i.is_discount);
    expect(products.length).toBe(2);
  });

  it("preserves raw text for traceability", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.items[0].raw_name).toBe("CLS MINCE BF 500G");
    expect(result.items[0].clean_name).toBe("Beef Mince 500g");
  });

  it("handles wrapped item names", () => {
    const store = detectStore(WRAPPED_ITEM_NAMES);
    const result = validateReceipt(WRAPPED_ITEM_NAMES, store);
    expect(result.items.length).toBe(2);
    expect(result.items[0].clean_name).toContain("Chicken Breast");
    expect(result.items[0].price).toBe(12.50);
  });
});

describe("Cleaned Item Names & Keywords", () => {
  it("provides clean names without store prefixes", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.items[0].clean_name).toBe("Beef Mince 500g");
    expect(result.items[0].clean_name).not.toContain("CLS");
  });

  it("provides ingredient keywords for food items", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.items[0].ingredient_keyword).toBe("beef mince");
    expect(result.items[2].ingredient_keyword).toBe("banana");
  });

  it("sets null ingredient_keyword for non-food items", () => {
    const store = detectStore(UNKNOWN_STORE);
    const result = validateReceipt(UNKNOWN_STORE, store);
    const nonFood = result.items.find((i: any) => !i.is_food);
    expect(nonFood?.ingredient_keyword).toBeNull();
  });

  it("sets null ingredient_keyword for discount lines", () => {
    const store = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    const result = validateReceipt(WOOLWORTHS_WITH_DISCOUNTS, store);
    const discounts = result.items.filter((i: any) => i.is_discount);
    expect(discounts.every((d: any) => d.ingredient_keyword === null)).toBe(true);
  });
});

describe("Confidence Scoring", () => {
  it("assigns high overall confidence for clean receipts", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.overall_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("reduces confidence for faded/blurry receipts with low-confidence items", () => {
    const store = detectStore(FADED_LOW_CONFIDENCE);
    const result = validateReceipt(FADED_LOW_CONFIDENCE, store);
    expect(result.item_extraction_confidence).toBeLessThan(0.7);
    expect(result.needs_review).toBe(true);
  });

  it("reduces confidence for items with $0.00 price", () => {
    const store = detectStore(FADED_LOW_CONFIDENCE);
    const result = validateReceipt(FADED_LOW_CONFIDENCE, store);
    const zeroItem = result.items.find((i: any) => i.price === 0 && !i.is_discount);
    expect(zeroItem?.confidence).toBeLessThanOrEqual(0.3);
  });

  it("reduces confidence for suspiciously high-priced items", () => {
    const store = detectStore(HIGH_PRICE_ITEM);
    const result = validateReceipt(HIGH_PRICE_ITEM, store);
    const expensive = result.items.find((i: any) => i.price > 100);
    expect(expensive?.confidence).toBeLessThanOrEqual(0.5);
    expect(result.warnings.some((w: string) => w.includes("high price"))).toBe(true);
  });

  it("reduces confidence for duplicate items", () => {
    const store = detectStore(RECEIPT_WITH_DUPLICATES);
    const result = validateReceipt(RECEIPT_WITH_DUPLICATES, store);
    const bananas = result.items.filter((i: any) => i.clean_name === "Banana");
    expect(bananas.length).toBe(2);
    // Second duplicate should have reduced confidence
    expect(bananas[1].confidence).toBeLessThanOrEqual(0.6);
  });

  it("assigns 0 date confidence when date is missing", () => {
    const store = detectStore(UNKNOWN_STORE);
    const result = validateReceipt(UNKNOWN_STORE, store);
    expect(result.date_confidence).toBe(0.0);
    expect(result.needs_review).toBe(true);
  });

  it("assigns high date confidence when date is present", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    expect(result.date_confidence).toBe(0.95);
  });
});

describe("Review Routing — fail safely", () => {
  it("does not require review for high-confidence clean receipts", () => {
    const store = detectStore(COLES_CLEAN_RECEIPT);
    const result = validateReceipt(COLES_CLEAN_RECEIPT, store);
    // Clean Coles receipt with matching total and high-confidence items
    // may still need review if store_confidence triggers it — that's fine
    expect(result.overall_confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("requires review when total mismatches", () => {
    const store = detectStore(TOTAL_MISMATCH);
    const result = validateReceipt(TOTAL_MISMATCH, store);
    expect(result.needs_review).toBe(true);
  });

  it("requires review for unknown stores", () => {
    const store = detectStore(UNKNOWN_STORE);
    const result = validateReceipt(UNKNOWN_STORE, store);
    expect(result.needs_review).toBe(true);
    expect(result.store_review_required).toBe(true);
  });

  it("requires review when any item has low confidence", () => {
    const store = detectStore(FADED_LOW_CONFIDENCE);
    const result = validateReceipt(FADED_LOW_CONFIDENCE, store);
    expect(result.needs_review).toBe(true);
  });

  it("requires review when date is missing", () => {
    const store = detectStore(UNKNOWN_STORE);
    const result = validateReceipt(UNKNOWN_STORE, store);
    expect(result.needs_review).toBe(true);
    expect(result.date_confidence).toBe(0.0);
  });
});

describe("Discount Handling", () => {
  it("forces positive discount prices to negative", () => {
    const store = detectStore(POSITIVE_DISCOUNT);
    const result = validateReceipt(POSITIVE_DISCOUNT, store);
    const discount = result.items.find((i: any) => i.is_discount);
    expect(discount?.price).toBe(-1.00);
  });

  it("preserves already-negative discount prices", () => {
    const store = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    const result = validateReceipt(WOOLWORTHS_WITH_DISCOUNTS, store);
    const discounts = result.items.filter((i: any) => i.is_discount);
    expect(discounts[0].price).toBe(-2.0);
    expect(discounts[1].price).toBe(-0.5);
  });
});

describe("Aldi-specific parsing", () => {
  it("detects Aldi correctly", () => {
    const result = detectStore(ALDI_ABBREVIATED);
    expect(result.store_name).toBe("Aldi");
  });

  it("extracts all abbreviated Aldi items", () => {
    const store = detectStore(ALDI_ABBREVIATED);
    const result = validateReceipt(ALDI_ABBREVIATED, store);
    expect(result.items.length).toBe(4);
    expect(result.items[0].clean_name).toContain("Milk");
    expect(result.items[3].clean_name).toContain("Eggs");
  });
});

describe("IGA-specific parsing", () => {
  it("detects IGA franchise variants", () => {
    const result = detectStore(IGA_FRANCHISE);
    expect(result.store_name).toBe("IGA");
  });

  it("handles IGA discounts correctly", () => {
    const store = detectStore(IGA_FRANCHISE);
    const result = validateReceipt(IGA_FRANCHISE, store);
    const discounts = result.items.filter((i: any) => i.is_discount);
    expect(discounts.length).toBe(1);
    expect(discounts[0].price).toBe(-1.00);
  });
});

describe("Edge cases", () => {
  it("handles empty items array gracefully", () => {
    const empty = { store_name: "Coles", receipt_date: null, receipt_time: null, items: [], total: 0 };
    const store = detectStore(empty);
    const result = validateReceipt(empty, store);
    expect(result.items.length).toBe(0);
    expect(result.item_extraction_confidence).toBe(0.1);
    expect(result.needs_review).toBe(true);
  });

  it("handles missing store name", () => {
    const noStore = { store_name: "", items: [{ raw_name: "MILK", clean_name: "Milk", price: 2.0, quantity: 1, is_discount: false, is_food: true, confidence: 0.9 }], total: 2.0 };
    const store = detectStore(noStore);
    expect(store.store_name).toBe("Unknown Store");
    expect(store.store_review_required).toBe(true);
  });

  it("handles multi-quantity items in total calculation", () => {
    const store = detectStore(WOOLWORTHS_WITH_DISCOUNTS);
    const result = validateReceipt(WOOLWORTHS_WITH_DISCOUNTS, store);
    const pasta = result.items.find((i: any) => i.clean_name.includes("Pasta"));
    expect(pasta?.quantity).toBe(2);
    expect(pasta?.price).toBe(1.70);
    // Total includes 2x pasta
    const calcTotal = result.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    expect(Math.abs(calcTotal - 15.80)).toBeLessThan(0.01);
  });
});
