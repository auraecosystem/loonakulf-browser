"""Explicit-consent local knowledge store for LMLM.

Only content submitted through the save endpoint is persisted. SQLite stays on
the local machine; no crawler or background collection is provided.
"""
from __future__ import annotations

import os
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any


def database_path() -> Path:
    configured = os.getenv("LMLM_DATA_DIR", "").strip()
    root = (
        Path(configured).expanduser()
        if configured
        else Path.home() / ".local" / "share" / "loonakulf" / "lmlm"
    )
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not configured:
        os.chmod(root, 0o700)
    return root / "knowledge.sqlite3"


def connect() -> sqlite3.Connection:
    path = database_path()
    connection = sqlite3.connect(path, timeout=5)
    try:
        os.chmod(path, 0o600)
    except OSError:
        connection.close()
        raise
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_url TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    return connection


@contextmanager
def database():
    db = connect()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def save_document(title: str, source_url: str, content: str) -> dict[str, Any]:
    document_id = str(uuid.uuid4())
    with database() as db:
        db.execute(
            "INSERT INTO knowledge(id, title, source_url, content) VALUES (?, ?, ?, ?)",
            (document_id, title[:300], source_url[:2048], content[:30000]),
        )
    return {"id": document_id, "title": title[:300], "source_url": source_url[:2048]}


def search_documents(query: str, limit: int = 5) -> list[dict[str, Any]]:
    stop_words = {
        "what", "does", "this", "that", "with", "from", "about", "into",
        "have", "the", "and", "for", "are", "was", "were", "how", "why", "can",
    }
    terms = []
    for raw_term in query.split():
        term = raw_term.strip(".,:;!?()[]{}\\\"'").casefold()
        if len(term) > 2 and term not in stop_words and term not in terms:
            terms.append(term[:80])
        if len(terms) == 8:
            break
    if not terms:
        return []

    patterns = [f"%{term}%" for term in terms]
    conditions = " OR ".join("(content LIKE ? OR title LIKE ?)" for _ in terms)
    score = " + ".join("(content LIKE ? OR title LIKE ?)" for _ in terms)
    bindings = [value for pattern in patterns for value in (pattern, pattern)]
    with database() as db:
        rows = db.execute(
            f"SELECT id, title, source_url, substr(content, 1, 5000) AS content, "
            f"created_at, ({score}) AS relevance FROM knowledge "
            f"WHERE {conditions} ORDER BY relevance DESC, created_at DESC LIMIT ?",
            (*bindings, *bindings, max(1, min(limit, 10))),
        ).fetchall()
    return [dict(row) for row in rows]


def delete_document(document_id: str) -> bool:
    with database() as db:
        cursor = db.execute("DELETE FROM knowledge WHERE id = ?", (document_id,))
        return cursor.rowcount > 0
