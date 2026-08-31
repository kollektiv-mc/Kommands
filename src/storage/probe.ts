/**
 * The one question startup has to answer before anything renders: is there a local
 * backend?
 *
 * The standalone shell mounts `/api` on both of its surfaces — the webview and the
 * `--serve` browser listener — so the presence of `GET /api/capabilities` is what
 * separates a session that can write files from one that cannot. Presence of the
 * *backend*, deliberately: a user-agent sniff or a check for something the webview
 * injects would answer "am I in a browser", which gets the local-webapp surface wrong
 * — see `distribution.md` § One install, two surfaces.
 *
 * The probe runs once, before the first render (`main.tsx`), and everything after it
 * reads the cached answer synchronously. That ordering is load-bearing:
 * `storageKind()` is documented as fixed for the life of a session precisely so the
 * UI never re-renders into a different build — a probe that resolved *after* first
 * paint would flip the dashboard's affordances in front of the user.
 */

/** What the local backend answered, when one did. */
export interface LocalBackend {
  shellVersion: string
  /**
   * Whether a Konnekt install exists on this machine, per the shell's check of
   * Konnekt's data directory. Carried so Konnekt-facing affordances (#46) can be
   * shown only when they lead somewhere.
   */
  konnektPresent: boolean
}

/**
 * How long the probe waits before concluding there is no backend.
 *
 * The local shell answers in single-digit milliseconds; this bound exists for the
 * hosted site, where the request races the rest of module initialisation and a
 * hanging network must not hold the first render hostage. Generous relative to both.
 */
const PROBE_TIMEOUT_MS = 500

let probed: LocalBackend | null = null

/** The cached probe answer. `null` is "no local backend" — the hosted site's normal. */
export function probedBackend(): LocalBackend | null {
  return probed
}

/**
 * Test hook, mirroring `configureStorage`: hand the answer in rather than mocking
 * `fetch`, so tests exercise the same synchronous read path production does.
 */
export function configureProbe(override: LocalBackend | null): void {
  probed = override
}

/**
 * Whether an unknown response body is the capabilities answer.
 *
 * Strict on purpose. A static host serving this SPA answers unknown paths with
 * `index.html` and status 200, so "the request succeeded" proves nothing — the body
 * has to identify itself. Anything else (a proxy's error page, another app on the
 * same origin) reads as no backend rather than as a broken one.
 */
function asLocalBackend(body: unknown): LocalBackend | null {
  if (typeof body !== 'object' || body === null) return null
  const answer = body as Record<string, unknown>
  if (answer.app !== 'kommands') return null
  const shell = answer.shell
  const storage = answer.storage
  const konnekt = answer.konnekt
  if (typeof shell !== 'object' || shell === null) return null
  if (typeof storage !== 'object' || storage === null) return null
  const version = (shell as Record<string, unknown>).version
  if (typeof version !== 'string') return null
  if ((storage as Record<string, unknown>).kind !== 'file') return null
  const present =
    typeof konnekt === 'object' && konnekt !== null
      ? (konnekt as Record<string, unknown>).present === true
      : false
  return { shellVersion: version, konnektPresent: present }
}

/**
 * Ask, once. Never rejects: every failure mode — no route, a timeout, an HTML
 * fallback, a body that is not the answer — is the same result, "no local backend",
 * because that is what each of them means to the frontend.
 */
export async function probeLocalBackend(): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const response = await fetch('/api/capabilities', { signal: controller.signal })
      if (!response.ok) return
      // The SPA fallback fails here: index.html is not JSON.
      probed = asLocalBackend(await response.json())
    } finally {
      clearTimeout(timer)
    }
  } catch {
    probed = null
  }
}
