import test from "node:test";
import assert from "node:assert/strict";
import { followUpState, MatterIntake } from "./report_worker.ts";

test("an undelivered signed document creates a deadline follow-up", () => {
  const matter = MatterIntake.parse({ matterId: "MAT-7", clientName: "Acme", signedDocumentDelivered: false, deadline: "2026-11-01" });
  assert.equal(followUpState(matter, "2026-10-28"), "follow-up");
});
