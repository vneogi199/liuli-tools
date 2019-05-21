import { isNullOrUndefined } from '../obj/isNullOrUndefined'

/**
 * 字符串安全的转换为小写
 * @param str 字符串
 * @returns 转换后得到的全小写字符串
 */
export function toLowerCase(str: string): string {
  if (isNullOrUndefined(str) || typeof str !== 'string') {
    return str
  }
  return str.toLowerCase()
}
