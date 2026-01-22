import type { BrowserContext } from 'puppeteer'

/**
 * 认证信息接口
 */
export interface AuthInfo {
  auth_token: string
}

/**
 * 初始化上下文可选项
 */
export interface InitContextOptions {
  headless?: boolean
  proxyServer?: string
}

/**
 * 推文信息接口
 */
export interface TweetInfo {
  /** 推文链接 */
  url: string
  /** 用户ID */
  userId: string
  /** 推文文本内容 */
  textContent: string
  /** 推文发布时间（ISO 8601 格式） */
  time: string
  /** 推文中的图片 URLs */
  imageUrls: string[]
}

/**
 * 用户推文结果接口
 */
export interface UserTweetsResult {
  /** 用户ID */
  userId: string
  /** 推文列表 */
  tweets: TweetInfo[]
  /** 最新推文时间（ISO 8601 格式），无推文时为 null */
  latestTweetTime: string | null
}

/**
 * 获取推文的配置选项
 */
export interface FetchOptions {
  /** 每个用户的最大重试次数，默认为 3 */
  maxRetries?: number
  /** 在每次重试前执行的钩子函数 */
  beforeRetry?: (userId: string, attempt: number, error: Error) => Promise<void> | void
  /** 是否自动下载推文中的图片 */
  downloadImages?: boolean
  /** 下载图片保存的根目录（相对于调用方项目根目录） */
  downloadPath?: string
}

/**
 * 扩展的浏览器上下文接口
 */
export type IBrowserContext = BrowserContext & {
  closeAll: () => Promise<void>
  fetchOptions?: FetchOptions
}
