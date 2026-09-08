from __future__ import annotations

import hashlib
import html
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import feedparser
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SYMBOLS = [
    s.strip().upper()
    for s in os.environ.get(
        "STOCK_NEWS_SYMBOLS",
        "NVDA,TSLA,QQQ,SOXL,PLTR",
    ).split(",")
    if s.strip()
]
MAX_ARTICLE_AGE_HOURS = int(os.environ.get("MAX_ARTICLE_AGE_HOURS", "36"))
PER_SYMBOL_LIMIT = int(os.environ.get("PER_SYMBOL_LIMIT", "15"))
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "14"))

QUERY_MAP = {
    "NVDA": 'NVIDIA NVDA stock',
    "TSLA": 'Tesla TSLA stock',
    "QQQ": 'Invesco QQQ Nasdaq 100',
    "SOXL": 'SOXL semiconductor ETF',
    "PLTR": 'Palantir PLTR stock',
}

USER_AGENT = (
    "Mozilla/5.0 (compatible; KTownTriangleStockNews/1.0; "
    "+https://www.ktowntriangle.com)"
)


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_published(entry) -> datetime:
    for key in ("published", "updated"):
        raw = entry.get(key)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except Exception:
                pass

    struct = entry.get("published_parsed") or entry.get("updated_parsed")
    if struct:
        return datetime(
            struct.tm_year,
            struct.tm_mon,
            struct.tm_mday,
            struct.tm_hour,
            struct.tm_min,
            struct.tm_sec,
            tzinfo=timezone.utc,
        )

    return datetime.now(timezone.utc)


def normalize_title_for_fingerprint(title: str) -> str:
    title = title.lower()
    title = re.sub(r"\s+-\s+[^-]{1,80}$", "", title)
    title = re.sub(r"[^a-z0-9가-힣]+", " ", title)
    return re.sub(r"\s+", " ", title).strip()


def source_from_entry(entry, title: str) -> str:
    source = entry.get("source")
    if isinstance(source, dict):
        source_title = clean_text(str(source.get("title") or ""))
        if source_title:
            return source_title

    # Google News RSS titles commonly end with " - Publisher"
    if " - " in title:
        possible = title.rsplit(" - ", 1)[-1].strip()
        if 1 < len(possible) <= 80:
            return possible

    return "Google News"


def fingerprint(title: str, source: str) -> str:
    raw = f"{normalize_title_for_fingerprint(title)}|{source.lower().strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def google_news_feed(symbol: str) -> str:
    query = QUERY_MAP.get(symbol, f"{symbol} stock")
    return (
        "https://news.google.com/rss/search?"
        f"q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    )


def fetch_entries(symbol: str) -> list[dict]:
    feed_url = google_news_feed(symbol)
    response = requests.get(
        feed_url,
        timeout=20,
        headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml,text/xml,*/*"},
    )
    response.raise_for_status()

    parsed = feedparser.parse(response.content)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_ARTICLE_AGE_HOURS)

    rows: list[dict] = []
    for entry in parsed.entries[:PER_SYMBOL_LIMIT]:
        title = clean_text(entry.get("title") or "")
        url = str(entry.get("link") or "").strip()
        if not title or not url:
            continue

        published = parse_published(entry)
        if published < cutoff:
            continue

        source = source_from_entry(entry, title)

        # Strip the trailing publisher from the visible title.
        visible_title = title
        suffix = f" - {source}"
        if source and visible_title.endswith(suffix):
            visible_title = visible_title[: -len(suffix)].strip()

        rows.append(
            {
                "symbol": symbol,
                "title": visible_title,
                "url": url,
                "source": source,
                "published_at": published.isoformat(),
                "fingerprint": fingerprint(visible_title, source),
            }
        )

    return rows


def supabase_headers(extra: dict | None = None) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def insert_rows(rows: list[dict]) -> int:
    if not rows:
        return 0

    endpoint = f"{SUPABASE_URL}/rest/v1/stock_news?on_conflict=fingerprint"
    response = requests.post(
        endpoint,
        json=rows,
        timeout=30,
        headers=supabase_headers(
            {
                "Prefer": "resolution=ignore-duplicates,return=minimal",
            }
        ),
    )
    if response.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"Supabase insert failed {response.status_code}: {response.text[:1000]}"
        )
    return len(rows)


def cleanup_old_rows() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    endpoint = (
        f"{SUPABASE_URL}/rest/v1/stock_news"
        f"?created_at=lt.{quote_plus(cutoff.isoformat())}"
    )
    response = requests.delete(
        endpoint,
        timeout=30,
        headers=supabase_headers({"Prefer": "return=minimal"}),
    )
    if response.status_code not in (200, 204):
        print(
            f"[WARN] cleanup failed {response.status_code}: {response.text[:500]}",
            file=sys.stderr,
        )


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
        )

    all_rows: list[dict] = []
    for symbol in SYMBOLS:
        try:
            rows = fetch_entries(symbol)
            print(f"[{symbol}] fetched {len(rows)} recent articles")
            all_rows.extend(rows)
        except Exception as exc:
            print(f"[{symbol}] fetch failed: {exc}", file=sys.stderr)

    # Remove duplicate fingerprints within this run.
    unique = {}
    for row in all_rows:
        unique.setdefault(row["fingerprint"], row)

    rows = list(unique.values())
    insert_rows(rows)
    cleanup_old_rows()

    print(f"Submitted {len(rows)} unique recent articles to Supabase.")


if __name__ == "__main__":
    main()
