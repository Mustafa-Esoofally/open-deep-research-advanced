# Advanced Deep Research

An AI-powered, iterative research assistant that conducts deep research on any topic.

## Features

- Interactive command-line interface
- Configurable research depth and breadth
- Real-time progress tracking
- Iterative research with follow-up questions

## Installation

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install the package
pip install -e .
```

## Usage

```bash
# Interactive mode
python -m src.cli research

# Non-interactive mode
python -m src.cli research --query "your query" --depth 3 --breadth 4
```

### Parameters

- `depth`: Number of research iterations (1-5)
- `breadth`: Number of parallel queries per iteration (2-10)

## Project Structure

```
.
├── src/
│   ├── __init__.py
│   ├── cli.py        # Command-line interface
│   └── research.py   # Core research functionality
├── pyproject.toml    # Project configuration
└── README.md        # This file
