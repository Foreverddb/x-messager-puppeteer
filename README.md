# x-messager-puppeteer

[![npm version](https://img.shields.io/npm/v/x-messager-puppeteer.svg)](https://www.npmjs.com/package/x-messager-puppeteer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript library for fetching Twitter/X user tweets using Puppeteer with parallel processing and retry mechanisms.

[⚠️ 免责声明 / Disclaimer](#-免责声明--disclaimer)

## Features

✨ **Key Features:**

- 🚀 **Parallel Processing** - Fetch multiple users' tweets simultaneously
- 🔄 **Automatic Retry** - Configurable retry mechanism with customizable hooks
- 📅 **Time-based Filtering** - Fetch tweets from a specific start time
- 🖼️ **Image Support** - Extract tweet images automatically
- 📥 **Optional Downloads** - Save images locally with organized user folders during scraping
- 🎯 **Latest Tweet Tracking** - Get the most recent tweet timestamp for each user
- 💪 **TypeScript** - Full type safety and IntelliSense support
- ⚡ **Efficient** - Smart scrolling and deduplication

## Installation

```bash
# npm
npm install x-messager-puppeteer

# pnpm
pnpm add x-messager-puppeteer

# yarn
yarn add x-messager-puppeteer
```

## Quick Start

### Basic Usage - Single User

```typescript
import { createAuthedContext, fetchSingleUser } from 'x-messager-puppeteer'

const context = await createAuthedContext({
  auth_token: 'your_twitter_auth_token',
}, {
  proxyServer: '127.0.0.1:7890', // Optional proxy
})

const tweets = await fetchSingleUser(
  context,
  'username',
  '2026-01-10T00:00:00.000Z' // Start time
)

console.log(`Fetched ${tweets.length} tweets`)
tweets.forEach((tweet) => {
  console.log(`${tweet.time}: ${tweet.textContent}`)
})

await context.closeAll()
```

When `downloadImages` is enabled, every tweet image is saved inside `<project root>/<downloadPath>/<userId>/<timestamp>-<index>.ext`. The `imageUrls` array for each tweet then contains relative paths such as `username/1700000000-1.jpg` instead of remote URLs. Downloads are performed as tweets are collected (before each scroll) and reuse the active user page.

### Batch Processing - Multiple Users

```typescript
import { fetchMultipleUser } from 'x-messager-puppeteer'

const results = await fetchMultipleUser(
  {
    auth_token: 'your_twitter_auth_token',
  },
  [
    { userId: 'user1', startTime: '2026-01-15T00:00:00.000Z' },
    { userId: 'user2', startTime: '2026-01-15T00:00:00.000Z' },
    { userId: 'user3', startTime: '2026-01-15T00:00:00.000Z' },
  ]
)

results.forEach((result) => {
  console.log(`User: ${result.userId}`)
  console.log(`Tweets: ${result.tweets.length}`)
  console.log(`Latest tweet: ${result.latestTweetTime}`)
})

await context.closeAll()
```

### Advanced - With Retry Mechanism

```typescript
import { fetchMultipleUser } from 'x-messager-puppeteer'

const results = await fetchMultipleUser(
  {
    auth_token: 'your_twitter_auth_token',
    proxyServer: '127.0.0.1:7890',
    downloadImages: true,
    downloadPath: 'downloads/tweet-images',
    maxRetries: 3, // Retry up to 3 times per user
    beforeRetry: async (userId, attempt, error) => {
      console.log(`Retrying ${userId} (attempt ${attempt})`)
      console.log(`Error: ${error.message}`)

      // Wait before retry to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000))

      // You can also:
      // - Log errors to a monitoring service
      // - Clear browser cache
      // - Rotate proxies
      // - Send notifications
    },
  },
  [
    { userId: 'user1', startTime: '2026-01-15T00:00:00.000Z' },
    { userId: 'user2', startTime: '2026-01-15T00:00:00.000Z' },
  ]
)
```

## API Reference

### `createAuthedContext(authInfo, options?)`

Create an authenticated browser context for Twitter/X.

**Parameters:**
- `authInfo`: Object with `auth_token` property
- `options` (optional): Combines browser init options and fetch retry config
  - `proxyServer`: Proxy server address (e.g., `'127.0.0.1:7890'`)
  - `headless`: Whether to run the browser in headless mode
  - `maxRetries`: Max retry attempts per user (default: `3`)
  - `beforeRetry`: Hook executed before each retry `(userId, attempt, error)`
  - `downloadImages`: Toggle automatic tweet image download during scraping (default: `false`)
  - `downloadPath`: Target directory for downloaded images, relative to your project root (default: `tweet-images`)

**Returns:** `Promise<IBrowserContext>`

---

### `fetchSingleUser(context, userId, startTime)`

Fetch tweets from a single user.

**Parameters:**
- `context`: Authenticated browser context
- `userId`: Twitter username (without @)
- `startTime`: ISO 8601 timestamp string (e.g., `'2026-01-15T00:00:00.000Z'`)

Automatically retries according to the `maxRetries`/`beforeRetry` options provided when creating the context.

**Returns:** `Promise<TweetInfo[]>`

If `downloadImages` is enabled on the context, each `imageUrls` entry becomes a relative file path (e.g., `username/1700000000-1.jpg`). Otherwise, the original remote URLs are returned. Images are downloaded while scrolling, using the current user page.

**TweetInfo Interface:**
```typescript
interface TweetInfo {
  userId: string
  textContent: string
  time: string // ISO 8601 format
  imageUrls: string[]
}
```

---

### `fetchMultipleUser(context, userConfigs)`

Fetch tweets from multiple users in parallel. Each fetch automatically uses the retry rules configured on the browser context.

**Parameters:**
- `context`: Authenticated browser context
- `userConfigs`: Array of `{ userId: string, startTime: string }`

**Returns:** `Promise<UserTweetsResult[]>`

**UserTweetsResult Interface:**
```typescript
interface UserTweetsResult {
  userId: string
  tweets: TweetInfo[]
  latestTweetTime: string | null // Most recent tweet time or null if no tweets
}
```

**FetchOptions Interface:**
```typescript
interface FetchOptions {
  maxRetries?: number
  beforeRetry?: (userId: string, attempt: number, error: Error) => Promise<void> | void
  downloadImages?: boolean
  downloadPath?: string
}
```

## How to Get Your Auth Token

1. Open Twitter/X in your browser
2. Log in to your account
3. Open Developer Tools (F12)
4. Go to Application/Storage → Cookies → `https://x.com`
5. Find the `auth_token` cookie and copy its value

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build the library
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## ⚠️ 免责声明 / Disclaimer

### 中文版

**重要提示：请仔细阅读本免责声明**

本项目（X-Messager-Puppeteer）仅供学习和研究网络爬虫技术使用，旨在帮助开发者理解和学习自动化浏览器操作、数据抓取等相关技术知识。

1. **教育目的**：本项目的开发和发布纯粹出于教育和学习目的，无意侵犯任何个人、组织或平台的合法权益。

2. **使用责任**：使用本工具库的用户应当遵守所在国家和地区的法律法规，以及目标网站的服务条款和使用协议。用户在使用本工具时应当：
   - 遵守相关法律法规和网站的robots.txt协议
   - 尊重网站的服务条款和使用限制
   - 不得将本工具用于任何非法用途或侵犯他人权益的行为
   - 合理控制访问频率，避免对目标服务器造成过大负担

3. **责任限制**：任何个人或组织使用本工具库所产生的一切法律责任、经济损失、数据损失或其他任何形式的损害，均由使用者本人承担，与本项目开发者及贡献者无关。本项目开发者不对使用本工具所造成的任何直接或间接后果负责。

4. **无担保声明**：本项目按"现状"提供，不提供任何明示或暗示的担保，包括但不限于适销性、特定用途适用性和非侵权性的担保。

5. **知识产权**：用户应当尊重目标网站的知识产权和数据所有权，不得将抓取的数据用于商业用途或其他侵权行为。

**通过下载、安装或使用本项目,即表示您已阅读、理解并同意接受本免责声明的所有条款。如果您不同意本免责声明的任何内容，请立即停止使用本项目。**

---

### English Version

**IMPORTANT: Please read this disclaimer carefully**

This project (X-Messager-Puppeteer) is intended solely for learning and research purposes related to web scraping technology, aiming to help developers understand and learn about automated browser operations, data extraction, and related technical knowledge.

1. **Educational Purpose**: The development and release of this project are purely for educational and learning purposes, with no intention to infringe upon the legitimate rights and interests of any individual, organization, or platform.

2. **User Responsibility**: Users of this tool library should comply with the laws and regulations of their country and region, as well as the terms of service and usage agreements of target websites. When using this tool, users should:
   - Comply with relevant laws, regulations, and the robots.txt protocol of websites
   - Respect the terms of service and usage restrictions of websites
   - Not use this tool for any illegal purposes or activities that infringe upon the rights of others
   - Reasonably control access frequency to avoid placing excessive burden on target servers

3. **Limitation of Liability**: Any legal liability, economic loss, data loss, or any other form of damage arising from the use of this tool library by any individual or organization shall be borne by the user themselves and is unrelated to the developers and contributors of this project. The project developers are not responsible for any direct or indirect consequences caused by the use of this tool.

4. **No Warranty**: This project is provided "as is" without any express or implied warranties, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.

5. **Intellectual Property**: Users should respect the intellectual property rights and data ownership of target websites and shall not use scraped data for commercial purposes or other infringing activities.

**By downloading, installing, or using this project, you acknowledge that you have read, understood, and agree to accept all terms of this disclaimer. If you do not agree with any part of this disclaimer, please stop using this project immediately.**

---
