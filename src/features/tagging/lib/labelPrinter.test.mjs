import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createLabelPrinter, LabelPrinterError } from "./labelPrinter.ts";

function fakeQz(overrides = {}) {
  const calls = { connect: 0, find: [], print: [] };
  const qz = {
    websocket: {
      active: false,
      isActive() {
        return this.active;
      },
      async connect() {
        calls.connect++;
        this.active = true;
      },
    },
    printers: {
      async find(name) {
        calls.find.push(name);
        return name;
      },
    },
    configs: { create: (printer) => ({ printer }) },
    async print(config, data) {
      calls.print.push({ config, data });
    },
    ...overrides,
  };
  const print = createLabelPrinter(async () => qz);
  return { qz, calls, printRaw: (commands, printerName = "TSC TTP-244 Pro") => print(commands, printerName) };
}

const failsWith = (reason) => (error) => error instanceof LabelPrinterError && error.reason === reason;

test("connects, finds the printer and sends the commands untouched", async () => {
  const { calls, printRaw } = fakeQz();
  await printRaw("SIZE 100 mm,15 mm\r\nPRINT 1,1\r\n");
  assert.equal(calls.connect, 1);
  assert.deepEqual(calls.find, ["TSC TTP-244 Pro"]);
  assert.deepEqual(calls.print, [
    {
      config: { printer: "TSC TTP-244 Pro" },
      data: [{ type: "raw", format: "command", flavor: "plain", data: "SIZE 100 mm,15 mm\r\nPRINT 1,1\r\n" }],
    },
  ]);
});

test("uses a different printer name when given one", async () => {
  const { calls, printRaw } = fakeQz();
  await printRaw("x", "Shop Label Printer");
  assert.deepEqual(calls.find, ["Shop Label Printer"]);
});

test("reuses an open connection", async () => {
  const { calls, printRaw } = fakeQz();
  await printRaw("a");
  await printRaw("b");
  assert.equal(calls.connect, 1);
  assert.equal(calls.print.length, 2);
});

test("two quick prints share one connection attempt", async () => {
  const { qz, calls, printRaw } = fakeQz();
  qz.websocket.connect = async function () {
    calls.connect++;
    await new Promise((resolve) => setImmediate(resolve));
    this.active = true;
  };
  await Promise.all([printRaw("a"), printRaw("b")]);
  assert.equal(calls.connect, 1);
  assert.equal(calls.print.length, 2);
});

test("reconnects after the connection drops", async () => {
  const { qz, calls, printRaw } = fakeQz();
  await printRaw("a");
  qz.websocket.active = false;
  await printRaw("b");
  assert.equal(calls.connect, 2);
});

test("can try again after QZ Tray was closed", async () => {
  const { qz, calls, printRaw } = fakeQz();
  const realConnect = qz.websocket.connect;
  qz.websocket.connect = async () => {
    throw new Error("Unable to establish connection with QZ");
  };
  await assert.rejects(printRaw("a"), failsWith("not_reachable"));
  qz.websocket.connect = realConnect;
  await printRaw("a");
  assert.equal(calls.print.length, 1);
});

test("explains when QZ Tray can't be reached, and prints nothing", async () => {
  const { qz, calls, printRaw } = fakeQz();
  qz.websocket.connect = async () => {
    throw new Error("Unable to establish connection with QZ");
  };
  await assert.rejects(printRaw("a"), failsWith("not_reachable"));
  assert.equal(calls.print.length, 0);
});

test("explains when the site was blocked", async () => {
  const { qz, printRaw } = fakeQz();
  qz.websocket.connect = async () => {
    throw new Error("Connection blocked by client");
  };
  await assert.rejects(printRaw("a"), failsWith("blocked"));
});

test("explains when the browser's permission was denied", async () => {
  const { qz, printRaw } = fakeQz();
  qz.websocket.connect = async () => {
    throw new Error("Connection attempt denied by Local Network Access restrictions");
  };
  await assert.rejects(printRaw("a"), failsWith("blocked"));
});

test("explains when the printer isn't installed, and prints nothing", async () => {
  const { qz, calls, printRaw } = fakeQz();
  qz.printers.find = async () => {
    throw new Error("Specified printer could not be found.");
  };
  await assert.rejects(printRaw("a"), failsWith("printer_not_found"));
  assert.equal(calls.print.length, 0);
});

test("explains when sending the label fails", async () => {
  const { qz, printRaw } = fakeQz();
  qz.print = async () => {
    throw new Error("Printer error");
  };
  await assert.rejects(printRaw("a"), failsWith("print_failed"));
});

test("a signing failure isn't reported as a missing printer", async () => {
  const { qz, calls, printRaw } = fakeQz();
  qz.printers.find = async () => {
    throw new Error("Failed to sign request");
  };
  await assert.rejects(printRaw("a"), failsWith("signing_failed"));
  assert.equal(calls.print.length, 0);
});

test("a signing failure while printing is reported as one", async () => {
  const { qz, printRaw } = fakeQz();
  qz.print = async () => {
    throw new Error("Failed to sign request");
  };
  await assert.rejects(printRaw("a"), failsWith("signing_failed"));
});

test("QZ Tray closing mid-request isn't reported as a missing printer", async () => {
  const { qz, printRaw } = fakeQz();
  qz.printers.find = async () => {
    throw new Error("Connection closed before response received");
  };
  await assert.rejects(printRaw("a"), failsWith("not_reachable"));
});

test("gives up waiting on a slow connection, and never prints that label late", async () => {
  const { qz, calls } = fakeQz();
  let finishConnecting;
  qz.websocket.connect = () => {
    calls.connect++;
    return new Promise((resolve) => {
      finishConnecting = () => {
        qz.websocket.active = true;
        resolve();
      };
    });
  };
  const printRaw = createLabelPrinter(async () => qz, 10);

  await assert.rejects(printRaw("first", "TSC TTP-244 Pro"), failsWith("not_reachable"));
  // A retry while the attempt is still running must not start a second one.
  await assert.rejects(printRaw("second", "TSC TTP-244 Pro"), failsWith("not_reachable"));
  assert.equal(calls.connect, 1);

  finishConnecting();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.print.length, 0);

  await printRaw("third", "TSC TTP-244 Pro");
  assert.deepEqual(calls.print.map((call) => call.data[0].data), ["third"]);
  assert.equal(calls.connect, 1);
});

test("the real library reports a failure when QZ Tray isn't running", async () => {
  const require = createRequire(import.meta.url);
  const qz = require("qz-tray");
  // Unused ports, so this can't reach a real QZ Tray even if one is installed.
  await assert.rejects(
    qz.websocket.connect({ host: "localhost", usingSecure: false, port: { insecure: [59871] } }),
    /Unable to establish connection/,
  );
  assert.equal(qz.websocket.isActive(), false);
});
