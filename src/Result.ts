import { alt as Alt, semigroup as Semigroup, apply, eq } from 'fp-ts'
import { Lazy, flow, pipe } from 'fp-ts/function'

import { Opts } from './Opts'
import { Either, List, Maybe } from './utils/fp'
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
  readonly get: Either<Result.Failure, Lazy<Either<List<string>, A>>>
}

export function Result<A>(get: Either<Result.Failure, Lazy<Either<List<string>, A>>>): Result<A> {
  return { get }
}

export namespace Result {
  /**
   * Constructors
   */
  export const success = <A>(value: A): Result<A> => Result(Either.right(() => Either.right(value)))

  export const failure = (reversedMissing: List<Missing>): Result<never> =>
    Result(Either.left(Failure(reversedMissing)))

  export const fail: Result<never> = failure([])

  export const missingCommand = (command: string): Result<never> =>
    failure([Missing({ commands: [command] })])

  export const missingFlag = (flag: Opts.Name): Result<never> =>
    Result(Either.left(Failure(List.of(Missing({ flags: List.of(flag) })))))

  export const missingArgument: Result<never> = failure([Missing({ argument: true })])

  /**
   * Methods
   */
  export const mapValidated = <A, B>(f: (a: A) => Either<List<string>, B>) => (
    res: Result<A>,
  ): Result<B> =>
    pipe(
      res.get,
      Either.map(_ => () => pipe(_(), Either.chain(f))),
      Result,
    )

  export const map = <A, B>(f: (a: A) => B): ((fa: Result<A>) => Result<B>) =>
    mapValidated(flow(f, Either.right))

  export const ap = <A, B>(fab: Result<(a: A) => B>) => (fa: Result<A>): Result<B> =>
    pipe(
      apply.sequenceT(failureValidation)(fab.get, fa.get),
      Either.map(([fabGet, faGet]) => () =>
        pipe(
          apply.sequenceT(stringsValidation)(fabGet(), faGet()),
          Either.map(([f, a]) => f(a)),
        ),
      ),
      Result,
    )

  export const alt = <A>(that: Lazy<Result<A>>) => (fa: Result<A>): Result<A> => {
    if (Either.isRight(fa.get)) return fa
    const y = that()
    if (Either.isRight(y.get)) return y

    if (List.isEmpty(y.get.left.reversedMissing)) return fa
    if (List.isEmpty(fa.get.left.reversedMissing)) return y

    return pipe(
      List.zip(fa.get.left.reversedMissing, y.get.left.reversedMissing),
      List.map(([a, b]) => Missing.semigroup.concat(a, b)),
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
    readonly reversedMissing: List<Missing>
  }

  export function Failure(reversedMissing: List<Missing>): Failure {
    return { reversedMissing }
  }

  export namespace Failure {
    export const semigroup: Semigroup.Semigroup<Failure> = {
      concat: (x: Failure, y: Failure): Failure =>
        Failure(List.concat(y.reversedMissing, x.reversedMissing)),
    }

    export const messages = (f: Failure): List<string> =>
      pipe(f.reversedMissing, List.reverse, List.map(Missing.message))
  }

  /**
   * Missing
   */
  export type Missing = {
    readonly flags: List<Opts.Name>
    readonly commands: List<string>
    readonly argument: boolean
  }

  export function Missing({
    flags = List.empty,
    commands = List.empty,
    argument = false,
  }: Partial<Missing> = {}): Missing {
    return { flags, commands, argument }
  }

  export namespace Missing {
    export const semigroup: Semigroup.Semigroup<Missing> = {
      concat: (x: Missing, y: Missing): Missing =>
        Missing({
          commands: List.concat(x.commands, y.commands),
          argument: x.argument || y.argument,
        }),
    }

    export const message = (m: Missing): string => {
      const commandString = List.isEmpty(m.commands)
        ? Maybe.none
        : Maybe.some(
            pipe(
              m.commands,
              List.uniq(eq.eqString),
              StringUtils.mkString('command (', ' or ', ')'),
            ),
          )

      const argString = m.argument ? Maybe.some('positional argument') : Maybe.none

      return pipe(
        List.compact([commandString, argString]),
        StringUtils.mkString('Missing expected ', ', or ', ''),
      )
    }
  }

  const failureValidation = Either.getValidation(Failure.semigroup)
  const stringsValidation = Either.getValidation(List.getMonoid<string>())
}
