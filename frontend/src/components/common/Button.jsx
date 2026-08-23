export default function Button({ children, variant='primary', ...props }) {
  const styles = variant === 'primary' ? 'bg-primary text-white hover:bg-primary-light' : 'bg-accent text-white hover:bg-accent-hover'
  return <button className={`px-6 py-2 rounded font-medium transition ${styles}`} {...props}>{children}</button>
}
