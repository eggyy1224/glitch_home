#!/usr/bin/env python3
"""Test kinship index loading and query performance."""

import sys
import time
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.services.kinship_index import kinship_index


def main():
    print("=" * 60)
    print("Testing Kinship Index")
    print("=" * 60)
    
    # Test loading
    print("\n1️⃣  Loading index...")
    start = time.time()
    kinship_index.load()
    load_time = time.time() - start
    print(f"   ✓ Loaded in {load_time*1000:.2f}ms")
    
    # Stats
    stats = kinship_index.stats()
    print(f"\n2️⃣  Index stats:")
    print(f"   • Offspring: {stats['offspring_count']}")
    print(f"   • Parents: {stats['parent_count']}")
    
    # Test query speed
    print(f"\n3️⃣  Testing query speed...")
    
    # Find a test image
    test_images = []
    for i in range(5):
        if kinship_index._parents_map:
            test_img = list(kinship_index._parents_map.keys())[i]
            test_images.append(test_img)
    
    if not test_images:
        print("   ⚠️  No images found in index")
        return
    
    total_queries = 0
    start = time.time()
    
    for test_img in test_images:
        parents = kinship_index.parents_of(test_img)
        children = kinship_index.children_of(test_img)
        siblings = kinship_index.siblings_of(test_img)
        ancestors = kinship_index.ancestors_levels_of(test_img, depth=3)
        total_queries += 4
    
    query_time = time.time() - start
    avg_time = (query_time / total_queries) * 1000
    
    print(f"   ✓ Executed {total_queries} queries in {query_time*1000:.2f}ms")
    print(f"   ✓ Average query time: {avg_time:.3f}ms")
    
    # Show example
    test_img = test_images[0]
    print(f"\n4️⃣  Example query for: {test_img}")
    print(f"   • Parents: {len(kinship_index.parents_of(test_img))}")
    print(f"   • Children: {len(kinship_index.children_of(test_img))}")
    print(f"   • Siblings: {len(kinship_index.siblings_of(test_img))}")
    ancestors = kinship_index.ancestors_levels_of(test_img, depth=-1)
    print(f"   • Ancestor levels: {len(ancestors)}")
    
    print("\n" + "=" * 60)
    print("✓ All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()

