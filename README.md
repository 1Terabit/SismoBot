<div align="center">
  <img src="./pwa/public/icons/icon-circle.png" alt="SismoBot Logo" width="150"/>
  <h1>SismoBot 🌍⚡</h1>
  <p><strong>A Distributed Seismic Risk Intelligence & Early Warning Platform</strong></p>
  <i>Powered by Multi-Agent AI, Custom DAG Orchestration, and Real Seismology Models</i>
</div>

<br>

**SismoBot** is not just another earthquake notification app. It is a highly advanced, distributed intelligence system designed to ingest raw geological data in real-time, process it through statistical seismology models (Gutenberg-Richter, ETAS), and generate actionable Risk Assessment Bulletins using a swarm of autonomous AI agents. 

Built with **Spec-Driven Development (SDD)**, it bridges the gap between raw data from global seismic networks (USGS, EMSC) and human-readable, critical intelligence.

---

## 🧠 The Brains: Architecture & AI

SismoBot was engineered from the ground up to handle complex asynchronous workflows without relying on standard, heavy workflow engines.

### ⚙️ Custom DAG Engine
At the core of the backend is a proprietary **Directed Acyclic Graph (DAG) Engine**. This engine orchestrates the execution of multiple analytical nodes, ensuring that dependencies (e.g., fetching a localized earthquake catalog before calculating the baseline seismicity rate) are resolved optimally and concurrently.

### 🤖 Multi-Agent AI Swarm
The analytical heavy lifting is delegated to specialized, autonomous agents:
- **b-Value Agent**: Calculates the Gutenberg-Richter *b*-value for a specific tectonic region to determine if tectonic stress is building up or releasing.
- **Seismicity Rate Agent**: Compares real-time seismic frequencies against historical baselines (using z-scores) to detect anomalous swarms.
- **ETAS Forecaster Agent**: Implements the Epidemic-Type Aftershock Sequence (ETAS) model to calculate the exact probability of severe aftershocks within the next 24 hours.
- **Risk Assessor & Editor Agents**: Consolidate the mathematical outputs into a comprehensive, bilingual (EN/ES) PDF Intelligence Bulletin dynamically generated via `pdfmake`.

---

## 🚀 Core Features

### 🗺️ Real-Time Intelligence Dashboard (PWA)
- **Zero-Latency Ingestion**: Hooks directly into USGS and EMSC feeds to plot events globally.
- **Premium UI/UX**: A dark-themed, glassmorphism-inspired Leaflet map. Uses dynamic CSS keyframe animations (like the "scratch-shake" effect and pulsing red shadows) to instantly draw attention to high-risk events.
- **Smart Filtering**: Users can filter the firehose of global data by magnitude thresholds or specific tectonic regions (e.g., LATAM, Ring of Fire, Europe).
- **Automated Onboarding**: Features an interactive, guided tour (`driver.js`) to explain the platform's advanced metrics to new users.

### 🔔 Distributed Notification System
- **Web Push Notifications**: Server-to-browser direct push integration for desktop and mobile users, bypassing the need for native app stores.
- **Telegram Bot (`@Sismove_bot`)**: A resilient, long-polling Telegram interface that delivers instant text alerts and downloadable PDF Bulletins directly to users' phones.

---

## 🛠 Tech Stack

**Backend & Data Science**
- **Runtime**: Node.js (TypeScript)
- **Database**: PostgreSQL (Neon Serverless) with parameterized queries for strict OpSec.
- **Architecture**: Custom DAG Orchestrator, Multi-Agent System.
- **Document Generation**: `pdfmake` for dynamic, on-the-fly intelligence reports.

**Frontend (PWA)**
- **Framework**: React 19 + TypeScript + Vite
- **Mapping**: Leaflet + React-Leaflet
- **Styling**: Custom CSS (Vanilla) optimized for GPU-accelerated animations. No heavy utility frameworks.
- **i18n**: Fully localized (English/Spanish) adapting to the browser's language.

---

## 📦 Getting Started (Local Development)

### 1. Clone the repository
```bash
git clone git@github.com:1Terabit/SismoBot.git
cd SismoBot
```

### 2. Install Dependencies & Run
You will need to set up your `.env` files for both the `bot` and `pwa` directories with your respective database credentials, VAPID keys, and Telegram tokens.

**Backend (Bot):**
```bash
cd bot
pnpm install
pnpm dev
```

**Frontend (PWA):**
```bash
cd ../pwa
pnpm install
pnpm dev
```

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE).

<br>
<div align="center">
  <i>Architected with ❤️ By Anthwam using Spec-Driven Development.</i>
</div>
