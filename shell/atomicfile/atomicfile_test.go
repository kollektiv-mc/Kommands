package atomicfile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWriteCreatesParentAndContent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nested", "deeper", "file.json")
	if err := Write(path, []byte(`{"ok":true}`), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != `{"ok":true}` {
		t.Fatalf("content = %q", got)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o644 {
		t.Fatalf("mode = %v, want 0644", info.Mode().Perm())
	}
}

func TestWriteLeavesNoTempFileBehind(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.json")
	if err := Write(path, []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Write(path, []byte("b"), 0o644); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".tmp-") {
			t.Fatalf("temp file left behind: %s", e.Name())
		}
	}
}

// The mtime rule: an identical rewrite must not touch the file at all, because
// Konnekt re-reads the shared file whenever os.Stat moves. Pinned by setting
// the mtime into the past and asserting it stays there — no sleeping, no
// racing the filesystem's timestamp resolution.
func TestWriteIfChangedSkipsIdenticalContent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.json")
	if _, err := WriteIfChanged(path, []byte("same"), 0o644); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	if err := os.Chtimes(path, past, past); err != nil {
		t.Fatal(err)
	}

	wrote, err := WriteIfChanged(path, []byte("same"), 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if wrote {
		t.Fatal("WriteIfChanged reported a write for identical content")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if !info.ModTime().Equal(past) {
		t.Fatalf("mtime moved on an unchanged rewrite: %v", info.ModTime())
	}

	wrote, err = WriteIfChanged(path, []byte("different"), 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if !wrote {
		t.Fatal("WriteIfChanged reported no write for changed content")
	}
	if info, err = os.Stat(path); err != nil {
		t.Fatal(err)
	}
	if info.ModTime().Equal(past) {
		t.Fatal("mtime did not move on a changed rewrite")
	}
}

func TestWriteIfChangedCreatesMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "new.json")
	wrote, err := WriteIfChanged(path, []byte("x"), 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if !wrote {
		t.Fatal("WriteIfChanged reported no write for a missing file")
	}
}
