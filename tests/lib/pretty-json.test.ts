import { describe, it, expect } from "vitest";
import { tryPrettyJson } from "@/lib/format/pretty-json";

describe("tryPrettyJson", () => {
  it("formats valid JSON", () => {
    const result = tryPrettyJson('{"a":1,"b":[2,3]}');
    expect(result.isJson).toBe(true);
    expect(result.text).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it("returns the original string when invalid", () => {
    const result = tryPrettyJson("not json");
    expect(result.isJson).toBe(false);
    expect(result.text).toBe("not json");
  });

  it("handles empty input", () => {
    const result = tryPrettyJson("");
    expect(result.isJson).toBe(false);
    expect(result.text).toBe("");
  });
});
