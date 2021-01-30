import { flow, pipe } from 'fp-ts/function'

import { Help } from '../Help'
import { Opts } from '../Opts'
import { Parser } from '../Parser'
import { Result } from '../Result'
import { Either, List, Maybe, NonEmptyArray } from '../utils/fp'
import { ArgOut } from './ArgOut'
import { Match } from './Match'
import * as Ap from './types/Ap'
import * as Argument from './types/Argument'
import * as Arguments from './types/Arguments'
import * as Flag from './types/Flag'
import * as OrElse from './types/OrElse'
import * as Pure from './types/Pure'
import * as Regular from './types/Regular'
import * as Subcommand from './types/Subcommand'
import * as Validate from './types/Validate'

export type AccumulatorArgOut<A> = ArgOut<A>
export const AccumulatorArgOut = ArgOut

export type AccumulatorMatch<A> = Match<A>
export const AccumulatorMatch = Match

type Err<A> = Either<List<string>, A>

// A extends Accumulator<B>
type InstType<A, B> = {
  readonly instance: A
  readonly innerType: B
}
type InstanceKind<URI extends Accumulator.URIS, A> = Accumulators<A>[URI]['instance']
type InnerTypeKind<URI extends Accumulator.URIS, A> = Accumulators<A>[URI]['innerType']

type Accumulators<A> = {
  readonly [Pure.URI]: InstType<Pure.Pure<A>, A>
  readonly [Ap.URI]: InstType<Ap.Ap<unknown, A>, A>
  readonly [OrElse.URI]: InstType<OrElse.OrElse<A>, A>
  readonly [Regular.URI]: InstType<Regular.Regular, NonEmptyArray<string>>
  readonly [Flag.URI]: InstType<Flag.Flag, NonEmptyArray<void>>
  readonly [Argument.URI]: InstType<Argument.Argument, string>
  readonly [Arguments.URI]: InstType<Arguments.Arguments, NonEmptyArray<string>>
  readonly [Subcommand.URI]: InstType<Subcommand.Subcommand<A>, A>
  readonly [Validate.URI]: InstType<Validate.Validate<unknown, A>, A>
}

export type AccumulatorHKT<URI extends Accumulator.URIS> = {
  readonly URI: URI
  readonly parseOption: (
    name: Opts.Name,
  ) => <A>(fa: InstanceKind<URI, A>) => Maybe<Match<Accumulator<InnerTypeKind<URI, A>>>>
  readonly parseArg?: (
    arg: string,
  ) => <A>(fa: InstanceKind<URI, A>) => ArgOut<InnerTypeKind<URI, A>>
  readonly parseSub: (
    command: string,
  ) => <A>(
    fa: InstanceKind<URI, A>,
  ) => Maybe<(opts: List<string>) => Either<Help, Result<InnerTypeKind<URI, A>>>>
  readonly result: <A>(fa: InstanceKind<URI, A>) => Result<InnerTypeKind<URI, A>>
}

export type Accumulator<A> = Accumulators<A>[Accumulator.URIS]['instance']

export namespace Accumulator {
  export type URIS = keyof Accumulators<unknown>

  /**
   * Constructors
   */
  export const orElse: <A>(
    left: Accumulator<A>,
    right: Accumulator<A>,
  ) => Accumulator<InnerTypeKind<OrElse.URI, A>> = OrElse.of

  export const fromOpts = <A>(opts: Opts<A>): Accumulator<A> => {
    switch (opts._tag) {
      case 'Pure':
        return Pure.of(Result.success(opts.a))

      case 'App':
        return Ap.of(fromOpts(opts.f), fromOpts(opts.a))

      case 'OrElse':
        return OrElse.of(fromOpts(opts.a), fromOpts(opts.b))

      case 'Single':
        return fromSingle(opts.opt) as Accumulator<A>

      case 'Repeated':
        return fromRepeated(opts.opt) as Accumulator<A>

      case 'Subcommand':
        return Subcommand.of(opts.command.name, Parser(opts.command))

      case 'Validate':
        return pipe(fromOpts(opts.value), mapValidated(opts.validate))

      case 'HelpFlag':
        return pipe(
          fromOpts(opts.flag),
          mapValidated(() => Either.left(List.empty)),
        )
    }
  }
  const fromSingle = <A>(opt: Opts.Opt<A>): Accumulator<unknown> => {
    switch (opt._tag) {
      case 'Regular':
        return pipe(
          Regular.of(opt.names) as Accumulator<InnerTypeKind<Regular.URI, A>>, // TODO: cast bad.
          map(NonEmptyArray.last),
        )

      case 'Flag':
        return pipe(
          Flag.of(opt.names) as Accumulator<InnerTypeKind<Flag.URI, A>>, // TODO: cast bad.
          map(NonEmptyArray.last),
        )

      case 'Argument':
        return Argument.of
    }
  }
  const fromRepeated = <A>(opt: Opts.Opt<A>): Accumulator<NonEmptyArray<unknown>> => {
    switch (opt._tag) {
      case 'Regular':
        return Regular.of(opt.names)

      case 'Flag':
        return Flag.of(opt.names)

      case 'Argument':
        return Arguments.of([])
    }
  }

  export const instances: { readonly [URI in URIS]: AccumulatorHKT<URI> } = {
    [Pure.URI]: Pure.pure,
    [Ap.URI]: Ap.ap,
    [OrElse.URI]: OrElse.orElse,
    [Regular.URI]: Regular.regular,
    [Flag.URI]: Flag.flag,
    [Argument.URI]: Argument.argument,
    [Arguments.URI]: Arguments.arguments_,
    [Subcommand.URI]: Subcommand.subcommand,
    [Validate.URI]: Validate.validate,
  }

  /**
   * Methods
   */
  export const parseOption = (name: Opts.Name) => <A>(
    fa: Accumulator<A>,
  ): Maybe<Match<Accumulator<A>>> =>
    pipe(fa, withMethod(fa._tag, 'parseOption')(name)) as Maybe<Match<Accumulator<A>>>

  export const parseArg = (arg: string) => <A>(fa: Accumulator<A>): ArgOut<A> => {
    const method = withMethod(fa._tag, 'parseArg')
    return method === undefined
      ? NonEmptyArray.of(Either.left(fa))
      : (pipe(fa, method(arg)) as ArgOut<A>)
  }

  export const parseSub = (command: string) => <A>(
    fa: Accumulator<A>,
  ): Maybe<(opts: List<string>) => Either<Help, Result<A>>> =>
    pipe(fa, withMethod(fa._tag, 'parseSub')(command)) as Maybe<
      (opts: List<string>) => Either<Help, Result<A>>
    >

  export const result = <A>(fa: Accumulator<A>): Result<A> =>
    pipe(fa, withMethod(fa._tag, 'result')) as Result<A>

  export const mapValidated = <A, B>(f: (a: A) => Err<B>) => (fa: Accumulator<A>): Accumulator<B> =>
    Validate.of(fa, f) as Accumulator<B>

  export const map = <A, B>(f: (a: A) => B): ((fa: Accumulator<A>) => Accumulator<B>) =>
    mapValidated(flow(f, Either.right))
}

const withMethod = <URI extends Accumulator.URIS, Method extends keyof AccumulatorHKT<URI>>(
  uri: URI,
  method: Method,
): AccumulatorHKT<URI>[Method] =>
  ((Accumulator.instances[uri] as unknown) as AccumulatorHKT<URI>)[method]
