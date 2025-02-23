from langchain.callbacks.base import BaseCallbackHandler
from datetime import datetime
import json

class ResearchCostTracker(BaseCallbackHandler):
    def __init__(self):
        super().__init__()
        self.total_cost = 0.0
        self.usage_history = []
        
    def on_llm_end(self, response, run_id, parent_run_id=None, **kwargs):
        """Handle new parent_run_id parameter"""
        if hasattr(response, 'llm_output') and response.llm_output:
            cost = response.llm_output.get('cost', 0)
            token_usage = response.llm_output.get('token_usage', {})
        else:
            # Estimate cost based on token usage for OpenRouter
            token_usage = {
                'prompt_tokens': getattr(response, 'prompt_tokens', 0),
                'completion_tokens': getattr(response, 'completion_tokens', 0),
                'total_tokens': getattr(response, 'total_tokens', 0)
            }
            # Approximate cost calculation for Claude-3.5
            cost = (token_usage['prompt_tokens'] * 0.000012) + \
                   (token_usage['completion_tokens'] * 0.000060)
        
        self.total_cost += cost
        self.usage_history.append({
            "timestamp": datetime.now().isoformat(),
            "model": kwargs.get("model", "anthropic/claude-3-opus"),
            "tokens": token_usage,
            "cost": cost,
            "run_id": run_id
        })
        
    def generate_report(self):
        """Generate a cost and usage report"""
        return {
            "total_cost": round(self.total_cost, 6),
            "total_requests": len(self.usage_history),
            "model_breakdown": self._model_breakdown()
        }
        
    def _model_breakdown(self):
        """Break down usage by model"""
        breakdown = {}
        for entry in self.usage_history:
            model = entry["model"]
            if model not in breakdown:
                breakdown[model] = {
                    "count": 0,
                    "cost": 0.0,
                    "total_tokens": 0
                }
            breakdown[model]["count"] += 1
            breakdown[model]["cost"] += entry["cost"]
            breakdown[model]["total_tokens"] += entry["tokens"].get("total_tokens", 0)
        return breakdown

    def save_report(self, path="cost_report.json"):
        """Save the usage report to a file"""
        with open(path, "w") as f:
            json.dump(self.generate_report(), f, indent=2)
