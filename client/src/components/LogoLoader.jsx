export default function LogoLoader({ page = false, panel = false }) {
  const place = panel ? ' in-panel' : page ? ' in-page' : ''
  return (
    <div className={`loading-screen${place}`} role="status" aria-live="polite" aria-label="Loading">
      <img className="loading-logo" src="/as-logo.png" alt="" />
    </div>
  )
}
