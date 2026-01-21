import type { AuthInfo, FetchOptions, IBrowserContext, TweetInfo, UserTweetsResult } from './types'
import puppeteer from 'puppeteer'
import { sleep } from './common'

/**
 * 创建一个已验证授权的浏览器上下文
 */
export async function createAuthedContext(authInfo: AuthInfo, proxyServer: string | undefined): Promise<IBrowserContext> {
  const browser = await puppeteer.launch({
    headless: true,
  })
  const context = await browser.createBrowserContext({
    proxyServer,
  })

  await context.setCookie({
    name: 'auth_token',
    value: authInfo.auth_token,
    domain: '.x.com',
    path: '/',
  })

  Object.assign(context, {
    async closeAll() {
      await context.close()
      await browser.close()
    },
  })

  return context as IBrowserContext
}

/**
 * 获取单个用户从指定时间开始的所有推文
 * @param context 初始化过的浏览器上下文
 * @param userId @xxx 用户id：xxx
 * @param startTime ISO格式的时间字符串，例如: "2026-01-20T00:00:00.000Z"
 * @returns 推文列表，获取失败的推文不会在列表中
 */
export async function fetchSingleUser(context: IBrowserContext, userId: string, startTime: string): Promise<TweetInfo[]> {
  const page = await context.newPage()
  await page.setViewport({
    width: 1920,
    height: 1080,
  })

  try {
    await page.goto(`https://x.com/${userId}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    })

    await sleep(10)

    // 检查用户是否存在
    const empty = await page.$('[data-testid="empty_state_header_text"]').catch(() => null)
    if (empty) {
      console.error(`${userId} 用户不存在`)
      throw new Error(`${userId}用户不存在[empty_state_header_text]`)
    }

    // 等待推文加载
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 30000 })
    await sleep(2)

    const tweets: TweetInfo[] = []
    const tweetIds = new Set<string>() // 用于去重
    const startTimeMs = startTime ? new Date(startTime).getTime() : 0

    let scrollAttempts = 0
    const maxScrollAttempts = 100 // 最多滚动100次
    let noNewTweetsCount = 0 // 连续没有新推文的次数
    let hasReachedStartTime = false

    while (scrollAttempts < maxScrollAttempts && !hasReachedStartTime) {
      // 提取当前页面上的所有推文
      const newTweets = await page.$$eval('article[data-testid="tweet"]', (articles, args) => {
        const results: Array<{
          id: string
          userId: string
          textContent: string
          time: string
          imageUrls: string[]
          isPinned: boolean
        }> = []

        articles.forEach((article) => {
          try {
            // 检查是否是置顶推文
            const socialContext = article.querySelector('[data-testid="socialContext"]')
            const isPinned = socialContext?.textContent?.includes('Pinned') || false

            // 获取推文链接作为唯一ID
            const tweetLink = article.querySelector('a[href*="/status/"]')
            if (!tweetLink)
              return

            const tweetId = (tweetLink as { href: string }).href

            // 检查是否是当前用户的推文（避免获取到转推等）
            const userLink = article.querySelector(`a[href="/${args.targetUserId}"]`)
            if (!userLink)
              return

            // 获取时间
            const timeElement = article.querySelector('time[datetime]')
            if (!timeElement)
              return
            const datetime = timeElement.getAttribute('datetime') || ''

            // 获取文本内容
            let textContent = ''
            const tweetTextElement = article.querySelector('[data-testid="tweetText"]')
            if (tweetTextElement) {
              textContent = tweetTextElement.textContent || ''
            }

            // 获取图片URLs
            const imageUrls: string[] = []
            const tweetPhotos = article.querySelectorAll('[data-testid="tweetPhoto"] img')
            tweetPhotos.forEach((img: any) => {
              const src = (img as { src: string }).src
              if (src && !src.includes('profile_images')) {
                // 过滤掉头像，只保留推文中的图片
                imageUrls.push(src)
              }
            })

            results.push({
              id: tweetId,
              userId: args.targetUserId,
              textContent: textContent.trim(),
              time: datetime,
              imageUrls,
              isPinned,
            })
          }
          catch (error) {
            // 解析单个推文时出错，跳过该推文
            console.error(userId, '解析单个推文时出错:', error)
          }
        })

        return results
      }, { targetUserId: userId })

      // 处理新推文并去重
      let addedCount = 0
      let nonPinnedOldTweetCount = 0 // 记录非置顶的旧推文数量

      for (const tweet of newTweets) {
        if (!tweetIds.has(tweet.id)) {
          tweetIds.add(tweet.id)

          // 检查时间是否早于startTime
          const tweetTime = new Date(tweet.time).getTime()

          if (startTime && tweetTime < startTimeMs) {
            // 如果是置顶推文且时间早于startTime，跳过但不停止抓取
            if (tweet.isPinned) {
              continue
            }
            // 如果是非置顶推文且时间早于startTime，增加计数
            nonPinnedOldTweetCount++
            // 当连续遇到多条非置顶的旧推文时，才认为真正到达了起始时间
            if (nonPinnedOldTweetCount >= 3) {
              hasReachedStartTime = true
              break
            }
            continue
          }

          // 重置计数器（如果遇到了符合时间条件的推文）
          nonPinnedOldTweetCount = 0

          tweets.push({
            userId: tweet.userId,
            textContent: tweet.textContent,
            time: tweet.time,
            imageUrls: tweet.imageUrls,
          })

          addedCount++
        }
      }

      if (addedCount === 0) {
        noNewTweetsCount++
        // 如果连续3次滚动都没有新推文，可能已经到底了
        if (noNewTweetsCount >= 3) {
          break
        }
      }
      else {
        noNewTweetsCount = 0
      }

      if (hasReachedStartTime) {
        break
      }

      // 滚动到页面底部
      await page.evaluate(() => {
        // @ts-expect-error - window and document are available in browser context
        window.scrollTo(0, document.body.scrollHeight)
      })

      // 等待新内容加载
      await sleep(2)
      scrollAttempts++
    }

    await page.close()

    return tweets
  }
  catch (error) {
    console.error('抓取推文时发生错误:', error)
    await page.close()
    throw error
  }
}

/**
 * 批量获取多个用户从指定时间开始的所有推文（并行执行，支持重试）
 * @param context 初始化过的浏览器上下文
 * @param userConfigs 用户配置列表，每项包含userId和startTime
 * @param options 可选配置项，包括重试次数和重试钩子
 * @returns 用户推文结果列表，每项包含userId、tweets列表和latestTweetTime
 */
export async function fetchMultipleUser(
  context: IBrowserContext,
  userConfigs: Array<{ userId: string, startTime: string }>,
  options?: FetchOptions,
): Promise<UserTweetsResult[]> {
  const maxRetries = options?.maxRetries ?? 3
  const beforeRetry = options?.beforeRetry

  // 为每个用户创建带重试机制的并行任务
  const fetchTasks = userConfigs.map(async (config) => {
    let lastError: Error | null = null

    // 重试循环
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 1) {
          console.warn(`开始获取用户 ${config.userId} 的推文...`)
        }
        else {
          console.warn(`重试获取用户 ${config.userId} 的推文 (第 ${attempt}/${maxRetries} 次)...`)
        }

        const tweets = await fetchSingleUser(context, config.userId, config.startTime)

        // 找到最新推文的时间
        let latestTweetTime: string | null = null
        if (tweets.length > 0) {
          // 推文按时间降序排列，第一条即为最新
          const sortedTweets = [...tweets].sort((a, b) => {
            return new Date(b.time).getTime() - new Date(a.time).getTime()
          })
          latestTweetTime = sortedTweets[0].time
        }

        console.warn(`成功获取用户 ${config.userId} 的 ${tweets.length} 条推文${latestTweetTime ? `，最新推文时间: ${latestTweetTime}` : ''}`)

        return {
          userId: config.userId,
          tweets,
          latestTweetTime,
        }
      }
      catch (error) {
        lastError = error as Error
        console.error(`获取用户 ${config.userId} 的推文失败 (第 ${attempt}/${maxRetries} 次):`, error)

        // 如果还有重试机会，执行重试前的钩子
        if (attempt < maxRetries && beforeRetry) {
          try {
            await beforeRetry(config.userId, attempt, lastError)
          }
          catch (hookError) {
            console.error(`用户 ${config.userId} 的 beforeRetry 钩子执行失败:`, hookError)
          }
        }
      }
    }

    // 所有重试都失败，返回空结果
    console.error(`用户 ${config.userId} 在 ${maxRetries} 次尝试后仍然失败`)
    return {
      userId: config.userId,
      tweets: [],
      latestTweetTime: null,
    }
  })

  // 等待所有任务完成
  return await Promise.all(fetchTasks)
}
