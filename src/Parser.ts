import { eq } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Accumulator, AccumulatorArgOut, AccumulatorMatch } from './Accumulator/index'
import { Command } from './Command'
import { Help } from './Help'
import { Opts } from './Opts'
import { Result } from './Result'
import { Either, List, Maybe, NonEmptyArray, NonEmptyString, Tuple } from './utils/fp'
import { StringUtils } from './utils/StringUtils'

const nonEmptyString = (str: string): Maybe<Tuple<NonEmptyString, string>> =>
  StringUtils.isNonEmpty(str) ? Maybe.some([str[0], str.substring(1)]) : Maybe.none

export const longOpt: (str: string) => Maybe<string> = StringUtils.matcher1(/--(.+)/)
export const longOptWithEquals: (
  str: string,
) => Maybe<Tuple<string, string>> = StringUtils.matcher2(/--(.+?)=(.+)/)
export const shortOpt: (str: string) => Maybe<Tuple<string, string>> = flow(
  StringUtils.matcher1(/-(.+)/),
  Maybe.chain(nonEmptyString),
)

export type Parser<A> = (args: List<string>) => Either<Help, A>

export const Parser = <A>(command: Command<A>): Parser<A> => {
  const help = Help.fromCommand(command)

  return args => consumeAll(args, Accumulator.fromOpts(command.opts))

  function failure<B>(...reasons: List<string>): Either<Help, B> {
    return Either.left(pipe(help, Help.withErrors(reasons)))
  }

  function evalResult<B>(out: Result<B>): Either<Help, B> {
    return pipe(
      out.get,
      Either.fold(
        failed => failure(...pipe(failed, Result.Failure.messages, List.uniq(eq.eqString))),
        // NB: if any of the user-provided functions have side-effects, they will happen here!
        fn =>
          pipe(
            fn(),
            Either.fold(
              messages => failure(...pipe(messages, List.uniq(eq.eqString))),
              result => Either.right(result),
            ),
          ),
      ),
    )
  }

  function toOption<B>(args: AccumulatorArgOut<B>): Maybe<Accumulator<B>> {
    return pipe(
      args,
      List.filterMap(Maybe.fromEither),
      NonEmptyArray.fromReadonlyArray,
      Maybe.map(([head, ...tail]) => pipe(tail, List.reduce(head, Accumulator.orElse))),
    )
  }

  function consumeAll(args: List<string>, accumulator: Accumulator<A>): Either<Help, A> {
    const [arg, ...tail] = args

    if (arg === undefined) return evalResult(Accumulator.result(accumulator))

    return pipe(
      pipe(longOptWithEquals(arg), Maybe.map(consumeLongOptWithEquals(tail, accumulator))),
      Maybe.alt(() => pipe(longOpt(arg), Maybe.map(consumeLongOpt(tail, accumulator)))),
      Maybe.alt(() => (arg === '--' ? Maybe.some(consumeArgs(tail, accumulator)) : Maybe.none)),
      Maybe.alt(() => pipe(shortOpt(arg), Maybe.map(consumeShortOpt(tail, accumulator)))),
      Maybe.getOrElse(() => consumeDefault(arg, tail, accumulator)),
    )
  }

  function consumeLongOptWithEquals(
    tail: List<string>,
    accumulator: Accumulator<A>,
  ): (match: Tuple<string, string>) => Either<Help, A> {
    return ([option, value]) =>
      pipe(
        accumulator,
        Accumulator.parseOption(Opts.Name.longName(option)),
        Maybe.fold(
          () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: --${option}`)))),
          AccumulatorMatch.fold({
            onFlag: () => failure(`Got unexpected value for flag: --${option}`),
            onOption: next => consumeAll(tail, next(value)),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${option}`),
          }),
        ),
      )
  }

  function consumeLongOpt(
    rest: List<string>,
    accumulator: Accumulator<A>,
  ): (match: string) => Either<Help, A> {
    return option =>
      pipe(
        accumulator,
        Accumulator.parseOption(Opts.Name.longName(option)),
        Maybe.fold(
          () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: --${option}`)))),
          AccumulatorMatch.fold({
            onFlag: next => consumeAll(rest, next),
            onOption: next =>
              List.isNonEmpty(rest)
                ? pipe(rest, ([h, ...t]) => consumeAll(t, next(h)))
                : failure(`Missing value for option: --${option}`),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${option}`),
          }),
        ),
      )
  }

  function consumeArgs(args: List<string>, accumulator: Accumulator<A>): Either<Help, A> {
    const [arg, ...tail] = args

    if (arg === undefined) return evalResult(Accumulator.result(accumulator))

    return pipe(
      accumulator,
      Accumulator.parseArg(arg),
      toOption,
      Maybe.fold(
        () => failure(`Unexpected argument: ${arg}`),
        next => consumeArgs(tail, next),
      ),
    )
  }

  function consumeShortOpt(
    rest: List<string>,
    accumulator: Accumulator<A>,
  ): (match: Tuple<string, string>) => Either<Help, A> {
    return ([flag, tail]) => {
      return pipe(
        consumeShort(flag, tail, accumulator),
        Either.chain(([newRest, newAccumulator]) => consumeAll(newRest, newAccumulator)),
      )

      function consumeShort(
        char: string,
        tail2: string,
        accumulator2: Accumulator<A>,
      ): Either<Help, Tuple<List<string>, Accumulator<A>>> {
        return pipe(
          accumulator2,
          Accumulator.parseOption(Opts.Name.shortName(char)),
          Maybe.fold(
            () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: -${char}`)))),
            AccumulatorMatch.fold({
              onFlag: next =>
                pipe(
                  nonEmptyString(tail2),
                  Maybe.fold(
                    () => Either.right([rest, next] as Tuple<List<string>, Accumulator<A>>),
                    ([nextFlag, nextTail]) => consumeShort(nextFlag, nextTail, next),
                  ),
                ),
              onOption: next =>
                StringUtils.isEmpty(tail2)
                  ? pipe(
                      NonEmptyArray.fromReadonlyArray(rest),
                      Maybe.fold(
                        () => failure(`Missing value for option: -${char}`),
                        ([v, ...r]) =>
                          Either.right([r, next(v)] as Tuple<List<string>, Accumulator<A>>),
                      ),
                    )
                  : Either.right([rest, next(tail2)] as Tuple<List<string>, Accumulator<A>>),
              onAmbiguous: () => failure(`Ambiguous option/flag: -${char}`),
            }),
          ),
        )
      }
    }
  }

  function consumeDefault(
    arg: string,
    tail: List<string>,
    accumulator: Accumulator<A>,
  ): Either<Help, A> {
    return pipe(
      accumulator,
      Accumulator.parseSub(arg),
      Maybe.fold(
        () =>
          pipe(
            accumulator,
            Accumulator.parseArg(arg),
            toOption,
            Maybe.fold(
              () => failure(`Unexpected argument: ${arg}`),
              next => consumeAll(tail, next),
            ),
          ),
        result =>
          pipe(
            result(tail),
            Either.mapLeft(Help.withPrefix(List.of(command.name))),
            Either.chain(evalResult),
          ),
      ),
    )
  }
}
