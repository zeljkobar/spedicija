-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ZIRO_RACUN', 'GOTOVINA', 'KARTICA', 'KOMPENZACIJA', 'OSTALO');

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'ZIRO_RACUN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_paymentDate_idx" ON "InvoicePayment"("invoiceId", "paymentDate");

-- AddForeignKey
ALTER TABLE "InvoicePayment"
ADD CONSTRAINT "InvoicePayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
