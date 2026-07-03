/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ClaimStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  INVESTIGATING = "INVESTIGATING",
  REJECTED = "REJECTED"
}

export interface Voucher {
  id: number;
  patientName: string;
  patientNameNormalized: string;
  ramaNumber: string;
  ramaNumberNormalized: string;
  date: string; // ISO date string YYYY-MM-DD
  medicineName: string;
  quantity: number;
  amount: number;
  doctorName: string;
  doctorNameNormalized: string;
  facilityName: string;
  isFlagged: boolean;
  flagReason: string;
  status: ClaimStatus;
  isMlAnomaly?: boolean;
  mlAnomalyScore?: number;
  mlAnomalyReason?: string;
}

export interface FacilityRecord {
  id: number;
  patientName: string;
  patientNameNormalized: string;
  ramaNumber: string;
  ramaNumberNormalized: string;
  date: string; // ISO date string YYYY-MM-DD
  service: string;
  amount: number;
  facilityName: string;
}

export enum MatchCategory {
  MATCHED = "MATCHED",
  UNLINKED = "UNLINKED",
  NO_RECORD = "NO_RECORD"
}

export interface MatchResult {
  voucherId: number;
  patientName: string;
  ramaNumber: string;
  voucherDate: string;
  voucherFacility: string;
  medicineName: string;
  amount: number;
  category: MatchCategory;
  confidenceScore: number; // 0 to 1
  matchedRecordId?: number;
  matchedRecordDate?: string;
  matchedRecordFacility?: string;
  matchDetails?: string;
}

export interface RevisitAlert {
  patientName: string;
  ramaNumber: string;
  visit1Date: string;
  visit2Date: string;
  daysBetween: number;
  doctor1: string;
  doctor2: string;
  medicine1: string;
  medicine2: string;
  facility1: string;
  facility2: string;
  amount1: number;
  amount2: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: "patient" | "doctor" | "facility" | "medicine";
  val: number; // size scaling
  color: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  value: number; // weight
  label?: string;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  links: NetworkEdge[];
}

export interface DashboardStats {
  totalClaims: number;
  totalAmount: number;
  uniquePatients: number;
  uniqueDoctors: number;
  uniqueFacilities: number;
  flaggedClaimsCount: number;
  flaggedAmount: number;
  mlAnomaliesCount: number;
  repeatPatientCount: number;
  rapidRevisitAlertsCount: number;
  matchRates: {
    matched: number;
    unlinked: number;
    noRecord: number;
  };
}

export interface InvestigationNote {
  id: number;
  claimType: string; // "voucher" | "patient" | "doctor"
  targetId: string; // ID of the patient, doctor, or voucher ID
  author: string;
  note: string;
  createdAt: string;
}
