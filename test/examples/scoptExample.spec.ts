/* eslint-disable no-shadow */
import { apply, either } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as t from 'io-ts'

import { Command, Opts } from '../../src'
import { typeToDecode } from '../../src/utils'
import { StringUtils } from '../../src/utils/StringUtils'

const foo = pipe(
  Opts.option(typeToDecode(t.number))({
    long: 'foo',
    short: 'f',
    help: 'Optional int!',
    metavar: 'int',
  }),
  Opts.withDefault(() => -1),
)

const out = Opts.option(either.right)({
  long: 'out',
  short: 'o',
  help: 'Required path!',
  metavar: 'path',
})

const libMax = (() => {
  const libname = Opts.option(either.right)({
    long: 'libname',
    help: 'Lib name to limit.',
    metavar: 'string',
  })
  const max = Opts.option(typeToDecode(t.number))({
    long: 'max',
    help: 'Limit for --libname option.',
    metavar: 'int',
  })
  return pipe(
    apply.sequenceT(Opts.opts)(libname, max),
    Opts.map(([libname, max]) => ({ libname, max })),
    Opts.orNone,
  )
})()

const jars = pipe(
  Opts.options(either.right)({
    long: 'jar',
    short: 'j',
    help: 'Jar to include! More args, more jars.',
    metavar: 'path',
  }),
  Opts.orEmpty,
)

// SKIPPED: kwargs

const verbose = pipe(Opts.flag({ long: 'verbos', help: 'Verbose?' }), Opts.orFalse)

const debug = pipe(
  Opts.flag({ long: 'debug', help: 'Debug mode: shows in full list, not in usage.' }),
  Opts.orFalse,
)

const files = pipe(Opts.arguments_(either.right)('file'), Opts.orEmpty)

const update = Opts.subcommand({
  name: 'update',
  header: 'A command! This is the command help text.',
})(
  (() => {
    const keepalive = pipe(
      Opts.flag({ long: 'not-keepalive', help: 'Disable keepalive?' }),
      Opts.map(() => false),
      Opts.withDefault(() => true),
    )
    const xyz = pipe(Opts.flag({ long: 'xyz', help: 'Boolean prop?' }), Opts.orFalse)
    // SKIPPED: xyz as boolean, not flag
    return pipe(
      apply.sequenceT(Opts.opts)(keepalive, xyz),
      Opts.validate("Can't both keepalive and xyz!")(([keepalive, xyz]) => !(keepalive && xyz)),
      Opts.map(([keepalive, xyz]) => ({ keepalive, xyz })),
    )
  })(),
)

const scoptExample = Command({
  name: 'scopt-example',
  header: 'Taken after the example in the scopt readme.',
})(
  pipe(
    apply.sequenceT(Opts.opts)(foo, out, libMax, jars, verbose, debug, files, update),
    Opts.map(([foo, out, libMax, jars, verbose, debug, files, update]) => ({
      foo,
      out,
      libMax,
      jars,
      verbose,
      debug,
      files,
      update,
    })),
  ),
)

describe('scoptExample', () => {
  it('should fail', () => {
    expect(Command.parse(['update', 'stuff'])(scoptExample)).toStrictEqual(
      either.left(
        StringUtils.stripMargins(
          `Unexpected argument: stuff
          |
          |Usage: scopt-example update [--not-keepalive] [--xyz]
          |
          |A command! This is the command help text.`,
        ),
      ),
    )
  })
})
