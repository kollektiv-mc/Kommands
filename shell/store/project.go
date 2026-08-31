package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// The shared-file contract, from the reader's side of the boundary: Konnekt's
// backend/models/kommands.go is the authoritative statement, mirrored on #45.
// The writer-side obligations it creates are what this file implements:
//
//   - version must be present and equal 1 — Konnekt refuses a file whose
//     version it does not recognise, so this number moves only with its reader.
//   - command carries no leading slash and no control character. One entry is
//     one command; a newline in this field is a command injection into a live
//     world once Konnekt's scheduler can fire a linked command unattended.
//   - updatedAt is Unix milliseconds, display only.
//   - Konnekt refuses a file over 2 MiB or beyond 2000 entries, and skips an
//     individual malformed entry rather than rejecting the file. The writer
//     stays inside both bounds so the refusal never happens.
//
// The projection exists because the canonical store and this file want
// different things: the store holds value trees in the frontend's own shape
// (name, preview, ISO timestamps, fields like lastOpenedAt that move without
// the command changing), while Konnekt's reader pins label / command /
// Unix-ms updatedAt and a hard size bound that value trees would spend on
// data it never reads. Projecting also keeps store-only churn out of the
// shared file entirely: an entry whose projection is unchanged writes the
// same bytes, and WriteIfChanged then leaves the mtime alone.
const SharedSchemaVersion = 1

const (
	maxSharedEntries = 2000
	maxSharedBytes   = 2 << 20 // 2 MiB
)

// sharedEntry is one command as Konnekt reads it. Field order is the emitted
// key order, and it stays stable so unchanged content produces unchanged bytes.
type sharedEntry struct {
	ID        string `json:"id"`
	Revision  int64  `json:"revision"`
	Label     string `json:"label"`
	Command   string `json:"command"`
	UpdatedAt int64  `json:"updatedAt"`
}

// projectionSource is the handful of SavedCommand fields the projection reads
// (src/schema/saved.ts owns the full shape). A type mismatch on any of them
// fails the unmarshal and the entry is left out of the projection — the
// writer-side twin of Konnekt skipping a malformed entry.
type projectionSource struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Preview   string `json:"preview"`
	Revision  int64  `json:"revision"`
	UpdatedAt string `json:"updatedAt"`
}

// hasControlCharacter reports any C0 control or DEL — the characters Konnekt
// skips an entry over, checked at the sender too so the entry never leaves
// here broken (#46 makes the same argument for the konnekt:// payload).
func hasControlCharacter(s string) bool {
	for _, r := range s {
		if r < 0x20 || r == 0x7f {
			return true
		}
	}
	return false
}

// projectEntry maps one stored command onto the shared shape, or reports that
// it has no place there. Skipping is per-entry and silent by design: the
// canonical store keeps the command either way, and a projection is not the
// place to surface validation — the editor is, before the save happens.
func projectEntry(entry Entry) (sharedEntry, bool) {
	if entry.ID == "" {
		return sharedEntry{}, false
	}
	var source projectionSource
	if err := json.Unmarshal(entry.Raw, &source); err != nil {
		return sharedEntry{}, false
	}

	// The preview is the serialized command as of the last save, leading slash
	// included. Konnekt wants console form: strip exactly one slash, which is
	// also correct for WorldEdit — `//set stone` in chat is the command
	// `/set stone` on a console, so the second slash is content, not prefix.
	command := strings.TrimPrefix(source.Preview, "/")
	if command == "" || hasControlCharacter(command) {
		return sharedEntry{}, false
	}

	// updatedAt is display-only on the other side, so a failed parse degrades
	// to zero rather than dropping the entry; revision is the change signal.
	var updatedAt int64
	if parsed, err := time.Parse(time.RFC3339, source.UpdatedAt); err == nil {
		updatedAt = parsed.UnixMilli()
	}

	return sharedEntry{
		ID:        source.ID,
		Revision:  source.Revision,
		Label:     source.Name,
		Command:   command,
		UpdatedAt: updatedAt,
	}, true
}

// ProjectShared renders the file Konnekt reads from the stored commands.
//
// Deterministic from its input: entries are ordered newest-first with the id
// as tiebreak, capped at Konnekt's entry bound, and an entry that would push
// the file over Konnekt's byte bound is skipped while smaller later ones still
// fit. Determinism is load-bearing — Save compares bytes to keep the no-op
// mtime rule, so an equal store must always render equal bytes.
func ProjectShared(entries []Entry) []byte {
	projected := make([]sharedEntry, 0, len(entries))
	for _, entry := range entries {
		if shared, ok := projectEntry(entry); ok {
			projected = append(projected, shared)
		}
	}
	sort.Slice(projected, func(i, j int) bool {
		if projected[i].UpdatedAt != projected[j].UpdatedAt {
			return projected[i].UpdatedAt > projected[j].UpdatedAt
		}
		return projected[i].ID < projected[j].ID
	})
	if len(projected) > maxSharedEntries {
		projected = projected[:maxSharedEntries]
	}

	var buf bytes.Buffer
	fmt.Fprintf(&buf, `{"version":%d,"commands":[`, SharedSchemaVersion)
	suffix := len("]}")
	wrote := 0
	for _, entry := range projected {
		encoded, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		needed := len(encoded) + suffix
		if wrote > 0 {
			needed++ // the separating comma
		}
		if buf.Len()+needed > maxSharedBytes {
			continue
		}
		if wrote > 0 {
			buf.WriteByte(',')
		}
		buf.Write(encoded)
		wrote++
	}
	buf.WriteString(`]}`)
	return buf.Bytes()
}
