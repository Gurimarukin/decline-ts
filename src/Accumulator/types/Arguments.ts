import { pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Either, List, Maybe, NonEmptyArray } from '../../utils/fp'
import { AccumulatorHKT } from '../index'
import * as OrElse from './OrElse'
import * as Pure from './Pure'

export const URI = 'Arguments'
export type URI = typeof URI

export type Arguments = {
  readonly _tag: URI
  readonly stack: List<string>
}

export const of = (stack: List<string>): Arguments => ({ _tag: URI, stack })

export const arguments_: AccumulatorHKT<URI> = {
  URI,

  parseOption: () => () => Maybe.none,

  parseArg: arg => fa => {
    const noMore = Pure.of(
      Result(
        Either.right(() =>
          Either.right(pipe(NonEmptyArray.cons(arg, fa.stack), NonEmptyArray.reverse)),
        ),
      ),
    )
    const yesMore = of(List.cons(arg, fa.stack))
    return NonEmptyArray.of(Either.right(OrElse.of(noMore, yesMore)))
  },

  parseSub: () => () => Maybe.none,

  result: fa =>
    pipe(
      NonEmptyArray.fromReadonlyArray(pipe(fa.stack, List.reverse)),
      Maybe.fold(() => Result.missingArgument, Result.success),
    ),
}
