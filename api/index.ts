import app, { seedDatabaseIfEmpty } from "../src/app.js";
import { initializeDatabase } from "../src/db/data-source.js";

let isInitialized = false;

export default async (req: any, res: any) => {
  if (!isInitialized) {
    await initializeDatabase();
    await seedDatabaseIfEmpty();
    isInitialized = true;
  }
  return app(req, res);
};
