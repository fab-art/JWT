/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataSource } from "typeorm";
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
} from "./entities";

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME || "pharmascan";
const sqlUser = process.env.SQL_USER || "postgres";
const sqlPassword = process.env.SQL_PASSWORD;

const isPostgres = !!sqlHost;

export const AppDataSource = new DataSource(
  isPostgres
    ? {
        type: "postgres",
        host: sqlHost,
        port: 5432,
        username: sqlUser,
        password: sqlPassword,
        database: sqlDbName,
        synchronize: true, // Auto-creates and updates database tables
        logging: false,
        entities: [
          VoucherEntity,
          FacilityRecordEntity,
          InvestigationNoteEntity,
          PatientEntity,
          ProviderEntity,
          FacilityEntity,
          CaseEntity,
          AuditTrailEntity,
          UserEntity
        ],
        ssl: false,
      }
    : {
        type: "better-sqlite3",
        database: "pharmascan.db",
        synchronize: true,
        logging: false,
        entities: [
          VoucherEntity,
          FacilityRecordEntity,
          InvestigationNoteEntity,
          PatientEntity,
          ProviderEntity,
          FacilityEntity,
          CaseEntity,
          AuditTrailEntity,
          UserEntity
        ],
      }
);

export async function initializeDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log(
      isPostgres
        ? `PostgreSQL Database connected successfully at ${sqlHost}!`
        : "SQLite Database connected successfully!"
    );
  }
  return AppDataSource;
}
