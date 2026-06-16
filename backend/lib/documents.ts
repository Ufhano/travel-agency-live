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

export async function ensureGroupBookingDocumentsSchema(
  sql: SqlExecutor,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS group_booking_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      group_booking_id TEXT NOT NULL REFERENCES group_bookings (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_group_booking_documents_booking ON group_booking_documents (group_booking_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_group_booking_documents_tenant ON group_booking_documents (tenant_id)`;
}

export async function insertGroupBookingDocument(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  title: string,
  fileName: string,
  buffer: Buffer,
): Promise<{ id: string }> {
  await ensureGroupBookingDocumentsSchema(sql);
  const docId = id("gbdoc");
  await sql`
    INSERT INTO group_booking_documents (id, tenant_id, group_booking_id, title, file_name, content_type, file_data)
    VALUES (${docId}, ${tenantId}, ${groupBookingId}, ${title}, ${fileName}, ${PDF_MIME}, ${buffer})
  `;
  return { id: docId };
}

export async function getGroupBookingProofDocument(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
): Promise<{
  fileName: string;
  contentType: string;
  buffer: Buffer;
} | null> {
  await ensureGroupBookingDocumentsSchema(sql);
  const rows = (await sql`
    SELECT file_name, content_type, file_data
    FROM group_booking_documents
    WHERE group_booking_id = ${groupBookingId} AND tenant_id = ${tenantId}
    ORDER BY uploaded_at DESC
    LIMIT 1
  `) as {
    file_name: string;
    content_type: string;
    file_data: Buffer | Uint8Array;
  }[];

  const row = rows[0];
  if (!row) return null;

  const buffer = Buffer.isBuffer(row.file_data)
    ? row.file_data
    : Buffer.from(row.file_data);

  return {
    fileName: row.file_name,
    contentType: row.content_type || PDF_MIME,
    buffer,
  };
}
