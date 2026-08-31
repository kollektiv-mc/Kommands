//go:build dev

package main

import (
	"github.com/wailsapp/wails/v2/pkg/options"
)

// A `wails dev` build takes no lock.
//
// Wails compiles with `-tags dev` under `wails dev` and `-tags desktop` under
// `wails build`, so this file and its !dev twin split exactly along the line
// that matters. Without the split, a packaged Kommands left running would
// silently swallow every `wails dev` launch: the second instance exits and
// raises the first, and the dev loop looks broken with no error anywhere.
// The same trade Konnekt documents in its singleinstance_dev.go.
func singleInstanceLock(_ *App) *options.SingleInstanceLock {
	return nil
}
