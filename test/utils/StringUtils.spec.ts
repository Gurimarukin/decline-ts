import { option } from 'fp-ts'

import { StringUtils } from '../../src/utils/StringUtils'

describe('StringUtils.matcher2', () => {
  it('should return two groups', () => {
    expect(StringUtils.matcher2(/^(\S+)\s+(\S+)$/)('some string')).toStrictEqual(
      option.some(['some', 'string']),
    )
  })

  it('should fail for regex with one group', () => {
    expect(StringUtils.matcher2(/^(.*)$/)('some string')).toStrictEqual(option.none)
  })
})
