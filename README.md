# FirBook (Kütüphane)

![FirBook Dashboard](docs/dashboard.png)

FirBook is a modern, web-based, AI-powered library management system. It provides a comprehensive solution for organizing your physical books and digital library (EPUB/PDF), complete with social features and AI integrations.

## 🚀 Key Features

- **Modern Dashboard**: Get a bird's-eye view of your library with statistics on total books, read books, e-books, and active loans.
- **Smart Book Search & Meta-Scraping**: Add books effortlessly by ISBN or Title/Author. The intelligent meta-scraper gathers metadata (cover, author, page count) from multiple sources without relying on fragile site-specific scrapers.
- **E-Book & Digital Library**: Seamlessly upload or link EPUB and PDF files. Books are automatically categorized as e-books based on assigned digital shelves or uploaded files.
- **AI Reading Companion (RAG)**: Chat with your books! The AI Reading Companion uses Retrieval-Augmented Generation (RAG) to let you ask questions and discuss contents directly from your uploaded documents.
- **Pluggable AI Provider**: Works out of the box with a local model (Llama 3.2 3B, GGUF). Optionally, each user can plug in their own **Claude API key** (Anthropic Haiku) in Settings to run translation, OCR correction, summarization, chat and debates faster and more accurately.
- **Translation**: Translate any text between languages using the active AI provider.
- **Social & Community**: Engage in "Forum Groups" and "AI Debates" to discuss literature, share insights, and interact with an intelligent knowledge base.
- **Advanced Organization**: Custom shelves, tags, reading status tracking, and more.

## 🛠 Tech Stack

- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **AI & Scraping**: DuckDuckGo Search (Meta-Search), LLM integrations for RAG and Summarization.
- **Infrastructure**: Docker & Docker Compose

## 📦 Quick Start (Development)

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🐳 Docker Deployment

The easiest way to run FirBook in production is via Docker Compose:

```bash
docker compose up -d --build
```

## 🔐 Default Access

- **Frontend**: `http://localhost`
- **API**: `http://localhost/api`
- **API Docs**: `http://localhost/api/docs`

*Note: The first registered user automatically becomes the administrator.*

## 🤖 AI Providers (Local vs. Claude)

FirBook defaults to a **local AI model** (Llama 3.2 3B via `llama-cpp-python`) — no API key required. Every AI task (translation, OCR correction, summarization, book chat, knowledge-hub Q&A/reports, debates) is routed through a single provider abstraction.

If a user wants faster and more accurate results, they can add their **own Anthropic Claude API key**:

1. Go to **Ayarlar → Yapay Zeka** (Settings → AI).
2. Select **Claude API**, paste your key (`sk-ant-...`), optionally set the model (default `claude-3-5-haiku-latest`).
3. Click **Bağlantıyı Test Et** (Test Connection), then **Kaydet** (Save).

Notes:
- **Local remains the default.** The Claude key is strictly opt-in per user.
- The API key is **encrypted at rest** (Fernet, derived from `SECRET_KEY`) and never returned in plain text; the UI shows only a masked value.
- Select **Yerel Model** or click **Anahtarı Sil** to switch back to the local model.
- `.env` options: `CLAUDE_DEFAULT_MODEL`, `CLAUDE_API_KEY` (optional global fallback), `CLAUDE_API_BASE`, `CLAUDE_MAX_TOKENS`.

### Translation API

`POST /api/translate`

```json
{ "text": "Hello world", "target_lang": "Türkçe", "source_lang": "en" }
```

Returns `{ "translation": "...", "target_lang": "Türkçe" }`, using the caller's active AI provider.

## 🗄 Data Migration (SQLite -> PostgreSQL)

If you are migrating from an older SQLite setup:
```bash
# Ensure PostgreSQL is running and tables are created
cd backend
python migrate_data.py
```
