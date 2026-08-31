//go:build !dev

package main

import (
	"github.com/wailsapp/wails/v2/pkg/options"
)

// singleInstanceLock stops a second Kommands launching against the same data
// directory. Everything under shell/store assumes one writer per file; the
// store's own mutex covers the two surfaces of one process, and this lock is
// what extends that to processes. Without it, two instances mean last-write-
// wins over store.json — and over the shared file Konnekt links against.
//
// The dev build gets no lock at all — see singleinstance_dev.go.
func singleInstanceLock(app *App) *options.SingleInstanceLock {
	return &options.SingleInstanceLock{
		UniqueId:               singleInstanceID,
		OnSecondInstanceLaunch: app.onSecondInstanceLaunch,
	}
}

// singleInstanceID names the lock the running instance holds.
//
// Deliberately chosen rather than generated, because it is a public name on
// every platform: a D-Bus name on Linux, a named mutex on Windows, a
// distributed-notification name on macOS. Wails collapses both '.' and '-' to
// '_' when building the bus name, so a variant differing only in punctuation
// is the *same* lock. Changing this string strands an already-running older
// build, which would no longer recognise the new one as a second instance —
// it is stable, not cosmetic. Mirrors Konnekt's "com.kollektiv.konnekt".
const singleInstanceID = "com.kollektiv.kommands"
