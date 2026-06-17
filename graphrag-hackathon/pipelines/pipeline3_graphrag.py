"""
Pipeline 3 — GraphRAG via Neo4j
Retrieval: FAISS seed → Neo4j entity graph expansion → compact context → Groq answer
"""
import os, pickle, time, logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
from pipelines.utils import count_tokens, groq_generate, make_result, setup_groq

logger = logging.getLogger(__name__)
_ROOT = Path(__file__).parent.parent.resolve()

# Lazy-loaded singletons
_embedder    = None
_driver      = None
_chunks      = None
_groq_client = None


def _load():
    global _embedder, _driver, _chunks, _groq_client
    if _embedder is None:
        import faiss
        from fastembed import TextEmbedding
        from neo4j import GraphDatabase
        
        _embedder = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
        _chunks   = pickle.load(open(str(_ROOT / 'data/chunks/chunks.pkl'), 'rb'))
        _driver   = GraphDatabase.driver(
            os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            auth=(os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "graphrag1234"))
        )
        _groq_client = setup_groq()


def _embed(text: str):
    import numpy as np
    emb = list(_embedder.embed([text]))[0]
    emb = np.array(emb, dtype=np.float32)
    emb /= (np.linalg.norm(emb) + 1e-10)
    return emb.tolist()


def _neo4j_retrieve(question: str) -> list[str]:
    """
    Hybrid retrieval:
      1. Vector similarity → top-3 seed Chunks
      2. Graph traversal → Entity facts from seed chunks
      3. ENTITY_COREF → related chunks in other articles
    Returns compact entity facts (~15 tokens each vs ~256 for raw chunks)
    """
    query_emb = _embed(question)
    
    cypher = """
        // Step 1: Vector search — find 3 most relevant chunks
        CALL db.index.vector.queryNodes('chunk_embeddings', 3, $queryEmb)
        YIELD node AS seedChunk, score

        // Step 2: Traverse to entity facts from seed chunks
        OPTIONAL MATCH (seedChunk)-[:HAS_ENTITY]->(e:Entity)

        // Step 3: ENTITY_COREF — find same entity in other chunks
        OPTIONAL MATCH (e)-[:ENTITY_COREF]->(corefEntity:Entity)

        // Collect all relevant facts
        WITH seedChunk, 
             collect(DISTINCT e.fact) AS directFacts,
             collect(DISTINCT corefEntity.fact) AS corefFacts,
             score

        RETURN seedChunk.text AS chunkText,
               directFacts,
               corefFacts,
               score
        ORDER BY score DESC
        LIMIT 3
    """
    
    results = []
    try:
        with _driver.session() as session:
            records = session.run(cypher, queryEmb=query_emb)
            for rec in records:
                # Add entity facts first (compact — ~15 tokens each)
                for fact in (rec["directFacts"] or []):
                    if fact and fact.strip():
                        results.append(fact.strip())
                for fact in (rec["corefFacts"] or []):
                    if fact and fact.strip() and fact not in results:
                        results.append(fact.strip())
                # Add seed chunk text as fallback context
                if rec["chunkText"]:
                    results.append(rec["chunkText"].strip())
    except Exception as e:
        logger.warning("Neo4j retrieval error: %s — falling back to empty", e)
    
    return results


def pipeline3(question: str) -> dict:
    _load()
    t_start = time.time()

    contexts = _neo4j_retrieve(question)

    # Token-budget merge: prefer entity facts (compact) over raw chunks
    context_parts = []
    token_budget  = 420
    for ctx in contexts:
        tok = count_tokens(ctx)
        if tok <= token_budget:
            context_parts.append(ctx)
            token_budget -= tok
        if token_budget <= 0:
            break

    context = "\n\n---\n\n".join(context_parts) if context_parts else "No context retrieved."
    prompt  = (
        f"Context:\n{context}\n\n"
        f"Question: {question}\n"
        f"Answer (1-2 sentences, precise facts only):"
    )
    answer  = groq_generate(_groq_client, prompt, max_tokens=120)
    latency = round(time.time() - t_start, 3)

    result = make_result("graphrag", answer, count_tokens(prompt), count_tokens(answer), latency)
    result["retriever"]      = "neo4j_hybrid_graph"
    result["context_tokens"] = count_tokens(context)
    result["graph_hops"]     = 2
    result["service"]        = "Neo4j"
    return result
