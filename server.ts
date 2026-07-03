/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "reflect-metadata";
import path from "path";
import { initializeDatabase } from "./src/db/data-source.js";
import app, { seedDatabaseIfEmpty } from "./src/app.js";
import { createServer as createViteServer } from "vite";

const PORT = 3000;

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
    app.use(path.join(process.cwd(), "dist"), (req, res, next) => {
      // Dummy middleware to simulate static serving if needed,
      // but express.static is better.
      next();
    });
    const express = await import("express");
    app.use(express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PharmaScan Server running on http://localhost:${PORT}`);
  });
}

startServer();
