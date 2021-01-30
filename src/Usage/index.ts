import { flow, not, pipe } from 'fp-ts/function'

import { Opts } from '../Opts'
import { List, Maybe, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
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
  export const show = (usage: Usage): List<string> => {
    const opts = showOptions(usage.opts)
    const args = showArgs(usage.args)

    if (List.isEmpty(opts)) return args
    if (List.isEmpty(args)) return opts

    if (opts.length === args.length) return pipe(List.concat(opts, args), concat, List.of)

    return List.comprehension([opts, args], (opt, arg) => concat([opt, arg]))
  }

  /**
   * Constructors
   */
  export const fromOpts = (opts: Opts<unknown>): List<Usage> => {
    switch (opts._tag) {
      case 'Pure':
        return List.of(Usage())

      case 'App':
        return List.comprehension([fromOpts(opts.f), fromOpts(opts.a)], (l, r) =>
          Usage({
            opts: pipe(asProd(l.opts), and(asProd(r.opts))),
            args: pipe(asProd(l.args), and(asProd(r.args))),
          }),
        )

      case 'OrElse':
        const left = pipe(fromOpts(opts.a), List.reverse)
        const right = fromOpts(opts.b)

        if (List.isEmpty(left) && List.isEmpty(right)) return List.empty

        const [l, ...ls] = left
        const [r, ...rs] = right

        if (l !== undefined && r !== undefined && isEmptyProd(l.args) && isEmptyProd(r.args)) {
          return pipe(
            List.reverse(ls),
            _ => List.snoc(_, Usage({ opts: pipe(asSum(l.opts), or(asSum(r.opts))) })),
            _ => List.concat(_, rs),
          )
        }

        if (l !== undefined && r !== undefined && isEmptyProd(l.opts) && isEmptyProd(r.opts)) {
          return pipe(
            List.reverse(ls),
            _ => List.snoc(_, Usage({ args: pipe(asSum(l.args), or(asSum(r.args))) })),
            _ => List.concat(_, rs),
          )
        }

        return List.concat(List.reverse(ls), rs)

      case 'Single':
        return single(opts.opt)

      case 'Repeated':
        return repeated(opts.opt)

      case 'Subcommand':
        return List.of(Usage({ args: Many.just(Args.command(opts.command.name)) }))

      case 'Validate':
        return fromOpts(opts.value)

      case 'HelpFlag':
        return fromOpts(opts.flag)
    }
  }
}

const single = (opt: Opts.Opt<unknown>): List<Usage> => {
  switch (opt._tag) {
    case 'Regular':
      return List.of(
        Usage({
          opts: Many.just(
            Options.required(
              `${opt.names[0] === undefined ? undefined : Opts.Name.stringify(opt.names[0])} <${
                opt.metavar
              }>`,
            ),
          ),
        }),
      )

    case 'Flag':
      return List.of(
        Usage({
          opts: Many.just(
            Options.required(
              `${opt.names[0] === undefined ? undefined : Opts.Name.stringify(opt.names[0])}`,
            ),
          ),
        }),
      )

    case 'Argument':
      return List.of(Usage({ args: Many.just(Args.required(`<${opt.metavar}>`)) }))
  }
}

const repeated = (opt: Opts.Opt<unknown>): List<Usage> => {
  switch (opt._tag) {
    case 'Regular':
      return List.of(
        Usage({
          opts: Many.just(
            Options.repeated(
              `${opt.names[0] === undefined ? undefined : Opts.Name.stringify(opt.names[0])} <${
                opt.metavar
              }>`,
            ),
          ),
        }),
      )

    case 'Flag':
      return List.of(Usage({ opts: Many.just(Options.repeated(`${opt.names[0]}`)) }))

    case 'Argument':
      return List.of(Usage({ args: Many.just(Args.repeated(`<${opt.metavar}>`)) }))
  }
}

const isEmptyProd = <A>(many: Many<A>): many is Many.Prod<A> =>
  Many.isProd(many) && List.isEmpty(many.allOf)

const concat = (all: List<string>): string =>
  pipe(all, List.filter(not(StringUtils.isEmpty)), StringUtils.mkString(' '))

const asOptional = <A>(list: List<Many<A>>): Maybe<List<Many<A>>> =>
  pipe(
    NonEmptyArray.fromReadonlyArray(list),
    Maybe.chain(
      flow(NonEmptyArray.uncons, ([head, tail]) =>
        isEmptyProd(head)
          ? Maybe.some(tail.filter(not(isEmptyProd)))
          : pipe(
              asOptional(tail),
              Maybe.map((l): List<Many<A>> => List.cons(head, l)),
            ),
      ),
    ),
  )

const showOptions = (opts: Many<Options>): List<string> => {
  switch (opts._tag) {
    case 'Sum':
      return pipe(
        asOptional(opts.anyOf),
        Maybe.fold(
          () => pipe(opts.anyOf, List.chain(showOptions)),
          l =>
            // l matches List.of(Many.just(Options.Repeated(_)))
            List.hasLength1(l) && Many.isJust(l[0]) && Options.isRepeated(l[0].value)
              ? List.of(`[${l[0].value.text}]...`)
              : l.map(flow(showOptions, StringUtils.mkString('[', ' | ', ']'))), // decline uses traverse ¯\_(ツ)_/¯
        ),
      )

    case 'Just':
      const option = opts.value
      switch (option._tag) {
        case 'Required':
          return List.of(option.text)
        case 'Repeated':
          return List.of(`${option.text} [${option.text}]...`)
      }

    case 'Prod':
      return opts.allOf.map(flow(showOptions, concat)) // decline uses traverse ¯\_(ツ)_/¯
  }
}

const showArgs = (args: Many<Args>): List<string> => {
  switch (args._tag) {
    case 'Sum':
      if (List.isEmpty(args.anyOf)) return List.empty
      if (List.hasLength1(args.anyOf)) return showArgs(args.anyOf[0])
      return pipe(
        asOptional(args.anyOf),
        Maybe.fold(
          () => pipe(args.anyOf, List.chain(showArgs)),
          List.map(flow(showArgs, StringUtils.mkString('[', ' | ', ']'))), // decline uses traverse ¯\_(ツ)_/¯
        ),
      )

    case 'Prod':
      if (List.hasLength1(args.allOf)) return showArgs(args.allOf[0])
      return args.allOf.map(flow(showArgs, concat))

    case 'Just':
      const arg = args.value
      switch (arg._tag) {
        case 'Required':
          return List.of(arg.metavar)
        case 'Repeated':
          return List.of(`${arg.metavar}...`)
        case 'Command':
          return List.of(arg.name)
      }
  }
}
