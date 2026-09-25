-- CreateIndex
CREATE INDEX "AuditLog_action_target_createdAt_idx" ON "AuditLog"("action", "target", "createdAt");
