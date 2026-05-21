import { redirect } from "next/navigation";
import { loadAppData, type LoadAppDataResult } from "@backend/load-app-data";
import { getSession } from "@/lib/auth-server";
import type { SessionPayload } from "@/lib/session-token";

export type PageDataResult = LoadAppDataResult & {
  session: SessionPayload;
};

export async function loadAppDataForPage(): Promise<PageDataResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  const result = await loadAppData(session.tenantId);
  return { ...result, session };
}
