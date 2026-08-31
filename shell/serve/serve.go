// Package serve is the local-webapp surface: the same UI and the same API the
// window shows, offered to a browser on localhost (#44's second presentation).
//
// The browser is only a rendering surface — this process remains the thing
// touching the filesystem, which is why sessions served this way can still
// link into Konnekt. Off by default; the --serve flag turns it on.
package serve

import (
	"io/fs"
	"net"
	"net/http"
	"strings"
)

// Handler serves the embedded frontend with an SPA fallback, and routes /api
// to the shared API handler — the same one the Wails asset server mounts, so
// the two surfaces cannot drift.
func Handler(assets fs.FS, api http.Handler) http.Handler {
	return guardHost(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
			api.ServeHTTP(w, r)
			return
		}
		serveAsset(assets, w, r)
	}))
}

// guardHost refuses requests whose Host is not a loopback name. The listener
// already binds 127.0.0.1, but binding does not stop DNS rebinding: a hostile
// page can point its own domain at 127.0.0.1 and fetch same-origin against it,
// and the Host header naming that domain is the one signal that survives.
// Saved commands feed a file another application runs against a live world, so
// this surface stays closed to anything that is not genuinely local.
func guardHost(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hostAllowed(r.Host) {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func hostAllowed(hostport string) bool {
	host := hostport
	if split, _, err := net.SplitHostPort(hostport); err == nil {
		host = split
	}
	host = strings.Trim(host, "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// serveAsset serves a built file when one exists, and index.html otherwise —
// the router owns paths like /dashboard, so a missing *extensionless* path is
// a client route, not a 404. A missing path that names a file (anything with
// an extension) stays a 404: masking a broken asset reference behind
// index.html turns a build problem into a blank page with a 200.
func serveAsset(assets fs.FS, w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}

	if info, err := fs.Stat(assets, path); err == nil && !info.IsDir() {
		http.ServeFileFS(w, r, assets, path)
		return
	}

	base := path[strings.LastIndex(path, "/")+1:]
	if strings.Contains(base, ".") {
		http.NotFound(w, r)
		return
	}
	http.ServeFileFS(w, r, assets, "index.html")
}
