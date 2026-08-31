// Command gen-appicon draws the application icon into build/.
//
// The icon is generated rather than committed as an opaque binary, for the
// same reason src/styles/tokens.css is: the inputs are reviewable and the
// output cannot drift from them. The two colours are the token layer's
// --bg-base and --accent-rgb, restated here because the token pipeline cannot
// reach Go — if either token changes, change it here and rerun.
//
// The mark itself is a placeholder — a pixel-grid K in the accent on the app's
// background, blocky on purpose — standing in until the suite gets a designed
// Kommands mark. Konnekt's build/README.md documents the trap this generator
// avoids: `wails build` regenerates platform icons only when they are missing,
// so a stale hand-dropped icon ships forever and silently.
//
// Run from the repo root:
//
//	go run ./scripts/gen-appicon
package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

// --bg-base and --accent-rgb from src/styles/tokens.css.
var (
	background = color.NRGBA{R: 5, G: 6, B: 10, A: 255}
	accent     = color.NRGBA{R: 74, G: 222, B: 128, A: 255}
)

// A 5×7 pixel K, drawn on a 10×10 grid with the glyph centred horizontally
// and sitting one row high of centre.
var glyph = []string{
	"X...X",
	"X..X.",
	"X.X..",
	"XX...",
	"X.X..",
	"X..X.",
	"X...X",
}

const (
	grid   = 10
	glyphX = 2 // left cell of the glyph on the grid
	glyphY = 1 // top cell of the glyph on the grid
)

func draw(size int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	cell := float64(size) / grid
	radius := float64(size) * 0.18

	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if !insideRoundedSquare(float64(x)+0.5, float64(y)+0.5, float64(size), radius) {
				continue
			}
			img.SetNRGBA(x, y, background)
			gx := int(float64(x) / cell)
			gy := int(float64(y) / cell)
			row := gy - glyphY
			col := gx - glyphX
			if row >= 0 && row < len(glyph) && col >= 0 && col < len(glyph[row]) && glyph[row][col] == 'X' {
				img.SetNRGBA(x, y, accent)
			}
		}
	}
	return img
}

func insideRoundedSquare(x, y, size, radius float64) bool {
	if x < 0 || y < 0 || x > size || y > size {
		return false
	}
	// Inside the cross of the two inset rectangles, or within radius of one of
	// the four corner circle centres.
	if (x >= radius && x <= size-radius) || (y >= radius && y <= size-radius) {
		return true
	}
	cx := radius
	if x > size-radius {
		cx = size - radius
	}
	cy := radius
	if y > size-radius {
		cy = size - radius
	}
	dx, dy := x-cx, y-cy
	return dx*dx+dy*dy <= radius*radius
}

func write(path string, size int) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := png.Encode(f, draw(size)); err != nil {
		return err
	}
	return f.Close()
}

func main() {
	for _, target := range []struct {
		path string
		size int
	}{
		{"build/appicon.png", 1024},
		{"build/appicon-256.png", 256},
	} {
		if err := write(target.path, target.size); err != nil {
			fmt.Fprintf(os.Stderr, "gen-appicon: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("wrote %s (%d px)\n", target.path, target.size)
	}
}
