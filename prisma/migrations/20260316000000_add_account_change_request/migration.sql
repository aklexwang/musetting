-- CreateTable
CREATE TABLE "AccountChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beforeHolder" TEXT NOT NULL,
    "beforeBank" TEXT NOT NULL,
    "beforeAccount" TEXT NOT NULL,
    "afterHolder" TEXT NOT NULL,
    "afterBank" TEXT NOT NULL,
    "afterAccount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AccountChangeRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AccountChangeRequest" ADD CONSTRAINT "AccountChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
