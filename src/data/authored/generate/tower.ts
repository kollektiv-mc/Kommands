import type { TemplateSpec } from './spec'

export const tower: TemplateSpec = {
  id: 'tower',
  name: 'Domed tower',
  pattern: '85%stone_bricks,15%mossy_stone_bricks',
  layers: [
    { shape: 'cylinder', name: 'Base', params: { radius: 0.48, height: 0.1 }, pos: [0, -0.953, 0] },
    {
      shape: 'cylinder',
      name: 'Tower',
      params: { radius: 0.42, height: 1.24 },
      pos: [0, -0.383, 0],
    },
    { shape: 'sphere', name: 'Dome', params: { radius: 0.46 }, pos: [0, 0.237, 0] },
    { shape: 'torus', name: 'Balcony', params: { major: 0.5, minor: 0.07 }, pos: [0, -0.083, 0] },
    { shape: 'cylinder', name: 'Eaves', params: { radius: 0.5, height: 0.04 }, pos: [0, 0.257, 0] },
    { shape: 'torus', name: 'Dome rim', params: { major: 0.46, minor: 0.035 }, pos: [0, 0.297, 0] },
    {
      name: 'Corbels',
      group: [
        { modifier: 'radial', name: 'Sixteen around', params: { count: 16 }, pos: [0, -0.023, 0] },
        {
          shape: 'box',
          name: 'Corbel',
          params: { width: 0.06, height: 0.07, depth: 0.04 },
          pos: [0.46, 0.207, 0],
        },
      ],
    },
    {
      name: 'Merlons',
      group: [
        { modifier: 'radial', name: 'Twelve around', params: { count: 12 }, pos: [0, -0.023, 0] },
        {
          shape: 'box',
          name: 'Merlon',
          params: { width: 0.07, height: 0.09, depth: 0.07 },
          pos: [0.55, 0.017, 0],
        },
      ],
    },
    {
      shape: 'cylinder',
      name: 'Hollow inside',
      op: 'cut',
      params: { radius: 0.32, height: 1.2 },
      pos: [0, -0.323, 0],
    },
    {
      shape: 'box',
      name: 'Door',
      op: 'cut',
      params: { width: 0.26, height: 0.42, depth: 0.4 },
      pos: [0, -0.803, 0.38],
    },
    {
      name: 'Windows',
      op: 'cut',
      group: [
        {
          modifier: 'radial',
          name: 'Six around',
          params: { count: 6 },
          pos: [0, -0.023, 0],
          rot: [0, 30, 0],
        },
        {
          shape: 'box',
          name: 'Window',
          params: { width: 0.24, height: 0.2, depth: 0.1 },
          pos: [0.4, -0.383, 0],
        },
        {
          shape: 'box',
          name: 'Slit',
          params: { width: 0.24, height: 0.12, depth: 0.05 },
          pos: [0.4, 0.097, 0],
        },
      ],
    },
    {
      name: 'Twisted spire (oxidized_copper)',
      block: 'oxidized_copper',
      part: [
        {
          modifier: 'distort',
          name: 'Twist',
          params: { type: 'twist', twist: 260 },
          pos: [0, -0.023, 0],
        },
        {
          name: 'Spiral bands',
          group: [
            { shape: 'half', name: 'Above the rim', op: 'cut', pos: [0, 0.317, 0] },
            { modifier: 'radial', name: 'Six around', params: { count: 6 }, pos: [0, -0.023, 0] },
            {
              shape: 'box',
              name: 'Band',
              params: { width: 0.6, height: 0.8, depth: 0.07 },
              pos: [0.3, 0.527, 0],
            },
            {
              shape: 'sphere',
              name: 'Outside',
              op: 'overlap',
              params: { radius: 0.53 },
              pos: [0, 0.237, 0],
            },
            {
              shape: 'sphere',
              name: 'On the dome',
              op: 'cut',
              params: { radius: 0.49 },
              pos: [0, 0.237, 0],
            },
          ],
        },
        {
          shape: 'cone',
          name: 'Spire',
          params: { radius: 0.12, height: 0.32 },
          pos: [0, 0.807, 0],
        },
        {
          name: 'Fins',
          group: [
            { modifier: 'radial', name: 'Four around', params: { count: 4 }, pos: [0, -0.023, 0] },
            {
              shape: 'box',
              name: 'Fin',
              params: { width: 0.16, height: 0.24, depth: 0.03 },
              pos: [0.08, 0.777, 0],
            },
          ],
        },
      ],
    },
    {
      name: 'Dome tiles (deepslate_tiles)',
      block: 'deepslate_tiles',
      part: [
        { shape: 'half', name: 'Upper half', op: 'cut', pos: [0, 0.277, 0] },
        { shape: 'sphere', name: 'Tiles', params: { radius: 0.49 }, pos: [0, 0.237, 0] },
        {
          shape: 'sphere',
          name: 'On the dome',
          op: 'cut',
          params: { radius: 0.46 },
          pos: [0, 0.237, 0],
        },
        {
          name: 'Courses',
          op: 'cut',
          group: [
            {
              modifier: 'array',
              name: 'Five up',
              params: { axis: 'y', spacing: 0.08, count: 5 },
              pos: [0, 0.357, 0],
            },
            {
              shape: 'box',
              name: 'Gap',
              params: { width: 2, height: 0.025, depth: 2 },
              pos: [0, 0.357, 0],
            },
          ],
        },
      ],
    },
  ],
}
