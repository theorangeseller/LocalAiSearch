'use client';

import { useState } from 'react';

type SearchResult = {
  title: string;
  content: string;
  url: string;
  domain: string;
  favicon: string;
  published_date?: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  searchResults?: SearchResult[];
};

type StreamingContent = {
  thinking: string;
  answer: string;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<StreamingContent>({ thinking: '', answer: '' });
  const [lastThinking, setLastThinking] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      // Add an initial assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          const data = JSON.parse(line);
          
          if (data.type === 'initial') {
            // Update the last message with search results
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.searchResults = data.searchResults.map(result => ({
                  title: result.title,
                  url: result.url,
                  favicon: result.favicon
                }));
              }
              return newMessages;
            });
          } else if (data.type === 'thinking') {
            // Update thinking in the last message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.thinking = data.content;
              }
              return newMessages;
            });
          } else if (data.type === 'answer') {
            // Update content in the last message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content = data.content;
              }
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {messages.length === 0 ? (
        // Initial landing page
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-[2.5rem] font-medium text-[#111827] mb-8 tracking-tight">
              What do you want to know?
            </h1>

            {/* Powered by OS News button */}
            <div className="mb-8">
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <span className="text-sm font-medium text-gray-600">Powered by OS News</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full max-w-2xl mb-12">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask anything..."
                  className="w-full px-4 py-3 text-[15px] rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center w-8 h-8 bg-[#374151] text-white rounded-lg disabled:opacity-50 hover:bg-[#4B5563] transition-colors"
                  >
                    →
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        // Chat interface
        <div className="flex flex-col h-screen">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
              {messages.map((message, index) => (
                <div key={index} className="space-y-6">
                  {/* Question */}
                  {message.role === 'user' && (
                    <h2 className="text-2xl font-medium text-gray-900">
                      {message.content}
                    </h2>
                  )}

                  {/* Sources */}
                  {message.searchResults && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="text-gray-400">•</span> Sources
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {message.searchResults.map((result, idx) => (
                          <a
                            key={idx}
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            <img
                              src={result.favicon}
                              alt=""
                              className="w-4 h-4 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                                {result.title}
                              </h4>
                              <p className="text-sm text-gray-500 truncate">
                                {result.domain}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thinking Process */}
                  {message.thinking && (
                    <div>
                      <div className="font-medium text-sm mb-2">Thinking Process</div>
                      <div className="text-gray-600 bg-gray-50 p-4 rounded-xl text-[15px] leading-relaxed">
                        {message.thinking}
                      </div>
                    </div>
                  )}

                  {/* Streaming Answer */}
                  {message.role === 'assistant' && (
                    <div>
                      {/* Show the AI's answer */}
                      {message.content && (
                        <div>
                          <div className="font-medium text-sm mb-2">Answer</div>
                          <div className="text-[15px] leading-relaxed mb-2">
                            {message.content}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Live Thinking Process */}
              {streaming.thinking && (
                <div>
                  <div className="font-medium text-sm mb-2">Thinking Process</div>
                  <div className="text-gray-600 bg-gray-50 p-4 rounded-xl text-[15px] leading-relaxed">
                    {streaming.thinking}
                  </div>
                </div>
              )}

              {/* Live Streaming Answer */}
              {streaming.answer && (
                <div>
                  <div className="font-medium text-sm mb-2">Answer</div>
                  <div className="text-[15px] leading-relaxed">
                    {streaming.answer}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && !streaming.thinking && !streaming.answer && (
                <div>
                  <div className="font-medium text-sm mb-2">Answer</div>
                  <div className="text-[15px] animate-pulse">Thinking...</div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed input bar at bottom */}
          <div className="border-t border-gray-200 bg-white py-4 px-4">
            <div className="max-w-5xl mx-auto">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask follow-up"
                  className="w-full px-4 py-2 text-[15px] rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center w-8 h-8 bg-[#374151] text-white rounded-lg disabled:opacity-50 hover:bg-[#4B5563] transition-colors"
                  >
                    →
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
