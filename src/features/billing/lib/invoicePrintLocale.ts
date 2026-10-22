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
    pcs: string;
    netWt: string;
    ratePerGram: string;
    makingStone: string;
    amount: string;
  };
  subTotal: string;
  paymentSummary: string;
  amountPaid: string;
  balanceDue: string;
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
}

export const invoicePrintLabels: Record<PrintLang, InvoicePrintLabels> = {
  en: {
    taxInvoice: "TAX INVOICE",
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
      pcs: "Pcs",
      netWt: "Net Wt (g)",
      ratePerGram: "Rate/g",
      makingStone: "Mkg + Stone",
      amount: "Amount",
    },
    subTotal: "Sub-Total",
    paymentSummary: "Payment Summary",
    amountPaid: "Amount Paid",
    balanceDue: "Balance Due",
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
  },
  hi: {
    taxInvoice: "कर चालान",
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
      pcs: "नग",
      netWt: "शुद्ध भार (ग्राम)",
      ratePerGram: "दर/ग्राम",
      makingStone: "मजदूरी + पत्थर",
      amount: "राशि",
    },
    subTotal: "उप-योग",
    paymentSummary: "भुगतान सारांश",
    amountPaid: "भुगतान राशि",
    balanceDue: "शेष राशि",
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
