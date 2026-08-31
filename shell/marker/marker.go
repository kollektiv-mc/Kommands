// Package marker writes the install marker that tells Konnekt a standalone
// Kommands exists (#44).
//
// Konnekt currently infers an install from saved-commands.json existing, which
// conflates "installed" with "has saved something". The marker separates the
// two: it appears on first run, before any command is saved, and Konnekt can
// stat it for its launch decision without discovering a binary. Nothing on the
// other side depends on its *content* yet, so the content stays minimal —
// enough to say which build has run here, no more.
package marker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"kommands/shell/atomicfile"
)

// Ensure writes the marker at path, creating it on first run and updating its
// version on an upgraded one. installedAt is set once and preserved forever
// after; a run that changes nothing writes nothing, per the atomicfile rules.
// Unknown fields written by a newer build are carried through untouched, the
// same courtesy the store extends to entries.
func Ensure(path, version string, now func() time.Time) error {
	fields := map[string]json.RawMessage{}
	if raw, err := os.ReadFile(path); err == nil {
		// A corrupt marker is replaced rather than fatal: it is a beacon, not
		// data, and refusing to start over it would invert its purpose.
		_ = json.Unmarshal(raw, &fields)
	}

	if _, ok := fields["installedAt"]; !ok {
		installedAt, err := json.Marshal(now().UTC().Format(time.RFC3339))
		if err != nil {
			return fmt.Errorf("marker: %w", err)
		}
		fields["installedAt"] = installedAt
	}
	versionJSON, err := json.Marshal(version)
	if err != nil {
		return fmt.Errorf("marker: %w", err)
	}
	fields["version"] = versionJSON

	// Deterministic key order, so an unchanged marker is unchanged bytes and
	// WriteIfChanged can skip the write.
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, key := range keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		keyJSON, _ := json.Marshal(key)
		buf.Write(keyJSON)
		buf.WriteByte(':')
		buf.Write(bytes.TrimSpace(fields[key]))
	}
	buf.WriteByte('}')

	if _, err := atomicfile.WriteIfChanged(path, buf.Bytes(), 0o644); err != nil {
		return fmt.Errorf("marker: %w", err)
	}
	return nil
}
