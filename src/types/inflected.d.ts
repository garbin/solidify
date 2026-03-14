declare module "inflected" {
  export function pluralize(word: string): string
  export function singularize(word: string): string
  export function capitalize(word: string): string
  export function camelCase(word: string): string
  export function underscore(word: string): string
  export function dasherize(word: string): string
  export function humanize(word: string): string
  export function titleize(word: string): string
  export function tableize(word: string): string
  export function classify(word: string): string
  export function foreignKey(word: string): string
  export function ordinal(number: number): string
  export function ordinalize(number: number): string
}
