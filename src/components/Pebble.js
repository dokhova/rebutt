// Иконка типа стула по Бристольской шкале (1–7): стеклянная форма из брендбука, картинка public/stool/type-N.webp
import { Component } from '../core/runtime.js';

export default class Pebble extends Component {
  view() {
    const n = Number(this.props.type);
    const t = n >= 1 && n <= 7 ? n : 4;
    return { size: Number(this.props.size) || 160, src: '/stool/type-' + t + '.webp' };
  }
}
