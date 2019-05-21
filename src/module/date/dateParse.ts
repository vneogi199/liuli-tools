import { fill } from '../string/fill'
import { arrayToMap } from './../array/arrayToMap'

/**
 * 日期格式化类
 * @class DateFormat
 */
class DateFormat {
  /**
   * 构造函数
   * @param name 日期格式的名称
   * @param format 日期的格式值
   * @param value 格式化得到的值
   * @param index 需要替换位置的索引
   */
  constructor(
    public name: string,
    public format: string,
    public value: string,
    public index: number,
  ) {}
}

/**
 * 日期时间的正则表达式
 */
const dateFormats = new Map()
  .set('year', 'y{4}|y{2}')
  .set('month', 'M{1,2}')
  .set('day', 'd{1,2}')
  .set('hour', 'h{1,2}')
  .set('minute', 'm{1,2}')
  .set('second', 's{1,2}')
  .set('millieSecond', 'S{1,3}')
// 如果没有格式化某项的话则设置为默认时间
const defaultDateValues = new Map()
  .set('month', '01')
  .set('day', '01')
  .set('hour', '00')
  .set('minute', '00')
  .set('second', '00')
  .set('millieSecond', '000')
/**
 * 解析字符串为 Date 对象
 * @param str 日期字符串
 * @param fmt 日期字符串的格式，目前仅支持使用 y(年),M(月),d(日),h(时),m(分),s(秒),S(毫秒)
 * @returns 解析得到的 Date 对象
 */
export function dateParse(
  str: string | null | undefined,
  fmt: string,
): Date | null {
  const now = new Date()
  defaultDateValues.set('year', now.getFullYear().toString())
  // 保存对传入的日期字符串进行格式化的全部信息数组列表
  const dateUnits: DateFormat[] = []
  for (const [fmtName, regex] of dateFormats) {
    const regExp = new RegExp(regex)
    if (regExp.test(fmt)) {
      const matchStr = regExp.exec(fmt)![0]
      const regexStr = fill('`', matchStr.length)
      const index = fmt.indexOf(matchStr)
      fmt = fmt.replace(matchStr, regexStr)
      dateUnits.push(
        new DateFormat(fmtName, fill('\\d', matchStr.length), null!, index),
      )
    } else {
      dateUnits.push(
        new DateFormat(fmtName, null!, defaultDateValues.get(fmtName), -1),
      )
    }
  }
  // 进行验证是否真的是符合传入格式的字符串
  fmt = fmt.replace(new RegExp('`', 'g'), '\\d')
  if (!new RegExp(`^${fmt}$`).test(str!)) {
    return null
  }
  // 进行一次排序, 依次对字符串进行截取
  dateUnits
    // 过滤掉没有得到格式化的对象
    .filter(({ format }) => format)
    // 按照字符串中日期片段的索引进行排序
    .sort(function(a, b) {
      return a.index - b.index
    })
    // 获取到匹配的日期片段的值
    .map(format => {
      const matchDateUnit = new RegExp(format.format).exec(str!)
      if (matchDateUnit !== null && matchDateUnit.length > 0) {
        str = str!.replace(matchDateUnit[0], '')
        format.value = matchDateUnit[0]
      }
      return format
    })
    // 覆写到 dateStr 上面
    .forEach(({ format }, i) => {
      const matchDateUnit = new RegExp(format).exec(str!)
      if (matchDateUnit !== null && matchDateUnit.length > 0) {
        str = str!.replace(matchDateUnit[0], '')
        dateUnits[i].value = matchDateUnit[0]
      }
    })
  // 将截取完成的信息封装成对象并格式化标准的日期字符串
  const map = arrayToMap(dateUnits, item => item.name, item => item.value)
  if (map.get('year')!.length === 2) {
    map.set(
      'year',
      defaultDateValues
        .get('year')
        .substr(0, 2)
        .concat(map.get('year')),
    )
  }
  // 注意：此处使用的是本地时间而非 UTC 时间
  const date = `${map.get('year')}-${map.get('month')}-${map.get(
    'day',
  )}T${map.get('hour')}:${map.get('minute')}:${map.get('second')}.${map.get(
    'millieSecond',
  )}`
  return new Date(date)
}
