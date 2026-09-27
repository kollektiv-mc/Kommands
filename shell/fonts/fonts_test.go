package fonts

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
	"unicode/utf16"
)

type nameRecord struct {
	platform, encoding, language, nameID uint16
	text                                 string
}

func encodeName(record nameRecord) []byte {
	if record.platform == 1 {
		return []byte(record.text)
	}
	var out []byte
	for _, unit := range utf16.Encode([]rune(record.text)) {
		out = binary.BigEndian.AppendUint16(out, unit)
	}
	return out
}

// buildFont writes a minimal sfnt: an offset table with one table record, and
// a name table holding the given records. base is where the font starts in the
// file, because table offsets are absolute and a collection places fonts after
// its own header.
func buildFont(base int, records []nameRecord) []byte {
	const headerSize = 12 + 16
	var storage []byte
	var name bytes.Buffer
	_ = binary.Write(&name, binary.BigEndian, uint16(0))
	_ = binary.Write(&name, binary.BigEndian, uint16(len(records)))
	_ = binary.Write(&name, binary.BigEndian, uint16(6+12*len(records)))
	for _, record := range records {
		text := encodeName(record)
		for _, field := range []uint16{
			record.platform, record.encoding, record.language, record.nameID,
			uint16(len(text)), uint16(len(storage)),
		} {
			_ = binary.Write(&name, binary.BigEndian, field)
		}
		storage = append(storage, text...)
	}
	name.Write(storage)

	var font bytes.Buffer
	_ = binary.Write(&font, binary.BigEndian, uint32(0x00010000))
	_ = binary.Write(&font, binary.BigEndian, uint16(1))
	font.Write(make([]byte, 6))
	font.WriteString("name")
	_ = binary.Write(&font, binary.BigEndian, uint32(0))
	_ = binary.Write(&font, binary.BigEndian, uint32(base+headerSize))
	_ = binary.Write(&font, binary.BigEndian, uint32(name.Len()))
	font.Write(name.Bytes())
	return font.Bytes()
}

func windowsName(nameID uint16, text string) nameRecord {
	return nameRecord{platform: 3, encoding: 1, language: 0x409, nameID: nameID, text: text}
}

func TestFamilyNamePrefersTypographicFamily(t *testing.T) {
	font := buildFont(0, []nameRecord{
		windowsName(1, "Inter Bold"),
		windowsName(16, "Inter"),
	})
	got, err := familyNames(bytes.NewReader(font))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"Inter"}) {
		t.Fatalf("got %q, want [Inter]", got)
	}
}

func TestFamilyNameEncodings(t *testing.T) {
	cases := []struct {
		name    string
		records []nameRecord
		want    []string
	}{
		{
			"US English beats another Windows language",
			[]nameRecord{
				{platform: 3, encoding: 1, language: 0x407, nameID: 1, text: "Schrift"},
				windowsName(1, "Type"),
			},
			[]string{"Type"},
		},
		{
			"Mac Roman when nothing else is present",
			[]nameRecord{{platform: 1, encoding: 0, nameID: 1, text: "Geneva"}},
			[]string{"Geneva"},
		},
		{
			"Unicode platform",
			[]nameRecord{{platform: 0, encoding: 3, nameID: 1, text: "Noto Sans"}},
			[]string{"Noto Sans"},
		},
		{
			"non-Latin family",
			[]nameRecord{windowsName(1, "源ノ角ゴシック")},
			[]string{"源ノ角ゴシック"},
		},
		{
			"macOS hidden UI face is dropped",
			[]nameRecord{windowsName(1, ".SF NS")},
			nil,
		},
		{
			"no family record",
			[]nameRecord{windowsName(4, "Full Name Only")},
			nil,
		},
		{
			"unsupported encoding only",
			[]nameRecord{{platform: 3, encoding: 0, nameID: 1, text: "Symbol"}},
			nil,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := familyNames(bytes.NewReader(buildFont(0, c.records)))
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestCollection(t *testing.T) {
	// A ttcf header naming two fonts, each built at the offset it lands on.
	const header = 12 + 4*2
	first := buildFont(header, []nameRecord{windowsName(1, "Alpha")})
	second := buildFont(header+len(first), []nameRecord{windowsName(1, "Beta")})

	var file bytes.Buffer
	file.WriteString("ttcf")
	_ = binary.Write(&file, binary.BigEndian, uint32(0x00010000))
	_ = binary.Write(&file, binary.BigEndian, uint32(2))
	_ = binary.Write(&file, binary.BigEndian, uint32(header))
	_ = binary.Write(&file, binary.BigEndian, uint32(header+len(first)))
	file.Write(first)
	file.Write(second)

	got, err := familyNames(bytes.NewReader(file.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"Alpha", "Beta"}) {
		t.Fatalf("got %q", got)
	}
}

func TestMalformedFiles(t *testing.T) {
	valid := buildFont(0, []nameRecord{windowsName(1, "Whole")})
	cases := map[string][]byte{
		"empty":         {},
		"truncated":     valid[:20],
		"no name table": append([]byte{0, 1, 0, 0, 0, 0}, make([]byte, 6)...),
		"huge table count": func() []byte {
			b := append([]byte(nil), valid...)
			binary.BigEndian.PutUint16(b[4:], 0xFFFF)
			return b
		}(),
		"collection claiming too many fonts": append([]byte("ttcf\x00\x01\x00\x00"), 0xFF, 0xFF, 0xFF, 0xFF),
	}
	for name, data := range cases {
		t.Run(name, func(t *testing.T) {
			got, _ := familyNames(bytes.NewReader(data))
			if len(got) != 0 {
				t.Fatalf("got %q from a malformed file", got)
			}
		})
	}
}

func TestFamiliesWalksDedupesAndSorts(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "truetype", "nested")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	write := func(path string, data []byte) {
		t.Helper()
		if err := os.WriteFile(path, data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(root, "b.ttf"), buildFont(0, []nameRecord{windowsName(1, "beta")}))
	write(filepath.Join(nested, "a.OTF"), buildFont(0, []nameRecord{windowsName(1, "Alpha")}))
	write(filepath.Join(nested, "a-bold.otf"), buildFont(0, []nameRecord{windowsName(16, "Alpha")}))
	write(filepath.Join(root, "broken.ttf"), []byte("not a font"))
	write(filepath.Join(root, "readme.txt"), buildFont(0, []nameRecord{windowsName(1, "Ignored")}))

	got := Families([]string{root, filepath.Join(root, "does-not-exist")})
	want := []string{"Alpha", "beta"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestDirsLinuxHonoursXDG(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("XDG directories apply on Linux")
	}
	t.Setenv("XDG_DATA_HOME", "/data-home")
	t.Setenv("XDG_DATA_DIRS", "/one:/two")
	got := Dirs()
	for _, want := range []string{"/data-home/fonts", "/one/fonts", "/two/fonts"} {
		found := false
		for _, dir := range got {
			if dir == want {
				found = true
			}
		}
		if !found {
			t.Errorf("Dirs() = %q, missing %q", got, want)
		}
	}
}

// A real font from this machine, when it has one: the synthetic files above
// prove the parser against its own writer, and this proves it against a font
// someone else wrote.
func TestSystemFontParses(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("probes a Linux font path")
	}
	for _, path := range []string{
		"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
		"/usr/share/fonts/dejavu/DejaVuSans.ttf",
	} {
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if got := familiesInFile(path); !reflect.DeepEqual(got, []string{"DejaVu Sans"}) {
			t.Fatalf("%s: got %q", path, got)
		}
		return
	}
	t.Skip("no DejaVu Sans installed")
}
