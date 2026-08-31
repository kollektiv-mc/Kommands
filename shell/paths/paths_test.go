package paths

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// On Linux os.UserConfigDir reads XDG_CONFIG_HOME, so pointing it at a temp
// directory pins both derivations without touching the real machine. The suite
// runs on Linux in CI; on other platforms the env var is not consulted, so the
// redirection tests are skipped rather than asserted wrongly.
func setConfigHome(t *testing.T) string {
	t.Helper()
	if runtime.GOOS != "linux" {
		t.Skip("XDG_CONFIG_HOME redirection is Linux-only")
	}
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)
	return dir
}

func TestDataDirAndKonnektDirShareOneRoot(t *testing.T) {
	root := setConfigHome(t)
	if got, want := DataDir(), filepath.Join(root, "kommands"); got != want {
		t.Fatalf("DataDir() = %q, want %q", got, want)
	}
	if got, want := KonnektDataDir(), filepath.Join(root, "konnekt"); got != want {
		t.Fatalf("KonnektDataDir() = %q, want %q", got, want)
	}
	// The invariant the design leans on: the two differ only in the leaf.
	if filepath.Dir(DataDir()) != filepath.Dir(KonnektDataDir()) {
		t.Fatalf("data dirs do not share a parent: %q vs %q", DataDir(), KonnektDataDir())
	}
}

func TestKonnektPresent(t *testing.T) {
	root := setConfigHome(t)
	if KonnektPresent() {
		t.Fatal("KonnektPresent() = true with no konnekt directory")
	}
	// A stray *file* named konnekt is not an install.
	if err := os.WriteFile(filepath.Join(root, "konnekt"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if KonnektPresent() {
		t.Fatal("KonnektPresent() = true for a plain file")
	}
	if err := os.Remove(filepath.Join(root, "konnekt")); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "konnekt"), 0o755); err != nil {
		t.Fatal(err)
	}
	if !KonnektPresent() {
		t.Fatal("KonnektPresent() = false with the directory present")
	}
}

func TestFilePaths(t *testing.T) {
	dir := t.TempDir()
	if got, want := StorePath(dir), filepath.Join(dir, "store.json"); got != want {
		t.Fatalf("StorePath = %q, want %q", got, want)
	}
	if got, want := SharedPath(dir), filepath.Join(dir, "saved-commands.json"); got != want {
		t.Fatalf("SharedPath = %q, want %q", got, want)
	}
	if got, want := MarkerPath(dir), filepath.Join(dir, "install.json"); got != want {
		t.Fatalf("MarkerPath = %q, want %q", got, want)
	}
}
