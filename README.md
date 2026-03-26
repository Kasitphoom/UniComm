# 💬 UniComm – Unified Communication Platform

**UniComm** is a next-generation **Customer Communication Management (CCM)** and **Unified Communication Platform** that enables enterprises to design, manage, personalize, and deliver customer communications across all channels — faster, smarter, and more securely.

Built as a **cloud-native, AI-powered SaaS**, UniComm combines low-code template design, real-time orchestration, analytics, and compliance into one unified system — transforming how organizations engage with customers.

---

## 🚀 Overview

Traditional CCM solutions are complex, IT-driven, and slow to adapt.  
**UniComm** reimagines communication management with a **modern, AI-assisted experience**, letting business users create compliant, omnichannel messages without relying on IT.

**Core Channels:**  
Email • PDF/Print

**Potential Industries Served:**  
Small Business • Medium Business

---

## ✨ Key Features

### 🎨 Omnichannel Template Designer
- Drag-and-drop builder for PDF, Email, and SMS  
- Dynamic placeholders and conditional logic  
- Shared content blocks for consistent branding  
- Multi-language support and real-time previews  

### ⚙️ Communication Orchestration Engine
- Event-driven workflows triggered by APIs, Kafka, or webhooks  
- Real-time or batch message delivery  
- Visual workflow builder

### 🤖 AI Assistance
- Smart copy and tone suggestions  
- Automated personalization from CRM data  
- Compliance validation and sentiment analysis  

### 📊 Analytics Dashboard
- Message-level metrics (open, click, dwell time, sentiment)  
- Funnel and conversion analytics  
- Drill-down insights from campaign → recipient  
- Export APIs for Tableau, PowerBI, or Snowflake  

### 🛡️ Governance & Compliance
- Role-based access and content locks  
- Version control and approval workflows  
- Immutable audit trails and data retention policies  
- GDPR, HIPAA, and SOC2 compliance  

---

## 🧠 Architecture Highlights

- **Cloud-native microservices** for high scalability 
- **API-first & event-driven** design
- **Secure connectors** for Salesforce Etc.
- **Multi-tenant isolation**

---

## 📈 Goals

- Simplify enterprise communication workflows  
- Accelerate time-to-market (weeks → days)  
- Reduce operational and IT dependency  
- Enable intelligent, compliant omnichannel messaging  

---

## 📜 License

This project is currently in development. Licensing details will be added upon release.

---

## 📫 Contact

**Author:** Kasitphoom Thowongs  
**Email:** [3044035t@student.gla.ac.uk](mailto:3044035t@student.gla.ac.uk)  
**Website:** [kasitphoom.com](https://kasitphoom.com)

---

## ⚙️ Campaign Worker (Vercel)

Campaign cron/manual runs trigger a dedicated worker endpoint. Manual chunked runs are processed sequentially by chaining worker API calls.

Required environment variables:

- `CRON_JOBS_SECRET` — Auth secret for `/api/cron/campaign`
- `CAMPAIGN_JOB_SECRET` — Optional shared secret header (`x-campaign-job-secret`) required by `/api/jobs/campaign`
- `WORKER_API_URL` — Optional base URL used for worker API triggering (falls back to `APP_URL`, `VERCEL_URL`, then request origin)
- `CAMPAIGN_JOB_CHUNK_SIZE` — Optional per-message customer chunk size for manual campaign runs (default: `250`)

Worker endpoint:

- `POST /api/jobs/campaign`

Worker trigger flow:

- `/api/cron/campaign` triggers `RUN_CAMPAIGNS` + `DELETE_EXPIRED_FILES` only when work exists
- `/api/campaigns/{id}/run` triggers `RUN_CAMPAIGNS` for one campaign
- Chunked manual runs upload per-chunk ZIP files, then merge into one final campaign ZIP in `CampaignFile`
- Chunk execution is sequential: chunk 1 triggers chunk 2 only after completion, then chunk 3, and so on

Chunk cleanup API:

- `DELETE /api/campaign-chunks/{jobId}` marks all chunk records for the job as deleted

---

⭐ _If you find UniComm interesting, please consider starring the repository!_
