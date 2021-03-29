import { either } from 'fp-ts'
import { Either } from 'fp-ts/Either'
import { flow, pipe } from 'fp-ts/function'

import { Help } from './Help'
import { Opts } from './Opts'
import { Parser } from './Parser'
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

  export type TypeOf<C> = C extends Command<infer A> ? A : never

  export const parseHelp = <A>(args: ReadonlyArray<string>) => (cmd: Command<A>): Either<Help, A> =>
    Parser(cmd)(args)

  export const parse = <A>(args: ReadonlyArray<string>): ((cmd: Command<A>) => Either<string, A>) =>
    flow(parseHelp(args), either.mapLeft(Help.stringify))

  export const mapValidated = <A, B>(f: (a: A) => ValidatedNea<string, B>) => (
    cmd: Command<A>,
  ): Command<B> =>
    Command({ name: cmd.name, header: cmd.header })(pipe(cmd.opts, Opts.mapValidated(f)))

  export const map = <A, B>(f: (a: A) => B): ((cmd: Command<A>) => Command<B>) =>
    mapValidated(flow(f, either.right))
}
