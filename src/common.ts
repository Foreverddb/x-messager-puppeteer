/**
 * 等待指定时间
 * @param time 秒
 */
export async function sleep(time: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, time * 1000))
}
