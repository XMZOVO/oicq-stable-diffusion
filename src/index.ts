/* eslint-disable no-console */
import type { GroupMessageEvent, PrivateMessageEvent } from 'oicq'
import { createClient } from 'oicq'
import axios from 'axios'
import translate from 'google-translate-api-x'

const account = 3558195590
const client = createClient(account)
const messageList = [] as string[]
interface Result {
  prefix?: string
  params: Array<string>
  remaining?: string
}

client.on('system.online', () => console.log('Logged in!'))

client
  .on('system.login.qrcode', function (_) {
    // 扫码后按回车登录
    process.stdin.once('data', () => {
      this.login()
    })
  })
  .login()

client.on('message.group', async (e) => {
  console.log(e.raw_message)
  const rep = await reply(e)
  if (rep !== undefined) {
    messageList.push(rep.message_id)
    setTimeout(() => {
      if (messageList.length === 0)
        return
      const group = client.pickGroup((e as GroupMessageEvent).group.gid)
      group.recallMsg(messageList[0])
      messageList.shift()
    }, 15000)
  }
})

client.on('message.private', async (e) => {
  console.log(e.raw_message)
  reply(e)
})

async function reply(e: PrivateMessageEvent | GroupMessageEvent) {
  const result = await processMessage(e.raw_message)
  if (result.remaining) {
    e.reply(`妈妈正在生成${result.params.includes('hd') ? '高清' : ''}图片：${result.remaining}`, true)
    const base64 = await generate(result.remaining, result.params)

    const reply = await e.reply([{
      type: 'image',
      file: `base64://${base64}`,
    }])
    return reply
  }
}

async function processMessage(message: string): Promise<Result> {
  const result: Result = { params: [] }
  const string = message
  const match = string.match(/^(sdAI|sdTrans)( -\w+)* (.*)/)
  if (match) {
    let remaining = match[3]
    if (match[1] === 'sdTrans') {
      const res = await translate(match[3], { to: 'en' }) as any
      remaining = res.text
    }

    const params = match[2]
    if (params) {
      const paramArray = params.split(' -')
      result.params = paramArray.slice(1, paramArray.length)
    }
    result.remaining = remaining
  }
  else {
    result.remaining = undefined
  }
  return result
}

async function generate(prompt: string, params: Array<string>): Promise<string> {
  const res = await axios.post('http://127.0.0.1:7861/sdapi/v1/txt2img', {
    steps: '30',
    width: 512 * (params.includes('hd') ? 1.5 : 1),
    height: 640 * (params.includes('hd') ? 1.5 : 1),
    cfg_scale: 11,
    sampler_index: 'DPM++ SDE Karras',
    prompt: `${prompt}`,
    negative_prompt:
          `(worst quality, low quality:1.4), bad anatomy, extra ears, fewer digits, text,
           signature, watermark, username, artist name, bad proportions, greyscale, monocrome,
            multiple views, lowres, multiple tails, blurry,`,
  })
  return res.data.images[0]
}
