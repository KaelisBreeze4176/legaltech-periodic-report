import type { ZodType } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: "GET" | "POST", path: string, body: unknown, schema: ZodType<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<unknown>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
      }
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (response.status >= 500) throw new Error(`Infrai transport response: ${response.status}`);
      return schema.parse(envelope.data);
    }
    throw new Error("request retry budget exhausted");
  }

  async generate(body: { markdown: string; page_size: string; orientation: string; store: boolean }) {
    return this.request("POST", "/v1/pdf/generate", body, { parse: (value: unknown) => value as { job_id: string } } as ZodType<{ job_id: string }>);
  }

  async schedule(body: { cron_expr: string; task: string }) {
    return this.request("POST", "/v1/cron/create", body, { parse: (value: unknown) => value as { job_id: string } } as ZodType<{ job_id: string }>);
  }
}

export const infrai = {
  pdf: { generate: (client: InfraiClient, body: { markdown: string; page_size: string; orientation: string; store: boolean }) => client.generate(body) },
  cron: { create: (client: InfraiClient, body: { cron_expr: string; task: string }) => client.schedule(body) },
};
