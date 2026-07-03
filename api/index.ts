import app, { seedDatabaseIfEmpty } from "../src/app";
import { initializeDatabase } from "../src/db/data-source";

export default async (req: any, res: any) => {
  await initializeDatabase();
  await seedDatabaseIfEmpty();
  return app(req, res);
};
