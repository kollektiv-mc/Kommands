import { Link } from '@tanstack/react-router'
import { Hero } from './Hero'
import { FeatureShape } from './FeatureShape'
import { DownloadIcon, SiteFooter, SiteHeader, SitePage } from './SiteChrome'
import { COMMAND_COUNT, FEATURES, SITE } from '../../data/home/site'

/**
 * The web build's `/`: the hero, what Kommands works with, its four generators and the
 * way to get it. docs/home-page.md is the design. A page that scrolls, unlike the app,
 * because it is a page: the dashboard is one click away and never scrolls.
 */
export function HomePage() {
  return (
    <SitePage>
      <div className="site-wrap">
        <SiteHeader side="github" />
        <div className="site-hero">
          <h1 className="site-sr">Kommands, a Minecraft command generator</h1>
          <Hero />
          <div className="site-hero-row">
            <Link className="site-btn site-btn-secondary" to="/dashboard">
              Open Dashboard
            </Link>
            <span className="site-meta">Java Edition 1.21.1 · WorldEdit · free, MIT</span>
          </div>
        </div>
        <div className="site-blocks pb-12">
          <div className="site-block site-strip">
            <span className="site-strip-label">Works with</span>
            <span className="site-strip-item">Vanilla 1.21.1</span>
            <span className="site-strip-item">WorldEdit</span>
            <span className="site-strip-item">Konnekt</span>
          </div>
          <section className="site-block" aria-labelledby="site-generators">
            <div className="site-band">
              <span className="site-num">01</span>
              <h2 id="site-generators">Generators</h2>
            </div>
            <div className="site-feats">
              <div className="site-feat">
                <div className="site-vis">
                  <div className="site-chips">
                    {FEATURES.commands.map((c) => (
                      <span key={c.text} data-on={'on' in c ? '' : undefined}>
                        {c.text}
                      </span>
                    ))}
                  </div>
                </div>
                <h3>{COMMAND_COUNT} Commands</h3>
                <p>Every vanilla command tree from Java Edition 1.21.1.</p>
              </div>
              <div className="site-feat">
                <div className="site-vis">
                  <FeatureShape />
                </div>
                <h3>3D Editor</h3>
                <p>Shape a //generate structure in 3D, and the expression writes itself.</p>
              </div>
              <div className="site-feat">
                <div className="site-vis">
                  <div className="site-exec">
                    {FEATURES.execute.map((s) => (
                      <span key={s.keyword} data-on={'on' in s ? '' : undefined}>
                        <b className={`hero-k${s.colour} text-(--hc)`}>{s.keyword}</b>
                        {s.value}
                      </span>
                    ))}
                  </div>
                </div>
                <h3>Execute Builder</h3>
                <p>/execute as a stack of steps, in the order they run.</p>
              </div>
              <div className="site-feat">
                <div className="site-vis">
                  <div className="site-dash">
                    {FEATURES.dashboard.map((d) => (
                      <span key={d.name} data-on={'on' in d ? '' : undefined}>
                        {d.name}
                        <small>{d.command}</small>
                      </span>
                    ))}
                  </div>
                </div>
                <h3>Command Dashboard</h3>
                <p>Saved commands in groups, with tags and pins, linked into Konnekt.</p>
              </div>
            </div>
          </section>
          <section className="site-block site-get" aria-labelledby="site-get">
            <span className="site-meta">{SITE.version} snapshot · Windows, macOS and Linux</span>
            <h2 id="site-get">Get Kommands.</h2>
            <div className="site-actions">
              <Link className="site-btn site-btn-primary site-btn-block" to="/download">
                <DownloadIcon />
                Download
              </Link>
              <Link className="site-btn site-btn-secondary site-btn-block" to="/dashboard">
                Open Dashboard
              </Link>
            </div>
          </section>
          <div className="site-block">
            <SiteFooter />
          </div>
        </div>
      </div>
    </SitePage>
  )
}
