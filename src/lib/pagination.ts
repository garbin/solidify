import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify"
import fp from "fastify-plugin"
import contentRangeFormat from "http-content-range-format"
import createError from "http-errors"
import * as rangeSpecifierParser from "range-specifier-parser"

/**
 * Pagination configuration options.
 */
export interface PaginationOptions {
  /** Allow requesting all items with Range: items=0-* (default: true) */
  allowAll?: boolean
  /** Maximum items per page (default: 50) */
  maximum?: number
  /** Unit name for Content-Range header (default: 'items') */
  unit?: string
}

/**
 * Pagination state attached to the request.
 */
export interface PaginationState {
  /** Number of items to return */
  limit: number | "*"
  /** Number of items to skip */
  offset: number
  /** Unit name */
  unit: string
  /** Last item index */
  last: number | "*"
}

/**
 * Pagination parameters for reply.paginate().
 */
export interface PaginateParams {
  /** Offset (first item index) */
  offset: number
  /** Last item index */
  last: number | "*"
  /** Total number of items */
  length: number
  /** Unit name (default: 'items') */
  unit?: string
}

// Extend Fastify types
declare module "fastify" {
  interface FastifyRequest {
    pagination: PaginationState | null
  }
  interface FastifyReply {
    paginate: (params: PaginateParams) => FastifyReply
  }
}

/**
 * Create a Fastify pagination plugin.
 * Parses Range headers and provides pagination helpers.
 *
 * @param options - Pagination options
 * @returns Fastify plugin
 *
 * @example
 * ```typescript
 * app.register(pagination({ maximum: 100 }))
 * // Request: Range: items=0-9
 * // Response: Content-Range: items 0-9/100
 * ```
 */
export function pagination({
  allowAll = true,
  maximum = 50,
  unit = "items",
}: PaginationOptions = {}): FastifyPluginCallback {
  return fp(
    async (app: FastifyInstance) => {
      app.decorateRequest("pagination", null)
      app.decorateReply(
        "paginate",
        function (
          this: FastifyReply,
          pagination: PaginateParams,
        ): FastifyReply {
          let {
            offset: first,
            last,
            length,
            unit: responseUnit = "items",
          } = pagination

          // Prevent nonexistent pages.
          if (first > length - 1 && length > 0) {
            throw new createError.RangeNotSatisfiable()
          }

          // Set the calculated `last` value.
          if (last === "*") {
            last = length
          }

          // Fix `last` value if `length` is lower.
          if (last + 1 > length && length !== 0) {
            last = length - 1
          }

          // Set `byte-range-spec` to undefined value - `*`.
          if (length === 0) {
            first = undefined as unknown as number
            last = undefined as unknown as number
          }

          // Set response headers based on available units.
          this.header("Accept-Ranges", responseUnit)
          this.header(
            "Content-Range",
            contentRangeFormat({ first, last, length, unit: responseUnit }),
          )

          // Allow non-successful status codes.
          if (this.statusCode < 200 || this.statusCode > 300) {
            return this
          }

          // Set the response as `Partial Content`.
          this.code(206)
          return this
        },
      )

      app.addHook("onRequest", async (request: FastifyRequest) => {
        let first = 0
        let last: number | "*" = maximum
        let limit: number | "*" = "*"

        // Handle `Range` header.
        if (request.headers.range) {
          // Prevent invalid `maximum` value configuration.
          if (
            !Number.isFinite(maximum) ||
            !Number.isSafeInteger(maximum) ||
            maximum <= 0
          ) {
            throw new createError.InternalServerError("Invalid Configuration")
          }
          const range = rangeSpecifierParser.default.default(
            request.headers.range,
          )

          if (range === -1) {
            throw new createError.RangeNotSatisfiable()
          }

          if (range === -2) {
            throw new createError.PreconditionFailed("Malformed Range Error")
          }

          if (range.unit !== unit) {
            throw new createError.PreconditionFailed("Malformed Range Error")
          }

          // Update `limit`, `offset` values.
          first = range.first
          last = range.last
          if (!allowAll && last === "*") {
            throw new createError.RangeNotSatisfiable()
          }

          if (
            !Number.isSafeInteger(first) ||
            (last !== "*" && !Number.isSafeInteger(last))
          ) {
            throw new createError.RangeNotSatisfiable()
          }
        }

        if (Number.isSafeInteger(last)) {
          // Prevent pages to be longer than allowed.
          if ((last as number) - first + 1 > maximum) {
            last = first + maximum - 1
          }

          // Calculate limit in the specified range.
          limit = (last as number) - first + 1
        }

        // Set pagination object on context.
        request.pagination = {
          limit,
          offset: first,
          unit,
          last: last as number | "*",
        }
      })
    },
    {
      name: "solidify/pagination",
    },
  )
}

/**
 * Convert cursor-based pagination parameters to page-based parameters.
 * Used for converting Relay-style pagination to Objection.js page() method.
 *
 * @param after - The cursor offset (number of items to skip)
 * @param first - The number of items per page
 * @returns Tuple of [page, pageSize] for Objection.js query.page()
 *
 * @example
 * ```typescript
 * const [page, pageSize] = cursor2page(20, 10) // [2, 10]
 * const results = await Model.query().page(page, pageSize)
 * ```
 */
export function cursor2page(
  after: number = 0,
  first: number = 10,
): [number, number] {
  const page = Math.floor(after / first) // Calculate page number from offset
  const pageSize = first // pageSize is the limit
  return [page, pageSize]
}
