# AI Study Hub

An AI-powered learning platform where users can register/login and use various AI tools for studying.

## Architecture

- **Backend**: Node.js + Express (serves both API and frontend static files) on port 5000
- **Frontend**: Vanilla JS/HTML/CSS static files served by the backend
- **Database**: SQLite (file: `backend/database/studyhub.db`)
- **AI**: Google Gemini API (primary), Groq (fallback)

## Project Structure

```
backend/
  server.js          - Express server, serves API + static frontend
  config/db.js       - SQLite connection and schema initialization
  controllers/
    authController.js  - POST /api/auth/register, POST /api/auth/login
    userController.js  - Profile, XP, notes, leaderboard, account
    aiController.js    - POST /api/ai/generate, GET /api/ai/image
  middleware/auth.js   - JWT verification middleware
  database/
    studyhub.db        - SQLite database file
    schema.sql         - Reference schema (MySQL style, not used at runtime)

frontend/
  index.html        - Single-page app markup
  app.js            - Main client logic and UI
  api.js            - REST client (uses relative /api paths)
  data.js           - AI tool catalog and configs
  styles.css        - Styling
```

## Key Configuration

- Backend runs on port 5000, binding to 0.0.0.0
- Frontend API calls use relative `/api` paths (no hardcoded localhost)
- JWT secret: set in `backend/.env` as `JWT_SECRET`
- Gemini API key: set in `backend/.env` as `GEMINI_API_KEY`
- Groq API key: set in `backend/.env` as `GROQ_API_KEY`

## Running

The workflow `Start application` runs: `cd backend && node server.js`

## User Features

- Register/Login with JWT auth
- AI tools: chat tutor, writing help, math, summarizers, creative tools
- Notes management
- XP/leveling system
- Global leaderboard
- User profiles with avatar and bio
