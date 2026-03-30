from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials, db as realtime_db, firestore

from core.config import settings


if not firebase_admin._apps:
    firebase_credential = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    firebase_options: dict[str, str] = {}
    if settings.FIREBASE_DATABASE_URL:
        firebase_options["databaseURL"] = settings.FIREBASE_DATABASE_URL

    firebase_admin.initialize_app(firebase_credential, firebase_options)


firebase_app = firebase_admin.get_app()
db = firestore.client(app=firebase_app)
rtdb = realtime_db.reference("/", app=firebase_app)
