export default function FloorTab({ piso, setPiso }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex p-1 bg-gray-100 rounded-full border border-gray-200">
        {[1, 2].map((p) => (
          <button
            key={p}
            onClick={() => setPiso(p)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              piso === p
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-600 hover:text-primary hover:bg-white'
            }`}
          >
            Piso {p}
            <span className="hidden sm:inline font-normal ml-1.5 opacity-70">
              {p === 1 ? '• VIP' : '• Estándar'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
