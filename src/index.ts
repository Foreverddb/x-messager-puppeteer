import { createAuthedContext, fetchSingleUser } from './base'

async function main(): Promise<void> {
  const context = await createAuthedContext({
    auth_token: '',
  }, undefined)

  // 获取指定时间之后的所有推文
  // 时间格式: ISO 8601 字符串，例如: "2026-01-20T00:00:00.000Z"
  const tweets = await fetchSingleUser(context, 'aibaaiai', '2026-01-10T00:00:00.000Z')

  console.warn(`成功获取 ${tweets.length} 条推文:`)
  tweets.forEach((tweet, index) => {
    console.warn(`\n推文 ${index + 1}:`)
    console.warn(`时间: ${tweet.time}`)
    console.warn(`内容: ${tweet.textContent}`)
    if (tweet.imageUrls.length > 0) {
      console.warn(`图片: ${tweet.imageUrls.join(', ')}`)
    }
  })

  await context.closeAll()
}

main()
