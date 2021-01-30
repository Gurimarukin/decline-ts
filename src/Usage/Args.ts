export type Args = Args.Required | Args.Repeated | Args.Command

export namespace Args {
  // eslint-disable-next-line no-shadow
  export type Required = {
    readonly _tag: 'Required'
    readonly metavar: string
  }

  export type Repeated = {
    readonly _tag: 'Repeated'
    readonly metavar: string
  }

  export type Command = {
    readonly _tag: 'Command'
    readonly name: string
  }

  export const required = (metavar: string): Required => ({ _tag: 'Required', metavar })
  export const repeated = (metavar: string): Repeated => ({ _tag: 'Repeated', metavar })
  export const command = (name: string): Command => ({ _tag: 'Command', name })
}
