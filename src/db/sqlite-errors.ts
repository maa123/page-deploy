export function isSqliteUniqueConstraint(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const err = error as { code?: string; message?: string };
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return true;
  }
  if (typeof err.message === "string" && /UNIQUE constraint failed/i.test(err.message)) {
    return true;
  }
  return false;
}
