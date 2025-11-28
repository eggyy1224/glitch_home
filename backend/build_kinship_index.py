#!/usr/bin/env python3
"""Build kinship index from metadata.

Run this script to build/rebuild the kinship index:
    python backend/build_kinship_index.py
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.services.kinship_index import kinship_index


def main():
    print("=" * 60)
    print("Building Kinship Index")
    print("=" * 60)
    
    result = kinship_index.build_and_save()
    
    print("\n" + "=" * 60)
    print("✓ Build Complete!")
    print("=" * 60)
    print(f"  Offspring count: {result['offspring_count']}")
    print(f"  Parent count: {result['parent_count']}")
    print(f"  Metadata processed: {result['metadata_count']}")
    print(f"  Index saved to: {result['index_path']}")
    print()


if __name__ == "__main__":
    main()

