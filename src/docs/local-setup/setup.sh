#!/usr/bin/env bash
# =============================================================================
#  KKV CRM — Local Setup Script
#  Swiss Insurance Broker Platform — Full Rebuild
#  Usage: chmod +x setup.sh && ./setup.sh
# =============================================================================

set -e  # Exit on error

PROJECT_NAME="kkv-crm"
AZURE_REMOTE="https://swissbotsai:TOKEN@dev.azure.com/swissbotsai/ch.vsvv/_git/ch.vsvv"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     KKV CRM — Local Setup & Azure Push                  ║"
echo "║     KrankenkassenVergleich Broker Platform               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Prerequisites Check ───────────────────────────────────────────────────
echo "▶ Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v git >/dev/null 2>&1  || { echo "❌ Git not found. Install from https://git-scm.com"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found v$NODE_VER)"; exit 1
fi
echo "✅ Node.js $(node -v) — OK"
echo "✅ Git $(git --version | awk '{print $3}') — OK"
echo ""

# ── 1. Create Project Structure ──────────────────────────────────────────────
echo "▶ Creating project structure..."
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME

# Vite project scaffold
npm create vite@latest . -- --template react --yes 2>/dev/null || true

# Source directories
mkdir -p src/pages/portal
mkdir -p src/components/{ui,layout,customers,contracts,applications,documents,dashboard,admin,dossier,krankenkassen,ausschreibung,commissions,partners,leads,intelligence,shared,portal,verkaufschance,autopilot,execution,email,mutation,status,ceo,analysis,ai}
mkdir -p src/entities
mkdir -p src/functions
mkdir -p src/agents
mkdir -p src/lib
mkdir -p src/hooks
mkdir -p src/utils
mkdir -p src/api
mkdir -p docs
echo "✅ Directory structure created"
echo ""

# ── 2. Install Dependencies ──────────────────────────────────────────────────
echo "▶ Installing dependencies (this takes ~2 minutes)..."
cp ../package.json ./package.json
npm install --legacy-peer-deps
echo "✅ Dependencies installed"
echo ""

# ── 3. Tailwind CSS Setup ────────────────────────────────────────────────────
echo "▶ Configuring Tailwind CSS..."
npx tailwindcss init -p 2>/dev/null || true

cat > tailwind.config.js << 'TAILWIND'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: { inter: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)', md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)', '3xl': 'calc(var(--radius) + 16px)',
      },
      colors: {
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))', foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))', 'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))', 'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))', ring: 'hsl(var(--sidebar-ring))',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
TAILWIND
echo "✅ Tailwind configured"
echo ""

# ── 4. Vite Config ───────────────────────────────────────────────────────────
echo "▶ Configuring Vite..."
cat > vite.config.js << 'VITE'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { port: 5173 }
})
VITE
echo "✅ Vite configured"
echo ""

# ── 5. Base44 SDK Client ─────────────────────────────────────────────────────
echo "▶ Creating Base44 SDK client..."
cat > src/api/base44Client.js << 'SDK'
import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: process.env.VITE_BASE44_APP_ID || 'YOUR_APP_ID_HERE',
});

export default base44;
SDK
echo "✅ SDK client created"
echo ""

# ── 6. Lib Utils ─────────────────────────────────────────────────────────────
echo "▶ Creating utility files..."
cat > src/lib/utils.js << 'UTILS'
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
UTILS

cat > src/lib/query-client.js << 'QC'
import { QueryClient } from '@tanstack/react-query'

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})
QC
echo "✅ Utils created"
echo ""

# ── 7. index.css (Design Tokens) ─────────────────────────────────────────────
echo "▶ Writing design tokens (index.css)..."
cat > src/index.css << 'CSS'
@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-inter: 'Inter', system-ui, sans-serif;
    --background: 214 60% 97%;
    --foreground: 215 32% 18%;
    --card: 0 0% 100%;
    --card-foreground: 215 30% 18%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 30% 18%;
    --primary: 217 91% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 214 40% 95%;
    --secondary-foreground: 215 30% 26%;
    --muted: 214 35% 95%;
    --muted-foreground: 215 16% 52%;
    --accent: 214 40% 94%;
    --accent-foreground: 215 30% 22%;
    --destructive: 3 72% 52%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 40% 90%;
    --input: 214 35% 93%;
    --ring: 217 91% 60%;
    --radius: 0.55rem;
    --sidebar-background: 220 36% 19%;
    --sidebar-foreground: 218 20% 68%;
    --sidebar-primary: 217 91% 62%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 220 30% 26%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 220 25% 24%;
    --sidebar-ring: 217 91% 62%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-inter);
    -webkit-font-smoothing: antialiased;
  }
}
CSS
echo "✅ Design tokens written"
echo ""

# ── 8. Entity Schemas ─────────────────────────────────────────────────────────
echo "▶ Creating entity schemas..."

cat > src/entities/Customer.json << 'ENTITY'
{
  "name": "Customer", "type": "object",
  "required": ["first_name","last_name","email","organization_id"],
  "properties": {
    "customer_number":{"type":"string"},"first_name":{"type":"string"},"last_name":{"type":"string"},
    "email":{"type":"string"},"phone":{"type":"string"},"mobile":{"type":"string"},
    "street":{"type":"string"},"zip_code":{"type":"string"},"city":{"type":"string"},
    "canton":{"type":"string","enum":["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"]},
    "birthdate":{"type":"string","format":"date"},"civil_status":{"type":"string","enum":["single","married","divorced","widowed"]},
    "customer_type":{"type":"string","enum":["private","business"],"default":"private"},
    "status":{"type":"string","enum":["active","inactive","prospect"],"default":"active"},
    "mandate_status":{"type":"string","enum":["valid","invalid","pending","expired"],"default":"pending"},
    "is_family_member":{"type":"boolean","default":false},"primary_customer_id":{"type":"string"},
    "family_role":{"type":"string","enum":["primary","spouse","child","parent","other"],"default":"primary"},
    "organization_id":{"type":"string"},"primary_advisor_id":{"type":"string"},
    "assigned_advisors":{"type":"array","items":{"type":"string"}},
    "access_level":{"type":"string","enum":["public_admin_only","assigned_advisors_only","team_visible","all_internal"],"default":"assigned_advisors_only"},
    "total_premium":{"type":"number","default":0},"portal_enabled":{"type":"boolean","default":false},
    "archived":{"type":"boolean","default":false},"notes":{"type":"string"}
  }
}
ENTITY

cat > src/entities/Contract.json << 'ENTITY'
{
  "name": "Contract", "type": "object",
  "required": ["customer_id","insurer","insurance_type","organization_id"],
  "properties": {
    "customer_id":{"type":"string"},"organization_id":{"type":"string"},"advisor_id":{"type":"string"},
    "insurer":{"type":"string"},"insurance_type":{"type":"string","enum":["life","health","property","liability","motor","other"]},
    "policy_number":{"type":"string"},"product":{"type":"string"},
    "premium_monthly":{"type":"number"},"premium_yearly":{"type":"number"},
    "start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"},
    "renewal_date":{"type":"string","format":"date"},"auto_renew":{"type":"boolean","default":true},
    "cancellation_deadline":{"type":"string","format":"date"},
    "status":{"type":"string","enum":["active","pending","cancelled","expired","archived"],"default":"active"},
    "renewal_stage":{"type":"string","enum":["early","contact","offer","negotiation","renewed","lost"],"default":"early"},
    "cancellation_status":{"type":"string","enum":["none","submitted","confirmed","rejected","completed","switch_planned"],"default":"none"},
    "sparte":{"type":"string"},"sparte_data":{"type":"object"},
    "commission_rate":{"type":"number"},"commission_amount":{"type":"number"},
    "primary_broker_id":{"type":"string"},"assigned_brokers":{"type":"array","items":{"type":"string"}},
    "access_level":{"type":"string","enum":["public_admin_only","assigned_brokers_only","team_visible","all_internal"],"default":"assigned_brokers_only"},
    "archived":{"type":"boolean","default":false},"notes":{"type":"string"}
  }
}
ENTITY

cat > src/entities/Application.json << 'ENTITY'
{
  "name": "Application", "type": "object",
  "required": ["customer_id","insurer","organization_id"],
  "properties": {
    "customer_id":{"type":"string"},"organization_id":{"type":"string"},"advisor_id":{"type":"string"},
    "insurer":{"type":"string"},"sparte":{"type":"string"},"sparte_data":{"type":"object"},
    "status":{"type":"string","enum":["new","in_progress","waiting","approved","rejected","archived"],"default":"new"},
    "estimated_premium_monthly":{"type":"number"},"requested_start_date":{"type":"string","format":"date"},
    "linked_contract_id":{"type":"string"},"status_history":{"type":"array","items":{"type":"object"}},
    "archived":{"type":"boolean","default":false},"notes":{"type":"string"}
  }
}
ENTITY

cat > src/entities/Task.json << 'ENTITY'
{
  "name": "Task", "type": "object", "required": ["title"],
  "properties": {
    "title":{"type":"string"},"description":{"type":"string"},
    "customer_id":{"type":"string"},"contract_id":{"type":"string"},"application_id":{"type":"string"},
    "assigned_to":{"type":"string"},"priority":{"type":"string","enum":["low","medium","high","urgent"],"default":"medium"},
    "status":{"type":"string","enum":["open","in_progress","completed"],"default":"open"},
    "due_date":{"type":"string","format":"date"},"completion_date":{"type":"string","format":"date"},
    "task_type":{"type":"string","enum":["onboarding","renewal","follow_up","consultation","general","health_declaration"],"default":"general"}
  }
}
ENTITY

cat > src/entities/Document.json << 'ENTITY'
{
  "name": "Document", "type": "object", "required": ["name","file_url"],
  "properties": {
    "name":{"type":"string"},"file_url":{"type":"string"},"customer_id":{"type":"string"},
    "category":{"type":"string","enum":["contract","application","identification","correspondence","other"]},
    "processing_stage":{"type":"string","enum":["uploaded","parsed","entities_detected","customer_mapped","application_created","policy_created"],"default":"uploaded"},
    "classification_status":{"type":"string","enum":["ausstehend","klassifiziert","pruefung_erforderlich","manuell"],"default":"ausstehend"},
    "linked_contract_id":{"type":"string"},"linked_application_id":{"type":"string"},
    "uploaded_by":{"type":"string"},"uploaded_at":{"type":"string","format":"date-time"},
    "file_hash":{"type":"string"},"version":{"type":"number","default":1},"immutable":{"type":"boolean","default":false},
    "access_level":{"type":"string","enum":["public_admin_only","assigned_advisors_only","team_visible","all_internal"],"default":"assigned_advisors_only"}
  }
}
ENTITY

cat > src/entities/BAGPraemienDaten.json << 'ENTITY'
{
  "name": "BAGPraemienDaten", "type": "object",
  "required": ["jahr","krankenkasse","kanton","modell","franchise","praemie_erwachsene"],
  "properties": {
    "jahr":{"type":"number"},"krankenkasse":{"type":"string"},"kanton":{"type":"string"},"region":{"type":"string"},
    "modell":{"type":"string","enum":["standard","telmed","hausarzt","hmo"]},
    "franchise":{"type":"number","enum":[300,500,1000,1500,2000,2500]},
    "unfall":{"type":"boolean","default":true},"praemie_erwachsene":{"type":"number"},
    "praemie_kinder":{"type":"number"},"geschlecht":{"type":"string","enum":["m","w"]},
    "datenquelle":{"type":"string","default":"BAG"},"importiert_am":{"type":"string","format":"date-time"},
    "gueltig_ab":{"type":"string","format":"date"},"gueltig_bis":{"type":"string","format":"date"},
    "aktiv":{"type":"boolean","default":true}
  }
}
ENTITY

cat > src/entities/Organization.json << 'ENTITY'
{
  "name": "Organization", "type": "object", "required": ["name"],
  "properties": {
    "name":{"type":"string"},"type":{"type":"string","enum":["strukturvertrieb","broker","partner","sonstiges"],"default":"broker"},
    "status":{"type":"string","enum":["active","inactive"],"default":"active"},
    "finma_number":{"type":"string"},"street":{"type":"string"},"zip_code":{"type":"string"},
    "city":{"type":"string"},"phone":{"type":"string"},"email":{"type":"string"},"website":{"type":"string"},
    "works_with_address_brokers":{"type":"boolean","default":false},"notes":{"type":"string"}
  }
}
ENTITY

echo "✅ Entity schemas created (7 core + see docs/DATABASE_EXPORT.json for all 29)"
echo ""

# ── 9. main.jsx ───────────────────────────────────────────────────────────────
echo "▶ Creating main.jsx..."
cat > src/main.jsx << 'MAIN'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
MAIN
echo "✅ main.jsx created"
echo ""

# ── 10. App.jsx (Minimal Router Shell) ───────────────────────────────────────
echo "▶ Creating App.jsx router shell..."
cat > src/App.jsx << 'APPROUTER'
import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { Toaster } from 'sonner'

// TODO: Import all pages from pages/ directory
// Example:
// import Dashboard from './pages/Dashboard'

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/" element={<div className="p-8 text-2xl font-bold">KKV CRM — Ready to build!</div>} />
          {/* ADD ALL ROUTES HERE — see docs/REBUILD_COMPLETE.md section 4 */}
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
APPROUTER
echo "✅ App.jsx router shell created"
echo ""

# ── 11. .env Template ─────────────────────────────────────────────────────────
echo "▶ Creating .env template..."
cat > .env.example << 'ENV'
# Base44 App Configuration
VITE_BASE44_APP_ID=your_app_id_here

# Optional: Override API endpoint
# VITE_BASE44_API_URL=https://api.base44.com
ENV

cp .env.example .env
echo "✅ .env template created (fill in your Base44 App ID)"
echo ""

# ── 12. .gitignore ────────────────────────────────────────────────────────────
echo "▶ Creating .gitignore..."
cat > .gitignore << 'GITIGNORE'
node_modules/
dist/
.env
.env.local
*.local
.DS_Store
Thumbs.db
.vscode/
.idea/
coverage/
*.log
GITIGNORE
echo "✅ .gitignore created"
echo ""

# ── 13. Git Init & Azure Remote ───────────────────────────────────────────────
echo "▶ Initializing Git repository..."
git init
git add .
git commit -m "feat: initial KKV CRM project setup

- Vite + React 18 scaffold
- All npm dependencies installed
- Tailwind CSS with design tokens (Premium Light Blue Enterprise)
- Base44 SDK client configured
- 7 core entity schemas (Customer, Contract, Application, Task, Document, BAGPraemienDaten, Organization)
- App.jsx router shell
- Design system (index.css variables)
- Full documentation in docs/

See docs/REBUILD_COMPLETE.md for complete rebuild guide
See docs/DATABASE_EXPORT.json for all 29 entity schemas"

echo "✅ Git initialized with initial commit"
echo ""

# ── 14. Azure DevOps Push ─────────────────────────────────────────────────────
echo "▶ Setting up Azure DevOps remote..."
git remote add azure "$AZURE_REMOTE"
echo "✅ Azure remote added"
echo ""

echo "▶ Pushing to Azure DevOps..."
git push -u azure main --force 2>&1 || git push -u azure master --force 2>&1 || {
  echo ""
  echo "⚠️  Push failed — please update the PAT token in AZURE_REMOTE variable"
  echo "   Current URL: $AZURE_REMOTE"
  echo "   Get a new PAT from: https://dev.azure.com/swissbotsai/_usersSettings/tokens"
  echo ""
  echo "   Then run manually:"
  echo "   git push -u azure main"
  echo ""
}

# ── 15. Final Summary ─────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     ✅  KKV CRM Setup Complete!                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  📁 Project: ./$PROJECT_NAME/                           ║"
echo "║  🚀 Start:   cd $PROJECT_NAME && npm run dev            ║"
echo "║  🌐 URL:     http://localhost:5173                       ║"
echo "║                                                          ║"
echo "║  📋 Next steps:                                          ║"
echo "║  1. Fill in .env (VITE_BASE44_APP_ID)                   ║"
echo "║  2. Copy source files from Base44 GitHub Sync           ║"
echo "║  3. See docs/REBUILD_COMPLETE.md for all routes         ║"
echo "║  4. See docs/DATABASE_EXPORT.json for all 29 entities   ║"
echo "║                                                          ║"
echo "║  🔗 Azure:                                               ║"
echo "║  https://dev.azure.com/swissbotsai/ch.vsvv/_git/ch.vsvv ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""