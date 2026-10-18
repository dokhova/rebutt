import { DCLogic } from '../runtime.js';

const T = {
  calm: { src: '/img/gut2-calm.webp', glow: '#B8F06A' },
  mild: { src: '/img/gut2-mild.webp', glow: '#6F9A55' },
  sens: { src: '/img/gut2-sens.webp', glow: '#A78BFA' },
  cycle: { src: '/img/gut2-cycle.webp', glow: '#7954C8' },
  empty: { src: '/img/gut2-empty.webp', glow: '#F8F7F2' },
  onb: { src: '/img/gut2-onb.webp', glow: '#C9E59A' },
  onbcycle: { src: '/img/gut2-onbcycle.webp', glow: '#A78BFA' }
};

export default class Gut extends DCLogic {
  renderVals() {
    let tone = this.props.tone;
    if (!T[tone]) tone = 'calm';
    const size = Number(this.props.size ?? 240) || 240;
    return { size, blur: Math.round(size / 6), ...T[tone] };
  }
}
