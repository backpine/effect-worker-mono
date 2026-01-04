/**
 * RPC Procedures
 *
 * @module
 */
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
} from "./users"
