import { List } from '../utils/fp'

export type Many<A> = Many.Just<A> | Many.Prod<A> | Many.Sum<A>

export namespace Many {
  export type Just<A> = {
    readonly _tag: 'Just'
    readonly value: A
  }

  export type Prod<A> = {
    readonly _tag: 'Prod'
    readonly allOf: List<Many<A>>
  }

  export type Sum<A> = {
    readonly _tag: 'Sum'
    readonly anyOf: List<Many<A>>
  }

  /**
   * Constructors
   */
  export const just = <A>(value: A): Just<A> => ({ _tag: 'Just', value })
  export const prod = <A>(...allOf: List<Many<A>>): Prod<A> => ({ _tag: 'Prod', allOf })
  export const sum = <A>(...anyOf: List<Many<A>>): Sum<A> => ({ _tag: 'Sum', anyOf })

  /**
   * Methods
   */
  export const asProd = <A>(many: Many<A>): Prod<A> => prod(many)
  export const asSum = <A>(many: Many<A>): Sum<A> => sum(many)

  export const isJust = <A>(many: Many<A>): many is Just<A> => many._tag === 'Just'
  export const isProd = <A>(many: Many<A>): many is Prod<A> => many._tag === 'Prod'

  export namespace Prod {
    export const and = <A>(other: Prod<A>) => (p: Prod<A>): Prod<A> =>
      prod(...List.concat(p.allOf, other.allOf))
  }

  export namespace Sum {
    export const or = <A>(other: Sum<A>) => (s: Sum<A>): Sum<A> =>
      sum(...List.concat(s.anyOf, other.anyOf))
  }
}
