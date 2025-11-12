from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..services.kinship_index import kinship_index

router = APIRouter()


@router.get("/api/kinship")
def api_kinship(
    img: str = Query(..., description="offspring 檔名（含副檔名）"),
    depth: int = Query(1, ge=-1, description="祖先追溯層數；-1 代表窮盡直到無父母"),
) -> dict:
    if not kinship_index.has_offspring(img):
        raise HTTPException(status_code=404, detail="image metadata not found")

    def exists_in_offspring(name: str) -> bool:
        path = os.path.join(settings.offspring_dir, name)
        return os.path.isfile(path)

    def filter_existing(names: set[str] | list[str]) -> list[str]:
        return sorted([n for n in names if exists_in_offspring(n)])

    parents = set(kinship_index.parents_of(img))
    children = set(kinship_index.children_of(img))
    siblings = set(kinship_index.siblings_of(img))

    parents = set(filter_existing(parents))
    children = set(filter_existing(children))
    siblings = set(filter_existing(siblings))
    related = sorted(parents | children | siblings)

    graph_nodes: dict[str, dict] = {}
    graph_edges: set[tuple[str, str]] = set()

    priority_order = {
        "original": 0,
        "parent": 1,
        "child": 1,
        "sibling": 2,
        "ancestor": 3,
    }

    def add_node(name: str, kind: str, level: int) -> None:
        if not exists_in_offspring(name):
            return
        current = graph_nodes.get(name)
        if current is None:
            graph_nodes[name] = {"name": name, "kind": kind, "level": level}
            return
        if level < current["level"]:
            current["level"] = level
        if priority_order.get(kind, 99) < priority_order.get(current["kind"], 99):
            current["kind"] = kind

    def add_edge(source: str, target: str) -> None:
        if not exists_in_offspring(source) or not exists_in_offspring(target):
            return
        graph_edges.add((source, target))

    add_node(img, "original", 0)

    for parent_name in parents:
        add_node(parent_name, "parent", -1)
        add_edge(parent_name, img)

    for child_name in children:
        add_node(child_name, "child", 1)
        add_edge(img, child_name)

    ancestors: set[str] = set()
    ancestors_by_level: list[list[str]] = []
    if depth != 0:
        ancestors_by_level = kinship_index.ancestors_levels_of(img, depth)
        for idx, level_items in enumerate(ancestors_by_level, start=1):
            for name in level_items:
                ancestors.add(name)
                add_node(name, "parent" if idx == 1 else "ancestor", -idx)
                for parent_name in kinship_index.parents_of(name):
                    add_node(parent_name, "ancestor", -(idx + 1))
                    add_edge(parent_name, name)

    for sibling_name in siblings:
        add_node(sibling_name, "sibling", 0)
        parent_list = kinship_index.parents_of(sibling_name)
        for parent_name in parent_list:
            add_node(parent_name, "parent", -1)
            add_edge(parent_name, sibling_name)

    root_ancestors: list[str] = []
    if ancestors_by_level:
        last_level = set(ancestors_by_level[-1])
        roots = []
        for ancestor in last_level:
            parent_candidates = kinship_index.parents_of(ancestor)
            if not parent_candidates:
                roots.append(ancestor)
        root_ancestors = filter_existing(roots)

    lineage_graph = {
        "nodes": sorted(
            graph_nodes.values(),
            key=lambda item: (item["level"], item["name"]),
        ),
        "edges": [
            {"source": source, "target": target} for source, target in sorted(graph_edges)
        ],
    }

    return {
        "original_image": img,
        "related_images": related,
        "parents": sorted(parents),
        "children": sorted(children),
        "siblings": sorted(siblings),
        "ancestors": filter_existing(ancestors),
        "ancestors_by_level": [filter_existing(set(level)) for level in ancestors_by_level],
        "root_ancestors": root_ancestors,
        "depth_used": depth,
        "lineage_graph": lineage_graph,
    }


@router.post("/api/kinship/rebuild")
def api_kinship_rebuild() -> dict:
    try:
        result = kinship_index.build_and_save()
        return result
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Failed to rebuild index: {exc}") from exc


@router.get("/api/kinship/stats")
def api_kinship_stats() -> dict:
    try:
        return kinship_index.stats()
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {exc}") from exc
