import { describe, expect, it } from "vitest";

import { safeFileName, sniffProofFile } from "./files";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(new Array(16).fill(0)));

describe("sniffProofFile", () => {
  it("recognises PDFs and phone image formats by their bytes", () => {
    expect(sniffProofFile(bytes("%PDF-1.7"))?.contentType).toBe("application/pdf");
    expect(sniffProofFile(bytes([0xff, 0xd8, 0xff, 0xe0]))?.contentType).toBe("image/jpeg");
    expect(sniffProofFile(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.contentType).toBe("image/png");
    expect(sniffProofFile(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))?.contentType).toBe("image/webp");
    expect(sniffProofFile(bytes([0, 0, 0, 0x18], "ftypheic"))?.contentType).toBe("image/heic");
  });

  it("rejects script-capable and unknown files, whatever they're called", () => {
    expect(sniffProofFile(bytes("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniffProofFile(bytes("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffProofFile(bytes("PK", [3, 4]))).toBeNull(); // zip/docx
    expect(sniffProofFile(new Uint8Array([0x25, 0x50]))).toBeNull(); // too short
  });
});

describe("safeFileName", () => {
  it("strips paths and odd characters and uses the detected extension", () => {
    expect(safeFileName("C:\\Users\\me\\FNB proof 27-09.PNG", "png")).toBe("FNB proof 27-09.png");
    expect(safeFileName("../../etc/<script>.pdf", "jpg")).toBe("script.jpg");
    expect(safeFileName("", "pdf")).toBe("proof-of-payment.pdf");
    expect(safeFileName(null, "heic")).toBe("proof-of-payment.heic");
  });
});
