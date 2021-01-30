import { Lazy, flow } from 'fp-ts/function'

import { Either, List, Maybe, NonEmptyArray } from './utils/fp'

export type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

export namespace ValidatedNea {
  export const right = <E = never, A = never>(a: A): ValidatedNea<E, A> => Either.right(a)
  export const left = <E = never, A = never>(e: E): ValidatedNea<E, A> =>
    Either.left(NonEmptyArray.of(e))

  export const fromEither: <E, A>(either: Either<E, A>) => ValidatedNea<E, A> = Either.mapLeft(
    NonEmptyArray.of,
  )

  export const fromOption = <E, A>(onNone: Lazy<E>): ((ma: Maybe<A>) => ValidatedNea<E, A>) =>
    flow(Either.fromOption(onNone), fromEither)

  export const fromEmptyE = <E, A>(e: E): ((either: Either<List<E>, A>) => ValidatedNea<E, A>) =>
    Either.mapLeft(
      flow(
        NonEmptyArray.fromReadonlyArray,
        Maybe.getOrElse(() => NonEmptyArray.of(e)),
      ),
    )

  export const fromEmptyErrors: <A>(
    either: Either<List<string>, A>,
  ) => ValidatedNea<string, A> = fromEmptyE('Got empty Errors from codec')
}
