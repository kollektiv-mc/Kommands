package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testHandler(t *testing.T) (http.Handler, string) {
	t.Helper()
	dir := t.TempDir()
	handler := New(Config{
		ShellVersion:   "0.0.0-test",
		StorePath:      filepath.Join(dir, "store.json"),
		SharedPath:     filepath.Join(dir, "saved-commands.json"),
		KonnektPresent: func() bool { return true },
	})
	return handler, dir
}

func do(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var request *http.Request
	if body == "" {
		request = httptest.NewRequest(method, path, nil)
	} else {
		request = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

const entry = `{"id":"cmd-1","name":"Kit","definitionId":"vanilla:give","version":"1.21.1",` +
	`"preview":"/give @p stone","revision":1,"createdAt":"2026-08-31T10:00:00Z",` +
	`"updatedAt":"2026-08-31T10:00:00Z","value":{"args":{},"flags":{},"choices":{},"repeats":{},"refs":{}}}`

func TestCapabilitiesProbe(t *testing.T) {
	handler, _ := testHandler(t)
	response := do(t, handler, http.MethodGet, "/api/capabilities", "")
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	var body struct {
		App   string `json:"app"`
		Shell struct {
			Version string `json:"version"`
		} `json:"shell"`
		Storage struct {
			Kind string `json:"kind"`
		} `json:"storage"`
		Konnekt struct {
			Present bool `json:"present"`
		} `json:"konnekt"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.App != "kommands" || body.Shell.Version != "0.0.0-test" ||
		body.Storage.Kind != "file" || !body.Konnekt.Present {
		t.Fatalf("capabilities = %s", response.Body.String())
	}
}

func TestListStartsEmpty(t *testing.T) {
	handler, _ := testHandler(t)
	response := do(t, handler, http.MethodGet, "/api/saved-commands", "")
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	var body struct {
		Version  int               `json:"version"`
		Commands []json.RawMessage `json:"commands"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Version != 1 || len(body.Commands) != 0 {
		t.Fatalf("body = %s", response.Body.String())
	}
}

func TestPutListRemoveRoundTrip(t *testing.T) {
	handler, dir := testHandler(t)

	if response := do(t, handler, http.MethodPut, "/api/saved-commands/cmd-1", entry); response.Code != http.StatusNoContent {
		t.Fatalf("put status = %d: %s", response.Code, response.Body.String())
	}

	response := do(t, handler, http.MethodGet, "/api/saved-commands", "")
	if !strings.Contains(response.Body.String(), `"id":"cmd-1"`) {
		t.Fatalf("list is missing the entry: %s", response.Body.String())
	}

	// The mutation reached both files: the canonical store and the projection.
	shared, err := os.ReadFile(filepath.Join(dir, "saved-commands.json"))
	if err != nil {
		t.Fatalf("shared file not written: %v", err)
	}
	if !strings.Contains(string(shared), `"command":"give @p stone"`) {
		t.Fatalf("projection wrong: %s", shared)
	}

	if response := do(t, handler, http.MethodDelete, "/api/saved-commands/cmd-1", ""); response.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d", response.Code)
	}
	response = do(t, handler, http.MethodGet, "/api/saved-commands", "")
	if strings.Contains(response.Body.String(), "cmd-1") {
		t.Fatalf("entry survived deletion: %s", response.Body.String())
	}
	// Deletion is by absence in the shared file too.
	shared, err = os.ReadFile(filepath.Join(dir, "saved-commands.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(shared), "cmd-1") {
		t.Fatalf("deleted entry still projected: %s", shared)
	}
}

func TestDeleteAbsentIdIsNoContent(t *testing.T) {
	handler, _ := testHandler(t)
	if response := do(t, handler, http.MethodDelete, "/api/saved-commands/never-existed", ""); response.Code != http.StatusNoContent {
		t.Fatalf("status = %d — removing an absent id is not an error", response.Code)
	}
}

func TestPutRejectsMismatchedId(t *testing.T) {
	handler, _ := testHandler(t)
	if response := do(t, handler, http.MethodPut, "/api/saved-commands/other-id", entry); response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d — a body landing under a different id is a silent mis-save", response.Code)
	}
	if response := do(t, handler, http.MethodPut, "/api/saved-commands/cmd-1", `{"name":"no id"}`); response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d for a body without an id", response.Code)
	}
	if response := do(t, handler, http.MethodPut, "/api/saved-commands/cmd-1", `not json`); response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d for a non-JSON body", response.Code)
	}
}

// An unreadable store surfaces as an error state, never as an empty list — an
// empty answer here would invite a save that destroys what could not be read.
func TestCorruptStoreSurfacesAsError(t *testing.T) {
	handler, dir := testHandler(t)
	if err := os.WriteFile(filepath.Join(dir, "store.json"), []byte(`{"version":`), 0o644); err != nil {
		t.Fatal(err)
	}
	if response := do(t, handler, http.MethodGet, "/api/saved-commands", ""); response.Code != http.StatusInternalServerError {
		t.Fatalf("list of a corrupt store = %d, want 500", response.Code)
	}
	if response := do(t, handler, http.MethodPut, "/api/saved-commands/cmd-1", entry); response.Code != http.StatusInternalServerError {
		t.Fatalf("put over a corrupt store = %d, want 500", response.Code)
	}
	// The corrupt file was not clobbered by the refused mutation.
	raw, err := os.ReadFile(filepath.Join(dir, "store.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != `{"version":` {
		t.Fatalf("refused mutation still rewrote the store: %s", raw)
	}
}

func TestUnknownApiPathIs404(t *testing.T) {
	handler, _ := testHandler(t)
	if response := do(t, handler, http.MethodGet, "/api/unknown", ""); response.Code != http.StatusNotFound {
		t.Fatalf("status = %d", response.Code)
	}
}
