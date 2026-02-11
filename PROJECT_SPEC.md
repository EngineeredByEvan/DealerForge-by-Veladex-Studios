### DealerForge Build Spec

#### Goal



##### A modern dealership CRM + automation layer that:



* Ingests leads from common sources (AutoTrader, CarGurus, OEM site forms, etc.)



* Tracks customers, activities, tasks, appointments, deals



* Provides manager dashboards + reporting



* Adds AI for: summaries, follow-up drafting, lead scoring, next-best-action, call scripts



* Is modular so new features plug in cleanly



* Non-goals (v1)



* Full DMS replacement (CDK/R\&R)



* Full desking tool replacement



* Accounting, payroll, etc.



##### 1\) Tech Stack (recommended for speed + modular growth)



###### Monorepo (TypeScript)



* Frontend: Next.js (React + TypeScript)



* Backend: NestJS (clean modules) or Fastify (lean). I recommend NestJS.



* DB: PostgreSQL



* ORM: Prisma



* Cache/Queue: Redis + BullMQ



* Realtime: WebSockets (Nest gateway) or SSE for notifications



* Auth: JWT + refresh tokens, RBAC, optional SSO later



* AI: “ai-orchestrator” service that calls OpenAI (later can swap providers)



* Dev/Deploy



* Docker Compose for local dev



* Production: any container host (AWS ECS / Render / Fly / DigitalOcean) — not required for build spec



##### 2\) Architecture Layers (the “clean plug-in” structure)

###### A) UI Layer (Web App)



Role-based UI: Sales | BDC | Finance | Manager | Admin



Pages: Leads, Customers, Tasks, Appointments, Conversations, Deals, Reports, Settings



###### B) API Layer (Application / Domain Modules)



Each domain is its own module:



* Auth + Users



* Tenancy (Rooftops / Auto Group)



* Leads



* Customers



* Vehicles



* Activities + Notes



* Tasks + Workflows



* Appointments



* Conversations (email/SMS logging, templates)



* Reporting



* Integrations (lead sources)



* AI Automation



###### C) Data Layer



* PostgreSQL schema + migrations



* Audit logging table



* Materialized views / reporting tables (optional)



###### D) Integration Layer



* Webhooks (preferred)



* Email parsing ingestion (universal fallback)



* CSV import



* Provider adapters (AutoTrader/Cargurus/OEM etc.)



###### E) Automation Layer



* Job queue workers (follow-up sequences, reminders, nightly syncs)



* Rules engine (simple at first: “if lead age > X and no response → create task”)



###### F) AI Layer



* Extraction + classification



* Summaries



* Drafts (email/SMS)



* Lead score



* Next-best-action suggestions





##### Repo / Folder Structure

dealerforge/

&nbsp; README.md

&nbsp; PROJECT\_SPEC.md

&nbsp; docker-compose.yml

&nbsp; .env.example



&nbsp; apps/

&nbsp;   web/                        # Next.js frontend

&nbsp;     src/

&nbsp;       app/

&nbsp;         (auth)/

&nbsp;         dashboard/

&nbsp;         leads/

&nbsp;         customers/

&nbsp;         tasks/

&nbsp;         appointments/

&nbsp;         deals/

&nbsp;         reports/

&nbsp;         settings/

&nbsp;       components/

&nbsp;       lib/

&nbsp;       styles/

&nbsp;     next.config.js

&nbsp;     package.json



&nbsp;   api/                        # NestJS backend

&nbsp;     src/

&nbsp;       main.ts

&nbsp;       app.module.ts



&nbsp;       common/

&nbsp;         config/

&nbsp;         guards/

&nbsp;         interceptors/

&nbsp;         middleware/

&nbsp;         filters/

&nbsp;         logging/

&nbsp;         utils/



&nbsp;       modules/

&nbsp;         auth/

&nbsp;         users/

&nbsp;         tenancy/

&nbsp;         leads/

&nbsp;         customers/

&nbsp;         vehicles/

&nbsp;         activities/

&nbsp;         tasks/

&nbsp;         appointments/

&nbsp;         conversations/

&nbsp;         deals/

&nbsp;         reports/

&nbsp;         integrations/

&nbsp;         ai/

&nbsp;         notifications/

&nbsp;         audit/



&nbsp;       prisma/

&nbsp;         schema.prisma

&nbsp;         migrations/



&nbsp;     test/

&nbsp;     package.json



&nbsp;   worker/                     # Background jobs (BullMQ)

&nbsp;     src/

&nbsp;       main.ts

&nbsp;       jobs/

&nbsp;         followup-sequences.job.ts

&nbsp;         lead-aging.job.ts

&nbsp;         nightly-reports.job.ts

&nbsp;         integration-sync.job.ts

&nbsp;       processors/

&nbsp;       queues/

&nbsp;     package.json



&nbsp; packages/

&nbsp;   shared/                     # shared types + validators

&nbsp;     src/

&nbsp;       types/

&nbsp;       schemas/                # zod schemas for DTO validation

&nbsp;       constants/

&nbsp;     package.json



&nbsp;   ui/                         # reusable UI components (optional)

&nbsp;     src/

&nbsp;     package.json





##### Core Data Model (Postgres tables)



###### Tenancy / Security



* auto\_groups (Plaza Auto Group)



* dealerships (Woodstock Mazda, etc.)



* users



* user\_dealership\_roles (RBAC + scope)



* CRM Core



* leads



* customers



* vehicles (inventory optional v1, but include customer vehicle interest)



* lead\_sources (AutoTrader, OEM, referral, etc.)



* activities (calls, emails, texts, notes, showroom visit, test drive)



* tasks



* appointments



* deals (lightweight “pipeline deal”, not full desking)



###### Comms / Templates



* message\_threads



* messages



* templates (email/SMS templates, versioned)



* attachments (optional)



* Integrations



* integrations (provider config per dealership)



* integration\_events (raw inbound payloads stored for debugging + replay)



###### Automation + AI



* automation\_rules



* automation\_runs



* ai\_requests (log prompts/outputs metadata safely)



* ai\_summaries (optional cache)



###### Governance



* audit\_logs



* feature\_flags (per dealership / role)



###### Key design rule: almost every table includes:



* dealership\_id (tenant scope)



* timestamps



* created\_by\_user\_id where relevant



##### 5\) Prisma Schema (table fields you should include)



Here are the key fields (Codex should implement in apps/api/src/prisma/schema.prisma):



* leads



* id (uuid)



* dealership\_id



* source\_id



* status: NEW | CONTACTED | APPT\_SET | SHOWED | SOLD | LOST | DEAD



* priority: LOW | MED | HIGH



* customer\_id (nullable until matched/created)



* first\_name, last\_name, email, phone



* preferred\_contact\_method



* vehicle\_interest (year/make/model/trim/free text)



* trade\_in (free text + optional structured later)



* notes (short)



* assigned\_to\_user\_id



* last\_activity\_at



* created\_at, updated\_at



* customers



* id



* dealership\_id



* name fields



* email/phone + “verified” flags



* address (optional)



* tags (array or join table)



* do\_not\_contact flags (CASL)



* created\_at, updated\_at



* activities



* id



* dealership\_id



* lead\_id (nullable)



* customer\_id (nullable)



* type: CALL | EMAIL | SMS | NOTE | VISIT | TEST\_DRIVE | OTHER



* subject



* body



* outcome: LEFT\_VM | REACHED | NO\_ANSWER | REPLIED | etc.



* created\_by\_user\_id



* created\_at



* tasks



* id



* dealership\_id



* lead\_id/customer\_id



* assigned\_to\_user\_id



* title, description



* due\_at



* status: OPEN | DONE | SNOOZED | CANCELED



* created\_at



* appointments



* id



* dealership\_id



* lead\_id/customer\_id



* start\_at, end\_at



* location



* status: SET | CONFIRMED | SHOWED | NO\_SHOW | CANCELED



* created\_at



* integrations + integration\_events



* integrations: id, dealership\_id, provider, config\_json, enabled



* integration\_events: id, integration\_id, received\_at, payload\_json, parsed\_ok, lead\_id



* audit\_logs



* id, dealership\_id, actor\_user\_id, action, entity, entity\_id, metadata\_json, created\_at



##### 6\) API Surface (REST endpoints)



Design as versioned REST: /api/v1/...



###### Auth



* POST /auth/login



* POST /auth/refresh



* POST /auth/logout



* GET /auth/me



###### Tenancy



* GET /dealerships



* GET /dealerships/:id



* POST /dealerships (admin)



* POST /dealerships/:id/users (assign roles)



###### Leads



* GET /leads?status=\&assignedTo=\&source=\&q=\&dateRange=



* POST /leads



* GET /leads/:id



* PATCH /leads/:id



* POST /leads/:id/assign



* POST /leads/:id/status



* POST /leads/:id/convert-to-customer



* POST /leads/:id/activities (log call/email/note)



###### Customers



* GET /customers?q=\&tag=\&dateRange=



* POST /customers



* GET /customers/:id



* PATCH /customers/:id



* GET /customers/:id/timeline (activities + messages + tasks + appts)



###### Tasks



* GET /tasks?assignedTo=\&status=\&dueRange=



* POST /tasks



* PATCH /tasks/:id



* POST /tasks/:id/complete



* POST /tasks/:id/snooze



###### Appointments



* GET /appointments?range=



* POST /appointments



* PATCH /appointments/:id



* POST /appointments/:id/confirm



* POST /appointments/:id/cancel



###### Conversations (logging + templates; sending can be Phase 2)



* GET /threads?leadId=\&customerId=



* GET /threads/:id/messages



* POST /threads/:id/messages (log)



* GET /templates



* POST /templates



* PATCH /templates/:id



###### Reporting (v1: simple KPI endpoints)



* GET /reports/overview (today/week/month: leads, appts, shows, sold)



* GET /reports/salesperson (conversion funnel)



* GET /reports/source (source ROI proxy)



* GET /reports/response-time (avg first response)



###### Integrations (lead ingest)



* POST /integrations (admin)



* GET /integrations



* POST /integrations/:id/test



* POST /integrations/:provider/webhook (public endpoint w/ secret)



* POST /integrations/import/csv



###### AI Automation



* POST /ai/lead/summary (leadId)



* POST /ai/lead/score (leadId)



* POST /ai/lead/draft-followup (leadId, channel, tone)



* POST /ai/thread/summarize (threadId)



* POST /ai/next-best-action (leadId)



###### Notifications (realtime)



* GET /notifications



* WS /ws (task assigned, new lead, appt updates)



##### 7\) Background Jobs / Queues (Worker app)



###### Use BullMQ queues:



* lead\_ingest\_queue



* parse inbound payload → normalize → upsert lead/customer → assign → notify



* automation\_queue



* lead aging rules: “if NEW and no activity in 15 min → create task”



* follow-up sequences: day 0, day 1, day 3, day 7



* ai\_queue



* async summaries + scoring so UI feels instant



* cache AI outputs, update lead metadata



* reporting\_queue



* nightly rollups for fast dashboards (optional)



##### 8\) Integrations Strategy (how you actually match TMS)



Important reality: some providers don’t give open APIs unless you’re a certified partner.



So design integrations in tiers:



###### Tier 1 (Universal, do this first)



Webhook ingestion (for sources that support it)



Email lead ingestion (IMAP mailbox + parser)



Many lead sources deliver leads via email.



CSV import (manager can import exported leads)



This gets you live quickly without waiting on partner approvals.



###### Tier 2 (Provider adapters)



Create an interface:



* IntegrationAdapter



* validateConfig()



* parseInbound(payload | email)



* normalizeToLeadDTO()



* verifySignature() (webhooks)



* healthCheck()



Adapters:



* autotrader.adapter.ts



* cargurus.adapter.ts



* oem\_form.adapter.ts (Mazda.ca style forms)



* referral.adapter.ts



Also store raw payload always in integration\_events so you can replay parsing.



##### 9\) AI Automation Layer

AI capabilities you ship first (high ROI)



###### Lead Summary



“What’s going on, what do they want, key constraints, next step”



###### Lead Score



output 0–100 + reasons (e.g., “ready to buy”, “trade mentioned”, “payment focused”)



###### Follow-up Draft



generate an email/SMS in your dealership voice



uses lead + vehicle interest + prior messages



###### Next Best Action



“Call now”, “Send payment options”, “Book appointment”, “Ask trade details”



###### AI module files



* apps/api/src/modules/ai/



* ai.module.ts



* ai.controller.ts



* ai.service.ts (orchestrator)



prompts/



* lead\_summary.prompt.ts



* lead\_score.prompt.ts



* draft\_followup.prompt.ts



* next\_best\_action.prompt.ts



* ai.types.ts



* ai.safety.ts (redaction + logging rules)



* ai.cache.ts (optional)



Key rule: do not store raw PII in ai\_requests logs. Store references + redacted snippets.



##### 10\) Frontend Pages + Components

###### Pages



* /dashboard (KPIs + quick queues)



* /leads (table + filters + “new lead” drawer)



* /leads/\[id] (timeline + AI panel + tasks + appointment)



* /customers + /customers/\[id]



* /tasks



* /appointments



* /reports



* /settings/integrations



* /settings/users



###### Core UI Components



* LeadTable, LeadFilters, LeadStatusBadge



* LeadTimeline (activities/messages/tasks)



* AIPanel (summary, score, draft, NBA)



* TaskDrawer



* AppointmentModal



* ReportCards + charts



##### 11\) “Controlled Growth” Build Order

###### Phase 0 — Scaffolding



* Monorepo, Docker Compose (Postgres + Redis)



* Prisma migrations



* Auth + RBAC



* Dealership tenancy



###### Phase 1 — CRM Core



* Leads CRUD + assignment + status



* Activities logging



* Tasks + appointments



* Basic reporting overview



* Notifications (new lead/task assigned)



###### Phase 2 — Ingestion



* Integration module



* Webhook endpoint + secrets



* Email ingestion worker (IMAP)



* CSV import



###### Phase 3 — AI Automation



* AI lead summary + score



* Follow-up drafting



* Next-best-action



* Automation rules that create tasks and suggestions



###### Phase 4 — Plaza Auto Group rollout



* Multi-rooftop admin controls



* Cross-store reporting



* Feature flags per rooftop
