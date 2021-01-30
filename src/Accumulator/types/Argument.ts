import { Result } from '../../Result'
import { Either, Maybe, NonEmptyArray } from '../../utils/fp'
import { AccumulatorHKT } from '../index'
import * as Pure from './Pure'

export const URI = 'Argument'
export type URI = typeof URI

export type Argument = {
  readonly _tag: URI
}

export const of: Argument = { _tag: URI }

export const argument: AccumulatorHKT<URI> = {
  URI,

  parseOption: () => () => Maybe.none,

  parseArg: arg => () => NonEmptyArray.of(Either.right(Pure.of(Result.success(arg)))),

  parseSub: () => () => Maybe.none,

  result: () => Result.missingArgument,
}
