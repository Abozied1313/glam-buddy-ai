import { describe, it, expect } from "vitest";
import { buildOutfitInstructions, outfitSignature, validateOutfitPreferences } from "../../supabase/functions/analyze-style/outfit-rules";

describe("outfit customization rules", () => {
  it("retains a user's exact requested jeans and shirt colors", () => {
    const request = "اريد بنطلون جينز ازرق و قميص بني غامق";
    expect(buildOutfitInstructions({ outfitRequest: request }, [], 0)).toContain(JSON.stringify(request));
  });
  it("requires main outfit changes on retries, not accessory-only variations", () => {
    const previous = { توصيات_الملابس_والأطقم: [{ القطعة: "قميص", اللون: "زيتي", الخامة: "قطن" }] };
    const instructions = buildOutfitInstructions({}, [previous], 1);
    expect(instructions).toContain(JSON.stringify([previous]));
    expect(instructions).toContain("SUBSTANTIALLY DIFFERENT FULL OUTFIT");
    expect(instructions).toContain("accessories is NOT a new outfit");
    expect(outfitSignature(previous)).not.toEqual(outfitSignature({ توصيات_الملابس_والأطقم: [{ القطعة: "فستان", اللون: "ازرق", الخامة: "حرير" }] }));
  });
  it("uses a varied palette rather than defaulting everyone to olive", () => {
    expect(buildOutfitInstructions({}, [], 0)).toContain("Do NOT default men or women to black or dark olive");
    expect(buildOutfitInstructions({}, [], 1)).not.toEqual(buildOutfitInstructions({}, [], 0));
  });
  it("accepts only the caller's private garment folder", () => {
    expect(validateOutfitPreferences({ outfitReferencePath: "owner/outfits/dress.jpg" }, "owner")).toBeNull();
    expect(validateOutfitPreferences({ outfitReferencePath: "other/outfits/dress.jpg" }, "owner")).not.toBeNull();
    expect(validateOutfitPreferences({ outfitReferencePath: "owner/outfits/../other.jpg" }, "owner")).not.toBeNull();
  });
  it("bounds written preferences", () => {
    expect(validateOutfitPreferences({ outfitRequest: "a".repeat(2000) }, "owner")).toBeNull();
    expect(validateOutfitPreferences({ outfitRequest: "a".repeat(2001) }, "owner")).not.toBeNull();
  });
});