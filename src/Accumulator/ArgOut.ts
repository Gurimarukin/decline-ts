import { either, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

import { Accumulator } from './index'

export type ArgOut<A> = ReadonlyNonEmptyArray<Either<Accumulator<A>, Accumulator<A>>>

export namespace ArgOut {
  export const squish = <A>(argOut: ArgOut<A>): ArgOut<A> => {
    const [a, ...tail] = argOut

    if (readonlyArray.isEmpty(tail)) return argOut

    const [b, ...rest] = tail

    if (b === undefined) return readonlyNonEmptyArray.of(a)

    if (either.isLeft(a) && either.isLeft(b)) {
      return squish(
        readonlyNonEmptyArray.cons(either.left(Accumulator.orElse(a.left, b.left)), rest),
      )
    }

    if (either.isRight(a) && either.isRight(b)) {
      return squish(
        readonlyNonEmptyArray.cons(either.right(Accumulator.orElse(a.right, b.right)), rest),
      )
    }

    return readonlyNonEmptyArray.cons(a, squish(readonlyNonEmptyArray.cons(b, rest)))
  }
}
