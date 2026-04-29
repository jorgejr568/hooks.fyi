import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

export async function putObject(args: {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  contentLength?: number;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      ContentLength: args.contentLength,
    }),
  );
}

export async function getObjectStream(key: string) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
  let body: ReadableStream<Uint8Array> | null = null;
  if (result.Body) {
    body =
      result.Body instanceof Readable
        ? (Readable.toWeb(result.Body) as ReadableStream<Uint8Array>)
        : (result.Body as ReadableStream<Uint8Array>);
  }
  return {
    body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

export async function getDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deletePrefix(prefix: string): Promise<void> {
  let token: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: { Objects: keys },
        }),
      );
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

export function buildAttachmentKey(args: {
  hookId: string;
  requestId: string;
  attachmentId: string;
  fileName?: string | null;
}): string {
  const safeName = (args.fileName ?? "file")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 200);
  return `hooks/${args.hookId}/${args.requestId}/${args.attachmentId}-${safeName}`;
}
