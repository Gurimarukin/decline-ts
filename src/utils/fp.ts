import {
  either,
  option,
  readonlyArray,
  readonlyNonEmptyArray,
  readonlyRecord,
  readonlyTuple,
} from 'fp-ts'

export const todo = (...[]: List<unknown>): never => {
  // eslint-disable-next-line functional/no-throw-statement
  throw Error('Missing implementation')
}

export const inspect = (...label: List<unknown>) => <A>(a: A): A => {
  console.log(...label, a)
  return a
}

export type Dict<K extends string, A> = readonlyRecord.ReadonlyRecord<K, A>
export const Dict = readonlyRecord

export type Either<E, A> = either.Either<E, A>
export const Either = either

export type Maybe<A> = option.Option<A>
export const Maybe = option

export type NonEmptyArray<A> = readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>
export const NonEmptyArray = readonlyNonEmptyArray

export type NonEmptyString = string & {
  readonly [0]: NonEmptyString
}

// can't just alias it to `Array`
export type List<A> = ReadonlyArray<A>
export const List = {
  ...readonlyArray,
  isEmpty: <A>(l: List<A>): l is readonly [] => readonlyArray.isEmpty(l),
  hasLength1: <A>(l: List<A>): l is NonEmptyArray<A> => l.length === 1,
  concat: <A>(a: List<A>, b: List<A>): List<A> => [...a, ...b],
}

export type Tuple<A, B> = readonly [A, B]
export const Tuple = readonlyTuple
