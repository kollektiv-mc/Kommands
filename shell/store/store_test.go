package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A realistic entry in the frontend's persisted shape (src/schema/saved.ts),
// with only the fields the projection reads filled meaningfully.
func entryJSON(id, name, preview string, revision int, updatedAt string) string {
	return `{"id":"` + id + `","name":"` + name + `","definitionId":"vanilla:give",` +
		`"version":"1.21.1","preview":"` + preview + `","revision":` +
		jsonNumber(revision) + `,"createdAt":"2026-08-30T10:00:00Z","updatedAt":"` + updatedAt + `",` +
		`"value":{"args":{},"flags":{},"choices":{},"repeats":{},"refs":{}}}`
}

func jsonNumber(n int) string {
	encoded, _ := json.Marshal(n)
	return string(encoded)
}

func TestLoadMissingFileIsEmpty(t *testing.T) {
	s, err := Load(filepath.Join(t.TempDir(), "absent.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Commands()) != 0 {
		t.Fatalf("expected empty store, got %d entries", len(s.Commands()))
	}
}

func TestLoadCorruptFileIsAnErrorNotAnEmptyStore(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	if err := os.WriteFile(path, []byte(`{"version":1,"commands":[{"id":`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("corrupt store loaded as empty — the next save would destroy it")
	}
}

func TestLoadRefusesForeignShape(t *testing.T) {
	if _, err := Parse([]byte(`{"commands":"not an array"}`)); err == nil {
		t.Fatal("a non-array commands field parsed — rewriting would clobber a foreign file")
	}
}

// The forward-compatibility rule: fields this build has never heard of survive
// a read, an edit and a write back — on the entry and on the envelope alike.
func TestUnknownFieldsSurviveRoundTrip(t *testing.T) {
	file := `{"version":1,"commands":[` +
		`{"id":"a","futureField":{"nested":true},"preview":"/give @p stone","revision":1}` +
		`],"futureEnvelopeField":"kept"}`
	s, err := Parse([]byte(file))
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Upsert(json.RawMessage(entryJSON("b", "B", "/say hi", 1, "2026-08-31T10:00:00Z"))); err != nil {
		t.Fatal(err)
	}
	out := string(s.MarshalFile())
	if !strings.Contains(out, `"futureField":{"nested":true}`) {
		t.Fatalf("unknown entry field lost: %s", out)
	}
	if !strings.Contains(out, `"futureEnvelopeField":"kept"`) {
		t.Fatalf("unknown envelope field lost: %s", out)
	}
}

// An entry whose id cannot be read is preserved verbatim, not dropped: skipping
// what this build does not understand must never mean deleting it.
func TestUnaddressableEntryIsPreserved(t *testing.T) {
	file := `{"version":1,"commands":[{"noId":true},"just a string"]}`
	s, err := Parse([]byte(file))
	if err != nil {
		t.Fatal(err)
	}
	out := string(s.MarshalFile())
	if !strings.Contains(out, `{"noId":true}`) || !strings.Contains(out, `"just a string"`) {
		t.Fatalf("unaddressable entries lost: %s", out)
	}
}

func TestUpsertReplacesById(t *testing.T) {
	s := &Store{}
	if err := s.Upsert(json.RawMessage(entryJSON("a", "First", "/say one", 1, "2026-08-31T10:00:00Z"))); err != nil {
		t.Fatal(err)
	}
	if err := s.Upsert(json.RawMessage(entryJSON("a", "Renamed", "/say one", 1, "2026-08-31T11:00:00Z"))); err != nil {
		t.Fatal(err)
	}
	if len(s.Commands()) != 1 {
		t.Fatalf("upsert duplicated the entry: %d", len(s.Commands()))
	}
	if !strings.Contains(string(s.Commands()[0].Raw), "Renamed") {
		t.Fatal("upsert did not replace the entry")
	}
}

func TestUpsertRejectsEntryWithoutId(t *testing.T) {
	s := &Store{}
	if err := s.Upsert(json.RawMessage(`{"name":"no id"}`)); err == nil {
		t.Fatal("entry without id accepted")
	}
	if err := s.Upsert(json.RawMessage(`not json`)); err == nil {
		t.Fatal("invalid JSON accepted")
	}
}

func TestRemoveAbsentIdIsNotAnError(t *testing.T) {
	s := &Store{}
	if err := s.Upsert(json.RawMessage(entryJSON("a", "A", "/say hi", 1, "2026-08-31T10:00:00Z"))); err != nil {
		t.Fatal(err)
	}
	s.Remove("never-existed")
	if len(s.Commands()) != 1 {
		t.Fatal("removing an absent id changed the store")
	}
	s.Remove("a")
	if len(s.Commands()) != 0 {
		t.Fatal("remove by id did not remove")
	}
}

func TestMarshalFileIsDeterministic(t *testing.T) {
	file := `{"version":1,"commands":[{"id":"a","preview":"/say hi","revision":1}],"zed":"z","alpha":"a"}`
	s, err := Parse([]byte(file))
	if err != nil {
		t.Fatal(err)
	}
	first := string(s.MarshalFile())
	second := string(s.MarshalFile())
	if first != second {
		t.Fatalf("two marshals differ:\n%s\n%s", first, second)
	}
	// Round-trip stability: parse our own output and marshal again.
	reparsed, err := Parse([]byte(first))
	if err != nil {
		t.Fatal(err)
	}
	if got := string(reparsed.MarshalFile()); got != first {
		t.Fatalf("round-trip changed bytes:\n%s\n%s", first, got)
	}
}

func TestSaveWritesBothFilesAndSkipsNoopRewrites(t *testing.T) {
	dir := t.TempDir()
	storePath := filepath.Join(dir, "store.json")
	sharedPath := filepath.Join(dir, "saved-commands.json")

	s := &Store{}
	if err := s.Upsert(json.RawMessage(entryJSON("a", "Kit", "/give @p stone", 3, "2026-08-31T10:00:00Z"))); err != nil {
		t.Fatal(err)
	}
	if err := Save(storePath, sharedPath, s); err != nil {
		t.Fatal(err)
	}

	var shared struct {
		Version  int `json:"version"`
		Commands []struct {
			ID        string `json:"id"`
			Revision  int64  `json:"revision"`
			Label     string `json:"label"`
			Command   string `json:"command"`
			UpdatedAt int64  `json:"updatedAt"`
		} `json:"commands"`
	}
	raw, err := os.ReadFile(sharedPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, &shared); err != nil {
		t.Fatal(err)
	}
	if shared.Version != 1 || len(shared.Commands) != 1 {
		t.Fatalf("unexpected shared file: %s", raw)
	}
	got := shared.Commands[0]
	if got.ID != "a" || got.Revision != 3 || got.Label != "Kit" || got.Command != "give @p stone" {
		t.Fatalf("projection wrong: %+v", got)
	}
	if got.UpdatedAt != time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC).UnixMilli() {
		t.Fatalf("updatedAt not Unix ms: %d", got.UpdatedAt)
	}

	// A second save with unchanged content must not move either mtime.
	past := time.Now().Add(-time.Hour)
	for _, path := range []string{storePath, sharedPath} {
		if err := os.Chtimes(path, past, past); err != nil {
			t.Fatal(err)
		}
	}
	if err := Save(storePath, sharedPath, s); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{storePath, sharedPath} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if !info.ModTime().Equal(past) {
			t.Fatalf("no-op save moved mtime of %s", path)
		}
	}
}

// Store-only churn — a field Konnekt never reads changing — must leave the
// shared file untouched. This is the structural answer to the lastOpenedAt
// backlog item in docs/health-checklist.md.
func TestStoreOnlyChangeLeavesSharedFileAlone(t *testing.T) {
	dir := t.TempDir()
	storePath := filepath.Join(dir, "store.json")
	sharedPath := filepath.Join(dir, "saved-commands.json")

	base := entryJSON("a", "Kit", "/give @p stone", 3, "2026-08-31T10:00:00Z")
	s := &Store{}
	if err := s.Upsert(json.RawMessage(base)); err != nil {
		t.Fatal(err)
	}
	if err := Save(storePath, sharedPath, s); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	if err := os.Chtimes(sharedPath, past, past); err != nil {
		t.Fatal(err)
	}

	// lastOpenedAt moves; nothing the projection reads does.
	withOpen := strings.TrimSuffix(base, "}") + `,"lastOpenedAt":"2026-08-31T12:00:00Z"}`
	if err := s.Upsert(json.RawMessage(withOpen)); err != nil {
		t.Fatal(err)
	}
	if err := Save(storePath, sharedPath, s); err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(sharedPath)
	if err != nil {
		t.Fatal(err)
	}
	if !info.ModTime().Equal(past) {
		t.Fatal("a store-only change rewrote the shared file")
	}
	storeInfo, err := os.Stat(storePath)
	if err != nil {
		t.Fatal(err)
	}
	if storeInfo.ModTime().Equal(past) {
		t.Fatal("the canonical store did not record the change")
	}
}
