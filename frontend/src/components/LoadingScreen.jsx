export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-ht-accent/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-ht-accent to-purple-500 flex items-center justify-center text-3xl shadow-lg animate-pulse">
            🌱
          </div>
        </div>
        <p className="text-text-secondary text-sm font-medium tracking-wide">
          {message}
          <span className="inline-flex ml-0.5">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '200ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '400ms' }}>.</span>
          </span>
        </p>
      </div>
    </div>
  );
}
