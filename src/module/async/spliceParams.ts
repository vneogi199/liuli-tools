import { dateFormat } from '../date/dateFormat'

/**
 * 默认的日期格式
 * 不加 Z 为本地日期时间
 */
const deteFormatter = 'yyyy-MM-ddThh:mm:ss.SSS'
/**
 * 编码函数
 * @param k 参数的名字
 * @param v 参数的值
 */
const encode = (k: string, v: string) =>
  encodeURIComponent(k) + '=' + encodeURIComponent(v)

/**
 * 拼接参数字符串
 * @param params 参数对象
 * @returns 拼接后的字符串
 */
export function spliceParams(params: object = {}): string {
  return Array.from(Object.entries(params)).reduce((res, [k, v]) => {
    if (v === undefined || v === null) {
      return res
    } else if (v instanceof Date) {
      res += encode(k, dateFormat(v, deteFormatter))
    } else if (v instanceof Array) {
      res += v
        .map(item =>
          encode(
            k,
            item instanceof Date ? dateFormat(item, deteFormatter) : item,
          ),
        )
        .join('&')
    } else {
      res += encode(k, v)
    }
    return (res += '&')
  }, '')
}
