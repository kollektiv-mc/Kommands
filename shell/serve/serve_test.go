package serve

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

var assets = fstest.MapFS{
	"index.html":    {Data: []byte("<!doctype html><title>Kommands</title>")},
	"assets/app.js": {Data: []byte("console.log('app')")},
}

func apiStub() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
}

func get(t *testing.T, handler http.Handler, path, host string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Host = host
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestServesIndexAtRoot(t *testing.T) {
	response := get(t, Handler(assets, apiStub()), "/", "localhost:8642")
	if response.Code != http.StatusOK || response.Body.String() == "" {
		t.Fatalf("root: %d", response.Code)
	}
}

func TestServesRealAssets(t *testing.T) {
	response := get(t, Handler(assets, apiStub()), "/assets/app.js", "127.0.0.1:8642")
	if response.Code != http.StatusOK || response.Body.String() != "console.log('app')" {
		t.Fatalf("asset: %d %q", response.Code, response.Body.String())
	}
}

// Client routes are the router's, so an extensionless miss falls back to
// index.html — a browser reload on /dashboard must not 404.
func TestClientRouteFallsBackToIndex(t *testing.T) {
	response := get(t, Handler(assets, apiStub()), "/dashboard", "localhost:8642")
	if response.Code != http.StatusOK {
		t.Fatalf("client route: %d", response.Code)
	}
	if response.Body.String() != string(assets["index.html"].Data) {
		t.Fatalf("client route did not serve index.html: %q", response.Body.String())
	}
}

// A missing *file* stays a 404: masking a broken asset reference behind
// index.html turns a build problem into a blank page with a 200.
func TestMissingAssetIs404(t *testing.T) {
	response := get(t, Handler(assets, apiStub()), "/assets/missing.js", "localhost:8642")
	if response.Code != http.StatusNotFound {
		t.Fatalf("missing asset: %d", response.Code)
	}
}

func TestApiIsRouted(t *testing.T) {
	response := get(t, Handler(assets, apiStub()), "/api/capabilities", "localhost:8642")
	if response.Code != http.StatusTeapot {
		t.Fatalf("api not routed: %d", response.Code)
	}
}

// The DNS-rebinding guard: a hostile page can point its own domain at
// 127.0.0.1, so the Host header is checked even though the bind is loopback.
func TestForeignHostIsForbidden(t *testing.T) {
	handler := Handler(assets, apiStub())
	for _, host := range []string{"evil.example:8642", "kommands.attacker.net", "192.168.1.5:8642"} {
		if response := get(t, handler, "/api/capabilities", host); response.Code != http.StatusForbidden {
			t.Fatalf("host %q: %d, want 403", host, response.Code)
		}
	}
	for _, host := range []string{"localhost:8642", "127.0.0.1:8642", "[::1]:8642", "localhost"} {
		if response := get(t, handler, "/", host); response.Code == http.StatusForbidden {
			t.Fatalf("host %q refused", host)
		}
	}
}
