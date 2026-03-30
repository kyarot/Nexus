# NEXUS Backend Auth Testing Guide

This guide validates the backend setup completed so far:
- Environment loading
- Firebase Admin auth verification
- Firestore user/ngo reads and writes
- Gemini preseed endpoint

## 1. Prerequisites

- Python 3.11+
- Firebase project with Auth + Firestore enabled
- GCP service account JSON for Storage (optional for auth routes, but used by backend init)
- Gemini API key

## 2. Place Credentials

Inside `backend/secrets/` place:

- `firebase-service-account.json`
- `gcp-service-account.json`

## 3. Configure Environment

Edit `backend/.env`:

```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
FIREBASE_DATABASE_URL=
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GCS_BUCKET_NAME=YOUR_BUCKET_NAME
GCP_SERVICE_ACCOUNT_PATH=./secrets/gcp-service-account.json
```

Notes:
- `FIREBASE_DATABASE_URL` is optional unless you use Realtime Database.
- `GCS_BUCKET_NAME` must be valid because storage client initializes on startup.
