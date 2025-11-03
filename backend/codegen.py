from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List

from jinja2 import Environment, FileSystemLoader, Template

TEMPLATE_DIR = Path(__file__).parent / "templates"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "generated" / "dags"


def _environment() -> Environment:
    loader = FileSystemLoader(str(TEMPLATE_DIR))
    return Environment(loader=loader, autoescape=False, trim_blocks=True, lstrip_blocks=True)


def _slugify(value: str) -> str:
    cleaned = [ch if ch.isalnum() or ch == "_" else "_" for ch in value.strip().lower()]
    slug = "".join(cleaned).strip("_")
    return slug or "task"


def _indent_code(body: str) -> str:
    lines = body.splitlines() or ["pass"]
    head, *tail = lines
    indented_tail = ["        " + line for line in tail]
    return "\n".join([head, *indented_tail])


def _default_code(node: Dict) -> str:
    if node.get("config") and isinstance(node["config"], dict):
        config_preview = json.dumps(node["config"], ensure_ascii=False)
    else:
        config_preview = "{}"

    if node.get("type") == "source":
        body = [f"# TODO: Implement data extraction for {node.get('name', node.get('id'))}", "return {'data': 'sample'}"]
    elif node.get("type") == "transform":
        body = ["# TODO: Implement transformation logic", "return data"]
    elif node.get("type") == "load":
        body = ["# TODO: Implement load logic", "return None"]
    else:
        body = ["# TODO: Implement logic for node", f"return {config_preview}"]

    return _indent_code("\n".join(body))


def _uniquify(names: Iterable[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    counts: Dict[str, int] = {}
    for original in names:
        base = _slugify(original)
        if base not in counts:
            counts[base] = 0
            mapping[original] = base
            continue
        counts[base] += 1
        mapping[original] = f"{base}_{counts[base]}"
    return mapping


def generate_dag(payload: Dict) -> Path:
    env = _environment()
    template: Template = env.get_template("dag_template.py.j2")

    dag_name = payload.get("dag_name", "unnamed_dag")
    nodes: List[Dict] = payload.get("nodes", [])
    edges: List[Dict] = payload.get("edges", [])

    id_mapping = _uniquify([str(node.get("name") or node.get("id", "task")) for node in nodes])

    rendered_nodes = []
    for node in nodes:
        key = str(node.get("name") or node.get("id", "task"))
        function_name = id_mapping[key]
        rendered_nodes.append(
            {
                "id": function_name,
                "code": _default_code(node),
            }
        )

    rendered_edges = []
    for edge in edges:
        source_key = next(
            (str(n.get("name") or n.get("id")) for n in nodes if str(n.get("id")) == str(edge.get("from"))),
            str(edge.get("from")),
        )
        target_key = next(
            (str(n.get("name") or n.get("id")) for n in nodes if str(n.get("id")) == str(edge.get("to"))),
            str(edge.get("to")),
        )
        rendered_edges.append({
            "from": id_mapping.get(source_key, _slugify(str(edge.get("from")))),
            "to": id_mapping.get(target_key, _slugify(str(edge.get("to")))),
        })

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{dag_name}.py"
    rendered_content = template.render(dag_name=dag_name, nodes=rendered_nodes, edges=rendered_edges)

    output_path.write_text(rendered_content, encoding="utf-8")
    return output_path


__all__ = ["generate_dag"]
