// Package atomicfile writes files the way the Konnekt boundary requires
// (docs/persistence.md § What the reader's behaviour requires of the writer).
//
// Two rules, both because Konnekt polls os.Stat on the shared file and
// re-reads when the mtime moves:
//
//  1. Writes are atomic — temp file in the same directory, then rename — so a
//     polling reader can never catch a partial write as invalid JSON.
//  2. A write that changes nothing does not happen at all, so an unchanged
//     rewrite cannot move the mtime and cost the other side a spurious re-read.
//
// The rules apply to every file this app persists, not only the shared one:
// a private file gains nothing from being torn either, and one writer with two
// disciplines is how the wrong one ends up on the file that matters.
package atomicfile

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
)

// Write writes data to path atomically, creating the parent directory if it is
// missing. Each writer is self-sufficient rather than assuming startup created
// the directory — the convention Konnekt's WriteDataFile settled on after
// bare os.WriteFile calls turned a missing directory into ENOENT naming the
// file instead of the directory that actually caused it.
func Write(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create directory %s: %w", dir, err)
	}

	f, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create temp file in %s: %w", dir, err)
	}
	tmp := f.Name()

	if _, err := f.Write(data); err != nil {
		f.Close()
		os.Remove(tmp)
		return fmt.Errorf("write %s: %w", tmp, err)
	}
	// Sync before rename, or a power loss can make the rename durable while
	// the bytes it points at are not: a correctly named empty file.
	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmp)
		return fmt.Errorf("sync %s: %w", tmp, err)
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("close %s: %w", tmp, err)
	}
	// CreateTemp opens at 0600; match the mode a direct os.WriteFile gave.
	if err := os.Chmod(tmp, perm); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("chmod %s: %w", tmp, err)
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("rename %s to %s: %w", tmp, path, err)
	}
	return nil
}

// WriteIfChanged writes data to path atomically unless the file already holds
// exactly these bytes, in which case it does nothing — the mtime rule above.
// Returns whether a write happened.
//
// The comparison reads the whole existing file. That is deliberate rather than
// lazy: a size-plus-hash shortcut saves nothing at the sizes involved (Konnekt
// refuses the shared file beyond 2 MiB), and a false "unchanged" here is silent
// data loss on the other side of the boundary.
func WriteIfChanged(path string, data []byte, perm os.FileMode) (bool, error) {
	existing, err := os.ReadFile(path)
	if err == nil && bytes.Equal(existing, data) {
		return false, nil
	}
	// Any read error other than absence falls through to the write: a file we
	// cannot read is not one we can prove unchanged, and Write replaces it
	// wholesale without needing to.
	if err := Write(path, data, perm); err != nil {
		return false, err
	}
	return true, nil
}
