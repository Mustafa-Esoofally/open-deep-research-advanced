from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import requests
import logging

class ResearchRetry:
    @retry(stop=stop_after_attempt(3),
           wait=wait_exponential(multiplier=1, min=2, max=10),
           retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
           reraise=True,
           before_sleep=async_before_sleep_log(logger, logging.WARNING))
    async def api_call_with_retry(self, func, *args, **kwargs):
        return await func(*args, **kwargs)
