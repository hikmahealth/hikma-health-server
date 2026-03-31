import { randomUUID } from "node:crypto";

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export type swap_result = {
  scrubbed: string;
  /** Replaces all fake UUIDs back to their real values in the given string. */
  restore: (text: string) => string;
};

/** Finds every UUID in `input`, replaces each unique UUID with a stable fake,
 *  and returns the scrubbed string plus a restore function to reverse the swap. */
export function swap_uuids(input: string): swap_result {
  const real_to_fake = new Map<string, string>();
  const fake_to_real = new Map<string, string>();

  const scrubbed = input.replace(UUID_REGEX, (match) => {
    const lower = match.toLowerCase();
    const existing = real_to_fake.get(lower);
    if (existing) return existing;

    const fake = randomUUID();
    real_to_fake.set(lower, fake);
    fake_to_real.set(fake, lower);
    return fake;
  });

  const restore = (text: string): string =>
    text.replace(UUID_REGEX, (match) => fake_to_real.get(match.toLowerCase()) ?? match);

  return { scrubbed, restore };
}
