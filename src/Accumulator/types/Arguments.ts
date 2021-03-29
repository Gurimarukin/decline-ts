import { either, option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { AccumulatorHKT } from '../index'
import * as OrElse from './OrElse'
import * as Pure from './Pure'

export const URI = 'Arguments'
export type URI = typeof URI

export type Arguments = {
  readonly _tag: URI
  readonly stack: ReadonlyArray<string>
}

export const of = (stack: ReadonlyArray<string>): Arguments => ({ _tag: URI, stack })

export const arguments_: AccumulatorHKT<URI> = {
  URI,

  parseOption: () => () => option.none,

  parseArg: arg => fa => {
    const noMore = Pure.of(
      Result(
        either.right(() =>
          either.right(
            pipe(readonlyNonEmptyArray.cons(arg, fa.stack), readonlyNonEmptyArray.reverse),
          ),
        ),
      ),
    )
    const yesMore = of(readonlyArray.cons(arg, fa.stack))
    return readonlyNonEmptyArray.of(either.right(OrElse.of(noMore, yesMore)))
  },

  parseSub: () => () => option.none,

  result: fa =>
    pipe(
      readonlyNonEmptyArray.fromReadonlyArray(pipe(fa.stack, readonlyArray.reverse)),
      option.fold(() => Result.missingArgument, Result.success),
    ),
}
