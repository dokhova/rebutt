import { DCLogic } from '../runtime.js';

export default class Pebble extends DCLogic {
  renderVals() {
    const t = Number(this.props.type ?? 4) || 4;
    return {
      size: Number(this.props.size ?? 160) || 160,
      t1: t === 1, t2: t === 2, t3: t === 3, t4: t === 4,
      t5: t === 5, t6: t === 6, t7: t === 7
    };
  }
}
