/**
 * 定义监听对象时的回调函数 doc
 * @callback WatchObjectCallback
 * @param target 代理的对象变化后的值
 * @param k 变化的属性名
 * @param v 变化的属性值
 */

/**
 * 深度监听指定对象属性的变化
 * 注：指定对象不能是原始类型，即不可变类型，而且对象本身的引用不能改变，最好使用 const 进行声明
 * @param object 需要监视的对象
 * @param callback 当代理对象发生改变时的回调函数，回调函数有三个参数，分别是
 * @returns 返回源对象的一个代理
 */
export function watchObject<T extends object>(
  object: T,
  callback: (target: T, k: PropertyKey, v: any) => void,
): object {
  const handler: ProxyHandler<T> = {
    get(target, k) {
      try {
        return new Proxy(Reflect.get(target, k), handler)
      } catch (err) {
        return Reflect.get(target, k)
      }
    },
    set(target, k, v) {
      callback(target, k, v)
      return Reflect.set(target, k, v)
    },
  }
  return new Proxy(object, handler)
}
