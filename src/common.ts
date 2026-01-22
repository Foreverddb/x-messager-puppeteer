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
 * 图片下载器接口
 */
interface TweetImageDownloader {
  downloadTweets: (tweets: TweetInfo[]) => Promise<TweetInfo[]>
  close: () => Promise<void>
}

/**
 * 创建一个可复用的图片下载器，避免每次下载都新建页面
 * @param context 已初始化的浏览器上下文
 * @param options 下载相关配置
 * @returns 下载器（在未开启下载时返回空实现）
 */
export async function createTweetImageDownloader(
  context: IBrowserContext,
  options: FetchOptions,
): Promise<TweetImageDownloader> {
  if (!options.downloadImages) {
    // 未开启下载时返回空实现，保持调用端逻辑一致
    return {
      downloadTweets: async (tweets: TweetInfo[]) => tweets,
      close: async () => {},
    }
  }

  // 计算下载根目录（相对路径转绝对路径）
  const downloadRoot = options.downloadPath && options.downloadPath.trim().length > 0
    ? options.downloadPath
    : DEFAULT_DOWNLOAD_DIR
  const absoluteRoot = path.resolve(getCwd(), downloadRoot)

  // 确保根目录存在
  await mkdir(absoluteRoot, { recursive: true })

  // 复用一个下载页面，依靠 waitForResponse 来拿到浏览器端的图片响应
  const downloadPage = await context.newPage()
  await downloadPage.goto('about:blank').catch(() => {})

  return {
    downloadTweets: async (tweets: TweetInfo[]) => downloadTweetsWithPage(downloadPage, absoluteRoot, tweets),
    close: async () => {
      await downloadPage.close().catch(() => {})
    },
  }
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
  // 用一个短生命周期的下载器来复用页面
  const downloader = await createTweetImageDownloader(context, options)
  try {
    return await downloader.downloadTweets(tweets)
  }
  finally {
    await downloader.close()
  }
}

/**
 * 使用指定页面批量下载推文图片，并将 imageUrls 替换为本地相对路径
 * @param downloadPage 复用的下载页面
 * @param absoluteRoot 下载根目录（绝对路径）
 * @param tweets 待处理的推文列表
 */
async function downloadTweetsWithPage(
  downloadPage: Page,
  absoluteRoot: string,
  tweets: TweetInfo[],
): Promise<TweetInfo[]> {
  const transformed: TweetInfo[] = []

  for (const tweet of tweets) {
    // 无图片的推文直接返回
    if (!tweet.imageUrls || tweet.imageUrls.length === 0) {
      transformed.push(tweet)
      continue
    }

    // 按用户分目录存储，避免文件名冲突
    const userDir = path.join(absoluteRoot, tweet.userId)
    await mkdir(userDir, { recursive: true })

    const downloadedUrls: string[] = []

    for (let index = 0; index < tweet.imageUrls.length; index++) {
      const imageUrl = tweet.imageUrls[index]
      const filename = createImageFilename(tweet.time, index + 1, imageUrl)
      const targetPath = path.join(userDir, filename)

      try {
        // 通过复用页面下载图片并落盘
        const buffer = await downloadImageViaPage(downloadPage, imageUrl)
        await writeFile(targetPath, buffer)
        // 使用 posix 路径保持输出一致性
        downloadedUrls.push(path.posix.join(tweet.userId, filename))
      }
      catch (error) {
        // 下载失败时保留原始 URL，避免数据丢失
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

/**
 * 生成图片文件名：秒级时间戳 + 序号 + 后缀
 * @param tweetTime 推文时间（ISO 字符串）
 * @param index 图片序号（从 1 开始）
 * @param imageUrl 图片 URL（用于解析后缀）
 */
function createImageFilename(tweetTime: string, index: number, imageUrl: string): string {
  const millis = new Date(tweetTime).getTime()
  // 时间解析失败时使用当前时间，避免文件名为空
  const timestampSeconds = Number.isFinite(millis) ? Math.floor(millis / 1000) : Math.floor(Date.now() / 1000)
  const extension = getImageExtension(imageUrl)
  return `${timestampSeconds}-${index}${extension}`
}

/**
 * 获取图片的后缀名，解析失败时默认 .jpg
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
 * 通过 puppeteer 的页面来下载图片
 * @param page 复用的下载页面
 * @param imageUrl 图片 URL
 * @returns 图片二进制数据
 */
async function downloadImageViaPage(page: Page, imageUrl: string): Promise<Buffer> {
  // 等待该 URL 的响应返回
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
  // 非 2xx 直接抛错，交由上层回退到原始 URL
  if (!response.ok())
    throw new Error(`[${imageUrl}]下载图片失败: ${response.status()} ${response.statusText()}`)

  return await response.buffer()
}
