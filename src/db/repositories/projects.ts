import type { DatabaseSync } from "node:sqlite";

import { parseProjectRow, parseRowList, type ParsedProjectRow } from "../sqlite-values.js";

export type ProjectRow = ParsedProjectRow;

export interface InsertProjectInput {
  id: string;
  slug: string;
  cfAccountId: string;
  cfProjectName: string;
  productionBranch?: string;
  createdAt: string;
}

export function findProjectById(db: DatabaseSync, id: string): ProjectRow | undefined {
  const stmt = db.prepare(`
    SELECT id, slug, cf_account_id, cf_project_name, production_branch, status, created_at
    FROM projects
    WHERE id = ?
  `);
  return parseProjectRow(stmt.get(id));
}

export function findProjectBySlug(db: DatabaseSync, slug: string): ProjectRow | undefined {
  const stmt = db.prepare(`
    SELECT id, slug, cf_account_id, cf_project_name, production_branch, status, created_at
    FROM projects
    WHERE slug = ?
  `);
  return parseProjectRow(stmt.get(slug));
}

export function listProjects(db: DatabaseSync): ProjectRow[] {
  const stmt = db.prepare(`
    SELECT id, slug, cf_account_id, cf_project_name, production_branch, status, created_at
    FROM projects
    ORDER BY created_at DESC
  `);
  return parseRowList(stmt.all(), parseProjectRow);
}

export function insertProject(db: DatabaseSync, input: InsertProjectInput): void {
  const stmt = db.prepare(`
    INSERT INTO projects (id, slug, cf_account_id, cf_project_name, production_branch, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `);
  stmt.run(
    input.id,
    input.slug,
    input.cfAccountId,
    input.cfProjectName,
    input.productionBranch ?? null,
    input.createdAt,
  );
}
