-- CreateTable
CREATE TABLE "Hook" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" UUID NOT NULL,
    "hookId" UUID NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "path" VARCHAR(2048) NOT NULL,
    "query" JSONB NOT NULL DEFAULT '{}',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "contentType" VARCHAR(255),
    "body" TEXT,
    "bodyTruncated" BOOLEAN NOT NULL DEFAULT false,
    "bodySize" INTEGER NOT NULL DEFAULT 0,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fieldName" VARCHAR(255),
    "fileName" VARCHAR(512),
    "contentType" VARCHAR(255),
    "size" BIGINT NOT NULL,
    "s3Key" VARCHAR(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hook_createdAt_idx" ON "Hook"("createdAt");

-- CreateIndex
CREATE INDEX "Request_hookId_createdAt_idx" ON "Request"("hookId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_s3Key_key" ON "Attachment"("s3Key");

-- CreateIndex
CREATE INDEX "Attachment_requestId_idx" ON "Attachment"("requestId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "Hook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
