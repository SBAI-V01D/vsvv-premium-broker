# 🇨🇭 VSVV Premium Broker System — Master Architecture & Technical Documentation

**System Name:** VSVV Premium Broker Enterprise System  
**System Identity:** Cody.Nucl3us (SwissBotsAI Ökosystem)  
**Operator:** Nik Istrefi (Founder, SwissBotsAI)  
**Live Target Web UI:** `https://vsvv.avaai.ch`  
**Live Backend API Engine:** `http://localhost:8000` / Exoscale SKS Pod `vsvv-base44-app` (Fastify 3003)  
**Infrastructure Target:** Exoscale SKS Kubernetes Cluster & Exoscale GPU Node (`ch-gva-2`)  
**Data Volume:** 5'029 Master Customers, 110 Contracts, 961 Advisors, CHF 323'073.45 Premium Volume  
**OCR AI Engine Model:** `ava:ocr`  

---

## 1. High-Level System Architecture

```mermaid
graph TD
    subgraph ClientLayer["Client Layer (Frontend)"]
        UI["Web UI SPA (React 18 / Vite)\nvsvv.avaai.ch"]
        PWA["Progressive Web App Manifest"]
        Mobile["Mobile & Portal View"]
    end

    subgraph IngressLayer["Ingress & Proxy Layer"]
        NGINX["Exoscale Nginx Reverse Proxy\n(92.39.61.84 / Port 443 SSL)"]
        SKS_INGRESS["Exoscale SKS Ingress Controller\n(vsvv-base44-ingress)"]
    end

    subgraph ApplicationLayer["Application & API Engine Layer"]
        FastifyAPI["Fastify Node.js Enterprise API\n(Port 3003 / Unlimited CRUD)"]
        FastAPI_Python["Python FastAPI Analytics Engine\n(Port 8000 / ava:ocr Gateway)"]
        PrismaORM["Prisma ORM Singleton"]
    end

    subgraph DataLayer["Database & Storage Layer"]
        PostgresDB[("Exoscale PostgreSQL DB\nava-nerv-db:5432/vsvv\n(5'029 Kunden)")]
        SQLiteMaster[("SQLite Master DB\nvsvv_premium_broker.db\n(Local & SKS Sync)")]
        ExoscaleS3[("Exoscale SOS S3 Storage\nsbai-ava-storage (ch-gva-2)")]
        RedisCache[("Redis Cache\nava-hive-redis:6379")]
    end

    subgraph AI_Engine["SwissBotsAI Intelligence Core"]
        OllamaGPU["Exoscale A30 GPU Node\n(172.16.10.30:11434)"]
        OCRModel["ava:ocr Vision Model"]
    end

    UI --> NGINX
    PWA --> NGINX
    NGINX --> SKS_INGRESS
    SKS_INGRESS --> FastifyAPI
    SKS_INGRESS --> FastAPI_Python

    FastifyAPI --> PrismaORM
    PrismaORM --> PostgresDB
    FastifyAPI --> RedisCache

    FastAPI_Python --> SQLiteMaster
    FastAPI_Python --> ExoscaleS3
    FastAPI_Python --> OllamaGPU
    OllamaGPU --> OCRModel
```

---

## 2. Entity-Relationship Data Model (ERD)

```mermaid
erDiagram
    CUSTOMER ||--o{ CONTRACT : owns
    CUSTOMER ||--o{ CLAIM : files
    CUSTOMER ||--o{ ADVISORY_DOSSIER : receives
    CUSTOMER ||--o{ APPLICATION : submits
    ADVISOR ||--o{ CUSTOMER : manages
    ADVISOR ||--o{ COMMISSION : earns
    CONTRACT ||--o{ COMMISSION : generates
    CONTRACT ||--o{ DOCUMENT : contains
    APPLICATION ||--o{ DOCUMENT : attaches

    CUSTOMER {
        string id PK
        string master_customer_id
        string arrilla_id
        string first_name
        string last_name
        string email
        string phone
        string street
        string zip_code
        string city
        string customer_type "default: private"
        string status "default: active"
        datetime created_at
        datetime updated_at
    }

    CONTRACT {
        string id PK
        string police_nummer
        string customer_id FK
        string insurer
        string branch
        decimal premium_yearly
        datetime start_date
        datetime end_date
        string status
        datetime updated_at
    }

    ADVISOR {
        string id PK
        string member_id
        string first_name
        string last_name
        string email
        string phone
        string role
        datetime updated_at
    }

    DOCUMENT {
        string id PK
        string filename
        string file_url
        string s3_key
        string ocr_status
        string extracted_data
        datetime uploaded_at
        datetime updated_at
    }

    COMMISSION {
        string id PK
        string contract_id FK
        string advisor_id FK
        decimal amount_chf
        string commission_type
        datetime payout_date
        datetime updated_at
    }

    CLAIM {
        string id PK
        string claim_number
        string customer_id FK
        string contract_id FK
        decimal claim_amount
        string status
        datetime updated_at
    }

    ADVISORY_DOSSIER {
        string id PK
        string dossier_number
        string customer_id FK
        string summary
        string status
        datetime updated_at
    }

    APPLICATION {
        string id PK
        string application_number
        string customer_id FK
        string status
        datetime updated_at
    }
```

---

## 3. Intelligent OCR Document Pipeline (`ava:ocr`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Broker / User
    participant Frontend as Web UI (vsvv.avaai.ch)
    participant API as Fastify / FastAPI Backend
    participant S3 as Exoscale SOS S3 (ch-gva-2)
    participant GPU as Exoscale A30 GPU Node
    participant DB as PostgreSQL / SQLite DB

    User->>Frontend: Upload Insurance Policy (PDF/Image)
    Frontend->>API: POST /api/ki-analyse (Multipart Upload)
    API->>S3: Upload raw file to bucket 'sbai-ava-storage'
    S3-->>API: Presigned S3 URL & Object Key
    API->>GPU: Dispatch Extraction Task (Model: ava:ocr)
    GPU-->>API: Structured JSON (Versicherer, Polizzen-Nr, Prämie, Datum)
    API->>DB: Store Document & Create Contract Record (conn.commit())
    API-->>Frontend: JSON Response (Status: 200 OK + Extracted Metadata)
    Frontend-->>User: Display Extracted Document & Pre-filled Form
```

---

## 4. Exoscale SKS Kubernetes Deployment Infrastructure

```mermaid
flowchart LR
    subgraph Exoscale_Cloud["Exoscale Swiss Cloud (Zone: ch-gva-2)"]
        subgraph SKS_Cluster["Exoscale SKS Kubernetes Cluster"]
            Pod_App["Pod: vsvv-base44-app\n- Fastify Node.js (Port 3003)\n- Vite SPA Static Serve (Port 3004)\n- MinIO Storage"]
            Pod_Dev["Pod: vsvv-broker-dev\n- OpenChamber Workspace\n- FastAPI Python Engine (Port 8000)\n- vsvv_premium_broker.db"]
            Service_Base44["Service: vsvv-base44-svc\n(ClusterIP: 10.100.245.85)"]
            Ingress_Base44["Ingress: vsvv-base44-ingress\n(vsvv.avaai.ch & vsvv.coredy.dev)"]
        end

        subgraph Storage_Services["Persistent Services"]
            PG_DB[("PostgreSQL DB Container\nava-nerv-db:5432")]
            Redis_Svc[("Redis Cache Service\nava-hive-redis:6379")]
            SOS_S3[("Exoscale SOS Object Storage\nsbai-ava-storage")]
        end

        subgraph GPU_Node["A30 GPU Core Node (172.16.10.30)"]
            Ollama["Ollama Engine\nModel: ava:ocr"]
        end
    end

    Ingress_Base44 --> Service_Base44
    Service_Base44 --> Pod_App
    Pod_App --> PG_DB
    Pod_App --> Redis_Svc
    Pod_App --> SOS_S3
    Pod_Dev --> GPU_Node
```

---

## 5. REST API Endpoint Specification

### Core Endpoints Table

| Method | Endpoint Route | Description | Auth Required | Default Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & return Bearer JWT | No | N/A |
| `GET` | `/api/stats` | Return live dashboard summary counts | Yes | N/A |
| `GET` | `/api/customers` | Query master customer list (5'029 records) | Yes | **5'000 (Unlimited)** |
| `POST` | `/api/customers` | Create new master customer record | Yes | N/A |
| `PATCH` | `/api/customers/:id` | Update customer record (commit to DB) | Yes | N/A |
| `GET` | `/api/contracts` | List all insurance contracts | Yes | 5'000 |
| `GET` | `/api/advisors` | List all 961 VSVV advisors & partners | Yes | 5'000 |
| `POST` | `/api/ki-analyse` | Trigger OCR extraction with `ava:ocr` model | Yes | N/A |
| `GET` | `/api/documents` | List uploaded policy documents with S3 links | Yes | 5'000 |

---

## 6. RBAC & Security Specification

| Role | Access Level | Capabilities |
| :--- | :--- | :--- |
| **Administrator** | Full Access (`*`) | Full CRUD across all 29 pages, user management, audit logs, system checks, database exports. |
| **Advisor / Broker** | Manager Access | Read/Write assigned customers, contracts, quotes, commissions, dossiers. |
| **Partner** | Restricted Read | Read-only access to relevant client contracts and commission statements. |
| **Client (Portal)** | Portal Access | Self-service portal view for personal insurance policies and claims. |

---

## 7. Operational Runbook & Maintenance Commands

### SKS Pod Deployment & Restart
```bash
# Connect via SSH to GPU Host / SKS Management Node
ssh sbai-gpu

# Check pod statuses
kubectl get pods -l app=vsvv-base44-app

# Execute clean rollout restart
kubectl rollout restart deployment vsvv-base44-app
kubectl rollout status deployment vsvv-base44-app
```

### Database Persistence & Backup
```bash
# Check PostgreSQL live customer count inside pod
kubectl exec vsvv-base44-app-6bd4d6dc69-2kbrx -c app -- node /tmp/count_pg.js

# Backup SQLite database
cp vsvv_premium_broker.db vsvv_premium_broker_backup_$(date +%Y%m%d).db
```

---
*Documentation generated by Cody.Nucl3us — SwissBotsAI Enterprise Intelligence.*
