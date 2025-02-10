interface MessageProps {
  content: string;
  type: 'user' | 'assistant';
}

export default function Message({ content, type }: MessageProps) {
  return (
    <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-4 py-2 ${
          type === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}
      >
        <p className="text-sm sm:text-base whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>
    </div>
  );
} 