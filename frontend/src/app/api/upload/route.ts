import { NextResponse } from "next/server";

import { ingestFile } from "@backend/ingestion";

/** Image OCR can be slow; spreadsheets/PDF are typically fast */
export const maxDuration = 120;
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Multipart upload for the ingestion pipeline (`POST /api/upload`).
 * Field name: `file`
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data"))
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      );

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file))
      return NextResponse.json(
        { error: 'Missing form field "file".' },
        { status: 400 },
      );

    const typed = file as File;
    const buf = Buffer.from(await typed.arrayBuffer());

    const result = await ingestFile({
      buffer: buf,
      filename: typed.name || "upload.bin",
      mime: typed.type?.trim() || null,
      maxBytes: MAX_BYTES,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/upload]", e);
    return NextResponse.json(
      {
        structuredData: {},
        rawExtractedText: "",
        rawRows: [],
        logs: [
          `Unhandled server error: ${e instanceof Error ? e.message : String(e)}`,
        ],
      },
      { status: 500 },
    );
  }
}
