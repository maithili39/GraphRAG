# How to Run the GraphRAG Hackathon Project

## What's in this project

Three retrieval pipelines compared side-by-side:

| Pipeline | Strategy | Notes |
|----------|----------|-------|
| Pipeline 1 — LLM-Only | Raw Groq call, no retrieval | Baseline |
| Pipeline 2 — Basic RAG | FAISS top-5 → Groq | ~1,400 tokens/query |
| Pipeline 3 — GraphRAG | FAISS seed + Neo4j hybrid graph expansion → Groq | ~150–300 tokens/query |

A React dashboard (port 5173) lets you query all three at once and see token/accuracy comparisons.

---

## Prerequisites

- Python 3.10+
- Docker Desktop (running)
- Node.js 18+ (for frontend)
- A `.env` file in `graphrag-hackathon/` with at least:
  ```env
  GROQ_API_KEY=gsk_...
  GEMINI_API_KEY=AIza...
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=graphrag1234
  ```

---

## Running the project (Full Setup)

### Step 1 — Install Dependencies
From `graphrag-hackathon/`:
```bash
pip install -r api/requirements.txt
```

### Step 2 — Start Neo4j via Docker
```powershell
docker run -d --name neo4j-graphrag -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/graphrag1234 -e NEO4J_PLUGINS='["apoc"]' neo4j:5.20
```

### Step 3 — Initialize Neo4j Schema
Wait a few seconds for Neo4j to boot, then run:
```bash
python scripts/setup_neo4j.py
```

### Step 4 — Ingest Data into Neo4j
*(If the database is empty)*
```bash
python scripts/ingest_neo4j.py
```
*Note: This takes 1-2 hours for the full Wikipedia dataset, but it is fully resumable if interrupted.*

### Step 5 — Start API + Frontend

**Terminal 1 — API server** (from `graphrag-hackathon/`)
```bash
uvicorn api.app:app --reload --port 8080
```

**Terminal 2 — Frontend** (from `graphrag-hackathon/frontend/`)
```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Running the evaluation

From `graphrag-hackathon/`:
```bash
python eval/evaluate.py
```

Runs 50 QA pairs through all three pipelines, judges each answer (PASS/FAIL), computes BERTScore, and writes results to `eval/results/eval_results.csv`.

---

## Project structure

```text
graphrag-hackathon/
├── api/
│   ├── app.py                  # FastAPI — POST /compare
│   └── requirements.txt
├── data/
│   ├── raw/                    # downloaded Wikipedia articles
│   ├── chunks/                 # FAISS index + pickled chunks
│   └── qa/qa_pairs.json        # 50 QA pairs for evaluation
├── eval/
│   ├── evaluate.py             # full evaluation script
│   └── results/eval_results.csv
├── frontend/                   # React + Recharts dashboard
├── pipelines/
│   ├── pipeline1_llm.py        # LLM-only
│   ├── pipeline2_rag.py        # FAISS RAG
│   ├── pipeline3_graphrag.py   # Neo4j hybrid graph retrieval
│   └── utils.py                # Groq client, token counting, cost calc
└── scripts/
    ├── download_dataset.py
    ├── preprocess.py
    ├── build_faiss.py
    ├── generate_qa_pairs.py
    ├── setup_neo4j.py          # Create Neo4j constraints/indexes
    └── ingest_neo4j.py         # Extract entities + write to Neo4j
```
