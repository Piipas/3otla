import { describe, expect, it } from "vitest";
import { shapeArabic, toVisual } from "@/lib/arabic-shaping";

const cps = (s: string) => [...s].map((c) => (c.codePointAt(0) ?? 0).toString(16));

describe("shapeArabic", () => {
  it("picks initial, medial, final and isolated forms", () => {
    // عطلة: ain initial, tah medial, lam medial, teh marbuta final
    expect(cps(shapeArabic("عطلة"))).toEqual(["fecb", "fec4", "fee0", "fe94"]);
  });

  it("does not join after right-joining letters", () => {
    // عيد: ain initial, yeh medial, dal final
    expect(cps(shapeArabic("عيد"))).toEqual(["fecb", "fef4", "feaa"]);
    // الوحدة: alef isolated, lam initial, waw final, hah initial, dal final, teh marbuta isolated
    expect(cps(shapeArabic("الوحدة"))).toEqual(["fe8d", "fedf", "feee", "fea3", "feaa", "fe93"]);
  });

  it("forms lam-alef ligatures", () => {
    // الأضحى: alef, lam-alef-hamza (isolated ligature), dad initial, hah medial, alef maksura final
    expect(cps(shapeArabic("الأضحى"))).toEqual(["fe8d", "fef7", "febf", "fea4", "fef0"]);
  });

  it("drops harakat", () => {
    expect(shapeArabic("يومًا")).toBe(shapeArabic("يوما"));
  });
});

describe("toVisual", () => {
  it("reverses Arabic but keeps numbers in order (RTL paragraph)", () => {
    const visual = toVisual("16 ماي 2027", "rtl");
    expect(visual.startsWith("2027 ")).toBe(true);
    expect(visual.endsWith(" 16")).toBe(true);
  });

  it("draws number ranges like browsers do in RTL (first number on the right)", () => {
    expect(toVisual("16–17 ماي", "rtl").endsWith("17–16")).toBe(true);
  });

  it("keeps Latin text and digits together in an RTL paragraph", () => {
    expect(toVisual("عطلة · 3otla", "rtl").startsWith("3otla · ")).toBe(true);
  });

  it("only reverses the Arabic run in an LTR paragraph", () => {
    const visual = toVisual("3otla · عطلة", "ltr");
    expect(visual.startsWith("3otla · ")).toBe(true);
    expect(cps(visual.slice(8))).toEqual(["fe94", "fee0", "fec4", "fecb"]);
  });

  it("strips bidi control characters", () => {
    expect(toVisual("‏ماي", "rtl")).toBe(toVisual("ماي", "rtl"));
  });
});
