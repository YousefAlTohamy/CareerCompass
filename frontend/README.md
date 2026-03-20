# CareerCompass Frontend 💻

> **React 19 + Vite + Tailwind CSS + Framer Motion + Recharts** — V3 UI for career skill gap analysis, job matching, and application tracking

## 📋 Overview

The CareerCompass frontend is a modern, responsive React application that provides a **SaaS-level** experience for users to upload CVs, browse jobs, analyze skill gaps, and receive personalized career recommendations. The V3 implementation delivers rich, data-driven UI components with robust error handling.

---

## ✨ V3 UI Features

### SaaS-Level Dashboard

| Feature | Implementation |
| ------- | -------------- |
| **Profile Completeness Circular Ring** | SVG-based progress ring (0–100%) — emerald ≥75%, amber ≥50%, slate below |
| **Top Skills Badges** | Sorted by `confidence_score` (descending); top 3–5 displayed in AI Insights Snapshot |
| **AI Insights Snapshot** | Headline, seniority, experience years, and top skills by confidence |
| **Market Readiness Score** | Pie/radar visualization; readiness percentage |
| **5s Discovery Animation** | `ProcessingAnimation` overlay when `is_new_role` triggers market discovery |

### Enhanced Profile Page

| Feature | Implementation |
| ------- | -------------- |
| **Experience Timeline** | Chronological work history (sorted by `end_date`), company, title, date ranges, description |
| **Skill Confidence Progress Bars** | Color-coded bars based on `confidence_score` (emerald ≥0.8, amber ≥0.6, orange ≥0.4) |
| **Evidence Tooltips** | Hover tooltips showing `evidence` (where the skill was found); safe optional chaining |
| **Rich Profile Pills** | Total experience years, seniority, primary domain |

### Gap Analysis — General CV Health

| Feature | Implementation |
| ------- | -------------- |
| **Strengths** | Green-themed list from `cv_analysis.strengths` |
| **Gaps** | Amber-themed list from `cv_analysis.gaps` (missing sections/info) |
| **Red Flags** | Rose-themed list from `cv_analysis.red_flags` (anomalies) |
| **Completeness Ring** | CV completeness score from `cv_analysis.completeness_score` |
| **Premium Match Gauge** | Radial bar for job match percentage |

### Robust Error Handling

| Feature | Implementation |
| ------- | -------------- |
| **Error Boundary** | Catches React render errors and unhandled promise rejections; displays fallback UI with refresh button |
| **Safe Optional Chaining** | `?.` and null checks throughout; `getSkillName()`, `getSkillScore()`, `getRecText()` helpers prevent "White Screen of Death" |
| **401 Interceptor** | Axios interceptor purges token and redirects to login on 401 |

---

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── api/           # client.js, endpoints.js, scrapingSources.js
│   ├── components/    # Navbar, ErrorBoundary, ProcessingAnimation, etc.
│   ├── context/       # AuthContext
│   ├── hooks/         # useAsync, useAuthHandler, useOnDemandScraping, useScrapingStatus
│   ├── pages/
│   │   ├── admin/     # AdminSources, AdminDashboard, AdminJobs, AdminUsers
│   │   └── user/      # Dashboard, Profile, GapAnalysis, Jobs, Applications, MarketIntelligence
│   ├── services/      # storageService.js
│   ├── App.jsx, main.jsx, index.css
│   └── ...
├── package.json
├── vite.config.js
├── tailwind.config.js
└── ...
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Backend API on `http://127.0.0.1:8000`
- AI Gateway on `http://127.0.0.1:8001`
- AI CV Analyzer on `http://127.0.0.1:8002` (for full gap analysis)

### Installation

```bash
cd frontend
npm install
```

### Run Development Server

```bash
npm run dev
```

App: http://localhost:5173

---

## 🗺️ Routes & Pages

| Route | Page | Description |
| ----- | ---- | ----------- |
| `/` | Home | Landing page |
| `/login`, `/register` | Auth | Login / registration |
| `/user/dashboard` | Dashboard | Profile completeness, top skills, AI insights |
| `/user/profile` | Profile | Experience timeline, skill confidence bars, evidence tooltips |
| `/user/jobs` | Jobs | Job listings, match scores, recommended jobs |
| `/user/gap-analysis/:jobId` | GapAnalysis | Job-specific gap analysis, strengths, gaps, red flags |
| `/user/market` | MarketIntelligence | Recharts trends, trending skills |
| `/user/applications` | Applications | Job application tracker (Kanban) |
| `/admin/*` | Admin | Scraping sources, jobs, users (RBAC) |

---

## 🧩 Key Components

| Component | Purpose |
| --------- | ------- |
| **ErrorBoundary** | Catches errors; prevents full-page crash; shows refresh option |
| **ProcessingAnimation** | Animated CV-processing overlay; 5s discovery message |
| **ProtectedRoute** | Auth guard; optional `requireAdmin` for admin routes |
| **Navbar** | Scroll-aware glassmorphism; avatar dropdown; admin icon |

---

## 📡 API Integration

- **client.js** — Axios base URL, token injection, 401 logout
- **endpoints.js** — `authAPI`, `jobsAPI`, `cvAPI`, `gapAnalysisAPI`, etc.

---

## 📦 Technology Stack

| Technology | Purpose |
| ---------- | ------- |
| React 19 | UI library |
| Vite 7 | Build tool |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations |
| Recharts | Charts (Pie, Radar, RadialBar) |
| Axios | HTTP client |
| Lucide React | Icons |

---

**Last Updated**: March 2026  
**Version**: 1.3.0  
**Status**: ✅ V3 UI — Dashboard, Profile, Gap Analysis, Error Boundary
