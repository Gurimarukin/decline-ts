import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { Either } from './utils/fp'
import { ValidatedNea } from './ValidatedNea'

export * from './Command'
export * from './Opts'

export const codecToDecode = <I, A>(codec: D.Decoder<I, A>) => (u: I): ValidatedNea<string, A> =>
  pipe(codec.decode(u), Either.mapLeft(D.draw), ValidatedNea.fromEither)
