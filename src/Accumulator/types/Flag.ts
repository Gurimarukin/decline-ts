import { pipe } from 'fp-ts/function'

import { Opts } from '../../Opts'
import { Result } from '../../Result'
import { List, Maybe, NonEmptyArray } from '../../utils/fp'
import { AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Flag'
export type URI = typeof URI

export type Flag = {
  readonly _tag: URI
  readonly names: List<Opts.Name>
  readonly values: number
}

export const of = (names: List<Opts.Name>, values = 0): Flag => ({ _tag: URI, names, values })

export const flag: AccumulatorHKT<URI> = {
  URI,

  parseOption: name => fa =>
    List.elem(Opts.Name.eq)(name, fa.names)
      ? Maybe.some(Match.matchFlag(of(fa.names, fa.values + 1)))
      : Maybe.none,

  parseSub: () => () => Maybe.none,

  result: fa =>
    pipe(
      List.replicate<void>(fa.values, undefined),
      NonEmptyArray.fromReadonlyArray,
      Maybe.fold(() => Result.missingFlag(fa.names[0] as Opts.Name), Result.success), // TODO: cast bad.
    ),
}
