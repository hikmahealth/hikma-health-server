import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Option } from "../../src/lib/option";
import { Result, type DataError } from "../../src/lib/result";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Arbitrary that produces Option<T> from an arbitrary of T */
const arbOption = <T>(arbValue: fc.Arbitrary<T>): fc.Arbitrary<Option<T>> =>
  fc.oneof(
    arbValue.map((v) => Option.some(v)),
    fc.constant(Option.none as Option<T>),
  );

/** Arbitrary for DataError values */
const arbDataError: fc.Arbitrary<DataError> = fc.oneof(
  fc.string().map((msg) => ({ _tag: "NetworkError" as const, message: msg })),
  fc.record({ entity: fc.string(), id: fc.string() }).map((r) => ({
    _tag: "NotFound" as const,
    ...r,
  })),
  fc.string().map((msg) => ({ _tag: "ServerError" as const, message: msg })),
);

// ---------------------------------------------------------------------------
// Option.some / Option.none — construction
// ---------------------------------------------------------------------------

describe("Option.some / Option.none", () => {
  it("some wraps a value with _tag 'Some'", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const opt = Option.some(v);
        expect(opt._tag).toBe("Some");
        expect(opt).toEqual({ _tag: "Some", value: v });
      }),
    );
  });

  it("none has _tag 'None'", () => {
    expect(Option.none).toEqual({ _tag: "None" });
  });

  // Pathological: wrapping undefined/null/NaN in Some — they are valid values
  it("some(undefined), some(null), some(NaN) are all Some", () => {
    for (const v of [undefined, null, NaN]) {
      const opt = Option.some(v);
      expect(Option.isSome(opt)).toBe(true);
    }
  });

  // Nesting: Option<Option<T>> is valid
  it("some can nest Options", () => {
    const inner = Option.some(42);
    const outer = Option.some(inner);
    expect(Option.isSome(outer)).toBe(true);
    expect(outer._tag === "Some" && outer.value).toEqual(inner);
  });
});

// ---------------------------------------------------------------------------
// Option.isSome / Option.isNone — type guards
// ---------------------------------------------------------------------------

describe("Option.isSome / Option.isNone", () => {
  it("isSome and isNone are mutually exclusive for any Option", () => {
    fc.assert(
      fc.property(arbOption(fc.anything()), (opt) => {
        expect(Option.isSome(opt)).not.toBe(Option.isNone(opt));
      }),
    );
  });

  it("isSome is true iff _tag is 'Some'", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(Option.isSome(Option.some(v))).toBe(true);
      }),
    );
    expect(Option.isSome(Option.none)).toBe(false);
  });

  it("isNone is true only for none", () => {
    expect(Option.isNone(Option.none)).toBe(true);
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(Option.isNone(Option.some(v))).toBe(false);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Option.getOrElse
// ---------------------------------------------------------------------------

describe("Option.getOrElse", () => {
  it("returns the inner value for Some", () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (value, fallback) => {
        expect(Option.getOrElse(Option.some(value), fallback)).toBe(value);
      }),
    );
  });

  it("returns the fallback for None", () => {
    fc.assert(
      fc.property(fc.anything(), (fallback) => {
        expect(Option.getOrElse(Option.none, fallback)).toBe(fallback);
      }),
    );
  });

  // Edge: fallback itself is undefined
  it("returns undefined fallback for None when fallback is undefined", () => {
    expect(Option.getOrElse(Option.none, undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Option.getOrUndefined / Option.getOrNull
// ---------------------------------------------------------------------------

describe("Option.getOrUndefined", () => {
  it("returns the inner value for Some", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(Option.getOrUndefined(Option.some(v))).toBe(v);
      }),
    );
  });

  it("returns undefined for None", () => {
    expect(Option.getOrUndefined(Option.none)).toBeUndefined();
  });
});

describe("Option.getOrNull", () => {
  it("returns the inner value for Some", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(Option.getOrNull(Option.some(v))).toBe(v);
      }),
    );
  });

  it("returns null for None", () => {
    expect(Option.getOrNull(Option.none)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Option.map — functor law tests
// ---------------------------------------------------------------------------

describe("Option.map", () => {
  it("identity law: map(id) === id", () => {
    fc.assert(
      fc.property(arbOption(fc.integer()), (opt) => {
        const mapped = Option.map(opt, (x) => x);
        expect(mapped).toEqual(opt);
      }),
    );
  });

  it("composition law: map(f . g) === map(f) . map(g)", () => {
    const f = (x: number) => x + 1;
    const g = (x: number) => x * 2;

    fc.assert(
      fc.property(arbOption(fc.integer()), (opt) => {
        const composed = Option.map(opt, (x) => f(g(x)));
        const chained = Option.map(Option.map(opt, g), f);
        expect(composed).toEqual(chained);
      }),
    );
  });

  it("maps over Some, preserves None", () => {
    expect(Option.map(Option.some(3), (x) => x * 2)).toEqual(
      Option.some(6),
    );
    expect(Option.map(Option.none, (x: number) => x * 2)).toEqual(
      Option.none,
    );
  });

  // Pathological: fn throws — map does not catch
  it("propagates exceptions from the mapping function", () => {
    const bomb = () => {
      throw new Error("boom");
    };
    expect(() => Option.map(Option.some(1), bomb)).toThrow("boom");
    // None short-circuits, so the fn is never called
    expect(() => Option.map(Option.none, bomb)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Option.flatMap — monad law tests
// ---------------------------------------------------------------------------

describe("Option.flatMap", () => {
  const safeDiv = (x: number, y: number): Option<number> =>
    y === 0 ? Option.none : Option.some(x / y);

  it("left identity: flatMap(some(a), f) === f(a)", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const f = (x: number) => safeDiv(x, b);
        expect(Option.flatMap(Option.some(a), f)).toEqual(f(a));
      }),
    );
  });

  it("right identity: flatMap(m, some) === m", () => {
    fc.assert(
      fc.property(arbOption(fc.integer()), (m) => {
        expect(Option.flatMap(m, Option.some)).toEqual(m);
      }),
    );
  });

  it("associativity: flatMap(flatMap(m, f), g) === flatMap(m, x => flatMap(f(x), g))", () => {
    const f = (x: number): Option<number> =>
      x >= 0 ? Option.some(x + 1) : Option.none;
    const g = (x: number): Option<string> =>
      x < 1000 ? Option.some(String(x)) : Option.none;

    fc.assert(
      fc.property(arbOption(fc.integer()), (m) => {
        const lhs = Option.flatMap(Option.flatMap(m, f), g);
        const rhs = Option.flatMap(m, (x) => Option.flatMap(f(x), g));
        expect(lhs).toEqual(rhs);
      }),
    );
  });

  it("flatMap on None never calls fn", () => {
    let called = false;
    Option.flatMap(Option.none as Option<number>, (_) => {
      called = true;
      return Option.some(99);
    });
    expect(called).toBe(false);
  });

  // Chaining: multiple flatMaps short-circuit at first None
  it("chains short-circuit at the first None", () => {
    const result = Option.flatMap(
      Option.flatMap(Option.some(10), (x) => safeDiv(x, 2)),
      (x) => safeDiv(x, 0), // division by zero → None
    );
    expect(result).toEqual(Option.none);
  });
});

// ---------------------------------------------------------------------------
// Option.fromNullable
// ---------------------------------------------------------------------------

describe("Option.fromNullable", () => {
  it("converts null to None", () => {
    expect(Option.fromNullable(null)).toEqual(Option.none);
  });

  it("converts undefined to None", () => {
    expect(Option.fromNullable(undefined)).toEqual(Option.none);
  });

  it("wraps non-nullish values in Some", () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => v != null),
        (v) => {
          const opt = Option.fromNullable(v);
          expect(Option.isSome(opt)).toBe(true);
          expect(opt._tag === "Some" && opt.value).toBe(v);
        },
      ),
    );
  });

  // Edge: 0, empty string, false are non-nullish → Some
  it("treats falsy-but-non-nullish values as Some", () => {
    for (const v of [0, "", false, -0]) {
      expect(Option.isSome(Option.fromNullable(v))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Option.toResult / Option.fromResult — round-trip
// ---------------------------------------------------------------------------

describe("Option.toResult / Option.fromResult", () => {
  it("toResult converts Some to ok, None to err", () => {
    const error: DataError = { _tag: "NotFound", entity: "User", id: "1" };

    fc.assert(
      fc.property(fc.string(), (v) => {
        const result = Option.toResult(Option.some(v), error);
        expect(result).toEqual({ ok: true, data: v });
      }),
    );

    expect(Option.toResult(Option.none, error)).toEqual({
      ok: false,
      error,
    });
  });

  it("fromResult converts ok to Some, err to None", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const opt = Option.fromResult(Result.ok(v));
        expect(opt).toEqual(Option.some(v));
      }),
    );

    fc.assert(
      fc.property(arbDataError, (e) => {
        const opt = Option.fromResult(Result.err(e));
        expect(opt).toEqual(Option.none);
      }),
    );
  });

  // Round-trip: Some -> Result -> Option preserves the value
  it("round-trip Some -> toResult -> fromResult === Some", () => {
    const error: DataError = { _tag: "ServerError", message: "fail" };

    fc.assert(
      fc.property(fc.anything(), (v) => {
        const roundTripped = Option.fromResult(
          Option.toResult(Option.some(v), error),
        );
        expect(roundTripped).toEqual(Option.some(v));
      }),
    );
  });

  // Round-trip: None -> Result -> Option === None
  it("round-trip None -> toResult -> fromResult === None", () => {
    const error: DataError = { _tag: "ServerError", message: "fail" };
    const roundTripped = Option.fromResult(Option.toResult(Option.none, error));
    expect(roundTripped).toEqual(Option.none);
  });

  // Round-trip: ok Result -> Option -> Result preserves data
  it("round-trip ok(v) -> fromResult -> toResult === ok(v)", () => {
    const error: DataError = { _tag: "ServerError", message: "unused" };

    fc.assert(
      fc.property(fc.anything(), (v) => {
        const original: Result<unknown> = Result.ok(v);
        const backToResult = Option.toResult(
          Option.fromResult(original),
          error,
        );
        expect(backToResult).toEqual(original);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Composition — end-to-end pipelines
// ---------------------------------------------------------------------------

describe("Option composition", () => {
  // Simulates a lookup chain: find user -> get email -> validate domain
  it("pipeline: fromNullable -> flatMap -> map -> getOrElse", () => {
    const users: Record<string, { email?: string }> = {
      alice: { email: "alice@example.com" },
      bob: { email: undefined },
    };

    const getDomain = (userId: string): string =>
      Option.getOrElse(
        Option.map(
          Option.flatMap(Option.fromNullable(users[userId]), (u) =>
            Option.fromNullable(u.email),
          ),
          (email) => email.split("@")[1],
        ),
        "unknown",
      );

    expect(getDomain("alice")).toBe("example.com");
    expect(getDomain("bob")).toBe("unknown"); // email is undefined
    expect(getDomain("charlie")).toBe("unknown"); // user not found
  });

  // Property: getOrElse after map(some(x), f) always returns f(x)
  it("getOrElse(map(some(x), f), _) === f(x) for all x", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (x, fallback) => {
        const f = (n: number) => n * 3 + 1;
        const result = Option.getOrElse(Option.map(Option.some(x), f), fallback);
        expect(result).toBe(f(x));
      }),
    );
  });

  // Property: getOrElse(map(none, f), d) === d for all d
  it("getOrElse(map(none, f), d) === d for all d", () => {
    fc.assert(
      fc.property(fc.string(), (d) => {
        const result = Option.getOrElse(
          Option.map(Option.none as Option<number>, (x) => String(x)),
          d,
        );
        expect(result).toBe(d);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Pathological inputs
// ---------------------------------------------------------------------------

describe("Option — pathological inputs", () => {
  it("handles deeply nested Option values without stack overflow", () => {
    // Build Option<Option<Option<...>>> 1000 levels deep
    let opt: Option<unknown> = Option.some(42);
    for (let i = 0; i < 1000; i++) {
      opt = Option.some(opt);
    }
    expect(Option.isSome(opt)).toBe(true);

    // Unwrap one level
    const inner = Option.getOrElse(opt, Option.none);
    expect(Option.isSome(inner as Option<unknown>)).toBe(true);
  });

  it("some preserves object identity (no cloning)", () => {
    const obj = { nested: { deep: [1, 2, 3] } };
    const opt = Option.some(obj);
    expect(opt._tag === "Some" && opt.value).toBe(obj); // reference equality
  });

  it("map with large integers stays precise", () => {
    const big = Number.MAX_SAFE_INTEGER;
    const opt = Option.map(Option.some(big), (x) => x - 1);
    expect(opt).toEqual(Option.some(big - 1));
  });

  it("fromNullable with NaN produces Some(NaN)", () => {
    // NaN is not null/undefined, so it should be Some
    const opt = Option.fromNullable(NaN);
    expect(Option.isSome(opt)).toBe(true);
  });
});
