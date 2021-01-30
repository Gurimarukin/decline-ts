import { flow } from 'fp-ts/function'
import * as t from 'io-ts'
import * as D from 'io-ts/Decoder'
import { failure } from 'io-ts/PathReporter'

import { ValidatedNea } from '../ValidatedNea'
import { Either, NonEmptyArray } from './fp'

export const typeToDecode = <I, A>(decoder: t.Decoder<I, A>): ((u: I) => ValidatedNea<string, A>) =>
  flow(decoder.decode, Either.mapLeft(failure), ValidatedNea.fromEmptyErrors)

export const decoderToDecode = <I, A>(
  decoder: D.Decoder<I, A>,
): ((u: I) => ValidatedNea<string, A>) =>
  flow(decoder.decode, Either.mapLeft(flow(D.draw, NonEmptyArray.of)))
