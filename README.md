# 🌟 Nexus Harmony

Nexus Harmony is a robust, full-stack application designed to orchestrate NGO operations. It brings together NGO Coordinators, Volunteers, and Field Workers onto a single, unified platform to collaborate seamlessly, track real-time impact, and navigate critical missions.

## 🏗 Architecture & Tech Stack

The project is structured into a separated frontend and backend:

- **Frontend** (`/frontend`): React.js built with Vite, TypeScript, Tailwind CSS, customized UI components (Shadcn/Radix UI), and Framer Motion for fluid layout animations.
- **Backend** (`/backend`): High-performance Python backend powered by FastAPI and Uvicorn.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python** (v3.8+ recommended)

### 1. Setting up the Backend (FastAPI)

The backend provides the necessary data and API layer for the application.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Mac/Linux
   python3 -m venv venv
   source venv/bin/activate
   
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
*The backend will run on `http://localhost:8000`. You can view the interactive Swagger API documentation at `http://localhost:8000/docs`.*

### 2. Setting up the Frontend (React / Vite)

The frontend contains three completely distinct role-based portals: The Coordinator Dashboard, the Volunteer Portal, and the Field Worker mobile-first interfaces.

1. Open a **new terminal tab/window**.
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Install dependencies using npm (or bun/yarn):
   ```bash
   npm install
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
*The frontend will be available at `http://localhost:8080` or `http://localhost:5173` (depending on the port specified by Vite in the terminal).*

---

## 📂 Project Structure Overview

### Frontend directory (`/frontend/`)
- `src/pages/coordinator/`: Dashboards, terrain maps, analytics, and administrative workflows for NGO leaders.
- `src/pages/volunteer/`: Missions, Empathy Engine, and impact reports for distributed volunteers.
- `src/pages/fieldworker/`: Deep survey tools, voice reporting, and offline-capable views for on-the-ground operators.
- `src/components/nexus/`: Shared UI application components (like globally managed Sidebars and Topbars).

### Backend directory (`/backend/`)
- `main.py`: The application starting point defining backend FastAPI structure, handling middleware, CORS, and root endpoints.
- `requirements.txt`: Python package dependency configurations.

---

## 💡 Development Guidelines
- Always ensure the Python virtual environment is **active** when installing any new backend packages (`pip install <package>`).
- Frontend routes are strictly defined in `frontend/src/App.tsx`.
- All environment configurations (like referencing the local `8000` port) should ideally be handled through a `.env` configuration file in the future to keep API linking dynamic.
