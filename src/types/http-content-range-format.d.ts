declare module "http-content-range-format" {
  export interface ContentRangeParams {
    unit: string
    first?: number
    last?: number
    length?: number
  }

  export default function format(params: ContentRangeParams): string
}
