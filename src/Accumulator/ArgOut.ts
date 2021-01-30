import { Either, List, NonEmptyArray } from '../utils/fp'
import { Accumulator } from './index'

export type ArgOut<A> = NonEmptyArray<Either<Accumulator<A>, Accumulator<A>>>

export namespace ArgOut {
  export const squish = <A>(argOut: ArgOut<A>): ArgOut<A> => {
    const [a, ...tail] = argOut

    if (List.isEmpty(tail)) return argOut

    const [b, ...rest] = tail

    if (b === undefined) return NonEmptyArray.of(a)

    if (Either.isLeft(a) && Either.isLeft(b)) {
      return squish(NonEmptyArray.cons(Either.left(Accumulator.orElse(a.left, b.left)), rest))
    }

    if (Either.isRight(a) && Either.isRight(b)) {
      return squish(NonEmptyArray.cons(Either.right(Accumulator.orElse(a.right, b.right)), rest))
    }

    return NonEmptyArray.cons(a, squish(NonEmptyArray.cons(b, rest)))
  }
}
