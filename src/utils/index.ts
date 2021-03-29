import { either, readonlyNonEmptyArray } from 'fp-ts'
import { flow } from 'fp-ts/function'
import * as t from 'io-ts'
import * as D from 'io-ts/Decoder'
import { failure } from 'io-ts/PathReporter'

import { ValidatedNea } from '../ValidatedNea'

export const typeToDecode = <I, A>(decoder: t.Decoder<I, A>): ((u: I) => ValidatedNea<string, A>) =>
  flow(decoder.decode, either.mapLeft(failure), ValidatedNea.fromEmptyErrors)

export const decoderToDecode = <I, A>(
  decoder: D.Decoder<I, A>,
): ((u: I) => ValidatedNea<string, A>) =>
  flow(decoder.decode, either.mapLeft(flow(D.draw, readonlyNonEmptyArray.of)))
