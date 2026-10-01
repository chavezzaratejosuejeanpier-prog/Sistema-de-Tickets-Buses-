import Button from '../common/Button.jsx'

export default function FloorTab({ piso, setPiso }) {
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2].map(p => (
        <Button
          key={p}
          variant={piso === p ? 'primary' : 'ghost'}
          aria-pressed={piso === p}
          onClick={() => setPiso(p)}
        >
          Piso {p}
          <span className="hidden sm:inline font-normal ml-1.5 opacity-70">
            {p === 1 ? '• VIP' : '• Estándar'}
          </span>
        </Button>
      ))}
    </div>
  )
}
