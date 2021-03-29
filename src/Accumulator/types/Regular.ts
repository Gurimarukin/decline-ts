import { option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

import { Opts } from '../../Opts'
import { Result } from '../../Result'
import { AccumulatorHKT } from '../index'
import { Match } from '../Match'

export const URI = 'Regular'
export type URI = typeof URI

export type Regular = {
  readonly _tag: URI
  readonly names: ReadonlyArray<Opts.Name>
  readonly values: ReadonlyArray<string>
}

export const of = (
  names: ReadonlyArray<Opts.Name>,
  values: ReadonlyArray<string> = [],
): Regular => ({
  _tag: URI,
  names,
  values,
})

export const regular: AccumulatorHKT<URI> = {
  URI,
  parseOption: name => fa =>
    readonlyArray.elem(Opts.Name.eq)(name, fa.names)
      ? option.some(Match.matchOption(v => of(fa.names, readonlyArray.cons(v, fa.values))))
      : option.none,

  parseSub: () => () => option.none,

  result: fa =>
    pipe(
      fa.values,
      readonlyArray.reverse,
      readonlyNonEmptyArray.fromReadonlyArray,
      option.map(Result.success),
      option.getOrElse<Result<ReadonlyNonEmptyArray<string>>>(() => Result.fail),
    ),
}
