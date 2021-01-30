import { pipe } from 'fp-ts/function'

import { Opts } from '../../Opts'
import { Result } from '../../Result'
import { List, Maybe, NonEmptyArray } from '../../utils/fp'
import { AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Regular'
export type URI = typeof URI

export type Regular = {
  readonly _tag: URI
  readonly names: List<Opts.Name>
  readonly values: List<string>
}

export const of = (names: List<Opts.Name>, values: List<string> = []): Regular => ({
  _tag: URI,
  names,
  values,
})

export const regular: AccumulatorHKT<URI> = {
  URI,
  parseOption: name => fa =>
    List.elem(Opts.Name.eq)(name, fa.names)
      ? Maybe.some(Match.matchOption(v => of(fa.names, List.cons(v, fa.values))))
      : Maybe.none,

  parseSub: () => () => Maybe.none,

  result: fa =>
    pipe(
      fa.values,
      List.reverse,
      NonEmptyArray.fromReadonlyArray,
      Maybe.map(Result.success),
      Maybe.getOrElse<Result<NonEmptyArray<string>>>(() => Result.fail),
    ),
}
