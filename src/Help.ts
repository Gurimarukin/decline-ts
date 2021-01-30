import { apply, eq } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Command } from './Command'
import { Opts } from './Opts'
import { Usage } from './Usage'
import { List, Maybe, NonEmptyArray, Tuple } from './utils/fp'
import { StringUtils } from './utils/StringUtils'

export type Help = {
  readonly errors: List<string>
  readonly prefix: NonEmptyArray<string>
  readonly usage: List<string>
  readonly body: List<string>
}

export namespace Help {
  /**
   * Constructors
   */
  export const fromCommand = (parser: Command<unknown>): Help => {
    const commands = commandList(parser.opts)

    const commandHelp = List.isEmpty(commands)
      ? List.empty
      : pipe(
          commands,
          List.chain(command => [withIndent(4, command.name), withIndent(8, command.header)]),
          texts => pipe(List.cons('Subcommands:', texts), StringUtils.mkString('\n'), List.of),
        )

    const optionsDetail = detail(parser.opts)
    const optionsHelp = List.isEmpty(optionsDetail)
      ? List.empty
      : pipe(List.cons('Options:', optionsDetail), StringUtils.mkString('\n'), List.of)

    return {
      errors: List.empty,
      prefix: NonEmptyArray.of(parser.name),
      usage: pipe(Usage.fromOpts(parser.opts), List.chain(Usage.show)),
      body: List.cons(parser.header, List.concat(optionsHelp, commandHelp)),
    }
  }

  /**
   * Methods
   */
  export const withErrors = (moreErrors: List<string>) => (help: Help): Help => ({
    ...help,
    errors: List.concat(help.errors, moreErrors),
  })

  export const withPrefix = (prefix: List<string>) => (help: Help): Help => ({
    ...help,
    prefix: pipe(prefix, List.reduceRight(help.prefix, NonEmptyArray.cons)),
  })

  export const stringify = (help: Help): string => {
    const maybeErrors = List.isEmpty(help.errors)
      ? List.empty
      : pipe(help.errors, StringUtils.mkString('\n'), List.of)
    const prefixString = pipe(help.prefix, StringUtils.mkString(' '))
    const usageString = List.isEmpty(help.usage)
      ? `Usage: ${prefixString}`
      : help.usage.length === 1
      ? `Usage: ${prefixString} ${help.usage[0]}`
      : pipe(List.cons('Usage:', help.usage), StringUtils.mkString(`\n    ${prefixString} `))

    return pipe(
      List.concat(maybeErrors, List.cons(usageString, help.body)),
      StringUtils.mkString('\n\n'),
    )
  }
}

const optionList = (opts: Opts<unknown>): Maybe<List<Tuple<Opts.Opt<unknown>, boolean>>> => {
  switch (opts._tag) {
    case 'Pure':
      return Maybe.some(List.empty)

    case 'App':
      return pipe(
        apply.sequenceT(Maybe.option)(optionList(opts.f), optionList(opts.a)),
        Maybe.map(([a, b]) => List.concat(a, b)),
      )

    case 'OrElse':
      const b = optionList(opts.b)
      return pipe(
        optionList(opts.a),
        Maybe.map(a =>
          pipe(
            b,
            Maybe.fold(
              () => a,
              _ => List.concat(a, _),
            ),
          ),
        ),
        Maybe.alt(() => b),
      )

    case 'Single':
      return Maybe.some(List.of([opts.opt, false]))

    case 'Repeated':
      return Maybe.some(List.of([opts.opt, true]))

    case 'Subcommand':
      return Maybe.some(List.empty)

    case 'Validate':
      return optionList(opts.value)

    case 'HelpFlag':
      return optionList(opts.flag)
  }
}

const commandList = (opts: Opts<unknown>): List<Command<unknown>> => {
  switch (opts._tag) {
    case 'App':
      return List.concat(commandList(opts.f), commandList(opts.a))

    case 'OrElse':
      return List.concat(commandList(opts.a), commandList(opts.b))

    case 'Subcommand':
      return List.of(opts.command)

    case 'Validate':
      return commandList(opts.value)

    default:
      return List.empty
  }
}

const getOptBooleanTupleEq = <A>(): eq.Eq<Tuple<Opts.Opt<A>, boolean>> =>
  eq.getTupleEq(Opts.Opt.eq(), eq.eqBoolean) as eq.Eq<Tuple<Opts.Opt<A>, boolean>>

const detail = (opts: Opts<unknown>): List<string> =>
  pipe(
    optionList(opts),
    Maybe.getOrElse<List<Tuple<Opts.Opt<unknown>, boolean>>>(() => List.empty),
    List.uniq(getOptBooleanTupleEq()),
    List.chain(
      // ([opt, _]) =>
      //   if (opt._tag === 'Regular') TODO
      //   if (opt._tag === 'Flag') TODO
      () => List.empty,
    ),
  )

const withIndent = (indent: number, str: string): string =>
  pipe(
    str.split('\n'),
    List.map(_ => `${' '.repeat(indent)}${_}`),
    StringUtils.mkString('\n'),
  )
