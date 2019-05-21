import { Nullable } from '../interface/global'

let lastFocusEl: Nullable<Element> | EventTarget

document.addEventListener(
  'focus',
  event => {
    lastFocusEl = event.target
  },
  true,
)
document.addEventListener(
  'blur',
  () => {
    lastFocusEl = null
  },
  true,
)
/**
 * 获取到最后一个获得焦点的元素
 * @returns 最后一个获取到焦点的元素
 */
export function lastFocus(): Nullable<Element> | EventTarget {
  return lastFocusEl
}
