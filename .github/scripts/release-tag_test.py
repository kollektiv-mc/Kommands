#!/usr/bin/env python3
"""Tests for the release tag ladder.

Run: python3 .github/scripts/release-tag_test.py

No network and no token: this is the pure decision-making, which is all of the
script that can strand a release. The API plumbing around it - creating the tag,
uploading the assets - is exercised by actually cutting one, and mocking it
would only test the mock.

Each refusal below has a cost behind it. A duplicate tag is a release cut
twice; a tag sorting at or below an existing one of the same core leaves
/releases/latest pointing at the older release forever; a base version that has
stopped outranking the tag strands the snapshot channel. None of the three
announces itself afterwards, which is why they are refused up front.
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location("release_tag", HERE / "release-tag.py")
release_tag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_tag)

failures: list[str] = []


def check(name: str, got: object, want: object) -> None:
    if got != want:
        failures.append(f"{name}\n    got  {got!r}\n    want {want!r}")


# ── parse_tag ──────────────────────────────────────────────────────────────
check("a final parses", release_tag.parse_tag("v0.1.0"), ("0.1.0", "stable", 0))
check(
    "an alpha parses", release_tag.parse_tag("v0.1.0-alpha.3"), ("0.1.0", "alpha", 3)
)
check("a beta parses", release_tag.parse_tag("v1.2.3-beta.10"), ("1.2.3", "beta", 10))
# Everything off the ladder is None and takes part in no decision. The rolling
# `snapshot` tag is the one that exists in this repo and must never be read as
# a release.
for stray in ("snapshot", "v0.1.0-rc.1", "0.1.0", "v0.1", "v0.1.0-alpha", "latest"):
    check(f"{stray} is off the ladder", release_tag.parse_tag(stray), None)

# ── next_tag ───────────────────────────────────────────────────────────────
check("the first alpha of a core", release_tag.next_tag("alpha", "0.1.0", []), "v0.1.0-alpha.1")
check(
    "the next alpha counts up",
    release_tag.next_tag("alpha", "0.1.0", ["v0.1.0-alpha.1", "v0.1.0-alpha.2"]),
    "v0.1.0-alpha.3",
)
# Max rather than count: a deleted tag in the middle must not hand its number
# out a second time.
check(
    "a gap does not reissue a counter",
    release_tag.next_tag("alpha", "0.1.0", ["v0.1.0-alpha.1", "v0.1.0-alpha.7"]),
    "v0.1.0-alpha.8",
)
# The counters are per channel and per core, so a beta does not inherit the
# alpha's number and another core's tags are invisible.
check(
    "beta counts independently of alpha",
    release_tag.next_tag("beta", "0.1.0", ["v0.1.0-alpha.4"]),
    "v0.1.0-beta.1",
)
check(
    "another core's tags do not count",
    release_tag.next_tag("alpha", "0.2.0", ["v0.1.0-alpha.9"]),
    "v0.2.0-alpha.1",
)
check("stable is the bare core", release_tag.next_tag("stable", "0.1.0", []), "v0.1.0")

# ── problems ───────────────────────────────────────────────────────────────
check(
    "a clean first alpha has no problems",
    release_tag.problems("v0.1.0-alpha.1", [], "0.1.0-dev"),
    [],
)

shape = release_tag.problems("v0.1.0-rc.1", [], "0.1.0-dev")
check("an off-ladder shape is refused", len(shape), 1)
check("and the message names the shapes", "vX.Y.Z-alpha.N" in shape[0], True)

duplicate = release_tag.problems("v0.1.0-alpha.1", ["v0.1.0-alpha.1"], "0.1.0-dev")
check("a duplicate is refused", any("already exists" in p for p in duplicate), True)

# An alpha cut after a beta of the same core sorts under it.
backwards = release_tag.problems("v0.1.0-alpha.5", ["v0.1.0-beta.1"], "0.1.0-dev")
check("a tag below an existing one is refused", len(backwards), 1)
check(
    "and the message says what it costs",
    "/releases/latest" in backwards[0] and "RPM" in backwards[0],
    True,
)

# A higher core is unaffected by the lower core's tags.
check(
    "a later core is not held back",
    release_tag.problems("v0.2.0-alpha.1", ["v0.1.0-beta.1"], "0.2.0-dev"),
    [],
)

# The snapshot rule, both halves. An alpha whose core is ahead of the base:
# every snapshot would sort below the release.
ahead = release_tag.problems("v0.2.0-alpha.1", [], "0.1.0-dev")
check("a prerelease past the base is refused", len(ahead), 1)
check("and it names the bump to make", "0.2.0-dev" in ahead[0], True)

# A final at the base: shipping it strands the channel immediately, because a
# snapshot of 0.1.0 sorts below v0.1.0.
final = release_tag.problems("v0.1.0", [], "0.1.0-dev")
check("a final at the base is refused", len(final), 1)
check(
    "and it offers both bumps",
    "0.1.1-dev" in final[0] and "0.2.0-dev" in final[0],
    True,
)
# Once the base has moved past it, the same final is fine.
check(
    "a final below the base is allowed",
    release_tag.problems("v0.1.0", [], "0.2.0-dev"),
    [],
)

# ── flag_prerelease ────────────────────────────────────────────────────────
# Nothing shipped yet: the alpha has to *be* /releases/latest, because
# release-notes.py takes its baseline from there and the snapshot workflow
# compares itself against it.
check(
    "the first alpha is not flagged",
    release_tag.flag_prerelease("v0.1.0-alpha.1", ""),
    False,
)
check(
    "an alpha after another alpha is still not flagged",
    release_tag.flag_prerelease("v0.1.0-alpha.2", "v0.1.0-alpha.1"),
    False,
)
check(
    "an alpha after a final is flagged",
    release_tag.flag_prerelease("v0.2.0-alpha.1", "v0.1.0"),
    True,
)
check("a final is never flagged", release_tag.flag_prerelease("v0.2.0", "v0.1.0"), False)

# ── rpm_version ────────────────────────────────────────────────────────────
check("a final's rpm version", release_tag.rpm_version("v0.1.0"), "0.1.0")
# "-" is not allowed in an RPM version, and "~" sorts before the base, which is
# what makes a prerelease package upgrade *to* the final rather than over it.
check(
    "a prerelease's rpm version", release_tag.rpm_version("v0.1.0-alpha.1"), "0.1.0~alpha.1"
)

# ── resolve ────────────────────────────────────────────────────────────────
# The run this repo is about to make: the very first release, dispatched as
# alpha 0.1.0 against version.go's 0.1.0-dev, with no tags and nothing
# published. It resolves to v0.1.0-alpha.1 and is not flagged a prerelease.
outputs, found = release_tag.resolve(
    {
        "EVENT": "workflow_dispatch",
        "CHANNEL": "alpha",
        "VERSION": "0.1.0",
        "BASE": "0.1.0-dev",
        "LATEST": "",
    },
    [],
)
check("the first release resolves", found, [])
check(
    "to v0.1.0-alpha.1",
    outputs,
    {"tag": "v0.1.0-alpha.1", "rpm_version": "0.1.0~alpha.1", "prerelease": "false"},
)

# The push path reaches the same rules, with the pushed tag taken out of the
# existing set so it is not read as its own duplicate.
outputs, found = release_tag.resolve(
    {"EVENT": "push", "REF_NAME": "v0.1.0-alpha.2", "BASE": "0.1.0-dev", "LATEST": ""},
    ["v0.1.0-alpha.1", "v0.1.0-alpha.2"],
)
check("a pushed tag is not its own duplicate", found, [])
check("and resolves to itself", outputs["tag"], "v0.1.0-alpha.2")

# Inputs reach the script as environment rather than as shell text, so a
# version field containing anything but a version is data to reject.
_, found = release_tag.resolve(
    {"EVENT": "workflow_dispatch", "CHANNEL": "alpha", "VERSION": "0.1", "BASE": "0.1.0-dev"},
    [],
)
check("a malformed version is refused", len(found), 1)
_, found = release_tag.resolve(
    {
        "EVENT": "workflow_dispatch",
        "CHANNEL": "alpha",
        "VERSION": "1.0.0; rm -rf /",
        "BASE": "1.0.0-dev",
    },
    [],
)
check("a version carrying shell is refused", len(found), 1)
_, found = release_tag.resolve(
    {"EVENT": "workflow_dispatch", "CHANNEL": "nightly", "VERSION": "0.1.0", "BASE": "0.1.0-dev"},
    [],
)
check("an unknown channel is refused", len(found), 1)
_, found = release_tag.resolve({"EVENT": "schedule"}, [])
check("an unexpected event is refused", len(found), 1)

# ── Report ─────────────────────────────────────────────────────────────────
if failures:
    print(f"{len(failures)} failing:\n", file=sys.stderr)
    for failure in failures:
        print(f"  {failure}\n", file=sys.stderr)
    sys.exit(1)
print("release-tag: all checks passed")
