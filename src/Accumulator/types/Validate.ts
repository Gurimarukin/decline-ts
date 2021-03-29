import { either, option, readonlyNonEmptyArray } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'

import { Result } from '../../Result'
import { Accumulator, AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Validate'
export type URI = typeof URI

export type Validate<A, B> = {
  readonly _tag: URI
  readonly a: Accumulator<A>
  readonly f: (a: A) => Either<ReadonlyArray<string>, B>
}

export const of = <A, B>(
  a: Accumulator<A>,
  f: (a_: A) => Either<ReadonlyArray<string>, B>,
): Validate<A, B> => ({ _tag: URI, a, f })

export const validate: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => fa =>
    pipe(fa.a, Accumulator.parseOption(name), option.map(Match.map(a => of(a, fa.f)))),

  parseArg: arg => fa =>
    pipe(
      fa.a,
      Accumulator.parseArg(arg),
      readonlyNonEmptyArray.map(
        either.bimap(Accumulator.mapValidated(fa.f), Accumulator.mapValidated(fa.f)),
      ),
    ),

  parseSub: command => fa =>
    pipe(
      fa.a,
      Accumulator.parseSub(command),
      option.map(l => flow(l, either.map(Result.mapValidated(fa.f)))),
    ),

  result: fa => pipe(fa.a, Accumulator.result, Result.mapValidated(fa.f)),
}
