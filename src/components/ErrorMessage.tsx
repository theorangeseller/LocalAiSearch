type ErrorMessageProps = {
  error: string;
};

export default function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <div className="p-4 bg-red-50 text-red-500 rounded-lg mt-4">
      {error}
    </div>
  );
} 