import type { TemplateSpec } from './spec'

export const planet: TemplateSpec = {
  id: 'planet',
  name: 'Ringed planet',
  pattern: '55%sandstone,25%smooth_sandstone,20%terracotta',
  layers: [
    { shape: 'sphere', name: 'Planet', params: { radius: 0.46 }, pos: [0, -0.545, 0] },
    {
      name: 'Bands',
      op: 'cut',
      group: [
        {
          shape: 'torus',
          name: 'North band',
          params: { major: 0.414, minor: 0.03 },
          pos: [0, -0.345, 0],
        },
        {
          shape: 'torus',
          name: 'South band',
          params: { major: 0.414, minor: 0.03 },
          pos: [0, -0.745, 0],
        },
      ],
    },
    {
      name: 'Craters',
      op: 'cut',
      group: [
        { shape: 'sphere', name: 'Crater', params: { radius: 0.13 }, pos: [0.25, -0.245, 0.3] },
        { shape: 'sphere', name: 'Crater', params: { radius: 0.09 }, pos: [-0.12, -0.425, 0.43] },
        { shape: 'sphere', name: 'Crater', params: { radius: 0.1 }, pos: [0.38, -0.625, 0.2] },
        { shape: 'sphere', name: 'Crater', params: { radius: 0.07 }, pos: [-0.3, -0.845, 0.27] },
      ],
    },
    {
      name: 'Rings',
      pos: [0, -0.545, 0],
      rot: [0, 0, 20],
      group: [
        { shape: 'cylinder', name: 'Disc', params: { radius: 0.98, height: 0.04 } },
        { shape: 'cylinder', name: 'Gap', op: 'cut', params: { radius: 0.62, height: 0.2 } },
        { shape: 'torus', name: 'Divide', op: 'cut', params: { major: 0.8, minor: 0.025 } },
        { shape: 'torus', name: 'Inner ring', params: { major: 0.55, minor: 0.018 } },
      ],
    },
    { shape: 'sphere', name: 'Moon', params: { radius: 0.11 }, pos: [-0.72, 0.055, -0.3] },
    {
      shape: 'sphere',
      name: 'Moon crater',
      op: 'cut',
      params: { radius: 0.05 },
      pos: [-0.65, 0.115, -0.22],
    },
  ],
}
