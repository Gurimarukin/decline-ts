import { ReadonlyNonEmptyArray } from 'fp-ts/ReadonlyNonEmptyArray'

export const todo = (...[]: ReadonlyArray<unknown>): never => {
  // eslint-disable-next-line functional/no-throw-statement
  throw Error('Missing implementation')
}

export const inspect = (...label: ReadonlyArray<unknown>) => <A>(a: A): A => {
  console.log(...label, a)
  return a
}

export type NonEmptyString = string & {
  readonly [0]: NonEmptyString
}

export const arrayHasLength1 = <A>(l: ReadonlyArray<A>): l is ReadonlyNonEmptyArray<A> =>
  l.length === 1
