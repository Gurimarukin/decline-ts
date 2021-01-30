import { Result } from '../../Result'
import { Maybe } from '../../utils/fp'
import { AccumulatorHKT } from '../index'

export const URI = 'Pure'
export type URI = typeof URI

export type Pure<A> = {
  readonly _tag: URI
  readonly value: Result<A>
}

export const of = <A>(value: Result<A>): Pure<A> => ({ _tag: URI, value })

export const pure: AccumulatorHKT<URI> = {
  URI,
  parseOption: () => () => Maybe.none,
  parseSub: () => () => Maybe.none,
  result: fa => fa.value,
}
