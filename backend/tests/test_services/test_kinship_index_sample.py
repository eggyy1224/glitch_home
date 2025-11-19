"""Deterministic kinship index tests built on synthetic metadata."""

from app.services.kinship_index import kinship_index


def test_kinship_index_relationships(kinship_sample_dataset):
    primary = kinship_sample_dataset["primary_child"]
    sibling = kinship_sample_dataset["sibling"]
    parent_a = kinship_sample_dataset["parent_a"]
    parent_b = kinship_sample_dataset["parent_b"]
    grandchild = kinship_sample_dataset["grandchild"]
    ancestor = kinship_sample_dataset["ancestor"]

    assert kinship_index.parents_of(primary) == [parent_a, parent_b]
    assert kinship_index.parents_of(grandchild) == [primary]

    assert kinship_index.children_of(parent_a) == [primary, sibling]
    assert kinship_index.children_of(parent_b) == [primary]

    assert kinship_index.siblings_of(primary) == [sibling]
    assert kinship_index.siblings_of(grandchild) == []

    ancestors = kinship_index.ancestors_levels_of(grandchild, depth=3)
    assert ancestors == [
        [primary],
        [parent_a, parent_b],
        [ancestor],
    ]


def test_kinship_index_depth_and_cache_reload(kinship_sample_dataset):
    grandchild = kinship_sample_dataset["grandchild"]
    primary = kinship_sample_dataset["primary_child"]
    ancestor = kinship_sample_dataset["ancestor"]

    first_level = kinship_index.ancestors_levels_of(grandchild, depth=1)
    assert first_level == [[primary]]

    kinship_index._loaded = False
    kinship_index._parents_map = {}
    result = kinship_index.parents_of(primary)
    assert result == sorted([kinship_sample_dataset["parent_a"], kinship_sample_dataset["parent_b"]])

    infinite_levels = kinship_index.ancestors_levels_of(grandchild, depth=-1)
    assert infinite_levels[-1] == [ancestor]


def test_kinship_index_stats_and_flags(kinship_sample_dataset):
    stats = kinship_index.stats()
    assert stats["offspring_count"] == 4
    assert stats["parent_count"] == 4
    assert stats["index_exists"] is True
    assert stats["index_path"].endswith("kinship_index.json")

    assert kinship_index.has_offspring(kinship_sample_dataset["primary_child"]) is True
    assert kinship_index.has_offspring("missing.png") is False
