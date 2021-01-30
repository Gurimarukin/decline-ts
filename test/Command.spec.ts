import { either } from 'fp-ts'

import { Command, Opts } from '../src'

const cmd = Command({ name: 'cmd', header: 'A command.' })(Opts.argument(either.right)('file'))

describe('Command', () => {
  it('should parse argument', () => {
    expect(Command.parse(['foo-bar'])(cmd)).toStrictEqual(either.right('foo-bar'))
  })
})
