import {
  alt as Alt,
  eq as Eq,
  applicative,
  apply,
  either,
  option as maybe,
  readonlyArray,
  readonlyNonEmptyArray,
  readonlyRecord,
} from 'fp-ts'
import { Lazy, Predicate, flow, pipe } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'
import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

import { Command } from './Command'
import { ValidatedNea } from './ValidatedNea'

type Validation<A> = (raw: string) => ValidatedNea<string, A>

const URI_ = 'Opts'
type URI_ = typeof URI_

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line functional/prefer-type-literal
  interface URItoKind<A> {
    readonly [URI_]: Opts<A>
  }
}

type OptionArgs = {
  readonly long: string
  readonly help: string
  readonly short?: string
  readonly metavar: string
}

type FlagArgs = {
  readonly long: string
  readonly help: string
  readonly short?: string
}

export type Opts<A> =
  | Opts.Pure<A>
  | Opts.App<unknown, A>
  | Opts.OrElse<A>
  | Opts.Single<A>
  | Opts.Repeated<A>
  | Opts.Subcommand<A>
  | Opts.Validate<unknown, A>
  | Opts.HelpFlag

export namespace Opts {
  export type Pure<A> = {
    readonly _tag: 'Pure'
    readonly a: A
  }

  export type App<A, B> = {
    readonly _tag: 'App'
    readonly f: Opts<(a: A) => B>
    readonly a: Opts<A>
  }

  export type OrElse<A> = {
    readonly _tag: 'OrElse'
    readonly a: Opts<A>
    readonly b: Opts<A>
  }

  export type Single<A> = {
    readonly _tag: 'Single'
    readonly opt: Opt<A>
  }

  export type Repeated<A> = {
    readonly _tag: 'Repeated'
    readonly opt: Opt<A>
  }

  export type Subcommand<A> = {
    readonly _tag: 'Subcommand'
    readonly command: Command<A>
  }

  export type Validate<A, B> = {
    readonly _tag: 'Validate'
    readonly value: Opts<A>
    readonly validate: (a: A) => ValidatedNea<string, B>
  }

  export type HelpFlag = {
    readonly _tag: 'HelpFlag'
    readonly flag: Opts<void>
  }

  /**
   * Constructors
   */
  export const pure = <A>(a: A): Pure<A> => ({ _tag: 'Pure', a })

  export const app = <A, B>(f: Opts<(a: A) => B>, fa: Opts<A>): Opts<B> =>
    ({ _tag: 'App', f, a: fa } as Opts<B>)

  export const orElse = <A>(a: Opts<A>, b: Opts<A>): Opts<A> => ({ _tag: 'OrElse', a, b })

  export function single<A>(opt: Opt<A>): Single<A> {
    return { _tag: 'Single', opt }
  }

  export function repeated<A>(opt: Opt<A>): Opts<ReadonlyNonEmptyArray<A>> {
    return { _tag: 'Repeated', opt }
  }

  export function subcommand<A>(command: Command<A>): Subcommand<A>
  export function subcommand({ name, header }: Command.Args): <B>(o: Opts<B>) => Subcommand<B>
  export function subcommand<A>(
    arg: Command<A> | Command.Args,
  ): Subcommand<A> | (<B>(o: Opts<B>) => Subcommand<B>) {
    return isCommand(arg)
      ? { _tag: 'Subcommand', command: arg }
      : o => ({ _tag: 'Subcommand', command: Command(arg)(o) })
  }

  const Validate = <A, B>(value: Opts<A>, vNea: (a: A) => ValidatedNea<string, B>): Opts<B> =>
    ({ _tag: 'Validate', value, validate: vNea } as Opts<B>)

  export const helpFlag = (flag: Opts<void>): Opts<never> => ({ _tag: 'HelpFlag', flag })

  export const unit: Opts<void> = pure(undefined)

  export function option(): (args: OptionArgs) => Opts<string>
  export function option<A>(codec: Validation<A>): (args: OptionArgs) => Opts<A>
  export function option<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (args: OptionArgs) => Opts<A> {
    return ({ long, help, short = '', metavar }) =>
      pipe(single(Opt.regular(Name.namesFor(long, short), metavar, help)), mapValidated(codec))
  }

  export function options(): (args: OptionArgs) => Opts<ReadonlyNonEmptyArray<string>>
  export function options<A>(
    codec: Validation<A>,
  ): (args: OptionArgs) => Opts<ReadonlyNonEmptyArray<A>>
  export function options<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (args: OptionArgs) => Opts<ReadonlyNonEmptyArray<A>> {
    return ({ long, help, short = '', metavar }) =>
      pipe(
        repeated<string>(Opt.regular(Name.namesFor(long, short), metavar, help)),
        mapValidated(args =>
          readonlyNonEmptyArray.readonlyNonEmptyArray.traverse(stringValidation)(args, codec),
        ),
      )
  }

  export const flag = ({ long, help, short = '' }: FlagArgs): Opts<void> =>
    single(Opt.flag(Name.namesFor(long, short), help))

  export const flags = ({ long, help, short = '' }: FlagArgs): Opts<number> =>
    pipe(
      repeated(Opt.flag(Name.namesFor(long, short), help)),
      map(l => l.length),
    )

  export function argument(): (metavar?: string) => Opts<string>
  export function argument<A>(codec: Validation<A>): (metavar?: string) => Opts<A>
  export function argument<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (metavar?: string) => Opts<A> {
    return (metavar = '') => pipe(single<string>(Opt.argument(metavar)), mapValidated(codec))
  }

  export function argumentS(): (metavar: string) => Opts<ReadonlyNonEmptyArray<string>>
  export function argumentS<A>(
    codec: Validation<A>,
  ): (metavar: string) => Opts<ReadonlyNonEmptyArray<A>>
  export function argumentS<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (metavar: string) => Opts<ReadonlyNonEmptyArray<A>> {
    return metavar =>
      pipe(
        repeated<string>(Opt.argument(metavar)),
        mapValidated(args =>
          readonlyNonEmptyArray.readonlyNonEmptyArray.traverse(stringValidation)(args, codec),
        ),
      )
  }

  export function param(): (metavar: string) => Opts<string>
  export function param<A>(codec: Validation<A>): (metavar: string) => Opts<A>
  export function param<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (metavar: string) => Opts<A> {
    return metavar => pipe(single(Opt.argument(metavar)), mapValidated(codec))
  }

  export function params(): (metavar: string) => Opts<ReadonlyNonEmptyArray<string>>
  export function params<A>(
    codec: Validation<A>,
  ): (metavar: string) => Opts<ReadonlyNonEmptyArray<A>>
  export function params<A>(
    codec: Validation<A> = either.right as Validation<A>,
  ): (metavar: string) => Opts<ReadonlyNonEmptyArray<A>> {
    return metavar =>
      pipe(
        repeated<string>(Opt.argument(metavar)),
        mapValidated(args =>
          readonlyNonEmptyArray.readonlyNonEmptyArray.traverse(
            either.getValidation(readonlyNonEmptyArray.getSemigroup<string>()),
          )(args, codec),
        ),
      )
  }

  /**
   * Methods
   */
  export const mapValidated = <A, B>(f: (a: A) => ValidatedNea<string, B>) => (
    fa: Opts<A>,
  ): Opts<B> =>
    fa._tag === 'Validate'
      ? Validate(fa.value, flow(fa.validate, either.chain(f)))
      : Validate(fa, f)

  export const validate = (message: string) => <A>(pred: Predicate<A>) => (fa: Opts<A>): Opts<A> =>
    pipe(
      fa,
      mapValidated(a => (pred(a) ? ValidatedNea.right(a) : ValidatedNea.left(message))),
    )

  export const withDefault = <A>(fy: Lazy<A>): ((fa: Opts<A>) => Opts<A>) => alt(() => pure(fy()))

  export const orNone = <A>(fa: Opts<A>): Opts<Option<A>> =>
    pipe(
      fa,
      map(maybe.some),
      withDefault<Option<A>>(() => maybe.none),
    )

  export const orEmpty = <A>(fa: Opts<ReadonlyNonEmptyArray<A>>): Opts<ReadonlyArray<A>> =>
    pipe(
      fa,
      withDefault<ReadonlyArray<A>>(() => []),
    )

  export const orFalse = (fa: Opts<unknown>): Opts<boolean> =>
    pipe(
      fa,
      map(() => true),
      withDefault<boolean>(() => false),
    )

  export const asHelp = (fa: Opts<unknown>): Opts<never> =>
    pipe(
      fa,
      map(() => {}),
      helpFlag,
    )

  export const map = <A, B>(f: (a: A) => B) => (fa: Opts<A>): Opts<B> =>
    mapValidated(flow(f, either.right))(fa)
  export const ap = <A, B>(fab: Opts<(a: A) => B>) => (fa: Opts<A>): Opts<B> => app(fab, fa)
  export const alt = <A>(that: Lazy<Opts<A>>) => (fa: Opts<A>): Opts<A> => orElse(fa, that())

  /**
   * Instance
   */
  export const URI = URI_
  export type URI = URI_

  export const opts: apply.Apply1<URI> & Alt.Alt1<URI> = {
    URI,
    map: (fa, f) => pipe(fa, map(f)),
    ap: (fab, fa) => pipe(fa, ap(fab)),
    alt: (fa, that) => pipe(fa, alt(that)),
  }

  /**
   * Name
   */
  export type Name = Name.LongName | Name.ShortName

  export namespace Name {
    export type LongName = {
      readonly _tag: 'LongName'
      readonly flag: string
    }

    export type ShortName = {
      readonly _tag: 'ShortName'
      readonly flag: string
    }

    // eslint-disable-next-line no-shadow
    export const longName = (flag: string): LongName => ({ _tag: 'LongName', flag })
    // eslint-disable-next-line no-shadow
    export const shortName = (flag: string): ShortName => ({ _tag: 'ShortName', flag })

    export const stringify = (name: Name): string =>
      name._tag === 'LongName' ? `--${name.flag}` : `-${name.flag}`

    export const namesFor = (long: string, short: string): ReadonlyArray<Name> =>
      readonlyArray.cons<Name>(longName(long), short.split('').map(shortName))

    export const eq = Eq.getStructEq<Name>({
      _tag: Eq.eqString,
      flag: Eq.eqString,
    })
  }

  /**
   * Opt
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type Opt<A> = Opt.Regular | Opt.Flag | Opt.Argument

  export namespace Opt {
    export type Regular = {
      readonly _tag: 'Regular'
      readonly names: ReadonlyArray<Name>
      readonly metavar: string
      readonly help: string
    }

    export type Flag = {
      readonly _tag: 'Flag'
      readonly names: ReadonlyArray<Name>
      readonly help: string
    }

    export type Argument = {
      readonly _tag: 'Argument'
      readonly metavar: string
    }

    export const regular = (
      names: ReadonlyArray<Name>,
      metavar: string,
      help: string,
    ): Opt<string> => ({
      _tag: 'Regular',
      names,
      metavar,
      help,
    })
    // eslint-disable-next-line no-shadow
    export const flag = (names: ReadonlyArray<Name>, help: string): Opt<void> => ({
      _tag: 'Flag',
      names,
      help,
    })
    // eslint-disable-next-line no-shadow
    export const argument = (metavar: string): Opt<string> => ({ _tag: 'Argument', metavar })

    const regularEq: Eq.Eq<Regular> = Eq.getStructEq<Omit<Regular, '_tag'>>({
      names: readonlyArray.getEq(Name.eq),
      metavar: Eq.eqString,
      help: Eq.eqString,
    })
    const flagEq: Eq.Eq<Flag> = Eq.getStructEq<Omit<Flag, '_tag'>>({
      names: readonlyArray.getEq(Name.eq),
      help: Eq.eqString,
    })
    const argumentEq: Eq.Eq<Argument> = Eq.getStructEq<Omit<Argument, '_tag'>>({
      metavar: Eq.eqString,
    })
    export function eq<A>(): Eq.Eq<Opt<A>> {
      return {
        equals: (x, y) => {
          switch (x._tag) {
            case 'Regular':
              return y._tag === 'Regular' ? regularEq.equals(x, y) : false
            case 'Flag':
              return y._tag === 'Flag' ? flagEq.equals(x, y) : false
            case 'Argument':
              return y._tag === 'Argument' ? argumentEq.equals(x, y) : false
          }
        },
      }
    }
  }
}

const stringValidation: applicative.Applicative2C<
  'Either',
  ReadonlyNonEmptyArray<string>
> = either.getValidation(readonlyNonEmptyArray.getSemigroup<string>())

const tagKey = '_tag'
const tagVal: Command<unknown>[typeof tagKey] = 'Command'
const isCommand = <A>(arg: Command<A> | Command.Args): arg is Command<A> =>
  pipe(
    readonlyRecord.lookup(tagKey, arg),
    maybe.exists(t => t === tagVal),
  )
