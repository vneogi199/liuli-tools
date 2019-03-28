import fill from '../string/fill'
import { toObject } from '../array/toObject'

/**
 * 解析字符串为 Date 对象
 * @param dateStr 日期字符串
 * @param fmt 日期字符串的格式
 * 目前仅支持使用 y(年),M(月),d(日),h(时),m(分),s(秒),S(毫秒)
 * @returns {Date} 解析得到的 Date 对象
 */
function strToDate (dateStr, fmt) {
  const now = new Date()
  /**
   * 日期格式化对象
   * @param {String} name 日期格式的名称
   * @param {String} format 日期的格式值
   * @param {String} value 格式化得到的值
   * @param {Number} index 需要替换位置的索引
   * @constructor
   */
  class DateFormat {
    constructor (name, format, value, index) {
      this.name = name
      this.format = format
      this.value = value
      this.index = index
    }
  }

  // 日期时间的正则表达式
  const dateFormats = {
    year: 'y{2}|y{4}',
    month: 'M{1,2}',
    day: 'd{1,2}',
    hour: 'h{1,2}',
    minute: 'm{1,2}',
    second: 's{1,2}',
    milliSecond: 'S{1,3}'
  }
  // 如果没有格式化某项的话则设置为默认时间
  const defaultDateValues = {
    year: now.getFullYear().toString(),
    month: '01',
    day: '01',
    hour: '00',
    minute: '00',
    second: '00',
    milliSecond: '000'
  }
  // 保存对传入的日期字符串进行格式化的全部信息数组列表
  const dateUnits = []
  for (const fmtName in dateFormats) {
    const regExp = new RegExp(dateFormats[fmtName])
    if (regExp.test(fmt)) {
      const matchStr = regExp.exec(fmt)[0]
      const regexStr = fill('`', matchStr.length)
      const index = fmt.indexOf(matchStr)
      fmt = fmt.replace(matchStr, regexStr)
      dateUnits.push(
        new DateFormat(fmtName, fill('\\d', matchStr.length), null, index)
      )
    } else {
      dateUnits.push(
        new DateFormat(fmtName, null, defaultDateValues[fmtName], -1)
      )
    }
  }
  // 进行验证是否真的是符合传入格式的字符串
  fmt = fmt.replace(new RegExp('`', 'g'), '\\d')
  if (!new RegExp(fmt).test(dateStr)) {
    return null
  }
  // 进行一次排序, 依次对字符串进行截取
  dateUnits
    .sort(function (a, b) {
      return a.index - b.index
    })
    .map(format => {
      const matchDateUnit = new RegExp(format).exec(dateStr)
      if (matchDateUnit !== null && matchDateUnit.length > 0) {
        dateStr = dateStr.replace(matchDateUnit[0], '')
        format.value = matchDateUnit[0]
      }
      return format
    })
  for (var i = 0, length = dateUnits.length; i < length; i++) {
    const format = dateUnits[i].format
    if (format == null) {
      continue
    }
    const matchDateUnit = new RegExp(format).exec(dateStr)
    if (matchDateUnit !== null && matchDateUnit.length > 0) {
      dateStr = dateStr.replace(matchDateUnit[0], '')
      dateUnits[i].value = matchDateUnit[0]
    }
  }
  // 将截取完成的信息封装成对象并格式化标准的日期字符串
  const obj = toObject(dateUnits, item => item.name, item => item.value)
  if (obj.year.length === 2) {
    obj.year = now
      .getFullYear()
      .toString()
      .substr(0, 2)
      .concat(obj.year)
  }
  const date = `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${
    obj.second
  }.${obj.milliSecond}Z`
  try {
    return new Date(date)
  } catch (e) {
    return null
  }
}

export default strToDate
