# RepoNotebook 📓🔬
> **NotebookLM for GitHub Repositories** — A deep research workspace strictly grounded in a single GitHub repository at a time with citation-backed conversational Q&A, multi-model execution (Gemini 3.7 Flash, 3.5 Flash Lite, 3.1 Flash Lite), 15 automated research artifacts, interactive D3 mindmaps, presentation slide decks, and note synthesis.

---

## 🌟 Core Philosophy: Strict Single-Repo Grounding

Generic AI search tools and broad code assistants frequently suffer from **cross-repository contamination** and **hallucinatory API invention**—citing functions from older versions, third-party libraries not in the project, or non-existent files.

**RepoNotebook enforces an inviolable single-source boundary:**
1. **Zero Cross-Repo Hallucinations**: Every notebook is bound to exactly one GitHub repository and Git ref. If a feature or library is not in the ingested files, the assistant explicitly reports that it does not exist in the repository.
2. **Verifiable Line-Level Citations**: Every claim, code snippet, and architectural explanation includes precise file paths and line ranges (e.g. `[src/vanilla.ts:L34-L58]`), with click-to-view modal inspection and glowing line highlights.
3. **Structured Domain Segregation**: File trees and chunks are classified into five distinct categories: **Code**, **Docs**, **Configs**, **Tests**, and **CI Workflows**.

---

## ⚡ Multi-Model Intelligence (Gemini 3.7 / 3.5 / 3.1)

RepoNotebook includes native in-chat model switching powered by Google's next-generation Gemini family via the official `@google/genai` TypeScript SDK:

| Model | ID | Badge | Primary Strengths | Speed / Latency |
| :--- | :--- | :--- | :--- | :--- |
| **3.7 Flash** | `gemini-3.7-flash` | Flagship Reasoning | Deep architectural breakdowns, complex code logic tracing, refactoring strategy, and multi-file cross-referencing. | Standard Fast |
| **3.5 Flash Lite** | `gemini-3.5-flash-lite` | Balanced | High-efficiency conversational flow, exploratory queries, and rapid follow-up iterations with low latency. | Ultra Fast |
| **3.1 Flash Lite** | `gemini-3.1-flash-lite` | Lightweight | High-throughput quick syntax lookups, interface definitions, configuration lookups, and fast summaries. | Lightning Fast |

> **Model Switcher**: Switch models dynamically anytime from the header model pill dropdown or the quick model selector bar above the chat input box.

---

## 🛠️ Key Features

### 1. High-Density Three-Panel Workspace
- **Collapsible Source Panel (Left)**: Complete file tree navigation, search filter, category toggles (Docs, Code, Config, Test, Workflow), file metrics, and one-click re-indexing. Can be collapsed into a vertical statistics strip to maximize chat room.
- **Grounded Chat Workspace (Center)**: Conversational chat with 5 specialized **Answer Modes** (*Detailed*, *Concise*, *Code Focus*, *Architecture*, *Beginner*), dynamic model selection, suggested starter queries, interactive citations, and a safe **Clear Chat History** action with confirmation popover.
- **Research Studio & Artifacts (Right)**: Library of 15 automated research artifacts, Markdown note-taking editor, pinned citations tray, and AI Briefing Document merger.

### 2. 15 Grounded Research Artifacts
Generate comprehensive, citation-backed documentation with a single click:
- 🧠 **Interactive Mindmap**: Hierarchical SVG visualization rendered via D3 with interactive node expansion and citation tracking.
- 📽️ **Presentation Slideshow**: Keyboard-navigable slide deck (Arrow keys, Spacebar, fullscreen mode) for onboarding or architecture reviews.
- 🏗️ **System Architecture**: High-level component topology, state flow, and data pipelines.
- ⚡ **Public API Surface**: Catalog of exported methods, types, hooks, interfaces, and function signatures.
- 🚀 **Getting Started Guide**: Step-by-step setup, dependencies, and initial build workflow.
- 📖 **Developer Onboarding Manual**: Architecture overview and Day-1 contributor orientation.
- 🧪 **Testing & Quality Report**: Test suite audit, test runners, and mocking strategies.
- ⚠️ **Risks & Rough Edges**: Concurrency risks, deprecations, and performance bottlenecks.
- 🗺️ **Dependency & Package Map**: Comprehensive internal and external dependency audit.
- ❓ **FAQ & Architecture Concepts**: Common questions and conceptual explanations.
- 📂 **Folder Structure Blueprint**: Annotated directory hierarchy and architectural layout.
- 🔄 **Changelog & Release Notes**: High-level version history and breaking changes.
- ⚙️ **CI/CD & Deployment Workflows**: Continuous integration and deployment pipeline audit.
- 📚 **Glossary & Domain Terminology**: Key domain definitions and naming conventions.

### 3. Interactive Note-Taking & AI Synthesis
- **Save as Note**: Save any assistant response or artifact excerpt as an editable note with attached citation links.
- **Tagging & Search**: Organize your findings by custom tags (e.g. `#architecture`, `#security`, `#bug-risk`).
- **Pinned Citations**: Bookmark specific file and line citations into a persistent workspace tray.
- **Merge Notes to Briefing**: Synthesize multiple user notes into a unified executive Briefing Document.

---

## 📐 System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Browser (React 18)                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────┐  │
│  │   Sources Panel   │  │    Chat Panel     │  │   Studio    │  │
│  │  (File Explorer)  │  │ (3.7 / 3.5 / 3.1) │  │  (Artifacts)│  │
│  └─────────┬─────────┘  └─────────┬─────────┘  └──────┬──────┘  │
└────────────┼──────────────────────┼───────────────────┼─────────┘
             │                      │                   │
             ▼                      ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                Full-Stack Backend (Express / Node.js)           │
│  ┌─────────────────────────┐     ┌───────────────────────────┐  │
│  │  GitHub Ingest & Tree   │     │   TF-IDF / Chunk Scorer   │  │
│  │     Parser Engine       │     │   (File Category Aware)   │  │
│  └─────────────────────────┘     └───────────────────────────┘  │
│                                │                                │
│                                ▼                                │
│                  ┌───────────────────────────┐                  │
│                  │  Google GenAI SDK Proxy   │                  │
│                  │    (gemini-3.7-flash,     │                  │
│                  │    gemini-3.5-flash-lite, │                  │
│                  │    gemini-3.1-flash-lite) │                  │
│                  │  + Resilient Retry Engine │                  │
│                  └─────────────┬─────────────┘                  │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                                 ▼
                     Google Gemini API Endpoint
```

---

## 📡 REST API Reference

### `POST /api/repo/ingest`
Ingests a GitHub repository and indexes its contents into semantic chunks.
- **Request Body**:
  ```json
  {
    "repoUrl": "https://github.com/pmndrs/zustand",
    "ref": "main",
    "githubToken": "optional_github_pat_token",
    "pathFilter": "optional/sub/directory"
  }
  ```
- **Response**:
  ```json
  {
    "source": { "name": "zustand", "fullName": "pmndrs/zustand", "primaryLanguage": "TypeScript", ... },
    "files": [ { "path": "src/vanilla.ts", "fileCategory": "code", "lineCount": 115, ... } ],
    "chunks": [ { "filePath": "src/vanilla.ts", "startLine": 1, "endLine": 35, ... } ],
    "suggestedQuestions": [ "How does createStore maintain state immutability?", ... ]
  }
  ```

### `POST /api/repo/query`
Executes grounded Q&A with verifiable file and line citations.
- **Request Body**:
  ```json
  {
    "question": "How does subscribeWithSelector work?",
    "repoSource": { ... },
    "chunks": [ ... ],
    "files": [ ... ],
    "answerMode": "detailed",
    "model": "gemini-3.7-flash"
  }
  ```
- **Response**:
  ```json
  {
    "content": "subscribeWithSelector is implemented in middleware...",
    "citations": [
      {
        "id": "cit-1",
        "filePath": "src/middleware/subscribeWithSelector.ts",
        "startLine": 12,
        "endLine": 45,
        "snippet": "...",
        "fileCategory": "code"
      }
    ],
    "suggestedFollowUps": [ "What are the performance implications of selector equality?", ... ],
    "confidence": "grounded",
    "modelUsed": "gemini-3.7-flash"
  }
  ```

### `POST /api/repo/artifact`
Generates a structured research artifact from repository chunks.
- **Request Body**:
  ```json
  {
    "artifactType": "mindmap",
    "repoSource": { ... },
    "chunks": [ ... ],
    "files": [ ... ]
  }
  ```

### `POST /api/notes/merge`
Merges multiple user notes into a comprehensive executive Briefing Document.

### `GET /api/health`
Returns system status, server uptime, and timestamp.

---

## 🔒 Security & Privacy

- **Server-Side API Key Isolation**: All Gemini API communications occur strictly within the Express server environment via `process.env.GEMINI_API_KEY`. No AI credentials or secret tokens are ever sent to the browser.
- **Zero Cross-Repo Leakage**: Prompt engineering enforces a strict single-repository boundary. The model will refuse questions about external unreferenced libraries.
- **Private Repository Support**: Optional GitHub Personal Access Tokens (PATs) are stored only in the user's browser `localStorage` and sent over HTTPS solely to fetch private repository trees.

---

## 🚀 Getting Started & Local Development

### Prerequisites
- Node.js 18+ or 20+
- `GEMINI_API_KEY` (configured in environment or `.env.example`)

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (Express + Vite on Port 3000)
npm run dev

# 3. Build for production (compiles frontend and bundles server.cjs)
npm run build

# 4. Launch production server
npm start
```

---

