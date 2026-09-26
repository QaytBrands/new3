-- Neon Auth identity mapping. Additive and non-destructive: no rows or columns are dropped.
--
-- Pre-check (must return no rows, otherwise resolve duplicates before deploying):
--   SELECT lower(email), count(*) FROM "User" WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

-- Emails become the Neon Auth sign-in identifier: normalise to lowercase so lookups are exact.
UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" IS NOT NULL AND "email" <> lower(trim("email"));
UPDATE "User" SET "email" = NULL WHERE "email" = '';

-- Stable Neon Auth user id (the only key used to map a session to an application user).
ALTER TABLE "User" ADD COLUMN "neon_auth_user_id" TEXT;
CREATE UNIQUE INDEX "User_neon_auth_user_id_key" ON "User"("neon_auth_user_id");

-- One application user per sign-in email.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Passwords now live in Neon Auth. The Auth.js hash column is kept (nullable) for rollback; not dropped.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
