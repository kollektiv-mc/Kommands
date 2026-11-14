import type { TemplateSpec } from './spec'

export const gyroid: TemplateSpec = {
  id: 'gyroid',
  name: 'Gyroid orb',
  pattern: '50%copper_block,30%exposed_copper,20%weathered_copper',
  layers: [
    {
      name: 'Lattice ball',
      group: [
        { shape: 'sphere', name: 'Shell', params: { radius: 0.78 }, pos: [0, 0.097, 0] },
        {
          shape: 'gyroid',
          name: 'Lattice',
          op: 'overlap',
          params: { frequency: 5, threshold: 0.4 },
          pos: [0, -0.023, 0],
        },
        {
          shape: 'gyroid',
          name: 'Thin walls',
          op: 'cut',
          params: { frequency: 5, threshold: -0.4 },
          pos: [0, -0.023, 0],
        },
        {
          shape: 'sphere',
          name: 'Hollow',
          op: 'cut',
          params: { radius: 0.42 },
          pos: [0, 0.097, 0],
        },
      ],
    },
    {
      name: 'Gimbal',
      group: [
        {
          shape: 'torus',
          name: 'Equator',
          params: { major: 0.84, minor: 0.035 },
          pos: [0, 0.097, 0],
        },
        {
          shape: 'torus',
          name: 'Meridian',
          params: { major: 0.84, minor: 0.035 },
          pos: [0, 0.097, 0],
          rot: [90, 0, 0],
        },
      ],
    },
    {
      name: 'Stand',
      group: [
        {
          shape: 'cylinder',
          name: 'Foot',
          params: { radius: 0.3, height: 0.08 },
          pos: [0, -0.963, 0],
        },
        {
          shape: 'cylinder',
          name: 'Stem',
          params: { radius: 0.07, height: 0.25 },
          pos: [0, -0.803, 0],
        },
      ],
    },
    {
      name: 'Core lattice (sea_lantern)',
      block: 'sea_lantern',
      part: [
        { shape: 'sphere', name: 'Core', params: { radius: 0.36 }, pos: [0, 0.097, 0] },
        {
          shape: 'gyroid',
          name: 'Fine lattice',
          op: 'overlap',
          params: { frequency: 10, threshold: 0.5 },
          pos: [0, -0.023, 0],
        },
        {
          shape: 'gyroid',
          name: 'Thin walls',
          op: 'cut',
          params: { frequency: 10, threshold: -0.5 },
          pos: [0, -0.023, 0],
        },
      ],
    },
  ],
}
