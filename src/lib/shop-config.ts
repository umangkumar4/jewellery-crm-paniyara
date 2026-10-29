/**
 * Single-shopkeeper branding. No Shop/Business model exists in the data
 * layer (see docs/REQUIREMENTS.md) - this is a static source of truth for
 * the shop identity shown across the login page and the app shell.
 */
export const shopConfig = {
  appName: "Swarn Bahi",
  appTagline: "GOLD · SILVER · UTENSILS",
  portalName: "Jewelry & Utensils ERP",
  portalTagline: "POS & Inventory System",
  legalNameHi: "गोविन्द प्रसाद नीलेश कुमार",
  legalNameHiSub: "ज्वेलर्स एण्ड बर्तन भण्डार",
  legalNameEn: "Govind Prasad Nilesh Kumar Jewellers & Bartan Bhandar", 
  heritageLineHi: "श्री खदेरूराम ज्वैलर्स",
heritageLineEn: "Shri Khaderuram Jewellers",
  tagline:
    "Traditional Elegance Meets Modern Billing, Gold Rate Analytics & Stock Management.",
  gstin: "09ABCDE1234F1Z5",
  addressEn: "Paniyara, Maharajganj, Uttar Pradesh",
  addressHi: "पनियरा – महाराजगंज",
  phone: "+91 70717 21819, +91 76518 68365",
  version: "v2.4.0",
  since: 1993,
} as const;
