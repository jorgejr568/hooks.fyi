import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { putObject, buildAttachmentKey } from "@/lib/s3";
import type { ParsedRequest } from "./types";

export interface PersistResult {
  id: string;
  attachmentIds: string[];
  createdAt: Date;
}

export async function persistRequest(args: {
  hookId: string;
  parsed: ParsedRequest;
}): Promise<PersistResult> {
  const { hookId, parsed } = args;
  const requestId = randomUUID();

  const attachmentRecords: Array<{
    id: string;
    fieldName: string | null;
    fileName: string | null;
    contentType: string | null;
    size: bigint;
    s3Key: string;
  }> = [];

  for (const file of parsed.files) {
    const attachmentId = randomUUID();
    const s3Key = buildAttachmentKey({
      hookId,
      requestId,
      attachmentId,
      fileName: file.fileName,
    });
    await putObject({
      key: s3Key,
      body: Buffer.from(file.bytes),
      contentType: file.contentType ?? "application/octet-stream",
      contentLength: file.bytes.byteLength,
    });
    attachmentRecords.push({
      id: attachmentId,
      fieldName: file.fieldName,
      fileName: file.fileName,
      contentType: file.contentType,
      size: BigInt(file.bytes.byteLength),
      s3Key,
    });
  }

  const created = await prisma.request.create({
    data: {
      id: requestId,
      hookId,
      method: parsed.method,
      path: parsed.path.slice(0, 2048),
      query: parsed.query as object,
      headers: parsed.headers as object,
      contentType: parsed.contentType ?? null,
      body: parsed.body,
      bodyTruncated: parsed.bodyTruncated,
      bodySize: parsed.bodySize,
      ip: parsed.ip,
      userAgent: parsed.userAgent?.slice(0, 512) ?? null,
      attachments: {
        create: attachmentRecords.map((a) => ({
          id: a.id,
          fieldName: a.fieldName,
          fileName: a.fileName,
          contentType: a.contentType,
          size: a.size,
          s3Key: a.s3Key,
        })),
      },
    },
    select: { id: true, createdAt: true },
  });

  return {
    id: created.id,
    createdAt: created.createdAt,
    attachmentIds: attachmentRecords.map((a) => a.id),
  };
}
