# Deep Research

An AI-powered research assistant for deep analysis and exploration. This application allows users to enter research queries and receive comprehensive, AI-generated analysis with sources.

## Features

- AI-powered research with web search capabilities
- Real-time streaming of research results
- Source extraction and organization
- Interactive UI with research summary and sources panel
- Markdown rendering for rich content display

## Project Structure

```
app/
├── api/                  # API routes
│   └── research/         # Research API endpoint
├── components/           # UI components
│   ├── research/         # Research-related components
│   ├── ui/               # UI components from shadcn
│   └── theme-provider.tsx # Theme provider component
├── lib/                  # Utility functions and models
│   ├── models/           # AI models
│   │   └── research-agent.ts # LangChain research agent
│   └── utils.ts          # Utility functions
├── styles/               # Global styles
├── layout.tsx            # Root layout component
└── page.tsx              # Home page component
```

## Technologies Used

- Next.js 14 with App Router
- React
- TypeScript
- LangChain for AI agent capabilities
- ShadCN UI components
- Tailwind CSS for styling

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn
- OpenRouter API key
- FireCrawl API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/deep-research.git
   cd deep-research
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the app directory with the following variables:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   APP_URL=http://localhost:3000
   APP_NAME=Deep Research
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a research query in the input field at the bottom of the page.
2. Click the "Research" button or press Enter to start the research process.
3. View the research results in the main panel.
4. Explore sources in the side panel by clicking on the "Sources" tab.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
