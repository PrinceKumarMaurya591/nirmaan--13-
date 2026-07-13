import { pgTable, text, timestamp, boolean, varchar, uuid, real, jsonb } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  owner_id: varchar("owner_id", { length: 50 }),
  created_at: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 50 }).primaryKey(),
  tenant_id: varchar("tenant_id", { length: 50 }).default('default'),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'Super Admin', 'Admin', 'Office Staff', 'Site Incharge', 'Munshi'
  email: varchar("email", { length: 255 }),
  project_id: varchar("project_id", { length: 50 }), // Null if cross-project/Admin - Legacy
  assigned_projects: jsonb("assigned_projects").default('[]'),
  phone: varchar("phone", { length: 20 }),
  pin: varchar("pin", { length: 255 }),
  petty_cash_balance: real("petty_cash_balance").default(0),
  status: varchar("status", { length: 50 }).default("Active"),
  photo: text("photo"),
  address_proof: text("address_proof"),
  can_view_subcontractors: boolean("can_view_subcontractors").default(false),
  preferences: jsonb("preferences").default('{}'),
  created_at: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id", { length: 50 }).primaryKey(),
  tenant_id: varchar("tenant_id", { length: 50 }).default('default'),
  name: varchar("name", { length: 255 }).notNull(),
  location: text("location"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  geofencing_enabled: boolean("geofencing_enabled").default(true),
  budget: real("budget"),
  department: varchar("department", { length: 255 }),
  scheme: varchar("scheme", { length: 255 }),
  incharge: varchar("incharge", { length: 255 }),
  woValue: real("woValue").default(0),
  received: real("received").default(0),
  documents: jsonb("documents").default('[]'),
  labors: jsonb("labors").default('[]'),
  subcontractors: jsonb("subcontractors").default('[]'),
  expenses: jsonb("expenses").default('{"material": 0, "shifting": 0, "labor": 0, "machinery": 0, "misc": 0}'),
  expenseItems: jsonb("expenseItems").default('[]'),
  receiptsHistory: jsonb("receiptsHistory").default('[]'),
  advanceHistory: jsonb("advanceHistory").default('[]'),
  supplierPayments: jsonb("supplierPayments").default('[]'),
  activityLogs: jsonb("activityLogs").default('[]'),
  status: varchar("status", { length: 50 }).default("Active"),
  created_at: timestamp("created_at").defaultNow(),
});

export const recycle_bin = pgTable("recycle_bin", {
  id: varchar("id", { length: 50 }).primaryKey(),
  tenant_id: varchar("tenant_id", { length: 50 }).default('default'),
  project_id: varchar("project_id", { length: 50 }),
  item_type: varchar("item_type", { length: 50 }).notNull(),
  item_name: varchar("item_name", { length: 255 }).notNull(),
  item_data: jsonb("item_data").notNull(),
  deleted_by: varchar("deleted_by", { length: 255 }),
  delete_reason: text("delete_reason"),
  deleted_at: timestamp("deleted_at").defaultNow(),
});


export const error_logs = pgTable("error_logs", {
  id: varchar("id", { length: 50 }).primaryKey(),
  tenant_id: varchar("tenant_id", { length: 50 }).default('default'),
  user_phone: varchar("user_phone", { length: 20 }),
  error_message: text("error_message").notNull(),
  error_stack: text("error_stack"),
  component: varchar("component", { length: 255 }),
  action: varchar("action", { length: 255 }),
  url: text("url"),
  browser_info: text("browser_info"),
  created_at: timestamp("created_at").defaultNow(),
});
