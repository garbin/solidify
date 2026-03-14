declare module "range-specifier-parser" {
  export interface Range {
    unit: string
    first: number
    last: number | "*"
  }

  type ParseFunction = (rangeHeader: string) => Range | -1 | -2

  const _default: { default: ParseFunction }
  export = _default
}
