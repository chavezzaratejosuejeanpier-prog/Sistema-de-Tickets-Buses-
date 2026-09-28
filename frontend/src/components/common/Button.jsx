const variants = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
}

export default function Button({ children, variant='primary', className, ...props }) {
  const base = variants[variant] || variants.primary
  return <button className={`${base} ${className || ''}`.trim()} {...props}>{children}</button>
}
