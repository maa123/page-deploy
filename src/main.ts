import { openDatabase } from "./db/database.js";
import { loadConfig } from "./config.js";
import { bootstrapAdminUser } from "./admin/bootstrap.js";
import { startAdminServer } from "./admin/server.js";
import { startApiServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.sqlitePath);

  const adminUsername = process.env.ADMIN_USERNAME?.trim() || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const bootstrap = await bootstrapAdminUser(db, {
    username: adminUsername,
    password: adminPassword,
  });

  if (bootstrap.created) {
    process.stderr.write(
      `Admin user created: username=${bootstrap.username}\n`,
    );
    if (bootstrap.generatedPassword) {
      process.stderr.write(
        `Generated admin password (save now, shown once): ${bootstrap.generatedPassword}\n`,
      );
    }
  }

  await Promise.all([startApiServer(config, db), startAdminServer(config, db)]);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
