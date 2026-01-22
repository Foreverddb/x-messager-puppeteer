import type { Buffer } from 'node:buffer'
import type { Page } from 'puppeteer'
import type { FetchOptions, IBrowserContext, TweetInfo } from './types'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cwd as getCwd } from 'node:process'

const DEFAULT_DOWNLOAD_DIR = 'tweet-images'
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30000

/**
 * 等待指定时间
 * @param time 秒
 */
export async function sleep(time: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, time * 1000))
}

/**
 * 处理转换推文中的图片链接为下载的本地文件路径
 * @param context
 * @param tweets
 * @param options
 * @returns 处理图片后的推文信息
 */
export async function transformTweetImages(
  context: IBrowserContext,
  tweets: TweetInfo[],
  options: FetchOptions,
): Promise<TweetInfo[]> {
  if (!options.downloadImages)
    return tweets

  const downloadRoot = options.downloadPath && options.downloadPath.trim().length > 0
    ? options.downloadPath
    : DEFAULT_DOWNLOAD_DIR
  const absoluteRoot = path.resolve(getCwd(), downloadRoot)

  await mkdir(absoluteRoot, { recursive: true })

  // 复用一个下载页面，依靠 waitForResponse 来拿到浏览器端的图片响应
  const downloadPage = await context.newPage()
  await downloadPage.goto('about:blank').catch(() => {})

  try {
    const transformed: TweetInfo[] = []

    for (const tweet of tweets) {
      if (!tweet.imageUrls || tweet.imageUrls.length === 0) {
        transformed.push(tweet)
        continue
      }

      const userDir = path.join(absoluteRoot, tweet.userId)
      await mkdir(userDir, { recursive: true })

      const downloadedUrls: string[] = []

      for (let index = 0; index < tweet.imageUrls.length; index++) {
        const imageUrl = tweet.imageUrls[index]
        const filename = createImageFilename(tweet.time, index + 1, imageUrl)
        const targetPath = path.join(userDir, filename)

        try {
          const buffer = await downloadImageViaPage(downloadPage, imageUrl)
          await writeFile(targetPath, buffer)
          downloadedUrls.push(path.posix.join(tweet.userId, filename))
        }
        catch (error) {
          console.error(`[${imageUrl}]下载用户 ${tweet.userId} 的图片失败:`, error)
          downloadedUrls.push(imageUrl)
        }
      }

      transformed.push({
        ...tweet,
        imageUrls: downloadedUrls,
      })
    }

    return transformed
  }
  finally {
    await downloadPage.close().catch(() => {})
  }
}

function createImageFilename(tweetTime: string, index: number, imageUrl: string): string {
  const millis = new Date(tweetTime).getTime()
  const timestampSeconds = Number.isFinite(millis) ? Math.floor(millis / 1000) : Math.floor(Date.now() / 1000)
  const extension = getImageExtension(imageUrl)
  return `${timestampSeconds}-${index}${extension}`
}

/**
 * 获取图片的后缀名
 */
function getImageExtension(imageUrl: string): string {
  try {
    const url = new URL(imageUrl)
    const ext = path.extname(url.pathname)
    if (ext)
      return ext
  }
  catch { }
  return '.jpg'
}

/**
 * 通过puppeteer的页面来下载图片
 */
async function downloadImageViaPage(page: Page, imageUrl: string): Promise<Buffer> {
  const waitForImageResponse = page.waitForResponse(resp => resp.url() === imageUrl, {
    timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
  })

  // 使用浏览器上下文重新发起 fetch，让 waitForResponse 捕获该图片响应
  await page.evaluate(async (url) => {
    try {
      await fetch(url, { cache: 'no-store' })
    }
    catch { }
  }, imageUrl).catch(() => {})

  const response = await waitForImageResponse
  if (!response.ok())
    throw new Error(`[${imageUrl}]下载图片失败: ${response.status()} ${response.statusText()}`)

  return await response.buffer()
}
