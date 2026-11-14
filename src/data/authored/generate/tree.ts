import type { TemplateSpec } from './spec'

export const tree: TemplateSpec = {
  id: 'tree',
  name: 'Tree',
  pattern: '70%oak_leaves,30%azalea_leaves',
  layers: [
    {
      name: 'Canopy',
      group: [
        { shape: 'half', name: 'Flat underside', op: 'cut', pos: [0, 0.12, 0] },
        { shape: 'sphere', name: 'Crown', params: { radius: 0.4 }, pos: [0, 0.5, 0] },
        { shape: 'sphere', name: 'Top', params: { radius: 0.2 }, pos: [0.04, 0.78, 0.02] },
        {
          name: 'Outer crown',
          group: [
            { modifier: 'radial', name: 'Seven around', params: { count: 7 } },
            { shape: 'sphere', name: 'Outer lobe', params: { radius: 0.3 }, pos: [0.56, 0.36, 0] },
          ],
        },
        {
          name: 'Upper crown',
          group: [
            { modifier: 'radial', name: 'Five around', params: { count: 5 }, rot: [0, 36, 0] },
            { shape: 'sphere', name: 'Upper lobe', params: { radius: 0.25 }, pos: [0.32, 0.62, 0] },
          ],
        },
      ],
    },
    {
      shape: 'gyroid',
      name: 'Leafy gaps',
      op: 'overlap',
      params: { frequency: 10, threshold: 1.1 },
    },
    {
      name: 'Trunk and branches (dark_oak_log)',
      block: 'dark_oak_log',
      part: [
        { modifier: 'distort', name: 'Gnarl', params: { type: 'twist', twist: 70 } },
        {
          name: 'Trunk',
          group: [
            {
              modifier: 'bend',
              name: 'Lean',
              params: { axis: 'y', toward: 'x', side: '+', angle: 22 },
              pos: [0, -0.5, 0],
            },
            {
              shape: 'cylinder',
              name: 'Trunk',
              params: { radius: 0.15, height: 1.12 },
              pos: [0, -0.42, 0],
            },
            {
              shape: 'cone',
              name: 'Flare',
              params: { radius: 0.32, height: 0.34 },
              pos: [0, -0.82, 0],
            },
            { shape: 'sphere', name: 'Knot', params: { radius: 0.09 }, pos: [0.1, -0.35, 0.08] },
            { shape: 'sphere', name: 'Knot', params: { radius: 0.07 }, pos: [-0.11, -0.1, -0.06] },
          ],
        },
        {
          name: 'Branches',
          group: [
            { modifier: 'radial', name: 'Five around', params: { count: 5 } },
            {
              modifier: 'bend',
              name: 'Reach up',
              params: { axis: 'x', toward: 'y', side: '+', angle: 35 },
              pos: [0.1, 0.1, 0],
            },
            {
              shape: 'cylinder',
              name: 'Branch',
              params: { radius: 0.055, height: 0.62 },
              pos: [0.4, 0.1, 0],
              rot: [0, 0, -90],
            },
            {
              shape: 'cylinder',
              name: 'Twig',
              params: { radius: 0.032, height: 0.3 },
              pos: [0.48, 0.22, 0.08],
              rot: [30, 0, -60],
            },
            {
              shape: 'cylinder',
              name: 'Twig',
              params: { radius: 0.032, height: 0.26 },
              pos: [0.62, 0.3, -0.07],
              rot: [-30, 0, -60],
            },
          ],
        },
        {
          name: 'Roots',
          group: [
            { modifier: 'radial', name: 'Seven around', params: { count: 7 }, rot: [0, 26, 0] },
            {
              modifier: 'bend',
              name: 'Dive',
              params: { axis: 'x', toward: 'y', side: '+', angle: -70 },
              pos: [0.12, -0.84, 0],
            },
            {
              shape: 'cylinder',
              name: 'Root',
              params: { radius: 0.06, height: 0.7 },
              pos: [0.45, -0.84, 0],
              rot: [0, 0, -90],
            },
            {
              shape: 'sphere',
              name: 'Root knuckle',
              params: { radius: 0.075 },
              pos: [0.22, -0.84, 0],
            },
          ],
        },
      ],
    },
    {
      name: 'Blossoms (flowering_azalea_leaves)',
      block: 'flowering_azalea_leaves',
      part: [
        {
          name: 'Canopy, a little bigger',
          scl: [1.06, 1.06, 1.06],
          group: [
            { shape: 'half', name: 'Flat underside', op: 'cut', pos: [0, 0.12, 0] },
            { shape: 'sphere', name: 'Crown', params: { radius: 0.4 }, pos: [0, 0.5, 0] },
            { shape: 'sphere', name: 'Top', params: { radius: 0.2 }, pos: [0.04, 0.78, 0.02] },
            {
              name: 'Outer crown',
              group: [
                { modifier: 'radial', name: 'Seven around', params: { count: 7 } },
                {
                  shape: 'sphere',
                  name: 'Outer lobe',
                  params: { radius: 0.3 },
                  pos: [0.56, 0.36, 0],
                },
              ],
            },
            {
              name: 'Upper crown',
              group: [
                { modifier: 'radial', name: 'Five around', params: { count: 5 }, rot: [0, 36, 0] },
                {
                  shape: 'sphere',
                  name: 'Upper lobe',
                  params: { radius: 0.25 },
                  pos: [0.32, 0.62, 0],
                },
              ],
            },
          ],
        },
        {
          name: 'Canopy',
          op: 'cut',
          group: [
            { shape: 'half', name: 'Flat underside', op: 'cut', pos: [0, 0.12, 0] },
            { shape: 'sphere', name: 'Crown', params: { radius: 0.4 }, pos: [0, 0.5, 0] },
            { shape: 'sphere', name: 'Top', params: { radius: 0.2 }, pos: [0.04, 0.78, 0.02] },
            {
              name: 'Outer crown',
              group: [
                { modifier: 'radial', name: 'Seven around', params: { count: 7 } },
                {
                  shape: 'sphere',
                  name: 'Outer lobe',
                  params: { radius: 0.3 },
                  pos: [0.56, 0.36, 0],
                },
              ],
            },
            {
              name: 'Upper crown',
              group: [
                { modifier: 'radial', name: 'Five around', params: { count: 5 }, rot: [0, 36, 0] },
                {
                  shape: 'sphere',
                  name: 'Upper lobe',
                  params: { radius: 0.25 },
                  pos: [0.32, 0.62, 0],
                },
              ],
            },
          ],
        },
        {
          shape: 'gyroid',
          name: 'Spots',
          op: 'overlap',
          params: { frequency: 14, threshold: -0.7 },
        },
      ],
    },
  ],
}
