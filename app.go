package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"kommands/shell/marker"
	"kommands/shell/paths"
)

// App is the Wails-facing application object. It deliberately binds no methods
// to the frontend: the JS↔Go surface is the HTTP API in shell/api, mounted as
// asset-server middleware, because bindings exist only inside the webview and
// would fork the window surface from the browser surface at the first call.
type App struct {
	ctx     context.Context
	dataDir string
}

func NewApp(dataDir string) *App {
	return &App{dataDir: dataDir}
}

// startup runs once the runtime is ready. The install marker is written here
// rather than in main so it happens on every successful launch: Ensure is a
// no-op write when nothing changed, and an upgraded binary's first launch is
// exactly when the version field has to move.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := marker.Ensure(paths.MarkerPath(a.dataDir), Version, time.Now); err != nil {
		// Non-fatal: the marker is a beacon for Konnekt, not app state, and a
		// read-only data dir still deserves a working generator.
		slog.Warn("install marker", "error", err)
	}
}

// onSecondInstanceLaunch runs in the *first* instance when a second launch is
// refused by the single-instance lock. Raise and focus, which is the whole of
// the expected behaviour today.
//
// Takes the whole SecondInstanceData so that kommands:// handling (#43's
// inbound direction) is one added call here rather than a lifecycle change:
// the OS launches a second instance with the URL in argv and the lock forwards
// it as Args. Logged and dropped until that lands, so the path is visible
// before it exists — the same shape Konnekt chose for its side.
func (a *App) onSecondInstanceLaunch(data options.SecondInstanceData) {
	if a.ctx == nil {
		// The lock is held from wails.Run, before startup finishes. A launch
		// in that window has no window to raise yet.
		slog.Warn("second instance before startup", "args", len(data.Args))
		return
	}
	slog.Info("second instance", "args", data.Args, "cwd", data.WorkingDirectory)
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
}
