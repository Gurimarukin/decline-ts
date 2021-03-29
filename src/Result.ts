import { alt as Alt, semigroup as Semigroup, apply, either, eq, option, readonlyArray } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { Lazy, flow, pipe } from 'fp-ts/function'

import { Opts } from './Opts'
import { StringUtils } from './utils/StringUtils'

const URI_ = 'Result'
type URI_ = typeof URI_

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line functional/prefer-type-literal
  interface URItoKind<A> {
    readonly [URI_]: Result<A>
  }
}

export type Result<A> = {
  readonly get: Either<Result.Failure, Lazy<Either<ReadonlyArray<string>, A>>>
}

export function Result<A>(
  get: Either<Result.Failure, Lazy<Either<ReadonlyArray<string>, A>>>,
): Result<A> {
  return { get }
}

export namespace Result {
  /**
   * Constructors
   */
  export const success = <A>(value: A): Result<A> => Result(either.right(() => either.right(value)))

  export const failure = (reversedMissing: ReadonlyArray<Missing>): Result<never> =>
    Result(either.left(Failure(reversedMissing)))

  export const fail: Result<never> = failure([])

  export const missingCommand = (command: string): Result<never> =>
    failure([Missing({ commands: [command] })])

  export const missingFlag = (flag: Opts.Name): Result<never> =>
    Result(either.left(Failure(readonlyArray.of(Missing({ flags: readonlyArray.of(flag) })))))

  export const missingArgument: Result<never> = failure([Missing({ argument: true })])

  /**
   * Methods
   */
  export const mapValidated = <A, B>(f: (a: A) => Either<ReadonlyArray<string>, B>) => (
    res: Result<A>,
  ): Result<B> =>
    pipe(
      res.get,
      either.map(_ => () => pipe(_(), either.chain(f))),
      Result,
    )

  export const map = <A, B>(f: (a: A) => B): ((fa: Result<A>) => Result<B>) =>
    mapValidated(flow(f, either.right))

  export const ap = <A, B>(fab: Result<(a: A) => B>) => (fa: Result<A>): Result<B> =>
    pipe(
      apply.sequenceT(failureValidation)(fab.get, fa.get),
      either.map(([fabGet, faGet]) => () =>
        pipe(
          apply.sequenceT(stringsValidation)(fabGet(), faGet()),
          either.map(([f, a]) => f(a)),
        ),
      ),
      Result,
    )

  export const alt = <A>(that: Lazy<Result<A>>) => (fa: Result<A>): Result<A> => {
    if (either.isRight(fa.get)) return fa
    const y = that()
    if (either.isRight(y.get)) return y

    if (readonlyArray.isEmpty(y.get.left.reversedMissing)) return fa
    if (readonlyArray.isEmpty(fa.get.left.reversedMissing)) return y

    return pipe(
      readonlyArray.zip(fa.get.left.reversedMissing, y.get.left.reversedMissing),
      readonlyArray.map(([a, b]) => Missing.semigroup.concat(a, b)),
      failure,
    )
  }

  /**
   * Instance
   */
  export const URI = URI_
  export type URI = URI_

  export const result: apply.Apply1<URI> & Alt.Alt1<URI> = {
    URI,
    map: (fa, f) => pipe(fa, map(f)),
    ap: (fab, fa) => pipe(fa, ap(fab)),
    alt: (fa, that) => pipe(fa, alt(that)),
  }

  /**
   * Failure
   */
  export type Failure = {
    readonly reversedMissing: ReadonlyArray<Missing>
  }

  export function Failure(reversedMissing: ReadonlyArray<Missing>): Failure {
    return { reversedMissing }
  }

  export namespace Failure {
    export const semigroup: Semigroup.Semigroup<Failure> = {
      concat: (x: Failure, y: Failure): Failure =>
        Failure([...y.reversedMissing, ...x.reversedMissing]),
    }

    export const messages = (f: Failure): ReadonlyArray<string> =>
      pipe(f.reversedMissing, readonlyArray.reverse, readonlyArray.map(Missing.message))
  }

  /**
   * Missing
   */
  export type Missing = {
    readonly flags: ReadonlyArray<Opts.Name>
    readonly commands: ReadonlyArray<string>
    readonly argument: boolean
  }

  export function Missing({
    flags = readonlyArray.empty,
    commands = readonlyArray.empty,
    argument = false,
  }: Partial<Missing> = {}): Missing {
    return { flags, commands, argument }
  }

  export namespace Missing {
    export const semigroup: Semigroup.Semigroup<Missing> = {
      concat: (x: Missing, y: Missing): Missing =>
        Missing({
          commands: [...x.commands, ...y.commands],
          argument: x.argument || y.argument,
        }),
    }

    export const message = (m: Missing): string => {
      const commandString = readonlyArray.isEmpty(m.commands)
        ? option.none
        : option.some(
            pipe(
              m.commands,
              readonlyArray.uniq(eq.eqString),
              StringUtils.mkString('command (', ' or ', ')'),
            ),
          )

      const argString = m.argument ? option.some('positional argument') : option.none

      return pipe(
        readonlyArray.compact([commandString, argString]),
        StringUtils.mkString('Missing expected ', ', or ', ''),
      )
    }
  }

  const failureValidation = either.getValidation(Failure.semigroup)
  const stringsValidation = either.getValidation(readonlyArray.getMonoid<string>())
}
