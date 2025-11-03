/**
 * @fileoverview Demonstration script showcasing optimistic and pessimistic locking
 * behaviors against a NestJS API with TypeORM and PostgreSQL.
 *
 * Flow
 * - Create a product
 * - Attempt an optimistic update with a stale version (expect conflict)
 * - Execute two concurrent purchases to demonstrate pessimistic write locking
 * - Fetch and print the final product state
 *
 * Requirements
 * - Node.js 18+ (uses global `fetch`)
 * - API server running at `BASE_URL` (default: http://localhost:3000)
 * - `ts-node` available via dev dependencies
 *
 * Usage
 * - Start API: `yarn start:dev`
 * - Run demo: `yarn demo:purchase`
 * - Override base URL: `API_BASE_URL=http://localhost:3001 yarn demo:purchase`
 */

/**
 * Base URL for the API endpoints.
 * Can be overridden via the `API_BASE_URL` environment variable.
 * @constant {string}
 */
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Represents a product resource as returned by the API.
 */
type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  version?: number;
};

/**
 * Sends a POST request with a JSON body and returns the response status
 * and the parsed JSON if available. Falls back to raw text if JSON parsing fails.
 *
 * @template T Parsed response type when JSON is returned.
 * @param {string} path Relative API path (e.g., `/products`).
 * @param {unknown} body Serializable payload to send in the request body.
 * @returns {Promise<{ status: number; json?: T; text?: string }>} Object containing
 * the HTTP status and either parsed JSON or raw text.
 */
async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ status: number; json?: T; text?: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as T };
  } catch {
    return { status: res.status, text };
  }
}

/**
 * Sends a PUT request with a JSON body and returns the response status
 * and the parsed JSON if available. Falls back to raw text if JSON parsing fails.
 *
 * @template T Parsed response type when JSON is returned.ƒ
 * @param {string} path Relative API path (e.g., `/products/:id`).
 * @param {unknown} body Serializable payload to send in the request body.
 * @returns {Promise<{ status: number; json?: T; text?: string }>} Object containing
 * the HTTP status and either parsed JSON or raw text.
 */
async function putJson<T>(
  path: string,
  body: unknown,
): Promise<{ status: number; json?: T; text?: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as T };
  } catch {
    return { status: res.status, text };
  }
}

/**
 * Performs a GET request and returns the parsed JSON on success.
 * Throws an error if the response is not OK (non-2xx status).
 *
 * @template T Expected JSON shape.
 * @param {string} path Relative API path (e.g., `/products/:id`).
 * @returns {Promise<T>} Parsed JSON payload.
 * @throws {Error} When the response status is not OK.
 */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Creates a new product via `POST /products` and ensures a 201 Created response.
 *
 * @param {string} name Product name.
 * @param {number} price Product price (numeric).
 * @param {number} stock Initial stock quantity.
 * @returns {Promise<Product>} The created product resource.
 * @throws {Error} When the server does not return 201 or the body is not JSON.
 */
async function createProduct(
  name: string,
  price: number,
  stock: number,
): Promise<Product> {
  const { status, json, text } = await postJson<Product>('/products', {
    name,
    price,
    stock,
  });
  if (status !== 201 || !json)
    throw new Error(`Create failed: status=${status} body=${text}`);
  return json;
}

/**
 * Attempts to purchase a given quantity from the specified product using
 * the `POST /products/:id/purchase` endpoint which is protected by a
 * pessimistic write lock on the server side.
 *
 * A successful purchase typically returns `201 Created`. Insufficient stock
 * should return `409 Conflict`.
 *
 * @param {number} id Product identifier.
 * @param {number} quantity Desired purchase quantity.
 * @returns {Promise<{ status: number; json?: Product; text?: string }>} The response status
 * and optionally the updated product JSON.
 */
async function purchase(id: number, quantity: number) {
  return postJson<Product>(`/products/${id}/purchase`, { quantity });
}

/**
 * Attempts a full update using optimistic locking. The server expects the
 * current `version` value; providing a stale version should result in a
 * `409 Conflict`.
 *
 * @param {number} id Product identifier.
 * @param {Product} p Product payload including the `version` to submit.
 * @returns {Promise<{ status: number; json?: Product; text?: string }>} The response status
 * and optionally the updated product JSON.
 */
async function optimisticUpdate(id: number, p: Product) {
  return putJson<Product>(`/products/${id}`, {
    name: p.name,
    price: p.price,
    stock: p.stock,
    version: p.version,
  });
}

/**
 * Orchestrates the end-to-end demo:
 * 1) Creates a product
 * 2) Tries an optimistic update with a deliberately stale version
 * 3) Executes two concurrent purchases (2 and 4) to demonstrate locking behavior
 * 4) Fetches and logs the final product state
 *
 * Exits with a non-zero status code if any step fails.
 * @returns {Promise<void>} A promise that resolves when the demo completes.
 */
async function main() {
  console.log(`Base URL: ${BASE_URL}`);

  // 1) Create product
  const product = await createProduct('LockDemo', 10, 5);
  console.log('Created product:', product);

  // 2) Show optimistic lock example quickly (stale version)
  const fresh = await getJson<Product>(`/products/${product.id}`);
  const staleVersion = (fresh.version ?? 1) - 1;
  const staleRes = await optimisticUpdate(product.id, {
    ...fresh,
    version: staleVersion,
  });
  console.log(
    'Optimistic update with stale version → status:',
    staleRes.status,
  );

  // 3) Concurrent purchases: 2 and 4
  console.log('Running concurrent purchases (2 and 4)...');
  const [r1, r2] = await Promise.allSettled([
    purchase(product.id, 2),
    purchase(product.id, 4),
  ]);

  const toStatus = (
    r: PromiseSettledResult<Awaited<ReturnType<typeof purchase>>>,
  ) => (r.status === 'fulfilled' ? r.value.status : -1);
  console.log('Purchase #1 status:', toStatus(r1));
  console.log('Purchase #2 status:', toStatus(r2));

  const final = await getJson<Product>(`/products/${product.id}`);
  console.log('Final product:', final);
  console.log('Final stock:', final.stock, 'version:', final.version);
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exitCode = 1;
});
