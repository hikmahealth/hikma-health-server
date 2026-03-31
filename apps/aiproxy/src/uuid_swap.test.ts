import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { swap_uuids } from "./uuid_swap.js";

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Arbitrary that generates valid v4-ish UUIDs
const uuid_arb = fc.uuid().map((u) => u.toLowerCase());

// Arbitrary that generates strings containing embedded UUIDs
const text_with_uuids_arb = fc
  .tuple(
    fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    fc.array(uuid_arb, { minLength: 1, maxLength: 5 }),
  )
  .map(([strings, uuids]) => {
    // Interleave strings and UUIDs
    const parts: string[] = [];
    for (let i = 0; i < Math.max(strings.length, uuids.length); i++) {
      if (i < strings.length) parts.push(strings[i]);
      if (i < uuids.length) parts.push(uuids[i]);
    }
    return { text: parts.join(""), uuids };
  });

describe("swap_uuids", () => {
  // ── Example-based tests ────────────────────────────────────

  it("returns input unchanged when no UUIDs present", () => {
    const input = "hello world, no ids here";
    const { scrubbed, restore } = swap_uuids(input);
    expect(scrubbed).toBe(input);
    expect(restore(scrubbed)).toBe(input);
  });

  it("swaps a single UUID and restores it", () => {
    const id = "019ccf7d-7173-70b2-a402-1fc39ee49107";
    const input = `filter form_id == "${id}"`;
    const { scrubbed, restore } = swap_uuids(input);

    expect(scrubbed).not.toContain(id);
    expect(restore(scrubbed)).toBe(input);
  });

  it("maps repeated occurrences of the same UUID to the same fake", () => {
    const id = "aabbccdd-1122-3344-5566-778899aabbcc";
    const input = `${id} and ${id}`;
    const { scrubbed } = swap_uuids(input);

    const fakes = scrubbed.match(UUID_REGEX)!;
    expect(fakes).toHaveLength(2);
    expect(fakes[0]).toBe(fakes[1]);
  });

  it("maps distinct UUIDs to distinct fakes", () => {
    const id_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const id_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const input = `${id_a} ${id_b}`;
    const { scrubbed } = swap_uuids(input);

    const fakes = scrubbed.match(UUID_REGEX)!;
    expect(fakes).toHaveLength(2);
    expect(fakes[0]).not.toBe(fakes[1]);
  });

  it("handles case-insensitive UUIDs", () => {
    const upper = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const lower = upper.toLowerCase();
    const input = `${upper} and ${lower}`;
    const { scrubbed, restore } = swap_uuids(input);

    // Both should map to the same fake
    const fakes = scrubbed.match(UUID_REGEX)!;
    expect(fakes[0]).toBe(fakes[1]);
    // Restore gives back lowercased (canonical form)
    const restored = restore(scrubbed);
    expect(restored).toContain(lower);
  });

  it("restore works on text the swap never saw", () => {
    const id = "deadbeef-dead-beef-dead-beefdeadbeef";
    const input = `schema has ${id}`;
    const { scrubbed, restore } = swap_uuids(input);

    // The LLM produces new text referencing the fake UUID
    const fake = scrubbed.match(UUID_REGEX)![0];
    const llm_output = `filter id == "${fake}"`;
    expect(restore(llm_output)).toBe(`filter id == "${id}"`);
  });

  it("restore passes through unknown UUIDs unchanged", () => {
    const { restore } = swap_uuids("no uuids here");
    const unknown = "11111111-2222-3333-4444-555555555555";
    expect(restore(unknown)).toBe(unknown);
  });

  // ── Property-based tests ───────────────────────────────────

  it("roundtrip: restore(scrubbed) recovers all original UUIDs", () => {
    fc.assert(
      fc.property(text_with_uuids_arb, ({ text, uuids }) => {
        const { scrubbed, restore } = swap_uuids(text);
        const restored = restore(scrubbed);
        // Every original UUID should appear in the restored text (lowercased, since swap normalizes case)
        for (const uuid of uuids) {
          expect(restored).toContain(uuid.toLowerCase());
        }
        // Non-UUID text segments should be preserved exactly
        const original_parts = text.split(UUID_REGEX);
        const restored_parts = restored.split(UUID_REGEX);
        expect(restored_parts).toEqual(original_parts);
      }),
    );
  });

  it("scrubbed text contains no original UUIDs", () => {
    fc.assert(
      fc.property(text_with_uuids_arb, ({ text, uuids }) => {
        const { scrubbed } = swap_uuids(text);
        for (const uuid of uuids) {
          // The fake could coincidentally equal the original (astronomically unlikely)
          // so we just verify the count of UUIDs is preserved
          const original_count = (text.match(UUID_REGEX) ?? []).length;
          const scrubbed_count = (scrubbed.match(UUID_REGEX) ?? []).length;
          expect(scrubbed_count).toBe(original_count);
        }
      }),
    );
  });

  it("number of unique UUIDs is preserved after swap", () => {
    fc.assert(
      fc.property(text_with_uuids_arb, ({ text }) => {
        const { scrubbed } = swap_uuids(text);
        const original_unique = new Set(
          (text.match(UUID_REGEX) ?? []).map((u) => u.toLowerCase()),
        );
        const scrubbed_unique = new Set(
          (scrubbed.match(UUID_REGEX) ?? []).map((u) => u.toLowerCase()),
        );
        expect(scrubbed_unique.size).toBe(original_unique.size);
      }),
    );
  });

  it("non-UUID text is never modified", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !UUID_REGEX.test(s)),
        (text) => {
          // Reset regex state
          UUID_REGEX.lastIndex = 0;
          const { scrubbed, restore } = swap_uuids(text);
          expect(scrubbed).toBe(text);
          expect(restore(text)).toBe(text);
        },
      ),
    );
  });

  it("swap is deterministic: same UUID always maps to same fake within one call", () => {
    fc.assert(
      fc.property(uuid_arb, (uuid) => {
        const input = `${uuid} middle ${uuid} end ${uuid}`;
        const { scrubbed } = swap_uuids(input);
        const fakes = scrubbed.match(UUID_REGEX)!;
        expect(fakes[0]).toBe(fakes[1]);
        expect(fakes[1]).toBe(fakes[2]);
      }),
    );
  });
});
