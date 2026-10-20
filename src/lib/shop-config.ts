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
  legalNameHiSub: "ज्वैलर्स एण्ड बर्तन भण्डार",
  legalNameEn: "Govind Prasad Nilesh Kumar Jewellers & Bartan Bhandar",
  tagline:
    "Traditional Elegance Meets Modern Billing, Gold Rate Analytics & Stock Management.",
  gstin: "09ABCDE1234F1Z5",
  version: "v2.4.0",
  since: 1985,
} as const;
