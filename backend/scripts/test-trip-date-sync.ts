import assert from "node:assert/strict";
import { shiftEmbeddedDatesInLabel } from "../lib/shift-trip-label-dates";
import { syncTripFieldsForDepartureChange } from "../lib/trip-update";

const cases: Array<[string, string, string, string]> = [
  [
    "Mozambique 08 - 11 October 2025",
    "2025-10-08",
    "2026-10-08",
    "Mozambique 08 - 11 October 2026",
  ],
  ["28 - 30 Aug 2025", "2025-08-28", "2026-08-28", "28 - 30 Aug 2026"],
  ["30 August 2025", "2025-08-30", "2026-08-30", "30 August 2026"],
  ["Aug 28 - 30, 2025", "2025-08-28", "2026-08-28", "Aug 28 - 30, 2026"],
];

for (const [label, oldD, newD, expected] of cases) {
  const got = shiftEmbeddedDatesInLabel(label, oldD, newD);
  assert.equal(got, expected, JSON.stringify({ label, got, expected }));
}

/* Departure already 2026 but title still says 2025 — re-saving date repairs label. */
const stuck = syncTripFieldsForDepartureChange({
  name: "Mozambique 08 - 11 October 2025",
  destination: "Mozambique",
  oldDepartureDate: "2026-10-08",
  newDepartureDate: "2026-10-08",
});
assert.equal(stuck.name, "Mozambique 08 - 11 October 2026");
assert.deepEqual(stuck.balanceDueDatesToRewrite, ["2025-10-08"]);

const normal = syncTripFieldsForDepartureChange({
  name: "Mozambique 08 - 11 October 2025",
  destination: "Mozambique",
  oldDepartureDate: "2025-10-08",
  newDepartureDate: "2026-10-08",
});
assert.equal(normal.name, "Mozambique 08 - 11 October 2026");
assert.ok(normal.balanceDueDatesToRewrite.includes("2025-10-08"));

console.log("All date-sync checks passed");
