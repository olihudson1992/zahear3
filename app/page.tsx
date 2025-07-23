export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Welcome</h1>
        <p className="text-white/70 mb-8">Visit the elemental experience:</p>
        <a
          href="/zahear"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Enter Zahear
        </a>
      </div>
    </div>
  )
}
