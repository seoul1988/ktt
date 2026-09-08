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

MIN_IMPORTANCE = int(os.environ.get("MIN_IMPORTANCE", "3"))
MAX_ARTICLE_AGE_HOURS = int(os.environ.get("MAX_ARTICLE_AGE_HOURS", "24"))
PER_FEED_LIMIT = int(os.environ.get("PER_FEED_LIMIT", "40"))
RETENTION_HOURS = int(os.environ.get("RETENTION_HOURS", "24"))

USER_AGENT = (
    "Mozilla/5.0 (compatible; KTownTriangleMarketNews/2.0; "
    "+https://www.ktowntriangle.com)"
)

# 특정 티커가 아니라 미국 증시 전체의 "중요 뉴스"를 넓게 수집합니다.
NEWS_QUERIES = [
    "stock market breaking news",
    "Wall Street market breaking news",
    "Federal Reserve stocks market",
    "S&P 500 Nasdaq Dow market news",
    "earnings warning guidance stocks",
    "merger acquisition stocks breaking",
    "SEC investigation stocks breaking",

    # 거시/지정학/원자재/반도체/대통령 발언
    "war conflict geopolitical risk stocks market",
    "Middle East war oil stocks market",
    "Ukraine Russia war stocks market",
    "oil crude OPEC market stocks",
    "oil price surge drop stock market",
    "semiconductor chips AI stocks market",
    "semiconductor export controls tariffs stocks",
    "White House president remarks economy stocks market",
    "president tariffs trade sanctions stocks market",
    "president Federal Reserve interest rates stocks",
]

# 강한 시장 영향 키워드: 하나만 있어도 중요도 상승
CRITICAL_KEYWORDS = {
    "federal reserve", "fed rate", "interest rate", "rate cut", "rate hike",
    "fomc", "powell", "cpi", "inflation", "jobs report", "payrolls",
    "recession", "tariff", "sanction", "bank failure", "liquidity crisis",
    "market crash", "market selloff", "circuit breaker",
    "sec investigation", "fraud", "bankruptcy", "chapter 11",
    "merger", "acquisition", "takeover", "buyout",
    "earnings warning", "profit warning", "guidance cut",
    "guidance raised", "earnings beat", "earnings miss",

    # 전쟁 / 지정학
    "war", "military strike", "missile", "airstrike", "invasion",
    "ceasefire", "geopolitical", "middle east", "iran", "israel",
    "russia", "ukraine", "taiwan", "north korea",

    # 유가 / 원유
    "oil price", "crude oil", "brent", "wti", "opec", "opec+",
    "oil supply", "oil production", "oil embargo",

    # 반도체 / 칩
    "semiconductor", "chip export", "chip ban", "export controls",
    "nvidia", "tsmc", "intel", "amd", "broadcom", "micron",
    "ai chip", "chips act",

    # 대통령 / 백악관의 시장 영향 발언
    "white house", "president says", "president warns",
    "president announces", "president tariff", "president trade",
    "president sanctions", "president economy", "president fed",
}

# 보통 중요 키워드
IMPORTANT_KEYWORDS = {
    "earnings", "guidance", "revenue", "profit", "forecast",
    "ipo", "offering", "layoff", "recall", "antitrust",
    "lawsuit", "investigation", "downgrade", "upgrade",
    "dividend", "split", "buyback", "ceo resigns", "ceo steps down",
    "default", "debt", "credit rating", "oil prices",
    "treasury yields", "bond yields", "geopolitical",
    "war", "attack", "shutdown",
    "conflict", "ceasefire", "defense", "military",
    "oil", "crude", "brent", "wti", "opec",
    "semiconductor", "chip", "chips", "export control",
    "white house", "president", "tariff", "trade policy",
    "sanctions", "energy policy",
}

# 시장 전체/대형지수 관련이면 가점
MARKET_KEYWORDS = {
    "s&p 500", "nasdaq", "dow jones", "wall street",
    "stock market", "stocks", "equities", "futures",
}

# 기사 품질을 높이기 위한 주요 금융 매체 가점
TRUSTED_SOURCES = {
    "Reuters", "Bloomberg", "CNBC", "Wall Street Journal", "WSJ",
    "Financial Times", "MarketWatch", "Barron's", "Forbes",
    "Yahoo Finance", "Associated Press", "AP News",
}


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


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
            struct.tm_year, struct.tm_mon, struct.tm_mday,
            struct.tm_hour, struct.tm_min, struct.tm_sec,
            tzinfo=timezone.utc
        )
    return datetime.now(timezone.utc)


def source_from_entry(entry, title: str) -> str:
    source = entry.get("source")
    if isinstance(source, dict):
        source_title = clean_text(str(source.get("title") or ""))
        if source_title:
            return source_title

    if " - " in title:
        possible = title.rsplit(" - ", 1)[-1].strip()
        if 1 < len(possible) <= 80:
            return possible
    return "Google News"


def visible_title(title: str, source: str) -> str:
    suffix = f" - {source}"
    if source and title.endswith(suffix):
        return title[:-len(suffix)].strip()
    return title


def normalize_title(title: str) -> str:
    title = title.lower()
    title = re.sub(r"[^a-z0-9가-힣]+", " ", title)
    return re.sub(r"\s+", " ", title).strip()


def fingerprint(title: str, source: str) -> str:
    raw = f"{normalize_title(title)}|{source.lower().strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def calculate_importance(title: str, source: str) -> int:
    """
    1~5 중요도.
    기본 1점.
    중요/시장 키워드 및 신뢰 매체에 따라 가점.
    3점 이상만 DB에 저장.
    """
    text = title.lower()
    score = 1

    critical_hits = sum(1 for k in CRITICAL_KEYWORDS if k in text)
    important_hits = sum(1 for k in IMPORTANT_KEYWORDS if k in text)
    market_hits = sum(1 for k in MARKET_KEYWORDS if k in text)

    if critical_hits:
        score += 2
    if critical_hits >= 2:
        score += 1

    if important_hits:
        score += 1
    if important_hits >= 2:
        score += 1

    if market_hits:
        score += 1

    # 지정학/유가/반도체/대통령 발언 중 시장 연관성이 명확하면 추가 가점.
    geopolitical_terms = (
        "war", "military strike", "missile", "airstrike", "invasion",
        "ceasefire", "geopolitical", "iran", "israel", "russia",
        "ukraine", "taiwan", "north korea",
    )
    oil_terms = (
        "oil", "crude", "brent", "wti", "opec", "energy prices",
    )
    chip_terms = (
        "semiconductor", "chip", "nvidia", "tsmc", "intel", "amd",
        "broadcom", "micron", "export controls", "chips act",
    )
    president_terms = (
        "white house", "president", "tariff", "trade", "sanction",
        "federal reserve", "interest rate", "economy", "jobs",
        "inflation", "energy", "semiconductor", "china",
    )

    if any(term in text for term in geopolitical_terms):
        score += 1
    if any(term in text for term in oil_terms):
        score += 1
    if any(term in text for term in chip_terms):
        score += 1

    # 대통령/백악관 기사는 단순 정치 뉴스가 아니라 시장 관련 키워드가 같이 있을 때만 가점.
    if ("president" in text or "white house" in text) and any(
        term in text for term in president_terms[2:]
    ):
        score += 2

    if any(source.lower() == s.lower() for s in TRUSTED_SOURCES):
        score += 1

    # "breaking", "surges", "plunges" 같은 긴급성 표현
    if re.search(r"\b(breaking|surges?|plunges?|soars?|tumbles?|halts?|warns?)\b", text):
        score += 1

    return max(1, min(score, 5))


def google_news_feed(query: str) -> str:
    return (
        "https://news.google.com/rss/search?"
        f"q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    )


def fetch_query(query: str) -> list[dict]:
    url = google_news_feed(query)
    response = requests.get(
        url,
        timeout=20,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml,text/xml,*/*",
        },
    )
    response.raise_for_status()

    parsed = feedparser.parse(response.content)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_ARTICLE_AGE_HOURS)
    rows = []

    for entry in parsed.entries[:PER_FEED_LIMIT]:
        raw_title = clean_text(entry.get("title") or "")
        article_url = str(entry.get("link") or "").strip()
        if not raw_title or not article_url:
            continue

        published = parse_published(entry)
        if published < cutoff:
            continue

        source = source_from_entry(entry, raw_title)
        title = visible_title(raw_title, source)
        importance = calculate_importance(title, source)

        if importance < MIN_IMPORTANCE:
            continue

        rows.append({
            "symbol": None,
            "title": title,
            "url": article_url,
            "source": source,
            "importance": importance,
            "published_at": published.isoformat(),
            "fingerprint": fingerprint(title, source),
        })

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


def insert_rows(rows: list[dict]) -> None:
    if not rows:
        return

    endpoint = f"{SUPABASE_URL}/rest/v1/stock_news?on_conflict=fingerprint"
    response = requests.post(
        endpoint,
        json=rows,
        timeout=30,
        headers=supabase_headers({
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        }),
    )
    if response.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"Supabase insert failed {response.status_code}: {response.text[:1000]}"
        )


def cleanup_old_rows() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)
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

    all_rows = []

    for query in NEWS_QUERIES:
        try:
            rows = fetch_query(query)
            print(f"[{query}] important articles: {len(rows)}")
            all_rows.extend(rows)
        except Exception as exc:
            print(f"[{query}] fetch failed: {exc}", file=sys.stderr)

    # 같은 기사가 여러 검색어에 잡혀도 1개만 저장
    unique = {}
    for row in all_rows:
        key = row["fingerprint"]
        if key not in unique or row["importance"] > unique[key]["importance"]:
            unique[key] = row

    rows = sorted(
        unique.values(),
        key=lambda r: (r["importance"], r["published_at"]),
        reverse=True,
    )

    insert_rows(rows)
    cleanup_old_rows()

    print(f"Submitted {len(rows)} market news articles with importance >= {MIN_IMPORTANCE}.")
    for row in rows[:10]:
        print(f"  {'★' * row['importance']} {row['title'][:100]}")


if __name__ == "__main__":
    main()
