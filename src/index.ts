/* eslint-disable no-console */
import type { GroupMessageEvent, PrivateMessageEvent } from 'oicq'
import { createClient } from 'oicq'
import axios from 'axios'
import sha256 from 'crypto-js/sha256'

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
    e.reply(`妈妈正在生成${result.params.includes('-hd') ? '高清' : ''}图片：${result.remaining}`, true)
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

  const pattern = /^(sdAI|sdTrans)\s+((?:-\w+\s?)*)?(.+)?$/
  const match = pattern.exec(string)
  if (match) {
    result.prefix = match[1]
    result.params = match[2] ? match[2].split(' ') : []
    result.remaining = match[1] === 'sdAI' ? match[3] : await translate(match[3])
  }
  return result
}

async function translate(q: string): Promise<string> {
  const appKey = '5dc121139f08a9d4'
  const key = 'S3M5eTuloS4XH7njeyZcM0X7JcCsAcaU'// 注意：暴露appSecret，有被盗用造成损失的风险
  const salt = (new Date()).getTime()
  const curtime = Math.round(new Date().getTime() / 1000)
  const from = 'zh-CHS'
  const to = 'en'
  const str1 = appKey + truncate(q) + salt + curtime + key

  const sign = sha256(str1).toString()
  const res = await axios({
    method: 'post',
    url: 'https://openapi.youdao.com/api',
    params: {
      q,
      appKey,
      salt,
      from,
      to,
      sign,
      signType: 'v3',
      curtime,
    },
  })
  return res.data.translation[0]
}

function truncate(q: string) {
  const len = q.length
  if (len <= 20)
    return q
  return q.substring(0, 10) + len + q.substring(len - 10, len)
}

async function generate(prompt: string, params: Array<string>): Promise<string> {
  const res = await axios.post('http://127.0.0.1:7861/sdapi/v1/txt2img', {
    steps: '30',
    width: 512 * (params.includes('-hd') ? 1.5 : 1),
    height: 640 * (params.includes('-hd') ? 1.5 : 1),
    cfg_scale: 10,
    sampler_index: 'DDIM',
    prompt: `${prompt}`,
    negative_prompt:
          `sketch, 3d, lowres, bad anatomy, bad hands, text, error, 
          missing fingers, extra digit, fewer digits, cropped, 
          worst quality, low quality, normal quality, jpeg artifacts, 
          signature, watermark, username, (blurry), artist name, monochrome,
           simple background, head out of frame, face, portrait, torso, 
           (out of focus), soft focus, feet out of frame, lower body, 
           upper body, close-up, extra breasts, umbrella,
          `,
  })
  return res.data.images[0]
}
