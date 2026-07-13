import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL || process.env.Database_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: dbUrl 
    ? { url: dbUrl }
    : {
        host: process.env.SQL_HOST || process.env.host || "",
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.user || "",
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.password || "",
        database: process.env.SQL_DB_NAME || process.env.database || "",
        ssl: false,
      },
  verbose: true,
});
