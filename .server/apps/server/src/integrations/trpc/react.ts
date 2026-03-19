import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@/integrations/trpc/router'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
