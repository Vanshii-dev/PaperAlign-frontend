import { describe, expect, it } from "vitest";
import { b64ToBlob, formatBytes, localCheck } from "./api";

describe("localCheck", () => {
  it("accepts a normal docx", () => expect(localCheck({ name: "Paper.DOCX", size: 1000 }, 10)).toBeNull());
  it("rejects other extensions", () => expect(localCheck({ name: "paper.pdf", size: 10 }, 10)).toMatch(/\.docx/));
  it("rejects empty and oversize files", () => {
    expect(localCheck({ name: "a.docx", size: 0 }, 10)).toMatch(/empty/);
    expect(localCheck({ name: "a.docx", size: 10 * 1024 * 1024 + 1 }, 10)).toMatch(/limit is 10 MB/);
  });
});
describe("helpers", () => {
  it("formats sizes", () => expect(formatBytes(1536)).toBe("1.5 KB"));
  it("decodes base64 to the right bytes", async () => {
    const b = b64ToBlob(btoa("PK\u0003\u0004"));
    expect(b.size).toBe(4);
  });
});
