import { either, option, readonlyNonEmptyArray } from 'fp-ts'

import { Result } from '../../Result'
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

  parseOption: () => () => option.none,

  parseArg: arg => () => readonlyNonEmptyArray.of(either.right(Pure.of(Result.success(arg)))),

  parseSub: () => () => option.none,

  result: () => Result.missingArgument,
}
