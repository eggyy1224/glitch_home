"""Tests for kinship index service."""

import pytest
from app.services.kinship_index import kinship_index


@pytest.mark.slow
def test_kinship_index_loads():
    """Test that kinship index loads successfully."""
    kinship_index.load()
    stats = kinship_index.stats()
    assert stats['offspring_count'] >= 0
    assert stats['parent_count'] >= 0


@pytest.mark.slow
def test_kinship_index_load_performance():
    """Test kinship index load performance."""
    import time
    
    start = time.time()
    kinship_index.load()
    load_time = time.time() - start
    
    # Should load in reasonable time (< 1 second)
    assert load_time < 1.0, f"Index load took {load_time*1000:.2f}ms, expected < 1000ms"


@pytest.mark.slow
def test_kinship_index_query_functions():
    """Test kinship index query functions."""
    kinship_index.load()
    
    # Find a test image
    if not kinship_index._parents_map:
        pytest.skip("No images found in index")
    
    test_img = list(kinship_index._parents_map.keys())[0]
    
    # Test parents_of
    parents = kinship_index.parents_of(test_img)
    assert isinstance(parents, list)
    
    # Test children_of
    children = kinship_index.children_of(test_img)
    assert isinstance(children, list)
    
    # Test siblings_of
    siblings = kinship_index.siblings_of(test_img)
    assert isinstance(siblings, list)
    
    # Test ancestors_levels_of - returns List[List[str]]
    ancestors = kinship_index.ancestors_levels_of(test_img, depth=3)
    assert isinstance(ancestors, list)
    
    # Test with full depth
    ancestors_full = kinship_index.ancestors_levels_of(test_img, depth=-1)
    assert isinstance(ancestors_full, list)


@pytest.mark.slow
def test_kinship_index_query_performance():
    """Test kinship index query performance."""
    kinship_index.load()
    
    # Find test images
    if not kinship_index._parents_map:
        pytest.skip("No images found in index")
    
    test_images = []
    for i in range(min(5, len(kinship_index._parents_map))):
        test_img = list(kinship_index._parents_map.keys())[i]
        test_images.append(test_img)
    
    if not test_images:
        pytest.skip("No test images available")
    
    import time
    total_queries = 0
    start = time.time()
    
    for test_img in test_images:
        kinship_index.parents_of(test_img)
        kinship_index.children_of(test_img)
        kinship_index.siblings_of(test_img)
        kinship_index.ancestors_levels_of(test_img, depth=3)
        total_queries += 4
    
    query_time = time.time() - start
    avg_time = (query_time / total_queries) * 1000
    
    # Average query should be fast (< 10ms)
    assert avg_time < 10.0, f"Average query time: {avg_time:.3f}ms, expected < 10ms"


@pytest.mark.slow
def test_kinship_index_has_offspring():
    """Test has_offspring method."""
    kinship_index.load()
    
    if not kinship_index._parents_map:
        pytest.skip("No images found in index")
    
    test_img = list(kinship_index._parents_map.keys())[0]
    assert kinship_index.has_offspring(test_img) is True
    
    # Test with non-existent image
    assert kinship_index.has_offspring("non_existent_image.png") is False


@pytest.mark.slow
def test_kinship_index_stats():
    """Test kinship index stats method."""
    kinship_index.load()
    stats = kinship_index.stats()
    
    assert 'offspring_count' in stats
    assert 'parent_count' in stats
    assert isinstance(stats['offspring_count'], int)
    assert isinstance(stats['parent_count'], int)
    assert stats['offspring_count'] >= 0
    assert stats['parent_count'] >= 0

