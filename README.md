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

## ⚙️ External Campaign Worker (Vercel)

Campaign cron/manual runs are queued to an external queue and executed by a dedicated worker endpoint for improved reliability on serverless.

Required environment variables:

- `CRON_JOBS_SECRET` — Auth secret for `/api/cron/campaign`
- `QSTASH_TOKEN` — Upstash QStash token used to publish jobs
- `QSTASH_CURRENT_SIGNING_KEY` — Upstash signing key for request verification
- `QSTASH_NEXT_SIGNING_KEY` — Upstash next signing key for key rotation
- `QSTASH_WORKER_URL` — Public base URL for worker callbacks (recommended, e.g. `https://your-app.vercel.app`)

Worker endpoint:

- `POST /api/jobs/campaign`

Queue flow:

- `/api/cron/campaign` enqueues `RUN_CAMPAIGNS` + `DELETE_EXPIRED_FILES`
- `/api/campaigns/{id}/run` enqueues `RUN_CAMPAIGNS` for one campaign
- Worker verifies QStash signatures and returns non-2xx on failure so QStash retries

Notes:

- QStash cannot call `localhost`/loopback addresses. For local testing, use a public tunnel URL in `QSTASH_WORKER_URL`.

---

⭐ _If you find UniComm interesting, please consider starring the repository!_
