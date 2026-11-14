import { useRef, useState } from 'react'
import { Scenes } from './Scenes'
import { DownloadIcon, SiteFooter, SiteHeader, SitePage } from './SiteChrome'
import { SITE } from '../../data/home/site'

function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function Tile({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a className={primary ? 'dl-row primary' : 'dl-row'} href={href} rel="noopener noreferrer">
      <DownloadIcon />
      <span>{label}</span>
    </a>
  )
}

/**
 * The downloads: Windows, macOS, and Linux, which opens in place into its RPM and its
 * bare binary. Labels only, no file names.
 */
function Downloads() {
  const [open, setOpen] = useState(false)
  const rpm = useRef<HTMLAnchorElement>(null)
  return (
    <div>
      <Tile href={SITE.downloads.windows} label="Windows" primary />
      <Tile href={SITE.downloads.macos} label="macOS" />
      <div className={open ? 'dl-group open' : 'dl-group'}>
        <div className="dl-top">
          <button
            type="button"
            className="dl-row dl-more"
            aria-expanded={open}
            onClick={() => {
              setOpen(true)
              // After the commit that makes the RPM tile visible: focus skips a hidden one.
              requestAnimationFrame(() => rpm.current?.focus({ preventScroll: true }))
            }}
          >
            <DownloadIcon />
            <span>Linux</span>
            <Chevron />
          </button>
          <a
            ref={rpm}
            className="dl-row"
            href={SITE.downloads.linuxRpm}
            rel="noopener noreferrer"
            tabIndex={open ? undefined : -1}
          >
            <DownloadIcon />
            <span>Linux RPM</span>
          </a>
        </div>
        <div className="dl-sub">
          <div>
            <a
              className="dl-row"
              href={SITE.downloads.linuxBinary}
              rel="noopener noreferrer"
              tabIndex={open ? undefined : -1}
            >
              <DownloadIcon />
              <span>Linux binary</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The page the standalone app is downloaded from. See docs/home-page.md. */
export function DownloadPage() {
  return (
    <SitePage>
      <div className="site-wrap site-dl-page">
        <SiteHeader side="dashboard" />
        <div className="site-dl-main">
          <div className="site-dl-left">
            <h1>Download</h1>
            <span className="site-meta">
              {SITE.version} snapshot · Windows, macOS and Linux · MIT
            </span>
            <Downloads />
          </div>
          <Scenes />
        </div>
      </div>
      <div className="site-wrap site-dl-foot">
        <SiteFooter />
      </div>
    </SitePage>
  )
}
