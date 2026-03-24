import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  flexTimestamp,
  flexTimestampOptional,
  paginationInput,
  toSqlTimestamp,
  toDate,
  paginatedResponse,
} from "@/lib/rpc-utils";

describe("flexTimestamp", () => {
  it("accepts an integer epoch in ms", () => {
    const result = flexTimestamp.safeParse(1710000000000);
    expect(result.success).toBe(true);
    expect(result.data).toBe(1710000000000);
  });

  it("accepts an ISO 8601 string", () => {
    const result = flexTimestamp.safeParse("2024-03-09T00:00:00.000Z");
    expect(result.success).toBe(true);
    expect(result.data).toBe("2024-03-09T00:00:00.000Z");
  });

  it("rejects booleans", () => {
    expect(flexTimestamp.safeParse(true).success).toBe(false);
  });

  it("rejects null", () => {
    expect(flexTimestamp.safeParse(null).success).toBe(false);
  });

  it("rejects objects", () => {
    expect(flexTimestamp.safeParse({ ts: 123 }).success).toBe(false);
  });

  // Property: every number parses successfully
  it("accepts any finite number", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (n) => {
          expect(flexTimestamp.safeParse(n).success).toBe(true);
        },
      ),
    );
  });

  // Property: every string parses successfully
  it("accepts any string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(flexTimestamp.safeParse(s).success).toBe(true);
      }),
    );
  });

  // Property: anything that is neither number nor string is rejected
  it("rejects non-number, non-string values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.dictionary(fc.string(), fc.integer()),
          fc.array(fc.integer()),
        ),
        (v) => {
          expect(flexTimestamp.safeParse(v).success).toBe(false);
        },
      ),
    );
  });
});

describe("flexTimestampOptional", () => {
  it("accepts null", () => {
    expect(flexTimestampOptional.safeParse(null).success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(flexTimestampOptional.safeParse(undefined).success).toBe(true);
  });

  it("accepts a number", () => {
    expect(flexTimestampOptional.safeParse(1710000000000).success).toBe(true);
  });

  it("accepts a string", () => {
    expect(
      flexTimestampOptional.safeParse("2024-03-09T00:00:00Z").success,
    ).toBe(true);
  });
});

describe("paginationInput", () => {
  it("accepts empty object (all defaults)", () => {
    const result = paginationInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid limit and offset", () => {
    const result = paginationInput.safeParse({ limit: 50, offset: 10 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ limit: 50, offset: 10 });
  });

  it("rejects limit of 0", () => {
    expect(paginationInput.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(paginationInput.safeParse({ offset: -1 }).success).toBe(false);
  });

  it("rejects limit above 200", () => {
    expect(paginationInput.safeParse({ limit: 201 }).success).toBe(false);
  });

  it("rejects fractional limit", () => {
    expect(paginationInput.safeParse({ limit: 10.5 }).success).toBe(false);
  });

  // Property: any positive integer limit <= 200 and nonneg integer offset is valid
  it("accepts all valid limit/offset combinations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 0, max: 100_000 }),
        (limit, offset) => {
          const result = paginationInput.safeParse({ limit, offset });
          expect(result.success).toBe(true);
        },
      ),
    );
  });

  // Property: limit < 1 or limit > 200 always fails
  it("rejects out-of-range limits", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 201, max: 10_000 }),
        ),
        (limit) => {
          expect(paginationInput.safeParse({ limit }).success).toBe(false);
        },
      ),
    );
  });
});

describe("toSqlTimestamp", () => {
  // We can't execute SQL here, but we can verify the function returns
  // a RawBuilder (object with toOperationNode) for both input types.

  it("returns a RawBuilder for number input", () => {
    const result = toSqlTimestamp(1710000000000);
    expect(result).toBeDefined();
    expect(typeof result.toOperationNode).toBe("function");
  });

  it("returns a RawBuilder for string input", () => {
    const result = toSqlTimestamp("2024-03-09T00:00:00Z");
    expect(result).toBeDefined();
    expect(typeof result.toOperationNode).toBe("function");
  });

  // Property: always returns a RawBuilder regardless of input type
  it("always produces a RawBuilder for any valid flex timestamp", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 0, max: 2e13 }),
          fc.date({ min: new Date(0), max: new Date("2100-01-01"), noInvalidDate: true }).map((d) => d.toISOString()),
        ),
        (v) => {
          const result = toSqlTimestamp(v);
          expect(typeof result.toOperationNode).toBe("function");
        },
      ),
    );
  });
});

describe("toDate", () => {
  it("converts ms epoch to Date", () => {
    const d = toDate(1710000000000);
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(1710000000000);
  });

  it("converts ISO string to Date", () => {
    const d = toDate("2024-03-09T00:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe("2024-03-09T00:00:00.000Z");
  });

  // Property: roundtrip — toDate(epoch).getTime() === epoch
  it("roundtrips ms-epoch values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_102_444_800_000 }), // up to ~2100
        (epoch) => {
          expect(toDate(epoch).getTime()).toBe(epoch);
        },
      ),
    );
  });

  // Property: roundtrip — toDate(iso).toISOString() === iso for valid ISO strings
  it("roundtrips ISO string values", () => {
    fc.assert(
      fc.property(
        fc
          .date({
            min: new Date("1970-01-01T00:00:00.000Z"),
            max: new Date("2100-01-01T00:00:00.000Z"),
            noInvalidDate: true,
          })
          .map((d) => d.toISOString()),
        (iso) => {
          expect(toDate(iso).toISOString()).toBe(iso);
        },
      ),
    );
  });

  // Property: number input always produces a Date with matching getTime()
  it("number input always yields a Date", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -8_640_000_000_000_000, max: 8_640_000_000_000_000 }),
        (n) => {
          const d = toDate(n);
          expect(d).toBeInstanceOf(Date);
          expect(d.getTime()).toBe(n);
        },
      ),
    );
  });
});

describe("paginatedResponse", () => {
  it("wraps data with pagination metadata", () => {
    const result = paginatedResponse(["a", "b"], 10, 2, 0);
    expect(result).toEqual({ data: ["a", "b"], total: 10, limit: 2, offset: 0 });
  });

  it("handles empty data array", () => {
    const result = paginatedResponse([], 0, 20, 0);
    expect(result).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
  });

  // Property: data.length <= limit (when total >= offset + data.length)
  it("data length is always the length of the input array", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        fc.nat(),
        fc.integer({ min: 1, max: 200 }),
        fc.nat(),
        (data, total, limit, offset) => {
          const result = paginatedResponse(data, total, limit, offset);
          expect(result.data.length).toBe(data.length);
          expect(result.total).toBe(total);
          expect(result.limit).toBe(limit);
          expect(result.offset).toBe(offset);
        },
      ),
    );
  });

  // Property: the envelope shape is always { data, total, limit, offset }
  it("always returns an object with exactly four keys", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string()),
        fc.nat(),
        fc.integer({ min: 1, max: 200 }),
        fc.nat(),
        (data, total, limit, offset) => {
          const result = paginatedResponse(data, total, limit, offset);
          const keys = Object.keys(result).sort();
          expect(keys).toEqual(["data", "limit", "offset", "total"]);
        },
      ),
    );
  });
});
