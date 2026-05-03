# NEXUS - AI-Powered Community Impact Coordination Platform

**NEXUS** is an intelligent, real-time coordination platform that empowers NGOs, coordinators, fieldworkers, and volunteers to respond to community needs with precision and speed. Built with AI-driven insights, geospatial intelligence, and voice-enabled interfaces, NEXUS transforms how organizations manage crisis response, community development, and social impact initiatives.

---

## 🎯 Project Overview

NEXUS bridges the gap between community needs and rapid response by providing:

- **Real-time Need Detection**: AI-powered analysis of community reports to identify emerging crises
- **Intelligent Mission Dispatch**: Automated matching of volunteers/fieldworkers to missions based on skills, location, and availability
- **Geospatial Intelligence**: Heat maps, zone risk assessment, and terrain analysis for strategic planning
- **Voice-Enabled Operations**: Hands-free mission updates and reporting for fieldworkers
- **Community Feedback Loop**: Public reporting mechanism with sentiment analysis and trend detection
- **Trust Fabric**: Cryptographically verified impact ledger tracking real community outcomes
- **Multi-Role Coordination**: Separate interfaces for coordinators, fieldworkers, and volunteers

---

## 🏗️ Architecture Overview

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (component library)
- React Query (data fetching)
- Leaflet + Google Maps (geospatial visualization)
- Recharts (data visualization)
- Framer Motion (animations)

**Backend:**
- FastAPI (Python web framework)
- Firebase Firestore (NoSQL database)
- Google Gemini AI (LLM for insights & planning)
- Google Cloud Speech-to-Text (voice transcription)
- Google Cloud Storage (file storage)
- JWT-based authentication

**Infrastructure:**
- Firebase Authentication
- Google Cloud Platform (GCP)
- Firestore Real-time Database
- Cloud Storage

### Project Structure

```
nexus/
├── frontend/                    # React + TypeScript web application
│   ├── src/
│   │   ├── pages/              # Page components by role
│   │   │   ├── coordinator/    # Coordinator dashboard pages
│   │   │   ├── fieldworker/    # Fieldworker mobile pages
│   │   │   └── volunteer/      # Volunteer portal pages
│   │   ├── components/         # Reusable UI components
│   │   ├── lib/                # API clients and utilities
│   │   ├── hooks/              # Custom React hooks
│   │   └── App.tsx             # Main app component
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # FastAPI Python backend
│   ├── routers/                # API route handlers
│   │   ├── auth.py             # Authentication endpoints
│   │   ├── missions.py         # Mission management
│   │   ├── coordinator.py      # Coordinator dashboard APIs
│   │   ├── fieldworker.py      # Fieldworker APIs
│   │   ├── volunteer.py        # Volunteer APIs
│   │   └── public.py           # Public APIs (community voice)
│   ├── services/               # Business logic
│   │   ├── forecast_pipeline.py    # Need forecasting
│   │   ├── copilot_planner.py      # AI planning engine
│   │   ├── mission_assignment.py   # Auto-assignment logic
│   │   ├── notifications_hub.py    # Notification system
│   │   └── voice_service.py        # Voice processing
│   ├── models/                 # Data models
│   │   ├── user.py             # User/role models
│   │   ├── mission.py          # Mission models
│   │   ├── report.py           # Report models
│   │   ├── zone.py             # Zone/terrain models
│   │   └── drift_alert.py      # Alert models
│   ├── core/                   # Core utilities
│   │   ├── firebase.py         # Firebase initialization
│   │   ├── gemini.py           # Gemini AI client
│   │   ├── security.py         # Auth & encryption
│   │   ├── config.py           # Configuration
│   │   └── dependencies.py     # Dependency injection
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Environment template
│
└── .kiro/                       # Kiro spec documentation
    └── specs/
        └── mobile-responsive-ui/  # Mobile responsiveness specs
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.11+
- **Firebase Project** with Firestore and Authentication enabled
- **Google Cloud Project** with:
  - Gemini API enabled
  - Cloud Speech-to-Text API enabled
  - Cloud Storage enabled
- **Service Account Credentials** (JSON files)

### Backend Setup

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
   GEMINI_API_KEY=your_gemini_api_key
   GCS_BUCKET_NAME=your-gcs-bucket
   GCP_SERVICE_ACCOUNT_PATH=./secrets/gcp-service-account.json
   JWT_SECRET_KEY=your-long-random-secret-key
   ```

4. **Place credentials:**
   ```bash
   mkdir -p secrets
   # Copy your Firebase and GCP service account JSONs to secrets/
   ```

5. **Run backend:**
   ```bash
   python main.py
   ```
   Backend runs on `http://localhost:8001` (port changed from 8000 to avoid conflicts)

### Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment:**
   ```bash
   # Edit .env
   VITE_API_BASE_URL=http://127.0.0.1:8001
   VITE_GMAPS_KEY=your_google_maps_api_key
   ```

4. **Run development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   Frontend runs on `http://localhost:5173`

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## Demo Login Credentials

- Coordinator: kushal@gmail.com / K@1234567
- Fieldworker: kiran@gmail.com / K@1234567
- Volunteer: robin@gmail.com / R@1234567

## 📱 Features by Role

### 👔 Coordinator Dashboard

**Mission Management:**
- Create and dispatch missions to fieldworkers/volunteers
- Real-time mission tracking with live location updates
- Auto-assignment based on skills, location, and availability
- Mission history and completion analytics

**Geospatial Intelligence:**
- Interactive heat maps showing need concentration
- Zone risk assessment and trend analysis
- Terrain visualization with confidence scoring
- Historical data and forecasting

**Volunteer Management:**
- Volunteer directory with skills and availability
- Performance metrics and success rates
- Burnout risk assessment
- Skill-based matching for missions

**AI Insights (Copilot):**
- Voice-enabled query interface
- Automated insight generation from reports
- Trend detection and anomaly alerts
- Recommended actions for crisis response

**Community Echo:**
- Campaign management for community outreach
- SMS/messaging integration
- Feedback collection and sentiment analysis
- Public tracking page for transparency

**Reports & Analytics:**
- Impact reports with verified metrics
- Trust Fabric ledger (cryptographic verification)
- Volunteer performance leaderboards
- Zone-level impact assessment

### 👷 Fieldworker Mobile App

**Mission Execution:**
- Active mission details and navigation
- Real-time status updates
- Voice-based mission reporting
- Photo/document capture for evidence

**Offline Support:**
- Offline mission access
- Queued updates for sync when online
- Offline report submission

**Community Reporting:**
- Scan-based survey forms
- Voice-based incident reporting
- Photo evidence collection
- Real-time need assessment

**Profile & Settings:**
- Availability management
- Skills and language preferences
- Offline zone configuration
- Performance tracking

### 🤝 Volunteer Portal

**Mission Discovery:**
- Available missions in your area
- Skill-based recommendations
- Impact preview before accepting
- Flexible scheduling

**Impact Tracking:**
- Personal mission history
- Verified impact metrics
- Empathy engine (personalized feedback)
- Community recognition

**Profile Management:**
- Skills and availability
- Language preferences
- Performance metrics
- Volunteer certification

### 🌐 Public Community Voice

**Report Submission:**
- Anonymous community reporting
- Multi-language support
- Photo/evidence upload
- Real-time need assessment

**Tracking:**
- Track report status
- View community response
- Feedback collection
- Sentiment tracking

---

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/signin` - User login
- `POST /auth/face-enroll` - Face recognition enrollment
- `POST /auth/face-signin` - Face recognition login

### Coordinator APIs
- `GET /coordinator/dashboard` - Dashboard metrics
- `GET /coordinator/missions` - Mission list
- `GET /coordinator/missions/candidates` - Mission candidate matching
- `POST /coordinator/missions` - Create mission
- `GET /coordinator/volunteers` - Volunteer directory
- `GET /coordinator/zones` - Zone data
- `GET /coordinator/terrain/stream` - Real-time terrain updates
- `GET /coordinator/insights` - AI-generated insights
- `GET /coordinator/community-echo/overview` - Community Echo dashboard
- `POST /coordinator/community-echo/campaigns/schedule` - Schedule campaign

### Fieldworker APIs
- `GET /fieldworker/missions/active` - Active missions
- `POST /fieldworker/missions/{id}/update` - Mission status update
- `POST /fieldworker/reports` - Submit report
- `GET /fieldworker/profile` - User profile

### Volunteer APIs
- `GET /volunteer/missions` - Available missions
- `POST /volunteer/missions/{id}/accept` - Accept mission
- `GET /volunteer/impact` - Impact metrics
- `GET /volunteer/profile` - User profile

### Public APIs
- `POST /public/community-voice/report` - Submit community report
- `GET /public/community-voice/track/{referenceId}` - Track report status
- `POST /public/community-voice/feedback` - Submit feedback

---

## 🗄️ Database Schema

### Collections

**users**
- User profiles with role, skills, availability
- Authentication credentials
- Performance metrics

**missions**
- Mission details, status, assignments
- Resource requirements
- Impact metrics

**reports**
- Community reports and fieldworker submissions
- Need assessment data
- Evidence (photos, voice)

**zones**
- Geographic zones with risk levels
- Need concentration data
- Safety profiles

**volunteers**
- Volunteer profiles and availability
- Skills and certifications
- Performance history

**organizations (NGOs)**
- NGO profiles and settings
- Trust scores and tiers
- Partnership data

**communityEchoCampaigns**
- Campaign metadata and status
- Recipient lists
- Dispatch logs

**notifications**
- User notifications
- Mission assignments
- System alerts

---

## 🔐 Security & Authentication

- **JWT-based Authentication**: Secure token-based access
- **Role-Based Access Control (RBAC)**: Different permissions per role
- **Firebase Security Rules**: Firestore-level access control
- **Password Hashing**: PBKDF2-SHA256 with 600k iterations
- **CORS Protection**: Configured allowed origins
- **Data Encryption**: Sensitive data encrypted at rest

---

## 🌍 Internationalization

- Multi-language support (English, Hindi, regional languages)
- Language-specific voice recognition
- Localized UI components
- Regional need categories

---

## 📊 Key Features Deep Dive

### AI-Powered Copilot
- Natural language query interface
- Voice-enabled commands
- Automated insight generation
- Crisis tone detection
- Tool-based action execution

### Forecast Pipeline
- Weekly need forecasting
- Risk level prediction
- Trend analysis
- Anomaly detection
- Confidence scoring

### Mission Auto-Assignment
- Skill-based matching
- Location proximity calculation
- Availability verification
- Burnout risk assessment
- Load balancing

### Trust Fabric
- Cryptographic verification of impact
- Before/after need score tracking
- Volunteer retention metrics
- Report coverage analysis
- Community feedback integration

### Community Echo
- Campaign management
- SMS/messaging integration
- Recipient targeting
- Feedback collection
- Retention policies

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
```

### Frontend Tests
```bash
cd frontend
npm run test
```

### Build Verification
```bash
cd frontend
npm run build
```

---

## 📝 Environment Variables

### Backend (.env)
```env
# App Configuration
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRES_MINUTES=1440

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
FIREBASE_DATABASE_URL=

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_VERSION=v1beta
GEMINI_FLASH_MODEL=gemini-2.5-flash-lite
GEMINI_PRO_MODEL=gemini-2.5-flash-lite

# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GCP_SERVICE_ACCOUNT_PATH=./secrets/gcp-service-account.json

# Copilot Configuration
COPILOT_PLANNER_ENABLED=true
COPILOT_CACHE_ENABLED=true
COPILOT_CACHE_TTL_SECONDS=45
COPILOT_VOICE_COALESCE_ENABLED=true

# Community Echo
COMMUNITY_ECHO_RETENTION_WEEKS=4
COMMUNITY_ECHO_DISPATCH_BATCH_SIZE=250
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://127.0.0.1:8001
VITE_GMAPS_KEY=your-google-maps-api-key
```

---

## 🚢 Deployment

### Backend Deployment (Production)
```bash
# Build Docker image
docker build -t nexus-backend .

# Run container
docker run -p 8001:8001 \
  -e FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-service-account.json \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -v /path/to/secrets:/secrets \
  nexus-backend
```

### Frontend Deployment (Production)
```bash
# Build static files
npm run build

# Deploy dist/ folder to CDN or static hosting
# Example: Firebase Hosting, Vercel, Netlify
firebase deploy --only hosting
```

---

## 📱 Mobile Responsiveness

NEXUS is fully responsive across:
- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

All pages are optimized for touch interaction with 44x44px minimum touch targets.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit pull request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support & Documentation

- **Backend Documentation**: See `backend/AUTH_TESTING.md` and `backend/COMMUNITY_ECHO_RUNBOOK.md`
- **Copilot Readiness**: See `backend/COPILOT_PRODUCTION_READINESS.md`
- **API Documentation**: Available at `http://localhost:8001/docs` (Swagger UI)

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support expansion
- [ ] Blockchain-based impact verification
- [ ] Integration with external NGO networks
- [ ] Advanced ML-based volunteer matching
- [ ] Real-time collaboration features

---

## 👥 Team

Built with ❤️ for community impact.

---

**Last Updated**: April 2026  
**Version**: 1.0.0
