from __future__ import annotations

import json
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import codegen
from .models import Base, NodeType, SessionLocal, engine

app = FastAPI(title="Visual ETL Builder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class NodeConfig(BaseModel):
    id: str = Field(..., description="Unique identifier of the node on the canvas")
    type: str = Field(..., description="Node category such as source, transform, sink")
    name: str | None = Field(default=None, description="Human readable node name")
    config: dict = Field(default_factory=dict, description="Arbitrary configuration for the node")


class EdgeConfig(BaseModel):
    from_: str = Field(..., alias="from", description="Source node identifier")
    to: str = Field(..., description="Target node identifier")

    class Config:
        allow_population_by_field_name = True


class GraphPayload(BaseModel):
    dag_name: str = Field(..., description="Name of the generated DAG")
    nodes: List[NodeConfig]
    edges: List[EdgeConfig] = Field(default_factory=list)


class NodeTypeCreate(BaseModel):
    name: str
    category: str
    description: str | None = None
    config_schema: dict | None = None


class NodeTypeRead(BaseModel):
    id: int
    name: str
    category: str
    description: str | None
    config_schema: dict | None

    class Config:
        orm_mode = True


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/generate_dag")
def generate_dag(payload: GraphPayload) -> dict:
    output_path = codegen.generate_dag(payload.dict(by_alias=True))
    return {"message": "DAG generated", "path": str(output_path)}


@app.get("/dags")
def list_dags() -> dict:
    dags_dir = Path(codegen.OUTPUT_DIR)
    dags_dir.mkdir(parents=True, exist_ok=True)
    files = sorted([file.name for file in dags_dir.glob("*.py")])
    return {"dags": files}


@app.post("/nodes", response_model=NodeTypeRead)
def create_node_type(payload: NodeTypeCreate, db: Session = Depends(get_db)) -> NodeTypeRead:
    node_type = NodeType(
        name=payload.name,
        category=payload.category,
        description=payload.description,
        config_schema=json.dumps(payload.config_schema) if payload.config_schema is not None else None,
    )
    db.add(node_type)
    try:
        db.commit()
        db.refresh(node_type)
    except IntegrityError as exc:  # pragma: no cover - simple error handling scaffold
        db.rollback()
        raise HTTPException(status_code=400, detail="Node type already exists") from exc
    return _to_read_model(node_type)


@app.get("/nodes", response_model=list[NodeTypeRead])
def list_node_types(db: Session = Depends(get_db)) -> list[NodeTypeRead]:
    records = db.query(NodeType).order_by(NodeType.name).all()
    return [_to_read_model(record) for record in records]


def _to_read_model(record: NodeType) -> NodeTypeRead:
    if isinstance(record.config_schema, str):
        try:
            schema = json.loads(record.config_schema)
        except json.JSONDecodeError:  # pragma: no cover - fallback for malformed data
            schema = None
    else:
        schema = record.config_schema

    return NodeTypeRead(
        id=record.id,
        name=record.name,
        category=record.category,
        description=record.description,
        config_schema=schema,
    )


