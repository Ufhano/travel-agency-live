import { randomBytes } from "node:crypto";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

const PDF_MIME = "application/pdf";
const MAX_PDF_BYTES = 6 * 1024 * 1024;

export async function ensureClientDocumentsSchema(
  sql: SqlExecutor,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents (client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_documents_tenant ON client_documents (tenant_id)`;
}

export function validatePdfUpload(
  file: File | { name: string; type: string; size: number },
): string | null {
  const name = file.name?.toLowerCase() ?? "";
  const type = file.type?.toLowerCase() ?? "";
  if (!name.endsWith(".pdf") && type !== PDF_MIME) {
    return "Only PDF files are accepted as proof of payment";
  }
  if (file.size > MAX_PDF_BYTES) {
    return "File too large (max 6 MB).";
  }
  return null;
}

export async function insertClientDocument(
  sql: SqlExecutor,
  tenantId: string,
  clientId: string,
  title: string,
  fileName: string,
  buffer: Buffer,
): Promise<{ id: string }> {
  await ensureClientDocumentsSchema(sql);
  const docId = id("doc");
  await sql`
    INSERT INTO client_documents (id, tenant_id, client_id, title, file_name, content_type, file_data)
    VALUES (${docId}, ${tenantId}, ${clientId}, ${title}, ${fileName}, ${PDF_MIME}, ${buffer})
  `;
  return { id: docId };
}
