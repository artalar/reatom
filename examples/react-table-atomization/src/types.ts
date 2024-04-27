import { z } from 'zod'

export const Data = z.object({
  name: z.string().readonly(),
  calories: z.number(),
  fat: z.number(),
  carbs: z.number(),
  protein: z.number(),
})
export type Data = z.infer<typeof Data>

export const DataList = z.array(Data)
export type DataList = z.infer<typeof DataList>
