import { Effect } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import { UserSchema, UsersListSchema, type User } from "@repo/contracts/api"
import { CreateUserSchema, UserIdSchema } from "@repo/domain"
import { printResult } from "../output"
import { requestApi } from "../services/api"
import { root } from "./root"

const userLine = (user: User) =>
  [user.id, JSON.stringify(user.email), JSON.stringify(user.name), user.createdAt.toISOString()].join("\t")

const list = Command.make("list", {}, Effect.fn(function* () {
  const { apiUrl, json } = yield* root
  const result = yield* requestApi(apiUrl, (api) => api.users.list())
  yield* printResult(json, UsersListSchema, result, ({ users }) => users.length === 0
    ? "No users found."
    : ["ID\tEMAIL\tNAME\tCREATED AT", ...users.map(userLine)].join("\n"))
})).pipe(Command.withDescription("List users"))

const get = Command.make("get", {
  id: Argument.Int("id").pipe(
    Argument.withDescription("User ID"),
    Argument.withSchema(UserIdSchema),
  ),
}, Effect.fn(function* ({ id }) {
  const { apiUrl, json } = yield* root
  const result = yield* requestApi(apiUrl, (api) => api.users.get({ params: { id } }))
  yield* printResult(json, UserSchema, result, userLine)
})).pipe(Command.withDescription("Look up a user by ID"))

const create = Command.make("create", {
  email: Flag.String("email").pipe(
    Flag.withDescription("User email address"),
    Flag.withSchema(CreateUserSchema.fields.email),
  ),
  name: Flag.String("name").pipe(
    Flag.withDescription("User display name"),
    Flag.withSchema(CreateUserSchema.fields.name),
  ),
}, Effect.fn(function* (payload) {
  const { apiUrl, json } = yield* root
  const result = yield* requestApi(apiUrl, (api) => api.users.create({ payload }))
  yield* printResult(json, UserSchema, result, (user) => `Created user ${userLine(user)}`)
})).pipe(Command.withDescription("Create a user"))

export const users = Command.make("users").pipe(
  Command.withDescription("Manage users"),
  Command.withSubcommands([list, get, create]),
)
