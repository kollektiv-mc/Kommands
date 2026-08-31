package marker

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func fixedClock(iso string) func() time.Time {
	parsed, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		panic(err)
	}
	return func() time.Time { return parsed }
}

func readMarker(t *testing.T, path string) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatalf("marker is not valid JSON: %v", err)
	}
	return fields
}

func TestFirstRunWritesInstalledAtAndVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install.json")
	if err := Ensure(path, "0.1.0", fixedClock("2026-08-31T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	fields := readMarker(t, path)
	if fields["installedAt"] != "2026-08-31T10:00:00Z" || fields["version"] != "0.1.0" {
		t.Fatalf("marker = %v", fields)
	}
}

func TestUpgradePreservesInstalledAt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install.json")
	if err := Ensure(path, "0.1.0", fixedClock("2026-08-31T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(path, "0.2.0", fixedClock("2027-01-01T00:00:00Z")); err != nil {
		t.Fatal(err)
	}
	fields := readMarker(t, path)
	if fields["installedAt"] != "2026-08-31T10:00:00Z" {
		t.Fatalf("upgrade regenerated installedAt: %v", fields["installedAt"])
	}
	if fields["version"] != "0.2.0" {
		t.Fatalf("upgrade did not move version: %v", fields["version"])
	}
}

func TestUnchangedRunDoesNotMoveMtime(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install.json")
	if err := Ensure(path, "0.1.0", fixedClock("2026-08-31T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	if err := os.Chtimes(path, past, past); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(path, "0.1.0", fixedClock("2026-09-01T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if !info.ModTime().Equal(past) {
		t.Fatal("an unchanged run rewrote the marker")
	}
}

func TestUnknownFieldsSurvive(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install.json")
	if err := os.WriteFile(path,
		[]byte(`{"installedAt":"2026-01-01T00:00:00Z","version":"9.9.9","futureField":42}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(path, "0.1.0", fixedClock("2026-08-31T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	fields := readMarker(t, path)
	if fields["futureField"] != float64(42) {
		t.Fatalf("unknown field lost: %v", fields)
	}
	if fields["installedAt"] != "2026-01-01T00:00:00Z" {
		t.Fatalf("installedAt regenerated: %v", fields["installedAt"])
	}
}

func TestCorruptMarkerIsReplacedNotFatal(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install.json")
	if err := os.WriteFile(path, []byte(`{"instal`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(path, "0.1.0", fixedClock("2026-08-31T10:00:00Z")); err != nil {
		t.Fatal(err)
	}
	fields := readMarker(t, path)
	if fields["version"] != "0.1.0" {
		t.Fatalf("corrupt marker not replaced: %v", fields)
	}
}
