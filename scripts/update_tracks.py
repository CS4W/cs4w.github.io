"""
update_tracks.py
CS4W の YouTube チャンネルから新着動画を取得し、
タイトルが「CS4W -」で始まる動画を tracks.js に追記する。

必要な環境変数:
  YOUTUBE_API_KEY : YouTube Data API v3 のキー
"""

import os
import re
import json
import requests
from datetime import datetime, timezone, timedelta

# ───────────────────────────────────────────────
# 設定
# ───────────────────────────────────────────────
YOUTUBE_API_KEY  = os.environ["YOUTUBE_API_KEY"]
CHANNEL_ID       = "UCNmJFAGQrjHlhKGSHRUVBUQ"   # CS4W の YouTube チャンネル ID
TITLE_PREFIX     = "CS4W -"                        # 対象動画のタイトル接頭辞
TRACKS_JS_PATH   = "tracks.js"                     # リポジトリルートからの相対パス
MAX_RESULTS      = 50                              # 1 回のリクエストで取得する最大件数

# ───────────────────────────────────────────────
# tracks.js を読み込んで既存の ytId を収集する
# ───────────────────────────────────────────────
def load_tracks_js(path: str) -> tuple[str, set[str]]:
    with open(path, encoding="utf-8") as f:
        content = f.read()

    existing_ids = set(re.findall(r"ytId:'([^']+)'", content))
    return content, existing_ids


# ───────────────────────────────────────────────
# YouTube API でチャンネルの動画を取得する
# ───────────────────────────────────────────────
def fetch_channel_videos(api_key: str, channel_id: str, max_results: int) -> list[dict]:
    """
    YouTube Data API v3 の search.list を使い、チャンネルの最新動画を取得する。
    (pageToken で複数ページをまとめて取得)
    """
    url = "https://www.googleapis.com/youtube/v3/search"
    videos = []
    page_token = None

    while True:
        params = {
            "key":        api_key,
            "channelId":  channel_id,
            "part":       "snippet",
            "type":       "video",
            "order":      "date",
            "maxResults": max_results,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            snippet  = item["snippet"]
            video_id = item["id"]["videoId"]
            title    = snippet["title"]
            pub_date = snippet["publishedAt"]   # ISO 8601 (UTC)
            videos.append({"ytId": video_id, "title": title, "publishedAt": pub_date})

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return videos


# ───────────────────────────────────────────────
# 動画タイトルから曲名と likeId を生成する
# ───────────────────────────────────────────────
def parse_title(title: str) -> str:
    """
    例: 「CS4W - Subjugator」→「Subjugator」
    """
    # 「CS4W -」以降を曲名とする（前後の空白を除去）
    name = re.sub(r"^CS4W\s*-\s*", "", title).strip()
    return name


def make_like_id(name: str) -> str:
    """
    スペース・記号を除去して小文字化し、最大 20 文字に切り詰める。
    既存の likeId 生成ルールに合わせた簡易版。
    """
    like_id = re.sub(r"[^a-zA-Z0-9]", "", name).lower()
    return like_id[:20]


def iso_to_date(iso: str) -> str:
    """
    「2026-06-06T12:00:00Z」→「2026/06/06」(JST 基準)
    """
    dt_utc = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    jst     = timezone(timedelta(hours=9))
    dt_jst  = dt_utc.astimezone(jst)
    return dt_jst.strftime("%Y/%m/%d")


# ───────────────────────────────────────────────
# tracks.js に新しいエントリを追記する
# ───────────────────────────────────────────────
def build_entry(video: dict) -> str:
    name    = parse_title(video["title"])
    yt_id   = video["ytId"]
    date    = iso_to_date(video["publishedAt"])
    like_id = make_like_id(name)

    # genre / collab / platform などは自動取得不可のため省略
    return f"  {{date:'{date}',name:'{name}',ytId:'{yt_id}',likeId:'{like_id}'}},"


def insert_new_entries(content: str, new_entries: list[str]) -> str:
    """
    window.CS4W_TRACKS = [ の直後（最初の行の前）に新しいエントリを挿入する。
    """
    # 配列の開き括弧の直後を探す
    insert_marker = "window.CS4W_TRACKS = [\n"
    idx = content.find(insert_marker)
    if idx == -1:
        raise ValueError("tracks.js の配列定義が見つかりません。")

    insert_pos = idx + len(insert_marker)
    new_block  = "\n".join(new_entries) + "\n"
    return content[:insert_pos] + new_block + content[insert_pos:]


# ───────────────────────────────────────────────
# メイン処理
# ───────────────────────────────────────────────
def main():
    print(f"[{datetime.now()}] tracks.js を読み込み中...")
    content, existing_ids = load_tracks_js(TRACKS_JS_PATH)
    print(f"  既存エントリ数: {len(existing_ids)}")

    print("YouTube API から動画一覧を取得中...")
    videos = fetch_channel_videos(YOUTUBE_API_KEY, CHANNEL_ID, MAX_RESULTS)
    print(f"  取得動画数: {len(videos)}")

    # フィルタリング: タイトルが TITLE_PREFIX で始まり、かつ未登録のもの
    new_entries = []
    for v in videos:
        if not v["title"].startswith(TITLE_PREFIX):
            continue
        if v["ytId"] in existing_ids:
            continue
        entry = build_entry(v)
        new_entries.append(entry)
        print(f"  [NEW] {v['title']} ({v['ytId']})")

    if not new_entries:
        print("新しい動画はありませんでした。")
        return

    print(f"{len(new_entries)} 件の新しいエントリを追加します。")
    updated_content = insert_new_entries(content, new_entries)

    with open(TRACKS_JS_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print("tracks.js を更新しました。")


if __name__ == "__main__":
    main()
