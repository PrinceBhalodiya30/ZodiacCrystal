export interface AuditLog {
  auditLogId: number;
  adminName: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  createdAt: string;
}
