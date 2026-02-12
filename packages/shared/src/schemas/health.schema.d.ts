import { z } from 'zod';
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
    service: z.ZodLiteral<"api">;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "ok";
    service: "api";
    timestamp: string;
}, {
    status: "ok";
    service: "api";
    timestamp: string;
}>;
