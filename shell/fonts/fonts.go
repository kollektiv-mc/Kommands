// Package fonts lists the font families installed on this machine, for the
// Settings dialog's font rows (docs/design-tokens.md § The three faces).
//
// The webview cannot answer this itself. The Local Font Access API exists only
// in Chromium, and the Linux and macOS webviews are WebKit, so the shell reads
// the platform's font directories and each file's `name` table instead. No
// font library: a family name is a handful of fixed-offset reads, and a
// dependency for that would outweigh the code it replaced.
package fonts

import (
	"encoding/binary"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"unicode/utf16"
)

// Bounds on what a font file can make this package read. A font directory is
// written by other software, so a malformed or hostile file must cost a skip,
// never an allocation it chose.
const (
	maxFiles      = 20000
	maxTables     = 512
	maxNameCount  = 4096
	maxFontsInTTC = 256
	maxNameBytes  = 512
)

// Dirs are the directories the platform installs fonts into, for this user and
// for everyone. A directory that does not exist is left in; Families skips it.
func Dirs() []string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		return []string{
			filepath.Join(os.Getenv("WINDIR"), "Fonts"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "Windows", "Fonts"),
		}
	case "darwin":
		return []string{
			"/System/Library/Fonts",
			"/Library/Fonts",
			filepath.Join(home, "Library", "Fonts"),
		}
	default:
		dataHome := os.Getenv("XDG_DATA_HOME")
		if dataHome == "" {
			dataHome = filepath.Join(home, ".local", "share")
		}
		dirs := []string{filepath.Join(dataHome, "fonts"), filepath.Join(home, ".fonts")}
		dataDirs := os.Getenv("XDG_DATA_DIRS")
		if dataDirs == "" {
			dataDirs = "/usr/local/share:/usr/share"
		}
		for _, dir := range filepath.SplitList(dataDirs) {
			dirs = append(dirs, filepath.Join(dir, "fonts"))
		}
		return dirs
	}
}

// Families walks dirs and returns every family name found, deduplicated and
// sorted case-insensitively. Files that cannot be read or parsed are skipped:
// one broken font must not empty the list.
func Families(dirs []string) []string {
	seen := map[string]bool{}
	files := 0
	for _, dir := range dirs {
		_ = filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				// A missing or unreadable directory is the normal case for
				// most entries in Dirs(); skip it rather than stop the walk.
				return nil
			}
			if entry.IsDir() || !isFontFile(path) {
				return nil
			}
			files++
			if files > maxFiles {
				return filepath.SkipAll
			}
			for _, name := range familiesInFile(path) {
				seen[name] = true
			}
			return nil
		})
	}
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool {
		a, b := strings.ToLower(names[i]), strings.ToLower(names[j])
		if a == b {
			return names[i] < names[j]
		}
		return a < b
	})
	return names
}

func isFontFile(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".ttf", ".otf", ".ttc", ".otc":
		return true
	}
	return false
}

func familiesInFile(path string) []string {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()
	names, err := familyNames(file)
	if err != nil {
		return nil
	}
	return names
}

var errMalformed = errors.New("fonts: malformed font file")

// familyNames reads the family name of each font in an sfnt file or a
// TrueType/OpenType collection. A name starting with "." is dropped: macOS
// uses that prefix for system UI faces that are not meant to be chosen.
func familyNames(r io.ReaderAt) ([]string, error) {
	tag, err := readU32(r, 0)
	if err != nil {
		return nil, err
	}
	offsets := []int64{0}
	if tag == 0x74746366 { // "ttcf"
		count, err := readU32(r, 8)
		if err != nil {
			return nil, err
		}
		if count == 0 || count > maxFontsInTTC {
			return nil, errMalformed
		}
		offsets = offsets[:0]
		for i := int64(0); i < int64(count); i++ {
			offset, err := readU32(r, 12+4*i)
			if err != nil {
				return nil, err
			}
			offsets = append(offsets, int64(offset))
		}
	}
	var names []string
	for _, offset := range offsets {
		name, err := familyName(r, offset)
		if err != nil || name == "" || strings.HasPrefix(name, ".") {
			continue
		}
		names = append(names, name)
	}
	return names, nil
}

// familyName reads one font's family from its name table: the typographic
// family (name ID 16) when present, else the legacy family (ID 1). ID 16 is
// what groups "Inter Bold" and "Inter Light" under "Inter", which is the name
// CSS font-family matches.
func familyName(r io.ReaderAt, fontOffset int64) (string, error) {
	numTables, err := readU16(r, fontOffset+4)
	if err != nil {
		return "", err
	}
	if numTables > maxTables {
		return "", errMalformed
	}
	var nameOffset int64 = -1
	for i := int64(0); i < int64(numTables); i++ {
		record := fontOffset + 12 + 16*i
		tag, err := readU32(r, record)
		if err != nil {
			return "", err
		}
		if tag == 0x6e616d65 { // "name"
			offset, err := readU32(r, record+8)
			if err != nil {
				return "", err
			}
			nameOffset = int64(offset)
			break
		}
	}
	if nameOffset < 0 {
		return "", errMalformed
	}

	count, err := readU16(r, nameOffset+2)
	if err != nil {
		return "", err
	}
	storage, err := readU16(r, nameOffset+4)
	if err != nil {
		return "", err
	}
	if count > maxNameCount {
		return "", errMalformed
	}

	best, bestRank := "", 0
	for i := int64(0); i < int64(count); i++ {
		var record [12]byte
		if _, err := r.ReadAt(record[:], nameOffset+6+12*i); err != nil {
			return "", err
		}
		platform := binary.BigEndian.Uint16(record[0:])
		encoding := binary.BigEndian.Uint16(record[2:])
		language := binary.BigEndian.Uint16(record[4:])
		nameID := binary.BigEndian.Uint16(record[6:])
		length := binary.BigEndian.Uint16(record[8:])
		offset := binary.BigEndian.Uint16(record[10:])
		if nameID != 1 && nameID != 16 {
			continue
		}
		rank := recordRank(platform, encoding, language)
		if rank == 0 {
			continue
		}
		if nameID == 16 {
			rank += 10
		}
		if rank <= bestRank || length == 0 || length > maxNameBytes {
			continue
		}
		raw := make([]byte, length)
		if _, err := r.ReadAt(raw, nameOffset+int64(storage)+int64(offset)); err != nil {
			continue
		}
		text := decodeName(platform, raw)
		if text == "" {
			continue
		}
		best, bestRank = text, rank
	}
	return strings.TrimSpace(best), nil
}

// recordRank orders the encodings a name can be stored in, highest first.
// Zero means an encoding this package does not decode.
func recordRank(platform, encoding, language uint16) int {
	switch {
	case platform == 3 && (encoding == 1 || encoding == 10) && language == 0x409:
		return 4 // Windows, Unicode, US English
	case platform == 3 && (encoding == 1 || encoding == 10):
		return 3
	case platform == 0:
		return 2 // Unicode platform
	case platform == 1 && encoding == 0:
		return 1 // Mac Roman
	}
	return 0
}

func decodeName(platform uint16, raw []byte) string {
	if platform == 1 {
		// Mac Roman agrees with ASCII below 0x80, which covers family names in
		// practice; anything above that is dropped rather than mis-decoded.
		var b strings.Builder
		for _, c := range raw {
			if c < 0x80 {
				b.WriteByte(c)
			}
		}
		return b.String()
	}
	if len(raw)%2 != 0 {
		return ""
	}
	units := make([]uint16, len(raw)/2)
	for i := range units {
		units[i] = binary.BigEndian.Uint16(raw[2*i:])
	}
	return string(utf16.Decode(units))
}

func readU16(r io.ReaderAt, offset int64) (uint16, error) {
	var b [2]byte
	if _, err := r.ReadAt(b[:], offset); err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint16(b[:]), nil
}

func readU32(r io.ReaderAt, offset int64) (uint32, error) {
	var b [4]byte
	if _, err := r.ReadAt(b[:], offset); err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint32(b[:]), nil
}
