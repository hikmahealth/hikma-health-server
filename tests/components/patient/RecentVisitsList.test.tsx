import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import fc from "fast-check";
import {
  RecentVisitsList,
  VisitRow,
  EventRow,
  formatVisitDate,
  eventSummary,
} from "@/components/patient/RecentVisitsList";
import type { VisitWithEvents } from "@/lib/server-functions/visits";
import type Event from "@/models/event";

// ── Pure function tests ──

describe("formatVisitDate", () => {
  it('returns "—" for null/undefined', () => {
    expect(formatVisitDate(null)).toBe("—");
    expect(formatVisitDate(undefined)).toBe("—");
  });

  it("always returns a non-empty string for any date input", () => {
    fc.assert(
      fc.property(fc.date(), (d) => {
        const result = formatVisitDate(d);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });

  it('returns "—" for invalid/NaN dates', () => {
    expect(formatVisitDate("not-a-date")).toBe("—");
    expect(formatVisitDate(new Date(NaN))).toBe("—");
  });

  it("formats valid dates into a readable string", () => {
    const d = new Date("2024-06-15T10:30:00Z");
    const result = formatVisitDate(d);
    expect(result).not.toBe("—");
    expect(result).toContain("2024");
  });
});

describe("eventSummary", () => {
  it("prefers event_type when present", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .filter((s) => s.trim().length > 0),
        (eventType) => {
          const event = { event_type: eventType } as Event.EncodedT;
          expect(eventSummary(event)).toBe(eventType.trim());
        },
      ),
      { numRuns: 20 },
    );
  });

  it("falls back to form_id prefix when event_type is absent", () => {
    const event = {
      event_type: null,
      form_id: "abcdefgh-1234-5678-9012-abcdefghijkl",
    } as Event.EncodedT;
    expect(eventSummary(event)).toBe("Form abcdefgh");
  });

  it('returns "Event" when both are absent', () => {
    const event = { event_type: null, form_id: null } as Event.EncodedT;
    expect(eventSummary(event)).toBe("Event");
  });

  it("treats whitespace-only event_type as absent", () => {
    const event = {
      event_type: "   ",
      form_id: "12345678-aaaa-bbbb-cccc-dddddddddddd",
    } as Event.EncodedT;
    expect(eventSummary(event)).toBe("Form 12345678");
  });
});

// ── Arbitraries ──

const eventArb: fc.Arbitrary<Event.EncodedT> = fc.record({
  id: fc.uuid(),
  patient_id: fc.uuid(),
  visit_id: fc.option(fc.uuid(), { nil: null }),
  form_id: fc.option(fc.uuid(), { nil: null }),
  event_type: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
    nil: null,
  }),
  form_data: fc.array(fc.constant({ key: "val" }), {
    minLength: 0,
    maxLength: 3,
  }),
  metadata: fc.constant({}),
  is_deleted: fc.constant(false),
  created_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  updated_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  last_modified: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  server_created_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  deleted_at: fc.constant(null),
  recorded_by_user_id: fc.constant(null),
});

const visitArb: fc.Arbitrary<VisitWithEvents> = fc.record({
  id: fc.uuid(),
  patient_id: fc.uuid(),
  clinic_id: fc.uuid(),
  provider_id: fc.uuid(),
  provider_name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), {
    nil: null,
  }),
  check_in_timestamp: fc.option(
    fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
    { nil: null },
  ),
  metadata: fc.constant({}),
  is_deleted: fc.constant(false),
  created_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  updated_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  last_modified: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  server_created_at: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2030-01-01"),
  }),
  deleted_at: fc.constant(null),
  events: fc.array(eventArb, { minLength: 0, maxLength: 4 }),
});

// ── Component tests ──

describe("EventRow", () => {
  it("renders event summary for any event", () => {
    fc.assert(
      fc.property(eventArb, (event) => {
        const { container, unmount } = render(<EventRow event={event} />);
        const view = within(container);
        expect(view.getByText(eventSummary(event), { normalizer: (s) => s })).toBeDefined();
        unmount();
      }),
      { numRuns: 15 },
    );
  });

  it("never throws for any event", () => {
    fc.assert(
      fc.property(eventArb, (event) => {
        const { container, unmount } = render(<EventRow event={event} />);
        expect(
          container.querySelector('[data-testid="event-row"]'),
        ).not.toBeNull();
        unmount();
      }),
      { numRuns: 15 },
    );
  });
});

describe("VisitRow", () => {
  it("renders visit id prefix for any visit", () => {
    fc.assert(
      fc.property(visitArb, (visit) => {
        const { container, unmount } = render(<VisitRow visit={visit} />);
        const view = within(container);
        expect(view.getByText(visit.id.slice(0, 8))).toBeDefined();
        unmount();
      }),
      { numRuns: 20 },
    );
  });

  it("shows provider name when present and hides it for whitespace-only", () => {
    fc.assert(
      fc.property(
        visitArb.filter((v) => v.provider_name !== null),
        (visit) => {
          const { container, unmount } = render(<VisitRow visit={visit} />);
          const view = within(container);
          const trimmed = visit.provider_name!.trim();
          if (trimmed) {
            expect(view.getByText(`Provider: ${trimmed}`)).toBeDefined();
          } else {
            expect(view.queryByText(/Provider:/)).toBeNull();
          }
          unmount();
        },
      ),
      { numRuns: 10 },
    );
  });

  it("shows event count when events are present", () => {
    fc.assert(
      fc.property(
        visitArb.filter((v) => v.events.length > 0),
        (visit) => {
          const { container, unmount } = render(<VisitRow visit={visit} />);
          const view = within(container);
          const label =
            visit.events.length === 1
              ? "1 event"
              : `${visit.events.length} events`;
          expect(view.getByText(label)).toBeDefined();
          unmount();
        },
      ),
      { numRuns: 10 },
    );
  });

  it("does not render collapsible when no events", () => {
    fc.assert(
      fc.property(
        visitArb.map((v) => ({ ...v, events: [] })),
        (visit) => {
          const { container, unmount } = render(<VisitRow visit={visit} />);
          expect(
            container.querySelector('[data-slot="collapsible"]'),
          ).toBeNull();
          unmount();
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe("RecentVisitsList", () => {
  const emptyPag = { offset: 0, limit: 10, total: 0, hasMore: false };
  const noop = () => {};

  it("shows empty message when no visits", () => {
    render(
      <RecentVisitsList
        visits={[]}
        pagination={emptyPag}
        onPageChange={noop}
      />,
    );
    expect(screen.getByText("No recent visits recorded")).toBeDefined();
  });

  it("renders one row per visit", () => {
    fc.assert(
      fc.property(
        fc.array(visitArb, { minLength: 1, maxLength: 5 }),
        (visits) => {
          const pag = {
            offset: 0,
            limit: 10,
            total: visits.length,
            hasMore: false,
          };
          const { container, unmount } = render(
            <RecentVisitsList
              visits={visits}
              pagination={pag}
              onPageChange={noop}
            />,
          );
          // Each visit produces either a plain div.border.rounded-lg or a collapsible with the same classes
          const rows = container.querySelectorAll(".border.rounded-lg");
          expect(rows.length).toBe(visits.length);
          unmount();
        },
      ),
      { numRuns: 10 },
    );
  });
});
