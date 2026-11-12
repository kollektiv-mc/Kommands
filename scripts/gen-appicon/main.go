// Command gen-appicon renders the Kommands mark into the app icon and favicon
// PNGs, from the SVGs in docs/brand/.
//
// The icons are generated rather than committed as opaque binaries, for the
// same reason src/styles/tokens.css is: the inputs are reviewable and the
// output cannot drift from them. The inputs are docs/brand/app-icon.svg (the
// mark at 80 % on the dark tile) and docs/brand/app-icon-16.svg (the mark
// redrawn on a 16 px grid, for the favicon). Both are drawn from straight
// edges only, so this reads a deliberately small subset of SVG, a viewBox,
// <rect> and <polygon> with a solid fill, and rejects anything else rather
// than drawing it wrong. docs/brand/README.md says how those files are made.
//
// Konnekt's build/README.md documents the trap this generator avoids: `wails
// build` regenerates platform icons only when they are missing, so a stale
// hand-dropped icon ships forever and silently.
//
// Run from the repo root:
//
//	go run ./scripts/gen-appicon
package main

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
)

// shape is one filled rect or polygon, in viewBox units.
type shape struct {
	points []point
	fill   color.NRGBA
}

type point struct{ x, y float64 }

// drawing is a parsed SVG: its viewBox size and its shapes in paint order.
type drawing struct {
	width, height float64
	shapes        []shape
}

// targets lists every file written, with the SVG it is rendered from.
var targets = []struct {
	source string
	path   string
	size   int
}{
	{"docs/brand/app-icon.svg", "build/appicon.png", 1024},
	{"docs/brand/app-icon.svg", "build/appicon-256.png", 256},
	{"docs/brand/app-icon.svg", "public/favicon.png", 256},
	{"docs/brand/app-icon.svg", "public/favicon-32.png", 32},
	{"docs/brand/app-icon-16.svg", "public/favicon-16.png", 16},
}

func main() {
	for _, t := range targets {
		if err := render(t.source, t.path, t.size); err != nil {
			fmt.Fprintf(os.Stderr, "gen-appicon: %s: %v\n", t.path, err)
			os.Exit(1)
		}
		fmt.Printf("wrote %s (%d px, from %s)\n", t.path, t.size, t.source)
	}
}

func render(source, path string, size int) error {
	f, err := os.Open(source)
	if err != nil {
		return err
	}
	d, err := parse(f)
	closeErr := f.Close()
	if err != nil {
		return fmt.Errorf("%s: %w", source, err)
	}
	if closeErr != nil {
		return closeErr
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, rasterise(d, size)); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

// parse reads the subset of SVG described at the top of this file.
func parse(r io.Reader) (drawing, error) {
	var d drawing
	dec := xml.NewDecoder(r)
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return d, err
		}
		el, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		attrs := map[string]string{}
		for _, a := range el.Attr {
			attrs[a.Name.Local] = a.Value
		}
		switch el.Name.Local {
		case "svg":
			vb := strings.Fields(attrs["viewBox"])
			if len(vb) != 4 || vb[0] != "0" || vb[1] != "0" {
				return d, fmt.Errorf("viewBox %q: want 0 0 <w> <h>", attrs["viewBox"])
			}
			if d.width, err = strconv.ParseFloat(vb[2], 64); err != nil {
				return d, err
			}
			if d.height, err = strconv.ParseFloat(vb[3], 64); err != nil {
				return d, err
			}
		case "title":
		case "rect":
			s, err := rect(attrs)
			if err != nil {
				return d, err
			}
			d.shapes = append(d.shapes, s)
		case "polygon":
			s, err := polygon(attrs)
			if err != nil {
				return d, err
			}
			d.shapes = append(d.shapes, s)
		default:
			return d, fmt.Errorf("<%s> is not drawn by this generator: the icon SVGs hold only rect and polygon", el.Name.Local)
		}
	}
	if d.width <= 0 || d.height <= 0 {
		return d, errors.New("no viewBox")
	}
	return d, nil
}

func rect(attrs map[string]string) (shape, error) {
	var v [4]float64
	for i, k := range []string{"x", "y", "width", "height"} {
		raw, ok := attrs[k]
		if !ok && i < 2 {
			continue // x and y default to 0
		}
		n, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return shape{}, fmt.Errorf("rect %s: %w", k, err)
		}
		v[i] = n
	}
	fill, err := hexColour(attrs["fill"])
	if err != nil {
		return shape{}, err
	}
	x, y, w, h := v[0], v[1], v[2], v[3]
	return shape{points: []point{{x, y}, {x + w, y}, {x + w, y + h}, {x, y + h}}, fill: fill}, nil
}

func polygon(attrs map[string]string) (shape, error) {
	fields := strings.Fields(strings.ReplaceAll(attrs["points"], ",", " "))
	if len(fields) < 6 || len(fields)%2 != 0 {
		return shape{}, fmt.Errorf("polygon points %q", attrs["points"])
	}
	pts := make([]point, len(fields)/2)
	for i := range pts {
		x, err := strconv.ParseFloat(fields[2*i], 64)
		if err != nil {
			return shape{}, err
		}
		y, err := strconv.ParseFloat(fields[2*i+1], 64)
		if err != nil {
			return shape{}, err
		}
		pts[i] = point{x, y}
	}
	fill, err := hexColour(attrs["fill"])
	if err != nil {
		return shape{}, err
	}
	return shape{points: pts, fill: fill}, nil
}

func hexColour(s string) (color.NRGBA, error) {
	if len(s) != 7 || s[0] != '#' {
		return color.NRGBA{}, fmt.Errorf("fill %q: want #rrggbb", s)
	}
	n, err := strconv.ParseUint(s[1:], 16, 32)
	if err != nil {
		return color.NRGBA{}, fmt.Errorf("fill %q: %w", s, err)
	}
	return color.NRGBA{R: uint8(n >> 16), G: uint8(n >> 8), B: uint8(n), A: 255}, nil
}

// rasterise paints the shapes in order onto a size x size image. Each pixel's
// coverage is sampled on an n x n grid inside it, which is plenty for flat
// polygons at icon sizes, and each shape is laid over what is below it in
// proportion to that coverage. The SVGs already sit every face on a base
// hexagon in the block's own colour, so neighbouring edges never blend
// against the ground.
func rasterise(d drawing, size int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	sx, sy := float64(size)/d.width, float64(size)/d.height
	const n = 8
	for _, s := range d.shapes {
		pts := make([]point, len(s.points))
		minX, minY, maxX, maxY := math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)
		for i, p := range s.points {
			q := point{p.x * sx, p.y * sy}
			pts[i] = q
			minX, minY = math.Min(minX, q.x), math.Min(minY, q.y)
			maxX, maxY = math.Max(maxX, q.x), math.Max(maxY, q.y)
		}
		x0, y0 := max(int(math.Floor(minX)), 0), max(int(math.Floor(minY)), 0)
		x1, y1 := min(int(math.Ceil(maxX)), size), min(int(math.Ceil(maxY)), size)
		for y := y0; y < y1; y++ {
			for x := x0; x < x1; x++ {
				hits := 0
				for j := 0; j < n; j++ {
					for i := 0; i < n; i++ {
						if inside(pts, float64(x)+(float64(i)+0.5)/n, float64(y)+(float64(j)+0.5)/n) {
							hits++
						}
					}
				}
				if hits > 0 {
					blend(img, x, y, s.fill, float64(hits)/(n*n))
				}
			}
		}
	}
	return img
}

// inside is the even-odd rule, which is the fill rule for a simple polygon.
func inside(pts []point, x, y float64) bool {
	in := false
	for i, j := 0, len(pts)-1; i < len(pts); j, i = i, i+1 {
		a, b := pts[i], pts[j]
		if (a.y > y) != (b.y > y) && x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x {
			in = !in
		}
	}
	return in
}

// blend lays an opaque colour over the pixel at coverage a, source-over.
func blend(img *image.NRGBA, x, y int, c color.NRGBA, a float64) {
	dst := img.NRGBAAt(x, y)
	da := float64(dst.A) / 255
	oa := a + da*(1-a)
	mix := func(s, d uint8) uint8 {
		return uint8(math.Round((float64(s)*a + float64(d)*da*(1-a)) / oa))
	}
	img.SetNRGBA(x, y, color.NRGBA{R: mix(c.R, dst.R), G: mix(c.G, dst.G), B: mix(c.B, dst.B), A: uint8(math.Round(oa * 255))})
}
