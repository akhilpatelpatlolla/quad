-- CreateEnum
CREATE TYPE "CreditOrderStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CreditOrderStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditOrder_razorpayOrderId_key" ON "CreditOrder"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditOrder_razorpayPaymentId_key" ON "CreditOrder"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "CreditOrder_userId_status_idx" ON "CreditOrder"("userId", "status");

-- AddForeignKey
ALTER TABLE "CreditOrder" ADD CONSTRAINT "CreditOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
