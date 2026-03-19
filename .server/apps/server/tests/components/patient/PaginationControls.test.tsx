import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import {
  PaginationControls,
  pageFromOffset,
  totalPages,
  displayRange,
} from "@/components/patient/PaginationControls";

// ── Pure function tests with fast-check ──

describe("pageFromOffset", () => {
  it("returns 1 for offset=0 regardless of limit", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (limit) => {
        expect(pageFromOffset(0, limit)).toBe(1);
      }),
    );
  });

  it("increments by 1 each time offset advances by limit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (limit, pageIndex) => {
          const offset = pageIndex * limit;
          expect(pageFromOffset(offset, limit)).toBe(pageIndex + 1);
        },
      ),
    );
  });

  it("never returns less than 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 500 }),
        fc.integer({ min: -10, max: 500 }),
        (offset, limit) => {
          expect(pageFromOffset(offset, limit)).toBeGreaterThanOrEqual(1);
        },
      ),
    );
  });
});

describe("totalPages", () => {
  it("returns 1 when total is 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (limit) => {
        expect(totalPages(0, limit)).toBe(1);
      }),
    );
  });

  it("returns ceil(total/limit) for positive totals", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        (total, limit) => {
          expect(totalPages(total, limit)).toBe(Math.ceil(total / limit));
        },
      ),
    );
  });

  it("is always >= 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: -10, max: 100 }),
        (total, limit) => {
          expect(totalPages(total, limit)).toBeGreaterThanOrEqual(1);
        },
      ),
    );
  });
});

describe("displayRange", () => {
  it('returns "No results" when total is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 100 }),
        (offset, limit) => {
          expect(displayRange(offset, limit, 0)).toBe("No results");
        },
      ),
    );
  });

  it("end of range never exceeds total", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10000 }),
        (offset, limit, total) => {
          const range = displayRange(offset, limit, total);
          const match = range.match(/\d+–(\d+) of (\d+)/);
          if (match) {
            expect(Number(match[1])).toBeLessThanOrEqual(Number(match[2]));
          }
        },
      ),
    );
  });
});

// ── Component render tests ──

describe("PaginationControls", () => {
  const noop = () => {};

  it("shows empty state when total is 0", () => {
    render(
      <PaginationControls
        pagination={{ offset: 0, limit: 10, total: 0, hasMore: false }}
        onPageChange={noop}
      />,
    );
    expect(screen.getByText("No results")).toBeDefined();
  });

  it("disables Prev on first page", () => {
    render(
      <PaginationControls
        pagination={{ offset: 0, limit: 10, total: 25, hasMore: true }}
        onPageChange={noop}
      />,
    );
    const prevBtn = screen.getByText("Prev").closest("button")!;
    expect(prevBtn.disabled).toBe(true);
  });

  it("disables Next when hasMore is false", () => {
    render(
      <PaginationControls
        pagination={{ offset: 20, limit: 10, total: 25, hasMore: false }}
        onPageChange={noop}
      />,
    );
    const nextBtn = screen.getByText("Next").closest("button")!;
    expect(nextBtn.disabled).toBe(true);
  });

  it("shows correct page info", () => {
    render(
      <PaginationControls
        pagination={{ offset: 10, limit: 10, total: 30, hasMore: true }}
        onPageChange={noop}
      />,
    );
    expect(screen.getByText("Page 2 of 3")).toBeDefined();
    expect(screen.getByText("11–20 of 30")).toBeDefined();
  });
});
