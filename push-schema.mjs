// Push schema to database using drizzle-orm directly
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

console.log("🔌 Connecting to database...");
const client = postgres(dbUrl, { ssl: "require", max: 1 });
const db = drizzle(client);

// Create tables manually using SQL
const tables = [
  `CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    project_id VARCHAR(50),
    assigned_projects JSONB DEFAULT '[]',
    phone VARCHAR(20),
    pin VARCHAR(255),
    petty_cash_balance REAL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Active',
    photo TEXT,
    address_proof TEXT,
    can_view_subcontractors BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    location TEXT,
    latitude REAL,
    longitude REAL,
    geofencing_enabled BOOLEAN DEFAULT true,
    budget REAL,
    department VARCHAR(255),
    scheme VARCHAR(255),
    incharge VARCHAR(255),
    woValue REAL DEFAULT 0,
    received REAL DEFAULT 0,
    documents JSONB DEFAULT '[]',
    labors JSONB DEFAULT '[]',
    subcontractors JSONB DEFAULT '[]',
    expenses JSONB DEFAULT '{"material":0,"shifting":0,"labor":0,"machinery":0,"misc":0}',
    expenseItems JSONB DEFAULT '[]',
    receiptsHistory JSONB DEFAULT '[]',
    advanceHistory JSONB DEFAULT '[]',
    supplierPayments JSONB DEFAULT '[]',
    activityLogs JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS recycle_bin (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'default',
    project_id VARCHAR(50),
    item_type VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_data JSONB NOT NULL,
    deleted_by VARCHAR(255),
    delete_reason TEXT,
    deleted_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS error_logs (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'default',
    user_phone VARCHAR(20),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    component VARCHAR(255),
    action VARCHAR(255),
    url TEXT,
    browser_info TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`
];

try {
  for (const sqlStmt of tables) {
    console.log(`📋 Executing: ${sqlStmt.substring(0, 60)}...`);
    await db.execute(sql.raw(sqlStmt));
    console.log("   ✅ Done");
  }
  console.log("\n✅ All tables created successfully!");
} catch (e) {
  console.error("❌ Error:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
