<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e9eeb2bb-8db2-44f7-b871-045afa0cc625

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Database Persistence

By default, this application uses SQLite via `better-sqlite3`. When deploying to **Vercel**, the SQLite database file (`pharmascan.db`) is **not persistent** across function executions and will be reset on every cold start.

For production deployments, it is strongly recommended to use **PostgreSQL**. You can configure PostgreSQL by setting the following environment variables in your Vercel project:

- `SQL_HOST`: Your PostgreSQL host.
- `SQL_USER`: Your PostgreSQL username.
- `SQL_PASSWORD`: Your PostgreSQL password.
- `SQL_DB_NAME`: Your PostgreSQL database name.
- `JWT_SECRET`: A secret key for signing JWT tokens.
- `GEMINI_API_KEY`: Your Google Gemini API key.
