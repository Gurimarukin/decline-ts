import { either, eq, option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'

import { Accumulator, AccumulatorArgOut, AccumulatorMatch } from './Accumulator/index'
import { Command } from './Command'
import { Help } from './Help'
import { Opts } from './Opts'
import { Result } from './Result'
import { NonEmptyString } from './utils/fp'
import { StringUtils } from './utils/StringUtils'

const nonEmptyString = (str: string): Option<readonly [NonEmptyString, string]> =>
  StringUtils.isNonEmpty(str) ? option.some([str[0], str.substring(1)]) : option.none

const regex = {
  longOpt: /^--(.+)$/,
  longOptWithEquals: /^--(.+?)=(.+)$/,
  shortOpt: /^-(.+)$/,
}

export const longOpt: (str: string) => Option<string> = StringUtils.matcher1(regex.longOpt)
export const longOptWithEquals: (
  str: string,
) => Option<readonly [string, string]> = StringUtils.matcher2(regex.longOptWithEquals)
export const shortOpt: (str: string) => Option<readonly [string, string]> = flow(
  StringUtils.matcher1(regex.shortOpt),
  option.chain(nonEmptyString),
)

export type Parser<A> = (args: ReadonlyArray<string>) => Either<Help, A>

export const Parser = <A>(command: Command<A>): Parser<A> => {
  const help = Help.fromCommand(command)

  return args => consumeAll(args, Accumulator.fromOpts(command.opts))

  function failure<B>(...reasons: ReadonlyArray<string>): Either<Help, B> {
    return either.left(pipe(help, Help.withErrors(reasons)))
  }

  function evalResult<B>(out: Result<B>): Either<Help, B> {
    return pipe(
      out.get,
      either.fold(
        failed =>
          failure(...pipe(failed, Result.Failure.messages, readonlyArray.uniq(eq.eqString))),
        // NB: if any of the user-provided functions have side-effects, they will happen here!
        fn =>
          pipe(
            fn(),
            either.fold(
              messages => failure(...pipe(messages, readonlyArray.uniq(eq.eqString))),
              result => either.right(result),
            ),
          ),
      ),
    )
  }

  function toOption<B>(args: AccumulatorArgOut<B>): Option<Accumulator<B>> {
    return pipe(
      args,
      readonlyArray.filterMap(option.fromEither),
      readonlyNonEmptyArray.fromReadonlyArray,
      option.map(([head, ...tail]) => pipe(tail, readonlyArray.reduce(head, Accumulator.orElse))),
    )
  }

  function consumeAll(args: ReadonlyArray<string>, accumulator: Accumulator<A>): Either<Help, A> {
    const [arg, ...tail] = args

    if (arg === undefined) return evalResult(Accumulator.result(accumulator))

    return pipe(
      pipe(longOptWithEquals(arg), option.map(consumeLongOptWithEquals(tail, accumulator))),
      option.alt(() => pipe(longOpt(arg), option.map(consumeLongOpt(tail, accumulator)))),
      option.alt(() => (arg === '--' ? option.some(consumeArgs(tail, accumulator)) : option.none)),
      option.alt(() => pipe(shortOpt(arg), option.map(consumeShortOpt(tail, accumulator)))),
      option.getOrElse(() => consumeDefault(arg, tail, accumulator)),
    )
  }

  function consumeLongOptWithEquals(
    tail: ReadonlyArray<string>,
    accumulator: Accumulator<A>,
  ): (match: readonly [string, string]) => Either<Help, A> {
    return ([o, value]) =>
      pipe(
        accumulator,
        Accumulator.parseOption(Opts.Name.longName(o)),
        option.fold(
          () =>
            either.left(pipe(help, Help.withErrors(readonlyArray.of(`Unexpected option: --${o}`)))),
          AccumulatorMatch.fold({
            onFlag: () => failure(`Got unexpected value for flag: --${o}`),
            onOption: next => consumeAll(tail, next(value)),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${o}`),
          }),
        ),
      )
  }

  function consumeLongOpt(
    rest: ReadonlyArray<string>,
    accumulator: Accumulator<A>,
  ): (match: string) => Either<Help, A> {
    return o =>
      pipe(
        accumulator,
        Accumulator.parseOption(Opts.Name.longName(o)),
        option.fold(
          () =>
            either.left(pipe(help, Help.withErrors(readonlyArray.of(`Unexpected option: --${o}`)))),
          AccumulatorMatch.fold({
            onFlag: next => consumeAll(rest, next),
            onOption: next =>
              readonlyArray.isNonEmpty(rest)
                ? pipe(rest, ([h, ...t]) => consumeAll(t, next(h)))
                : failure(`Missing value for option: --${o}`),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${o}`),
          }),
        ),
      )
  }

  function consumeArgs(args: ReadonlyArray<string>, accumulator: Accumulator<A>): Either<Help, A> {
    const [arg, ...tail] = args

    if (arg === undefined) return evalResult(Accumulator.result(accumulator))

    return pipe(
      accumulator,
      Accumulator.parseArg(arg),
      toOption,
      option.fold(
        () => failure(`Unexpected argument: ${arg}`),
        next => consumeArgs(tail, next),
      ),
    )
  }

  function consumeShortOpt(
    rest: ReadonlyArray<string>,
    accumulator: Accumulator<A>,
  ): (match: readonly [string, string]) => Either<Help, A> {
    return ([flag, tail]) => {
      return pipe(
        consumeShort(flag, tail, accumulator),
        either.chain(([newRest, newAccumulator]) => consumeAll(newRest, newAccumulator)),
      )

      function consumeShort(
        char: string,
        tail2: string,
        accumulator2: Accumulator<A>,
      ): Either<Help, readonly [ReadonlyArray<string>, Accumulator<A>]> {
        return pipe(
          accumulator2,
          Accumulator.parseOption(Opts.Name.shortName(char)),
          option.fold(
            () =>
              either.left(
                pipe(help, Help.withErrors(readonlyArray.of(`Unexpected option: -${char}`))),
              ),
            AccumulatorMatch.fold({
              onFlag: next =>
                pipe(
                  nonEmptyString(tail2),
                  option.fold(
                    () =>
                      either.right([rest, next] as readonly [
                        ReadonlyArray<string>,
                        Accumulator<A>,
                      ]),
                    ([nextFlag, nextTail]) => consumeShort(nextFlag, nextTail, next),
                  ),
                ),
              onOption: next =>
                StringUtils.isEmpty(tail2)
                  ? pipe(
                      readonlyNonEmptyArray.fromReadonlyArray(rest),
                      option.fold(
                        () => failure(`Missing value for option: -${char}`),
                        ([v, ...r]) =>
                          either.right([r, next(v)] as readonly [
                            ReadonlyArray<string>,
                            Accumulator<A>,
                          ]),
                      ),
                    )
                  : either.right([rest, next(tail2)] as readonly [
                      ReadonlyArray<string>,
                      Accumulator<A>,
                    ]),
              onAmbiguous: () => failure(`Ambiguous option/flag: -${char}`),
            }),
          ),
        )
      }
    }
  }

  function consumeDefault(
    arg: string,
    tail: ReadonlyArray<string>,
    accumulator: Accumulator<A>,
  ): Either<Help, A> {
    return pipe(
      accumulator,
      Accumulator.parseSub(arg),
      option.fold(
        () =>
          pipe(
            accumulator,
            Accumulator.parseArg(arg),
            toOption,
            option.fold(
              () => failure(`Unexpected argument: ${arg}`),
              next => consumeAll(tail, next),
            ),
          ),
        result =>
          pipe(
            result(tail),
            either.mapLeft(Help.withPrefix(readonlyArray.of(command.name))),
            either.chain(evalResult),
          ),
      ),
    )
  }
}
