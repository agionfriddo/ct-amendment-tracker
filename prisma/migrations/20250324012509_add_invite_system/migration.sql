/*
  Warnings:

  - A unique constraint covering the columns `[inviteId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteId" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_email_key" ON "Invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteId_key" ON "User"("inviteId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
