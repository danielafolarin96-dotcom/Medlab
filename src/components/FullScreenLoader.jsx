export default function FullScreenLoader() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-canvas">
      <div className="flex items-center gap-3 text-text-secondary">
        <span className="h-2.5 w-2.5 rounded-full bg-teal animate-pulse" />
        <span className="h-2.5 w-2.5 rounded-full bg-teal animate-pulse [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-teal animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  )
}
