// Package store holds the canonical saved commands on disk, and projects the
// file Konnekt reads from them.
//
// The canonical file (store.json) carries the same envelope the web build keeps
// in localStorage — `{ version, commands: [SavedCommand] }`, src/storage/types.ts
// — so the file backend and the web backend are one format in two places rather
// than two formats. The shell never interprets a saved command beyond the
// handful of fields the projection needs: entries are held as raw bytes, so a
// field this build has never heard of survives a read, an edit and a write
// back. That mirrors, structurally, what src/storage/local.ts guarantees for
// the web backend, and it is what makes per-entry acceptance safe rather than
// a trade (docs/health-checklist.md § a persisted format never breaks a reader
// it cannot see).
package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"

	"kommands/shell/atomicfile"
)

// FormatVersion is the envelope version this build writes, mirroring
// FORMAT_VERSION in src/storage/types.ts: bumped only when an entry this build
// writes could not be understood by re-reading it under the older rules, never
// for a new field. Written unconditionally, as the web backend does — the
// reader on either side never gates on it.
const FormatVersion = 1

// Entry is one saved command, verbatim.
//
// ID is extracted for addressing; Raw is the whole entry as loaded or as the
// frontend handed it over, and is what gets written back. An entry whose id
// cannot be read (not an object, id missing or not a string) keeps an empty ID:
// it cannot be addressed or projected, but it is preserved on every rewrite —
// skipping what this build does not understand must never mean deleting it.
type Entry struct {
	ID  string
	Raw json.RawMessage
}

// Store is the decoded canonical file.
type Store struct {
	commands []Entry
	// extra preserves envelope fields beyond version and commands, so a future
	// build's additions survive being rewritten by this one.
	extra map[string]json.RawMessage
}

// entryID is the one field addressing needs.
type entryID struct {
	ID string `json:"id"`
}

func extractID(raw json.RawMessage) string {
	var header entryID
	if err := json.Unmarshal(raw, &header); err != nil {
		return ""
	}
	return header.ID
}

// Load reads the canonical file. A missing file is the empty store — the
// normal first-run case, not an error.
//
// Unparseable JSON is an error rather than an empty store, and the difference
// is not stylistic: every mutation rewrites the whole file, so treating a
// corrupt file as empty would destroy the user's saved commands on their next
// save. The web backend makes the opposite call (src/storage/local.ts § read)
// because localStorage holds nothing another application links against; this
// file is what Konnekt binds to, and refusing loudly is the only honest answer
// the writer has.
func Load(path string) (*Store, error) {
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &Store{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	return Parse(raw)
}

// Parse decodes the canonical envelope from bytes.
func Parse(raw []byte) (*Store, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("parse store: %w", err)
	}

	s := &Store{extra: map[string]json.RawMessage{}}
	for key, value := range envelope {
		if key == "version" || key == "commands" {
			continue
		}
		s.extra[key] = value
	}

	rawCommands, ok := envelope["commands"]
	if !ok {
		return s, nil
	}
	var entries []json.RawMessage
	if err := json.Unmarshal(rawCommands, &entries); err != nil {
		// A "commands" that is not an array is not an older or newer shape of
		// this file — it is a different file. Rewriting it would clobber
		// something this app does not own.
		return nil, fmt.Errorf("parse store: commands is not an array")
	}
	for _, entry := range entries {
		s.commands = append(s.commands, Entry{ID: extractID(entry), Raw: entry})
	}
	return s, nil
}

// Commands is everything held, in stored order.
func (s *Store) Commands() []Entry {
	return s.commands
}

// Upsert inserts or replaces by id — the same contract as
// SavedCommandStorage.put. The entry must be a JSON object carrying a
// non-empty string id; the shell validates no more than that, because the
// frontend owns the SavedCommand shape and the shell owning a second copy of
// it would make every schema change a two-place edit.
func (s *Store) Upsert(raw json.RawMessage) error {
	if !json.Valid(raw) {
		return fmt.Errorf("upsert: not valid JSON")
	}
	id := extractID(raw)
	if id == "" {
		return fmt.Errorf("upsert: entry has no id")
	}
	for i, held := range s.commands {
		if held.ID == id {
			s.commands[i] = Entry{ID: id, Raw: raw}
			return nil
		}
	}
	s.commands = append(s.commands, Entry{ID: id, Raw: raw})
	return nil
}

// Remove removes by id. Removing an absent id is not an error — the same
// contract as SavedCommandStorage.remove.
func (s *Store) Remove(id string) {
	kept := s.commands[:0]
	for _, held := range s.commands {
		if held.ID != id {
			kept = append(kept, held)
		}
	}
	s.commands = kept
}

// MarshalFile encodes the canonical envelope deterministically: version, then
// commands verbatim in stored order, then any preserved envelope fields in
// sorted key order. Determinism matters because Save compares bytes to decide
// whether a write happens at all.
func (s *Store) MarshalFile() []byte {
	var buf bytes.Buffer
	fmt.Fprintf(&buf, `{"version":%d,"commands":[`, FormatVersion)
	for i, entry := range s.commands {
		if i > 0 {
			buf.WriteByte(',')
		}
		buf.Write(bytes.TrimSpace(entry.Raw))
	}
	buf.WriteByte(']')
	keys := make([]string, 0, len(s.extra))
	for key := range s.extra {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		keyJSON, _ := json.Marshal(key)
		buf.WriteByte(',')
		buf.Write(keyJSON)
		buf.WriteByte(':')
		buf.Write(bytes.TrimSpace(s.extra[key]))
	}
	buf.WriteByte('}')
	return buf.Bytes()
}

// Save writes the canonical file and the Konnekt projection, both atomically
// and both skipping the write when nothing changed. The canonical file goes
// first: it is the source of truth, and a projection ahead of its source is
// the one ordering that can show Konnekt a command the store then fails to
// keep.
func Save(storePath, sharedPath string, s *Store) error {
	if _, err := atomicfile.WriteIfChanged(storePath, s.MarshalFile(), 0o644); err != nil {
		return err
	}
	shared := ProjectShared(s.Commands())
	if _, err := atomicfile.WriteIfChanged(sharedPath, shared, 0o644); err != nil {
		return err
	}
	return nil
}
