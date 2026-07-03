/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ClaimStatus } from "../types";

@Entity("vouchers")
export class VoucherEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  patientName!: string;

  @Column()
  patientNameNormalized!: string;

  @Column()
  ramaNumber!: string;

  @Column()
  ramaNumberNormalized!: string;

  @Column()
  date!: string; // Format: YYYY-MM-DD

  @Column()
  medicineName!: string;

  @Column({ type: "integer", default: 1 })
  quantity!: number;

  @Column({ type: "float", default: 0.0 })
  amount!: number;

  @Column()
  doctorName!: string;

  @Column()
  doctorNameNormalized!: string;

  @Column()
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

  @Column()
  patientName!: string;

  @Column()
  patientNameNormalized!: string;

  @Column()
  ramaNumber!: string;

  @Column()
  ramaNumberNormalized!: string;

  @Column()
  date!: string; // Format: YYYY-MM-DD

  @Column()
  service!: string;

  @Column({ type: "float", default: 0.0 })
  amount!: number;

  @Column()
  facilityName!: string;
}

@Entity("investigation_notes")
export class InvestigationNoteEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  claimType!: string; // "voucher" | "patient" | "doctor" | "case"

  @Column()
  targetId!: string; // ID of the patient (RAMA), doctor name, voucher ID, or case ID

  @Column()
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

  @Column()
  name!: string;

  @Column()
  ramaNumber!: string;

  @Column({ unique: true })
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

  @Column()
  name!: string;

  @Column({ unique: true })
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

  @Column({ unique: true })
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

  @Column()
  title!: string;

  @Column({ type: "text", default: "" })
  description!: string;

  @Column({ type: "varchar", default: "Open" })
  status!: string; // "Open" | "Pending Review" | "Closed"

  @Column({ type: "varchar", default: "Unassigned" })
  investigator!: string; // Assigned investigator name/email

  @Column()
  targetType!: string; // "patient" | "doctor" | "facility" | "claim"

  @Column()
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

  @Column()
  action!: string; // "CASE_CREATED", "CASE_STATUS_UPDATED", "USER_LOGIN", "CLAIM_AUDITED", etc.

  @Column()
  userEmail!: string;

  @Column()
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

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // Standard hash or text for simpler authentication

  @Column({ type: "varchar", default: "Read-Only" })
  role!: string; // "Admin" | "Investigator" | "Read-Only"
}
