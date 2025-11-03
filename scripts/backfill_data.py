#!/usr/bin/env python3
"""
大量資料回填工具 - 使用 yfpy 批次收集 Yahoo Fantasy 數據並儲存到 Supabase

這是一次性的資料建制工具，用於：
1. 初始化資料庫
2. 回填歷史賽季資料
3. 大量重建資料時使用

未來的同步機制會使用 Next.js API (每日 cron job)
"""

import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from tqdm import tqdm
import time

from yfpy.query import YahooFantasySportsQuery
from supabase import create_client, Client
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# Supabase 設定
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

# Yahoo API 設定
YAHOO_CLIENT_ID = os.getenv('YAHOO_CLIENT_ID')
YAHOO_CLIENT_SECRET = os.getenv('YAHOO_CLIENT_SECRET')

# 賽季設定
SEASONS = {
    '2025-26': {'start': '2025-10-21', 'end': '2026-06-30'},
    '2024-25': {'start': '2024-10-22', 'end': '2025-06-17'},
    '2023-24': {'start': '2023-10-24', 'end': '2024-06-17'},
}


class YahooDataCollector:
    """Yahoo Fantasy 資料收集器"""

    def __init__(self, league_id: str, game_code: str = 'nba', season: int = 2025):
        """
        初始化收集器

        Args:
            league_id: Yahoo 聯盟 ID
            game_code: 運動類別代碼 (nba, nfl, mlb, nhl)
            season: 賽季年份
        """
        self.league_id = league_id
        self.game_code = game_code
        self.season = season

        # 初始化 Supabase client
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase credentials not found in .env")

        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # 初始化 Yahoo Fantasy Query
        self.yahoo = YahooFantasySportsQuery(
            league_id=league_id,
            game_code=game_code,
            game_id=season,
            yahoo_consumer_key=YAHOO_CLIENT_ID,
            yahoo_consumer_secret=YAHOO_CLIENT_SECRET
        )

        print(f"✓ 初始化完成: {game_code}.l.{league_id} ({season})")

    def get_league_players(self) -> List[Dict]:
        """
        取得聯盟所有球員列表

        Returns:
            球員列表 (包含 player_key 和 player_name)
        """
        print("📋 正在獲取聯盟球員列表...")

        try:
            # 使用 yfpy 獲取聯盟球員
            league = self.yahoo.get_league_info()
            players = self.yahoo.get_league_players()

            player_list = []
            for player in players:
                player_list.append({
                    'player_key': player.player_key,
                    'player_name': player.name.full,
                    'team': getattr(player.editorial_team_abbr, 'value', 'UNK') if hasattr(player, 'editorial_team_abbr') else 'UNK',
                    'positions': player.eligible_positions if hasattr(player, 'eligible_positions') else []
                })

            print(f"✓ 找到 {len(player_list)} 個球員")
            return player_list

        except Exception as e:
            print(f"✗ 獲取球員列表失敗: {e}")
            return []

    def get_player_stats_by_date(self, player_key: str, date: str) -> Optional[Dict]:
        """
        取得球員特定日期的數據

        Args:
            player_key: 球員 key
            date: 日期 (YYYY-MM-DD)

        Returns:
            球員數據或 None
        """
        try:
            # 使用 yfpy 獲取球員特定日期的數據
            stats = self.yahoo.get_player_stats_by_date(player_key, date)

            if not stats or not hasattr(stats, 'player_stats'):
                return None

            # 解析統計數據
            stats_dict = {}
            if hasattr(stats.player_stats, 'stats'):
                for stat in stats.player_stats.stats:
                    if hasattr(stat, 'stat'):
                        stat_id = str(stat.stat.stat_id)
                        value = stat.stat.value

                        # 嘗試轉換為數字
                        try:
                            if '.' in value:
                                stats_dict[stat_id] = float(value)
                            else:
                                stats_dict[stat_id] = int(value)
                        except (ValueError, TypeError):
                            # 如果無法轉換，跳過
                            continue

            # 檢查是否有比賽（至少有一個非零數據）
            has_game = any(v > 0 for v in stats_dict.values() if isinstance(v, (int, float)))

            if not has_game:
                return None

            # 提取上場時間（stat_id = 3）
            minutes_played = stats_dict.get('3')

            return {
                'date': date,
                'stats': stats_dict,
                'minutes_played': minutes_played,
                'has_game': True
            }

        except Exception as e:
            # 靜默失敗（某些日期沒有比賽是正常的）
            return None

    def save_game_log(self, player_key: str, player_name: str, game_log: Dict) -> bool:
        """
        儲存比賽紀錄到 Supabase

        Args:
            player_key: 球員 key
            player_name: 球員姓名
            game_log: 比賽數據

        Returns:
            是否成功儲存
        """
        try:
            data = {
                'player_key': player_key,
                'player_name': player_name,
                'game_date': game_log['date'],
                'stats': game_log['stats'],
                'minutes_played': game_log.get('minutes_played'),
                'opponent': None,  # 未來可從 schedule API 取得
                'home_away': None,
                'game_result': None
            }

            # 使用 upsert 避免重複
            result = self.supabase.table('player_game_logs').upsert(
                data,
                on_conflict='player_key,game_date'
            ).execute()

            return True

        except Exception as e:
            print(f"✗ 儲存失敗 ({player_key}, {game_log['date']}): {e}")
            return False

    def get_existing_dates(self, player_key: str) -> set:
        """
        取得資料庫中已存在的日期

        Args:
            player_key: 球員 key

        Returns:
            已存在的日期集合
        """
        try:
            result = self.supabase.table('player_game_logs')\
                .select('game_date')\
                .eq('player_key', player_key)\
                .execute()

            return {row['game_date'] for row in result.data}

        except Exception as e:
            print(f"✗ 查詢現有資料失敗: {e}")
            return set()

    def backfill_player(
        self,
        player_key: str,
        player_name: str,
        start_date: str,
        end_date: str,
        skip_existing: bool = True
    ) -> Dict:
        """
        回填單一球員的歷史資料

        Args:
            player_key: 球員 key
            player_name: 球員姓名
            start_date: 起始日期
            end_date: 結束日期
            skip_existing: 是否跳過已存在的資料

        Returns:
            統計結果
        """
        # 產生日期範圍
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        today = datetime.now()

        if end > today:
            end = today

        dates = []
        current = start
        while current <= end:
            dates.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=1)

        # 如果跳過已存在的資料，先查詢
        existing_dates = set()
        if skip_existing:
            existing_dates = self.get_existing_dates(player_key)
            dates = [d for d in dates if d not in existing_dates]

        # 統計
        stats = {
            'player_key': player_key,
            'player_name': player_name,
            'total_dates': len(dates),
            'existing_games': len(existing_dates),
            'new_games': 0,
            'api_calls': 0,
            'errors': 0
        }

        if len(dates) == 0:
            return stats

        # 批次收集
        for date in dates:
            game_log = self.get_player_stats_by_date(player_key, date)
            stats['api_calls'] += 1

            if game_log:
                if self.save_game_log(player_key, player_name, game_log):
                    stats['new_games'] += 1
                else:
                    stats['errors'] += 1

            # Rate limiting: 200ms 延遲
            time.sleep(0.2)

        return stats

    def backfill_season(
        self,
        season_key: str = '2024-25',
        max_players: Optional[int] = None
    ):
        """
        回填整個賽季的資料

        Args:
            season_key: 賽季代碼 (例如: '2024-25')
            max_players: 最多處理球員數量（None = 全部）
        """
        if season_key not in SEASONS:
            print(f"✗ 無效的賽季: {season_key}")
            return

        season_info = SEASONS[season_key]
        print(f"\n{'='*60}")
        print(f"🏀 開始回填 {season_key} 賽季")
        print(f"📅 日期範圍: {season_info['start']} 至 {season_info['end']}")
        print(f"{'='*60}\n")

        # 取得球員列表
        players = self.get_league_players()

        if not players:
            print("✗ 無法取得球員列表")
            return

        if max_players:
            players = players[:max_players]
            print(f"ℹ️  限制處理前 {max_players} 個球員\n")

        # 總計統計
        total_stats = {
            'total_players': len(players),
            'processed_players': 0,
            'total_new_games': 0,
            'total_api_calls': 0,
            'total_errors': 0
        }

        # 逐一處理每個球員
        for i, player in enumerate(players, 1):
            player_key = player['player_key']
            player_name = player['player_name']

            print(f"\n[{i}/{len(players)}] {player_name} ({player_key})")
            print("-" * 60)

            # 回填球員資料
            stats = self.backfill_player(
                player_key=player_key,
                player_name=player_name,
                start_date=season_info['start'],
                end_date=season_info['end'],
                skip_existing=True
            )

            # 更新總計
            total_stats['processed_players'] += 1
            total_stats['total_new_games'] += stats['new_games']
            total_stats['total_api_calls'] += stats['api_calls']
            total_stats['total_errors'] += stats['errors']

            # 顯示進度
            print(f"  已存在: {stats['existing_games']} 場")
            print(f"  新增: {stats['new_games']} 場")
            print(f"  API 調用: {stats['api_calls']} 次")
            if stats['errors'] > 0:
                print(f"  ⚠️  錯誤: {stats['errors']} 個")

        # 最終統計
        print(f"\n{'='*60}")
        print(f"✅ 回填完成！")
        print(f"{'='*60}")
        print(f"處理球員: {total_stats['processed_players']}/{total_stats['total_players']}")
        print(f"新增比賽: {total_stats['total_new_games']} 場")
        print(f"API 調用: {total_stats['total_api_calls']} 次")
        print(f"錯誤: {total_stats['total_errors']} 個")
        print(f"{'='*60}\n")


def main():
    """主程式"""

    print("\n" + "="*60)
    print("🏀 Yahoo Fantasy Basketball 資料回填工具")
    print("="*60 + "\n")

    # 檢查環境變數
    if not all([SUPABASE_URL, SUPABASE_KEY, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET]):
        print("✗ 缺少必要的環境變數，請檢查 .env 檔案")
        print("  需要:")
        print("  - NEXT_PUBLIC_SUPABASE_URL")
        print("  - NEXT_PUBLIC_SUPABASE_ANON_KEY")
        print("  - YAHOO_CLIENT_ID")
        print("  - YAHOO_CLIENT_SECRET")
        sys.exit(1)

    # 取得聯盟 ID（從命令列參數或環境變數）
    league_id = os.getenv('YAHOO_LEAGUE_ID')
    if len(sys.argv) > 1:
        league_id = sys.argv[1]

    if not league_id:
        print("✗ 請提供聯盟 ID")
        print("  使用方式: python backfill_data.py <league_id>")
        print("  或設定環境變數: YAHOO_LEAGUE_ID")
        sys.exit(1)

    # 取得賽季參數
    season_key = sys.argv[2] if len(sys.argv) > 2 else '2024-25'

    # 取得最大球員數
    max_players = None
    if len(sys.argv) > 3:
        try:
            max_players = int(sys.argv[3])
        except ValueError:
            pass

    try:
        # 初始化收集器
        collector = YahooDataCollector(
            league_id=league_id,
            game_code='nba',
            season=2025
        )

        # 開始回填
        collector.backfill_season(
            season_key=season_key,
            max_players=max_players
        )

    except KeyboardInterrupt:
        print("\n\n⚠️  使用者中斷")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ 錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
