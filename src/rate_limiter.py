"""限流器实现（滑动窗口算法）"""
import time
from collections import defaultdict
from threading import Lock
from typing import Dict, Tuple


class RateLimiter:
    """滑动窗口限流器"""

    def __init__(self):
        # 存储格式: {key: [(timestamp, count), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        self.lock = Lock()
        self.global_requests: list = []

    def _cleanup_old_requests(self, requests: list, window_seconds: int = 60) -> list:
        """清理过期请求"""
        current_time = time.time()
        cutoff_time = current_time - window_seconds
        return [req for req in requests if req > cutoff_time]

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int, int]:
        """
        检查请求是否允许

        Args:
            key: 限流键（如API密钥ID或"global"）
            max_requests: 窗口期内最大请求数
            window_seconds: 窗口大小（秒）

        Returns:
            (is_allowed, current_count, reset_time)
        """
        with self.lock:
            current_time = time.time()

            # 清理过期请求
            if key == "global":
                self.global_requests = self._cleanup_old_requests(
                    self.global_requests, window_seconds
                )
                requests = self.global_requests
            else:
                self.requests[key] = self._cleanup_old_requests(
                    self.requests[key], window_seconds
                )
                requests = self.requests[key]

            current_count = len(requests)

            # 检查是否超过限制
            if current_count >= max_requests:
                # 计算重置时间
                oldest_request = min(requests) if requests else current_time
                reset_time = int(oldest_request + window_seconds)
                return False, current_count, reset_time

            # 记录新请求
            requests.append(current_time)
            if key == "global":
                self.global_requests = requests
            else:
                self.requests[key] = requests

            # 计算剩余配额和重置时间
            remaining = max_requests - len(requests)
            reset_time = int(current_time + window_seconds)
            return True, remaining, reset_time

    def get_stats(self, key: str) -> Dict[str, int]:
        """获取当前统计"""
        with self.lock:
            if key == "global":
                requests = self._cleanup_old_requests(self.global_requests)
            else:
                requests = self._cleanup_old_requests(self.requests.get(key, []))

            return {
                "current_requests": len(requests),
                "window_seconds": 60
            }


# 全局限流器实例
rate_limiter = RateLimiter()