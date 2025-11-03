from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import codegen
from . import db_metadata
from .models import Base, DatabaseConnection, NodeType, SessionLocal, engine

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
    type: str = Field(..., description="Node category such as source, transform, load")
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


class DatabaseConnectionCreate(BaseModel):
    name: str
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None
    extra_params: Optional[dict] = None


class DatabaseConnectionUpdate(BaseModel):
    name: Optional[str] = None
    db_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    extra_params: Optional[dict] = None


class DatabaseConnectionRead(BaseModel):
    id: int
    name: str
    db_type: str
    host: Optional[str]
    port: Optional[int]
    database: str
    username: Optional[str]
    # Note: password is not exposed in read model for security
    extra_params: Optional[dict]

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


def _connection_to_read_model(record: DatabaseConnection) -> DatabaseConnectionRead:
    extra = None
    if isinstance(record.extra_params, str):
        try:
            extra = json.loads(record.extra_params)
        except json.JSONDecodeError:
            extra = None
    else:
        extra = record.extra_params

    return DatabaseConnectionRead(
        id=record.id,
        name=record.name,
        db_type=record.db_type,
        host=record.host,
        port=record.port,
        database=record.database,
        username=record.username,
        extra_params=extra,
    )


# ===== Database Connection Endpoints =====


@app.post("/connections", response_model=DatabaseConnectionRead)
def create_connection(payload: DatabaseConnectionCreate, db: Session = Depends(get_db)) -> DatabaseConnectionRead:
    """Create a new database connection."""
    connection = DatabaseConnection(
        name=payload.name,
        db_type=payload.db_type,
        host=payload.host,
        port=payload.port,
        database=payload.database,
        username=payload.username,
        password=payload.password,
        extra_params=json.dumps(payload.extra_params) if payload.extra_params else None,
    )
    db.add(connection)
    try:
        db.commit()
        db.refresh(connection)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Connection with this name already exists") from exc
    return _connection_to_read_model(connection)


@app.get("/connections", response_model=list[DatabaseConnectionRead])
def list_connections(db: Session = Depends(get_db)) -> list[DatabaseConnectionRead]:
    """List all database connections."""
    records = db.query(DatabaseConnection).order_by(DatabaseConnection.name).all()
    return [_connection_to_read_model(record) for record in records]


@app.get("/connections/{connection_id}", response_model=DatabaseConnectionRead)
def get_connection(connection_id: int, db: Session = Depends(get_db)) -> DatabaseConnectionRead:
    """Get a specific database connection."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return _connection_to_read_model(connection)


@app.put("/connections/{connection_id}", response_model=DatabaseConnectionRead)
def update_connection(
    connection_id: int, payload: DatabaseConnectionUpdate, db: Session = Depends(get_db)
) -> DatabaseConnectionRead:
    """Update a database connection."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if payload.name is not None:
        connection.name = payload.name
    if payload.db_type is not None:
        connection.db_type = payload.db_type
    if payload.host is not None:
        connection.host = payload.host
    if payload.port is not None:
        connection.port = payload.port
    if payload.database is not None:
        connection.database = payload.database
    if payload.username is not None:
        connection.username = payload.username
    if payload.password is not None:
        connection.password = payload.password
    if payload.extra_params is not None:
        connection.extra_params = json.dumps(payload.extra_params)

    try:
        db.commit()
        db.refresh(connection)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Connection with this name already exists") from exc
    return _connection_to_read_model(connection)


@app.delete("/connections/{connection_id}")
def delete_connection(connection_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a database connection."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(connection)
    db.commit()
    return {"message": "Connection deleted"}


@app.post("/connections/{connection_id}/test")
def test_connection(connection_id: int, db: Session = Depends(get_db)) -> dict:
    """Test a database connection."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return db_metadata.test_connection(connection)


# ===== Database Metadata Endpoints =====


@app.get("/connections/{connection_id}/schemas")
def get_schemas(connection_id: int, db: Session = Depends(get_db)) -> dict:
    """Get list of schemas for a database connection."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        schemas = db_metadata.get_schemas(connection)
        return {"schemas": schemas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schemas: {str(e)}")


@app.get("/connections/{connection_id}/tables")
def get_tables(connection_id: int, schema: Optional[str] = None, db: Session = Depends(get_db)) -> dict:
    """Get list of tables for a schema."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        tables = db_metadata.get_tables(connection, schema)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tables: {str(e)}")


@app.get("/connections/{connection_id}/columns")
def get_columns(
    connection_id: int, schema: Optional[str] = None, table: Optional[str] = None, db: Session = Depends(get_db)
) -> dict:
    """Get list of columns for a table."""
    connection = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        columns = db_metadata.get_columns(connection, schema, table)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch columns: {str(e)}")
