-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "professionId" TEXT NOT NULL,
    "profileImage" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "resumeLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professions" (
    "id" TEXT NOT NULL,
    "professionName" TEXT NOT NULL,

    CONSTRAINT "Professions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfessionPreferences" (
    "userId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,

    CONSTRAINT "UserProfessionPreferences_pkey" PRIMARY KEY ("userId","professionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Professions_professionName_key" ON "Professions"("professionName");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Professions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfessionPreferences" ADD CONSTRAINT "UserProfessionPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfessionPreferences" ADD CONSTRAINT "UserProfessionPreferences_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Professions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
