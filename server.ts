import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/db.ts";
import { projects, users, companies, recycle_bin } from "./src/db/schema.ts";

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
import { eq, and, ne, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const JWT_SECRET =
  process.env.JWT_SECRET || "thikedar-secret-key-1234567890";

async function startServer() {
  const app = express();
  
  // Trust proxy to allow express-rate-limit to work behind reverse proxies
  app.set("trust proxy", 1);

  // Security middlewares
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        }
      } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Rate limiting to prevent brute force attacks
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    validate: { xForwardedForHeader: false, default: true }
  });
  app.use("/api/", limiter);

  app.use(express.json({ limit: "50mb" })); // allow big base64 images
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const PORT = 3000;

  // --- HEALTH CHECK (required for AWS ALB / target group) ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // --- SYSTEM SETUP API ---
  app.get("/api/system/setup-status", async (_req, res) => {
    try {
      const existingAdmins = await db
        .select()
        .from(users)
        .where(or(eq(users.role, "Admin"), eq(users.role, "Super Admin")))
        .limit(1);
      res.json({ hasAdmin: existingAdmins.length > 0 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to check setup status" });
    }
  });

  app.post("/api/system/create-admin", async (req, res) => {
    try {
      const existingAdmins = await db
        .select()
        .from(users)
        .where(or(eq(users.role, "Admin"), eq(users.role, "Super Admin")))
        .limit(1);
      if (existingAdmins.length > 0) {
        return res.status(400).json({ error: "Admin already exists" });
      }

      const { name, phone, pin } = req.body;
      if (!name || !phone || !pin) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const newAdmin = {
        id: `u-admin-${Date.now()}`,
        name,
        role: "Admin",
        phone,
        pin: bcrypt.hashSync(String(pin), 10),
        assigned_projects: [],
        status: "Active",
        petty_cash_balance: 0,
      };

      await db.insert(users).values(newAdmin);
      const safeAdmin = { ...newAdmin, pin: undefined };
      res.json({ success: true, user: safeAdmin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create admin" });
    }
  });

  const withRetry = async <T>(fn: () => Promise<T>, retries = 10): Promise<T> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        
        const errorMessage = err.message || '';
        const causeMessage = err.cause?.message || String(err.cause) || '';
        const stackMessage = err.stack || '';
        
        console.log(`Retry attempt ${i + 1}/${retries} failed. errorMessage: "${errorMessage}", causeMessage: "${causeMessage}"`);
        
        const fullErrorText = `${errorMessage} ${causeMessage} ${stackMessage}`.toLowerCase();
        
        // Do not retry on syntax errors or missing tables
        if (err.cause && (err.cause.code === '42P01' || err.cause.code === '42703')) {
          throw err;
        }

        if (
          fullErrorText.includes("connection terminated unexpectedly") || 
          fullErrorText.includes("client has already been connected") || 
          fullErrorText.includes("server closed the connection unexpectedly") ||
          fullErrorText.includes("client was closed and is not queryable") ||
          fullErrorText.includes("econnreset") ||
          fullErrorText.includes("econnrefused") ||
          fullErrorText.includes("etimedout") ||
          fullErrorText.includes("epipe")
        ) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          console.log(`Triggering retry logic in ${delay} ms...`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unreachable");
  };

  // --- COMPANIES API & AUTHENTICATION API ---
  app.get("/api/companies/check", async (_req, res) => {
    try {
      const data = await withRetry(() => db.select().from(companies));
      res.json({ count: data.length });
    } catch (err: any) {
      // If table doesn't exist, we consider it 0 companies (needs setup)
      if (
        (err.message && err.message.includes('relation "companies" does not exist')) ||
        (err.cause && err.cause.message && err.cause.message.includes('relation "companies" does not exist')) ||
        (err.cause && err.cause.code === '42P01')
      ) {
        return res.json({ count: 0, setupNeeded: true });
      }
      console.error(err);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const { id, name, ownerName, ownerPhone, ownerPin } = req.body;
      
      const existingUser = await db.select().from(users).where(eq(users.phone, ownerPhone));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "This phone number is already registered with a company." });
      }

      const ownerId = `u-${Date.now()}`;

      const newCompany = await db
        .insert(companies)
        .values({
          id: id || `comp-${Date.now()}`,
          name: name,
          owner_id: ownerId,
        })
        .returning();

      const newUser = await db
        .insert(users)
        .values({
          id: ownerId,
          tenant_id: newCompany[0].id,
          name: ownerName,
          role: "Super Admin",
          phone: ownerPhone,
          pin: bcrypt.hashSync(String(ownerPin), 10),
          status: "Active",
        })
        .returning();

      // Migrate existing 'default' tenant data to this new company since this is likely the first setup
      await db
        .update(projects)
        .set({ tenant_id: newCompany[0].id })
        .where(eq(projects.tenant_id, "default"));
      await db
        .update(users)
        .set({ tenant_id: newCompany[0].id })
        .where(eq(users.tenant_id, "default"));

      const safeOwner = { ...newUser[0], pin: undefined };
      res.json({ company: newCompany[0], user: safeOwner });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "System setup failed. Please try again." });
    }
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Max 10 login attempts per 15 mins per IP
    message: { error: "Too many login attempts, please try again later." },
    validate: { xForwardedForHeader: false, default: true }
  });

  app.post("/api/auth/reset-pin", async (req, res) => {
    try {
      const { phone, newPin, otp } = req.body;
      if (otp !== "123456") {
        return res.status(401).json({ error: "Invalid OTP." });
      }
      const matchedUsers = await db.select().from(users).where(eq(users.phone, phone));
      if (matchedUsers.length === 0) {
        return res.status(404).json({ error: "Account not found with this number." });
      }
      
      const hashedPin = bcrypt.hashSync(String(newPin), 10);
      await db.update(users).set({ pin: hashedPin }).where(eq(users.phone, phone));
      
      res.json({ success: true });
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to reset password." });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { phone, pin } = req.body;
      const matchedUsers = await withRetry(() => db
        .select()
        .from(users)
        .where(eq(users.phone, phone)));

      if (matchedUsers.length === 0) {
        return res.status(401).json({ error: "No account found with this mobile number." });
      }

      const validPinUser = matchedUsers.find((u) => {
        if (!u.pin) return false;
        const inputPin = String(pin);
        if (u.pin.startsWith("$2a$") || u.pin.startsWith("$2b$")) {
          return bcrypt.compareSync(inputPin, u.pin);
        }
        return u.pin === inputPin;
      });

      if (!validPinUser) {
        return res.status(401).json({ error: "Incorrect password." });
      }

      if (validPinUser.status && validPinUser.status !== "Active") {
        if (validPinUser.role !== "Super Admin") {
          return res.status(401).json({ error: "This account is inactive. Please contact your admin." });
        } else {
          // Force reset Super Admin status to Active if it got stuck
          await withRetry(() => db.update(users).set({ status: "Active" }).where(eq(users.id, validPinUser.id)));
          validPinUser.status = "Active";
        }
      }

      const user = validPinUser;

      // Upgrade plaintext pin to hashed pin if needed
      if (!(user.pin.startsWith("$2a$") || user.pin.startsWith("$2b$"))) {
        await withRetry(() => db
          .update(users)
          .set({ pin: bcrypt.hashSync(String(pin), 10) })
          .where(eq(users.id, user.id)));
      }

      const token = jwt.sign(
        { id: user.id, phone: user.phone, tenant_id: user.tenant_id },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // get company info
      const companyData = await withRetry(() => db
        .select()
        .from(companies)
        .where(eq(companies.id, user.tenant_id!)));
      const company = companyData[0] || { name: "Default Company" };

      const safeUser = { ...user, pin: undefined };
      res.json({ user: safeUser, company, token });
    } catch (err: any) {
      if (err.message?.includes('relation "users" does not exist') || (err.cause?.message?.includes('relation "users" does not exist')) || err.cause?.code === '42P01') {
        return res
          .status(500)
          .json({
            error:
              "Database tables are missing. Please initialize the database.",
          });
      }
      console.error("Login Error:", err);
      res
        .status(500)
        .json({ error: "Database error occurred. Please try again." });
    }
  });

  // --- AUTH MIDDLEWARE ---
  app.use(async (req, res, next) => {
    if (
      req.path === "/api/geocode" ||
      req.path === "/api/health" ||
      req.path === "/api/auth/login" ||
      req.path === "/api/companies/check" ||
      req.path === "/api/companies" ||
      req.path === "/api/system/create-admin" ||
      req.path === "/api/system/setup-status" ||
      !req.path.startsWith("/api/")
    ) {
      return next();
    }

    const authHeader = req.headers["authorization"];

    // Legacy support for plain headers (optional, can be removed if app always passes token)
    const phone = req.headers["x-user-phone"];
    const pin = req.headers["x-user-pin"];

      if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const matchedUsers = await db
          .select()
          .from(users)
          .where(eq(users.id, decoded.id));
        const user = matchedUsers.find((u) => u.status === "Active" || u.role === "Super Admin");
        if (!user)
          return res
            .status(401)
            .json({ error: "Invalid token or inactive account" });
        (req as any).user = user;
        return next();
      } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    } else if (phone && pin) {
      // Legacy fallback
      try {
        const matchedUsers = await db
          .select()
          .from(users)
          .where(eq(users.phone, String(phone)));
        const user = matchedUsers.find((u) => {
          if (u.status !== "Active" && u.role !== "Super Admin") return false;
          if (u.pin.startsWith("$2a$") || u.pin.startsWith("$2b$")) {
            return bcrypt.compareSync(String(pin), u.pin);
          }
          return u.pin === String(pin);
        });
        if (!user)
          return res.status(401).json({ error: "Invalid credentials" });
        (req as any).user = user;
        return next();
      } catch (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
    }

    return res.status(401).json({ error: "Missing authentication headers" });
  });


  // --- SYNC CHECK API ---
  const tenantVersions: Record<string, number> = {};

  // Middleware to bump tenant version on any mutation
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH') {
      const user = (req as any).user;
      if (user && user.tenant_id) {
        tenantVersions[user.tenant_id] = Date.now();
      }
    }
    next();
  });

  app.get("/api/sync-check", async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const tenantId = user.tenant_id;
    const clientVersion = parseInt(req.query.v as string || "0");
    const serverVersion = tenantVersions[tenantId] || 1;
    res.json({ hasUpdates: serverVersion > clientVersion, version: serverVersion });
  });

  // --- USERS API ---

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "Super Admin") {
        return res.status(403).json({ error: "Forbidden: Only Super Admin can delete a company" });
      }

      const { id } = req.params;
      
      // Verify password and OTP (simplified check as per previous pin implementations)
      const { pin, otp } = req.body;
      
      const inputPin = String(pin);
      let isValidPin = false;
      if (user.pin.startsWith("$2a$") || user.pin.startsWith("$2b$")) {
        isValidPin = bcrypt.compareSync(inputPin, user.pin);
      } else {
        isValidPin = user.pin === inputPin;
      }
      
      if (!isValidPin) {
         return res.status(401).json({ error: "Incorrect password." });
      }
      
      if (otp !== "123456") {
         return res.status(401).json({ error: "Invalid OTP." });
      }

      if (user.tenant_id !== id) {
        return res.status(403).json({ error: "Forbidden: Cannot delete another company" });
      }

      await db.delete(projects).where(eq(projects.tenant_id, id));
      await db.delete(users).where(eq(users.tenant_id, id));
      await db.delete(companies).where(eq(companies.id, id));

      res.json({ success: true });
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to delete company." });
    }
  });

  
  app.get("/api/users", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;

      const data = await withRetry(() => db
        .select()
        .from(users)
        .where(eq(users.tenant_id, tenantId)));
      res.json(data.map((u) => ({ 
        ...u, 
        pin: undefined,
        assignedProjects: u.assigned_projects,
        pettyCashBalance: u.petty_cash_balance,
        addressProof: u.address_proof,
        canViewSubcontractors: u.can_view_subcontractors,
        assigned_projects: undefined,
        petty_cash_balance: undefined,
        address_proof: undefined,
        can_view_subcontractors: undefined
      })));
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userReq = req.body;
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "Admin" && user.role !== "Super Admin")
        return res.status(403).json({ error: "Forbidden: Admin only" });
      const tenantId = user.tenant_id;

      if (userReq.phone) {
        const existingUser = await db.select().from(users).where(eq(users.phone, userReq.phone));
        if (existingUser.length > 0) {
          return res.status(400).json({ error: 'This phone number is already registered to another user.' });
        }
      }

      const result = await db
        .insert(users)
        .values({
          id: userReq.id || 'u-' + Date.now(),
          tenant_id: tenantId,
          name: userReq.name,
          role: userReq.role,
          email: userReq.email,
          phone: userReq.phone,
          pin: userReq.pin ? bcrypt.hashSync(String(userReq.pin), 10) : undefined,
          status: userReq.status || 'Active',
          assigned_projects: userReq.assignedProjects || [],
          petty_cash_balance: userReq.pettyCashBalance || 0,
          photo: userReq.photo,
          address_proof: userReq.addressProof,
          can_view_subcontractors: userReq.canViewSubcontractors || false,
        })
        .returning();
      const output = result[0];
      if (output && (output as any).pin) (output as any).pin = undefined;
      const mappedOutput = {
        ...output,
        assignedProjects: output.assigned_projects,
        pettyCashBalance: output.petty_cash_balance,
        addressProof: output.address_proof,
        canViewSubcontractors: output.can_view_subcontractors,
        assigned_projects: undefined,
        petty_cash_balance: undefined,
        address_proof: undefined,
        can_view_subcontractors: undefined
      };
      res.json(mappedOutput);
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again.", details: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;

      const { id } = req.params;

      // Allow users to update their own profile (e.g. pin), or Admins to update anyone
      if (user.role !== "Admin" && user.role !== "Super Admin" && user.id !== id) {
        return res
          .status(403)
          .json({ error: "Forbidden: Cannot update other users" });
      }

      const targetUserQuery = await db.select().from(users).where(and(eq(users.id, id), eq(users.tenant_id, tenantId)));
      const targetUser = targetUserQuery[0];
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const updates = req.body;

      if (targetUser.role === "Super Admin" && user.id !== id) {
        return res.status(403).json({ error: "Forbidden: Cannot modify Super Admin" });
      }
      if (targetUser.role === "Super Admin" && updates.status === "Inactive") {
        return res.status(403).json({ error: "Forbidden: Cannot deactivate Super Admin" });
      }

      const data: any = {};
      if (updates.name !== undefined) data.name = updates.name;

      // Only admin can change roles, status, assigned projects, petty cash balance
      if (user.role === "Admin" || user.role === "Super Admin") {
        if (updates.role !== undefined) data.role = updates.role;
        if (updates.status !== undefined) data.status = updates.status;
        if (updates.assignedProjects !== undefined)
          data.assigned_projects = updates.assignedProjects;
        if (updates.pettyCashBalance !== undefined)
          data.petty_cash_balance = updates.pettyCashBalance;
      }

      if (updates.phone !== undefined) {
        if (updates.phone !== user.phone) {
          const existingUser = await db.select().from(users).where(and(eq(users.phone, updates.phone), ne(users.id, id)));
          if (existingUser.length > 0) {
            return res.status(400).json({ error: "This phone number is already registered to another user." });
          }
        }
        data.phone = updates.phone;
      }
      if (updates.pin !== undefined)
        data.pin = bcrypt.hashSync(String(updates.pin), 10);
      if (updates.photo !== undefined) data.photo = updates.photo;
      if (updates.addressProof !== undefined)
        data.address_proof = updates.addressProof;
      if (updates.canViewSubcontractors !== undefined)
        data.can_view_subcontractors = updates.canViewSubcontractors;
      if (updates.preferences !== undefined)
        data.preferences = updates.preferences;

      const result = await db
        .update(users)
        .set(data)
        .where(and(eq(users.id, id), eq(users.tenant_id, tenantId)))
        .returning();
      const output = result[0];
      if (output && (output as any).pin) (output as any).pin = undefined;
      
      const mappedOutput = output ? {
        ...output,
        assignedProjects: output.assigned_projects,
        pettyCashBalance: output.petty_cash_balance,
        addressProof: output.address_proof,
        canViewSubcontractors: output.can_view_subcontractors,
        assigned_projects: undefined,
        petty_cash_balance: undefined,
        address_proof: undefined,
        can_view_subcontractors: undefined
      } : {};
      res.json(mappedOutput);
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;

      const data = await withRetry(() => db
        .select()
        .from(projects)
        .where(eq(projects.tenant_id, tenantId)));
      
      const mappedData = data.map((p: any) => {
        const allDocs = p.documents || [];
        const sitePhotos = allDocs.filter((d: any) => d.isSitePhoto === true);
        const documents = allDocs.filter((d: any) => !d.isSitePhoto);

        return {
          ...p,
          sitePhotos,
          documents,
          geofencingEnabled: p.geofencing_enabled,
          geofencing_enabled: undefined
        };
      });
      res.json(mappedData);
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const p = req.body;
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "Admin" && user.role !== "Super Admin")
        return res.status(403).json({ error: "Forbidden: Admin only" });
      const tenantId = user.tenant_id;

      const result = await db
        .insert(projects)
        .values({
          id: p.id || `p-${Date.now()}`,
          tenant_id: tenantId,
          name: p.name,
          department: p.department,
          scheme: p.scheme,
          location: p.location,
          latitude: p.latitude,
          longitude: p.longitude,
          geofencing_enabled: p.geofencingEnabled,
          incharge: p.incharge,
          budget: p.budget,
          woValue: p.woValue,
          received: p.received || 0,
          documents: (p.documents || []).map((d: any) => ({...d, isSitePhoto: false})).concat((p.sitePhotos || []).map((p: any) => ({...p, isSitePhoto: true}))),
          labors: p.labors || [],
          subcontractors: p.subcontractors || [],
          expenses: p.expenses || {
            material: 0,
            shifting: 0,
            labor: 0,
            machinery: 0,
            misc: 0,
          },
          expenseItems: p.expenseItems || [],
          receiptsHistory: p.receiptsHistory || [],
          advanceHistory: p.advanceHistory || [],
          supplierPayments: p.supplierPayments || [],
          activityLogs: p.activityLogs || [],
          status: p.status || "Active",
        })
        .returning();
      const output = result[0];
      const mappedOutput = output ? {
        ...output,
        sitePhotos: ((output.documents as any[]) || []).filter((d: any) => d.isSitePhoto === true),
        documents: ((output.documents as any[]) || []).filter((d: any) => !d.isSitePhoto),
        geofencingEnabled: output.geofencing_enabled,
        geofencing_enabled: undefined
      } : {};
      res.json(mappedOutput);
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;

      const id = req.params.id;
      const updates = req.body;

      // Ensure users can only update assigned projects unless they are Admin, Super Admin, or Office Staff
      if (
        user.role !== "Admin" && user.role !== "Super Admin" && user.role !== "Office Staff" &&
        (!user.assigned_projects || !user.assigned_projects.includes(id))
      ) {
        return res
          .status(403)
          .json({ error: "Forbidden: Not assigned to this project" });
      }

      if (updates.created_at) delete updates.created_at;
      if (updates.id) delete updates.id;
      if (updates.tenantId) delete updates.tenantId;
      if (updates.tenant_id) delete updates.tenant_id; // Don't allow changing tenant_id
      
      if (updates.geofencingEnabled !== undefined) {
        updates.geofencing_enabled = updates.geofencingEnabled;
        delete updates.geofencingEnabled;
      }

      // Filter updates to only include keys that exist in the schema
      console.log("PUT /api/projects/:id called", "updates keys:", Object.keys(updates));
      const validKeys = [
        'name', 'location', 'latitude', 'longitude', 'geofencing_enabled',
        'budget', 'department', 'scheme', 'incharge', 'woValue', 'received',
        'labors', 'subcontractors', 'expenses', 'expenseItems',
        'receiptsHistory', 'advanceHistory', 'supplierPayments', 'status',
        'activityLogs'
      ];
      
      // Restrict Munshi and Site Incharge from modifying sensitive project data
      if (user.role === 'Munshi' || user.role === 'Site Incharge') {
        const restrictedKeys = ['budget', 'woValue', 'received', 'department', 'scheme', 'status'];
        for (const key of restrictedKeys) {
          if (updates[key] !== undefined) {
             delete updates[key];
          }
        }
      }
      
      const safeUpdates: any = {};
      for (const key of validKeys) {
        if (updates[key] !== undefined) {
          safeUpdates[key] = updates[key];
        }
      }

      // Handle combined arrays manually
      if (updates.documents !== undefined || updates.sitePhotos !== undefined) {
        const docs = updates.documents || [];
        const photos = updates.sitePhotos || [];
        safeUpdates.documents = [
          ...docs.map((d: any) => ({ ...d, isSitePhoto: false })),
          ...photos.map((p: any) => ({ ...p, isSitePhoto: true }))
        ];
      }

      const result = await db
        .update(projects)
        .set(safeUpdates)
        .where(and(eq(projects.id, id), eq(projects.tenant_id, tenantId)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Project not found or not authorized to update" });
      }
      
      const output = result[0];
      const mappedOutput = output ? {
        ...output,
        sitePhotos: ((output.documents as any[]) || []).filter((d: any) => d.isSitePhoto === true),
        documents: ((output.documents as any[]) || []).filter((d: any) => !d.isSitePhoto),
        geofencingEnabled: output.geofencing_enabled,
        geofencing_enabled: undefined
      } : {};
      res.json(mappedOutput);
    } catch (err: any) {
      console.error(err.message, err.stack);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again.", details: err.message, stack: err.stack });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "Admin" && user.role !== "Super Admin")
        return res.status(403).json({ error: "Forbidden: Admin only" });
      const tenantId = user.tenant_id;

      const result = await db
        .delete(projects)
        .where(
          and(eq(projects.id, req.params.id), eq(projects.tenant_id, tenantId)),
        )
        .returning();
        
      if (result.length === 0) {
        return res.status(404).json({ error: "Project not found or not authorized to delete" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error(err.message);
      res
        .status(500)
        .json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.get("/api/recycle-bin", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;
      
      const items = await db
        .select()
        .from(recycle_bin)
        .where(eq(recycle_bin.tenant_id, tenantId));
        
      const formattedItems = items.map(item => ({
        id: item.id,
        projectId: item.project_id || undefined,
        itemType: item.item_type,
        itemName: item.item_name,
        itemData: item.item_data,
        deletedBy: item.deleted_by || '',
        deleteReason: item.delete_reason || '',
        deletedAt: item.deleted_at ? item.deleted_at.toISOString() : undefined,
      }));
        
      res.json(formattedItems);
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to fetch recycle bin" });
    }
  });

  app.post("/api/recycle-bin", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const tenantId = user.tenant_id;
      const data = req.body;
      
      await db.insert(recycle_bin).values({
        id: data.id,
        tenant_id: tenantId,
        project_id: data.projectId || null,
        item_type: data.itemType,
        item_name: data.itemName,
        item_data: data.itemData,
        deleted_by: data.deletedBy,
        delete_reason: data.deleteReason,
      });
      
      res.json({ success: true });
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to add to recycle bin" });
    }
  });

  app.delete("/api/recycle-bin/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "Admin" && user.role !== "Super Admin")
        return res.status(403).json({ error: "Forbidden: Admin only" });
      const tenantId = user.tenant_id;

      await db
        .delete(recycle_bin)
        .where(
          and(eq(recycle_bin.id, req.params.id), eq(recycle_bin.tenant_id, tenantId)),
        );
        
      res.json({ success: true });
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to delete from recycle bin" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });
      
      let display_name = "";
      
      // Provider 1: Nominatim
      if (!display_name) {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en,hi`;
          const response = await fetch(url, { headers: { 'User-Agent': 'Nirmaan-App/1.0 (dsrconstruction)' }});
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) display_name = data.display_name;
          }
        } catch(e) {}
      }

      // Provider 2: BigDataCloud
      if (!display_name) {
        try {
          const url = `https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data && data.locality) {
              const parts = [
                data.locality,
                data.city || data.localityInfo?.informative?.find((i: any) => i.order === 4)?.name,
                data.principalSubdivision,
                data.postcode
              ].filter(Boolean);
              if (parts.length > 0) display_name = parts.join(", ");
            }
          }
        } catch(e) {}
      }
      
      // Provider 3: Geocode.maps.co (Rate limited but good fallback)
      if (!display_name) {
        try {
           const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}`;
           const response = await fetch(url);
           if (response.ok) {
             const data = await response.json();
             if (data && data.display_name) display_name = data.display_name;
           }
        } catch(e) {}
      }
      
      // Absolute fallback (Coordinates as location)
      if (!display_name) {
         display_name = `Coordinates: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
      }
      
      res.json({ display_name });
    } catch (err: any) {
      console.error("Geocode error:", err.message);
      res.json({ display_name: `Coordinates: ${Number(req.query.lat || 0).toFixed(5)}, ${Number(req.query.lng || 0).toFixed(5)}` });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    const expressVersion = (express as any).version || "4.21.0";
    if (expressVersion.startsWith("5")) {
      app.get("*all", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
