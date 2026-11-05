// Sends raw printer commands through QZ Tray, the desktop app on each shop PC.
// qz-tray is only loaded on the first print, so pages that never print (and PCs
// without QZ Tray installed) aren't affected by it at all.
type Qz = typeof import("qz-tray").default;

export type LabelPrinterFailure =
  | "not_reachable"
  | "blocked"
  | "signing_failed"
  | "printer_not_found"
  | "print_failed";

export class LabelPrinterError extends Error {
  reason: LabelPrinterFailure;

  constructor(reason: LabelPrinterFailure, message: string) {
    super(message);
    this.name = "LabelPrinterError";
    this.reason = reason;
  }
}

const NOT_REACHABLE_MESSAGE =
  "Can't reach QZ Tray. Check it's running on this PC, and click Allow if the browser asks for permission.";

// The causes that aren't specific to the step that failed, so a signing or
// connection problem doesn't get reported as, say, a missing printer.
function toPrinterError(error: unknown, fallback: LabelPrinterError): LabelPrinterError {
  const message = error instanceof Error ? error.message : "";
  if (/blocked|denied/i.test(message)) {
    return new LabelPrinterError(
      "blocked",
      "QZ Tray blocked this site. Open QZ Tray's Site Manager and remove the block.",
    );
  }
  if (/failed to sign/i.test(message)) {
    return new LabelPrinterError(
      "signing_failed",
      "This print request couldn't be signed. Check the print signing settings on the server.",
    );
  }
  if (/connection closed/i.test(message)) {
    return new LabelPrinterError("not_reachable", NOT_REACHABLE_MESSAGE);
  }
  return fallback;
}

// Chrome backs off after repeated failed local connections, so with QZ Tray
// closed a failure can take 20+ seconds to come back on its own. A slow answer
// to a permission prompt can hit this too - that's safe, because the timed-out
// print is abandoned rather than sent late, and the next click just works.
const CONNECT_TIMEOUT_MS = 15_000;

function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to QZ Tray")), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function createLabelPrinter(loadQz: () => Promise<Qz>, connectTimeoutMs = CONNECT_TIMEOUT_MS) {
  // Shared so two quick clicks don't start two connection attempts - QZ Tray
  // rejects a second connect while the first is still in progress. Kept until
  // the attempt really ends, even if a caller has already timed out waiting.
  let connecting: Promise<void> | null = null;

  async function ensureConnected(qz: Qz): Promise<void> {
    if (qz.websocket.isActive()) return;
    connecting ??= qz.websocket.connect().finally(() => {
      connecting = null;
    });
    try {
      await withTimeout(connecting, connectTimeoutMs);
    } catch (error) {
      throw toPrinterError(error, new LabelPrinterError("not_reachable", NOT_REACHABLE_MESSAGE));
    }
  }

  async function findPrinter(qz: Qz, printerName: string): Promise<string> {
    try {
      return await qz.printers.find(printerName);
    } catch (error) {
      throw toPrinterError(
        error,
        new LabelPrinterError(
          "printer_not_found",
          `Printer "${printerName}" isn't installed on this PC. Check its driver, and the name in Printer settings.`,
        ),
      );
    }
  }

  return async function printRaw(commands: string, printerName: string): Promise<void> {
    const qz = await loadQz();
    await ensureConnected(qz);
    const printer = await findPrinter(qz, printerName);
    try {
      await qz.print(qz.configs.create(printer), [
        { type: "raw", format: "command", flavor: "plain", data: commands },
      ]);
    } catch (error) {
      throw toPrinterError(
        error,
        new LabelPrinterError("print_failed", "The label couldn't be sent to the printer."),
      );
    }
  };
}
