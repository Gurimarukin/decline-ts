import { option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { flow, not, pipe } from 'fp-ts/function'
import { Option } from 'fp-ts/Option'

import { Opts } from '../Opts'
import { arrayHasLength1 } from '../utils/fp'
import { StringUtils, s } from '../utils/StringUtils'
import { Args } from './Args'
import { Many } from './Many'
import { Options } from './Options'

const asProd = Many.asProd
const asSum = Many.asSum
const and = Many.Prod.and
const or = Many.Sum.or

export type Usage = {
  readonly opts: Many<Options>
  readonly args: Many<Args>
}

export function Usage({ opts = Many.prod(), args = Many.prod() }: Partial<Usage> = {}): Usage {
  return { opts, args }
}

export namespace Usage {
  /**
   * Methods
   */
  export const show = (usage: Usage): ReadonlyArray<string> => {
    const opts = showOptions(usage.opts)
    const args = showArgs(usage.args)

    if (readonlyArray.isEmpty(opts)) return args
    if (readonlyArray.isEmpty(args)) return opts

    if (opts.length === args.length) {
      return pipe([...opts, ...args], concat, readonlyArray.of)
    }

    return readonlyArray.comprehension([opts, args], (opt, arg) => concat([opt, arg]))
  }

  /**
   * Constructors
   */
  export const fromOpts = (opts: Opts<unknown>): ReadonlyArray<Usage> => {
    switch (opts._tag) {
      case 'Pure':
        return readonlyArray.of(Usage())

      case 'App':
        return readonlyArray.comprehension([fromOpts(opts.f), fromOpts(opts.a)], (l, r) =>
          Usage({
            opts: pipe(asProd(l.opts), and(asProd(r.opts))),
            args: pipe(asProd(l.args), and(asProd(r.args))),
          }),
        )

      case 'OrElse':
        const left = pipe(fromOpts(opts.a), readonlyArray.reverse)
        const right = fromOpts(opts.b)

        if (readonlyArray.isEmpty(left) && readonlyArray.isEmpty(right)) return readonlyArray.empty

        const [l, ...ls] = left
        const [r, ...rs] = right

        if (l !== undefined && r !== undefined && isEmptyProd(l.args) && isEmptyProd(r.args)) {
          return pipe(
            readonlyArray.reverse(ls),
            _ => readonlyArray.snoc(_, Usage({ opts: pipe(asSum(l.opts), or(asSum(r.opts))) })),
            _ => [..._, ...rs],
          )
        }

        if (l !== undefined && r !== undefined && isEmptyProd(l.opts) && isEmptyProd(r.opts)) {
          return pipe(
            readonlyArray.reverse(ls),
            _ => readonlyArray.snoc(_, Usage({ args: pipe(asSum(l.args), or(asSum(r.args))) })),
            _ => [..._, ...rs],
          )
        }

        return [...readonlyArray.reverse(ls), ...rs]

      case 'Single':
        return single(opts.opt)

      case 'Repeated':
        return repeated(opts.opt)

      case 'Subcommand':
        return readonlyArray.of(Usage({ args: Many.just(Args.command(opts.command.name)) }))

      case 'Validate':
        return fromOpts(opts.value)

      case 'HelpFlag':
        return fromOpts(opts.flag)
    }
  }
}

const single = (opt: Opts.Opt<unknown>): ReadonlyArray<Usage> => {
  switch (opt._tag) {
    case 'Regular':
      return readonlyArray.of(
        Usage({
          opts: Many.just(
            Options.required(
              // TODO: cast bad.
              s`${Opts.Name.stringify(opt.names[0] as Opts.Name)} <${opt.metavar}>`,
            ),
          ),
        }),
      )

    case 'Flag':
      return readonlyArray.of(
        Usage({
          opts: Many.just(
            Options.required(
              s`${Opts.Name.stringify(opt.names[0] as Opts.Name)}`, // TODO: cast bad.
            ),
          ),
        }),
      )

    case 'Argument':
      return readonlyArray.of(Usage({ args: Many.just(Args.required(s`<${opt.metavar}>`)) }))
  }
}

const repeated = (opt: Opts.Opt<unknown>): ReadonlyArray<Usage> => {
  switch (opt._tag) {
    case 'Regular':
      return readonlyArray.of(
        Usage({
          opts: Many.just(
            Options.repeated(
              // TODO: cast bad.
              s`${Opts.Name.stringify(opt.names[0] as Opts.Name)} <${opt.metavar}>`,
            ),
          ),
        }),
      )

    case 'Flag':
      return readonlyArray.of(
        Usage({
          opts: Many.just(
            Options.repeated(
              // TODO: cast bad.
              s`${Opts.Name.stringify(opt.names[0] as Opts.Name)}`,
            ),
          ),
        }),
      )

    case 'Argument':
      return readonlyArray.of(Usage({ args: Many.just(Args.repeated(s`<${opt.metavar}>`)) }))
  }
}

const isEmptyProd = <A>(many: Many<A>): many is Many.Prod<A> =>
  Many.isProd(many) && readonlyArray.isEmpty(many.allOf)

const concat = (all: ReadonlyArray<string>): string =>
  pipe(all, readonlyArray.filter(not(StringUtils.isEmpty)), StringUtils.mkString(' '))

const asOptional = <A>(list: ReadonlyArray<Many<A>>): Option<ReadonlyArray<Many<A>>> =>
  pipe(
    readonlyNonEmptyArray.fromReadonlyArray(list),
    option.chain(
      flow(readonlyNonEmptyArray.uncons, ([head, tail]) =>
        isEmptyProd(head)
          ? option.some(tail.filter(not(isEmptyProd)))
          : pipe(
              asOptional(tail),
              option.map((l): ReadonlyArray<Many<A>> => readonlyArray.cons(head, l)),
            ),
      ),
    ),
  )

const showOptions = (opts: Many<Options>): ReadonlyArray<string> => {
  switch (opts._tag) {
    case 'Sum':
      return pipe(
        asOptional(opts.anyOf),
        option.fold(
          () => pipe(opts.anyOf, readonlyArray.chain(showOptions)),
          l =>
            // l matches readonlyArray.of(Many.just(Options.Repeated(_)))
            arrayHasLength1(l) && Many.isJust(l[0]) && Options.isRepeated(l[0].value)
              ? readonlyArray.of(s`[${l[0].value.text}]...`)
              : l.map(flow(showOptions, StringUtils.mkString('[', ' | ', ']'))), // decline uses traverse ¯\_(ツ)_/¯
        ),
      )

    case 'Just':
      const o = opts.value
      switch (o._tag) {
        case 'Required':
          return readonlyArray.of(o.text)
        case 'Repeated':
          return readonlyArray.of(s`${o.text} [${o.text}]...`)
      }

    case 'Prod':
      return opts.allOf.map(flow(showOptions, concat)) // decline uses traverse ¯\_(ツ)_/¯
  }
}

const showArgs = (args: Many<Args>): ReadonlyArray<string> => {
  switch (args._tag) {
    case 'Sum':
      if (readonlyArray.isEmpty(args.anyOf)) return readonlyArray.empty
      if (arrayHasLength1(args.anyOf)) return showArgs(args.anyOf[0])
      return pipe(
        asOptional(args.anyOf),
        option.fold(
          () => pipe(args.anyOf, readonlyArray.chain(showArgs)),
          readonlyArray.map(flow(showArgs, StringUtils.mkString('[', ' | ', ']'))), // decline uses traverse ¯\_(ツ)_/¯
        ),
      )

    case 'Prod':
      if (arrayHasLength1(args.allOf)) return showArgs(args.allOf[0])
      return args.allOf.map(flow(showArgs, concat))

    case 'Just':
      const arg = args.value
      switch (arg._tag) {
        case 'Required':
          return readonlyArray.of(arg.metavar)
        case 'Repeated':
          return readonlyArray.of(s`${arg.metavar}...`)
        case 'Command':
          return readonlyArray.of(arg.name)
      }
  }
}
