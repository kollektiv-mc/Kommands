import type { TemplateSpec } from './spec'

export const arch: TemplateSpec = {
  id: 'arch',
  name: 'Arch bridge',
  pattern: '70%stone_bricks,20%mossy_stone_bricks,10%cracked_stone_bricks',
  layers: [
    {
      shape: 'box',
      name: 'Bridge',
      params: { width: 1.96, height: 1.1, depth: 0.5 },
      pos: [0, -0.453, 0],
    },
    {
      name: 'Archway',
      op: 'cut',
      group: [
        {
          modifier: 'array',
          name: 'Three arches',
          params: { axis: 'x', spacing: 0.62, count: 3 },
          pos: [-0.62, -0.003, 0],
        },
        {
          shape: 'cylinder',
          name: 'Round top',
          params: { radius: 0.24, height: 0.6 },
          pos: [-0.62, -0.503, 0],
          rot: [90, 0, 0],
        },
        {
          shape: 'box',
          name: 'Opening',
          params: { width: 0.48, height: 0.5, depth: 0.6 },
          pos: [-0.62, -0.763, 0],
        },
      ],
    },
    {
      name: 'Parapet',
      op: 'cut',
      group: [
        {
          shape: 'box',
          name: 'Walk',
          op: 'cut',
          params: { width: 2, height: 0.14, depth: 0.4 },
          pos: [0, 0.117, 0],
        },
        {
          modifier: 'array',
          name: 'Crenels',
          params: { axis: 'x', spacing: 0.2, count: 10 },
          pos: [-0.9, -0.003, 0],
        },
        {
          shape: 'box',
          name: 'Crenel',
          op: 'cut',
          params: { width: 0.08, height: 0.1, depth: 0.6 },
          pos: [-0.9, 0.157, 0],
        },
      ],
    },
    {
      shape: 'box',
      name: 'Deck rim',
      params: { width: 2, height: 0.05, depth: 0.58 },
      pos: [0, 0.027, 0],
    },
    {
      shape: 'box',
      name: 'String course',
      params: { width: 2, height: 0.04, depth: 0.56 },
      pos: [0, -0.203, 0],
    },
    {
      shape: 'box',
      name: 'Plinth',
      params: { width: 2, height: 0.1, depth: 0.58 },
      pos: [0, -0.953, 0],
    },
    {
      name: 'Recessed panels',
      op: 'cut',
      group: [
        {
          modifier: 'mirror',
          name: 'Both faces',
          params: { axis: 'z', side: '+' },
          pos: [0, -0.003, 0],
        },
        {
          modifier: 'array',
          name: 'Four piers',
          params: { axis: 'x', spacing: 0.62, count: 4 },
          pos: [-0.93, -0.003, 0],
        },
        {
          shape: 'box',
          name: 'Panel',
          params: { width: 0.07, height: 0.36, depth: 0.06 },
          pos: [-0.93, -0.663, 0.25],
        },
      ],
    },
    {
      name: 'Keystones',
      group: [
        {
          modifier: 'array',
          name: 'Three along',
          params: { axis: 'x', spacing: 0.62, count: 3 },
          pos: [-0.62, -0.003, 0],
        },
        {
          shape: 'box',
          name: 'Keystone',
          params: { width: 0.09, height: 0.12, depth: 0.56 },
          pos: [-0.62, -0.203, 0],
        },
      ],
    },
    {
      name: 'Lamp posts',
      group: [
        {
          modifier: 'mirror',
          name: 'Both sides',
          params: { axis: 'z', side: '+' },
          pos: [0, -0.003, 0],
        },
        {
          modifier: 'array',
          name: 'Four along',
          params: { axis: 'x', spacing: 0.62, count: 4 },
          pos: [-0.93, -0.003, 0],
        },
        {
          shape: 'box',
          name: 'Post',
          params: { width: 0.08, height: 0.22, depth: 0.08 },
          pos: [-0.93, 0.197, 0.21],
        },
      ],
    },
    {
      name: 'Arch rings (polished_andesite)',
      block: 'polished_andesite',
      part: [
        {
          modifier: 'array',
          name: 'Three along',
          params: { axis: 'x', spacing: 0.62, count: 3 },
          pos: [-0.62, -0.003, 0],
        },
        { shape: 'half', name: 'Upper half', op: 'cut', pos: [0, -0.503, 0] },
        {
          shape: 'cylinder',
          name: 'Ring',
          params: { radius: 0.32, height: 0.62 },
          pos: [-0.62, -0.503, 0],
          rot: [90, 0, 0],
        },
        {
          shape: 'cylinder',
          name: 'Inside',
          op: 'cut',
          params: { radius: 0.24, height: 0.7 },
          pos: [-0.62, -0.503, 0],
          rot: [90, 0, 0],
        },
      ],
    },
    {
      name: 'Moss (moss_block)',
      block: 'moss_block',
      part: [
        { shape: 'half', name: 'Low down', op: 'cut', pos: [0, -0.253, 0], rot: [180, 0, 0] },
        {
          name: 'Growth',
          group: [
            {
              modifier: 'taper',
              name: 'Spreads at the foot',
              params: { amount: -0.45 },
              pos: [0, -0.253, 0],
            },
            {
              shape: 'box',
              name: 'Skin',
              params: { width: 2, height: 1.2, depth: 0.66 },
              pos: [0, -0.403, 0],
            },
          ],
        },
        {
          shape: 'box',
          name: 'Bridge',
          op: 'cut',
          params: { width: 1.96, height: 1.1, depth: 0.5 },
          pos: [0, -0.453, 0],
        },
        {
          name: 'Archways',
          op: 'cut',
          group: [
            {
              modifier: 'array',
              name: 'Three along',
              params: { axis: 'x', spacing: 0.62, count: 3 },
              pos: [-0.62, -0.003, 0],
            },
            {
              shape: 'cylinder',
              name: 'Round top',
              params: { radius: 0.24, height: 0.8 },
              pos: [-0.62, -0.503, 0],
              rot: [90, 0, 0],
            },
            {
              shape: 'box',
              name: 'Opening',
              params: { width: 0.48, height: 0.5, depth: 0.8 },
              pos: [-0.62, -0.763, 0],
            },
          ],
        },
        {
          shape: 'gyroid',
          name: 'Clumps',
          op: 'overlap',
          params: { frequency: 6, threshold: 0.2 },
          pos: [0, -0.003, 0],
        },
        {
          shape: 'formula',
          name: 'Thins out going up',
          op: 'overlap',
          params: { source: 'sin(x*9)*sin(z*11)<-1.2*y-0.3' },
          pos: [0, -0.003, 0],
        },
      ],
    },
  ],
}
