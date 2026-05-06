import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { boardsService, type AddReactionInput } from '../services/boards.service'
import type { ReactionPin } from '../types/api.types'

export interface OptimisticPin extends ReactionPin {
  _pendingAmount?: number
}

export function useBoardReactions(boardImageId: string | undefined) {
  const queryKey = ['reaction-pins', boardImageId]
  const qc = useQueryClient()

  const pinsQuery = useQuery({
    queryKey,
    queryFn: () => boardsService.getReactionPins(boardImageId as string),
    enabled: !!boardImageId,
  })

  const addReaction = useMutation({
    mutationFn: async (vars: { input: AddReactionInput; pendingAmount?: number }) => {
      const res = await boardsService.addReaction(vars.input)
      return res
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<OptimisticPin[]>(queryKey) ?? []
      const optimistic: OptimisticPin = {
        id: `optimistic-${Date.now()}`,
        top: vars.input.top,
        left: vars.input.left,
        normalizedX: parseFloat(vars.input.left),
        normalizedY: parseFloat(vars.input.top),
        emoji: vars.input.emoji ?? null,
        contentType: vars.input.reactionType,
        hasPayment: !!vars.pendingAmount,
        user: null,
        _pendingAmount: vars.pendingAmount,
      }
      qc.setQueryData<OptimisticPin[]>(queryKey, [...previous, optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey })
    },
  })

  return { pinsQuery, addReaction }
}
