import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { SearchIcon, RegisterIcon, RevokeIcon, UpdateIcon } from './Icons'
import { TestnetFaucetButton } from './TestnetFaucetButton'
import styles from '../styles/layout.module.css'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { label: 'Find', path: '/find', Icon: SearchIcon },
    { label: 'Register', path: '/register', Icon: RegisterIcon },
    { label: 'Update', path: '/update', Icon: UpdateIcon },
    { label: 'Revoke', path: '/revoke', Icon: RevokeIcon },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className={styles.layout}>
      {/* Top Banner */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            Web3PGP: A global public key infrastructure for OpenPGP powered by Ethereum
          </h1>
          <div className={styles.headerActions}>
            <TestnetFaucetButton />
            <div className={styles.connectButton}>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Left Sidebar */}
        <aside className={styles.sidebar}>
          <nav className={styles.navigation}>
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span className={styles.icon}>
                  <item.Icon />
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* Bottom Banner */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p>&copy; 2026 Web3PGP. All rights reserved.</p>
          <nav className={styles.footerLinks}>
            <a href="#/about" className={styles.link}>About</a>
            <span className={styles.separator}>•</span>
            <a href="#/network" className={styles.link}>Network</a>
            <span className={styles.separator}>•</span>
            <a href="#/terms" className={styles.link}>Terms of Service</a>
            <span className={styles.separator}>•</span>
            <a href="#/privacy" className={styles.link}>Privacy Policy</a>
            <span className={styles.separator}>•</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.link}>GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
