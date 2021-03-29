import { option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Opts } from '../../Opts'
import { Result } from '../../Result'
import { AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Flag'
export type URI = typeof URI

export type Flag = {
  readonly _tag: URI
  readonly names: ReadonlyArray<Opts.Name>
  readonly values: number
}

export const of = (names: ReadonlyArray<Opts.Name>, values = 0): Flag => ({
  _tag: URI,
  names,
  values,
})

export const flag: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => fa =>
    readonlyArray.elem(Opts.Name.eq)(name, fa.names)
      ? option.some(Match.matchFlag(of(fa.names, fa.values + 1)))
      : option.none,

  parseSub: () => () => option.none,

  result: fa =>
    pipe(
      readonlyArray.replicate<void>(fa.values, undefined),
      readonlyNonEmptyArray.fromReadonlyArray,
      option.fold(() => Result.missingFlag(fa.names[0] as Opts.Name), Result.success), // TODO: cast bad.
    ),
}
