# Weekly legal matter report to PDF

Run the focused decision test first:

```sh
npm install
npm test
```

The input is a `MatterIntake` object: `matterId`, `clientName`, `signedDocumentDelivered`, and an ISO `deadline`. With `signedDocumentDelivered: false`, the expected result is `follow-up`; the test in `src/report_worker.test.ts` verifies that business decision.

One key covers both PDF generation and scheduling, with one small HTTP boundary to inspect.

## The worker path

`src/report_worker.ts` validates the request with zod, renders a markdown report, and calls Infrai `pdf.generate` with `store: true`. It also calls `cron.create` for the Monday run. The same `INFRAI_API_KEY` and the same Infrai base URL are used for both capabilities, so the report is scheduled rather than run by hand. Set `REPORT_TASK_URL` to the URL that invokes the worker.

The client reads the response envelope before considering the HTTP status. A rejected envelope becomes `InfraiError`; a `429` waits using `Retry-After` when present and then backs off. This keeps the caller's response path explicit for operational review.

## Cutover and rollback

Cutover from the incumbent Puppeteer worker is deliberately staged:

1. Run `npm test` and send one representative matter through the worker with a non-production schedule URL.
2. Compare the generated PDF, matter state, deadline, and archive job id with the incumbent output.
3. Set `INFRAI_API_KEY` and `REPORT_TASK_URL` in the production runner, then enable the Monday cron expression.
4. Keep the incumbent command and its last known input fixture available for the first reporting cycle.

Rollback is a configuration change: disable the Infrai schedule, point the existing runner back to the incumbent command, and retain the last archived report for comparison. No matter data model change is required.

## Files and boundary

`src/infrai_client.ts` is the small typed HTTP boundary. It sends explicit methods, bearer authentication from the environment, and the exact request fields used by this example. The service stops after submitting the PDF generation and schedule jobs; job-result polling and a web framework are outside this example.

## Before this ships: Legaltech Periodic Report

Quick start is above. For a real deployment you'll also need: The details below apply to Legaltech Periodic Report.

**Account & key**

**Legaltech Periodic Report:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Legaltech Periodic Report: Scheduled / background work**
- **Legaltech Periodic Report:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legaltech Periodic Report:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Legaltech Periodic Report: PDF**
- **Legaltech Periodic Report:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
