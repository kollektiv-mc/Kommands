import { useEffect, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { DotGrid } from '../dashboard/DotGrid'
import { BrandMark } from './BrandMark'
import { markSiteSeen } from '../../lib/siteEntry'
import { SITE } from '../../data/home/site'
import '../../styles/site.css'

/** The download arrow beside every Download. */
export function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1v9M3 6.5 7 10.5 11 6.5M1.5 13h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

/**
 * The ground and frame both site pages share: the dashboard's own dot grid behind
 * everything, so leaving for the dashboard does not change the ground under it, and
 * the page scrolling as a page, which the app never does.
 */
export function SitePage({ children }: { children: ReactNode }) {
  useEffect(markSiteSeen, [])
  return (
    <div className="site">
      <div className="site-dots">
        <DotGrid />
      </div>
      {children}
    </div>
  )
}

/**
 * The header: the mark and name on the left; on the right a plain link (GitHub on the
 * home page, Open Dashboard on the download page) beside Download.
 */
export function SiteHeader({ side }: { side: 'github' | 'dashboard' }) {
  return (
    <header className="site-head">
      <Link to="/" className="site-brand">
        <BrandMark />
        Kommands
      </Link>
      {side === 'github' ? (
        <a className="site-link" href={SITE.repository} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      ) : (
        <Link className="site-link" to="/dashboard">
          Open Dashboard
        </Link>
      )}
      <Link className="site-btn site-btn-outline" to="/download">
        <DownloadIcon />
        Download
      </Link>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <span>Kommands · Konnekt</span>
      <span>Not affiliated with Mojang or Microsoft</span>
    </footer>
  )
}
