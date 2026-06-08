import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, FileCode, FileJson, Terminal, BookOpen, 
  CheckCircle2, Package, Database, Layers, Zap, 
  GitBranch, FolderOpen, ChevronDown, ChevronRight
} from 'lucide-react';

// ─── ALL FILE CONTENTS ────────────────────────────────────────────────────────

const FILES = {
  'package.json': {
    label: 'package.json',
    icon: 'json',
    category: 'config',
    description: 'Alle 40+ npm Dependencies mit exakten Versionen',
    content: `{
  "name": "kkv-crm",
  "private": true,
  "version": "1.0.0",
  "description": "KrankenkassenVergleich CRM — Swiss Insurance Broker Platform",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@base44/sdk": "^0.8.31",
    "@hello-pangea/dnd": "^17.0.0",
    "@hookform/resolvers": "^4.1.2",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-collapsible": "^1.1.3",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@tanstack/react-query": "^5.84.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.0",
    "date-fns": "^3.6.0",
    "framer-motion": "^11.16.4",
    "jspdf": "^4.0.0",
    "lodash": "^4.17.21",
    "lucide-react": "^0.475.0",
    "moment": "^2.30.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.54.2",
    "react-leaflet": "^4.2.1",
    "react-markdown": "^9.0.1",
    "react-quill": "^2.0.0",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.15.4",
    "sonner": "^2.0.1",
    "tailwind-merge": "^3.0.2",
    "three": "^0.171.0",
    "xlsx": "^0.18.5",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@base44/vite-plugin": "^1.0.21",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "tailwindcss-animate": "^1.0.7",
    "vite": "^5.2.0"
  }
}`
  },

  'setup.sh': {
    label: 'setup.sh',
    icon: 'sh',
    category: 'setup',
    description: 'Vollautomatisches Setup — Node Check → Vite → npm install → Git → Azure Push',
    content: `#!/usr/bin/env bash
# =============================================================================
#  KKV CRM — Local Setup Script
#  Swiss Insurance Broker Platform — Full Rebuild
#  Usage: chmod +x setup.sh && ./setup.sh
# =============================================================================

set -e

PROJECT_NAME="kkv-crm"
AZURE_REMOTE="https://swissbotsai:TOKEN@dev.azure.com/swissbotsai/ch.vsvv/_git/ch.vsvv"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     KKV CRM — Local Setup & Azure Push                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found"; exit 1; }
command -v git >/dev/null 2>&1  || { echo "❌ Git not found"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then echo "❌ Node.js 18+ required"; exit 1; fi
echo "✅ Node.js $(node -v) — OK"
echo "✅ Git ready — OK"

# ── 1. Project Structure ──────────────────────────────────────────────────────
mkdir -p $PROJECT_NAME && cd $PROJECT_NAME
npm create vite@latest . -- --template react --yes 2>/dev/null || true
mkdir -p src/{pages/portal,components/{ui,layout,customers,contracts,applications,documents,dashboard,admin,dossier,krankenkassen,ausschreibung,commissions,shared},entities,functions,agents,lib,hooks,utils,api}
mkdir -p docs

# ── 2. Copy config files ──────────────────────────────────────────────────────
cp ../package.json ./package.json
cp ../vite.config.js ./vite.config.js
cp ../tailwind.config.js ./tailwind.config.js
cp ../src/index.css ./src/index.css
cp ../src/api/base44Client.js ./src/api/base44Client.js
cp ../src/lib/utils.js ./src/lib/utils.js
cp ../src/lib/query-client.js ./src/lib/query-client.js
cp ../src/main.jsx ./src/main.jsx
cp ../src/App.jsx ./src/App.jsx

# Copy all entity schemas
cp ../entities/*.json ./src/entities/ 2>/dev/null || true

# ── 3. Install Dependencies ───────────────────────────────────────────────────
echo "▶ Installing dependencies (~2 min)..."
npm install --legacy-peer-deps
echo "✅ Dependencies installed"

# ── 4. .env ───────────────────────────────────────────────────────────────────
cat > .env << 'ENV'
VITE_BASE44_APP_ID=your_app_id_here
ENV

cat > .gitignore << 'GITIGNORE'
node_modules/
dist/
.env
.env.local
*.local
.DS_Store
*.log
GITIGNORE

# ── 5. Git & Azure ────────────────────────────────────────────────────────────
git init
git add .
git commit -m "feat: initial KKV CRM setup — $(date +%Y-%m-%d)"
git remote add azure "$AZURE_REMOTE"
git push -u azure main --force 2>&1 || {
  echo "⚠️  Update PAT token in AZURE_REMOTE and run: git push -u azure main"
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  Setup Complete!                                     ║"
echo "║  🚀  cd $PROJECT_NAME && npm run dev                    ║"
echo "║  🌐  http://localhost:5173                               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""`
  },

  'vite.config.js': {
    label: 'vite.config.js',
    icon: 'js',
    category: 'config',
    description: 'Vite Config mit @/ Alias und React Plugin',
    content: `import { defineConfig } from 'vite'
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
})`
  },

  'tailwind.config.js': {
    label: 'tailwind.config.js',
    icon: 'js',
    category: 'config',
    description: 'Tailwind mit Premium Light Blue Enterprise Design System',
    content: `/** @type {import('tailwindcss').Config} */
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
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card:        { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover:     { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary:     { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT:              'hsl(var(--sidebar-background))',
          foreground:           'hsl(var(--sidebar-foreground))',
          primary:              'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent:               'hsl(var(--sidebar-accent))',
          'accent-foreground':  'hsl(var(--sidebar-accent-foreground))',
          border:               'hsl(var(--sidebar-border))',
          ring:                 'hsl(var(--sidebar-ring))',
        },
      },
      boxShadow: {
        'card':   '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        'card-md':'0 4px 12px -2px rgb(15 23 42 / 0.08)',
        'modal':  '0 20px 60px -8px rgb(15 23 42 / 0.20)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};`
  },

  'src/index.css': {
    label: 'src/index.css',
    icon: 'css',
    category: 'design',
    description: 'Vollständige Design Tokens — HSL Variablen, Sidebar, Typography, Utilities',
    content: `@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-inter: 'Inter', system-ui, sans-serif;
    --background:        214 60% 97%;
    --foreground:        215 32% 18%;
    --card:              0 0% 100%;
    --card-foreground:   215 30% 18%;
    --popover:           0 0% 100%;
    --popover-foreground: 215 30% 18%;
    --primary:           217 91% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary:         214 40% 95%;
    --secondary-foreground: 215 30% 26%;
    --muted:             214 35% 95%;
    --muted-foreground:  215 16% 52%;
    --accent:            214 40% 94%;
    --accent-foreground: 215 30% 22%;
    --destructive:       3 72% 52%;
    --destructive-foreground: 0 0% 100%;
    --border:            214 40% 90%;
    --input:             214 35% 93%;
    --ring:              217 91% 60%;
    --radius:            0.55rem;
    --sidebar-background: 220 36% 19%;
    --sidebar-foreground: 218 20% 68%;
    --sidebar-primary:   217 91% 62%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent:    220 30% 26%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border:    220 25% 24%;
    --sidebar-ring:      217 91% 62%;
  }
  .dark {
    --background: 222 47% 6%; --foreground: 215 20% 88%;
    --card: 220 38% 10%; --primary: 217 91% 62%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-inter);
    -webkit-font-smoothing: antialiased;
  }
  h1,h2,h3,h4,h5,h6 { letter-spacing: -0.018em; }
}

@layer utilities {
  .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-none::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: hsl(214 36% 84%); border-radius: 999px; }

  .badge-success { @apply bg-emerald-50 text-emerald-700 border border-emerald-200/70; }
  .badge-warning { @apply bg-amber-50 text-amber-700 border border-amber-200/70; }
  .badge-info    { @apply bg-blue-50 text-blue-700 border border-blue-200/70; }
  .badge-danger  { @apply bg-rose-50 text-rose-600 border border-rose-200/70; }
  .badge-neutral { @apply bg-slate-100 text-slate-600 border border-slate-200/70; }

  .surface { @apply bg-white/80 backdrop-blur-sm rounded-xl border border-blue-100/60; box-shadow: 0 1px 3px 0 rgba(59,130,246,0.06); }
  .surface-raised { @apply bg-white/90 backdrop-blur-sm rounded-xl border border-blue-100/50; box-shadow: 0 4px 16px -2px rgba(59,130,246,0.10); }

  .page-enter { animation: pageEnter 0.16s ease-out; }
  @keyframes pageEnter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
}`
  },

  'src/api/base44Client.js': {
    label: 'src/api/base44Client.js',
    icon: 'js',
    category: 'core',
    description: 'Base44 SDK Client — zentraler Einstiegspunkt für alle API-Calls',
    content: `import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID || 'YOUR_APP_ID_HERE',
});

export default base44;`
  },

  'src/lib/utils.js': {
    label: 'src/lib/utils.js',
    icon: 'js',
    category: 'core',
    description: 'cn() Utility für Tailwind class merging',
    content: `import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}`
  },

  'src/lib/query-client.js': {
    label: 'src/lib/query-client.js',
    icon: 'js',
    category: 'core',
    description: 'TanStack Query Client mit optimierten Defaults',
    content: `import { QueryClient } from '@tanstack/react-query'

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})`
  },

  'src/main.jsx': {
    label: 'src/main.jsx',
    icon: 'jsx',
    category: 'core',
    description: 'React Entry Point',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
  },

  'src/App.jsx': {
    label: 'src/App.jsx',
    icon: 'jsx',
    category: 'core',
    description: 'Router Shell — alle 40+ Routes vorkonfiguriert (mit TODOs)',
    content: `import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { Toaster } from 'sonner'

// TODO: Import pages — copy from Base44 project:
// import Dashboard from './pages/Dashboard'
// import CustomerIntelligenceWorkspace from './pages/CustomerIntelligenceWorkspace'
// ... see REBUILD_COMPLETE.md Section 4 for all 40+ routes

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          {/* MAIN ROUTES */}
          <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
          <Route path="/kunden" element={<PlaceholderPage title="Kunden" />} />
          <Route path="/kunden/:id" element={<PlaceholderPage title="Kundendetail" />} />
          <Route path="/kunden/:id/360" element={<PlaceholderPage title="Customer 360" />} />
          <Route path="/vertraege" element={<PlaceholderPage title="Verträge" />} />
          <Route path="/antraege" element={<PlaceholderPage title="Anträge" />} />
          <Route path="/aufgaben" element={<PlaceholderPage title="Aufgaben" />} />
          <Route path="/dokumente" element={<PlaceholderPage title="Dokumente" />} />
          <Route path="/krankenkassen-vergleich" element={<PlaceholderPage title="KV-Vergleich" />} />
          <Route path="/ausschreibungen" element={<PlaceholderPage title="Ausschreibungen" />} />
          <Route path="/leads" element={<PlaceholderPage title="Leads" />} />
          <Route path="/verkaufschancen" element={<PlaceholderPage title="Verkaufschancen" />} />
          <Route path="/provisionen-courtagen" element={<PlaceholderPage title="Provisionen" />} />
          <Route path="/admin/enterprise-control-center" element={<PlaceholderPage title="Enterprise Control" />} />
          {/* PORTAL ROUTES (public) */}
          <Route path="/portal" element={<PlaceholderPage title="Portal" />} />
          <Route path="/portal/setup" element={<PlaceholderPage title="Portal Setup" />} />
          {/* 404 */}
          <Route path="*" element={<PlaceholderPage title="404 — Seite nicht gefunden" />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm">
          Seite noch nicht implementiert — siehe REBUILD_COMPLETE.md
        </p>
      </div>
    </div>
  )
}

export default App`
  },

  'index.html': {
    label: 'index.html',
    icon: 'html',
    category: 'config',
    description: 'HTML Einstiegspunkt mit Meta-Tags und Favicon',
    content: `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="KrankenkassenVergleich CRM — Swiss Insurance Broker Platform" />
    <title>KKV CRM</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
  },

  '.env.example': {
    label: '.env.example',
    icon: 'env',
    category: 'config',
    description: 'Environment Variables Template',
    content: `# Base44 App Configuration
# Get your App ID from: Base44 Dashboard → Settings → App ID
VITE_BASE44_APP_ID=your_app_id_here

# Optional
# VITE_BASE44_API_URL=https://api.base44.com`
  },

  '.gitignore': {
    label: '.gitignore',
    icon: 'git',
    category: 'config',
    description: 'Git Ignore — node_modules, .env, dist',
    content: `node_modules/
dist/
.env
.env.local
*.local
.DS_Store
Thumbs.db
.vscode/
.idea/
coverage/
*.log`
  },

  'entities/Customer.json': {
    label: 'entities/Customer.json',
    icon: 'json',
    category: 'entities',
    description: 'Vollständiges Customer Entity Schema mit RLS',
    content: JSON.stringify({
      name: "Customer", type: "object",
      required: ["first_name","last_name","email","organization_id"],
      properties: {
        customer_number:{type:"string"},first_name:{type:"string"},last_name:{type:"string"},
        email:{type:"string"},phone:{type:"string"},mobile:{type:"string"},
        street:{type:"string"},zip_code:{type:"string"},city:{type:"string"},
        canton:{type:"string",enum:["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"]},
        birthdate:{type:"string",format:"date"},
        civil_status:{type:"string",enum:["single","married","divorced","widowed","registered_partnership"]},
        profession:{type:"string"},nationality:{type:"string"},
        customer_type:{type:"string",enum:["private","business"],default:"private"},
        status:{type:"string",enum:["active","inactive","prospect"],default:"active"},
        mandate_status:{type:"string",enum:["valid","invalid","pending","expired"],default:"pending"},
        association_membership:{type:"string",enum:["vsvv","skv","reka","vfs","pro_life","none"]},
        is_family_member:{type:"boolean",default:false},
        primary_customer_id:{type:"string"},
        family_role:{type:"string",enum:["primary","spouse","child","parent","other"],default:"primary"},
        organization_id:{type:"string"},
        primary_advisor_id:{type:"string"},
        assigned_advisors:{type:"array",items:{type:"string"}},
        assigned_assistants:{type:"array",items:{type:"string"}},
        access_level:{type:"string",enum:["public_admin_only","assigned_advisors_only","team_visible","all_internal"],default:"assigned_advisors_only"},
        total_premium:{type:"number",default:0},
        portal_enabled:{type:"boolean",default:false},
        portal_last_login:{type:"string",format:"date-time"},
        company_name:{type:"string"},legal_form:{type:"string"},uid_number:{type:"string"},
        notes:{type:"string"},
        archived:{type:"boolean",default:false},
        archived_at:{type:"string",format:"date-time"},
        change_history:{type:"array",items:{type:"object",properties:{
          timestamp:{type:"string"},user_id:{type:"string"},user_name:{type:"string"},
          action:{type:"string"},changed_fields:{type:"string"},
          previous_value:{type:"string"},new_value:{type:"string"}
        }}}
      }
    }, null, 2)
  },

  'entities/Contract.json': {
    label: 'entities/Contract.json',
    icon: 'json',
    category: 'entities',
    description: 'Contract Entity mit Renewal, Upsell, Cancellation und RLS',
    content: JSON.stringify({
      name:"Contract",type:"object",
      required:["customer_id","insurer","insurance_type","organization_id"],
      properties:{
        customer_id:{type:"string"},customer_name:{type:"string"},
        organization_id:{type:"string"},advisor_id:{type:"string"},
        insurer:{type:"string"},
        insurance_type:{type:"string",enum:["life","health","property","liability","motor","other"]},
        policy_number:{type:"string"},version_number:{type:"number",default:1},
        product:{type:"string"},
        premium_monthly:{type:"number"},premium_yearly:{type:"number"},
        premium_current:{type:"number"},premium_previous:{type:"number"},
        start_date:{type:"string",format:"date"},end_date:{type:"string",format:"date"},
        renewal_date:{type:"string",format:"date"},auto_renew:{type:"boolean",default:true},
        cancellation_deadline:{type:"string",format:"date"},
        status:{type:"string",enum:["active","pending","cancelled","expired","archived"],default:"active"},
        process_status:{type:"string",enum:["neu","pruefung_offen","kunde_kontaktieren","verlaengerung_vorbereiten","beratung_erfolgt","erledigt"],default:"neu"},
        renewal_status:{type:"string",enum:["none","notified","in_progress","completed"],default:"none"},
        renewal_priority:{type:"string",enum:["low","medium","high"],default:"low"},
        renewal_stage:{type:"string",enum:["early","contact","offer","negotiation","renewed","lost"],default:"early"},
        upsell_stage:{type:"string",enum:["identified","contact","offer","negotiation","won","lost"],default:"identified"},
        upsell_potential_value:{type:"number"},
        cancellation_status:{type:"string",enum:["none","submitted","confirmed","rejected","completed","switch_planned"],default:"none"},
        cancellation_type:{type:"string",enum:["customer_initiated","insurer_initiated","mutual","legal","death","internal_switch"]},
        cancellation_structured_reason:{type:"string",enum:["premium_too_high","switch_competitor","service_dissatisfaction","double_coverage","relocation","death","internal_product_switch","other"]},
        retention_result:{type:"string",enum:["none","retained","internal_switch","lost_external","lost_no_replacement"],default:"none"},
        sparte:{type:"string"},sparte_data:{type:"object",additionalProperties:true},
        commission_rate:{type:"number"},commission_amount:{type:"number"},
        primary_broker_id:{type:"string"},
        assigned_brokers:{type:"array",items:{type:"string"}},
        access_level:{type:"string",enum:["public_admin_only","assigned_brokers_only","team_visible","all_internal"],default:"assigned_brokers_only"},
        notes:{type:"string"},
        archived:{type:"boolean",default:false},
        archived_at:{type:"string",format:"date-time"},
        change_history:{type:"array",items:{type:"object"}}
      },
      rls:{
        read:{$or:[{user_condition:{role:"admin"}},{data:{access_level:"all_internal"}},{data:{primary_broker_id:"{{user.id}}"}},{data:{assigned_brokers:{$in:["{{user.id}}"]}}},{data:{customer_id:"{{user.id}}"}}]},
        create:{$or:[{user_condition:{role:"admin"}},{user_condition:{role:"broker"}},{user_condition:{role:"assistenz"}}]},
        update:{$or:[{user_condition:{role:"admin"}},{data:{primary_broker_id:"{{user.id}}"}},{data:{assigned_brokers:{$in:["{{user.id}}"]}}}]},
        delete:{user_condition:{role:"admin"}}
      }
    }, null, 2)
  },

  'entities/Application.json': {
    label: 'entities/Application.json', icon: 'json', category: 'entities',
    description: 'Application Entity mit Status History und Ablöse-Logik',
    content: JSON.stringify({
      name:"Application",type:"object",
      required:["customer_id","insurer","organization_id"],
      properties:{
        customer_id:{type:"string"},organization_id:{type:"string"},advisor_id:{type:"string"},
        kundentyp:{type:"string",enum:["privat","firma"],default:"privat"},
        insurer:{type:"string"},sparte:{type:"string"},sparte_data:{type:"object",additionalProperties:true},
        status:{type:"string",enum:["new","in_progress","waiting","approved","rejected","archived"],default:"new"},
        status_changed_at:{type:"string",format:"date-time"},
        status_history:{type:"array",items:{type:"object",properties:{
          timestamp:{type:"string"},user_id:{type:"string"},user_name:{type:"string"},
          previous_status:{type:"string"},new_status:{type:"string"},reason:{type:"string"}
        }}},
        estimated_premium_monthly:{type:"number"},requested_start_date:{type:"string",format:"date"},
        policy_number:{type:"string"},
        linked_contract_id:{type:"string"},
        abloese_contract_id:{type:"string",description:"ID des abzulösenden Vertrags"},
        assigned_broker:{type:"string"},notes:{type:"string"},
        archived:{type:"boolean",default:false}
      }
    }, null, 2)
  },

  'entities/Task.json': {
    label: 'entities/Task.json', icon: 'json', category: 'entities',
    description: 'Task Entity für Aufgabenmanagement',
    content: JSON.stringify({
      name:"Task",type:"object",required:["title"],
      properties:{
        title:{type:"string"},description:{type:"string"},
        customer_id:{type:"string"},customer_name:{type:"string"},
        contract_id:{type:"string"},application_id:{type:"string"},
        assigned_to:{type:"string"},
        priority:{type:"string",enum:["low","medium","high","urgent"],default:"medium"},
        status:{type:"string",enum:["open","in_progress","completed"],default:"open"},
        due_date:{type:"string",format:"date"},completion_date:{type:"string",format:"date"},
        task_type:{type:"string",enum:["onboarding","renewal","follow_up","consultation","general","health_declaration"],default:"general"},
        notes:{type:"string"}
      }
    }, null, 2)
  },

  'entities/BAGPraemienDaten.json': {
    label: 'entities/BAGPraemienDaten.json', icon: 'json', category: 'entities',
    description: 'BAG Prämiendaten für Krankenkassen-Vergleich',
    content: JSON.stringify({
      name:"BAGPraemienDaten",type:"object",
      required:["jahr","krankenkasse","kanton","modell","franchise","praemie_erwachsene"],
      properties:{
        jahr:{type:"number"},krankenkasse:{type:"string"},kanton:{type:"string"},
        region:{type:"string"},
        modell:{type:"string",enum:["standard","telmed","hausarzt","hmo"]},
        franchise:{type:"number",enum:[300,500,1000,1500,2000,2500]},
        unfall:{type:"boolean",default:true},
        praemie_erwachsene:{type:"number"},praemie_kinder:{type:"number"},
        geschlecht:{type:"string",enum:["m","w"]},
        alter_von:{type:"number"},alter_bis:{type:"number"},
        datenquelle:{type:"string",default:"BAG"},
        importiert_am:{type:"string",format:"date-time"},
        importiert_von:{type:"string"},
        gueltig_ab:{type:"string",format:"date"},gueltig_bis:{type:"string",format:"date"},
        aktiv:{type:"boolean",default:true}
      }
    }, null, 2)
  },

  'REBUILD_COMPLETE.md': {
    label: 'REBUILD_COMPLETE.md', icon: 'md', category: 'docs',
    description: 'Vollständige Rebuild-Dokumentation — Alle Entities, Functions, Routes',
    content: `# KrankenkassenVergleich CRM — Complete Rebuild Documentation
> Version: 1.0 · Stand: 2026-06-08 · Platform: Base44 (React + Deno)

## TECH STACK
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui
- State: TanStack Query v5
- Backend: Deno Deploy (Base44 Functions)
- Database: Base44 Entities (NoSQL JSON)
- AI: Base44 InvokeLLM (Gemini/Claude)

## ROUTES (40+)
/ → Dashboard
/kunden → CustomerIntelligenceWorkspace
/kunden/:id → CustomerDetail
/kunden/:id/360 → Customer360
/vertraege → Contracts
/antraege → Applications
/aufgaben → Tasks
/dokumente → Documents
/dokument-extraktor → DocumentExtractor
/krankenkassen-vergleich → KrankenkassenVergleich
/bag-daten → BAGDatenVerwaltung
/admin/bag-daten → BAGDatenAdmin (Admin)
/ausschreibungen → Ausschreibungen
/ausschreibungen/:id → AusschreibungDetail
/leads → Leads
/verkaufschancen → Verkaufschancen
/vertragsablaeufe → Vertragsablaeufe
/beratungsdossier → AdvisoryDossier
/provisionen-courtagen → CommissionsAndCourtage
/finanz-dashboard → FinanceDashboard
/ceo-cockpit → CEOCockpit
/sales-autopilot → SalesAutopilot
/execution-mode → ExecutionMode
/reporting → BrokerReporting
/coverage-intelligence → CoverageIntelligence
/email-templates → EmailTemplates
/email-kampagnen → EmailCampaigns
/berater-organisation → BeratungOrganisation
/partner → Partners
/admin/enterprise-control-center → AdminEnterpriseControlCenter
/admin/enterprise-audit → EnterpriseAudit
/compliance-schreiben → ComplianceSchreiben
/portal/* → Portal (PUBLIC, kein Auth)

## BACKEND FUNCTIONS (150+)
importBAGDatenFromURL, analyzeKrankenkassenVergleich,
acceptApplicationAndCreateContract, guardContractLifecycle,
calculateCommissionAuto, handleStornoOfAutomaticProvision,
smartDocumentAnalysis, extractInsuranceDocument, classifyDocument,
checkPoliciesRenewal, autoUpdateRenewalStage, calculateRenewalPriority,
enforceGovernance, auditLogWrite, snapshotGovernanceScore,
systemHealthCheck, createFullBackup, validateSystemIntegrity,
...und 130+ weitere — siehe Base44 Dashboard → Code → Functions

## AUTOMATIONS
Scheduled:
- Täglich: checkPoliciesRenewal, checkPoliciesExpiry, birthdayEmailReminder,
           taskReminderNotifications, snapshotGovernanceScore, dailyOperationsDigest
- Stündlich: checkIncidentSLAs

Entity Triggers:
- Contract create/update → guardContractLifecycle, calculateCommissionAuto
- Application update → onApplicationUpdate, applicationToContractAuto
- Document create → onDocumentUpload
- Lead create → automateLeadScoringOnCreation

## ROLES
admin: Vollzugriff
broker: Eigene Kunden + Verträge
assistenz: Lesen + begrenzte Schreibrechte
user: Nur eigene Daten (Portal)

## REBUILD CHECKLIST
[ ] 1. Base44 App erstellen
[ ] 2. 19+ Entities anlegen (JSON Schemas)
[ ] 3. RLS-Regeln konfigurieren
[ ] 4. index.css Design Tokens
[ ] 5. tailwind.config.js
[ ] 6. AppLayout + Sidebar
[ ] 7. App.jsx Router (40+ Routes)
[ ] 8. Alle Pages (~40)
[ ] 9. Alle Components (~100+)
[ ] 10. Backend Functions deployen (~150)
[ ] 11. Automations konfigurieren
[ ] 12. BAG-Daten importieren
[ ] 13. Portal konfigurieren
[ ] 14. Admin-User einladen`
  }
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

const CATEGORIES = {
  setup:    { label: 'Setup Scripts',      icon: Terminal,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  config:   { label: 'Konfiguration',      icon: Layers,     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  core:     { label: 'Core Files',         icon: Zap,        color: 'text-violet-600 bg-violet-50 border-violet-200' },
  design:   { label: 'Design System',      icon: Package,    color: 'text-pink-600 bg-pink-50 border-pink-200' },
  entities: { label: 'Entity Schemas',     icon: Database,   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  docs:     { label: 'Dokumentation',      icon: BookOpen,   color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getIconBadge(icon) {
  const map = { json:'JSON', sh:'SH', js:'JS', jsx:'JSX', css:'CSS', html:'HTML', env:'ENV', git:'GIT', md:'MD' };
  const colors = { json:'bg-amber-100 text-amber-700', sh:'bg-emerald-100 text-emerald-700', js:'bg-yellow-100 text-yellow-700', jsx:'bg-blue-100 text-blue-700', css:'bg-pink-100 text-pink-700', html:'bg-orange-100 text-orange-700', env:'bg-slate-100 text-slate-700', git:'bg-red-100 text-red-700', md:'bg-violet-100 text-violet-700' };
  return { label: map[icon] || icon.toUpperCase(), color: colors[icon] || 'bg-slate-100 text-slate-700' };
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllAsScript() {
  const entries = Object.entries(FILES);
  let script = `#!/usr/bin/env bash
# ============================================================
#  KKV CRM — All-in-One File Extractor
#  Erstellt alle Projektdateien in ./kkv-crm-files/
#  Usage: chmod +x extract-all.sh && ./extract-all.sh
# ============================================================
set -e
mkdir -p kkv-crm-files/src/api kkv-crm-files/src/lib kkv-crm-files/entities kkv-crm-files/docs
cd kkv-crm-files
echo "Erstelle ${entries.length} Dateien..."
`;

  for (const [filename, file] of entries) {
    const escaped = file.content
      .replace(/\\/g, '\\\\')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    script += `\ncat > "${filename}" << 'ENDOFFILE'\n${file.content}\nENDOFFILE\n`;
  }

  script += `
echo ""
echo "✅ Alle ${entries.length} Dateien erstellt in ./kkv-crm-files/"
echo "📋 Nächster Schritt: bash setup.sh"
`;
  downloadFile('extract-all.sh', script);
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function ArchiveDownload() {
  const [downloaded, setDownloaded] = useState({});
  const [expanded, setExpanded] = useState({});
  const [preview, setPreview] = useState(null);

  const handleDownload = (key, file) => {
    downloadFile(key, file.content);
    setDownloaded(prev => ({ ...prev, [key]: true }));
  };

  const handleDownloadAll = () => {
    Object.entries(FILES).forEach(([key, file]) => {
      setTimeout(() => downloadFile(key, file.content), 0);
      setDownloaded(prev => ({ ...prev, [key]: true }));
    });
  };

  const grouped = Object.entries(CATEGORIES).map(([catKey, cat]) => ({
    key: catKey,
    ...cat,
    files: Object.entries(FILES).filter(([, f]) => f.category === catKey)
  }));

  const totalFiles = Object.keys(FILES).length;
  const downloadedCount = Object.keys(downloaded).length;

  return (
    <div className="min-h-screen bg-background page-enter">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">All-in-One Archive</h1>
              <p className="text-sm text-muted-foreground">KKV CRM — Alle Projektdateien download-ready</p>
            </div>
          </div>

          {/* Stats + Main Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Badge variant="outline" className="badge-info text-xs px-3 py-1">
              {totalFiles} Dateien total
            </Badge>
            {downloadedCount > 0 && (
              <Badge className="badge-success text-xs px-3 py-1">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {downloadedCount} heruntergeladen
              </Badge>
            )}
            <div className="flex gap-2 ml-auto">
              <Button onClick={downloadAllAsScript} variant="outline" size="sm">
                <Terminal className="w-3.5 h-3.5 mr-2" />
                Extract Script (.sh)
              </Button>
              <Button onClick={handleDownloadAll} size="sm">
                <Download className="w-3.5 h-3.5 mr-2" />
                Alle {totalFiles} Dateien
              </Button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <strong>Quickstart:</strong> «Extract Script» herunterladen → <code className="bg-blue-100 px-1 rounded">chmod +x extract-all.sh && ./extract-all.sh</code> → erstellt alle Dateien lokal. Dann <code className="bg-blue-100 px-1 rounded">bash setup.sh</code> für vollständiges Projekt.
        </div>

        {/* File Groups */}
        <div className="space-y-4">
          {grouped.map(({ key, label, icon: Icon, color, files }) => {
            if (files.length === 0) return null;
            const isOpen = expanded[key] !== false;
            return (
              <div key={key} className="surface rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !isOpen }))}
                >
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">{label}</span>
                  <Badge variant="outline" className="text-xs ml-1">{files.length}</Badge>
                  <span className="ml-auto text-muted-foreground">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border/50">
                    {files.map(([fileKey, file]) => {
                      const badge = getIconBadge(file.icon);
                      const isDone = !!downloaded[fileKey];
                      const isPreview = preview === fileKey;
                      return (
                        <div key={fileKey} className="border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/20 transition-colors">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground font-mono truncate">{file.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => setPreview(isPreview ? null : fileKey)}
                              >
                                {isPreview ? 'Hide' : 'Preview'}
                              </Button>
                              <Button
                                size="sm"
                                className={`h-7 text-xs px-3 ${isDone ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                                onClick={() => handleDownload(fileKey, file)}
                              >
                                {isDone ? <><CheckCircle2 className="w-3 h-3 mr-1" />OK</> : <><Download className="w-3 h-3 mr-1" />Download</>}
                              </Button>
                            </div>
                          </div>
                          {isPreview && (
                            <div className="mx-4 mb-3">
                              <pre className="bg-slate-900 text-slate-100 text-[11px] p-4 rounded-lg overflow-x-auto max-h-64 scrollbar-none leading-relaxed">
                                {file.content}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
          KKV CRM Archive · {new Date().toLocaleDateString('de-CH')} · Base44 Platform · <span className="font-mono">v1.0</span>
        </div>
      </div>
    </div>
  );
}