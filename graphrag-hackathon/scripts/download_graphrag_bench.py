import json
import os
from datasets import load_dataset

def main():
    print("Loading GraphRAG-Bench Novel dataset...")
    
    os.makedirs("data/raw", exist_ok=True)
    
    try:
        # Load the novel configuration
        ds = load_dataset("GraphRAG-Bench/GraphRAG-Bench", "novel")
        print("Successfully loaded 'novel' config!")
    except Exception as e:
        print(f"Error loading 'novel' config: {e}")
        print("Trying default config...")
        try:
            ds = load_dataset("GraphRAG-Bench/GraphRAG-Bench")
        except Exception as e2:
            print(f"Error loading default config: {e2}")
            return
            
    print("\nDataset Info:")
    print(ds)
    
    # Save the structure information
    with open("data/raw/dataset_structure.txt", "w", encoding="utf-8") as f:
        f.write(str(ds))
        
    # We will print the first row of the train/validation set to see what fields exist
    # so we know how to split the corpus and QA pairs
    for split_name in ds.keys():
        print(f"\n--- First item in split: {split_name} ---")
        first_item = ds[split_name][0]
        
        # Save a sample to inspect
        with open(f"data/raw/sample_{split_name}.json", "w", encoding="utf-8") as f:
            json.dump(first_item, f, indent=2)
            
        print(f"Keys available: {list(first_item.keys())}")
        
    print("\nCheck data/raw/ directory for the samples.")

if __name__ == "__main__":
    main()
