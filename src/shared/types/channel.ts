/**
 * Channel Type Definitions
 * Ported from ClawX — declarative channel metadata drives UI form generation.
 */

export type ChannelType =
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'wechat'
  | 'dingtalk'
  | 'wecom'
  | 'qqbot'
  | 'slack'
  | 'feishu'
  | 'signal'
  | 'imessage'
  | 'matrix'
  | 'line'
  | 'msteams'
  | 'googlechat'
  | 'mattermost'

export type ChannelConnectionType = 'token' | 'qr' | 'oauth' | 'webhook'

export interface ChannelConfigField {
  key: string
  label: string
  labelZh: string
  type: 'text' | 'password' | 'select'
  placeholder?: string
  required?: boolean
  envVar?: string
  description?: string
  descriptionZh?: string
  options?: { value: string; label: string }[]
}

export interface ChannelMeta {
  id: ChannelType
  name: string
  description: string
  descriptionZh: string
  connectionType: ChannelConnectionType
  docsUrl: string
  configFields: ChannelConfigField[]
  instructions: string[]
  instructionsZh: string[]
  isPlugin?: boolean
  comingSoon?: boolean
}

/**
 * Channel metadata registry — drives config form generation for all channels.
 */
export const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    description: 'Connect via Telegram Bot',
    descriptionZh: '通过 Telegram Bot 连接',
    connectionType: 'token',
    docsUrl: 'https://core.telegram.org/bots#botfather',
    configFields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        labelZh: '机器人令牌',
        type: 'password',
        placeholder: '123456:ABC-DEF...',
        required: true,
        envVar: 'TELEGRAM_BOT_TOKEN',
      },
      {
        key: 'allowedUsers',
        label: 'Allowed User IDs',
        labelZh: '允许的用户 ID',
        type: 'text',
        placeholder: '123456789, 987654321',
        required: true,
        description: 'Comma-separated list of Telegram user IDs allowed to use the bot.',
        descriptionZh: '允许使用机器人的用户 ID 列表（逗号分隔）。出于安全考虑，此项为必填。',
      },
    ],
    instructions: [
      'Open Telegram and search for @BotFather',
      'Send /newbot and follow the instructions',
      'Copy the bot token provided',
      'Get your User ID from @userinfobot',
    ],
    instructionsZh: [
      '打开 Telegram 并搜索 @BotFather',
      '发送 /newbot 并按照说明操作',
      '复制提供的机器人令牌',
      '从 @userinfobot 获取您的用户 ID',
    ],
  },

  discord: {
    id: 'discord',
    name: 'Discord',
    description: 'Connect via Discord Bot',
    descriptionZh: '通过 Discord Bot 连接',
    connectionType: 'token',
    docsUrl: 'https://discord.com/developers/applications',
    configFields: [
      {
        key: 'token',
        label: 'Bot Token',
        labelZh: '机器人令牌',
        type: 'password',
        placeholder: 'MTIz...',
        required: true,
        envVar: 'DISCORD_BOT_TOKEN',
      },
      {
        key: 'guildId',
        label: 'Server (Guild) ID',
        labelZh: '服务器 (Guild) ID',
        type: 'text',
        placeholder: '123456789012345678',
        required: true,
        description: 'Right-click the server name and select "Copy Server ID".',
        descriptionZh: '右键点击服务器名称并选择"复制服务器 ID"。',
      },
      {
        key: 'channelId',
        label: 'Channel ID (optional)',
        labelZh: '频道 ID（可选）',
        type: 'text',
        placeholder: '123456789012345678',
        required: false,
        description: 'Restrict the bot to a specific channel.',
        descriptionZh: '限制机器人在特定频道中工作。',
      },
    ],
    instructions: [
      'Go to Discord Developer Portal',
      'Create a New Application',
      'Go to Bot section and create a bot',
      'Copy the Bot Token',
      'Enable Message Content Intent',
      'Invite the bot to your server with proper permissions',
    ],
    instructionsZh: [
      '前往 Discord 开发者门户',
      '创建新应用',
      '进入 Bot 部分并创建机器人',
      '复制 Bot Token',
      '启用 Message Content Intent',
      '使用正确的权限将机器人邀请到您的服务器',
    ],
  },

  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Connect via WhatsApp QR code',
    descriptionZh: '通过扫描二维码连接 WhatsApp',
    connectionType: 'qr',
    docsUrl: '',
    configFields: [],
    instructions: [
      'Click "Start" to generate a QR code',
      'Open WhatsApp on your phone',
      'Go to Settings > Linked Devices',
      'Scan the QR code',
    ],
    instructionsZh: [
      '点击"开始"生成二维码',
      '在手机上打开 WhatsApp',
      '进入 设置 > 已关联的设备',
      '扫描二维码',
    ],
  },

  wechat: {
    id: 'wechat',
    name: 'WeChat',
    description: 'Connect via WeChat QR code',
    descriptionZh: '通过扫描二维码连接微信',
    connectionType: 'qr',
    docsUrl: '',
    configFields: [],
    comingSoon: true,
    instructions: [
      'Click "Start" to generate a QR code',
      'Open WeChat on your phone',
      'Scan the QR code to log in',
      'Keep the session active',
    ],
    instructionsZh: [
      '点击"开始"生成二维码',
      '在手机上打开微信',
      '扫描二维码登录',
      '保持会话活跃',
    ],
    isPlugin: true,
  },

  dingtalk: {
    id: 'dingtalk',
    name: 'DingTalk',
    description: 'Connect via DingTalk Robot',
    descriptionZh: '通过钉钉机器人连接',
    connectionType: 'token',
    docsUrl: 'https://open.dingtalk.com/',
    comingSoon: true,
    configFields: [
      {
        key: 'clientId',
        label: 'Client ID (AppKey)',
        labelZh: 'Client ID (AppKey)',
        type: 'text',
        placeholder: 'dingXXXXXXXX',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret (AppSecret)',
        labelZh: 'Client Secret (AppSecret)',
        type: 'password',
        placeholder: '••••••••',
        required: true,
      },
      {
        key: 'robotCode',
        label: 'Robot Code (optional)',
        labelZh: '机器人编码（可选）',
        type: 'text',
        placeholder: 'dingXXXXXXXX',
        required: false,
      },
    ],
    instructions: [
      'Go to DingTalk Open Platform',
      'Create an app and enable the Robot capability',
      'Copy the Client ID and Client Secret',
    ],
    instructionsZh: [
      '前往钉钉开放平台',
      '创建应用并启用机器人能力',
      '复制 Client ID 和 Client Secret',
    ],
    isPlugin: true,
  },

  wecom: {
    id: 'wecom',
    name: 'WeCom',
    description: 'Connect via WeCom Bot',
    descriptionZh: '通过企业微信机器人连接',
    connectionType: 'token',
    docsUrl: 'https://developer.work.weixin.qq.com/',
    comingSoon: true,
    configFields: [
      {
        key: 'botId',
        label: 'Bot ID (Corp ID)',
        labelZh: 'Bot ID（企业 ID）',
        type: 'text',
        placeholder: 'wkXXXXXX',
        required: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        labelZh: '密钥',
        type: 'password',
        placeholder: '••••••••',
        required: true,
      },
    ],
    instructions: [
      'Log in to WeCom Admin Console',
      'Create a self-built app',
      'Copy the Bot ID and Secret',
    ],
    instructionsZh: [
      '登录企业微信管理后台',
      '创建自建应用',
      '复制 Bot ID 和 Secret',
    ],
    isPlugin: true,
  },

  qqbot: {
    id: 'qqbot',
    name: 'QQ Bot',
    description: 'Connect via QQ Bot',
    descriptionZh: '通过 QQ 机器人连接',
    connectionType: 'token',
    docsUrl: 'https://q.qq.com/',
    configFields: [
      {
        key: 'appId',
        label: 'App ID',
        labelZh: 'App ID',
        type: 'text',
        placeholder: '102XXXXXX',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        labelZh: 'Client Secret',
        type: 'password',
        placeholder: '••••••••',
        required: true,
      },
    ],
    instructions: [
      'Go to QQ Open Platform',
      'Create a Bot application',
      'Copy the App ID and Client Secret',
    ],
    instructionsZh: [
      '前往 QQ 开放平台',
      '创建机器人应用',
      '复制 App ID 和 Client Secret',
    ],
    isPlugin: true,
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Connect via Slack Bot',
    descriptionZh: '通过 Slack Bot 连接',
    connectionType: 'token',
    docsUrl: 'https://api.slack.com/apps',
    configFields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        labelZh: 'Bot Token',
        type: 'password',
        placeholder: 'xoxb-...',
        required: true,
        envVar: 'SLACK_BOT_TOKEN',
      },
      {
        key: 'appToken',
        label: 'App-Level Token',
        labelZh: 'App-Level Token',
        type: 'password',
        placeholder: 'xapp-...',
        required: true,
        envVar: 'SLACK_APP_TOKEN',
      },
    ],
    instructions: [
      'Go to Slack API and create a new app',
      'Enable Socket Mode and generate an App-Level Token',
      'Add Bot Token Scopes and install the app',
      'Copy the Bot Token and App-Level Token',
    ],
    instructionsZh: [
      '前往 Slack API 并创建新应用',
      '启用 Socket Mode 并生成 App-Level Token',
      '添加 Bot Token 权限并安装应用',
      '复制 Bot Token 和 App-Level Token',
    ],
  },

  feishu: {
    id: 'feishu',
    name: 'Feishu / Lark',
    description: 'Connect via Feishu Open Platform',
    descriptionZh: '通过飞书开放平台连接',
    connectionType: 'token',
    docsUrl: 'https://open.feishu.cn/',
    configFields: [
      {
        key: 'appId',
        label: 'App ID',
        labelZh: 'App ID',
        type: 'text',
        placeholder: 'cli_xxx',
        required: true,
        envVar: 'FEISHU_APP_ID',
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        labelZh: 'App Secret',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        envVar: 'FEISHU_APP_SECRET',
      },
    ],
    instructions: [
      'Go to Feishu Open Platform',
      'Create an app and enable Bot capability',
      'Copy the App ID and App Secret',
    ],
    instructionsZh: [
      '前往飞书开放平台',
      '创建应用并启用机器人能力',
      '复制 App ID 和 App Secret',
    ],
    isPlugin: true,
  },

  signal: {
    id: 'signal',
    name: 'Signal',
    description: 'Connect via Signal',
    descriptionZh: '通过 Signal 连接',
    connectionType: 'token',
    docsUrl: '',
    configFields: [
      {
        key: 'phoneNumber',
        label: 'Phone Number',
        labelZh: '手机号',
        type: 'text',
        placeholder: '+1234567890',
        required: true,
      },
    ],
    instructions: [
      'Install signal-cli on your system',
      'Register or link your phone number',
      'Enter the phone number below',
    ],
    instructionsZh: [
      '在系统上安装 signal-cli',
      '注册或关联你的手机号',
      '在下方输入手机号',
    ],
  },

  imessage: {
    id: 'imessage',
    name: 'iMessage',
    description: 'Connect via iMessage',
    descriptionZh: '通过 iMessage 连接',
    connectionType: 'token',
    docsUrl: '',
    configFields: [
      {
        key: 'serverUrl',
        label: 'Server URL',
        labelZh: '服务器地址',
        type: 'text',
        placeholder: 'http://localhost:8080',
        required: true,
      },
      {
        key: 'password',
        label: 'Password',
        labelZh: '密码',
        type: 'password',
        placeholder: '••••••••',
        required: true,
      },
    ],
    instructions: [
      'Set up BlueBubbles or similar iMessage bridge',
      'Enter the server URL and password',
      'Ensure the bridge is running on a macOS device',
    ],
    instructionsZh: [
      '设置 BlueBubbles 或类似的 iMessage 桥接',
      '输入服务器地址和密码',
      '确保桥接运行在 macOS 设备上',
    ],
  },

  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'Connect via Matrix protocol',
    descriptionZh: '通过 Matrix 协议连接',
    connectionType: 'token',
    docsUrl: '',
    configFields: [
      {
        key: 'homeserver',
        label: 'Homeserver URL',
        labelZh: 'Homeserver 地址',
        type: 'text',
        placeholder: 'https://matrix.org',
        required: true,
      },
      {
        key: 'accessToken',
        label: 'Access Token',
        labelZh: '访问令牌',
        type: 'password',
        placeholder: 'syt_...',
        required: true,
      },
    ],
    instructions: [
      'Create a Matrix account or use an existing one',
      'Generate an access token from your client settings',
      'Enter the homeserver URL and access token',
    ],
    instructionsZh: [
      '创建 Matrix 账户或使用现有账户',
      '从客户端设置中生成访问令牌',
      '输入 Homeserver 地址和访问令牌',
    ],
    isPlugin: true,
  },

  line: {
    id: 'line',
    name: 'LINE',
    description: 'Connect via LINE Messaging API',
    descriptionZh: '通过 LINE Messaging API 连接',
    connectionType: 'token',
    docsUrl: 'https://developers.line.biz/',
    configFields: [
      {
        key: 'channelAccessToken',
        label: 'Channel Access Token',
        labelZh: 'Channel Access Token',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        envVar: 'LINE_CHANNEL_ACCESS_TOKEN',
      },
      {
        key: 'channelSecret',
        label: 'Channel Secret',
        labelZh: 'Channel Secret',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        envVar: 'LINE_CHANNEL_SECRET',
      },
    ],
    instructions: [
      'Go to LINE Developers console',
      'Create a Messaging API channel',
      'Copy the Channel Access Token and Channel Secret',
    ],
    instructionsZh: [
      '前往 LINE Developers 控制台',
      '创建 Messaging API 频道',
      '复制 Channel Access Token 和 Channel Secret',
    ],
    isPlugin: true,
  },

  msteams: {
    id: 'msteams',
    name: 'Microsoft Teams',
    description: 'Connect via Microsoft Teams',
    descriptionZh: '通过 Microsoft Teams 连接',
    connectionType: 'token',
    docsUrl: 'https://dev.teams.microsoft.com/',
    configFields: [
      {
        key: 'appId',
        label: 'App ID',
        labelZh: 'App ID',
        type: 'text',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        required: true,
        envVar: 'MSTEAMS_APP_ID',
      },
      {
        key: 'appPassword',
        label: 'App Password',
        labelZh: 'App Password',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        envVar: 'MSTEAMS_APP_PASSWORD',
      },
    ],
    instructions: [
      'Go to Microsoft Teams Developer Portal',
      'Register a new bot',
      'Copy the App ID and generate an App Password',
      'Configure the messaging endpoint',
    ],
    instructionsZh: [
      '前往 Microsoft Teams 开发者门户',
      '注册新的机器人',
      '复制 App ID 并生成 App Password',
      '配置消息端点',
    ],
    isPlugin: true,
  },

  googlechat: {
    id: 'googlechat',
    name: 'Google Chat',
    description: 'Connect via Google Chat',
    descriptionZh: '通过 Google Chat 连接',
    connectionType: 'webhook',
    docsUrl: 'https://developers.google.com/chat',
    configFields: [
      {
        key: 'serviceAccountKey',
        label: 'Service Account Key (JSON)',
        labelZh: '服务账号密钥（JSON）',
        type: 'text',
        placeholder: '{"type":"service_account",...}',
        required: true,
      },
    ],
    instructions: [
      'Go to Google Cloud Console',
      'Create a service account with Chat API access',
      'Download the JSON key file',
      'Paste the key content below',
    ],
    instructionsZh: [
      '前往 Google Cloud Console',
      '创建具有 Chat API 访问权限的服务账号',
      '下载 JSON 密钥文件',
      '在下方粘贴密钥内容',
    ],
  },

  mattermost: {
    id: 'mattermost',
    name: 'Mattermost',
    description: 'Connect via Mattermost Bot',
    descriptionZh: '通过 Mattermost Bot 连接',
    connectionType: 'token',
    docsUrl: '',
    configFields: [
      {
        key: 'serverUrl',
        label: 'Server URL',
        labelZh: '服务器地址',
        type: 'text',
        placeholder: 'https://mattermost.example.com',
        required: true,
      },
      {
        key: 'botToken',
        label: 'Bot Token',
        labelZh: 'Bot Token',
        type: 'password',
        placeholder: '••••••••',
        required: true,
      },
    ],
    instructions: [
      'Go to Mattermost System Console',
      'Create a bot account',
      'Copy the Bot Token',
    ],
    instructionsZh: [
      '前往 Mattermost 系统控制台',
      '创建机器人账户',
      '复制 Bot Token',
    ],
    isPlugin: true,
  },
}

/** Primary channels shown by default in the grid */
export function getPrimaryChannels(): ChannelType[] {
  return ['telegram', 'discord', 'whatsapp', 'wechat', 'dingtalk', 'feishu', 'wecom', 'qqbot', 'slack']
}

/** All available channel types */
export function getAllChannels(): ChannelType[] {
  return Object.keys(CHANNEL_META) as ChannelType[]
}
