#!/usr/bin/env python3
"""Semver precedence, and the warning for a base version that has stopped
keeping snapshots above the newest release.

A snapshot is stamped `<base>-snapshot.<stamp>.<sha>`, where the base comes
from version.go. Cut a release whose version reaches that base and every future
snapshot sorts *below* it. Two things break, and neither announces itself:

  * **The RPM stops upgrading.** A snapshot packages as `<base>~snapshot....`,
    and `~` sorts before the base the way a prerelease should. Once the base no
    longer outranks the newest release, `dnf upgrade` sees the snapshot as
    older than the installed release build and refuses it. A snapshot user on
    Fedora or RHEL is then held on the stable build with no error saying why.
  * **The snapshot release page starts lying.** Its title is the bare version
    string and its body says it is newer than the latest release. If it sorts
    below, that sentence is false and nothing checks it.

Nothing in CI can repair either after the fact, so the one useful thing is to
say so out loud on the run that first produces a stranded snapshot.

Where this differs from Konnekt's copy of the same idea
------------------------------------------------------

Konnekt has an in-app updater, and its script mirrors that updater's Go
`compareVersions` so the answer is the one the updater would give. Kommands has
no updater and never will - it is a command generator, and its releases are
downloads. So this implements **semver precedence on its own terms**, and two
of Konnekt's quirks are deliberately not carried over:

  * No int64 clamp on numeric identifiers. That line exists over there because
    Go's strconv.ParseInt fails past it and the Go then falls back to text.
    Semver itself sets no such limit, and there is no Go function here to
    agree with, so keeping it would be a rule with no reason behind it.
  * Leniency on a malformed version core is kept, but for a different reason:
    LATEST is whatever tag GitHub reports, which includes any stray tag the
    ladder in release-tag.py did not cut. Leaving a non-numeric component at 0
    keeps such a tag comparable instead of raising at the moment a release is
    being cut.

That the RPM's own ordering agrees with semver's for the shapes this repo
produces is checked rather than assumed: version-precedence_test.py runs the
pairs through `rpmdev-vercmp` when it is installed, and skips that class with a
reason when it is not.

Reads:

  VERSION  the snapshot version about to be published, as snapshot.yml
           computed it (e.g. 0.1.0-snapshot.202609160400.abc1234)
  LATEST   the newest published release's tag (e.g. v0.1.0-alpha.1). Empty
           when nothing has been released yet, which is nothing to warn about.

Writes a `::warning::` annotation to stdout when the snapshot does not outrank
the release. Always exits 0: this is an observation about a decision already
made elsewhere, and failing the run would only cost the build that carries it.
"""

from __future__ import annotations

import os
import sys

SNAPSHOT_MARKER = "-snapshot."


def split_version(version: str) -> tuple[str, str]:
    """Core and prerelease, with the leading v dropped."""
    version = version.removeprefix("v")
    core, separator, prerelease = version.partition("-")
    return core, prerelease if separator else ""


def parse_core(core: str) -> list[int]:
    """The three numeric components of a version core.

    A component that is not a number is left at 0 rather than rejected, for the
    reason in the module docstring: LATEST can be a tag this ladder never cut.
    """
    parts: list[int] = [0, 0, 0]
    for index, component in enumerate(core.split(".", 2)[:3]):
        try:
            parts[index] = int(component)
        except ValueError:
            continue
    return parts


def numeric_identifier(identifier: str) -> int | None:
    """The value of an all-digit identifier, else None.

    `isdigit` alone would accept superscripts and other Unicode digits that
    `int` then reads as numbers, so a prerelease identifier is only numeric
    here when it is ASCII as well - which every identifier semver allows is.
    """
    if not identifier or not identifier.isascii() or not identifier.isdigit():
        return None
    return int(identifier)


def compare_identifier(a: str, b: str) -> int:
    num_a, num_b = numeric_identifier(a), numeric_identifier(b)
    if num_a is not None and num_b is not None:
        return (num_a > num_b) - (num_a < num_b)
    if num_a is not None:
        return -1
    if num_b is not None:
        return 1
    return (a > b) - (a < b)


def compare_prerelease(a: str, b: str) -> int:
    """Semver's rule, identifier by identifier.

    Numbers as numbers, anything else as text, a number below any text, and the
    shorter suffix below the longer once every shared identifier agrees.
    """
    ids_a, ids_b = a.split("."), b.split(".")
    for id_a, id_b in zip(ids_a, ids_b):
        if (order := compare_identifier(id_a, id_b)) != 0:
            return order
    return (len(ids_a) > len(ids_b)) - (len(ids_a) < len(ids_b))


def compare_versions(a: str, b: str) -> int:
    """-1, 0 or 1 for semver precedence."""
    core_a, pre_a = split_version(a)
    core_b, pre_b = split_version(b)

    for part_a, part_b in zip(parse_core(core_a), parse_core(core_b)):
        if part_a != part_b:
            return -1 if part_a < part_b else 1

    if not pre_a and not pre_b:
        return 0
    if not pre_a:
        return 1
    if not pre_b:
        return -1
    return compare_prerelease(pre_a, pre_b)


def annotation(version: str, latest: str) -> str:
    """The warning for this pair, or "" when the channel is healthy."""
    if not version or not latest or compare_versions(version, latest) > 0:
        return ""
    base = version.split(SNAPSHOT_MARKER, 1)[0]
    return (
        f"::warning::version.go's base ({base}) no longer keeps snapshots above the newest "
        f"release ({latest}): {version} sorts at or below it, so the snapshot RPM will stop "
        f"upgrading and the snapshot release page will claim to be newer than it is. "
        f"Bump version.go and wails.json past {latest}."
    )


def main() -> int:
    message = annotation(
        os.environ.get("VERSION", "").strip(), os.environ.get("LATEST", "").strip()
    )
    if message:
        print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
