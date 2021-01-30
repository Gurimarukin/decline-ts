import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Either, Maybe, NonEmptyArray } from '../../utils/fp'
import { ArgOut } from '../ArgOut'
import { Accumulator, AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Ap'
export type URI = typeof URI

export type Ap<E, A> = {
  readonly _tag: URI
  readonly left: Accumulator<(e: E) => A>
  readonly right: Accumulator<E>
}

export const of = <A, B>(left: Accumulator<(a: A) => B>, right: Accumulator<A>): Ap<A, B> => ({
  _tag: URI,
  left,
  right,
})

export const ap: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => <A>(fa: Ap<unknown, A>) => {
    const leftOpt = pipe(fa.left, Accumulator.parseOption(name))
    const rightOpt = pipe(fa.right, Accumulator.parseOption(name))

    if (Maybe.isSome(leftOpt) && Maybe.isNone(rightOpt)) {
      return Maybe.some(
        pipe(
          leftOpt.value,
          Match.map(v => of(v as Accumulator<(a: unknown) => A>, fa.right)),
        ),
      )
    }

    if (Maybe.isNone(leftOpt) && Maybe.isSome(rightOpt)) {
      return Maybe.some(
        pipe(
          rightOpt.value,
          Match.map(v => of(fa.left, v)),
        ),
      )
    }

    if (Maybe.isNone(leftOpt) && Maybe.isNone(rightOpt)) return Maybe.none

    return Maybe.some(Match.matchAmbiguous)
  },

  parseArg: arg => <A>(fa: Ap<unknown, A>) => {
    const parsedRight = ArgOut.squish(pipe(fa.right, Accumulator.parseArg(arg)))
    return pipe(
      ArgOut.squish(pipe(fa.left, Accumulator.parseArg(arg))),
      NonEmptyArray.chain(
        // Left side can't accept the argument: try the right
        Either.fold(
          newLeft =>
            pipe(
              parsedRight,
              NonEmptyArray.map(
                Either.bimap(
                  newRight => of(newLeft as Accumulator<(a: unknown) => A>, newRight),
                  newRight => of(newLeft as Accumulator<(a: unknown) => A>, newRight),
                ),
              ),
            ),
          newLeft =>
            NonEmptyArray.of(Either.right(of(newLeft as Accumulator<(a: unknown) => A>, fa.right))),
        ),
      ),
    )
  },

  parseSub: command => fa => {
    const leftSub = pipe(
      fa.left,
      Accumulator.parseSub(command),
      Maybe.map(parser =>
        flow(
          parser,
          Either.map(leftResult =>
            pipe(
              apply.sequenceT(Result.result)(leftResult, Accumulator.result(fa.right)),
              Result.map(([f, a]) => f(a)),
            ),
          ),
        ),
      ),
    )
    const rightSub = pipe(
      fa.right,
      Accumulator.parseSub(command),
      Maybe.map(parser =>
        flow(
          parser,
          Either.map(rightResult =>
            pipe(
              apply.sequenceT(Result.result)(Accumulator.result(fa.left), rightResult),
              Result.map(([f, a]) => f(a)),
            ),
          ),
        ),
      ),
    )
    return pipe(
      leftSub,
      Maybe.alt(() => rightSub),
    )
  },

  result: fa => pipe(Accumulator.result(fa.right), Result.ap(Accumulator.result(fa.left))),
}
