// Guards against silent coverage regressions in the shell packages, the Go that
// carries behaviour (docs/distribution.md § The shell). Same shape as the bundle
// budget (scripts/check-bundle.ts) and as Konnekt's scripts/coverage-floor: a
// script owns the threshold, and both .claude/suite.json and CI call it by name,
// so /suite-kit:health enforces it too.
//
// Konnekt's floor reads the coverage line `go test -cover` prints for its one
// package. This one spans six packages, so it takes the total from a profile
// instead: `go test -coverprofile` over ./shell/... and `go tool cover -func`,
// whose last line is the figure people quote.
//
// Run: go run ./scripts/coverage-floor
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
)

// The packages this floor is about. Scoped rather than ./... on purpose: the
// root package compiles against webkit2gtk and cannot build in most containers,
// and scripts/ carries tooling with no tests.
const targetPackages = "./shell/..."

// Floor = the last measured figure minus a little headroom, so an unrelated
// refactor does not redden the build. It is a ratchet: raise it when coverage
// rises, never lower it to make a red build green.
//
//	86.0% -> floor 84.0  the shell as it landed (#44), measured 2026-09-11
//
// Coverage is a proxy, not the goal. A test that would have caught a real bug is
// worth more than one that only moves this number.
const floorPercent = 84.0

// Matches the last line of `go tool cover -func`: "total: (statements) 86.0%".
var reTotal = regexp.MustCompile(`total:\s+\(statements\)\s+([0-9.]+)%`)

func main() {
	profile := filepath.Join(os.TempDir(), "kommands-shell-coverage.out")
	defer os.Remove(profile)

	test := exec.Command("go", "test", "-coverprofile="+profile, targetPackages)
	out, err := test.CombinedOutput()
	// Print the test output either way: when tests fail, that is the thing worth
	// reading, not the coverage number.
	os.Stdout.Write(out)
	if err != nil {
		fmt.Fprintln(os.Stderr, "coverage floor: tests failed, coverage not judged")
		os.Exit(1)
	}

	cover := exec.Command("go", "tool", "cover", "-func="+profile)
	report, err := cover.CombinedOutput()
	if err != nil {
		os.Stdout.Write(report)
		fmt.Fprintf(os.Stderr, "coverage floor: go tool cover failed: %v\n", err)
		os.Exit(1)
	}

	match := reTotal.FindStringSubmatch(string(report))
	if match == nil {
		// A check that could not run is a failure to report, not a silent pass.
		fmt.Fprintf(os.Stderr, "coverage floor: no total line in the output of "+
			"`go tool cover -func` over %s\n", targetPackages)
		os.Exit(1)
	}

	got, err := strconv.ParseFloat(match[1], 64)
	if err != nil {
		fmt.Fprintf(os.Stderr, "coverage floor: could not parse %q as a percentage: %v\n",
			match[1], err)
		os.Exit(1)
	}

	if got < floorPercent {
		fmt.Fprintf(os.Stderr, "\ncoverage floor: %.1f%% is below the required %.1f%%\n",
			got, floorPercent)
		fmt.Fprintln(os.Stderr, "Add tests for what you changed, or justify moving the floor.")
		os.Exit(1)
	}

	fmt.Printf("coverage floor: %.1f%% meets the %.1f%% minimum\n", got, floorPercent)
}
