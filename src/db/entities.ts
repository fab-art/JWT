/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ClaimStatus } from "../types.js";

@Entity("vouchers")
export class VoucherEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  patientName!: string;

  @Column({ type: "varchar" })
  patientNameNormalized!: string;

  @Column({ type: "varchar" })
  ramaNumber!: string;

  @Column({ type: "varchar" })
  ramaNumberNormalized!: string;

  @Column({ type: "varchar" })
  date!: string; // Format: YYYY-MM-DD

  @Column({ type: "varchar" })
  medicineName!: string;

  @Column({ type: "integer", default: 1 })
  quantity!: number;

  @Column({ type: "float", default: 0.0 })
  amount!: number;

  @Column({ type: "varchar" })
  doctorName!: string;

  @Column({ type: "varchar" })
  doctorNameNormalized!: string;

  @Column({ type: "varchar" })
  facilityName!: string;

  @Column({ type: "boolean", default: false })
  isFlagged!: boolean;

  @Column({ type: "text", default: "" })
  flagReason!: string;

  @Column({
    type: "varchar",
    default: "PENDING"
  })
  status!: string;

  // ML-driven anomaly score and insights
  @Column({ type: "float", default: 0.0 })
  mlAnomalyScore!: number;

  @Column({ type: "text", default: "" })
  mlAnomalyReason!: string;

  @Column({ type: "boolean", default: false })
  isMlAnomaly!: boolean;
}

@Entity("facility_records")
export class FacilityRecordEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  patientName!: string;

  @Column({ type: "varchar" })
  patientNameNormalized!: string;

  @Column({ type: "varchar" })
  ramaNumber!: string;

  @Column({ type: "varchar" })
  ramaNumberNormalized!: string;

  @Column({ type: "varchar" })
  date!: string; // Format: YYYY-MM-DD

  @Column({ type: "varchar" })
  service!: string;

  @Column({ type: "float", default: 0.0 })
  amount!: number;

  @Column({ type: "varchar" })
  facilityName!: string;
}

@Entity("investigation_notes")
export class InvestigationNoteEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  claimType!: string; // "voucher" | "patient" | "doctor" | "case"

  @Column({ type: "varchar" })
  targetId!: string; // ID of the patient (RAMA), doctor name, voucher ID, or case ID

  @Column({ type: "varchar" })
  author!: string; // "Auditor", "Gemini AI", or user email

  @Column({ type: "text" })
  note!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

// Dedicated Patients Entity
@Entity("patients")
export class PatientEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar" })
  ramaNumber!: string;

  @Column({ type: "varchar", unique: true })
  ramaNumberNormalized!: string;

  @Column({ type: "float", default: 0.0 })
  riskScore!: number;

  @Column({ type: "varchar", default: "LOW" })
  riskLevel!: string; // "LOW", "MEDIUM", "HIGH", "CRITICAL"

  @Column({ type: "integer", default: 0 })
  totalClaims!: number;

  @Column({ type: "float", default: 0.0 })
  totalSpend!: number;
}

// Dedicated Providers (Doctors) Entity
@Entity("providers")
export class ProviderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", unique: true })
  nameNormalized!: string;

  @Column({ type: "varchar", default: "General Medicine" })
  specialty!: string;

  @Column({ type: "integer", default: 0 })
  totalPrescriptions!: number;

  @Column({ type: "integer", default: 0 })
  flaggedPrescriptionsCount!: number;

  @Column({ type: "float", default: 0.0 })
  riskScore!: number;
}

// Dedicated Facilities (Pharmacies / Dispensaries / Hospitals) Entity
@Entity("facilities")
export class FacilityEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  name!: string;

  @Column({ type: "varchar", default: "Kigali" })
  location!: string;

  @Column({ type: "integer", default: 0 })
  totalClaimsCount!: number;

  @Column({ type: "float", default: 0.0 })
  totalDispensedValue!: number;
}

// Dedicated Case Entity (Case Management Module)
@Entity("cases")
export class CaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", default: "" })
  description!: string;

  @Column({ type: "varchar", default: "Open" })
  status!: string; // "Open" | "Pending Review" | "Closed"

  @Column({ type: "varchar", default: "Unassigned" })
  investigator!: string; // Assigned investigator name/email

  @Column({ type: "varchar" })
  targetType!: string; // "patient" | "doctor" | "facility" | "claim"

  @Column({ type: "varchar" })
  targetId!: string; // RAMA number, doctor name, facility name, or claim ID

  @Column({ type: "text", default: "" })
  findings!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// Dedicated Audit Trail Entity for RBAC and Compliance Tracking
@Entity("audit_trails")
export class AuditTrailEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  action!: string; // "CASE_CREATED", "CASE_STATUS_UPDATED", "USER_LOGIN", "CLAIM_AUDITED", etc.

  @Column({ type: "varchar" })
  userEmail!: string;

  @Column({ type: "varchar" })
  userRole!: string;

  @Column({ type: "text", default: "" })
  details!: string;

  @CreateDateColumn()
  timestamp!: Date;
}

// Pre-seeded Users Entity for RBAC Roles
@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar" })
  password!: string; // Standard hash or text for simpler authentication

  @Column({ type: "varchar", default: "Read-Only" })
  role!: string; // "Admin" | "Investigator" | "Read-Only"
}
