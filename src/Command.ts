import { flow, pipe } from 'fp-ts/function'

import { Help } from './Help'
import { Opts } from './Opts'
import { Parser } from './Parser'
import { Either, List } from './utils/fp'
import { ValidatedNea } from './ValidatedNea'

export type Command<A> = {
  readonly _tag: 'Command'
  readonly name: string
  readonly header: string
  readonly opts: Opts<A>
}

export function Command({ name, header }: Command.Args): <A>(opts: Opts<A>) => Command<A> {
  return opts => ({ _tag: 'Command', name, header, opts })
}

export namespace Command {
  export type Args = {
    readonly name: string
    readonly header: string
  }

  export const parseHelp = <A>(args: List<string>) => (cmd: Command<A>): Either<Help, A> =>
    Parser(cmd)(args)

  export const parse = <A>(args: List<string>): ((cmd: Command<A>) => Either<string, A>) =>
    flow(parseHelp(args), Either.mapLeft(Help.stringify))

  export const mapValidated = <A, B>(f: (a: A) => ValidatedNea<string, B>) => (
    cmd: Command<A>,
  ): Command<B> =>
    Command({ name: cmd.name, header: cmd.header })(pipe(cmd.opts, Opts.mapValidated(f)))

  export const map = <A, B>(f: (a: A) => B): ((cmd: Command<A>) => Command<B>) =>
    mapValidated(flow(f, Either.right))
}
