#!/usr/bin/env python3
"""Tests for semver precedence and the stranded-snapshot warning.

Run: python3 .github/scripts/version-precedence_test.py

Two classes of case, and the second is the one worth having.

The first is ordinary: pairs of versions and which way they sort, covering the
rules a hand-rolled comparison gets wrong - that a prerelease sorts below the
final of the same core, that numeric identifiers compare as numbers so
`alpha.2` is below `alpha.10`, that a number sorts below any text, and that the
shorter suffix wins once every shared identifier agrees.

The second checks the claim the whole snapshot channel rests on: that RPM's own
ordering agrees with semver's **for the version shapes this repo produces**.
The snapshot RPM is `<base>~snapshot.<stamp>.<sha>` and `dnf upgrade` orders it
with rpmvercmp, not with semver, so a disagreement inside that shape space
would mean the warning in version-precedence.py fires on the wrong condition.
Rather than reasoning about it, the pairs go through rpm's own implementation -
`rpm --eval '%{lua:print(rpm.vercmp(...))}'` - and the answers are compared.

Two places where the two genuinely disagree
-------------------------------------------

Found by this test rather than predicted, and both are outside the ladder, so
LADDER and SEMVER_ONLY below are separated rather than one list.

  * **A number against text at the same position.** Semver ranks a numeric
    identifier *below* an alphanumeric one, so `alpha.1 < alpha.rc`. rpmvercmp
    ranks digits *above* letters and answers the opposite. Unreachable here:
    every identifier this ladder emits after `alpha`, `beta` or `snapshot` is
    all digits, so no comparison ever puts a number against text.

  * **Digits embedded in the commit sha.** rpmvercmp splits a segment into runs
    of digits and runs of letters, so it reads `a9z1234` as `a`,`9`,`z`,`1234`;
    semver compares the whole identifier as text. They disagree whenever the
    digit runs differ in length (`a9z1234` against `a10z234`). Unreachable in
    any way that matters: the sha only decides an ordering when two snapshots
    carry the *same* minute stamp, which means two builds of different commits
    within the same minute - and which of those is "newer" is arbitrary under
    either rule.

Neither is worked around, because neither can occur. If the ladder ever grows a
channel whose counter is not a number, the first one becomes live and this note
is the reason to come back here.

The cross-check needs the `rpm` binary, which CI installs for exactly this. If
it is missing the class reports a **skip**, loudly and by name. A skip is not a
pass: it means this run did not check the property, and the report says so.
"""

from __future__ import annotations

import importlib.util
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location(
    "version_precedence", HERE / "version-precedence.py"
)
precedence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(precedence)

failures: list[str] = []
skips: list[str] = []


def check(name: str, got: object, want: object) -> None:
    if got != want:
        failures.append(f"{name}\n    got  {got!r}\n    want {want!r}")


# ── Ordering ───────────────────────────────────────────────────────────────
# (lower, higher). Every pair is asserted in both directions and against
# itself, so an implementation that returns a constant cannot pass.
#
# LADDER is every shape release-tag.py and snapshot.yml can actually emit:
# vX.Y.Z, vX.Y.Z-alpha.N, vX.Y.Z-beta.N and X.Y.Z-snapshot.<stamp>.<sha>. Only
# these are put through rpm, for the reason in the module docstring.
LADDER = [
    ("0.1.0", "0.2.0"),
    ("0.1.0", "1.0.0"),
    ("0.1.9", "0.1.10"),
    # A prerelease is below the final of its own core. This is the rule that
    # makes `~` the right RPM idiom and the one sort -V does not implement.
    ("0.1.0-alpha.1", "0.1.0"),
    ("0.1.0-snapshot.202609160400.abc1234", "0.1.0"),
    # Identifier by identifier, text compared as text.
    ("0.1.0-alpha.1", "0.1.0-beta.1"),
    ("0.1.0-beta.9", "0.1.0-snapshot.202609160400.abc1234"),
    # Numeric identifiers compare as numbers, which is the whole reason a
    # string compare will not do: "10" sorts below "2" as text.
    ("0.1.0-alpha.2", "0.1.0-alpha.10"),
    # The timestamp is what orders two snapshots; the sha says nothing about
    # which build is newer, which is why the stamp is in the version at all.
    (
        "0.1.0-snapshot.202609160400.abc1234",
        "0.1.0-snapshot.202609170400.def5678",
    ),
    # A snapshot of the next base outranks a release of the previous one. This
    # is the condition version-precedence.py exists to watch.
    ("0.1.0", "0.2.0-snapshot.202609160400.abc1234"),
    # The leading v is not part of the comparison.
    ("v0.1.0-alpha.1", "0.1.0"),
]

# Semver rules this implementation has to get right, in shapes the ladder does
# not emit. Not handed to rpm: the first pair is one of the two documented
# disagreements, and asserting rpm's answer here would pin a behaviour no
# release depends on.
SEMVER_ONLY = [
    # A number sorts below any text. rpmvercmp says the reverse.
    ("0.1.0-alpha.1", "0.1.0-alpha.rc"),
    # Once every shared identifier agrees, the shorter suffix is lower.
    ("0.1.0-alpha", "0.1.0-alpha.1"),
]

for lower, higher in LADDER + SEMVER_ONLY:
    check(f"{lower} < {higher}", precedence.compare_versions(lower, higher), -1)
    check(f"{higher} > {lower}", precedence.compare_versions(higher, lower), 1)
    check(f"{lower} == {lower}", precedence.compare_versions(lower, lower), 0)
    check(f"{higher} == {higher}", precedence.compare_versions(higher, higher), 0)

# The v prefix is cosmetic on both sides.
check("v0.1.0 == 0.1.0", precedence.compare_versions("v0.1.0", "0.1.0"), 0)

# A core component that is not a number is left at 0 rather than raising, so a
# stray tag GitHub reports as /releases/latest stays comparable.
check(
    "a malformed core still compares",
    precedence.compare_versions("0.1.0", "v2.0-alpha"),
    -1,
)

# ── RPM agreement ──────────────────────────────────────────────────────────
RPM = shutil.which("rpm")


def rpm_vercmp(a: str, b: str) -> int:
    """rpm's own comparison of two version strings, as -1, 0 or 1."""
    completed = subprocess.run(
        [RPM, "--eval", f'%{{lua:print(rpm.vercmp("{a}", "{b}"))}}'],
        capture_output=True,
        text=True,
        check=True,
    )
    return int(completed.stdout.strip())


def rpm_form(version: str) -> str:
    """The version as the RPM carries it.

    The same substitution release-tag.py's rpm_version() and snapshot.yml both
    make: no leading v, and "-" as "~" so a prerelease sorts below its base.
    """
    return version.removeprefix("v").replace("-", "~")


if RPM is None:
    skips.append(
        "rpm agreement: the `rpm` binary is not installed, so this run did not "
        "check that rpmvercmp orders the ladder's versions the way semver does. "
        "Install it (apt-get install -y rpm) to run this class."
    )
else:
    for lower, higher in LADDER:
        rpm_lower, rpm_higher = rpm_form(lower), rpm_form(higher)
        check(
            f"rpm agrees {rpm_lower} < {rpm_higher}",
            rpm_vercmp(rpm_lower, rpm_higher),
            -1,
        )
    # The disagreements are documented rather than worked around, so they are
    # pinned too: if a future rpm changed its mind, the note above would
    # quietly stop being true.
    check(
        "rpm still ranks a number above text (the documented divergence)",
        rpm_vercmp("0.1.0~alpha.1", "0.1.0~alpha.rc"),
        1,
    )

# ── The warning ────────────────────────────────────────────────────────────
# Nothing released yet is nothing to warn about: the channel cannot be
# stranded against a release that does not exist.
check(
    "no release, no warning",
    precedence.annotation("0.1.0-snapshot.202609160400.abc1234", ""),
    "",
)
check("no snapshot, no warning", precedence.annotation("", "v0.1.0-alpha.1"), "")

# The healthy case: the snapshot is ahead of the newest release, which is what
# a snapshot is for.
check(
    "a snapshot ahead of the release is healthy",
    precedence.annotation("0.2.0-snapshot.202609160400.abc1234", "v0.1.0"),
    "",
)
check(
    "a snapshot ahead of an alpha of its own core is healthy",
    precedence.annotation("0.1.0-snapshot.202609160400.abc1234", "v0.1.0-alpha.1"),
    "",
)

# The stranded case, which is the one this file exists for. version.go still
# says 0.1.0-dev after v0.1.0 shipped, so every snapshot now sorts below it.
stranded = precedence.annotation("0.1.0-snapshot.202609160400.abc1234", "v0.1.0")
check("a stranded snapshot warns", stranded.startswith("::warning::"), True)
check("the warning names the base", "0.1.0" in stranded, True)
check("the warning names the release", "v0.1.0" in stranded, True)
# It has to say what to do, not just that something is wrong: the fix is a
# commit on main and no workflow will make it.
check("the warning names the fix", "Bump version.go" in stranded, True)

# Equal ranks as stranded too - "at or below", not "below".
check(
    "an equal snapshot warns",
    precedence.annotation(
        "0.1.0-snapshot.202609160400.abc1234",
        "0.1.0-snapshot.202609160400.abc1234",
    ).startswith("::warning::"),
    True,
)

# ── Report ─────────────────────────────────────────────────────────────────
for skip in skips:
    print(f"version-precedence: SKIPPED {skip}", file=sys.stderr)
if failures:
    print(f"{len(failures)} failing:\n", file=sys.stderr)
    for failure in failures:
        print(f"  {failure}\n", file=sys.stderr)
    sys.exit(1)
if skips:
    print(f"version-precedence: checks passed, {len(skips)} class(es) skipped")
else:
    print("version-precedence: all checks passed")
