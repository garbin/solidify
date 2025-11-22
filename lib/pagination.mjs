import fp from "fastify-plugin"
import contentRangeFormat from "http-content-range-format"
import createError from "http-errors"
import rangeSpecifierParser from "range-specifier-parser"

export function pagination({
  allowAll = true,
  maximum = 50,
  unit = "items",
} = {}) {
  return fp(
    async (app, _options) => {
      app.decorateRequest("pagination", null)
      app.decorateReply("paginate", function (pagination) {
        let { offset: first, last, length, unit = "items" } = pagination

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
          first = undefined
          last = undefined
        }

        // Set response headers based on available units.
        this.header("Accept-Ranges", unit)
        this.header(
          "Content-Range",
          contentRangeFormat({ first, last, length, unit }),
        )

        // Allow non-successful status codes.
        if (this.statusCode < 200 || this.statusCode > 300) {
          return
        }

        // Set the response as `Partial Content`.
        this.code(206)
        return this
      })

      app.addHook("onRequest", async (request, _reply) => {
        let first = 0
        let last = maximum
        let limit = "*"
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
          const range = rangeSpecifierParser.default(request.headers.range)

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
          if (last - first + 1 > maximum) {
            last = first + maximum - 1
          }

          // Calculate limit in the specified range.
          limit = last - first + 1
        }

        // Set pagination object on context.
        request.pagination = {
          limit,
          offset: first,
          unit,
          last,
        }
      })
    },
    {
      name: "solidify/pagination",
    },
  )
}

export function cursor2page(after = 0, first = 10) {
  const page = Math.floor(after / first) // Calculate page number from offset
  const pageSize = first // pageSize is the limit
  return [page, pageSize]
}
