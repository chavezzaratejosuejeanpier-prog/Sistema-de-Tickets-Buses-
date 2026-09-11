import Button from '../common/Button.jsx'

export default function FloorTab({ piso, setPiso }) {
  return (
    <div className="flex gap-2 justify-center">
      {[1,2].map(p=>(
        <Button key={p} variant={piso===p? 'primary' : 'ghost'} className={piso===p ? 'px-5 py-1.5' : 'py-1.5'} onClick={()=>setPiso(p)}>
          Piso {p}
        </Button>
      ))}
    </div>
  )
}