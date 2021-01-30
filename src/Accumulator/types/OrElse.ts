import { pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Either, Maybe, NonEmptyArray } from '../../utils/fp'
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

    if (Maybe.isSome(left) && Maybe.isSome(right)) {
      const matchLeft = left.value
      const matchRight = right.value

      if (Match.isMatchFlag(matchLeft) && Match.isMatchFlag(matchRight)) {
        return Maybe.some(Match.matchFlag(of(matchLeft.next, matchRight.next)))
      }

      if (Match.isMatchOption(matchLeft) && Match.isMatchOption(matchRight)) {
        return Maybe.some(Match.matchOption(v => of(matchLeft.next(v), matchRight.next(v))))
      }

      return Maybe.some(Match.matchAmbiguous)
    }

    if (Maybe.isSome(left) && Maybe.isNone(right)) return left
    if (Maybe.isNone(left) && Maybe.isSome(right)) return right

    return Maybe.none
  },

  parseArg: arg => fa =>
    NonEmptyArray.concat(
      pipe(fa.left, Accumulator.parseArg(arg)),
      pipe(fa.right, Accumulator.parseArg(arg)),
    ),

  parseSub: command => fa => {
    const resLeft = pipe(fa.left, Accumulator.parseSub(command))
    const resRight = pipe(fa.right, Accumulator.parseSub(command))

    if (Maybe.isSome(resLeft) && Maybe.isSome(resRight)) {
      return Maybe.some(args => {
        const lh = resLeft.value(args)
        if (Either.isLeft(lh)) return lh

        const rh = resRight.value(args)
        if (Either.isLeft(rh)) return rh

        return Either.right(
          pipe(
            lh.right,
            Result.alt(() => rh.right),
          ),
        )
      })
    }

    if (Maybe.isSome(resLeft) && Maybe.isNone(resRight)) return resLeft
    if (Maybe.isNone(resLeft) && Maybe.isSome(resRight)) return resRight

    return Maybe.none
  },

  result: fa =>
    pipe(
      Accumulator.result(fa.left),
      Result.alt(() => Accumulator.result(fa.right)),
    ),
}
