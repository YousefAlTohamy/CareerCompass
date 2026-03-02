# CareerCompass Frontend 💻

> **React 19 + Vite + Recharts + Framer Motion** - Modern UI for career skill gap analysis, job matching, and application tracking

## 📋 Overview

The CareerCompass frontend is a modern, responsive React application built with Vite, Tailwind CSS, and React Router. It provides an intuitive interface for users to upload CVs, browse jobs, analyze skill gaps, and receive personalized career recommendations.

---

## ✨ Features

- **Modern UI/UX** - Clean, responsive design with Tailwind CSS and Framer Motion
- **JWT Authentication** - Secure login/register with token-based auth
- **CV Upload** - Drag-and-drop PDF upload with instant skill extraction
- **Job Browsing & Recommendations** - Discover jobs with an AI-powered personalized suggestions carousel
- **Gap Analysis** - Visual skill gap analysis with priority roadmaps and match percentages
- **Market Intelligence** - View job market trends, top skills, and demand charts powered by Recharts
- **Application Tracker** - Kanban-style lifecycle visualization tracking applied jobs
- **Profile Management** - View and manage skills, update profile
- **Admin Dashboard** - Manage dynamic scraping sources and target job roles
- **Strict Role-Based Routing** - Safe segregation between `/user/*` features and `/admin/*` portals
- **Error Handling** - Comprehensive error boundaries and user feedback
- **Responsive Design** - Mobile-first, works on all screen sizes
- **Fast Development** - Hot Module Replacement (HMR) with Vite

---

## 🏗️ Project Structure

```
frontend/
├── public/                          # Static assets
│   └── vite.svg                     # Vite logo
├── src/
│   ├── api/                         # API integration layer
│   │   ├── client.js                # Axios instance configuration
│   │   ├── scrapingSources.js       # Admin API helpers for sources/roles
│   │   └── endpoints.js             # API endpoint definitions
│   ├── assets/                      # Images, fonts, etc.
│   │   └── react.svg                # Default SVG asset
│   ├── components/                  # Reusable UI components
│   │   ├── Button.jsx               # Custom button component
│   │   ├── Card.jsx                 # Card container
│   │   ├── ErrorAlert.jsx           # Error message display
│   │   ├── ErrorBoundary.jsx        # React error boundary
│   │   ├── LoadingSpinner.jsx       # Loading indicator
│   │   ├── Navbar.jsx               # Scroll-aware glassmorphism nav (Framer Motion)
│   │   ├── ProcessingAnimation.jsx  # Animated CV-processing overlay
│   │   ├── ProtectedRoute.jsx       # Auth route wrapper
│   │   └── SuccessAlert.jsx         # Success message display
│   ├── context/
│   │   └── AuthContext.jsx          # Global auth state
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAsync.js              # Generic async state handler
│   │   ├── useAuthHandler.js        # Auth token management
│   │   ├── useOnDemandScraping.js   # Trigger on-demand scraping hook
│   │   └── useScrapingStatus.js     # Poll scraping job status hook
│   ├── pages/                       # Page components (routes)
│   │   ├── Home.jsx                 # Landing page
│   │   ├── Login.jsx                # Login page
│   │   ├── Register.jsx             # Registration page
│   │   ├── NotFound.jsx             # 404 error page
│   │   ├── admin/
│   │   │   └── AdminSources.jsx     # Admin - Scraping sources & roles management
│   │   └── user/
│   │       ├── Applications.jsx     # Job Application Tracker
│   │       ├── Dashboard.jsx        # User dashboard
│   │       ├── GapAnalysis.jsx      # Skill gap analysis
│   │       ├── Jobs.jsx             # Job listings & Recommended jobs
│   │       ├── MarketIntelligence.jsx # Market trends & interactive stats
│   │       └── Profile.jsx          # User profile & skills
│   ├── services/
│   │   └── storageService.js        # LocalStorage wrapper
│   ├── App.jsx                      # Main app component
│   ├── App.css                      # App-specific styles
│   ├── index.css                    # Global styles + Tailwind
│   └── main.jsx                     # App entry point
├── .gitignore                       # Git ignore rules
├── eslint.config.js                 # ESLint configuration
├── index.html                       # HTML template
├── package.json                     # NPM dependencies & scripts
├── postcss.config.js                # PostCSS configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── vite.config.js                   # Vite configuration
├── FRONTEND_DOCUMENTATION.md        # Detailed documentation
└── DEVELOPER_GUIDE.md               # Development guide
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ - [Download](https://nodejs.org/)
- **npm** 9+ (comes with Node.js)
- **Backend API** - Must be running on `http://127.0.0.1:8000`
- **AI Engine** - Must be running on `http://127.0.0.1:8001`

### Installation

#### 1️⃣ Navigate to Frontend Directory

```bash
cd frontend
```

#### 2️⃣ Install Dependencies

```bash
npm install
```

This installs all dependencies from `package.json`:

**Production Dependencies:**

- `react` ^19.2.0 - UI library
- `react-dom` ^19.2.0 - React DOM renderer
- `react-router-dom` ^7.13.0 - Client-side routing
- `axios` ^1.13.5 - HTTP client
- `lucide-react` ^0.563.0 - Icon library

**Development Dependencies:**

- `vite` ^7.3.1 - Build tool & dev server
- `tailwindcss` ^3.4.1 - CSS framework
- `eslint` - Code linting
- `@vitejs/plugin-react` - Vite React plugin

#### 3️⃣ Configuration (Optional)

The frontend is pre-configured to connect to the backend at `http://127.0.0.1:8000/api`.

**If your backend is on a different URL**, edit `src/api/client.js`:

```javascript
const API_BASE_URL = "http://YOUR_BACKEND_URL/api"; // Change this
```

---

## ▶️ Running the Application

### Start Development Server

```bash
npm run dev
```

**Output:**

```
  VITE v7.3.1  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Access the app**: http://localhost:5173

The dev server features:

- ⚡ Lightning-fast Hot Module Replacement (HMR)
- 🔄 Auto-reload on file changes
- 🚀 Optimized development build

---

## 🗺️ Routes & Pages

### Public Routes (No Authentication Required)

| Route       | Page     | Description                         |
| ----------- | -------- | ----------------------------------- |
| `/`         | Home     | Landing page with features overview |
| `/login`    | Login    | User login form                     |
| `/register` | Register | New user registration               |

### Protected Routes (Authentication Required)

| Route                       | Page               | Description                         |
| --------------------------- | ------------------ | ----------------------------------- |
| Route                       | Page               | Description                         |
| ----------------------      | ------------------ | ----------------------------------- |
| `/user/dashboard`           | Dashboard          | User dashboard with quick actions   |
| `/user/jobs`                | Jobs               | Browse and search job listings      |
| `/user/applications`        | Applications       | Job application pipeline tracker    |
| `/user/gap-analysis/:jobId` | GapAnalysis        | Analyze skill gap for specific job  |
| `/user/market`              | MarketIntelligence | View interactive market trends      |
| `/user/profile`             | Profile            | User profile and skill management   |
| `/admin/sources`            | AdminSources       | Manage scraping sources & job roles |

### Error Routes

| Route | Page     | Description    |
| ----- | -------- | -------------- |
| `*`   | NotFound | 404 error page |

---

## 🧩 Key Components

### Layout Components

#### `Navbar.jsx`

- Scroll-aware glassmorphism navigation (powered by Framer Motion)
- Shows different links for authenticated/unauthenticated users
- Mobile menu with Framer Motion drawer
- User avatar navigates to `/user/profile` with a hover dropdown (Profile + Logout)
- Distinct `Settings` icon visibility strictly for Administrator roles

#### `ProtectedRoute.jsx`

- Wraps protected pages
- Redirects to `/login` if user not authenticated
- Uses `AuthContext` to check authentication state

#### `ErrorBoundary.jsx`

- Catches React errors in child components
- Displays user-friendly error message
- Prevents entire app crash

### UI Components

#### `Button.jsx`

Custom button with variants:

- `primary` - Main actions (blue)
- `secondary` - Secondary actions (white/gray)
- `danger` - Destructive actions (red)
- Supports loading state and disabled state

#### `Card.jsx`

Container component for consistent styling across the app.

#### `LoadingSpinner.jsx`

Loading indicator used during async operations.

User feedback components for displaying messages.

#### `ProcessingAnimation.jsx`

Animated full-screen or boxed overlay utilizing CSS transitions to map the steps of CV uploading, text extraction, and skill AI parsing visually to the user.

---

## 🎣 Custom Hooks

| Hook                  | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `useAuthHandler`      | Manages login tokens locally and configures axios headers implicitly                    |
| `useAsync`            | A robust generic wrapper capturing state limits like (loading / data / error) safely    |
| `useOnDemandScraping` | Encapsulates trigger and API response states for demanding live jobs specifically       |
| `useScrapingStatus`   | Configures polling mechanisms that check backend every 3s continuously until completion |
| `useAuth`             | Wrapper accessing the `AuthContext` to evaluate user presence seamlessly                |

---

## 🔐 Authentication Flow

### How It Works

1. **User registers/logs in** → Backend returns JWT token
2. **Token stored** in `localStorage` via `AuthContext`
3. **Axios interceptor** adds token to all API requests automatically
4. **Protected routes** check auth state before rendering
5. **On logout** → Token removed from storage and state

### Using Authentication in Components

```jsx
import { useAuth } from "../hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <p>Welcome {user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🎨 Styling with Tailwind CSS

### Tailwind Configuration

The app uses Tailwind CSS 3.4 for styling. Configuration in `tailwind.config.js`:

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Custom extensions here
    },
  },
  plugins: [],
};
```

### Common Utility Classes Used

```css
/* Layout */
flex, grid, container, mx-auto

/* Spacing */
p-4, m-4, space-y-4, gap-4

/* Typography */
text-sm, text-lg, font-bold, text-gray-700

/* Colors */
bg-blue-600, text-white, border-gray-300

/* Responsive */
sm:, md:, lg:, xl:

/* States */
hover:, focus:, disabled:
```

### Custom Styles

Global styles in `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles here */
```

---

## 📡 API Integration

### API Client (`src/api/client.js`)

Axios instance configured with:

- Base URL pointing to Laravel backend
- Automatic token injection via interceptors
- Centralized error handling (auto-logout on 401)

### API Endpoints (`src/api/endpoints.js`)

API calls are organized by feature: `authAPI`, `jobsAPI`, `cvAPI`, `gapAnalysisAPI`, and `marketIntelligenceAPI`.

**Example Usage:**

```javascript
import { jobsAPI } from "../api/endpoints";

// Get jobs
const response = await jobsAPI.getJobs();

// Scrape jobs
const response = await jobsAPI.scrapeJobs();
```

### API Endpoints Used

| Endpoint                        | Method   | Purpose                                     |
| ------------------------------- | -------- | ------------------------------------------- |
| `/register`                     | POST     | Create account                              |
| `/login`                        | POST     | Authenticate user                           |
| `/logout`                       | POST     | Logout user                                 |
| `/user`                         | GET      | Get current user                            |
| `/upload-cv`                    | POST     | Upload & analyze CV                         |
| `/user/skills`                  | GET      | Get user's skills                           |
| `/user/skills/{id}`             | DELETE   | Remove skill                                |
| `/jobs`                         | GET      | Browse jobs                                 |
| `/jobs/{id}`                    | GET      | Get job details                             |
| `/jobs/scrape`                  | POST     | Scrape new jobs                             |
| `/jobs/recommended`             | GET      | Request highly personalized job matches     |
| `/jobs/scrape-if-missing`       | POST     | On-demand job scraping                      |
| `/applications`                 | \*(CRUD) | Application tracker sync functions          |
| `/gap-analysis/job/{id}`        | GET      | Analyze gap for job                         |
| `/gap-analysis/recommendations` | GET      | Get recommendations                         |
| `/market/overview`              | GET      | Market statistics                           |
| `/market/trending-skills`       | GET      | Trending skills analysis                    |
| `/admin/scraping-sources`       | \*       | CRUD operations for active scraping sources |
| `/admin/job-roles`              | \*       | CRUD operations for target job roles        |
| `/admin/scraping/run-full`      | POST     | Manually trigger global market sync         |

---

## 📦 Available Scripts

### `npm run dev`

Starts development server on `http://localhost:5173`

- Hot Module Replacement enabled
- Fast refresh on code changes

### `npm run build`

Creates production build in `dist/` folder

- Minified & optimized code
- Tree-shaking enabled
- Assets hashed for caching

**Build output:**

```
vite v7.3.1 building for production...
✓ 125 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-hash.css       12.34 kB
dist/assets/index-hash.js       156.78 kB
✓ built in 2.45s
```

### `npm run preview`

Preview production build locally

```bash
npm run build
npm run preview
```

Opens server on `http://localhost:4173`

### `npm run lint`

Run ESLint to check code quality

```bash
npm run lint
```

Fix automatically:

```bash
npm run lint -- --fix
```

---

## 🧪 Development Workflow

### Hot Module Replacement (HMR)

Vite provides instant feedback:

1. Edit any `.jsx` file
2. Changes reflect immediately in browser
3. Component state preserved
4. No full page reload needed

### Component Development

Create new component:

```bash
# Create file
touch src/components/MyComponent.jsx
```

```jsx
// src/components/MyComponent.jsx
export default function MyComponent({ title, children }) {
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}
```

Use it:

```jsx
import MyComponent from "./components/MyComponent";

<MyComponent title="Hello">
  <p>Content here</p>
</MyComponent>;
```

### Adding New Pages

1. **Create page component** in `src/pages/`
2. **Add route** in `src/App.jsx`
3. **Add navigation link** in `src/components/Navbar.jsx`

Example:

```jsx
// src/pages/NewPage.jsx
export default function NewPage() {
  return <div>New Page Content</div>;
}

// src/App.jsx
import NewPage from "./pages/NewPage";

<Route path="/new" element={<NewPage />} />;
```

---

## 🐛 Troubleshooting

### Port 5173 Already in Use

```bash
# Kill process on port 5173
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5173 | xargs kill -9

# Or change port in vite.config.js
export default defineConfig({
  server: { port: 3000 }
})
```

### Development Server Won't Start

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Try again
npm run dev
```

### Cannot Connect to Backend API

**Check backend is running:**

```bash
curl http://127.0.0.1:8000/api/health
```

**Update API base URL** in `src/api/client.js`:

```javascript
const API_BASE_URL = "http://127.0.0.1:8000/api";
```

**Check CORS** - Backend should allow `http://localhost:5173` origin.

### Build Errors

```bash
# Clear cache and rebuild
rm -rf dist
npm run build

# Check for TypeScript errors
npm run lint
```

### Authentication Issues

**Token not persisting:**

- Check browser localStorage: `localStorage.getItem('token')`
- Ensure `AuthContext` is wrapping `App.jsx`

**401 Unauthorized errors:**

- Token may have expired - logout and login again
- Check token is being sent in headers (inspect network tab)

### Styling Not Working

**Tailwind classes not applied:**

```bash
# Ensure Tailwind is configured
npm install -D tailwindcss postcss autoprefixer

# Verify index.css has Tailwind directives
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Dependency Conflicts

```bash
# Force clean install
npm ci

# Or update all dependencies
npm update

# Check for security vulnerabilities
npm audit
npm audit fix
```

---

## 🔧 Configuration Files

### `vite.config.js`

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true, // Auto-open browser
  },
});
```

### `tailwind.config.js`

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### `eslint.config.js`

ESLint configured for React best practices.

---

## 🚀 Production Deployment

### Build for Production

```bash
# Create optimized build
npm run build
```

Output goes to `dist/` folder.

### Environment Variables

Create `.env` file for environment-specific configuration:

```env
VITE_API_URL=https://api.yourproduction.com
```

Use in code:

```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

### Deploy to Static Hosting

**Vercel:**

```bash
npm install -g vercel
vercel
```

**Netlify:**

```bash
# Create netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
```

**Nginx:**

```nginx
server {
  listen 80;
  server_name yoursite.com;
  root /path/to/dist;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Performance Optimization

1. **Code Splitting** - Already enabled by Vite
2. **Lazy Loading** - Use React.lazy for routes
3. **Image Optimization** - Use WebP format
4. **Caching** - Configure headers for static assets

---

## 📚 Additional Documentation

- **Detailed Guide**: [FRONTEND_DOCUMENTATION.md](FRONTEND_DOCUMENTATION.md)
- **Developer Guide**: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **React Docs**: https://react.dev
- **Vite Docs**: https://vite.dev
- **Tailwind Docs**: https://tailwindcss.com
- **React Router Docs**: https://reactrouter.com

---

## 🔗 Related Projects

- **Backend API**: `../backend-api/` - Laravel 12 REST API
- **AI Engine**: `../ai-engine/` - Python FastAPI microservice

---

## 📦 Technology Stack

| Technology       | Version | Purpose                 |
| ---------------- | ------- | ----------------------- |
| React            | 19.2.0  | UI library              |
| Vite             | 7.3.1   | Build tool & dev server |
| React Router DOM | 7.13.0  | Client-side routing     |
| Tailwind CSS     | 3.4.1   | Utility-first CSS       |
| Framer Motion    | 12.4.7  | Premium UI Animations   |
| Recharts         | 2.15.1  | SVG Data visualization  |
| Axios            | 1.13.5  | HTTP client             |
| Lucide React     | 0.563.0 | Icon library            |
| ESLint           | 9.39.1  | Code linting            |
| PostCSS          | 8.5.6   | CSS processing          |

---

## 💡 Tips & Best Practices

### State Management

- Use `useState` for local component state
- Use `useContext` (AuthContext) for global auth state
- Keep state as local as possible
- Lift state up only when needed

### API Calls

- Always use try-catch for async operations
- Show loading indicators during requests
- Display user-friendly error messages
- Handle network errors gracefully

### Component Organization

- Keep components small and focused
- Extract reusable logic into custom hooks
- Use composition over inheritance
- Follow consistent naming conventions

### Performance

- Use React.memo() for expensive components
- Avoid inline functions in render
- Use keys properly in lists
- Lazy load routes and components

---

## 📄 License

This Frontend is part of the CareerCompass graduation project - MIT License

---

## 👥 Authors

CareerCompass Team - Graduation Project 2026

---

**Last Updated**: March 2026  
**Version**: 1.2.0  
**Status**: ✅ Phase 21 Complete (Security, Structure & Branding Updates)  
**Node Version**: 18+
