# x-messager-puppeteer

[![npm version](https://img.shields.io/npm/v/x-messager-puppeteer.svg)](https://www.npmjs.com/package/x-messager-puppeteer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript library for fetching Twitter/X user tweets using Puppeteer with parallel processing and retry mechanisms.

## Features

✨ **Key Features:**

- 🚀 **Parallel Processing** - Fetch multiple users' tweets simultaneously
- 🔄 **Automatic Retry** - Configurable retry mechanism with customizable hooks
- 📅 **Time-based Filtering** - Fetch tweets from a specific start time
- 🖼️ **Image Support** - Extract tweet images automatically
- 📥 **Optional Downloads** - Save images locally with organized user folders
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

When `downloadImages` is enabled, every tweet image is saved inside `<project root>/<downloadPath>/<userId>/<timestamp>-<index>.ext`. The `imageUrls` array for each tweet then contains relative paths such as `username/1700000000-1.jpg` instead of remote URLs.

### Batch Processing - Multiple Users

```typescript
import { createAuthedContext, fetchMultipleUser } from 'x-messager-puppeteer'

const context = await createAuthedContext({
  auth_token: 'your_twitter_auth_token',
})

const results = await fetchMultipleUser(
  context,
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
import { createAuthedContext, fetchMultipleUser } from 'x-messager-puppeteer'

const context = await createAuthedContext({
  auth_token: 'your_twitter_auth_token',
}, {
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
})

const results = await fetchMultipleUser(
  context,
  [
    { userId: 'user1', startTime: '2026-01-15T00:00:00.000Z' },
    { userId: 'user2', startTime: '2026-01-15T00:00:00.000Z' },
  ]
)

await context.closeAll()
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
  - `downloadImages`: Toggle automatic tweet image download (default: `false`)
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

If `downloadImages` is enabled on the context, each `imageUrls` entry becomes a relative file path (e.g., `username/1700000000-1.jpg`). Otherwise, the original remote URLs are returned.

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
