from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

URI      = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER     = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "graphrag1234")

def setup(driver):
    with driver.session() as s:
        # Constraints
        s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE")
        s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE")
        s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE")
        
        # Vector index for hybrid retrieval (384-dim, cosine)
        s.run("""
            CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS
            FOR (c:Chunk) ON (c.embedding)
            OPTIONS {indexConfig: {
                `vector.dimensions`: 384,
                `vector.similarity_function`: 'cosine'
            }}
        """)
        print("Schema created: constraints + vector index")

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
setup(driver)
driver.close()
