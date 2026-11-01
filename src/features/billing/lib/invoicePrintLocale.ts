export type PrintLang = "en" | "hi";

// Only static invoice chrome is translated here - never customer-entered
// data (name, address, item descriptions), which stays exactly as typed
// regardless of which language is selected. See docs/billing-plan.md's
// print-page redesign notes for why.
export interface InvoicePrintLabels {
  taxInvoice: string;
  langTag: string;
  billTo: string;
  name: string;
  phone: string;
  address: string;
  invoiceDetails: string;
  invoiceNo: string;
  invoiceDate: string;
  paymentMode: string;
  status: string;
  tableHeaders: {
    sr: string;
    description: string;
    hsn: string;
    purity: string;
    pcs: string;
    grossWt: string;
    stoneWt: string;
    netWt: string;
    ratePerGram: string;
    makingCharge: string;
    stoneCharge: string;
    amount: string;
    // metal is shared by both the new-jewellery and Old Jewellery Exchange
    // tables (both now show it as its own column). dustWt/otherDeductionWt/
    // value stay Old Jewellery Exchange-only - no equivalent concept in the
    // new-jewellery table.
    metal: string;
    dustWt: string;
    otherDeductionWt: string;
    value: string;
  };
  subTotal: string;
  paymentSummary: string;
  amountPaid: string;
  // Settlement section shown below Grand Total when an exchange exists -
  // see docs/old-jewellery-exchange-plan.md. oldJewelleryTotal/amountToPay
  // replace what was a single "Exchange Applied" line in the old Payment
  // Summary box; totalRemaining replaces "Balance Due" (same value -
  // invoice.pending_amount - just relabeled since it's now the figure
  // after exchange, not only after cash, even for an ordinary invoice
  // where exchange is 0 and nothing about the number itself changes).
  oldJewelleryExchange: string;
  oldJewelleryTotal: string;
  amountToPay: string;
  totalRemaining: string;
  termsNote: string;
  taxableAmount: string;
  cgst: string;
  sgst: string;
  discount: string;
  roundOff: string;
  grandTotal: string;
  customerSignature: string;
  forShop: string;
  printButton: string;
  noPayments: string;
  // Closing thank-you line, centered above the Signatures row - purely a
  // goodwill note, not a legal/terms statement (that's termsNote above).
  welcomeNote: string;
  // Shown only when old jewellery exceeded the bill (excess/refund case) -
  // composed from fragments (static label + inline interpolated amounts),
  // same convention every other dynamic line on this page already uses,
  // not a single placeholder-based sentence template.
  excess: {
    intro: string;
    exceededBy: string;
    // Hindi needs a trailing verb word after the second amount
    // (verb-final word order) - English's exceededBy already ends the
    // clause before the number, so this is "" for en.
    exceededBySuffix: string;
    refundedVia: string;
    referenceLabel: string;
  };
}

export const invoicePrintLabels: Record<PrintLang, InvoicePrintLabels> = {
  en: {
    taxInvoice: "ESTIMATED INVOICE",
    langTag: "EN",
    billTo: "Bill To",
    name: "Name",
    phone: "Phone",
    address: "Address",
    invoiceDetails: "Invoice Details",
    invoiceNo: "Invoice No.",
    invoiceDate: "Invoice Date",
    paymentMode: "Payment Mode",
    status: "Status",
    tableHeaders: {
      sr: "Sr",
      description: "Description",
      hsn: "HSN",
      purity: "Purity",
      pcs: "Pcs",
      grossWt: "G. Wt (g)",
      stoneWt: "S. Wt (g)",
      netWt: "N. Wt (g)",
      ratePerGram: "Rate/g",
      makingCharge: "Making Charge",
      stoneCharge: "Stone Charge",
      amount: "Amount",
      metal: "Metal",
      dustWt: "Dust Wt (g)",
      otherDeductionWt: "Oth(g)",
      value: "Value",
    },
    subTotal: "Sub-Total",
    paymentSummary: "Payment Summary",
    amountPaid: "Amount Paid",
    oldJewelleryExchange: "Old Jewellery Exchange",
    oldJewelleryTotal: "Old Jewellery Total",
    amountToPay: "Amount to Pay",
    totalRemaining: "Total Remaining",
    termsNote: "Goods once sold will not be taken back or exchanged. Subject to local jurisdiction.",
    taxableAmount: "Taxable Amount",
    cgst: "CGST",
    sgst: "SGST",
    discount: "Discount",
    roundOff: "Round Off",
    grandTotal: "Grand Total",
    customerSignature: "Customer Signature",
    forShop: "For",
    printButton: "Print Invoice",
    noPayments: "—",
    welcomeNote:
      "Thank you for trusting us with your jewellery. A tradition since 1993 — we look forward to serving you again.",
    excess: {
      intro: "The value of your old jewellery",
      exceededBy: "exceeded this bill by",
      exceededBySuffix: "",
      refundedVia: "This amount has been refunded to you via",
      referenceLabel: "Ref",
    },
  },
  hi: {
    taxInvoice: "अनुमानित कर",
    langTag: "हिं",
    billTo: "बिल प्रति",
    name: "नाम",
    phone: "फ़ोन",
    address: "पता",
    invoiceDetails: "बीजक विवरण",
    invoiceNo: "बीजक सं.",
    invoiceDate: "बीजक दिनांक",
    paymentMode: "भुगतान माध्यम",
    status: "स्थिति",
    tableHeaders: {
      sr: "क्र.",
      description: "विवरण",
      hsn: "एचएसएन",
      purity: "शुद्धता",
      pcs: "नग",
      grossWt: "सकल भार (ग्राम)",
      stoneWt: "पत्थर भार (ग्राम)",
      netWt: "शुद्ध भार (ग्राम)",
      ratePerGram: "दर/ग्राम",
      makingCharge: "मजदूरी",
      stoneCharge: "पत्थर शुल्क",
      amount: "राशि",
      metal: "धातु",
      dustWt: "धूल भार (ग्राम)",
      otherDeductionWt: "अन्य कटौती (ग्राम)",
      value: "मूल्य",
    },
    subTotal: "उप-योग",
    paymentSummary: "भुगतान सारांश",
    amountPaid: "भुगतान राशि",
    oldJewelleryExchange: "पुराना आभूषण विनिमय",
    oldJewelleryTotal: "पुराना आभूषण कुल",
    amountToPay: "देय राशि",
    totalRemaining: "कुल शेष",
    termsNote: "एक बार बिका हुआ माल वापस या विनिमय नहीं किया जाएगा। स्थानीय क्षेत्राधिकार के अधीन।",
    taxableAmount: "कर योग्य राशि",
    cgst: "सीजीएसटी",
    sgst: "एसजीएसटी",
    discount: "छूट",
    roundOff: "राउंड ऑफ",
    grandTotal: "कुल योग",
    customerSignature: "ग्राहक हस्ताक्षर",
    forShop: "की ओर से",
    printButton: "बीजक प्रिंट करें",
    noPayments: "—",
    welcomeNote: "अपने आभूषणों के लिए हम पर भरोसा जताने हेतु धन्यवाद। 1993 से चली आ रही यह परंपरा, आपकी सेवा में सदैव तत्पर।",
    excess: {
      intro: "आपके पुराने आभूषण का मूल्य",
      exceededBy: "इस बिल से",
      exceededBySuffix: "अधिक था",
      refundedVia: "यह राशि आपको वापस कर दी गई है, माध्यम:",
      referenceLabel: "संदर्भ",
    },
  },
};

export const paymentModeLabels: Record<PrintLang, Record<"cash" | "upi" | "card" | "bank_transfer", string>> = {
  en: { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank Transfer" },
  hi: { cash: "नक़द", upi: "यूपीआई", card: "कार्ड", bank_transfer: "बैंक ट्रांसफर" },
};

export const paymentStatusLabels: Record<PrintLang, Record<"unpaid" | "partial" | "paid", string>> = {
  en: { unpaid: "Unpaid", partial: "Partially Paid", paid: "Paid" },
  hi: { unpaid: "अवशेष", partial: "आंशिक भुगतान", paid: "पूर्ण भुगतान" },
};
