export type Options = Options.Required | Options.Repeated

export namespace Options {
  // eslint-disable-next-line no-shadow
  export type Required = {
    readonly _tag: 'Required'
    readonly text: string
  }

  export type Repeated = {
    readonly _tag: 'Repeated'
    readonly text: string
  }

  export const required = (text: string): Required => ({ _tag: 'Required', text })
  export const repeated = (text: string): Repeated => ({ _tag: 'Repeated', text })

  export const isRequired = (opts: Options): opts is Required => opts._tag === 'Required'
  export const isRepeated = (opts: Options): opts is Repeated => opts._tag === 'Repeated'
}
