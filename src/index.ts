/* eslint-disable no-console */
import type { GroupMessageEvent, PrivateMessageEvent } from 'oicq'
import { createClient } from 'oicq'
import axios from 'axios'
import sha256 from 'crypto-js/sha256'
import { encode } from 'node-base64-image'
import type { ProbeResult } from 'probe-image-size'
import probe from 'probe-image-size'

const account = 3558195590
const client = createClient(account)
// const messageList = [] as string[]
const options = {
  string: true,
  headers: {
    'User-Agent': 'my-app',
  },
}
const MAX_LENGTH = 720
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
  await reply(e)
  // if (rep !== undefined) {
  //   messageList.push(rep.message_id)
  //   setTimeout(() => {
  //     if (messageList.length === 0)
  //       return
  //     const group = client.pickGroup((e as GroupMessageEvent).group.gid)
  //     group.recallMsg(messageList[0])
  //     messageList.shift()
  //   }, 60000)
  // }
})

client.on('message.private', async (_) => {
  // console.log(e.raw_message)
  // reply(e)
})

async function reply(e: PrivateMessageEvent | GroupMessageEvent) {
  const result = await processMessage(e.raw_message)
  if (result.remaining) {
    let base64
    console.log(result.remaining)
    if (e.message[1] && e.message[1].type === 'image' && e.message[1].url) {
      e.reply(`妈妈正在以图生图：${result.remaining}`, true)
      try {
        base64 = await generateFromImg(result.remaining, result.params, e.message[1].url)
      }
      catch (err) {
        e.reply('生成失败，可能是因为使用的转发图片')
        return
      }
    }
    else {
      try {
        e.reply(`妈妈正在生成图片：${result.remaining}`, true)

        base64 = await generate(result.remaining, result.params)
      }
      catch {
        e.reply('生成失败，妈妈也不知道为什么')
        return
      }
    }
    // base64 = await generate(result.remaining, result.params)

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

  const pattern = /^(sdA|sdT)\s+((?:-[\w\.]+\s?)*)?([^\[]+)?/
  const match = pattern.exec(string)
  if (match && match[3]) {
    result.prefix = match[1]
    result.params = match[2] ? match[2].split(' ') : []
    result.remaining = match[1] === 'sdA' ? match[3] : await translate(match[3])
  }
  return result
}

async function translate(q: string): Promise<string> {
  const appKey = '5dc121139f08a9d4'
  const key = 'S3M5eTuloS4XH7njeyZcM0X7JcCsAcaU'// 替换为你的有道api key
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

async function generate(prompt: string, _: Array<string>): Promise<string> {
  const res = await axios.post('http://127.0.0.1:7861/sdapi/v1/txt2img', {
    steps: '20',
    width: 512,
    height: 640,
    cfg_scale: 8,
    sampler_index: 'DPM++ SDE Karras',
    prompt: `masterpiece, best quality, ultra-detailed, illustration,${prompt}`,
    enable_hr: true,
    denoising_strength: 0.5,
    hr_scale: 1.8,
    hr_second_pass_steps: 20,
    hr_upscaler: 'Latent (nearest-exact)',
    negative_prompt:
    `nsfw,(worst quality, low quality:1.4),logo,text
    `,
  })
  return res.data.images[0]
}

async function generateFromImg(prompt: string, params: Array<string>, imgurl: string) {
  const image64 = await encode(imgurl, options) as string
  const img = await probe(imgurl)
  const resImg = resizeImg(img)
  const res = await axios.post('http://127.0.0.1:7861/sdapi/v1/img2img', {
    steps: '50',
    width: resImg.width,
    height: resImg.height,
    resize_mode: 1,
    cfg_scale: 21,
    denoising_strength: getParamsValue(params, '-den') !== undefined ? Math.min(Math.max(parseFloat(getParamsValue(params, '-den')!), 0), 1) : 0.55,
    sampler_index: 'DPM++ SDE Karras',
    prompt: `${prompt}`,
    init_images: [
      image64,
    ],
    negative_prompt:
          `nsfw,(worst quality, low quality:1.4),logo,text
          `,
  })
  return res.data.images[0]
}

function getParamsValue(params: Array<string>, prifix: string) {
  const found = params.find(str => str.includes(prifix))

  if (found) {
    const value = found.split(prifix)[1]
    return value !== '' ? value : undefined// "1" or "2"
  }
}

function resizeImg(img: ProbeResult) {
  let width = img.width
  let height = img.height
  let ratio
  if (width > height) {
    if (width > MAX_LENGTH) {
      ratio = MAX_LENGTH / width
      width = MAX_LENGTH
      height = height * ratio
    }
  }
  else {
    if (height > MAX_LENGTH) {
      ratio = MAX_LENGTH / height
      height = MAX_LENGTH
      width = width * ratio
    }
  }
  img.width = width
  img.height = height
  return img
}

