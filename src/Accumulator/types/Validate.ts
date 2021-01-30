import { flow, pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Either, List, Maybe, NonEmptyArray } from '../../utils/fp'
import { Accumulator, AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Validate'
export type URI = typeof URI

export type Validate<A, B> = {
  readonly _tag: URI
  readonly a: Accumulator<A>
  readonly f: (a: A) => Either<List<string>, B>
}

export const of = <A, B>(
  a: Accumulator<A>,
  f: (a_: A) => Either<List<string>, B>,
): Validate<A, B> => ({ _tag: URI, a, f })

export const validate: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => fa =>
    pipe(fa.a, Accumulator.parseOption(name), Maybe.map(Match.map(a => of(a, fa.f)))),

  parseArg: arg => fa =>
    pipe(
      fa.a,
      Accumulator.parseArg(arg),
      NonEmptyArray.map(
        Either.bimap(Accumulator.mapValidated(fa.f), Accumulator.mapValidated(fa.f)),
      ),
    ),

  parseSub: command => fa =>
    pipe(
      fa.a,
      Accumulator.parseSub(command),
      Maybe.map(l => flow(l, Either.map(Result.mapValidated(fa.f)))),
    ),

  result: fa => pipe(fa.a, Accumulator.result, Result.mapValidated(fa.f)),
}
