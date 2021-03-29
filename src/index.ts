import { either } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ValidatedNea } from './ValidatedNea'

export * from './Command'
export * from './Opts'

export const codecToDecode = <I, A>(codec: D.Decoder<I, A>) => (u: I): ValidatedNea<string, A> =>
  pipe(codec.decode(u), either.mapLeft(D.draw), ValidatedNea.fromEither)
