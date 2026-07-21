import { z } from "zod";

export const identifierSchema = z.string().min(1).max(100);
