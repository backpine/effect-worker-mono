import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { rpc } from "./client"
import { userKeys } from "./keys"

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => rpc((client) => client.listUsers()),
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => rpc((client) => client.getUser({ id })),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; name: string }) =>
      rpc((client) => client.createUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}
