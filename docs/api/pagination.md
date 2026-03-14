# Pagination Plugin

Fastify plugin for Range header-based pagination.

## Overview

The pagination plugin provides:
- Range header parsing (RFC 7233 compliant)
- Automatic pagination metadata on requests
- Content-Range header generation on responses

## Functions

### `pagination(options?)`

Create a Fastify pagination plugin.

**Parameters:**
- `options` (Object, optional):
  - `allowAll` (boolean, default: `true`): Allow requesting all items with `Range: items=0-*`
  - `maximum` (number, default: `50`): Maximum items per page
  - `unit` (string, default: `'items'`): Unit name for Content-Range header

**Returns:** `Function` - Fastify plugin

**Example:**
```javascript
import { WebServer, pagination } from 'solidify.js'

const app = new WebServer()
app.register(pagination({ maximum: 100 }))
```

## Request Decorations

After registration, each request has:

### `request.pagination`

Object containing pagination parameters:

| Property | Type | Description |
|----------|------|-------------|
| `offset` | number | Number of items to skip (start index) |
| `limit` | number | Maximum items per page |
| `unit` | string | Unit name |
| `last` | number | Last item index |

## Reply Decorations

### `reply.paginate(pagination)`

Set pagination metadata for the response.

**Parameters:**
- `pagination` (Object):
  - `offset` (number): Start index
  - `last` (number): Last item index
  - `length` (number): Total number of items
  - `unit` (string, optional): Unit name (defaults to `'items'`)

**Returns:** `Reply` - The reply object

**Effects:**
- Sets `Accept-Ranges` header
- Sets `Content-Range` header
- Sets status code to `206 Partial Content` (unless already set to error status)

## Range Header Format

The plugin parses Range headers in the format:

```
Range: items=0-9       # Items 0 through 9 (10 items)
Range: items=10-19     # Items 10 through 19
Range: items=0-*       # All items (if allowAll is true)
```

## Response Headers

### `Accept-Ranges: items`

Indicates the server accepts range requests for the `items` unit.

### `Content-Range: items 0-9/100`

Indicates the range returned and total count.

Format: `{unit} {first}-{last}/{total}`

## Examples

### Basic Usage

```javascript
import { WebServer, pagination } from 'solidify.js'

const app = new WebServer()
app.register(pagination())

app.get('/items', (request, reply) => {
  const items = ['a', 'b', 'c', 'd', 'e']
  
  reply.paginate({
    ...request.pagination,
    length: items.length
  })
  
  // Return paginated slice
  const start = request.pagination.offset
  const end = start + request.pagination.limit
  reply.send(items.slice(start, end))
})
```

### With Database Query

```javascript
app.get('/users', async (request, reply) => {
  const { offset, limit } = request.pagination
  
  const result = await User.query().page(offset / limit, limit)
  
  reply.paginate({
    offset,
    last: offset + result.results.length - 1,
    length: result.total
  })
  
  reply.send(result.results)
})
```

### Custom Maximum

```javascript
app.register(pagination({ maximum: 100 }))

app.get('/items', (request, reply) => {
  // request.pagination.limit will be at most 100
  reply.send([])
})
```

### Disable Allow All

```javascript
app.register(pagination({ allowAll: false }))

// Range: items=0-* will return 416 Range Not Satisfiable
```

## Error Responses

| Status Code | Condition |
|-------------|-----------|
| `412 Precondition Failed` | Malformed Range header |
| `416 Range Not Satisfiable` | Invalid range (e.g., `items=10-5`) or `0-*` when `allowAll: false` |

---

### `cursor2page(after?, first?)`

Convert cursor-based pagination to page-based parameters for Objection.js.

**Parameters:**
- `after` (number, default: `0`): The cursor offset (items to skip)
- `first` (number, default: `10`): Items per page

**Returns:** `[number, number]` - Tuple of `[page, pageSize]`

**Example:**
```javascript
import { cursor2page } from 'solidify.js'

const [page, pageSize] = cursor2page(20, 10)
// page = 2, pageSize = 10

const result = await User.query().page(page, pageSize)
```

## Integration with RESTfulRouter

The RESTfulRouter automatically uses pagination:

```javascript
import { RESTfulRouter, pagination, WebServer } from 'solidify.js'

const app = new WebServer()
app.register(pagination())

const router = new RESTfulRouter(User)
router.list() // Automatically paginates

app.register(router.plugin())

// GET /users?Range: items=0-9
// Returns 206 Partial Content with Content-Range header
```
