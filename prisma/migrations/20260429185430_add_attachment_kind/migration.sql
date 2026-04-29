-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('MULTIPART_FILE', 'RAW_BODY');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "kind" "AttachmentKind" NOT NULL DEFAULT 'MULTIPART_FILE';

-- CreateIndex
CREATE INDEX "Attachment_requestId_kind_idx" ON "Attachment"("requestId", "kind");
