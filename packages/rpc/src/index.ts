/**
 * @backpine/rpc
 *
 * RPC definitions for Effect-based Cloudflare Workers.
 *
 * This package provides:
 * - RPC middleware tags for CloudflareBindings and Database
 * - RPC procedure definitions for user operations
 *
 * Middleware implementations are provided by the app using FiberRefs.
 *
 * @module
 */

// Middleware tags
export {
  RpcCloudflareMiddleware,
  RpcDatabaseMiddleware
} from "./middleware/index.js"

// Procedures
export {
  // Error schemas
  UserNotFoundErrorSchema,
  DuplicateEmailErrorSchema,
  ValidationErrorSchema,
  // Response schemas
  UserRpcSchema,
  UsersListRpcSchema,
  // Procedures
  getUser,
  listUsers,
  createUser,
  // Group
  UsersRpc
} from "./procedures/index.js"
