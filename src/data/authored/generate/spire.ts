import type { TemplateSpec } from './spec'

export const spire: TemplateSpec = {
  id: 'spire',
  name: 'Twisted spire',
  pattern: '60%deepslate_bricks,25%polished_deepslate,15%deepslate',
  layers: [
    {
      name: 'Base',
      group: [
        {
          shape: 'box',
          name: 'Plinth',
          params: { width: 0.9, height: 0.12, depth: 0.9 },
          pos: [0, -0.943, 0],
        },
        {
          shape: 'box',
          name: 'Step',
          params: { width: 0.7, height: 0.1, depth: 0.7 },
          pos: [0, -0.833, 0],
        },
      ],
    },
    {
      name: 'Spire',
      group: [
        {
          modifier: 'distort',
          name: 'Twist',
          params: { type: 'twist', twist: 130 },
          pos: [0, -0.023, 0],
        },
        { modifier: 'taper', name: 'Narrow', params: { amount: -0.55 }, pos: [0, -0.783, 0] },
        {
          shape: 'box',
          name: 'Shaft',
          params: { width: 0.44, height: 1.7, depth: 0.44 },
          pos: [0, 0.067, 0],
        },
        {
          name: 'Fins',
          group: [
            {
              modifier: 'radial',
              name: 'Four corners',
              params: { count: 4 },
              pos: [0, -0.023, 0],
              rot: [0, 45, 0],
            },
            {
              shape: 'box',
              name: 'Fin',
              params: { width: 0.16, height: 1.5, depth: 0.08 },
              pos: [0.3, -0.033, 0],
            },
          ],
        },
        {
          name: 'Collars',
          group: [
            {
              modifier: 'array',
              name: 'Four up',
              params: { axis: 'y', spacing: 0.35, count: 4 },
              pos: [0, -0.573, 0],
            },
            {
              shape: 'box',
              name: 'Collar',
              params: { width: 0.62, height: 0.07, depth: 0.62 },
              pos: [0, -0.573, 0],
            },
          ],
        },
      ],
    },
    { shape: 'sphere', name: 'Orb', params: { radius: 0.06 }, pos: [0, 0.847, 0] },
  ],
}
