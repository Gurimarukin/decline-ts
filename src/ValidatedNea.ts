import { either, option, readonlyNonEmptyArray } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { Lazy, flow } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'
import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

export type ValidatedNea<E, A> = Either<ReadonlyNonEmptyArray<E>, A>

export namespace ValidatedNea {
  export const right = <E = never, A = never>(a: A): ValidatedNea<E, A> => either.right(a)
  export const left = <E = never, A = never>(e: E): ValidatedNea<E, A> =>
    either.left(readonlyNonEmptyArray.of(e))

  export const fromEither: <E, A>(e: Either<E, A>) => ValidatedNea<E, A> = either.mapLeft(
    readonlyNonEmptyArray.of,
  )

  export const fromOption = <E, A>(onNone: Lazy<E>): ((ma: Option<A>) => ValidatedNea<E, A>) =>
    flow(either.fromOption(onNone), fromEither)

  export const fromEmptyE = <E, A>(
    e: E,
  ): ((e_: Either<ReadonlyArray<E>, A>) => ValidatedNea<E, A>) =>
    either.mapLeft(
      flow(
        readonlyNonEmptyArray.fromReadonlyArray,
        option.getOrElse(() => readonlyNonEmptyArray.of(e)),
      ),
    )

  export const fromEmptyErrors: <A>(
    e: Either<ReadonlyArray<string>, A>,
  ) => ValidatedNea<string, A> = fromEmptyE('Got empty Errors from codec')
}
