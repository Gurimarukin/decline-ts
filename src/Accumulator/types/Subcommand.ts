import { flow } from 'fp-ts/function'

import { Parser } from '../../Parser'
import { Result } from '../../Result'
import { Either, Maybe } from '../../utils/fp'
import { AccumulatorHKT } from '../index'

export const URI = 'Subcommand'
export type URI = typeof URI

export type Subcommand<A> = {
  readonly _tag: URI
  readonly name: string
  readonly action: Parser<A>
}

export const of = <A>(name: string, action: Parser<A>): Subcommand<A> => ({
  _tag: URI,
  name,
  action,
})

export const subcommand: AccumulatorHKT<URI> = {
  URI,

  parseOption: () => () => Maybe.none,

  parseSub: command => fa =>
    command === fa.name ? Maybe.some(flow(fa.action, Either.map(Result.success))) : Maybe.none,

  result: fa => Result.missingCommand(fa.name),
}
