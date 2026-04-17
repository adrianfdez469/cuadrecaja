-- CreateEnum
CREATE TYPE "PromoterStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('ACTIVATION', 'MAGIC_LOGIN');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('CAPTURED', 'PENDING_FIRST_PAYMENT', 'QUALIFIED', 'LIQUIDATION_PENDING', 'LIQUIDATED_MANUALLY', 'REJECTED_FRAUD', 'CANCELLED_UNPAID_DELETED');

-- CreateEnum
CREATE TYPE "ReferralLiquidationStatus" AS ENUM ('PENDING', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "ReferralEntityType" AS ENUM ('PROMOTER', 'REFERRAL', 'LIQUIDATION');

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "promoCode" TEXT NOT NULL,
    "status" "PromoterStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenType" "AuthTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promoterId" TEXT,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRewardRule" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "discountForNewBusiness" DOUBLE PRECISION NOT NULL,
    "rewardForPromoter" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "newBusinessId" TEXT NOT NULL,
    "promoCodeSnapshot" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING_FIRST_PAYMENT',
    "fraudReason" TEXT,
    "firstPaidAt" TIMESTAMP(3),
    "firstPaidPlanId" TEXT,
    "newBusinessDiscountSnapshot" DOUBLE PRECISION,
    "promoterRewardSnapshot" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLiquidation" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "status" "ReferralLiquidationStatus" NOT NULL DEFAULT 'PENDING',
    "liquidatedAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "paymentMethod" TEXT,
    "note" TEXT,
    "liquidatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralLiquidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEventLog" (
    "id" TEXT NOT NULL,
    "referralId" TEXT,
    "entityType" "ReferralEntityType" NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_email_key" ON "Promoter"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_promoCode_key" ON "Promoter"("promoCode");

-- CreateIndex
CREATE INDEX "Promoter_status_idx" ON "Promoter"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_email_idx" ON "AuthToken"("email");

-- CreateIndex
CREATE INDEX "AuthToken_tokenType_idx" ON "AuthToken"("tokenType");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRewardRule_planId_key" ON "ReferralRewardRule"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_newBusinessId_key" ON "Referral"("newBusinessId");

-- CreateIndex
CREATE INDEX "Referral_promoterId_idx" ON "Referral"("promoterId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_firstPaidAt_idx" ON "Referral"("firstPaidAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLiquidation_referralId_key" ON "ReferralLiquidation"("referralId");

-- CreateIndex
CREATE INDEX "ReferralLiquidation_status_idx" ON "ReferralLiquidation"("status");

-- CreateIndex
CREATE INDEX "ReferralEventLog_entityType_idx" ON "ReferralEventLog"("entityType");

-- CreateIndex
CREATE INDEX "ReferralEventLog_eventType_idx" ON "ReferralEventLog"("eventType");

-- CreateIndex
CREATE INDEX "ReferralEventLog_createdAt_idx" ON "ReferralEventLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRewardRule" ADD CONSTRAINT "ReferralRewardRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_newBusinessId_fkey" FOREIGN KEY ("newBusinessId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_firstPaidPlanId_fkey" FOREIGN KEY ("firstPaidPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLiquidation" ADD CONSTRAINT "ReferralLiquidation_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEventLog" ADD CONSTRAINT "ReferralEventLog_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
