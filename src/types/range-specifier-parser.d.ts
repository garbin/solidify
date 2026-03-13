declare module "range-specifier-parser" {
  export interface Range {
    unit: string
    first: number
    last: number | "*"
  }

  export default function parse(rangeHeader: string): Range | -1 | -2
}
