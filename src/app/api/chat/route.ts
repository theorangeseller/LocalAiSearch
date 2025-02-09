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
    const { message } = await req.json();
    const cleanMessage = message.trim();
    const encoder = new TextEncoder();

    // Get base URL from the request
    const baseUrl = new URL(req.url).origin;

    // First ask the AI model without searching
    const initialResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:1.5b',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant. For each question:
1. FIRST decide if you can answer confidently
2. Then IMMEDIATELY respond in ONE of these formats:
   - "<confident>Your complete answer here</confident>"
   - "<unsure>I need to search for accurate information about this topic</unsure>"

DO NOT:
- Use any other tags or formats
- Mix different formats together
- Include thinking process or explanations outside the tags

Example correct responses:
"<confident>The speed of light is approximately 299,792,458 meters per second.</confident>"
"<unsure>I need to search for accurate information about this topic</unsure>"

Example incorrect responses:
"Let me think... <confident>Answer</confident>"
"**Confident** <confident>Answer</confident>"
"<think>Thinking...</think> <confident>Answer</confident>"

Give your complete answer within a single tag pair.`
          },
          {
            role: 'user',
            content: `Question: ${cleanMessage}\n\nPlease assess and answer this question.`
          }
        ],
        stream: true
      }),
    });

    const stream = new ReadableStream({
      async start(controller) {
        const reader = initialResponse.body?.getReader();
        let initialAnswer = '';

        // Get the initial confidence check
        try {
          while (true) {
            const result = await reader?.read();
            if (!result) break;
            const { done, value } = result;
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(Boolean);
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  initialAnswer += json.message.content;
                }
              } catch (error) {
                console.error('Error parsing line:', error);
                continue;
              }
            }
          }

          // Check if the AI is unsure and needs to search
          if (initialAnswer.includes('<unsure>')) {
            // Perform web search using the same origin as the request
            const searchResponse = await fetch(`${baseUrl}/api/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: cleanMessage }),
            });

            if (!searchResponse.ok) {
              throw new Error('Search request failed');
            }

            const { searchResults } = await searchResponse.json();

            // Send initial results to client
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'initial',
                  content: cleanMessage,
                  searchResults
                }) + '\n'
              )
            );

            // Create context from search results
            const context = searchResults
              .map((result: { title: string; content: string }) => 
                `[${result.title}]\n${result.content}`
              )
              .join('\n\n');

            // Get final answer based on search results
            const llmResponse = await fetch('http://localhost:11434/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'deepseek-r1:1.5b',
                messages: [
                  {
                    role: 'system',
                    content: `You are a helpful AI assistant. Analyze the provided web search results and create well-structured, informative reports. 
                    Your reports should:
                    1. Start with a clear introduction
                    2. Include relevant information from multiple sources
                    3. Organize content into logical sections
                    4. Use bullet points or numbered lists when appropriate
                    5. End with a brief conclusion
                    6. Cite sources using [Source Title] format
                    
                    Keep your tone professional and ensure the information is accurate.`
                  },
                  {
                    role: 'user',
                    content: `Web search results:\n\n${context}\n\nQuestion: ${cleanMessage}\n\nPlease provide a detailed, well-structured report based on these search results.`
                  }
                ],
                stream: true
              }),
            });

            // Stream the final answer
            const finalReader = llmResponse.body?.getReader();
            let thinking = '';
            let answer = '';
            let isThinking = false;
            let hasShownAnswer = false;

            while (true) {
              const result = await finalReader?.read();
              if (!result) break;
              const { done, value } = result;
              if (done) break;

              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(Boolean);
              
              for (const line of lines) {
                try {
                  const json = JSON.parse(line);
                  if (json.message?.content) {
                    const content = json.message.content;
                    
                    if (content.includes('<think>')) {
                      isThinking = true;
                      thinking = '';
                    } else if (content.includes('</think>')) {
                      isThinking = false;
                      if (thinking) {
                        controller.enqueue(
                          encoder.encode(
                            JSON.stringify({ type: 'thinking', content: thinking }) + '\n'
                          )
                        );
                      }
                    } else if (isThinking) {
                      thinking += content;
                    } else {
                      if (!isThinking && !hasShownAnswer) {
                        answer += content;
                        controller.enqueue(
                          encoder.encode(
                            JSON.stringify({ type: 'answer', content: answer }) + '\n'
                          )
                        );
                      }
                    }
                  }
                } catch (error) {
                  console.error('Error parsing line:', error);
                  continue;
                }
              }
            }
          } else {
            // AI is confident, send the direct answer
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'answer', content: initialAnswer }) + '\n'
              )
            );
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
} 