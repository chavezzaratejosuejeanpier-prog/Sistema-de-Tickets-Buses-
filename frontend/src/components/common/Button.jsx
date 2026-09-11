export default function Button({ children, variant='primary', ...props }) {
  const styles = variant === 'primary' ? 'btn-primary' : 'btn-accent'
  return <button className={styles} {...props}>{children}</button>
}
