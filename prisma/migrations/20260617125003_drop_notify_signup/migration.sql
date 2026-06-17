-- CreateTable
CREATE TABLE "DropNotifySignup" (
    "id" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropNotifySignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DropNotifySignup_dropId_email_key" ON "DropNotifySignup"("dropId", "email");

-- AddForeignKey
ALTER TABLE "DropNotifySignup" ADD CONSTRAINT "DropNotifySignup_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
