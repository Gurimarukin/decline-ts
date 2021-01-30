import { functor } from 'fp-ts'
import { Lazy, flow, pipe } from 'fp-ts/function'

const URI = 'Match'
type URI = typeof URI

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line functional/prefer-type-literal
  interface URItoKind<A> {
    readonly [URI]: Match<A>
  }
}

export type Match<A> = MatchFlag<A> | MatchOption<A> | MatchAmbiguous

export type MatchFlag<A> = {
  readonly _tag: 'MatchFlag'
  readonly next: A
}

export type MatchOption<A> = {
  readonly _tag: 'MatchOption'
  readonly next: (str: string) => A
}

export type MatchAmbiguous = {
  readonly _tag: 'MatchAmbiguous'
}

const matchFlag = <A>(next: A): MatchFlag<A> => ({ _tag: 'MatchFlag', next })
const matchOption = <A>(next: (str: string) => A): MatchOption<A> => ({
  _tag: 'MatchOption',
  next,
})
const matchAmbiguous: MatchAmbiguous = { _tag: 'MatchAmbiguous' }

const isMatchFlag = <A>(match: Match<A>): match is MatchFlag<A> => match._tag === 'MatchFlag'
const isMatchOption = <A>(match: Match<A>): match is MatchOption<A> => match._tag === 'MatchOption'

type FoldArgs<A, B> = {
  readonly onFlag: (a: A) => B
  readonly onOption: (next: (str: string) => A) => B
  readonly onAmbiguous: Lazy<B>
}

const fold = <A, B>({ onFlag, onOption, onAmbiguous }: FoldArgs<A, B>) => (fa: Match<A>): B =>
  fa._tag === 'MatchFlag'
    ? onFlag(fa.next)
    : fa._tag === 'MatchOption'
    ? onOption(fa.next)
    : onAmbiguous()

const map = <A, B>(f: (a: A) => B) => (fa: Match<A>): Match<B> =>
  pipe(
    fa,
    fold<A, Match<B>>({
      onFlag: _ => matchFlag(f(_)),
      onOption: _ => matchOption(flow(_, f)),
      onAmbiguous: () => matchAmbiguous,
    }),
  )

const map_: functor.Functor1<URI>['map'] = (fa, f) => pipe(fa, map(f))

const match: functor.Functor1<URI> = { URI, map: map_ }

export const Match = {
  fold,
  isMatchFlag,
  isMatchOption,
  map,
  match,
  matchAmbiguous,
  matchFlag,
  matchOption,
}
