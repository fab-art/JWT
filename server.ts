/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "reflect-metadata";
import express from "express";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import { AppDataSource, initializeDatabase } from "./src/db/data-source";
import {
  VoucherEntity,
  FacilityRecordEntity,
  InvestigationNoteEntity,
  PatientEntity,
  ProviderEntity,
  FacilityEntity,
  CaseEntity,
  AuditTrailEntity,
  UserEntity
} from "./src/db/entities";
import { ClaimStatus, MatchCategory, RevisitAlert } from "./src/types";
import { normalizeDate, normalizeNumeric, normalizeRama, mapColumns, IdentityResolver } from "./src/utils/cleaning";
import { auditClinicalClaim } from "./src/utils/drugs";
import { matchVoucherToRecords } from "./src/utils/matching";
import { createServer as createViteServer } from "vite";
import { PharmaMLAnomalyDetector } from "./src/utils/anomalyDetector";
import { signToken, authenticateJWT, requireRole, AuthenticatedRequest } from "./src/utils/auth";

const app = express();
const PORT = 3000;

// Configure JSON and URL-encoded body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Configure multer memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Lazy-initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// Helper to synchronize Patient, Provider, and Facility Master Tables
async function syncMasterTables() {
  console.log("[Data Engine] Synchronizing master entities from active vouchers...");
  const voucherRepo = AppDataSource.getRepository(VoucherEntity);
  const patientRepo = AppDataSource.getRepository(PatientEntity);
  const providerRepo = AppDataSource.getRepository(ProviderEntity);
  const facilityRepo = AppDataSource.getRepository(FacilityEntity);

  const vouchers = await voucherRepo.find();

  const patientMap: Record<string, { name: string; rama: string; spend: number; claims: number }> = {};
  const providerMap: Record<string, { name: string; claims: number; flagged: number }> = {};
  const facilityMap: Record<string, { name: string; spend: number; claims: number }> = {};

  for (const v of vouchers) {
    const pKey = v.ramaNumberNormalized || v.patientNameNormalized;
    if (pKey) {
      if (!patientMap[pKey]) {
        patientMap[pKey] = { name: v.patientName, rama: v.ramaNumber, spend: 0, claims: 0 };
      }
      patientMap[pKey].spend += v.amount;
      patientMap[pKey].claims += 1;
    }

    const dKey = v.doctorNameNormalized || "unknown";
    if (dKey) {
      if (!providerMap[dKey]) {
        providerMap[dKey] = { name: v.doctorName, claims: 0, flagged: 0 };
      }
      providerMap[dKey].claims += 1;
      if (v.isFlagged || v.isMlAnomaly) {
        providerMap[dKey].flagged += 1;
      }
    }

    const fKey = v.facilityName;
    if (fKey) {
      if (!facilityMap[fKey]) {
        facilityMap[fKey] = { name: v.facilityName, spend: 0, claims: 0 };
      }
      facilityMap[fKey].spend += v.amount;
      facilityMap[fKey].claims += 1;
    }
  }

  // 1. Update Patients
  for (const [ramaNorm, data] of Object.entries(patientMap)) {
    const score = Math.min(100, (data.claims * 6) + (data.spend / 150000) * 15);
    let level = "LOW";
    if (score > 70) level = "CRITICAL";
    else if (score > 45) level = "HIGH";
    else if (score > 20) level = "MEDIUM";

    let patient = await patientRepo.findOneBy({ ramaNumberNormalized: ramaNorm });
    if (!patient) {
      patient = new PatientEntity();
      patient.ramaNumberNormalized = ramaNorm;
    }
    patient.name = data.name;
    patient.ramaNumber = data.rama;
    patient.totalClaims = data.claims;
    patient.totalSpend = data.spend;
    patient.riskScore = parseFloat(score.toFixed(1));
    patient.riskLevel = level;
    await patientRepo.save(patient);
  }

  // 2. Update Providers
  for (const [docNorm, data] of Object.entries(providerMap)) {
    const flagRate = data.claims > 0 ? (data.flagged / data.claims) : 0;
    const score = Math.min(100, (data.claims * 5) + (flagRate * 55));

    let provider = await providerRepo.findOneBy({ nameNormalized: docNorm });
    if (!provider) {
      provider = new ProviderEntity();
      provider.nameNormalized = docNorm;
    }
    provider.name = data.name;
    provider.totalPrescriptions = data.claims;
    provider.flaggedPrescriptionsCount = data.flagged;
    provider.riskScore = parseFloat(score.toFixed(1));
    await providerRepo.save(provider);
  }

  // 3. Update Facilities
  for (const [name, data] of Object.entries(facilityMap)) {
    let facility = await facilityRepo.findOneBy({ name });
    if (!facility) {
      facility = new FacilityEntity();
      facility.name = name;
    }
    facility.totalClaimsCount = data.claims;
    facility.totalDispensedValue = data.spend;
    await facilityRepo.save(facility);
  }

  console.log(`[Data Engine] Synchronized Master Tables: ${Object.keys(patientMap).length} Patients, ${Object.keys(providerMap).length} Providers, ${Object.keys(facilityMap).length} Facilities.`);
}

// Helper to Apply ML Anomaly Detection model across all loaded claims
async function runMLAnomalyEngine() {
  console.log("[ML Engine] Initiating training run...");
  const voucherRepo = AppDataSource.getRepository(VoucherEntity);
  const vouchers = await voucherRepo.find();

  if (vouchers.length === 0) return;

  const detector = new PharmaMLAnomalyDetector();
  detector.train(vouchers);

  // Group vouchers by patient for window calculation
  const vouchersByPatient: Record<string, VoucherEntity[]> = {};
  for (const v of vouchers) {
    const key = v.ramaNumberNormalized || v.patientNameNormalized;
    if (!vouchersByPatient[key]) {
      vouchersByPatient[key] = [];
    }
    vouchersByPatient[key].push(v);
  }

  for (const v of vouchers) {
    const patientClaims = vouchersByPatient[v.ramaNumberNormalized || v.patientNameNormalized] || [];
    const prediction = detector.predict(v, patientClaims);
    v.mlAnomalyScore = prediction.score;
    v.mlAnomalyReason = prediction.reasons.join(" | ");
    v.isMlAnomaly = prediction.isAnomaly;
    await voucherRepo.save(v);
  }

  console.log(`[ML Engine] Anomaly scoring completed. Classified ${vouchers.filter(v => v.isMlAnomaly).length} anomalous vouchers.`);
}

// Helper to Log Audit Trails
async function logAuditTrail(action: string, userEmail: string, userRole: string, details: string) {
  try {
    const trailRepo = AppDataSource.getRepository(AuditTrailEntity);
    const trail = new AuditTrailEntity();
    trail.action = action;
    trail.userEmail = userEmail;
    trail.userRole = userRole;
    trail.details = details;
    await trailRepo.save(trail);
  } catch (err) {
    console.error("Failed to write audit trail:", err);
  }
}

// Ensure database has seed data if empty
async function seedDatabaseIfEmpty() {
  const voucherRepo = AppDataSource.getRepository(VoucherEntity);
  const facilityRepo = AppDataSource.getRepository(FacilityRecordEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);

  // 1. Seed RBAC Users
  const userCount = await userRepo.count();
  if (userCount === 0) {
    console.log("Pre-seeding default RBAC user accounts...");
    const defaultUsers = [
      { email: "admin@pharmascan.gov.rw", password: "admin123", role: "Admin" },
      { email: "investigator@pharmascan.gov.rw", password: "investigator123", role: "Investigator" },
      { email: "auditor@pharmascan.gov.rw", password: "auditor123", role: "Read-Only" }
    ];
    for (const u of defaultUsers) {
      const user = new UserEntity();
      user.email = u.email;
      user.password = u.password;
      user.role = u.role;
      await userRepo.save(user);
    }
  }

  // 2. Seed Vouchers and Logs
  const count = await voucherRepo.count();
  if (count > 0) {
    // If database already contains claims, make sure master tables are synchronized
    await syncMasterTables();
    await runMLAnomalyEngine();
    return;
  }

  console.log("Seeding realistic pharmacy and facility records...");

  // Seed hospital facility encounter logs
  const hospitalLogs = [
    { patientName: "Jean Claude Uwimana", ramaNumber: "RW/001045", date: "2026-06-25", service: "Internal Medicine Consultation", amount: 15000, facilityName: "Kigali Referral Hospital" },
    { patientName: "Marie Gisele Mutesi", ramaNumber: "RW/002341", date: "2026-06-26", service: "Pediatrics Consultation", amount: 12000, facilityName: "CHUK Kigali" },
    { patientName: "Aline Umutoni", ramaNumber: "RW/009182", date: "2026-06-27", service: "Outpatient General Consultation", amount: 8000, facilityName: "Gikondo Health Centre" },
    { patientName: "Jean de Dieu Niyonisenga", ramaNumber: "RW/005512", date: "2026-06-28", service: "Cardiology Specialist Visit", amount: 25000, facilityName: "Kigali Referral Hospital" },
    { patientName: "Therese Mukandekezi", ramaNumber: "RW/003451", date: "2026-06-29", service: "Gynecology Outpatient", amount: 18000, facilityName: "CHUK Kigali" },
    { patientName: "Eustache Nsengiyumva", ramaNumber: "RW/007421", date: "2026-06-30", service: "General Consultation", amount: 6000, facilityName: "Remera Health Centre" }
  ];

  for (const log of hospitalLogs) {
    const rec = new FacilityRecordEntity();
    rec.patientName = log.patientName;
    rec.patientNameNormalized = log.patientName.toLowerCase();
    rec.ramaNumber = log.ramaNumber;
    rec.ramaNumberNormalized = normalizeRama(log.ramaNumber);
    rec.date = log.date;
    rec.service = log.service;
    rec.amount = log.amount;
    rec.facilityName = log.facilityName;
    await facilityRepo.save(rec);
  }

  // Seed pharmacy claims vouchers (with some anomalies and duplicate spellings)
  const pharmacyVouchers = [
    { patientName: "Jean-Claude Uwimana", ramaNumber: "RW/001045", date: "2026-06-25", medicineName: "Amlodipine 5mg Tab", quantity: 30, amount: 1200, doctorName: "Dr. Gasana Emmanuel", facilityName: "Kigali Pharmacy", status: ClaimStatus.APPROVED },
    { patientName: "Marie Gisele Mutesi", ramaNumber: "RW/002341", date: "2026-06-20", medicineName: "Omeprazole 20mg Cap", quantity: 30, amount: 3000, doctorName: "Dr. Mukarage Alice", facilityName: "CHUK Pharmacy", status: ClaimStatus.INVESTIGATING },
    { patientName: "Alexandre Hakizimana", ramaNumber: "RW/008892", date: "2026-06-28", medicineName: "Amoxicillin 500mg Cap", quantity: 20, amount: 3000, doctorName: "Dr. Ntaganda John", facilityName: "Gikondo Pharmacy", status: ClaimStatus.PENDING },
    { patientName: "Aline Umutoni", ramaNumber: "RW/009182", date: "2026-06-27", medicineName: "Paracetamol 500mg Tab", quantity: 200, amount: 4000, doctorName: "Dr. Uwase Jane", facilityName: "Sun Pharmacy", status: ClaimStatus.INVESTIGATING },
    { patientName: "Jean de Dieu Niyonisenga", ramaNumber: "RW/005512", date: "2026-06-28", medicineName: "Insulin Glargine 100 U/ml", quantity: 4, amount: 38000, doctorName: "Dr. Gasana Emmanuel", facilityName: "Remera Dispensary", status: ClaimStatus.INVESTIGATING },
    { patientName: "Therese Mukandekezi", ramaNumber: "RW/003451", date: "2026-06-29", medicineName: "Ceftriaxone 1g Inj", quantity: 8, amount: 12000, doctorName: "Dr. Nyandwi Charles", facilityName: "Kigali Pharmacy", status: ClaimStatus.APPROVED },
    { patientName: "Jean Claude Uwimana", ramaNumber: "RW/001045", date: "2026-06-25", medicineName: "Paracetamol 500mg Tab", quantity: 30, amount: 600, doctorName: "Dr. Gasana E.", facilityName: "Kigali Pharmacy", status: ClaimStatus.APPROVED },
    { patientName: "Marie G. Mutesi", ramaNumber: "RW/002341", date: "2026-06-27", medicineName: "Amoxicillin 500mg Cap", quantity: 20, amount: 3000, doctorName: "Dr. Gasana Emmanuel", facilityName: "Apex Pharmacy", status: ClaimStatus.INVESTIGATING }
  ];

  for (const v of pharmacyVouchers) {
    const audit = auditClinicalClaim(v.medicineName, v.quantity, v.amount, v.facilityName);

    const vouch = new VoucherEntity();
    vouch.patientName = v.patientName;
    vouch.patientNameNormalized = v.patientName.toLowerCase();
    vouch.ramaNumber = v.ramaNumber;
    vouch.ramaNumberNormalized = normalizeRama(v.ramaNumber);
    vouch.date = v.date;
    vouch.medicineName = v.medicineName;
    vouch.quantity = v.quantity;
    vouch.amount = v.amount;
    vouch.doctorName = v.doctorName;
    vouch.doctorNameNormalized = v.doctorName.toLowerCase();
    vouch.facilityName = v.facilityName;
    vouch.status = v.status;
    vouch.isFlagged = audit.isFlagged;
    vouch.flagReason = audit.flagReason || "";
    await voucherRepo.save(vouch);
  }

  // Pre-seed a default investigation case
  const caseRepo = AppDataSource.getRepository(CaseEntity);
  const sampleCase = new CaseEntity();
  sampleCase.title = "Review: Potential Doctor Shopping Alert";
  sampleCase.description = "Multiple rapid revisits detected for Patient Marie Gisele Mutesi (RW/002341) within a 4-day interval across Kigali medical providers.";
  sampleCase.status = "Open";
  sampleCase.investigator = "investigator@pharmascan.gov.rw";
  sampleCase.targetType = "patient";
  sampleCase.targetId = "RW/002341";
  sampleCase.findings = "Initial screening reports consecutive prescriptions of Omeprazole and Amoxicillin within a tight window. Potential therapeutic duplication. Verification of matching facility record required.";
  await caseRepo.save(sampleCase);

  console.log("Seeding complete!");

  // Compute master tables and anomaly classifications post-seeding
  await syncMasterTables();
  await runMLAnomalyEngine();
}

// -------------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 2. Authentication Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRepo = AppDataSource.getRepository(UserEntity);
    const user = await userRepo.findOneBy({ email });

    if (!user || user.password !== password) {
      res.status(401).json({ error: "Invalid email or password credentials." });
      return;
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    await logAuditTrail("USER_LOGIN", user.email, user.role, `User logged in from PharmaScan Portal`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Me verification
app.get("/api/auth/me", authenticateJWT as any, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  res.json({ user: req.user });
});

// 4. Upload Voucher Claims (CSV, Excel, ODS)
app.post("/api/vouchers/upload", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    if (rows.length === 0) {
      res.status(400).json({ error: "The uploaded file is empty" });
      return;
    }

    const headers = Object.keys(rows[0]);
    const mapped = mapColumns(headers);

    if (!mapped.patientName || !mapped.medicineName || !mapped.amount || !mapped.date) {
      res.status(400).json({
        error: "Could not auto-map required headers. Please ensure your file has Patient Name, Drug, Amount, and Date columns."
      });
      return;
    }

    const voucherRepo = AppDataSource.getRepository(VoucherEntity);

    // Identity Resolver for normalization
    const rawPatientNames = rows.map(r => String(r[mapped.patientName] || ""));
    const rawDoctorNames = rows.map(r => String(r[mapped.doctorName] || "Unknown Prescriber"));

    const patientResolver = new IdentityResolver(rawPatientNames);
    const doctorResolver = new IdentityResolver(rawDoctorNames);

    const savedVouchers: VoucherEntity[] = [];

    for (const row of rows) {
      const rawPatient = String(row[mapped.patientName] || "");
      const rawDoctor = String(row[mapped.doctorName] || "Unknown Prescriber");

      const normalizedPatient = patientResolver.resolve(rawPatient);
      const normalizedDoctor = doctorResolver.resolve(rawDoctor);

      const dateStr = normalizeDate(row[mapped.date]);
      const amountVal = normalizeNumeric(row[mapped.amount]);
      const quantityVal = Math.max(1, normalizeNumeric(row[mapped.quantity] || 1));
      const ramaRaw = row[mapped.ramaNumber] ? String(row[mapped.ramaNumber]) : "";
      const medicine = String(row[mapped.medicineName] || "");
      const facility = String(row[mapped.facilityName] || "Independent Pharmacy");

      // Apply Clinical Auditing Rules
      const audit = auditClinicalClaim(medicine, quantityVal, amountVal, facility);

      const voucher = new VoucherEntity();
      voucher.patientName = rawPatient;
      voucher.patientNameNormalized = normalizedPatient.toLowerCase();
      voucher.ramaNumber = ramaRaw;
      voucher.ramaNumberNormalized = normalizeRama(ramaRaw);
      voucher.date = dateStr || new Date().toISOString().split("T")[0];
      voucher.medicineName = medicine;
      voucher.quantity = quantityVal;
      voucher.amount = amountVal;
      voucher.doctorName = rawDoctor;
      voucher.doctorNameNormalized = normalizedDoctor.toLowerCase();
      voucher.facilityName = facility;
      voucher.status = ClaimStatus.PENDING;
      voucher.isFlagged = audit.isFlagged;
      voucher.flagReason = audit.flagReason || "";

      const saved = await voucherRepo.save(voucher);
      savedVouchers.push(saved);
    }

    // Recalculate Master tables and Train ML with newly added records
    await syncMasterTables();
    await runMLAnomalyEngine();

    await logAuditTrail(
      "CLAIM_UPLOADED",
      req.user?.email || "Unknown",
      req.user?.role || "Unknown",
      `Uploaded claims file containing ${savedVouchers.length} claims.`
    );

    res.json({
      success: true,
      message: `Successfully imported, clinical-audited, and ML-scored ${savedVouchers.length} pharmacy vouchers.`,
      count: savedVouchers.length
    });
  } catch (error: any) {
    console.error("Voucher import error:", error);
    res.status(500).json({ error: "Failed to parse voucher spreadsheet: " + error.message });
  }
});

// 5. Upload Hospital Facility Records
app.post("/api/facility-records/upload", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    if (rows.length === 0) {
      res.status(400).json({ error: "The uploaded file is empty" });
      return;
    }

    const headers = Object.keys(rows[0]);
    const mapped = mapColumns(headers);

    if (!mapped.patientName || !mapped.date) {
      res.status(400).json({
        error: "Could not map patient name or date for hospital encounter verification."
      });
      return;
    }

    const facilityRepo = AppDataSource.getRepository(FacilityRecordEntity);

    const rawPatientNames = rows.map(r => String(r[mapped.patientName] || ""));
    const resolver = new IdentityResolver(rawPatientNames);

    let importCount = 0;
    for (const row of rows) {
      const rawName = String(row[mapped.patientName] || "");
      const resolvedName = resolver.resolve(rawName);
      const dateStr = normalizeDate(row[mapped.date]);
      const ramaRaw = row[mapped.ramaNumber] ? String(row[mapped.ramaNumber]) : "";
      const serviceStr = String(row[mapped.service] || "General Consultation");
      const amountVal = normalizeNumeric(row[mapped.amount] || 0);
      const facilityStr = String(row[mapped.facilityName] || "Kigali Hospital");

      const rec = new FacilityRecordEntity();
      rec.patientName = rawName;
      rec.patientNameNormalized = resolvedName.toLowerCase();
      rec.ramaNumber = ramaRaw;
      rec.ramaNumberNormalized = normalizeRama(ramaRaw);
      rec.date = dateStr || new Date().toISOString().split("T")[0];
      rec.service = serviceStr;
      rec.amount = amountVal;
      rec.facilityName = facilityStr;

      await facilityRepo.save(rec);
      importCount++;
    }

    await logAuditTrail(
      "FACILITY_RECORD_UPLOADED",
      req.user?.email || "Unknown",
      req.user?.role || "Unknown",
      `Uploaded ${importCount} hospital logs for cross-facility auditing.`
    );

    res.json({
      success: true,
      message: `Successfully imported ${importCount} hospital facility visit encounters for cross-facility verification.`,
      count: importCount
    });
  } catch (error: any) {
    console.error("Facility records upload error:", error);
    res.status(500).json({ error: "Failed to parse hospital logs: " + error.message });
  }
});

// 6. Retrieve All Vouchers
app.get("/api/vouchers", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(VoucherEntity);
    const vouchers = await repo.find({ order: { date: "DESC", id: "DESC" } });
    res.json(vouchers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Retrieve All Facility Records
app.get("/api/facility-records", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(FacilityRecordEntity);
    const records = await repo.find({ order: { date: "DESC" } });
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Update Claim Status / Note
app.post("/api/vouchers/:id/status", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, note } = req.body;

    const repo = AppDataSource.getRepository(VoucherEntity);
    const voucher = await repo.findOneBy({ id });

    if (!voucher) {
      res.status(404).json({ error: "Voucher not found" });
      return;
    }

    const previousStatus = voucher.status;

    if (status && Object.values(ClaimStatus).includes(status)) {
      voucher.status = status;
      await repo.save(voucher);

      await logAuditTrail(
        "CLAIM_STATUS_UPDATED",
        req.user?.email || "Unknown",
        req.user?.role || "Unknown",
        `Changed claim ID ${id} status from ${previousStatus} to ${status}.`
      );
    }

    if (note) {
      const noteRepo = AppDataSource.getRepository(InvestigationNoteEntity);
      const auditNote = new InvestigationNoteEntity();
      auditNote.claimType = "voucher";
      auditNote.targetId = String(id);
      auditNote.author = req.user?.email || "Auditor";
      auditNote.note = note;
      await noteRepo.save(auditNote);
    }

    res.json({ success: true, voucher });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get Investigation Notes for a target (Voucher / Patient / Doctor / Case)
app.get("/api/notes/:type/:targetId", authenticateJWT as any, async (req, res) => {
  try {
    const { type, targetId } = req.params;
    const repo = AppDataSource.getRepository(InvestigationNoteEntity);
    const notes = await repo.find({
      where: { claimType: type, targetId },
      order: { createdAt: "DESC" }
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Cross-Facility Verification Matcher
app.get("/api/cross-facility-matches", authenticateJWT as any, async (req, res) => {
  try {
    const voucherRepo = AppDataSource.getRepository(VoucherEntity);
    const facilityRepo = AppDataSource.getRepository(FacilityRecordEntity);

    const vouchers = await voucherRepo.find({ order: { date: "DESC" } });
    const records = await facilityRepo.find();

    const matches = vouchers.map(v => matchVoucherToRecords(v, records));
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Dashboard stats summary & indicators (with ML Metrics)
app.get("/api/dashboard-stats", authenticateJWT as any, async (req, res) => {
  try {
    const voucherRepo = AppDataSource.getRepository(VoucherEntity);
    const facilityRepo = AppDataSource.getRepository(FacilityRecordEntity);

    const vouchers = await voucherRepo.find();
    const records = await facilityRepo.find();

    const totalClaims = vouchers.length;
    const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);

    const uniquePatients = new Set(vouchers.map(v => v.patientNameNormalized)).size;
    const uniqueDoctors = new Set(vouchers.map(v => v.doctorNameNormalized)).size;
    const uniqueFacilities = new Set(vouchers.map(v => v.facilityName)).size;

    const flaggedClaims = vouchers.filter(v => v.isFlagged);
    const flaggedClaimsCount = flaggedClaims.length;
    const flaggedAmount = flaggedClaims.reduce((sum, v) => sum + v.amount, 0);

    // ML Anomaly Count
    const mlAnomaliesCount = vouchers.filter(v => v.isMlAnomaly).length;

    // Repeat Patients
    const patientClaimCounts: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.ramaNumberNormalized) {
        patientClaimCounts[v.ramaNumberNormalized] = (patientClaimCounts[v.ramaNumberNormalized] || 0) + 1;
      }
    }
    const repeatPatientCount = Object.values(patientClaimCounts).filter(c => c > 1).length;

    // Rapid Revisits Engine
    const patientsGrouped: Record<string, VoucherEntity[]> = {};
    for (const v of vouchers) {
      if (v.ramaNumberNormalized) {
        if (!patientsGrouped[v.ramaNumberNormalized]) {
          patientsGrouped[v.ramaNumberNormalized] = [];
        }
        patientsGrouped[v.ramaNumberNormalized].push(v);
      }
    }

    let rapidRevisitAlertsCount = 0;
    for (const [rama, claims] of Object.entries(patientsGrouped)) {
      claims.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 0; i < claims.length - 1; i++) {
        const c1 = claims[i];
        const c2 = claims[i + 1];
        const t1 = new Date(c1.date).getTime();
        const t2 = new Date(c2.date).getTime();
        const diffDays = Math.ceil((t2 - t1) / (1000 * 60 * 60 * 24));
        if (diffDays <= 4) {
          rapidRevisitAlertsCount++;
        }
      }
    }

    // Match Rates percentages
    const matches = vouchers.map(v => matchVoucherToRecords(v, records));
    const matchedCount = matches.filter(m => m.category === MatchCategory.MATCHED).length;
    const unlinkedCount = matches.filter(m => m.category === MatchCategory.UNLINKED).length;
    const noRecordCount = matches.filter(m => m.category === MatchCategory.NO_RECORD).length;

    res.json({
      totalClaims,
      totalAmount,
      uniquePatients,
      uniqueDoctors,
      uniqueFacilities,
      flaggedClaimsCount,
      flaggedAmount,
      mlAnomaliesCount,
      repeatPatientCount,
      rapidRevisitAlertsCount,
      matchRates: {
        matched: totalClaims > 0 ? (matchedCount / totalClaims) * 100 : 0,
        unlinked: totalClaims > 0 ? (unlinkedCount / totalClaims) * 100 : 0,
        noRecord: totalClaims > 0 ? (noRecordCount / totalClaims) * 100 : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Doctor and Prescribing Analytics
app.get("/api/doctor-analytics", authenticateJWT as any, async (req, res) => {
  try {
    const voucherRepo = AppDataSource.getRepository(VoucherEntity);
    const vouchers = await voucherRepo.find();

    const doctorsMap: Record<string, {
      name: string;
      claimsCount: number;
      totalCost: number;
      flaggedCount: number;
      mlAnomalousCount: number;
      uniqueDrugs: Set<string>;
      uniquePatients: Set<string>;
    }> = {};

    for (const v of vouchers) {
      const docKey = v.doctorNameNormalized || "unknown";
      const docName = v.doctorName || "Unknown Prescriber";

      if (!doctorsMap[docKey]) {
        doctorsMap[docKey] = {
          name: docName,
          claimsCount: 0,
          totalCost: 0,
          flaggedCount: 0,
          mlAnomalousCount: 0,
          uniqueDrugs: new Set(),
          uniquePatients: new Set()
        };
      }

      const entry = doctorsMap[docKey];
      entry.claimsCount++;
      entry.totalCost += v.amount;
      if (v.isFlagged) entry.flaggedCount++;
      if (v.isMlAnomaly) entry.mlAnomalousCount++;
      entry.uniqueDrugs.add(v.medicineName);
      if (v.ramaNumberNormalized) {
        entry.uniquePatients.add(v.ramaNumberNormalized);
      }
    }

    const result = Object.values(doctorsMap).map(doc => ({
      name: doc.name,
      claimsCount: doc.claimsCount,
      totalCost: doc.totalCost,
      flaggedCount: doc.flaggedCount,
      mlAnomalousCount: doc.mlAnomalousCount,
      flagRate: doc.claimsCount > 0 ? ((doc.flaggedCount + doc.mlAnomalousCount) / doc.claimsCount) * 100 : 0,
      uniqueDrugsCount: doc.uniqueDrugs.size,
      uniquePatientsCount: doc.uniquePatients.size
    })).sort((a, b) => b.claimsCount - a.claimsCount);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Revisit Alerts Detailed List
app.get("/api/rapid-revisits", authenticateJWT as any, async (req, res) => {
  try {
    const voucherRepo = AppDataSource.getRepository(VoucherEntity);
    const vouchers = await voucherRepo.find();

    const patientsGrouped: Record<string, VoucherEntity[]> = {};
    for (const v of vouchers) {
      if (v.ramaNumberNormalized) {
        if (!patientsGrouped[v.ramaNumberNormalized]) {
          patientsGrouped[v.ramaNumberNormalized] = [];
        }
        patientsGrouped[v.ramaNumberNormalized].push(v);
      }
    }

    const alerts: RevisitAlert[] = [];
    for (const [rama, claims] of Object.entries(patientsGrouped)) {
      claims.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 0; i < claims.length - 1; i++) {
        const c1 = claims[i];
        const c2 = claims[i + 1];
        const t1 = new Date(c1.date).getTime();
        const t2 = new Date(c2.date).getTime();
        const diffDays = Math.ceil((t2 - t1) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 4) {
          alerts.push({
            patientName: c1.patientName,
            ramaNumber: c1.ramaNumber,
            visit1Date: c1.date,
            visit2Date: c2.date,
            daysBetween: diffDays,
            doctor1: c1.doctorName,
            doctor2: c2.doctorName,
            medicine1: c1.medicineName,
            medicine2: c2.medicineName,
            facility1: c1.facilityName,
            facility2: c2.facilityName,
            amount1: c1.amount,
            amount2: c2.amount
          });
        }
      }
    }

    res.json(alerts.sort((a, b) => a.daysBetween - b.daysBetween));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Network Graph Builder API
app.get("/api/network-graph", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(VoucherEntity);
    const vouchers = await repo.find();

    const nodesMap: Record<string, { id: string; label: string; type: "patient" | "doctor" | "facility" | "medicine"; val: number; color: string }> = {};
    const linksMap: Record<string, { source: string; target: string; value: number }> = {};

    const COLORS = {
      patient: "#3b82f6",
      doctor: "#10b981",
      facility: "#f59e0b",
      medicine: "#ec4899"
    };

    for (const v of vouchers) {
      const pId = `P-${v.ramaNumberNormalized || v.patientNameNormalized}`;
      const dId = `D-${v.doctorNameNormalized}`;
      const fId = `F-${v.facilityName.toLowerCase()}`;
      const mId = `M-${v.medicineName.toLowerCase()}`;

      if (!nodesMap[pId]) {
        nodesMap[pId] = { id: pId, label: v.patientName, type: "patient", val: 5, color: COLORS.patient };
      } else {
        nodesMap[pId].val += 1.5;
      }

      if (!nodesMap[dId]) {
        nodesMap[dId] = { id: dId, label: v.doctorName, type: "doctor", val: 8, color: COLORS.doctor };
      } else {
        nodesMap[dId].val += 2.0;
      }

      if (!nodesMap[fId]) {
        nodesMap[fId] = { id: fId, label: v.facilityName, type: "facility", val: 10, color: COLORS.facility };
      } else {
        nodesMap[fId].val += 2.5;
      }

      if (!nodesMap[mId]) {
        nodesMap[mId] = { id: mId, label: v.medicineName, type: "medicine", val: 6, color: COLORS.medicine };
      } else {
        nodesMap[mId].val += 1.5;
      }

      const l1 = `${dId}_${pId}`;
      linksMap[l1] = { source: dId, target: pId, value: (linksMap[l1]?.value || 0) + 1 };

      const l2 = `${pId}_${fId}`;
      linksMap[l2] = { source: pId, target: fId, value: (linksMap[l2]?.value || 0) + 1 };

      const l3 = `${pId}_${mId}`;
      linksMap[l3] = { source: pId, target: mId, value: (linksMap[l3]?.value || 0) + 1 };
    }

    res.json({
      nodes: Object.values(nodesMap),
      links: Object.values(linksMap)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. AI Audit investigator powered by Gemini (requires JWT and Investigator/Admin role)
app.post("/api/investigate-ai", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetId, type } = req.body;
    
    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        notes: "### AI Audit Mode Unavailable\n\nPlease configure your `GEMINI_API_KEY` in the secrets manager tab to enable AI audits. Running local heuristics instead."
      });
      return;
    }

    const voucherRepo = AppDataSource.getRepository(VoucherEntity);
    const facilityRepo = AppDataSource.getRepository(FacilityRecordEntity);

    let logs: VoucherEntity[] = [];
    let crossLogs: FacilityRecordEntity[] = [];

    if (type === "patient") {
      const normalizedRama = normalizeRama(targetId);
      logs = await voucherRepo.find({ where: { ramaNumberNormalized: normalizedRama } });
      crossLogs = await facilityRepo.find({ where: { ramaNumberNormalized: normalizedRama } });
    } else if (type === "doctor") {
      const normalizedDoc = String(targetId).toLowerCase();
      logs = await voucherRepo.find({ where: { doctorNameNormalized: normalizedDoc } });
      crossLogs = await facilityRepo.find();
    } else {
      const id = parseInt(targetId, 10);
      const mainVoucher = await voucherRepo.findOneBy({ id });
      if (mainVoucher) {
        logs = [mainVoucher];
        crossLogs = await facilityRepo.find();
      }
    }

    if (logs.length === 0) {
      res.status(404).json({ error: "No claims records found to analyze." });
      return;
    }

    const matches = logs.map(v => matchVoucherToRecords(v, crossLogs));

    const serializedClaims = logs.map((v, idx) => ({
      id: v.id,
      patientName: v.patientName,
      rama: v.ramaNumber,
      date: v.date,
      medicine: v.medicineName,
      quantity: v.quantity,
      amount: `${v.amount} RWF`,
      doctor: v.doctorName,
      facility: v.facilityName,
      isClinicalFlagged: v.isFlagged,
      flagReason: v.flagReason,
      isMlAnomalyDetected: v.isMlAnomaly,
      mlAnomalyRating: `${(v.mlAnomalyScore * 100).toFixed(0)}%`,
      hospitalMatchStatus: matches[idx].category,
      hospitalMatchConfidence: `${Math.round(matches[idx].confidenceScore * 100)}%`,
      hospitalMatchDetails: matches[idx].matchDetails
    }));

    const promptContext = JSON.stringify(serializedClaims, null, 2);

    const systemInstruction = `You are a forensic pharmacy auditor and clinical pharmacologist inspecting suspicious health insurance claims (RAMA/RSSB).
Analyze the claims data provided in the prompt context.
Return a beautiful, professional, markdown-formatted report containing:
1. **Auditor Summary**: High-level clinical and administrative assessment of the patient/doctor claims.
2. **Forensic Risk Rating**: A rating (Low, Medium, High, or Critical) with a percentage risk score, justifying your decision.
3. **Identified Fraud/Error Patterns**: Check specifically for:
   - "Doctor/Pharmacy Shopping" (rapid revisits for the same therapy class)
   - "Ghost Vouchers" (NO_RECORD in hospital encounter verification)
   - "Split Billing" (multiple claims on the same day to bypass single transaction thresholds)
   - "Clinical Anomalies" (overprescribing, dosing spikes, specialist drugs dispensed at primary posts)
4. **Clinical Warnings**: Clinical hazards of the treatments (e.g. therapeutic drug overlaps, side effects, toxicity).
5. **Recommended Auditor Actions**: Step-by-step next steps for the investigator.

Keep your tone objective, professional, and clear. Avoid flowery language or self-praise.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform a full forensic pharmacy audit and report on these claims:\n\n${promptContext}`,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    const reportText = response.text || "Failed to generate AI audit analysis report.";

    // Save report as notes
    const noteRepo = AppDataSource.getRepository(InvestigationNoteEntity);
    const systemNote = new InvestigationNoteEntity();
    systemNote.claimType = type;
    systemNote.targetId = String(targetId);
    systemNote.author = "Gemini AI Forensic";
    systemNote.note = reportText;
    await noteRepo.save(systemNote);

    await logAuditTrail(
      "AI_INVESTIGATION_RUN",
      req.user?.email || "Unknown",
      req.user?.role || "Unknown",
      `Executed AI forensic audit on ${type} with target ID: ${targetId}`
    );

    res.json({ notes: reportText });
  } catch (error: any) {
    console.error("Gemini audit error:", error);
    res.status(500).json({ error: "Failed to run AI forensic investigator: " + error.message });
  }
});

// 16. CASE MANAGEMENT ENDPOINTS

// 16.1. Get All Cases
app.get("/api/cases", authenticateJWT as any, async (req, res) => {
  try {
    const caseRepo = AppDataSource.getRepository(CaseEntity);
    const cases = await caseRepo.find({ order: { createdAt: "DESC" } });
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 16.2. Create Case
app.post("/api/cases", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, targetType, targetId, investigator, findings } = req.body;
    
    if (!title || !targetType || !targetId) {
      res.status(400).json({ error: "Missing required fields (title, targetType, targetId)." });
      return;
    }

    const caseRepo = AppDataSource.getRepository(CaseEntity);
    const newCase = new CaseEntity();
    newCase.title = title;
    newCase.description = description || "";
    newCase.targetType = targetType;
    newCase.targetId = targetId;
    newCase.investigator = investigator || req.user?.email || "Unassigned";
    newCase.findings = findings || "";
    newCase.status = "Open";

    const saved = await caseRepo.save(newCase);

    await logAuditTrail(
      "CASE_CREATED",
      req.user?.email || "Unknown",
      req.user?.role || "Unknown",
      `Created case ID ${saved.id}: "${saved.title}" for ${targetType} ${targetId}.`
    );

    res.json({ success: true, case: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 16.3. Update Case (Status, Investigator, Findings)
app.put("/api/cases/:id", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, investigator, findings, description } = req.body;

    const caseRepo = AppDataSource.getRepository(CaseEntity);
    const kase = await caseRepo.findOneBy({ id });

    if (!kase) {
      res.status(404).json({ error: "Investigation case not found." });
      return;
    }

    const prevStatus = kase.status;
    const prevInvestigator = kase.investigator;

    if (status) kase.status = status;
    if (investigator) kase.investigator = investigator;
    if (findings !== undefined) kase.findings = findings;
    if (description !== undefined) kase.description = description;

    const updated = await caseRepo.save(kase);

    // Audit trailing
    if (status && status !== prevStatus) {
      await logAuditTrail(
        "CASE_STATUS_UPDATED",
        req.user?.email || "Unknown",
        req.user?.role || "Unknown",
        `Updated case ID ${id} status from '${prevStatus}' to '${status}'.`
      );
    }
    if (investigator && investigator !== prevInvestigator) {
      await logAuditTrail(
        "CASE_ASSIGNED",
        req.user?.email || "Unknown",
        req.user?.role || "Unknown",
        `Assigned case ID ${id} to ${investigator}.`
      );
    }

    res.json({ success: true, case: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17. GET MASTER LIST OF PATIENTS (PostgreSQL synchronized table)
app.get("/api/patients", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(PatientEntity);
    const patients = await repo.find({ order: { riskScore: "DESC" } });
    res.json(patients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 18. GET MASTER LIST OF PROVIDERS (PostgreSQL synchronized table)
app.get("/api/providers", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(ProviderEntity);
    const providers = await repo.find({ order: { riskScore: "DESC" } });
    res.json(providers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 19. GET MASTER LIST OF FACILITIES (PostgreSQL synchronized table)
app.get("/api/facilities", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(FacilityEntity);
    const facilities = await repo.find({ order: { totalDispensedValue: "DESC" } });
    res.json(facilities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 20. GET AUDIT TRAIL LOGS (Admin only)
app.get("/api/audit-trails", authenticateJWT as any, requireRole(["Admin"]) as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(AuditTrailEntity);
    const trails = await repo.find({ order: { timestamp: "DESC" } });
    res.json(trails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 21. GET ML ANOMALIES FILTERED LIST
app.get("/api/ml-anomalies", authenticateJWT as any, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(VoucherEntity);
    const anomalies = await repo.find({
      where: { isMlAnomaly: true },
      order: { mlAnomalyScore: "DESC" }
    });
    res.json(anomalies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 22. POST RETRAIN/RECALCULATE ML ANOMALIES
app.post("/api/vouchers/recalculate-ml", authenticateJWT as any, requireRole(["Admin", "Investigator"]) as any, async (req: AuthenticatedRequest, res) => {
  try {
    await runMLAnomalyEngine();
    await syncMasterTables();

    await logAuditTrail(
      "ML_RECALCULATED",
      req.user?.email || "Unknown",
      req.user?.role || "Unknown",
      "Manually triggered retraining of the ML anomaly detector."
    );

    res.json({ success: true, message: "ML anomaly scores successfully retrained and recalculated across active claims database." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------
// VITE DEV SERVER AND PRODUCTION SERVING LAYER
// -------------------------------------------------------------------
async function startServer() {
  // Initialize Database
  await initializeDatabase();
  // Seed initial records if empty
  await seedDatabaseIfEmpty();

  // If in development, start Vite in middleware mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Serve production bundle
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PharmaScan Server running on http://localhost:${PORT}`);
  });
}

startServer();
