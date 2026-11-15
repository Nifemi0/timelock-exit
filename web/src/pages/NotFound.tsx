import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="hero solo">
      <div className="lead">
        <span className="tag">// 404</span>
        <h1 className="display sm">
          Nothing queued
          <br />
          <em>at this address.</em>
        </h1>
        <p className="lede">The page you asked for does not exist.</p>
        <div className="cta">
          <Link className="btn fill" to="/">
            Back to start
          </Link>
          <Link className="btn" to="/app">
            Open the app
          </Link>
        </div>
      </div>
    </section>
  )
}
