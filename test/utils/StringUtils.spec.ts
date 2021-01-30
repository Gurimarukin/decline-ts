import { Maybe } from '../../src/utils/fp'
import { StringUtils, s } from '../../src/utils/StringUtils'

describe('s', () => {
  it('should work', () => {
    expect(s``).toStrictEqual('')
    expect(s`adedigado`).toStrictEqual('adedigado')
    expect(s`${'adedi'}gado`).toStrictEqual('adedigado')
    expect(s`adedi${'gado'}`).toStrictEqual('adedigado')
    expect(s`ade${'diga'}do`).toStrictEqual('adedigado')
    expect(s`${'ad'}ediga${'do'}`).toStrictEqual('adedigado')
  })
})

describe('StringUtils.matcher2', () => {
  it('should return two groups', () => {
    expect(StringUtils.matcher2(/^(\S+)\s+(\S+)$/)('some string')).toStrictEqual(
      Maybe.some(['some', 'string']),
    )
  })

  it('should fail for regex with one group', () => {
    expect(StringUtils.matcher2(/^(.*)$/)('some string')).toStrictEqual(Maybe.none)
  })
})
