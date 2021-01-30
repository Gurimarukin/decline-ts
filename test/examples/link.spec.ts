/* eslint-disable no-shadow */
import { apply, either, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Command, Opts } from '../../src'

/**
 * Command type
 */
type Link = NoTargetDirectory | Target | TargetsToDirectory | TargetDirectory

type NoTargetDirectory = {
  readonly _tag: 'NoTargetDirectory'
  readonly target: string
  readonly link: string
}

type Target = {
  readonly _tag: 'Target'
  readonly target: string
}

type TargetsToDirectory = {
  readonly _tag: 'TargetsToDirectory'
  readonly targets: readonlyNonEmptyArray.ReadonlyNonEmptyArray<string>
  readonly directory: string
}

type TargetDirectory = {
  readonly _tag: 'TargetDirectory'
  readonly targetDirectory: string
  readonly targets: readonlyNonEmptyArray.ReadonlyNonEmptyArray<string>
}

const linkNoTargetDirectory = (target: string, link: string): NoTargetDirectory => ({
  _tag: 'NoTargetDirectory',
  target,
  link,
})
const linkTarget = (target: string): Target => ({ _tag: 'Target', target })
const linkTargetsToDirectory = (
  targets: readonlyNonEmptyArray.ReadonlyNonEmptyArray<string>,
  directory: string,
): TargetsToDirectory => ({ _tag: 'TargetsToDirectory', targets, directory })
const linkTargetDirectory = (
  targetDirectory: string,
  targets: readonlyNonEmptyArray.ReadonlyNonEmptyArray<string>,
): TargetDirectory => ({ _tag: 'TargetDirectory', targetDirectory, targets })

/**
 * Command
 */
const target = Opts.argument(either.right)('target')
const linkName = Opts.argument(either.right)('link name')
const targets = Opts.arguments_(either.right)('targets')
const directory = Opts.argument(either.right)('directory')

const firstOpts: Opts<Link> = (() => {
  const nonDirectory = pipe(
    Opts.flag({ long: 'no-target-directory', short: 'T', help: '...' }),
    Opts.orFalse,
  )
  return pipe(
    apply.sequenceT(Opts.opts)(nonDirectory, target, linkName),
    Opts.map(([, target, link]) => linkNoTargetDirectory(target, link)),
  )
})()

const secondOpts: Opts<Link> = pipe(target, Opts.map(linkTarget))

const thirdOpts: Opts<Link> = pipe(
  apply.sequenceT(Opts.opts)(targets, directory),
  Opts.map(([targets, dir]) => linkTargetsToDirectory(targets, dir)),
)

const fourthOpts: Opts<Link> = (() => {
  const isDirectory = Opts.option(either.right)({
    long: 'target-directory',
    short: 't',
    help: '...',
    metavar: 'path',
  })
  return pipe(
    apply.sequenceT(Opts.opts)(isDirectory, targets),
    Opts.map(([dir, targets]) => linkTargetDirectory(dir, targets)),
  )
})()

const link = Command({
  name: 'ln',
  header: 'Create links. (Used for testing complex alternative usages.)',
})(
  pipe(
    firstOpts,
    Opts.alt(() => secondOpts),
    Opts.alt(() => thirdOpts),
    Opts.alt(() => fourthOpts),
  ),
)

/**
 * Tests
 */
describe('link', () => {
  it('should parse command', () => {
    expect(Command.parse(['--no-target-directory', 'target', 'linkName'])(link)).toStrictEqual(
      either.right(linkNoTargetDirectory('target', 'linkName')),
    )
    expect(Command.parse(['target', '-T', 'linkName'])(link)).toStrictEqual(
      either.right(linkNoTargetDirectory('target', 'linkName')),
    )
    expect(Command.parse(['target', 'linkName'])(link)).toStrictEqual(
      either.right(linkNoTargetDirectory('target', 'linkName')),
    )

    expect(Command.parse(['target'])(link)).toStrictEqual(either.right(linkTarget('target')))

    expect(Command.parse(['target1', 'target2', 'directory'])(link)).toStrictEqual(
      either.right(linkTargetsToDirectory(['target1', 'target2'], 'directory')),
    )
    expect(Command.parse(['target1', 'target2', 'target3', 'directory'])(link)).toStrictEqual(
      either.right(linkTargetsToDirectory(['target1', 'target2', 'target3'], 'directory')),
    )

    expect(Command.parse(['--target-directory', 'directory', 'target'])(link)).toStrictEqual(
      either.right(linkTargetDirectory('directory', ['target'])),
    )
    expect(Command.parse(['-t', 'directory', 'target1', 'target2'])(link)).toStrictEqual(
      either.right(linkTargetDirectory('directory', ['target1', 'target2'])),
    )
  })
})
