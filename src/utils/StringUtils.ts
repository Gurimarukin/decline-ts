import { pipe } from 'fp-ts/function'

import { List, Maybe, NonEmptyString, Tuple } from './fp'

export namespace StringUtils {
  export const isEmpty = (str: string): str is '' => str === ''
  export const isNonEmpty = (str: string): str is NonEmptyString => !isEmpty(str)

  const margin = /^[^\n\S]*\|/gm
  export const stripMargins = (str: string): string => str.replace(margin, '')

  export function mkString(sep: string): (list: List<string>) => string
  export function mkString(start: string, sep: string, end: string): (list: List<string>) => string
  export function mkString(
    startOrSep: string,
    sep?: string,
    end?: string,
  ): (list: List<string>) => string {
    return list =>
      sep !== undefined && end !== undefined
        ? `${startOrSep}${list.join(sep)}${end}`
        : list.join(startOrSep)
  }

  const matcher = <A>(regex: RegExp, f: (arr: RegExpMatchArray) => A) => (str: string): Maybe<A> =>
    pipe(str.match(regex), Maybe.fromNullable, Maybe.map(f))

  export const matcher1 = (regex: RegExp): ((str: string) => Maybe<string>) =>
    matcher(regex, ([, a]) => a as string)

  export const matcher2 = (regex: RegExp): ((str: string) => Maybe<Tuple<string, string>>) =>
    matcher(regex, ([, a, b]) => [a as string, b as string])
}
