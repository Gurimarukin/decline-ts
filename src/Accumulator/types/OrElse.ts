import { either, option, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Accumulator, AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'OrElse'
export type URI = typeof URI

export type OrElse<A> = {
  readonly _tag: URI
  readonly left: Accumulator<A>
  readonly right: Accumulator<A>
}

export const of = <A>(left: Accumulator<A>, right: Accumulator<A>): OrElse<A> => ({
  _tag: URI,
  left,
  right,
})

export const orElse: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => fa => {
    const left = pipe(fa.left, Accumulator.parseOption(name))
    const right = pipe(fa.right, Accumulator.parseOption(name))

    if (option.isSome(left) && option.isSome(right)) {
      const matchLeft = left.value
      const matchRight = right.value

      if (Match.isMatchFlag(matchLeft) && Match.isMatchFlag(matchRight)) {
        return option.some(Match.matchFlag(of(matchLeft.next, matchRight.next)))
      }

      if (Match.isMatchOption(matchLeft) && Match.isMatchOption(matchRight)) {
        return option.some(Match.matchOption(v => of(matchLeft.next(v), matchRight.next(v))))
      }

      return option.some(Match.matchAmbiguous)
    }

    if (option.isSome(left) && option.isNone(right)) return left
    if (option.isNone(left) && option.isSome(right)) return right

    return option.none
  },

  parseArg: arg => fa =>
    readonlyNonEmptyArray.concat(
      pipe(fa.left, Accumulator.parseArg(arg)),
      pipe(fa.right, Accumulator.parseArg(arg)),
    ),

  parseSub: command => fa => {
    const resLeft = pipe(fa.left, Accumulator.parseSub(command))
    const resRight = pipe(fa.right, Accumulator.parseSub(command))

    if (option.isSome(resLeft) && option.isSome(resRight)) {
      return option.some(args => {
        const lh = resLeft.value(args)
        if (either.isLeft(lh)) return lh

        const rh = resRight.value(args)
        if (either.isLeft(rh)) return rh

        return either.right(
          pipe(
            lh.right,
            Result.alt(() => rh.right),
          ),
        )
      })
    }

    if (option.isSome(resLeft) && option.isNone(resRight)) return resLeft
    if (option.isNone(resLeft) && option.isSome(resRight)) return resRight

    return option.none
  },

  result: fa =>
    pipe(
      Accumulator.result(fa.left),
      Result.alt(() => Accumulator.result(fa.right)),
    ),
}
