import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { normalizePem, signQzRequest } from "./qzSignature.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const verifies = (data, signature, algorithm = "RSA-SHA512") =>
  createVerify(algorithm).update(data).verify(publicKey, signature, "base64");

test("produces a SHA512 signature the matching public key accepts", () => {
  const signature = signQzRequest("abc123", privateKey);
  assert.equal(verifies("abc123", signature), true);
});

test("the signature doesn't verify for different data or another algorithm", () => {
  const signature = signQzRequest("abc123", privateKey);
  assert.equal(verifies("abc124", signature), false);
  assert.equal(verifies("abc123", signature, "RSA-SHA1"), false);
});

test("a key stored with literal \\n sequences still works", () => {
  const stored = privateKey.trim().replace(/\n/g, "\\n");
  const signature = signQzRequest("abc123", normalizePem(stored));
  assert.equal(verifies("abc123", signature), true);
});

test("a real multi-line key is left intact", () => {
  assert.equal(normalizePem(`\n${privateKey}\n`), privateKey.trim());
});

test("a broken key fails without exposing the key in the error", () => {
  const brokenKey = "-----BEGIN PRIVATE KEY-----\nSECRETVALUE\n-----END PRIVATE KEY-----";
  assert.throws(
    () => signQzRequest("abc123", brokenKey),
    (error) => !String(error.message).includes("SECRETVALUE"),
  );
});
