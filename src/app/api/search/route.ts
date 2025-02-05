import { NextResponse } from 'next/server';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

if (!TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY is not set');
}

type TavilySearchResult = {
  title: string;
  content: string;
  url: string;
  domain: string;
};

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    
    const searchResponse = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': TAVILY_API_KEY as string,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: 4,
        include_domains: [],
        api_key: TAVILY_API_KEY
      }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Tavily API error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.results || !Array.isArray(searchData.results)) {
      throw new Error('Invalid response format from Tavily API');
    }

    const searchResults = searchData.results.slice(0, 4).map((result: TavilySearchResult) => ({
      title: result.title || 'Untitled',
      content: result.content || '',
      url: result.url || '#',
      domain: result.domain || new URL(result.url).hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${result.domain || new URL(result.url).hostname}`
    }));

    return NextResponse.json({ searchResults });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
} 