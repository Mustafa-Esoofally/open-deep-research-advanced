# Open Advanced Deep Research

Open Deep Research is an AI-powered, iterative research assistant that leverages search engines, web scraping, and large language models to conduct deep research on any topic. It refines its research direction dynamically based on user feedback and previous learnings, ultimately generating a comprehensive Markdown report with detailed insights and sources.

Inspired by [Deep Research](https://github.com/dzhng/deep-research) by [Dzhng](https://github.com/dzhng).

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [New Features](#new-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)
- [References](#references)

## Overview
Open Deep Research is designed as a minimalistic yet powerful research agent that automatically refines its research process. By generating specific SERP queries and processing the results recursively, it collects in-depth learnings on any topic. The resulting Markdown report aggregates insights, key entities, and sources to support rapid decision-making and further exploration.

## Features
- **Iterative Research:** Reassesses and refines research direction based on follow-up queries.
- **Intelligent Query Generation:** Uses large language models to create unique, targeted SERP queries.
- **Customizable Depth & Breadth:** Configure research breadth (number of queries per iteration) and depth (levels of recursion).
- **Comprehensive Reporting:** Produces detailed Markdown reports that include learnings and visited URLs as sources.
- **Real-time Progress Tracking:** Monitors research progress with live updates during the process.

## Upcoming Features
- **Intelligent Research Direction:** Decide on the best research direction based on the most relevant queries and results (auto depth and breadth).
- **Web Dashboard & Interactive UI:** Leverage Shadcn components to build a modern, interactive web interface for real-time progress monitoring and data visualization.
- **Research Templates:** Curated web templates for common research scenarios (market analysis, technical due diligence).
- **Knowledge Graph Visualization:** Interactive force-directed graph showing connections between research concepts.
- **Multi-Lingual Support:** Extend research capabilities to support queries and results in multiple languages.
- **Advanced Reporting Formats:** Offer export options for final reports in additional formats such as PDF, Word, PowerPoint and HTML.

## Requirements
- **Node.js** (version 22.x recommended)
- Environment variables setup:
  - `FIRECRAWL_KEY` – Your Firecrawl API key.
  - (Optional) `FIRECRAWL_BASE_URL` – Base URL for self-hosted Firecrawl.
  - `OPENAI_KEY` – Your OpenAI API key (or configure local endpoint/model for a local LLM).
  - For users leveraging OpenRouter, set your `OPENROUTER_API_KEY`.
- A stable internet connection.

## Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/open-deep-research.git
   ```
2. **Navigate into the project directory:**
   ```bash
   cd open-deep-research
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set up environment variables:**
   Create a `.env.local` file in the root directory and populate it with the necessary keys:
   ```bash
   FIRECRAWL_KEY="your_firecrawl_key"
   # Optional:
   # FIRECRAWL_BASE_URL="http://localhost:3002"
   OPENAI_KEY="your_openai_key"
   ```
   > For local language model setups, comment out `OPENAI_KEY` and instead set `OPENAI_ENDPOINT` and `OPENAI_MODEL`.

## Usage
To start the research assistant, run: