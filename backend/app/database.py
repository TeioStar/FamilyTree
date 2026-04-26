from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
FAMILY_DB_DIR = ROOT_DIR / "backend" / "data" / "families"
DEFAULT_FAMILY_ID = "shen-wuxian"
DEFAULT_DB_PATH = FAMILY_DB_DIR / f"{DEFAULT_FAMILY_ID}.ftree.db"


PERSON_SEED = [
    ("p1", "沈怀远", "怀", "宗祖", "1841-1912", 420, 44, "族谱主干人物，主持修谱。"),
    ("p2", "顾清婉", "清", "宗祖", "1848-1918", 560, 44, "宗祖配偶，保存家族旧稿。"),
    ("p3", "沈承礼", "承", "长房", "1870-1934", 170, 178, "长房主干，整理长支迁徙记录。"),
    ("p4", "沈承义", "承", "二房", "1874-1942", 420, 178, "二房主干，留有田产契据。"),
    ("p5", "沈承和", "承", "三房", "1879-1948", 670, 178, "三房主干，迁居后续修族谱。"),
    ("p6", "陆静姝", "静", "姻亲", "1875-1939", 30, 178, "长房姻亲。"),
    ("p7", "沈云章", "云", "长支", "1898-1961", 90, 320, "长支人物，入藏族谱手稿。"),
    ("p8", "沈云立", "云", "长支", "1902-1973", 250, 320, "长支人物，补录口述材料。"),
    ("p9", "沈云庭", "云", "二房", "1904-1980", 410, 320, "二房人物。"),
    ("p10", "沈静姝", "静", "二房", "1909-1996", 570, 320, "二房姻亲。"),
    ("p11", "沈云鹤", "云", "三房", "1912-1988", 730, 320, "三房人物。"),
    ("p12", "沈云岚", "云", "三房", "1916-2001", 810, 444, "三房迁居支系人物。"),
]

RELATIONSHIP_SEED = [
    ("spouse", "p1", "p2"),
    ("spouse", "p3", "p6"),
    ("spouse", "p9", "p10"),
    ("parent", "p1", "p3"),
    ("parent", "p1", "p4"),
    ("parent", "p1", "p5"),
    ("parent", "p2", "p3"),
    ("parent", "p2", "p4"),
    ("parent", "p5", "p12"),
    ("parent", "p3", "p7"),
    ("parent", "p3", "p8"),
    ("parent", "p4", "p9"),
    ("parent", "p5", "p11"),
]

EVENT_SEED = [
    ("e1", "p3", 1870, "长房立谱"),
    ("e2", "p7", 1922, "沈云章入藏族谱手稿"),
    ("e3", "p10", 1909, "二房添丁"),
    ("e4", "p12", 1916, "三房迁居"),
]

ARCHIVE_SEED = [
    ("a1", "p7", "manuscript", "1922 年手稿影印", "族谱手稿"),
    ("a2", "p10", "photo", "二房合影照片", "照片"),
]

AUDIT_SEED = [
    ("seed-archive", "system", "seed", "family", DEFAULT_FAMILY_ID, "初始化默认家谱与资料索引", "2026-04-26 00:00:00"),
]


def connect(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=5000")
    return connection


def initialize_default_family() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS persons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                generation TEXT NOT NULL,
                branch TEXT NOT NULL,
                years TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                summary TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                source TEXT NOT NULL,
                target TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL,
                year INTEGER NOT NULL,
                title TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS archives (
                id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                source TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        connection.execute(
            """
            DELETE FROM relationships
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM relationships
                GROUP BY type, source, target
            )
            """
        )
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_unique ON relationships(type, source, target)"
        )

        connection.executemany(
            "INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)",
            [
                ("family_id", DEFAULT_FAMILY_ID),
                ("name", "沈氏吴县支谱"),
                ("role", "creator"),
                ("status", "available"),
            ],
        )
        connection.executemany(
            """
            INSERT OR IGNORE INTO persons(id, name, generation, branch, years, x, y, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            PERSON_SEED,
        )
        connection.executemany(
            "INSERT OR IGNORE INTO relationships(type, source, target) VALUES (?, ?, ?)",
            RELATIONSHIP_SEED,
        )
        connection.executemany(
            "INSERT OR IGNORE INTO events(id, person_id, year, title) VALUES (?, ?, ?, ?)",
            EVENT_SEED,
        )
        connection.executemany(
            "INSERT OR IGNORE INTO archives(id, person_id, type, title, source) VALUES (?, ?, ?, ?, ?)",
            ARCHIVE_SEED,
        )
        connection.executemany(
            """
            INSERT OR IGNORE INTO audit_logs(id, actor, action, entity_type, entity_id, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            AUDIT_SEED,
        )


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]
