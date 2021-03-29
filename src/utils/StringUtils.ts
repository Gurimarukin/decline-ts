import { option, readonlyArray } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'

import { NonEmptyString } from './fp'

// interpolates.length is always strings.length - 1
export const s = (strings: TemplateStringsArray, ...interpolates: ReadonlyArray<string>): string =>
  pipe(
    strings,
    readonlyArray.zip(readonlyArray.snoc(interpolates, '')),
    readonlyArray.reduce('', (acc, [a, b]) => `${acc}${a}${b}`),
  )

export namespace StringUtils {
  export const isEmpty = (str: string): str is '' => str === ''
  export const isNonEmpty = (str: string): str is NonEmptyString => !isEmpty(str)

  const margin = /^[^\n\S]*\|/gm
  export const stripMargins = (str: string): string => str.replace(margin, '')

  export function mkString(sep: string): (list: ReadonlyArray<string>) => string
  export function mkString(
    start: string,
    sep: string,
    end: string,
  ): (list: ReadonlyArray<string>) => string
  export function mkString(
    startOrSep: string,
    sep?: string,
    end?: string,
  ): (list: ReadonlyArray<string>) => string {
    return list =>
      sep !== undefined && end !== undefined
        ? s`${startOrSep}${list.join(sep)}${end}`
        : list.join(startOrSep)
  }

  const matcher = <A>(regex: RegExp, f: (arr: RegExpMatchArray) => Option<A>) => (
    str: string,
  ): Option<A> => pipe(str.match(regex), option.fromNullable, option.chain(f))

  export const matcher1 = (regex: RegExp): ((str: string) => Option<string>) =>
    matcher(regex, ([, a]) => option.fromNullable(a))

  export const matcher2 = (regex: RegExp): ((str: string) => Option<readonly [string, string]>) =>
    matcher(regex, ([, _1, _2]) =>
      pipe(
        option.fromNullable(_1),
        option.bindTo('a'),
        option.bind('b', () => option.fromNullable(_2)),
        option.map(({ a, b }) => [a, b]),
      ),
    )
}
