import { describe, it } from 'vitest'

describe('should', () => {
  it('exported', () => {
    const str = 'sdTrans -hd asc'
    const pattern = /^(sdAI|sdTrans)\s+((?:-\w+\s?)*)?(.+)?$/
    const match = pattern.exec(str)
    console.log(match)
  })
})
