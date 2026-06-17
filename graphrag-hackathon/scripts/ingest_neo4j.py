import json
import os
import pickle
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase
import numpy as np
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
from pipelines.utils import setup_groq

load_dotenv()

URI      = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER     = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "graphrag1234")

# ── Extraction config ─────────────────────────────────────────────────────────
CHUNKS_PER_BATCH  = 5    # chunks per Groq call
FACTS_PER_CHUNK   = 3    # entity facts to extract per chunk
PROGRESS_FILE     = Path('data/neo4j_progress.json')
GROQ_RETRY_WAIT   = 35   # seconds to wait on 429

EXTRACT_PROMPT = """\
For each chunk below, extract exactly {n} key entity facts.
Rules:
- Each fact must name a specific entity (person, place, event, concept, organization).
- Each fact must be a single sentence, max 20 words.
- Facts must be self-contained (reader needs no other context to understand them).
- Output ONLY valid JSON — no markdown, no explanation.

Output format:
{{"results": [{{"chunk_id": "<id>", "facts": [{{"name": "<entity>", "fact": "<sentence>"}}]}}]}}

Chunks:
{chunks}"""

def extract_batch(client, batch: list[dict]) -> dict[str, list[dict]]:
    """Call Groq for a batch of chunks. Returns {chunk_id: [{name, fact}, ...]}."""
    chunks_text = '\n'.join(
        f'[{c["id"]}] {c["text"][:400]}'
        for c in batch
    )
    prompt = EXTRACT_PROMPT.format(n=FACTS_PER_CHUNK, chunks=chunks_text)

    for attempt in range(5):
        try:
            response = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0.0,
                max_tokens=800,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            parsed = json.loads(raw)
            result = {}
            for item in parsed.get('results', []):
                cid = item.get('chunk_id', '')
                result[cid] = item.get('facts', [])
            return result
        except json.JSONDecodeError:
            print(f'  [warn] JSON parse failed on attempt {attempt + 1}')
            if attempt == 4:
                return {}
        except Exception as e:
            if ('429' in str(e) or 'rate' in str(e).lower()) and attempt < 4:
                wait = GROQ_RETRY_WAIT * (attempt + 1)
                print(f'  [rate limit] waiting {wait}s...')
                time.sleep(wait)
            else:
                print(f'  [error] {e}')
                return {}
    return {}

def normalize_name(name: str) -> str:
    return re.sub(r'\s+', '_', name.strip().lower())

def ingest_to_neo4j(driver, chunks_with_entities):
    """Write a batch of chunks + entities to Neo4j"""
    cypher = """
    UNWIND $batch AS data
    
    // Create Article
    MERGE (a:Article {id: data.doc_id})
    ON CREATE SET a.title = data.source
    
    // Create Chunk
    MERGE (c:Chunk {id: data.id})
    ON CREATE SET 
        c.text = data.text,
        c.chunk_index = data.chunk_index,
        c.source = data.source,
        c.doc_id = data.doc_id,
        c.embedding = data.embedding
        
    MERGE (a)-[:HAS_CHUNK]->(c)
    
    // Next chunk link
    FOREACH (nid IN CASE WHEN data.next_id IS NOT NULL THEN [data.next_id] ELSE [] END |
        MERGE (nc:Chunk {id: nid})
        MERGE (c)-[:NEXT_CHUNK]->(nc)
    )
    
    // Entities
    FOREACH (ent IN data.entities |
        MERGE (e:Entity {id: ent.id})
        ON CREATE SET 
            e.name = ent.name,
            e.fact = ent.fact,
            e.chunk_id = data.id,
            e.normalized_name = ent.norm_name
            
        MERGE (c)-[:HAS_ENTITY]->(e)
    )
    """
    
    # Second cypher for COREF edges
    coref_cypher = """
    UNWIND $batch AS data
    UNWIND data.entities AS ent
    
    MATCH (e1:Entity {id: ent.id})
    MATCH (e2:Entity {normalized_name: ent.norm_name})
    WHERE e1.id <> e2.id
    MERGE (e1)-[:ENTITY_COREF]-(e2)
    """
    
    with driver.session() as session:
        session.run(cypher, batch=chunks_with_entities)
        session.run(coref_cypher, batch=chunks_with_entities)


def main():
    print('Loading chunks...')
    chunks_raw = pickle.load(open('data/chunks/chunks.pkl', 'rb'))
    print(f'  {len(chunks_raw)} chunks loaded')
    
    # Add next_id to chunks
    by_doc = defaultdict(list)
    for c in chunks_raw:
        by_doc[c['doc_id']].append(c)
        
    chunks = []
    for doc_id, doc_chunks in by_doc.items():
        doc_chunks_sorted = sorted(doc_chunks, key=lambda c: int(c['id'].split('_c')[-1]))
        for i, c in enumerate(doc_chunks_sorted):
            c['chunk_index'] = i
            c['next_id'] = doc_chunks_sorted[i + 1]['id'] if i + 1 < len(doc_chunks_sorted) else None
            chunks.append(c)

    done_ids = set()
    if PROGRESS_FILE.exists():
        done_ids = set(json.loads(PROGRESS_FILE.read_text()))
        print(f'  Resuming — {len(done_ids)} chunks already processed')

    remaining = [c for c in chunks if c['id'] not in done_ids]
    print(f'  {len(remaining)} chunks to process')

    if not remaining:
        print('All chunks already processed.')
        return

    print("Loading FastEmbed...")
    from fastembed import TextEmbedding
    embedder = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")

    client = setup_groq()
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

    batches = [remaining[i:i + CHUNKS_PER_BATCH] for i in range(0, len(remaining), CHUNKS_PER_BATCH)]
    
    neo4j_batch = []
    
    for batch in tqdm(batches, desc='Processing chunks', unit='batch'):
        extracted = extract_batch(client, batch)
        
        texts = [c['text'] for c in batch]
        embs = list(embedder.embed(texts))

        for idx, chunk in enumerate(batch):
            cid = chunk['id']
            facts = extracted.get(cid, [])
            
            # Normalize embedding
            emb = np.array(embs[idx], dtype=np.float32)
            emb = emb / (np.linalg.norm(emb) + 1e-10)
            chunk['embedding'] = emb.tolist()
            
            entities = []
            for e_idx, item in enumerate(facts[:FACTS_PER_CHUNK]):
                name = item.get('name', '').strip()
                fact = item.get('fact', '').strip()
                if name and fact:
                    entities.append({
                        'id': f'{cid}_e{e_idx}',
                        'name': name,
                        'fact': fact,
                        'norm_name': normalize_name(name)
                    })
            chunk['entities'] = entities
            
            neo4j_batch.append(chunk)
            done_ids.add(cid)
            
        if len(neo4j_batch) >= 50:
            ingest_to_neo4j(driver, neo4j_batch)
            PROGRESS_FILE.write_text(json.dumps(list(done_ids)))
            neo4j_batch = []

    if neo4j_batch:
        ingest_to_neo4j(driver, neo4j_batch)
        PROGRESS_FILE.write_text(json.dumps(list(done_ids)))

    driver.close()
    print('Done.')

if __name__ == '__main__':
    os.chdir(Path(__file__).parent.parent)
    main()
