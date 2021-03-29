import { apply, eq, option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'
import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

import { Command } from './Command'
import { Opts } from './Opts'
import { Usage } from './Usage'
import { StringUtils, s } from './utils/StringUtils'

export type Help = {
  readonly errors: ReadonlyArray<string>
  readonly prefix: ReadonlyNonEmptyArray<string>
  readonly usage: ReadonlyArray<string>
  readonly body: ReadonlyArray<string>
}

export namespace Help {
  /**
   * Constructors
   */
  export const fromCommand = (parser: Command<unknown>): Help => {
    const commands = commandList(parser.opts)

    const commandHelp = readonlyArray.isEmpty(commands)
      ? readonlyArray.empty
      : pipe(
          commands,
          readonlyArray.chain(command => [
            withIndent(4, command.name),
            withIndent(8, command.header),
          ]),
          texts =>
            pipe(
              readonlyArray.cons('Subcommands:', texts),
              StringUtils.mkString('\n'),
              readonlyArray.of,
            ),
        )

    const optionsDetail = detail(parser.opts)
    const optionsHelp = readonlyArray.isEmpty(optionsDetail)
      ? readonlyArray.empty
      : pipe(
          readonlyArray.cons('Options:', optionsDetail),
          StringUtils.mkString('\n'),
          readonlyArray.of,
        )

    return {
      errors: readonlyArray.empty,
      prefix: readonlyNonEmptyArray.of(parser.name),
      usage: pipe(parser.opts, Usage.fromOpts, readonlyArray.chain(Usage.show)),
      body: readonlyArray.cons(parser.header, [...optionsHelp, ...commandHelp]),
    }
  }

  /**
   * Methods
   */
  export const withErrors = (moreErrors: ReadonlyArray<string>) => (help: Help): Help => ({
    ...help,
    errors: [...help.errors, ...moreErrors],
  })

  export const withPrefix = (prefix: ReadonlyArray<string>) => (help: Help): Help => ({
    ...help,
    prefix: pipe(prefix, readonlyArray.reduceRight(help.prefix, readonlyNonEmptyArray.cons)),
  })

  export const stringify = (help: Help): string => {
    const maybeErrors = readonlyArray.isEmpty(help.errors)
      ? readonlyArray.empty
      : pipe(help.errors, StringUtils.mkString('\n'), readonlyArray.of)
    const prefixString = pipe(help.prefix, StringUtils.mkString(' '))
    const usageString = readonlyArray.isEmpty(help.usage)
      ? s`Usage: ${prefixString}`
      : help.usage.length === 1
      ? s`Usage: ${prefixString} ${help.usage[0] as string}` // TODO: cast bad.
      : pipe(
          readonlyArray.cons('Usage:', help.usage),
          StringUtils.mkString(s`\n    ${prefixString} `),
        )

    return pipe(
      [...maybeErrors, ...readonlyArray.cons(usageString, help.body)],
      StringUtils.mkString('\n\n'),
    )
  }
}

const optionList = (
  opts: Opts<unknown>,
): Option<ReadonlyArray<readonly [Opts.Opt<unknown>, boolean]>> => {
  switch (opts._tag) {
    case 'Pure':
      return option.some(readonlyArray.empty)

    case 'App':
      return pipe(
        apply.sequenceT(option.option)(optionList(opts.f), optionList(opts.a)),
        option.map(([a, b]) => [...a, ...b]),
      )

    case 'OrElse':
      const b = optionList(opts.b)
      return pipe(
        optionList(opts.a),
        option.map(a =>
          pipe(
            b,
            option.fold(
              () => a,
              _ => [...a, ..._],
            ),
          ),
        ),
        option.alt(() => b),
      )

    case 'Single':
      return option.some(readonlyArray.of([opts.opt, false]))

    case 'Repeated':
      return option.some(readonlyArray.of([opts.opt, true]))

    case 'Subcommand':
      return option.some(readonlyArray.empty)

    case 'Validate':
      return optionList(opts.value)

    case 'HelpFlag':
      return optionList(opts.flag)
  }
}

const commandList = (opts: Opts<unknown>): ReadonlyArray<Command<unknown>> => {
  switch (opts._tag) {
    case 'App':
      return [...commandList(opts.f), ...commandList(opts.a)]

    case 'OrElse':
      return [...commandList(opts.a), ...commandList(opts.b)]

    case 'Subcommand':
      return readonlyArray.of(opts.command)

    case 'Validate':
      return commandList(opts.value)

    default:
      return readonlyArray.empty
  }
}

const getOptBooleanTupleEq = <A>(): eq.Eq<readonly [Opts.Opt<A>, boolean]> =>
  eq.getTupleEq(Opts.Opt.eq(), eq.eqBoolean) as eq.Eq<readonly [Opts.Opt<A>, boolean]>

const detail = (opts: Opts<unknown>): ReadonlyArray<string> =>
  pipe(
    optionList(opts),
    option.getOrElse<ReadonlyArray<readonly [Opts.Opt<unknown>, boolean]>>(
      () => readonlyArray.empty,
    ),
    readonlyArray.uniq(getOptBooleanTupleEq()),
    readonlyArray.chain(
      // ([opt, _]) =>
      //   if (opt._tag === 'Regular') TODO
      //   if (opt._tag === 'Flag') TODO
      () => readonlyArray.empty,
    ),
  )

const withIndent = (indent: number, str: string): string =>
  pipe(
    str.split('\n'),
    readonlyArray.map(_ => s`${' '.repeat(indent)}${_}`),
    StringUtils.mkString('\n'),
  )
