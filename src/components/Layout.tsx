import React from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
} 