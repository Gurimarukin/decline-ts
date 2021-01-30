import { pipe } from 'fp-ts/function'

import { List, Maybe, NonEmptyString, Tuple } from './fp'

// interpolates.length is always strings.length - 1
export const s = (strings: TemplateStringsArray, ...interpolates: List<string>): string =>
  pipe(
    strings,
    List.zip(List.snoc(interpolates, '')),
    List.reduce('', (acc, [a, b]) => `${acc}${a}${b}`),
  )

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
        ? s`${startOrSep}${list.join(sep)}${end}`
        : list.join(startOrSep)
  }

  const matcher = <A>(regex: RegExp, f: (arr: RegExpMatchArray) => Maybe<A>) => (
    str: string,
  ): Maybe<A> => pipe(str.match(regex), Maybe.fromNullable, Maybe.chain(f))

  export const matcher1 = (regex: RegExp): ((str: string) => Maybe<string>) =>
    matcher(regex, ([, a]) => Maybe.fromNullable(a))

  export const matcher2 = (regex: RegExp): ((str: string) => Maybe<Tuple<string, string>>) =>
    matcher(regex, ([, _1, _2]) =>
      pipe(
        Maybe.fromNullable(_1),
        Maybe.bindTo('a'),
        Maybe.bind('b', () => Maybe.fromNullable(_2)),
        Maybe.map(({ a, b }) => [a, b]),
      ),
    )
}
