import type { TemplateSpec } from './spec'

export const colonnade: TemplateSpec = {
  id: 'colonnade',
  name: 'Colonnade',
  pattern: '80%quartz_block,20%smooth_quartz',
  layers: [
    {
      shape: 'cylinder',
      name: 'Lower step',
      params: { radius: 0.96, height: 0.08 },
      pos: [0, -0.963, 0],
    },
    {
      shape: 'cylinder',
      name: 'Upper step',
      params: { radius: 0.86, height: 0.08 },
      pos: [0, -0.883, 0],
    },
    {
      name: 'Columns',
      group: [
        { modifier: 'radial', name: 'Ten around', params: { count: 10 }, pos: [0, -0.003, 0] },
        {
          shape: 'cylinder',
          name: 'Column',
          params: { radius: 0.06, height: 1.16 },
          pos: [0.72, -0.243, 0],
        },
        {
          shape: 'box',
          name: 'Capital',
          params: { width: 0.17, height: 0.05, depth: 0.17 },
          pos: [0.72, 0.357, 0],
        },
        {
          shape: 'box',
          name: 'Plinth',
          params: { width: 0.17, height: 0.05, depth: 0.17 },
          pos: [0.72, -0.823, 0],
        },
      ],
    },
    {
      name: 'Ring beam',
      group: [
        {
          shape: 'cylinder',
          name: 'Beam',
          params: { radius: 0.84, height: 0.1 },
          pos: [0, 0.427, 0],
        },
        {
          shape: 'cylinder',
          name: 'Opening',
          op: 'cut',
          params: { radius: 0.6, height: 0.3 },
          pos: [0, 0.427, 0],
        },
      ],
    },
    {
      name: 'Dentils',
      group: [
        {
          modifier: 'radial',
          name: 'Thirty-six around',
          params: { count: 36 },
          pos: [0, -0.003, 0],
        },
        {
          shape: 'box',
          name: 'Dentil',
          params: { width: 0.05, height: 0.04, depth: 0.05 },
          pos: [0.81, 0.357, 0],
        },
      ],
    },
    { shape: 'torus', name: 'Moulding', params: { major: 0.55, minor: 0.03 }, pos: [0, 0.497, 0] },
    {
      name: 'Dome (oxidized_copper)',
      block: 'oxidized_copper',
      part: [
        { shape: 'half', name: 'Upper half', op: 'cut', pos: [0, 0.477, 0] },
        { shape: 'sphere', name: 'Dome', params: { radius: 0.55 }, pos: [0, 0.447, 0] },
        {
          shape: 'sphere',
          name: 'Hollow',
          op: 'cut',
          params: { radius: 0.49 },
          pos: [0, 0.447, 0],
        },
        {
          shape: 'cylinder',
          name: 'Oculus',
          op: 'cut',
          params: { radius: 0.1, height: 0.3 },
          pos: [0, 0.947, 0],
        },
        {
          name: 'Dormers',
          op: 'cut',
          group: [
            {
              modifier: 'radial',
              name: 'Eight around',
              params: { count: 8 },
              pos: [0, -0.003, 0],
              rot: [0, 22.5, 0],
            },
            {
              shape: 'cylinder',
              name: 'Round window',
              params: { radius: 0.06, height: 0.3 },
              pos: [0.45, 0.657, 0],
              rot: [0, 0, 90],
            },
          ],
        },
      ],
    },
    {
      name: 'Ribs and rims (copper_block)',
      block: 'copper_block',
      part: [
        { shape: 'half', name: 'Upper half', op: 'cut', pos: [0, 0.477, 0] },
        { modifier: 'radial', name: 'Eight around', params: { count: 8 }, pos: [0, -0.003, 0] },
        {
          modifier: 'taper',
          name: 'Slimmer to the top',
          params: { amount: -0.9 },
          pos: [0, 0.477, 0],
        },
        {
          shape: 'box',
          name: 'Rib',
          params: { width: 0.62, height: 1.2, depth: 0.07 },
          pos: [0.31, 0.447, 0],
        },
        {
          shape: 'sphere',
          name: 'Outside',
          op: 'overlap',
          params: { radius: 0.59 },
          pos: [0, 0.447, 0],
        },
        {
          shape: 'sphere',
          name: 'On the dome',
          op: 'cut',
          params: { radius: 0.545 },
          pos: [0, 0.447, 0],
        },
        {
          shape: 'torus',
          name: 'Base rim',
          params: { major: 0.56, minor: 0.035 },
          pos: [0, 0.497, 0],
        },
        {
          shape: 'torus',
          name: 'Oculus rim',
          params: { major: 0.12, minor: 0.03 },
          pos: [0, 0.967, 0],
        },
        {
          shape: 'torus',
          name: 'Window rim',
          params: { major: 0.075, minor: 0.018 },
          pos: [0.53, 0.657, 0],
          rot: [0, 0, 90],
        },
      ],
    },
  ],
}
