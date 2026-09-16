package main

// Version identifies this build of the shell. It is reported by the
// /api/capabilities probe, by `kommands -version`, and written into the
// install marker Konnekt stats to learn which Kommands is installed. The
// frontend has no version of its own - the two ship together in one binary,
// which is the point of the standalone build.
//
// A var rather than a const, and that is load-bearing rather than a style
// choice. The release and snapshot workflows stamp this with
// `-ldflags "-X main.Version=..."`, and the linker's -X writes to a string
// *variable*: against a constant it does nothing at all and reports no error,
// so every release would have shipped claiming to be the value below. CI's
// shell job builds with -X and asserts `kommands -version` echoes it back,
// which is the check that would have caught it.
//
// The literal is also read out of this file by the workflows, with
// `sed -n 's/^var Version = "\([^"]*\)".*/\1/p'`, to derive a snapshot's base
// version. Keep the declaration on one line in that shape.
var Version = "0.1.0-dev"
