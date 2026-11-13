package main

import (
	"image/color"
	"os"
	"strings"
	"testing"
)

func TestParseReadsRectAndPolygon(t *testing.T) {
	d, err := parse(strings.NewReader(`<svg viewBox="0 0 16 16"><title>t</title>` +
		`<rect width="16" height="16" fill="#05060a"/><polygon points="0,0 8,0 0,8" fill="#fb923c"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	if d.width != 16 || d.height != 16 || len(d.shapes) != 2 {
		t.Fatalf("got %vx%v with %d shapes", d.width, d.height, len(d.shapes))
	}
	if got := d.shapes[1].fill; got.R != 0xfb || got.G != 0x92 || got.B != 0x3c {
		t.Errorf("polygon fill = %v", got)
	}
}

func TestParseRejectsUnsupportedElements(t *testing.T) {
	for _, el := range []string{`<circle r="1" fill="#fff"/>`, `<g></g>`, `<mask id="m"></mask>`, `<path d="M0 0" fill="#fff"/>`} {
		if _, err := parse(strings.NewReader(`<svg viewBox="0 0 24 24">` + el + `</svg>`)); err == nil {
			t.Errorf("%s parsed without error", el)
		}
	}
}

func TestParseRejectsNonHexFill(t *testing.T) {
	if _, err := parse(strings.NewReader(`<svg viewBox="0 0 24 24"><rect width="1" height="1" fill="red"/></svg>`)); err == nil {
		t.Error("named colour accepted")
	}
}

func TestRasteriseCoversHalfAPixelAlongADiagonal(t *testing.T) {
	d := drawing{width: 2, height: 2, shapes: []shape{
		{points: []point{{0, 0}, {2, 0}, {2, 2}, {0, 2}}, fill: hexMust(t, "#000000")},
		{points: []point{{0, 0}, {2, 0}, {0, 2}}, fill: hexMust(t, "#ffffff")},
	}}
	img := rasterise(d, 2)
	if c := img.NRGBAAt(0, 0); c.R != 255 {
		t.Errorf("fully covered pixel = %v", c)
	}
	if c := img.NRGBAAt(1, 1); c.R != 0 {
		t.Errorf("uncovered pixel = %v", c)
	}
	// The diagonal halves pixel (1,0); sampling puts it within a sample row of 50 %.
	if c := img.NRGBAAt(1, 0); c.R < 100 || c.R > 155 || c.A != 255 {
		t.Errorf("half-covered pixel = %v", c)
	}
}

func TestCommittedIconSourcesParse(t *testing.T) {
	seen := map[string]bool{}
	for _, tg := range targets {
		if seen[tg.source] {
			continue
		}
		seen[tg.source] = true
		f, err := os.Open("../../" + tg.source)
		if err != nil {
			t.Fatal(err)
		}
		d, err := parse(f)
		if cerr := f.Close(); cerr != nil {
			t.Fatal(cerr)
		}
		if err != nil {
			t.Errorf("%s: %v", tg.source, err)
			continue
		}
		if d.width != d.height {
			t.Errorf("%s is %vx%v: an app icon is square", tg.source, d.width, d.height)
		}
	}
}

func hexMust(t *testing.T, s string) color.NRGBA {
	t.Helper()
	c, err := hexColour(s)
	if err != nil {
		t.Fatal(err)
	}
	return c
}
