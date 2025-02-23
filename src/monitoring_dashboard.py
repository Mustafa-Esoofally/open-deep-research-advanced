from langsmith import Client
from rich.console import Console
from rich.table import Table
import plotly.graph_objects as go
import pandas as pd

class ResearchDashboard:
    def __init__(self):
        self.client = Client()
        self.console = Console()
        
    def show_recent_runs(self, limit=10):
        runs = self.client.list_runs(project_name="AdvancedResearch", limit=limit)
        table = Table(title="Recent Research Runs")
        table.add_column("Run ID", style="cyan")
        table.add_column("Status", style="magenta")
        table.add_column("Duration", style="green")
        
        for run in runs:
            duration = f"{(run.end_time - run.start_time).total_seconds():.2f}s"
            table.add_row(str(run.id), run.status, duration)
        
        self.console.print(table)

    def visualize_metrics(self):
        runs = self.client.list_runs(project_name="AdvancedResearch", limit=100)
        df = pd.DataFrame([{
            "timestamp": run.start_time,
            "duration": (run.end_time - run.start_time).total_seconds(),
            "tokens": run.outputs.get('token_usage', 0)
        } for run in runs if run.status == "success"])
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=df['timestamp'], y=df['tokens'], name='Token Usage'))
        fig.add_trace(go.Scatter(x=df['timestamp'], y=df['duration'], name='Execution Time'))
        fig.update_layout(title="Research Performance Metrics")
        fig.show()

    def show_error_report(self):
        errors = self.client.list_feedback(run_ids=None, key="error")
        if errors:
            table = Table(title="Recent Errors")
            table.add_column("Timestamp", style="cyan")
            table.add_column("Error Message", style="red")
            for error in errors:
                table.add_row(str(error.timestamp), error.value)
            self.console.print(table)
