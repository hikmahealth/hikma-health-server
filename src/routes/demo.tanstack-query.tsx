import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/integrations/trpc/react'

export const Route = createFileRoute('/demo/tanstack-query')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(
      context.trpc.people.list.queryOptions(),
    )
  },

  component: TanStackQueryDemo,
})

function TanStackQueryDemo() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.people.list.queryOptions())

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">People list</h1>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  )
}
