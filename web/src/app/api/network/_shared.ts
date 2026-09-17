import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { corsHeaders } from "@/lib/api";
import { NetworkError } from "@/lib/network/engine";
import { HttpError } from "@/lib/v1/http";

export const METHODS = "GET,POST,OPTIONS";

/** JSON replies for the public broker-network routes (CORS-open to the website). */
export function replier(req: NextRequest, cache = "no-store") {
  const headers = { ...corsHeaders(req, METHODS), "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  const refuse = (status: number, code: string, message: string) => reply(status, { error: { code, message } });
  const fromError = (err: unknown, tag: string) => {
    if (err instanceof HttpError) return refuse(err.status, err.code, err.message);
    if (err instanceof NetworkError) return refuse(409, "rejected", err.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error(`[${tag}] schema behind code:`, err.message);
      return refuse(503, "migration_pending", "This isn't available for a moment. Please try again shortly.");
    }
    console.error(`[${tag}]`, err);
    return refuse(500, "server_error", "Something went wrong on our side. Please try again.");
  };
  return { reply, refuse, fromError };
}
