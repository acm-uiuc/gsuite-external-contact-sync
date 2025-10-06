import { describe, it, expect } from "vitest";
import { parseDisplayName } from "../src/utils";

describe("utils", () => {
  describe("parseDisplayName", () => {
    it('should parse "First Last" format', () => {
      const result = parseDisplayName("John Doe");
      expect(result).toEqual({
        givenName: "John",
        familyName: "Doe",
      });
    });

    it('should parse "Last, First" format', () => {
      const result = parseDisplayName("Doe, John");
      expect(result).toEqual({
        givenName: "John",
        familyName: "Doe",
      });
    });

    it('should parse "First Middle Last" format', () => {
      const result = parseDisplayName("John Michael Doe");
      expect(result).toEqual({
        givenName: "John Michael",
        familyName: "Doe",
      });
    });

    it("should handle single name as given name", () => {
      const result = parseDisplayName("John");
      expect(result).toEqual({
        givenName: "John",
        familyName: "",
      });
    });

    it("should handle empty string", () => {
      const result = parseDisplayName("");
      expect(result).toEqual({
        givenName: "",
        familyName: "",
      });
    });

    it("should handle whitespace-only string", () => {
      const result = parseDisplayName("   ");
      expect(result).toEqual({
        givenName: "",
        familyName: "",
      });
    });

    it('should handle "Last, First Middle" format', () => {
      const result = parseDisplayName("Doe, John Michael");
      expect(result).toEqual({
        givenName: "John Michael",
        familyName: "Doe",
      });
    });

    it("should trim whitespace", () => {
      const result = parseDisplayName("  John   Doe  ");
      expect(result).toEqual({
        givenName: "John",
        familyName: "Doe",
      });
    });

    it("should handle multiple spaces between names", () => {
      const result = parseDisplayName("John    Doe");
      expect(result).toEqual({
        givenName: "John",
        familyName: "Doe",
      });
    });

    it("should handle comma format with extra spaces", () => {
      const result = parseDisplayName("Doe,  John");
      expect(result).toEqual({
        givenName: "John",
        familyName: "Doe",
      });
    });
  });
});
