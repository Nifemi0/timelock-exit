import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { live } from '../lib/config'
import { short } from '../lib/format'
import { useViewedAddress } from '../lib/useAppData'
import { Mark } from './bits'
import { Wallet } from './Wallet'

export function Layout() {
  const { pathname, search } = useLocation()
  const viewed = useViewedAddress()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="frame">
      <header className="top">
        <Link className="brand" to="/">
          <Mark />
          Timelock Exit
        </Link>
        <nav className="menu" aria-label="Main">
          <NavLink to={{ pathname: '/app', search }} end>
            Overview
          </NavLink>
          <NavLink to={{ pathname: '/app/guards', search }}>Guards</NavLink>
          <NavLink to={{ pathname: '/app/activity', search }}>Activity</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
        </nav>
        <div className="net tag w">
          <span className="sq" />
          Base Sepolia
        </div>
        <Wallet />
      </header>

      {!live && (
        <div className="notice" role="note">
          <span className="tag a">[ Demo data ]</span>
          <span className="tag">Contracts are not connected yet. Every figure, address and hash shown is a sample.</span>
        </div>
      )}

      {live && viewed.readOnly && viewed.address && (
        <div className="notice" role="note">
          <span className="tag b">[ Read only ]</span>
          <span className="tag">Viewing {short(viewed.address)}. Connect a wallet to arm your own guard.</span>
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="foot">
        <span className="tag">Timelock Exit · Testnet · Unaudited</span>
        <span className="tag">Built on Reactive Network</span>
      </footer>
    </div>
  )
}
