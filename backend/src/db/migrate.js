const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./index");

async function runMigrations() {
  const migrationsDirectory = path.resolve(__dirname, "../../migrations");
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRows = await pool.query(
    "SELECT filename FROM schema_migrations ORDER BY filename ASC",
  );

  const applied = new Set(appliedRows.rows.map((row) => row.filename));

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const fullPath = path.join(migrationsDirectory, file);
    const sql = await fs.readFile(fullPath, "utf-8");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

runMigrations()
  .then(async () => {
    await pool.end();
    // eslint-disable-next-line no-console
    console.log("Migrations completed.");
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Migration failure:", error);
    await pool.end();
    process.exit(1);
  });
