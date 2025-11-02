from __future__ import annotations

import os
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, func
from sqlalchemy.orm import declarative_base, sessionmaker


def _database_url() -> str:
    default_url = "sqlite:///./etl_builder.db"
    return os.getenv("DATABASE_URL", default_url)


engine = create_engine(_database_url(), future=True, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


class NodeType(Base):
    __tablename__ = "node_types"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String(100), unique=True, nullable=False)
    category: str = Column(String(50), nullable=False)
    description: Optional[str] = Column(Text, nullable=True)
    config_schema: Optional[str] = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


__all__ = ["Base", "NodeType", "engine", "SessionLocal"]
