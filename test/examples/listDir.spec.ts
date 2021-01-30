import { apply, either } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { Command, Opts } from '../../src'
import { decoderToDecode } from '../../src/utils'

const Color = { decoder: D.union(D.literal('always'), D.literal('auto'), D.literal('never')) }
type Color = D.TypeOf<typeof Color.decoder>

const color = pipe(
  Opts.option(decoderToDecode(Color.decoder))({
    long: 'color',
    metavar: 'when',
    help: "Colorize the output: 'always', 'auto', or 'never'",
  }),
  Opts.withDefault<Color>(() => 'always'),
)

const all = pipe(
  Opts.flag({ long: 'all', short: 'a', help: 'Do not ignore hidden files.' }),
  Opts.orFalse,
)

const directory = pipe(Opts.argumentS(either.right)('directory'), Opts.orEmpty)

const listDir = Command({ name: 'ls', header: 'List information about files.' })(
  apply.sequenceT(Opts.opts)(color, all, directory),
)

describe('listDir', () => {
  it('should parse command', () => {
    expect(Command.parse([])(listDir)).toStrictEqual(either.right(['always', false, []]))

    expect(Command.parse(['--color', 'auto'])(listDir)).toStrictEqual(
      either.right(['auto', false, []]),
    )
    expect(Command.parse(['--color', 'never'])(listDir)).toStrictEqual(
      either.right(['never', false, []]),
    )

    expect(Command.parse(['--all'])(listDir)).toStrictEqual(either.right(['always', true, []]))
    expect(Command.parse(['-a'])(listDir)).toStrictEqual(either.right(['always', true, []]))

    expect(Command.parse(['dir'])(listDir)).toStrictEqual(either.right(['always', false, ['dir']]))
    expect(Command.parse(['dir1', 'dir2'])(listDir)).toStrictEqual(
      either.right(['always', false, ['dir1', 'dir2']]),
    )

    expect(
      Command.parse(['dir1', '--color', 'auto', 'dir2', '--all', 'dir3'])(listDir),
    ).toStrictEqual(either.right(['auto', true, ['dir1', 'dir2', 'dir3']]))
  })
})
