"""自動清理 ChromaDB 中的中文版本索引（:zh 標籤）

這個腳本會在背景執行，定期清理新增的中文版本，
保持 ChromaDB 中只有英文版本的索引。
"""

import chromadb
import time
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def cleanup_chinese_indices(db_path: str = "embeddings/chroma", interval_seconds: int = 30) -> None:
    """
    持續監控 ChromaDB，清理中文版本索引（:zh 標籤）。
    
    Args:
        db_path: ChromaDB 路徑
        interval_seconds: 清理間隔（秒）
    """
    db_path = Path(db_path)
    if not db_path.exists():
        logger.warning(f"ChromaDB 路徑不存在: {db_path}")
        return
    
    client = chromadb.PersistentClient(path=str(db_path))
    col = client.get_collection(name="offspring_images")
    
    print(f"🧹 啟動自動清理監控（每 {interval_seconds} 秒檢查一次）\n")
    
    while True:
        try:
            all_data = col.get()
            ids = all_data.get("ids", [])
            zh_ids = [id for id in ids if ':zh' in id]
            
            if zh_ids:
                print(f"⏰ [{time.strftime('%H:%M:%S')}] 發現 {len(zh_ids)} 個中文版本，清理中...")
                
                # 分批刪除
                batch_size = 50
                for i in range(0, len(zh_ids), batch_size):
                    batch = zh_ids[i:i+batch_size]
                    col.delete(ids=batch)
                
                # 驗證
                all_data_after = col.get()
                zh_check = [id for id in all_data_after.get("ids", []) if ':zh' in id]
                en_count = len([id for id in all_data_after.get("ids", []) if ':en' in id])
                
                print(f"  ✓ 已清理 {len(zh_ids)} 個")
                print(f"  ✓ 目前狀態：{en_count} 張英文 + {len(zh_check)} 張中文\n")
            
            time.sleep(interval_seconds)
            
        except Exception as e:
            print(f"❌ 清理出錯：{e}")
            time.sleep(interval_seconds)


def cleanup_once(db_path: str = "embeddings/chroma") -> int:
    """
    執行一次清理，回傳刪除的數量。
    """
    db_path = Path(db_path)
    if not db_path.exists():
        return 0
    
    client = chromadb.PersistentClient(path=str(db_path))
    col = client.get_collection(name="offspring_images")
    
    all_data = col.get()
    ids = all_data.get("ids", [])
    zh_ids = [id for id in ids if ':zh' in id]
    
    if zh_ids:
        batch_size = 50
        for i in range(0, len(zh_ids), batch_size):
            batch = zh_ids[i:i+batch_size]
            col.delete(ids=batch)
        return len(zh_ids)
    
    return 0


if __name__ == "__main__":
    # 設定日誌
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # 啟動監控
    cleanup_chinese_indices(interval_seconds=30)
