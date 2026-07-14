import { z } from "zod";

export const createBookingSchema = z
  .object({
    roomId: z.string().min(1),
    title: z.string().min(1).max(120),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: "End time must be after start time",
    path: ["endAt"],
  });

export const updateBookingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(120),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: "End time must be after start time",
    path: ["endAt"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
