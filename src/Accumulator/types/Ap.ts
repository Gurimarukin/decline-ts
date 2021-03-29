import { apply, either, option, readonlyNonEmptyArray } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Result } from '../../Result'
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

    if (option.isSome(leftOpt) && option.isNone(rightOpt)) {
      return option.some(
        pipe(
          leftOpt.value,
          Match.map(v => of(v as Accumulator<(a: unknown) => A>, fa.right)),
        ),
      )
    }

    if (option.isNone(leftOpt) && option.isSome(rightOpt)) {
      return option.some(
        pipe(
          rightOpt.value,
          Match.map(v => of(fa.left, v)),
        ),
      )
    }

    if (option.isNone(leftOpt) && option.isNone(rightOpt)) return option.none

    return option.some(Match.matchAmbiguous)
  },

  parseArg: arg => <A>(fa: Ap<unknown, A>) => {
    const parsedRight = ArgOut.squish(pipe(fa.right, Accumulator.parseArg(arg)))
    return pipe(
      ArgOut.squish(pipe(fa.left, Accumulator.parseArg(arg))),
      readonlyNonEmptyArray.chain(
        // Left side can't accept the argument: try the right
        either.fold(
          newLeft =>
            pipe(
              parsedRight,
              readonlyNonEmptyArray.map(
                either.bimap(
                  newRight => of(newLeft as Accumulator<(a: unknown) => A>, newRight),
                  newRight => of(newLeft as Accumulator<(a: unknown) => A>, newRight),
                ),
              ),
            ),
          newLeft =>
            readonlyNonEmptyArray.of(
              either.right(of(newLeft as Accumulator<(a: unknown) => A>, fa.right)),
            ),
        ),
      ),
    )
  },

  parseSub: command => fa => {
    const leftSub = pipe(
      fa.left,
      Accumulator.parseSub(command),
      option.map(parser =>
        flow(
          parser,
          either.map(leftResult =>
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
      option.map(parser =>
        flow(
          parser,
          either.map(rightResult =>
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
      option.alt(() => rightSub),
    )
  },

  result: fa => pipe(Accumulator.result(fa.right), Result.ap(Accumulator.result(fa.left))),
}
