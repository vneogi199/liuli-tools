/**
 * 将 Map 转换为 Object 对象
 * @param {Map} map Map 键值表
 * @returns {Object} 转换得到的 Object 对象
 */
export function mapToObject(
  map: Map<PropertyKey, any>,
): Record<PropertyKey, any> {
  const res = {}
  for (const [k, v] of map) {
    Reflect.set(res, k, v)
  }
  return res
}
