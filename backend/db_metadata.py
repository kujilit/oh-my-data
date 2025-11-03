"""Database metadata extraction service for browsing schemas, tables, and columns."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from .models import DatabaseConnection


def build_connection_url(connection: DatabaseConnection) -> str:
    """Build SQLAlchemy connection URL from DatabaseConnection model."""
    db_type = connection.db_type.lower()
    
    if db_type == "sqlite":
        return f"sqlite:///{connection.database}"
    
    # For other databases, build full URL
    auth_part = ""
    if connection.username:
        auth_part = connection.username
        if connection.password:
            auth_part += f":{connection.password}"
        auth_part += "@"
    
    host_part = connection.host or "localhost"
    port_part = f":{connection.port}" if connection.port else ""
    
    # Map db_type to SQLAlchemy dialect
    dialect_map = {
        "postgresql": "postgresql+psycopg2",
        "mysql": "mysql+pymysql",
        "mariadb": "mysql+pymysql",
        "oracle": "oracle+cx_oracle",
        "mssql": "mssql+pyodbc",
        "clickhouse": "clickhouse+native",
    }
    
    dialect = dialect_map.get(db_type, db_type)
    url = f"{dialect}://{auth_part}{host_part}{port_part}/{connection.database}"
    
    if connection.extra_params:
        try:
            params = json.loads(connection.extra_params)
            if params:
                param_str = "&".join([f"{k}={v}" for k, v in params.items()])
                url += f"?{param_str}"
        except json.JSONDecodeError:
            pass
    
    return url


def create_engine_from_connection(connection: DatabaseConnection) -> Engine:
    """Create SQLAlchemy engine from DatabaseConnection."""
    url = build_connection_url(connection)
    return create_engine(url, pool_pre_ping=True)


def get_schemas(connection: DatabaseConnection) -> list[dict[str, Any]]:
    """Get list of schemas for a database connection."""
    engine = create_engine_from_connection(connection)
    db_type = connection.db_type.lower()
    
    try:
        if db_type == "postgresql":
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT schema_name 
                    FROM information_schema.schemata 
                    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                    ORDER BY schema_name
                """))
                return [{"schema_name": row[0]} for row in result]
        
        elif db_type in ["mysql", "mariadb"]:
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT schema_name 
                    FROM information_schema.schemata 
                    WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
                    ORDER BY schema_name
                """))
                return [{"schema_name": row[0]} for row in result]
        
        elif db_type == "sqlite":
            # SQLite doesn't have schemas in the traditional sense
            return [{"schema_name": "main"}]
        
        else:
            # Fallback: use SQLAlchemy inspector
            inspector = inspect(engine)
            schemas = inspector.get_schema_names()
            return [{"schema_name": schema} for schema in sorted(schemas)]
    
    finally:
        engine.dispose()


def get_tables(connection: DatabaseConnection, schema: str | None = None) -> list[dict[str, Any]]:
    """Get list of tables for a schema."""
    engine = create_engine_from_connection(connection)
    db_type = connection.db_type.lower()
    
    try:
        if db_type == "postgresql":
            with engine.connect() as conn:
                query = """
                    SELECT table_name, table_type
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    ORDER BY table_name
                """
                result = conn.execute(text(query), {"schema": schema or "public"})
                return [{"table_name": row[0], "table_type": row[1]} for row in result]
        
        elif db_type in ["mysql", "mariadb"]:
            with engine.connect() as conn:
                query = """
                    SELECT table_name, table_type
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    ORDER BY table_name
                """
                result = conn.execute(text(query), {"schema": schema or connection.database})
                return [{"table_name": row[0], "table_type": row[1]} for row in result]
        
        elif db_type == "sqlite":
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT name as table_name, type as table_type
                    FROM sqlite_master 
                    WHERE type IN ('table', 'view')
                    ORDER BY name
                """))
                return [{"table_name": row[0], "table_type": row[1]} for row in result]
        
        else:
            # Fallback: use SQLAlchemy inspector
            inspector = inspect(engine)
            tables = inspector.get_table_names(schema=schema)
            views = inspector.get_view_names(schema=schema)
            result = [{"table_name": t, "table_type": "BASE TABLE"} for t in tables]
            result.extend([{"table_name": v, "table_type": "VIEW"} for v in views])
            return sorted(result, key=lambda x: x["table_name"])
    
    finally:
        engine.dispose()


def get_columns(
    connection: DatabaseConnection, 
    schema: str | None = None, 
    table: str | None = None
) -> list[dict[str, Any]]:
    """Get list of columns for a table."""
    if not table:
        return []
    
    engine = create_engine_from_connection(connection)
    db_type = connection.db_type.lower()
    
    try:
        if db_type == "postgresql":
            with engine.connect() as conn:
                query = """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        ordinal_position
                    FROM information_schema.columns 
                    WHERE table_schema = :schema AND table_name = :table
                    ORDER BY ordinal_position
                """
                result = conn.execute(
                    text(query), 
                    {"schema": schema or "public", "table": table}
                )
                return [
                    {
                        "column_name": row[0],
                        "data_type": row[1],
                        "is_nullable": row[2],
                        "column_default": row[3],
                        "ordinal_position": row[4],
                    }
                    for row in result
                ]
        
        elif db_type in ["mysql", "mariadb"]:
            with engine.connect() as conn:
                query = """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        ordinal_position
                    FROM information_schema.columns 
                    WHERE table_schema = :schema AND table_name = :table
                    ORDER BY ordinal_position
                """
                result = conn.execute(
                    text(query), 
                    {"schema": schema or connection.database, "table": table}
                )
                return [
                    {
                        "column_name": row[0],
                        "data_type": row[1],
                        "is_nullable": row[2],
                        "column_default": row[3],
                        "ordinal_position": row[4],
                    }
                    for row in result
                ]
        
        elif db_type == "sqlite":
            with engine.connect() as conn:
                result = conn.execute(text(f"PRAGMA table_info({table})"))
                return [
                    {
                        "column_name": row[1],
                        "data_type": row[2],
                        "is_nullable": "YES" if row[3] == 0 else "NO",
                        "column_default": row[4],
                        "ordinal_position": row[0],
                    }
                    for row in result
                ]
        
        else:
            # Fallback: use SQLAlchemy inspector
            inspector = inspect(engine)
            columns = inspector.get_columns(table, schema=schema)
            return [
                {
                    "column_name": col["name"],
                    "data_type": str(col["type"]),
                    "is_nullable": "YES" if col.get("nullable", True) else "NO",
                    "column_default": col.get("default"),
                    "ordinal_position": idx,
                }
                for idx, col in enumerate(columns, 1)
            ]
    
    finally:
        engine.dispose()


def test_connection(connection: DatabaseConnection) -> dict[str, Any]:
    """Test database connection."""
    try:
        engine = create_engine_from_connection(connection)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
