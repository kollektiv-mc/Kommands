// Package api is the HTTP surface the frontend talks to when a local backend
// exists.
//
// One handler serves both presentations of the local install: the Wails window
// mounts it as asset-server middleware, and the --serve listener mounts the
// same handler for a browser (docs/distribution.md § One install, two
// surfaces). That sharing is the point rather than a convenience — the
// frontend's "can this session link?" test is *the presence of this API*, not
// "am I in a browser", and a check that held only in the webview would get the
// local-webapp case wrong. HTTP rather than Wails JS bindings for the same
// reason: bindings exist only inside the webview, and would fork the two
// surfaces at the first call.
//
// The saved-commands endpoints implement the SavedCommandStorage contract
// (src/storage/types.ts) — list, put by id, remove by id — over the store the
// shell owns. Entries pass through as opaque JSON: the frontend owns the
// SavedCommand shape, and the shell validating more than addressability would
// make every schema change a two-repo edit.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sync"

	"kommands/shell/store"
)

// Config is what the handler needs from its environment, injected so tests can
// pin all of it.
type Config struct {
	// ShellVersion is reported by the capabilities probe.
	ShellVersion string
	// StorePath and SharedPath are where mutations land — the canonical store
	// and the Konnekt projection beside it.
	StorePath  string
	SharedPath string
	// KonnektPresent answers whether a Konnekt install exists on this machine,
	// so the UI can show the konnekt:// affordance only when it leads somewhere.
	KonnektPresent func() bool
}

// maxEntryBytes bounds one saved command arriving over PUT. Far above any real
// value tree (a command block caps command text at ~32K), low enough that the
// endpoint is not an invitation to fill the disk.
const maxEntryBytes = 4 << 20

type service struct {
	config Config
	// One mutex over load-mutate-save, because two surfaces can mutate
	// concurrently and the files have no locking of their own. Coarse and
	// correct; the store is small and the write path is rare.
	mu sync.Mutex
}

// New builds the /api handler. Paths are absolute (/api/...) on both mounts,
// so the same handler serves the webview and the listener unchanged.
func New(config Config) http.Handler {
	s := &service{config: config}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/capabilities", s.capabilities)
	mux.HandleFunc("GET /api/saved-commands", s.list)
	mux.HandleFunc("PUT /api/saved-commands/{id}", s.put)
	mux.HandleFunc("DELETE /api/saved-commands/{id}", s.remove)
	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// capabilities is the probe the frontend's storage resolution reads. Its shape
// is a compatibility surface from this first commit: the web build probes it to
// decide between the localStorage backend and the file backend, so a field
// here is as load-bearing as one in the shared file.
func (s *service) capabilities(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"app": "kommands",
		"shell": map[string]any{
			"version": s.config.ShellVersion,
		},
		"storage": map[string]any{
			"kind": "file",
		},
		"konnekt": map[string]any{
			"present": s.config.KonnektPresent(),
		},
	})
}

func (s *service) list(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	held, err := store.Load(s.config.StorePath)
	if err != nil {
		// An unreadable store is surfaced, never treated as empty: the
		// frontend renders it as the storage `error` state, and a silent empty
		// list here would invite a save that destroys the file it could not
		// read (see store.Load).
		writeError(w, http.StatusInternalServerError, "saved commands are unreadable: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(held.MarshalFile())
}

func (s *service) put(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	raw, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var header struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		writeError(w, http.StatusBadRequest, "body is not a JSON object")
		return
	}
	if header.ID == "" || header.ID != id {
		// The id in the path and the id in the body disagreeing is a caller
		// bug, and accepting either silently would let a save land on the
		// wrong command — the failure the stable-id rules exist to prevent.
		writeError(w, http.StatusBadRequest, "body id does not match path id")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	held, err := store.Load(s.config.StorePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "saved commands are unreadable: "+err.Error())
		return
	}
	if err := held.Upsert(raw); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := store.Save(s.config.StorePath, s.config.SharedPath, held); err != nil {
		// A failed write must reach the caller: reporting a save that did not
		// happen is the one outcome worse than failing to save
		// (src/storage/local.ts makes the same promise for the web backend).
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *service) remove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	s.mu.Lock()
	defer s.mu.Unlock()
	held, err := store.Load(s.config.StorePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "saved commands are unreadable: "+err.Error())
		return
	}
	held.Remove(id)
	if err := store.Save(s.config.StorePath, s.config.SharedPath, held); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func readBody(r *http.Request) ([]byte, error) {
	raw, err := io.ReadAll(http.MaxBytesReader(nil, r.Body, maxEntryBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return nil, errors.New("entry exceeds the size bound")
		}
		return nil, errors.New("could not read request body")
	}
	return raw, nil
}
