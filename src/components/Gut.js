// Иллюстрация кишечника в цвете состояния
import { Component } from '../core/runtime.js';

const IMAGES = {
  calm: '/img/gut2-calm.webp',
  mild: '/img/gut2-mild.webp',
  sens: '/img/gut2-sens.webp',
  cycle: '/img/gut2-cycle.webp',
  empty: '/img/gut2-empty.webp'
};

export default class Gut extends Component {
  view() {
    return { size: Number(this.props.size) || 240, src: IMAGES[this.props.tone] || IMAGES.calm };
  }
}
