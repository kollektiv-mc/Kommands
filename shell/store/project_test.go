package store

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func rawEntry(t *testing.T, s string) Entry {
	t.Helper()
	return Entry{ID: extractID(json.RawMessage(s)), Raw: json.RawMessage(s)}
}

func decodeShared(t *testing.T, raw []byte) (int, []sharedEntry) {
	t.Helper()
	var file struct {
		Version  int           `json:"version"`
		Commands []sharedEntry `json:"commands"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("projection is not valid JSON: %v\n%s", err, raw)
	}
	return file.Version, file.Commands
}

func TestProjectionStripsExactlyOneSlash(t *testing.T) {
	raw := ProjectShared([]Entry{
		rawEntry(t, entryJSON("v", "Vanilla", "/give @p stone", 1, "2026-08-31T10:00:00Z")),
		rawEntry(t, entryJSON("w", "WorldEdit", "//set stone", 1, "2026-08-31T09:00:00Z")),
	})
	_, commands := decodeShared(t, raw)
	if len(commands) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(commands))
	}
	// Newest first, so the vanilla entry leads.
	if commands[0].Command != "give @p stone" {
		t.Fatalf("vanilla command = %q", commands[0].Command)
	}
	// The second slash is content — `//set` in chat is `/set` on a console.
	if commands[1].Command != "/set stone" {
		t.Fatalf("worldedit command = %q", commands[1].Command)
	}
}

// The rule with teeth: a control character in the command text is a command
// injection once Konnekt's scheduler fires linked commands unattended, so the
// writer never emits one — matching Konnekt skipping such entries on read.
func TestProjectionSkipsControlCharacters(t *testing.T) {
	raw := ProjectShared([]Entry{
		rawEntry(t, `{"id":"bad","name":"Injected","preview":"/say hi\nkill @a","revision":1,"updatedAt":"2026-08-31T10:00:00Z"}`),
		rawEntry(t, entryJSON("good", "Fine", "/say hi", 1, "2026-08-31T10:00:00Z")),
	})
	_, commands := decodeShared(t, raw)
	if len(commands) != 1 || commands[0].ID != "good" {
		t.Fatalf("control-character entry survived projection: %s", raw)
	}
}

func TestProjectionSkipsWhatItCannotRead(t *testing.T) {
	raw := ProjectShared([]Entry{
		rawEntry(t, `{"id":"a"}`),                        // no preview at all
		rawEntry(t, `{"id":"b","preview":"/"}`),          // empty after the slash
		rawEntry(t, `{"id":"c","preview":123}`),          // wrong type
		rawEntry(t, `{"noId":true,"preview":"/say hi"}`), // unaddressable
		rawEntry(t, entryJSON("keep", "Kept", "/say hi", 2, "2026-08-31T10:00:00Z")),
	})
	_, commands := decodeShared(t, raw)
	if len(commands) != 1 || commands[0].ID != "keep" {
		t.Fatalf("expected only the readable entry: %s", raw)
	}
}

func TestProjectionUnparseableTimestampDegradesToZero(t *testing.T) {
	raw := ProjectShared([]Entry{
		rawEntry(t, `{"id":"a","name":"N","preview":"/say hi","revision":1,"updatedAt":"not a time"}`),
	})
	_, commands := decodeShared(t, raw)
	if len(commands) != 1 {
		t.Fatal("a bad timestamp dropped the entry — it is display-only")
	}
	if commands[0].UpdatedAt != 0 {
		t.Fatalf("updatedAt = %d, want 0", commands[0].UpdatedAt)
	}
}

func TestProjectionHonoursTheEntryCap(t *testing.T) {
	entries := make([]Entry, 0, maxSharedEntries+50)
	for i := 0; i < maxSharedEntries+50; i++ {
		id := fmt.Sprintf("id-%04d", i)
		updated := fmt.Sprintf("2026-08-31T10:%02d:%02dZ", (i/60)%60, i%60)
		entries = append(entries, rawEntry(t, entryJSON(id, "N", "/say hi", 1, updated)))
	}
	_, commands := decodeShared(t, ProjectShared(entries))
	if len(commands) != maxSharedEntries {
		t.Fatalf("entry cap not applied: %d", len(commands))
	}
}

func TestProjectionStaysUnderTheByteBound(t *testing.T) {
	// A handful of enormous commands (a component-heavy /give can approach a
	// command block's ~32K limit) plus a small one that still deserves a place.
	huge := strings.Repeat("x", 500_000)
	entries := []Entry{}
	for i := 0; i < 6; i++ {
		id := fmt.Sprintf("huge-%d", i)
		entries = append(entries, rawEntry(t,
			`{"id":"`+id+`","name":"Huge","preview":"/say `+huge+`","revision":1,"updatedAt":"2026-08-31T10:00:00Z"}`))
	}
	entries = append(entries, rawEntry(t, entryJSON("small", "Small", "/say hi", 1, "2026-08-30T10:00:00Z")))

	raw := ProjectShared(entries)
	if len(raw) > maxSharedBytes {
		t.Fatalf("projection is %d bytes, over Konnekt's 2 MiB refusal bound", len(raw))
	}
	_, commands := decodeShared(t, raw)
	ids := map[string]bool{}
	for _, c := range commands {
		ids[c.ID] = true
	}
	if !ids["small"] {
		t.Fatal("a small entry was starved by large ones instead of skipped past them")
	}
	if len(commands) >= 6+1 {
		t.Fatal("every huge entry fitted — the fixture no longer exercises the bound")
	}
}

func TestProjectionIsDeterministic(t *testing.T) {
	entries := []Entry{
		rawEntry(t, entryJSON("b", "B", "/say b", 1, "2026-08-31T10:00:00Z")),
		rawEntry(t, entryJSON("a", "A", "/say a", 1, "2026-08-31T10:00:00Z")),
	}
	first := string(ProjectShared(entries))
	// Same commands, different stored order — the projection must not care.
	swapped := []Entry{entries[1], entries[0]}
	second := string(ProjectShared(swapped))
	if first != second {
		t.Fatalf("projection depends on stored order:\n%s\n%s", first, second)
	}
	version, commands := decodeShared(t, []byte(first))
	if version != SharedSchemaVersion {
		t.Fatalf("version = %d", version)
	}
	// Equal timestamps fall back to id order.
	if commands[0].ID != "a" || commands[1].ID != "b" {
		t.Fatalf("tiebreak order wrong: %+v", commands)
	}
}

func TestProjectionOfNothingIsAValidEmptyFile(t *testing.T) {
	version, commands := decodeShared(t, ProjectShared(nil))
	if version != SharedSchemaVersion || len(commands) != 0 {
		t.Fatalf("empty projection wrong: version %d, %d commands", version, len(commands))
	}
}
