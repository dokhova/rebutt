// Иконка типа стула по Бристольской шкале (1–7), рисуется SVG
import { Component } from '../core/runtime.js';

export default class Pebble extends Component {
  view() {
    const t = Number(this.props.type) || 4;
    return { size: Number(this.props.size) || 160, t1: t === 1, t2: t === 2, t3: t === 3, t4: t === 4, t5: t === 5, t6: t === 6, t7: t === 7 };
  }
}
