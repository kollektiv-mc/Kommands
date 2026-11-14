import type { TemplateSpec } from './spec'

export const roots: TemplateSpec = {
  id: 'roots',
  name: 'Twisted roots',
  pattern: '65%mangrove_roots,35%muddy_mangrove_roots',
  layers: [
    {
      modifier: 'distort',
      name: 'Twist',
      params: { type: 'twist', twist: 160 },
      pos: [0, -0.096, 0],
    },
    { shape: 'cylinder', name: 'Trunk', params: { radius: 0.2, height: 1.1 }, pos: [0, 0.354, 0] },
    { shape: 'sphere', name: 'Burl', params: { radius: 0.22 }, pos: [0.06, 0.104, 0.05] },
    {
      name: 'Roots',
      group: [
        { modifier: 'radial', name: 'Five around', params: { count: 5 }, pos: [0, -0.096, 0] },
        {
          modifier: 'bend',
          name: 'Splay',
          params: { axis: 'y', toward: 'x', side: '-', angle: 75 },
          pos: [0, 0.004, 0],
        },
        {
          shape: 'cylinder',
          name: 'Root',
          params: { radius: 0.075, height: 1.9 },
          pos: [0.15, -0.146, 0],
        },
      ],
    },
    {
      name: 'Rootlets',
      group: [
        {
          modifier: 'radial',
          name: 'Seven around',
          params: { count: 7 },
          pos: [0, -0.096, 0],
          rot: [0, 26, 0],
        },
        {
          modifier: 'bend',
          name: 'Droop',
          params: { axis: 'y', toward: 'x', side: '-', angle: 60 },
          pos: [0, -0.296, 0],
        },
        {
          shape: 'cylinder',
          name: 'Rootlet',
          params: { radius: 0.052, height: 1.5 },
          pos: [0.12, -0.446, 0],
        },
      ],
    },
  ],
}
