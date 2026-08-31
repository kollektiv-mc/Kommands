// Package paths resolves where the standalone shell keeps its data, and where
// Konnekt keeps its.
//
// Both applications compute their data directory from the same
// os.UserConfigDir() call, which is the load-bearing consequence of choosing
// Wails for both (docs/distribution.md § The shell is Wails v2): neither app
// has to discover the other's directory, because each derives both by
// construction. Konnekt's equivalent is backend/services/datadir.go in its own
// repository; a change to the shape of either path is a cross-repo break.
package paths

import (
	"os"
	"path/filepath"
)

// The file names under DataDir(). Named here rather than at each writer so the
// full set of files this app owns is one list. Konnekt reads SharedFileName and
// stats MarkerFileName; StoreFileName is private to this app.
const (
	// StoreFileName holds the canonical saved commands — the full value trees,
	// in the same envelope the web build keeps in localStorage. Konnekt never
	// reads it. See docs/persistence.md § Where it is stored.
	StoreFileName = "store.json"
	// SharedFileName is the projection Konnekt reads, in the schema its reader
	// pins (its backend/models/kommands.go). See docs/persistence.md § The
	// shared file.
	SharedFileName = "saved-commands.json"
	// MarkerFileName tells Konnekt a standalone install exists without it
	// having to discover a binary (#44).
	MarkerFileName = "install.json"
)

// DataDir is the directory every file this app persists lands in.
//
// Falls back to "." when the platform lookup fails, matching Konnekt's
// DataDir(): a relative data dir is bad, but refusing to start is worse for a
// local-first app, and the first write still reports a real error naming the
// directory.
func DataDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	return filepath.Join(configDir, "kommands")
}

// KonnektDataDir is where Konnekt keeps its data, derived rather than
// discovered — the same stdlib call, its directory name instead of ours.
func KonnektDataDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	return filepath.Join(configDir, "konnekt")
}

// KonnektPresent is whether a Konnekt install has left its data directory
// behind. One os.Stat, mirroring how Konnekt checks for this app's marker: the
// affordances that lead to Konnekt are worth showing only when they lead
// somewhere (#46), and this is the closest a local process can get to knowing.
func KonnektPresent() bool {
	info, err := os.Stat(KonnektDataDir())
	return err == nil && info.IsDir()
}

// StorePath, SharedPath and MarkerPath join DataDir() with the file names
// above, so callers hold whole paths rather than assembling them.
func StorePath(dataDir string) string  { return filepath.Join(dataDir, StoreFileName) }
func SharedPath(dataDir string) string { return filepath.Join(dataDir, SharedFileName) }
func MarkerPath(dataDir string) string { return filepath.Join(dataDir, MarkerFileName) }
