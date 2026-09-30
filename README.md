# Placify - Personalized AI Learning Platform

Placify is an AI-driven personalized learning platform orchestrated by a Supervisor Agent and specialized sub-agents, featuring automated diagnostic assessment, dynamic knowledge graph engines, level-tailored resource curation, and adaptive roadmap planning.

---

## 📁 Project Folder Structure

```text
AgPlacify/
│
├── frontend/
│   ├── public/
│   │   └── index.html               # Main UI Entry Point
│   ├── src/
│   │   ├── js/
│   │   │   ├── data.js              # Domain Taxonomies & Templates
│   │   │   ├── agents.js            # Sub-Agents Orchestrator
│   │   │   └── app.js               # Event Listeners & Views Controller
│   │   └── styles.css               # Core Stylesheet & Animations
│   ├── server.js                    # Frontend Development Server
│   └── package.json                 # Frontend Dependencies & Scripts
│
├── backend/
│   ├── src/
│   │   └── server.js                # Main HTTP API Server & MongoDB Connector
│   ├── engine/
│   │   ├── knowledgeGraph.js        # Domain Knowledge Graph & Skill Taxonomy
│   │   ├── skillProfiler.js         # Skill Profiler & Mastery Engine
│   │   ├── roadmapPlanner.js        # Dynamic Roadmap Generation Engine
│   │   └── adaptiveEngine.js        # Adaptive Roadmap Recalculation Engine
│   ├── services/
│   │   ├── resource_fetch.py        # Python Grounded Assessment & Content Fetcher
│   │   └── resource_suggest.py      # Python Resource Suggester
│   ├── config/
│   │   └── create_db.js             # MongoDB Database & Collection Initializer
│   ├── routes/                      # Modular Routes Placeholder (.gitkeep)
│   ├── controllers/                 # Modular Controllers Placeholder (.gitkeep)
│   ├── models/                      # Modular Models Placeholder (.gitkeep)
│   ├── .env                         # Backend Environment Variables
│   └── package.json                 # Backend Dependencies & Scripts
│
├── scratch/                         # Verification Suites & Diagnostic Tests
├── package.json                     # Root Workspace Package Configuration
└── README.md                        # Documentation
```

---

## 🚀 Getting Started

### 1. Backend Setup & Launch

Navigate to the `backend/` directory:

```bash
cd backend
npm install
npm run dev
```

* **API Server Port**: `http://localhost:5000`
* **Health Check**: `http://localhost:5000/api/health`

#### Database Initialization (Optional)
To initialize or seed MongoDB Atlas collections manually:

```bash
node config/create_db.js
```

---

### 2. Frontend Setup & Launch

Navigate to the `frontend/` directory in a new terminal session:

```bash
cd frontend
npm install
npm run dev
```

* **Frontend Web App Port**: `http://localhost:3000`

---

## 🔑 Environment Variables

The backend requires the following variables defined in `backend/.env`:

* `MONGODB_URI`: MongoDB Atlas connection string.
* `PORT`: Server port (defaults to `5000`).
* `GROQ_API_KEY`: API key for Groq LLM services.
