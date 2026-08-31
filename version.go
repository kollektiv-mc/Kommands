package main

// Version identifies this build of the shell. It is reported by the
// /api/capabilities probe, written into the install marker Konnekt stats, and
// will be stamped by the release workflow when one exists (#44). The frontend
// has no version of its own — the two ship together in one binary, which is
// the point of the standalone build.
const Version = "0.1.0-dev"
