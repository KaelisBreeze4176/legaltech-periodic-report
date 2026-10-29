import { z } from "zod";
import { InfraiClient, infrai } from "./infrai_client.ts";

export const MatterIntake = z.object({
  matterId: z.string().min(1),
  clientName: z.string().min(1),
  signedDocumentDelivered: z.boolean(),
  deadline: z.string().date(),
});
export type MatterIntake = z.infer<typeof MatterIntake>;

export function followUpState(matter: MatterIntake, today: string): "follow-up" | "complete" {
  return matter.signedDocumentDelivered && matter.deadline >= today ? "complete" : "follow-up";
}

export function reportMarkdown(matter: MatterIntake, today: string): string {
  const state = followUpState(matter, today);
  return `# Matter ${matter.matterId}\n\nClient: ${matter.clientName}\nSigned document delivered: ${matter.signedDocumentDelivered ? "yes" : "no"}\nDeadline: ${matter.deadline}\nReview date: ${today}\nFollow-up state: ${state}`;
}

export async function runReport(matter: unknown, today: string, taskUrl: string) {
  const input = MatterIntake.parse(matter);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  const pdf = await infrai.pdf.generate(client, { markdown: reportMarkdown(input, today), page_size: "A4", orientation: "portrait", store: true });
  const schedule = await infrai.cron.create(client, { cron_expr: "0 8 * * 1", task: taskUrl });
  return { pdfJobId: pdf.job_id, scheduleJobId: schedule.job_id, state: followUpState(input, today) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { matterId: "MAT-104", clientName: "Northwind Legal", signedDocumentDelivered: true, deadline: "2026-11-15" };
  runReport(sample, "2026-10-28", process.env.REPORT_TASK_URL ?? "http://localhost:3000/report").then(console.log).catch((error) => { console.error(error); process.exitCode = 1; });
}
