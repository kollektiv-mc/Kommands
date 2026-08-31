// The standalone shell (#44): the same Vite build the web deploy serves, inside
// a Wails v2 window, with the command data embedded so the app works with no
// internet at all. docs/distribution.md owns the reasoning; this file only
// assembles it.
//
// Building this package needs two things the pure-Go shell packages do not:
// the built frontend (`pnpm build`, because of the go:embed below) and, on
// Linux, the webkit2gtk/gtk3 development headers Wails compiles against. That
// is why the health manifest declares `go vet`/`go test` over ./shell/... —
// runnable in any container — while compiling this package is a CI step with
// the system dependencies installed. See .claude/suite.json.
package main

import (
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"

	"kommands/shell/api"
	"kommands/shell/paths"
	"kommands/shell/serve"
)

//go:embed all:dist
var assets embed.FS

// The window icon GTK is handed on Linux — the one platform that gets no icon
// unless it is passed explicitly. 256px, matching Konnekt's reasoning: a
// full-size source would be decoded into a huge pixbuf to draw a taskbar entry.
//
//go:embed build/appicon-256.png
var appIcon []byte

// shellFlags are the launch options. Parsed leniently: a GUI launch with an
// argument this build does not know (an OS handing over a kommands:// URL, a
// future flag, a wails dev artefact) still opens the window rather than dying
// over argv nobody can see.
type shellFlags struct {
	serve     bool
	servePort int
}

func parseFlags(args []string) shellFlags {
	parsed := shellFlags{}
	set := flag.NewFlagSet("kommands", flag.ContinueOnError)
	set.BoolVar(&parsed.serve, "serve", false,
		"also serve the UI to a browser on localhost (the local-webapp surface)")
	set.IntVar(&parsed.servePort, "serve-port", 8642, "port for --serve, bound to 127.0.0.1 only")
	set.SetOutput(os.Stderr)
	if err := set.Parse(args); err != nil {
		slog.Warn("ignoring unrecognised launch arguments", "error", err)
	}
	return parsed
}

func main() {
	flags := parseFlags(os.Args[1:])
	dataDir := paths.DataDir()
	slog.Info("starting", "version", Version, "dataDir", dataDir)

	apiHandler := api.New(api.Config{
		ShellVersion:   Version,
		StorePath:      paths.StorePath(dataDir),
		SharedPath:     paths.SharedPath(dataDir),
		KonnektPresent: paths.KonnektPresent,
	})

	if flags.serve {
		dist, err := fs.Sub(assets, "dist")
		if err != nil {
			slog.Error("embedded assets missing dist", "error", err)
		} else {
			startBrowserSurface(flags.servePort, dist, apiHandler)
		}
	}

	app := NewApp(dataDir)

	err := wails.Run(&options.App{
		Title:     "Kommands",
		Width:     1440,
		Height:    900,
		MinWidth:  1024,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// The one JS↔Go surface, shared verbatim with the browser surface:
			// a fetch('/api/…') resolves against the asset server in here and
			// against the listener out there, so the frontend cannot tell the
			// two apart — which is the requirement, since "can this session
			// link" must test for the backend, not for the presentation.
			Middleware: mountAPI(apiHandler),
		},
		// The app draws its own title bar. Frameless is not "no window
		// management": Wails' injected runtime still arms a resize border
		// around the webview and still honours the window manager's own
		// snapping, so what is given up is the system bar's wordmark and its
		// three buttons - which src/components/TitleBar.tsx now draws, themed
		// like every other surface in the app rather than by the desktop.
		//
		// Konnekt is frameless for the same reason and says so in the same
		// words. Matching it is the point: the two products are one suite, and
		// a user with both should not have to learn two window bars.
		Frameless: true,
		// --bg-base as src/lib/theme.ts computes it for the dark skin
		// (#1c1612), so the instant before first paint is the same colour as
		// the app that follows it. Neither the token pipeline nor the skin can
		// reach Go; this restates the result, and drift shows up as a coloured
		// flash on launch rather than silently. productSkin() in that file is
		// exported so the value can be read rather than guessed at.
		BackgroundColour: &options.RGBA{R: 28, G: 22, B: 18, A: 255},
		Linux: &linux.Options{
			Icon: appIcon,
			// Restates the default Wails applies when Linux options are nil —
			// supplying an icon would otherwise silently change the GPU policy
			// to this struct's zero value. Kept at Always, unlike Konnekt's
			// Never: the 3D previews are this product's centrepiece, and
			// software rendering would tax exactly the feature the standalone
			// build exists to carry offline. Revisit against wailsapp/wails#2977
			// if rendering artefacts appear.
			WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
		},
		OnStartup:          app.startup,
		SingleInstanceLock: singleInstanceLock(app),
	})
	if err != nil {
		slog.Error("wails run", "error", err)
	}
}

// mountAPI routes /api into the shared handler and hands everything else to
// the asset server.
func mountAPI(apiHandler http.Handler) assetserver.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
				apiHandler.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// startBrowserSurface brings up the local-webapp surface beside the window.
// Loopback only, by construction rather than by flag: the bind address is not
// configurable, because serving a command generator to the LAN is a feature
// nobody asked for and the single-instance work does not cover.
func startBrowserSurface(port int, dist fs.FS, apiHandler http.Handler) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	server := &http.Server{
		Addr:              addr,
		Handler:           serve.Handler(dist, apiHandler),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		slog.Info("browser surface listening", "url", "http://"+addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// Non-fatal: the window surface stands on its own, and the most
			// likely failure is the port being taken by an earlier instance.
			slog.Error("browser surface", "error", err)
		}
	}()
}
