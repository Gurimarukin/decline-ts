import { apply, either, option } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Command, Opts } from '../../src'
import { StringUtils } from '../../src/utils/StringUtils'

/**
 * Command parsing type
 */
type Git = Status | Commit

type Status = {
  readonly _tag: 'Status'
}

type Commit = {
  readonly _tag: 'Commit'
  readonly all: boolean
  readonly message: option.Option<string>
}

const gitStatus: Status = { _tag: 'Status' }
const gitCommit = (all: boolean, message: option.Option<string>): Commit => ({
  _tag: 'Commit',
  all,
  message,
})

/**
 * Command
 */
const statusOpts: Opts<Git> = Opts.subcommand({ name: 'status', header: 'Print status!' })(
  Opts.pure(gitStatus),
)

const commitOpts: Opts<Git> = Opts.subcommand({ name: 'commit', header: 'Commit!' })(
  (() => {
    const all = pipe(Opts.flag({ long: 'all', short: 'a', help: 'All files.' }), Opts.orFalse)
    const message = pipe(
      Opts.option(either.right)({
        long: 'message',
        short: 'm',
        help: 'Commit message',
        metavar: 'message',
      }),
      Opts.orNone,
    )
    return pipe(
      apply.sequenceT(Opts.opts)(all, message),
      Opts.map(([a, m]) => gitCommit(a, m)),
    )
  })(),
)

const helpOpts: Opts<Git> = pipe(
  Opts.subcommand({ name: 'help', header: 'Print the main help text and exit.' })(Opts.unit),
  Opts.asHelp,
)

const git = Command({ name: 'git', header: 'Test app for git-style subcommands.' })(
  pipe(
    statusOpts,
    Opts.alt(() => commitOpts),
    Opts.alt(() => helpOpts),
  ),
)

/**
 * Tests
 */
describe('git', () => {
  it('should parse command', () => {
    // status
    expect(Command.parse(['status'])(git)).toStrictEqual(either.right(gitStatus))

    // commit
    expect(Command.parse(['commit'])(git)).toStrictEqual(
      either.right(gitCommit(false, option.none)),
    )

    expect(Command.parse(['commit', '--all'])(git)).toStrictEqual(
      either.right(gitCommit(true, option.none)),
    )
    expect(Command.parse(['commit', '-a'])(git)).toStrictEqual(
      either.right(gitCommit(true, option.none)),
    )

    expect(Command.parse(['commit', '--message', 'adedigado'])(git)).toStrictEqual(
      either.right(gitCommit(false, option.some('adedigado'))),
    )
    expect(Command.parse(['commit', '-m', 'adedigado'])(git)).toStrictEqual(
      either.right(gitCommit(false, option.some('adedigado'))),
    )

    expect(Command.parse(['commit', '-am', 'adedigado'])(git)).toStrictEqual(
      either.right(gitCommit(true, option.some('adedigado'))),
    )
    expect(Command.parse(['commit', '-a', '--message', 'Commit message'])(git)).toStrictEqual(
      either.right(gitCommit(true, option.some('Commit message'))),
    )
  })

  it('should fail', () => {
    // help
    expect(Command.parse(['help'])(git)).toStrictEqual(
      either.left(
        StringUtils.stripMargins(
          `Usage:
          |    git status
          |    git commit
          |    git help
          |
          |Test app for git-style subcommands.
          |
          |Subcommands:
          |    status
          |        Print status!
          |    commit
          |        Commit!`,
        ),
      ),
    )
  })
})
